"""
Purchase Service – production-ready implementation
Business logic for purchase transaction operations.
"""
from __future__ import annotations

from datetime import date, datetime, timezone, timedelta
import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError, ValidationError
from app.modules.inventory.enums import StockMovementType
from app.modules.inventory.models import StockLevel, StockMovement
from app.modules.master_data.item_master.repository import ItemMasterRepository
from app.modules.master_data.locations.repository import LocationRepository
from app.modules.suppliers.repository import SupplierRepository

from app.modules.transactions.base.models import TransactionHeader, TransactionLine
from app.modules.transactions.base.models.transaction_headers import PaymentStatus, TransactionStatus, TransactionType
from app.modules.transactions.base.repositories import (
    AsyncTransactionHeaderRepository,
    AsyncTransactionLineRepository,
)
from app.modules.transactions.purchase.schemas import (
    NewPurchaseRequest,
    NewPurchaseResponse,
    PurchaseResponse,
)

# New inventory repositories (async)
from app.modules.inventory.repository import (
    AsyncStockLevelRepository,
    AsyncStockMovementRepository,
    AsyncInventoryUnitRepository,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------


class PurchaseService:
    """Service for handling purchase transaction operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session: AsyncSession = session
        self.transaction_repo = AsyncTransactionHeaderRepository(session)
        self.line_repo = AsyncTransactionLineRepository(session)
        self.supplier_repo = SupplierRepository(session)
        self.location_repo = LocationRepository(session)
        self.item_repo = ItemMasterRepository(session)
        self.stock_level_repo = AsyncStockLevelRepository(session)
        self.stock_movement_repo = AsyncStockMovementRepository(session)
        self.inventory_unit_repo = AsyncInventoryUnitRepository(session)

    # ------------------------------------------------------------------ #
    # READ                                                               #
    # ------------------------------------------------------------------ #

    async def get_purchase_transactions(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        amount_from: Optional[Decimal] = None,
        amount_to: Optional[Decimal] = None,
        supplier_id: Optional[UUID] = None,
        status: Optional[TransactionStatus] = None,
        payment_status: Optional[PaymentStatus] = None,
    ) -> List[PurchaseResponse]:
        """Fetch purchase transactions with optional filters."""
        stmt = (
            select(TransactionHeader)
            .where(TransactionHeader.transaction_type == TransactionType.PURCHASE)
            .options(selectinload(TransactionHeader.transaction_lines))
            .order_by(TransactionHeader.transaction_date.desc())
            .offset(skip)
            .limit(limit)
        )

        if date_from:
            stmt = stmt.where(TransactionHeader.transaction_date >= date_from)
        if date_to:
            stmt = stmt.where(TransactionHeader.transaction_date <= date_to)
        if amount_from is not None:
            stmt = stmt.where(TransactionHeader.total_amount >= amount_from)
        if amount_to is not None:
            stmt = stmt.where(TransactionHeader.total_amount <= amount_to)
        if supplier_id:
            stmt = stmt.where(TransactionHeader.supplier_id == str(supplier_id))
        if status:
            stmt = stmt.where(TransactionHeader.status == status)
        if payment_status:
            stmt = stmt.where(TransactionHeader.payment_status == payment_status.value)

        res = await self.session.execute(stmt)
        transactions = res.scalars().all()

        # Batch-load related objects
        supplier_ids = {tx.supplier_id for tx in transactions if tx.supplier_id}
        location_ids = {tx.location_id for tx in transactions if tx.location_id}
        item_ids = {line.item_id for tx in transactions for line in tx.transaction_lines}

        suppliers = await self.supplier_repo.get_by_ids(list(supplier_ids)) if supplier_ids else []
        locations = await self.location_repo.get_by_ids(list(location_ids)) if location_ids else []
        items = await self.item_repo.get_by_ids(list(item_ids)) if item_ids else []

        supplier_map = {s.id: s for s in suppliers}
        location_map = {l.id: l for l in locations}
        item_map = {i.id: i for i in items}

        # Load inventory units for serial numbers (for serialized items)
        inventory_units_map = {}
        for tx in transactions:
            for line in tx.transaction_lines:
                if line.inventory_unit_id:
                    # Load inventory units for this line
                    units = await self.inventory_unit_repo.list_by_item(line.item_id)
                    # Filter units that were created for this transaction
                    line_units = [u for u in units if str(u.id) == line.inventory_unit_id]
                    inventory_units_map[str(line.id)] = line_units

        result = []
        for tx in transactions:
            # Calculate correct totals from line items
            calculated_totals = self._calculate_transaction_totals(tx.transaction_lines)
            
            result.append(
                PurchaseResponse.from_transaction(
                    {
                        **tx.__dict__,
                        # Override with calculated totals
                        "subtotal": calculated_totals["subtotal"],
                        "tax_amount": calculated_totals["tax_amount"],
                        "discount_amount": calculated_totals["discount_amount"],
                        "total_amount": calculated_totals["total_amount"],
                        "transaction_lines": [
                            {
                                "id": line.id,
                                "item_id": line.item_id,
                                "quantity": line.quantity,
                                "unit_price": line.unit_price,
                                "tax_rate": line.tax_rate,
                                "tax_amount": line.tax_amount,
                                "discount_amount": line.discount_amount,
                                "line_total": line.line_total,
                                "description": line.description,
                                "notes": line.notes,
                                "created_at": line.created_at,
                                "updated_at": line.updated_at,
                            }
                            for line in tx.transaction_lines
                        ]
                    },
                    supplier_details=(
                        {"id": s.id, "name": s.company_name}
                        if (s := supplier_map.get(tx.supplier_id))
                        else None
                    ),
                    location_details=(
                        {"id": l.id, "name": l.location_name}
                        if (l := location_map.get(tx.location_id))
                        else None
                    ),
                    items_details={
                        str(line.item_id): {
                            "id": line.item_id,
                            "name": item_map[line.item_id].item_name,
                        }
                        for line in tx.transaction_lines
                        if line.item_id in item_map
                    },
                )
            )
        
        return result

    async def get_purchase_by_id(self, purchase_id: UUID) -> PurchaseResponse:
        """Fetch a single purchase transaction."""
        tx = await self.transaction_repo.get_with_lines(purchase_id)
        if not tx:
            raise NotFoundError(f"Purchase transaction {purchase_id} not found")
        if tx.transaction_type != TransactionType.PURCHASE:
            raise ValidationError(f"Transaction {purchase_id} is not a purchase")

        supplier = (
            await self.supplier_repo.get_by_id(tx.supplier_id)
            if tx.supplier_id
            else None
        )
        location = (
            await self.location_repo.get_by_id(tx.location_id)
            if tx.location_id
            else None
        )
        item_ids = {line.item_id for line in tx.transaction_lines}
        items = await self.item_repo.get_by_ids(list(item_ids)) if item_ids else []
        item_map = {i.id: i for i in items}

        # Load inventory units for serial numbers
        inventory_units_map = {}
        for line in tx.transaction_lines:
            if line.inventory_unit_id:
                units = await self.inventory_unit_repo.list_by_item(line.item_id)
                line_units = [u for u in units if str(u.id) == line.inventory_unit_id]
                inventory_units_map[str(line.id)] = line_units

        # Calculate correct totals from line items
        calculated_totals = self._calculate_transaction_totals(tx.transaction_lines)
        
        return PurchaseResponse.from_transaction(
            {
                **tx.__dict__,
                # Override with calculated totals
                "subtotal": calculated_totals["subtotal"],
                "tax_amount": calculated_totals["tax_amount"],
                "discount_amount": calculated_totals["discount_amount"],
                "total_amount": calculated_totals["total_amount"],
                "transaction_lines": [
                    {
                        "id": line.id,
                        "item_id": line.item_id,
                        "quantity": line.quantity,
                        "unit_price": line.unit_price,
                        "tax_rate": line.tax_rate,
                        "tax_amount": line.tax_amount,
                        "discount_amount": line.discount_amount,
                        "line_total": line.line_total,
                        "description": line.description,
                        "notes": line.notes,
                        "created_at": line.created_at,
                        "updated_at": line.updated_at,
                    }
                    for line in tx.transaction_lines
                ]
            },
            supplier_details=(
                {"id": supplier.id, "name": supplier.company_name} if supplier else None
            ),
            location_details=(
                {"id": location.id, "name": location.location_name} if location else None
            ),
            items_details={
                str(line.item_id): {
                    "id": line.item_id,
                    "name": item_map[line.item_id].item_name,
                }
                for line in tx.transaction_lines
                if line.item_id in item_map
            },
        )

    async def get_purchase_returns(self, purchase_id: UUID) -> List[Dict[str, Any]]:
        """
        Get all return transactions for a specific purchase.
        
        Currently returns empty list as return functionality is not yet implemented.
        """
        # TODO: Implement actual return transaction retrieval
        # For now, return empty list to prevent frontend errors
        return []

    # ------------------------------------------------------------------ #
    # CREATE                                                             #
        # ------------------------------------------------------------------ #
    async def create_new_purchase(self, purchase_data: NewPurchaseRequest) -> NewPurchaseResponse:
        """
        Create a new purchase transaction with detailed logging
        and try/except around every critical step.
        """
        try:
            print("[CREATE-PURCHASE] START ── purchase_data =", purchase_data)

            # ----------------------------------------------------------
            # 1) PRE-VALIDATION - Do all validation BEFORE starting transaction
            # ----------------------------------------------------------
            validation_errors = []
            
            # Validate supplier
            print("[CREATE-PURCHASE] Pre-validating supplier …")
            supplier = await self.supplier_repo.get_by_id(purchase_data.supplier_id)
            if not supplier:
                validation_errors.append(f"Supplier {purchase_data.supplier_id} not found")
            else:
                print("[CREATE-PURCHASE] ✔ supplier OK:", supplier.company_name)
            
            # Validate location
            print("[CREATE-PURCHASE] Pre-validating location …")
            location = await self.location_repo.get_by_id(purchase_data.location_id)
            if not location:
                validation_errors.append(f"Location {purchase_data.location_id} not found")
            else:
                print("[CREATE-PURCHASE] ✔ location OK:", location.location_name)
            
            # Validate all items exist
            print("[CREATE-PURCHASE] Pre-validating items …")
            item_map = {}
            for item_data in purchase_data.items:
                item = await self.item_repo.get_by_id(item_data.item_id)
                if not item:
                    validation_errors.append(f"Item {item_data.item_id} not found")
                else:
                    item_map[item_data.item_id] = item
            
            if validation_errors:
                error_msg = "Validation failed: " + "; ".join(validation_errors)
                print(f"[CREATE-PURCHASE] ✖ Pre-validation failed: {error_msg}")
                raise ValidationError(error_msg)
            
            print("[CREATE-PURCHASE] ✔ All pre-validation passed")
            
            # Now validate serial numbers and business rules
            try:
                print("[CREATE-PURCHASE] Validating items and serial numbers …")
                await self._validate_items_and_serial_numbers(purchase_data.items)
                print("[CREATE-PURCHASE] ✔ all items and serial numbers OK")
            except Exception as e:
                print("[CREATE-PURCHASE] ✖ item/serial number validation failed:", e)
                raise

            # ----------------------------------------------------------
            # 2) GENERATE TRANSACTION NUMBER
            # ----------------------------------------------------------
            try:
                print("[CREATE-PURCHASE] Generating transaction number …")
                transaction_number = await self._generate_transaction_number()
                print("[CREATE-PURCHASE] ✔ transaction_number:", transaction_number)
            except Exception as e:
                print("[CREATE-PURCHASE] ✖ failed to generate transaction number:", e)
                raise

            # ----------------------------------------------------------
            # 3) CREATE TRANSACTION HEADER
            # ----------------------------------------------------------
            try:
                print("[CREATE-PURCHASE] Creating header …")
                tx = TransactionHeader(
                    transaction_number=transaction_number,
                    transaction_type=TransactionType.PURCHASE,
                    transaction_date=purchase_data.purchase_date,
                    supplier_id=str(purchase_data.supplier_id),
                    location_id=str(purchase_data.location_id),
                    status=TransactionStatus.COMPLETED,
                    payment_status=purchase_data.payment_status.value,
                    notes=purchase_data.notes,
                    reference_number=purchase_data.reference_number,
                    subtotal=Decimal("0"),
                    tax_amount=Decimal("0"),
                    discount_amount=Decimal("0"),
                    total_amount=Decimal("0"),
                    paid_amount=Decimal("0"),
                    created_by="00000000-0000-0000-0000-000000000000",
                    updated_by="00000000-0000-0000-0000-000000000000",
                )
                self.session.add(tx)
                await self.session.flush()
                print("[CREATE-PURCHASE] ✔ header created, id =", tx.id)
            except Exception as e:
                print("[CREATE-PURCHASE] ✖ header creation failed:", e)
                raise

            # ----------------------------------------------------------
            # 4) CREATE TRANSACTION LINES & UPDATE INVENTORY
            # ----------------------------------------------------------
            subtotal = Decimal("0")
            total_tax = Decimal("0")
            total_discount = Decimal("0")
            lines_out: List[Dict[str, Any]] = []

            # Use the pre-validated item_map from above
            # (items were already validated in pre-validation step)
            
            # Double-check all items are in map (should always be true now)
            for item_in in purchase_data.items:
                if item_in.item_id not in item_map:
                    raise NotFoundError(f"Item {item_in.item_id} not found")

            for idx, item_in in enumerate(purchase_data.items, start=1):
                try:
                    print(f"[CREATE-PURCHASE] Creating line {idx} for item {item_in.item_id} …")
                    item = item_map[item_in.item_id]

                    line_subtotal = Decimal(str(item_in.quantity)) * Decimal(str(item_in.unit_cost))
                    tax = (line_subtotal * Decimal(str(item_in.tax_rate or 0))) / 100
                    discount = Decimal(str(item_in.discount_amount or 0))
                    line_total = line_subtotal + tax - discount

                    line = TransactionLine(
                        transaction_header_id=tx.id,
                        line_number=idx,
                        item_id=item_in.item_id,
                        sku=item.sku,
                        quantity=Decimal(str(item_in.quantity)),
                        unit_price=Decimal(str(item_in.unit_cost)),
                        total_price=line_subtotal,
                        tax_rate=Decimal(str(item_in.tax_rate or 0)),
                        tax_amount=tax,
                        discount_amount=discount,
                        line_total=line_total,
                        description=f"{item.item_name} (Condition: {item_in.condition})",
                        notes=item_in.notes,
                    )
                    self.session.add(line)
                    await self.session.flush()
                    print(f"[CREATE-PURCHASE] ✔ line {idx} created, id = {line.id}")
                except Exception as e:
                    print(f"[CREATE-PURCHASE] ✖ line {idx} failed:", e)
                    raise

                # --- inventory update ----------------------------------------
                try:
                    print(f"[CREATE-PURCHASE] Updating inventory for item {item_in.item_id} …")
                    
                    # Flush the session before inventory creation to catch any constraint violations early
                    await self.session.flush()
                    
                    await self._update_stock_for_purchase(
                        item_id=item_in.item_id,
                        location_id=purchase_data.location_id,
                        quantity=Decimal(str(item_in.quantity)),
                        transaction_id=tx.id,
                        transaction_line_id=line.id,
                        condition=item_in.condition,
                        unit_cost=Decimal(str(item_in.unit_cost)),
                        serial_numbers=item_in.serial_numbers,
                        item_data=item_in,  # Pass full item data for batch-specific fields
                        item=item,  # Pass pre-fetched item to avoid additional queries
                    )
                    print(f"[CREATE-PURCHASE] ✔ inventory updated for item {item_in.item_id}")
                except Exception as e:
                    print(f"[CREATE-PURCHASE] ✖ inventory update failed for item {item_in.item_id}:", e)
                    print(f"[CREATE-PURCHASE] Error type: {type(e).__name__}")
                    print(f"[CREATE-PURCHASE] Error details: {str(e)}")
                    if hasattr(e, 'orig') and hasattr(e.orig, 'pgcode'):
                        print(f"[CREATE-PURCHASE] PostgreSQL error code: {e.orig.pgcode}")
                    print(f"[CREATE-PURCHASE] Rolling back transaction due to inventory error...")
                    await self.session.rollback()
                    raise

                subtotal += line_subtotal
                total_tax += tax
                total_discount += discount
                lines_out.append(
                    {
                        "id": str(line.id),
                        "line_number": line.line_number,
                        "item_id": line.item_id,
                        "quantity": float(line.quantity),
                        "unit_price": float(line.unit_price),
                        "tax_rate": float(line.tax_rate),
                        "tax_amount": float(line.tax_amount),
                        "discount_amount": float(line.discount_amount),
                        "line_total": float(line.line_total),
                        "description": line.description,
                    }
                )

            # ----------------------------------------------------------
            # 5) UPDATE HEADER TOTALS
            # ----------------------------------------------------------
            try:
                print("[CREATE-PURCHASE] Updating header totals …")
                tx.subtotal = subtotal
                tx.tax_amount = total_tax
                tx.discount_amount = total_discount
                tx.total_amount = subtotal + total_tax - total_discount
                print("[CREATE-PURCHASE] ✔ totals updated")
            except Exception as e:
                print("[CREATE-PURCHASE] ✖ totals update failed:", e)
                raise

            # ----------------------------------------------------------
            # 6) COMMIT
            # ----------------------------------------------------------
            try:
                print("[CREATE-PURCHASE] Committing transaction …")
                await self.session.commit()
                print("[CREATE-PURCHASE] ✔ commit successful")
            except Exception as e:
                print("[CREATE-PURCHASE] ✖ commit failed:", e)
                print("[CREATE-PURCHASE] Rolling back transaction...")
                await self.session.rollback()
                raise

            # ----------------------------------------------------------
            # 7) RETURN RESPONSE
            # ----------------------------------------------------------
            response = NewPurchaseResponse(
                success=True,
                message="Purchase created successfully",
                transaction_id=tx.id,
                transaction_number=tx.transaction_number,
                data={
                    "id": str(tx.id),
                    "transaction_number": tx.transaction_number,
                    "transaction_type": tx.transaction_type.value,
                    "transaction_date": tx.transaction_date.isoformat(),
                    "supplier_id": tx.supplier_id,
                    "location_id": tx.location_id,
                    "status": tx.status.value,
                    "payment_status": tx.payment_status,
                    "subtotal": float(tx.subtotal),
                    "tax_amount": float(tx.tax_amount),
                    "discount_amount": float(tx.discount_amount),
                    "total_amount": float(tx.total_amount),
                    "transaction_lines": lines_out,
                },
            )
            print("[CREATE-PURCHASE] END ── success")
            return response

        except Exception as e:
            print("[CREATE-PURCHASE] ROLLBACK triggered ──", e)
            try:
                await self.session.rollback()
                print("[CREATE-PURCHASE] Rollback completed successfully")
            except Exception as rollback_error:
                print(f"[CREATE-PURCHASE] Rollback failed: {rollback_error}")
            
            # Handle specific database constraint violations
            error_str = str(e)
            print(f"[CREATE-PURCHASE] Error details: {error_str}")
            
            # Import necessary exceptions at the top if not already
            from app.core.errors import ConflictError
            
            # Check for PostgreSQL error details
            if hasattr(e, 'orig'):
                orig_error = e.orig
                if hasattr(orig_error, 'pgcode'):
                    pg_code = orig_error.pgcode
                    print(f"[CREATE-PURCHASE] PostgreSQL error code: {pg_code}")
                    
                    # 23505 is unique_violation
                    if pg_code == '23505':
                        if hasattr(orig_error, 'diag'):
                            detail = orig_error.diag.message_detail if orig_error.diag else None
                            constraint = orig_error.diag.constraint_name if orig_error.diag else None
                            print(f"[CREATE-PURCHASE] Constraint name: {constraint}")
                            print(f"[CREATE-PURCHASE] Error detail: {detail}")
                            
                            if constraint:
                                if "serial" in constraint.lower():
                                    # Extract the serial number from the detail if possible
                                    import re
                                    serial_match = re.search(r'serial_number\)=\(([^)]+)\)', str(detail) if detail else str(orig_error))
                                    if serial_match:
                                        serial_num = serial_match.group(1)
                                        raise ConflictError(f"Serial number '{serial_num}' already exists in the system")
                                    else:
                                        raise ConflictError("A serial number in this purchase already exists in the system")
                                elif "batch" in constraint.lower():
                                    # Extract the batch code from the detail if possible
                                    import re
                                    batch_match = re.search(r'batch_code\)=\(([^)]+)\)', str(detail) if detail else str(orig_error))
                                    if batch_match:
                                        batch_code = batch_match.group(1)
                                        raise ConflictError(f"Batch code '{batch_code}' already exists in the system")
                                    else:
                                        raise ConflictError("A batch code in this purchase already exists in the system")
                                elif "sku" in constraint.lower():
                                    raise ConflictError("A generated SKU already exists. This is rare - please try submitting again.")
                                else:
                                    raise ConflictError(f"Duplicate value detected in {constraint}")
            
            # Fallback to string matching if we don't have PostgreSQL error details
            if "duplicate key value violates unique constraint" in error_str.lower():
                if "idx_inventory_units_serial_unique" in error_str or "serial" in error_str.lower():
                    # Try to extract serial number
                    import re
                    serial_match = re.search(r'serial_number\)=\(([^)]+)\)', error_str)
                    if serial_match:
                        serial_num = serial_match.group(1)
                        raise ConflictError(f"Serial number '{serial_num}' already exists in the system")
                    else:
                        raise ConflictError("A serial number in this purchase already exists in the system")
                elif "idx_inventory_units_batch_unique" in error_str or "batch" in error_str.lower():
                    # Try to extract batch code
                    import re
                    batch_match = re.search(r'batch_code\)=\(([^)]+)\)', error_str)
                    if batch_match:
                        batch_code = batch_match.group(1)
                        raise ConflictError(f"Batch code '{batch_code}' already exists in the system")
                    else:
                        raise ConflictError("A batch code in this purchase already exists in the system")
                elif "inventory_units_sku_key" in error_str or "sku" in error_str.lower():
                    raise ConflictError("A generated SKU already exists. This is rare - please try submitting again.")
                else:
                    raise ConflictError(f"Duplicate value detected: {e}")
            elif "current transaction is aborted" in error_str.lower():
                # This means a previous error occurred in the same transaction
                # The real error should have been logged earlier, so provide a generic helpful message
                raise ValidationError(
                    "The transaction could not be completed due to a previous error. "
                    "Please check the logs for details. Common causes include: "
                    "duplicate serial numbers, duplicate batch codes, or invalid data. "
                    "Try refreshing the page and submitting again."
                )
            elif "violates check constraint" in error_str.lower():
                if "check_serialized_quantity" in error_str:
                    raise ValidationError("Serialized items must have quantity = 1")
                elif "check_serial_or_batch" in error_str:
                    raise ValidationError("Inventory units must have either a serial number or batch code, not both")
                elif "check_serial_batch_exclusive" in error_str:
                    raise ValidationError("Items cannot have both serial number and batch code")
                else:
                    raise ValidationError(f"Data validation failed: {e}")
            else:
                # Log the full exception for debugging
                import traceback
                print(f"[CREATE-PURCHASE] Full traceback:\n{traceback.format_exc()}")
                # Re-raise the original exception if it's not a constraint violation
                raise
    # ------------------------------------------------------------------ #
    # VALIDATION HELPERS                                                 #
    # ------------------------------------------------------------------ #

    async def _validate_items_and_serial_numbers(self, items: List) -> None:
        """Validate items and their serial number requirements."""
        all_serial_numbers = []  # Track all serial numbers across items for global uniqueness
        
        for item_data in items:
            item = await self.item_repo.get_by_id(item_data.item_id)
            if not item:
                raise NotFoundError(f"Item {item_data.item_id} not found")
            
            if item.serial_number_required:
                # Serial numbers are required for this item
                if not item_data.serial_numbers:
                    raise ValidationError(
                        f"Serial numbers are required for item '{item.item_name}' (SKU: {item.sku})"
                    )
                
                # Quantity must match serial number count
                if len(item_data.serial_numbers) != item_data.quantity:
                    raise ValidationError(
                        f"Item '{item.item_name}': {item_data.quantity} units ordered but "
                        f"{len(item_data.serial_numbers)} serial numbers provided"
                    )
                
                # Serial numbers must be unique within this item
                if len(set(item_data.serial_numbers)) != len(item_data.serial_numbers):
                    raise ValidationError(
                        f"Duplicate serial numbers found for item '{item.item_name}'"
                    )
                
                # Check if serial numbers already exist in the system
                for serial_no in item_data.serial_numbers:
                    if not serial_no or not serial_no.strip():
                        raise ValidationError(
                            f"Empty serial number provided for item '{item.item_name}'"
                        )
                    
                    # Check for duplicates across all items in this purchase
                    if serial_no in all_serial_numbers:
                        raise ValidationError(
                            f"Serial number '{serial_no}' is used multiple times in this purchase"
                        )
                    all_serial_numbers.append(serial_no)
                    
                    # Check if serial number already exists in the system
                    existing_unit = await self.inventory_unit_repo.get_by_serial_number(serial_no)
                    if existing_unit:
                        raise ValidationError(
                            f"Serial number '{serial_no}' already exists in the system"
                        )
            else:
                # Serial numbers should not be provided for non-serialized items
                if item_data.serial_numbers:
                    raise ValidationError(
                        f"Serial numbers provided for non-serialized item '{item.item_name}' (SKU: {item.sku})"
                    )

    # ------------------------------------------------------------------ #
    # HELPERS                                                            #
    # ------------------------------------------------------------------ #

    async def _generate_transaction_number(self) -> str:
        """Generate unique transaction number with UUID suffix for extreme concurrency."""
        import uuid
        today_str = date.today().strftime("%Y%m%d")
        
        # For extreme concurrency, use UUID suffix to guarantee uniqueness
        # This prevents collisions when multiple requests arrive at the exact same time
        unique_suffix = str(uuid.uuid4())[:8].upper()
        return f"PUR-{today_str}-{unique_suffix}"

    def _calculate_transaction_totals(self, transaction_lines: List[TransactionLine]) -> Dict[str, Decimal]:
        """Calculate transaction totals from line items."""
        subtotal = Decimal("0")
        total_tax = Decimal("0")
        total_discount = Decimal("0")
        
        for line in transaction_lines:
            # Calculate line subtotal (quantity * unit_price)
            line_subtotal = line.quantity * line.unit_price
            subtotal += line_subtotal
            total_tax += line.tax_amount
            total_discount += line.discount_amount
        
        total_amount = subtotal + total_tax - total_discount
        
        return {
            "subtotal": subtotal,
            "tax_amount": total_tax,
            "discount_amount": total_discount,
            "total_amount": total_amount,
        }

    def _map_condition_code_to_enum(self, condition_code: str) -> str:
        """Map condition code (A, B, C, D) to InventoryUnitCondition enum value."""
        mapping = {
            "A": "NEW",        # A = New/Excellent condition
            "B": "GOOD",       # B = Good condition  
            "C": "FAIR",       # C = Fair condition
            "D": "POOR",       # D = Poor condition
        }
        return mapping.get(condition_code.upper(), "GOOD")  # Default to GOOD if unknown

    def _calculate_total_item_cost(
        self,
        unit_cost: Decimal,
        quantity: Decimal,
        discount_amount: Decimal = Decimal("0"),
        tax_rate: Decimal = Decimal("0")
    ) -> Dict[str, Decimal]:
        """
        Calculate total item cost according to business rule:
        ((item_rate * quantity) - discount) + tax_amount
        
        Returns:
            Dictionary with breakdown of costs
        """
        subtotal = unit_cost * quantity
        discounted_total = subtotal - discount_amount
        tax_amount = (discounted_total * tax_rate) / Decimal("100")
        total_cost = discounted_total + tax_amount
        
        return {
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "discounted_total": discounted_total,
            "tax_rate": tax_rate,
            "tax_amount": tax_amount,
            "total_cost": total_cost,
            "cost_per_unit": total_cost / quantity if quantity > 0 else Decimal("0")
        }

    async def _update_stock_for_purchase(
        self,
        *,
        item_id: UUID,
        location_id: UUID,
        quantity: Decimal,
        transaction_id: UUID,
        transaction_line_id: UUID,
        condition: str,
        unit_cost: Decimal,
        serial_numbers: Optional[List[str]] = None,
        item_data: Optional[Any] = None,  # Full purchase item data for batch-specific fields
        item: Optional[Any] = None,  # Pre-fetched item to avoid additional queries
    ) -> None:
        """
        Update inventory models for purchase transaction according to requirements:
        1. Update StockLevel table (create if not exists)
        2. Create StockMovement entry with proper quantity tracking
        3. Create InventoryUnit entries if item requires serial numbers
        
        This method implements the exact requirements specified:
        - Atomic transaction handling
        - Proper quantity_before calculation from latest StockMovement
        - InventoryUnit creation for serialized items
        - Correct reference_id usage (transaction_header_id)
        """
        
        # Use pre-fetched item or fallback to query if not provided
        if item is None:
            item = await self.item_repo.get_by_id(item_id)
            if not item:
                raise NotFoundError(f"Item {item_id} not found")
        
        print(f"[INVENTORY-UPDATE] Item: {item.item_name}, Serial Required: {item.serial_number_required}")
        
        # ----------------------------------------------------------------
        # 1. UPDATE/CREATE STOCK LEVEL (Requirements 2.1, 2.2, 2.3)
        # ----------------------------------------------------------------
        print(f"[INVENTORY-UPDATE] Processing stock level for item {item_id} at location {location_id}")
        
        # Check if stock level entry exists for this item_id
        stock_level = await self.stock_level_repo.get_by_item_location(item_id, location_id)
        
        # Initialize original quantities for StockMovement tracking
        original_on_hand = Decimal("0")
        original_available = Decimal("0")
        
        if stock_level is not None:
            # 2.2 - Entry exists, update quantities
            print(f"[INVENTORY-UPDATE] Updating existing stock level: current on_hand={stock_level.quantity_on_hand}")
            original_on_hand = stock_level.quantity_on_hand
            original_available = stock_level.quantity_available
            
            # 2.2.1 - quantity_on_hand += quantity from purchase transaction line item
            # 2.2.2 - quantity_available += quantity from purchase transaction line item
            new_on_hand = original_on_hand + quantity
            new_available = original_available + quantity
            
            await self.stock_level_repo.update(stock_level, {
                "quantity_on_hand": new_on_hand,
                "quantity_available": new_available,
                "updated_by": "system"
            })
            print(f"[INVENTORY-UPDATE] ✔ Updated stock level: on_hand {original_on_hand} → {new_on_hand}, available {original_available} → {new_available}")
        else:
            # 2.3 - Entry does not exist, create new row
            print(f"[INVENTORY-UPDATE] Creating new stock level entry")
            stock_level = await self.stock_level_repo.create({
                "item_id": str(item_id),
                "location_id": str(location_id),
                "quantity_on_hand": quantity,      # quantity from purchase transaction line item
                "quantity_available": quantity,    # quantity from purchase transaction line item  
                "quantity_on_rent": Decimal("0"),  # 0 as specified
                "created_by": "system",
                "updated_by": "system"
            })
            print(f"[INVENTORY-UPDATE] ✔ Created stock level: on_hand={quantity}, available={quantity}, on_rent=0")
        
        # ----------------------------------------------------------------
        # 2. CREATE STOCK MOVEMENT ENTRY (Requirement 3)
        # ----------------------------------------------------------------
        print(f"[INVENTORY-UPDATE] Creating stock movement entry")
        
        # 3.6 - Find quantity_before from latest StockMovement for this item
        # Use the original_on_hand captured before StockLevel was updated
        quantity_before = await self._get_quantity_before_transaction(item_id, original_on_hand)
        quantity_after = quantity_before + quantity  # 3.8 - quantity_after = quantity_change + quantity_before
        
        # Create stock movement record with all required fields
        stock_movement = await self.stock_movement_repo.create({
            "stock_level_id": str(stock_level.id),           # 3.1 - StockLevel id
            "item_id": str(item_id),                         # 3.2 - id from ItemMaster
            "location_id": str(location_id),                 # 3.3 - transaction header location_id
            "movement_type": StockMovementType.PURCHASE,     # 3.4 - movement_type (using PURCHASE enum)
            "transaction_header_id": str(transaction_id),    # 3.6 - transaction header foreign key
            "transaction_line_id": str(transaction_line_id), # 3.7 - transaction line foreign key
            "quantity_change": quantity,                     # 3.8 - quantity from line item
            "quantity_before": quantity_before,              # 3.9 - from latest StockMovement or 0
            "quantity_after": quantity_after,                # 3.10 - quantity_change + quantity_before
            "created_by": "system",
            "updated_by": "system"
        })
        
        print(f"[INVENTORY-UPDATE] ✔ Created stock movement: change={quantity}, before={quantity_before}, after={quantity_after}")
        
        # ----------------------------------------------------------------
        # 3. CREATE INVENTORY UNITS (for both serialized and non-serialized items)
        # ----------------------------------------------------------------
        
        # Check if the transaction is still valid before proceeding
        try:
            from sqlalchemy import text
            # Try a simple query to check if transaction is still valid
            await self.session.execute(text("SELECT 1"))
        except Exception as e:
            if "current transaction is aborted" in str(e).lower():
                print("[INVENTORY-UPDATE] Transaction is in aborted state, cannot continue")
                raise ValueError("Transaction was aborted due to a previous error. Please retry the operation.")
        
        if item.serial_number_required:
            # SERIALIZED ITEMS: Create individual units with serial numbers
            print(f"[INVENTORY-UPDATE] Creating {int(quantity)} inventory units for serialized item")
            
            if not serial_numbers or len(serial_numbers) != int(quantity):
                raise ValidationError(f"Serial numbers required for item {item.item_name}")
            
            # Create individual inventory units for each quantity with serial numbers
            for i, serial_no in enumerate(serial_numbers):
                try:
                    # Generate unique SKU
                    sku = await self.inventory_unit_repo.generate_sku(item_id)
                    
                    # Use pre-fetched item (no need to query again)
                    
                    # Determine warranty expiry if warranty period is provided
                    warranty_expiry = None
                    warranty_days = getattr(item_data, 'warranty_period_days', None) or item.warranty_period_days
                    if warranty_days and warranty_days > 0:
                        warranty_expiry = (datetime.now(timezone.utc) + timedelta(days=warranty_days)).replace(tzinfo=None)
                    
                    # Calculate proper purchase price according to business rule
                    # For serialized items, calculate per-unit cost after discount and tax
                    discount_amount = getattr(item_data, 'discount_amount', Decimal("0")) or Decimal("0")
                    tax_rate = getattr(item_data, 'tax_rate', Decimal("0")) or Decimal("0")
                    
                    # For serialized items: total cost divided by quantity
                    cost_breakdown = self._calculate_total_item_cost(
                        unit_cost=unit_cost,
                        quantity=quantity,
                        discount_amount=discount_amount,
                        tax_rate=tax_rate
                    )
                    per_unit_purchase_price = cost_breakdown["cost_per_unit"]
                    
                    # Validate serial number uniqueness before creating
                    if serial_no:
                        if await self.inventory_unit_repo.serial_number_exists(serial_no):
                            error_msg = f"Serial number '{serial_no}' already exists in the system"
                            print(f"[INVENTORY-UPDATE] ✖ {error_msg}")
                            raise ValueError(error_msg)
                    
                    # Create inventory unit with all required fields (Requirement 4.1-4.12)
                    inventory_unit = await self.inventory_unit_repo.create({
                        "item_id": str(item_id),                                    # 4.1 - id of item from ItemMaster
                        "location_id": str(location_id),                            # 4.2 - id of location
                        "sku": sku,                                                 # 4.3 - generated SKU
                        "serial_number": serial_no,                                 # 4.4 - serial number from purchase
                        "status": "AVAILABLE",                                      # 4.5 - AVAILABLE status
                        "condition": self._map_condition_code_to_enum(condition),   # 4.6 - Map condition code to enum
                        "purchase_date": datetime.now(timezone.utc).replace(tzinfo=None), # 4.7 - purchase date
                        "purchase_price": per_unit_purchase_price,                  # 4.8 - calculated per-unit cost after discount and tax
                        "warranty_expiry": warranty_expiry,                         # 4.9 - calculated from warranty_period_days
                        "last_maintenance_date": None,                              # 4.10 - null
                        "next_maintenance_date": None,                              # 4.11 - null
                        "notes": getattr(item_data, 'notes', None),                # 4.12 - from purchase item
                        
                        # For serialized items, batch_code must be None (constraint: check_serial_or_batch)
                        "batch_code": None,  # Must be None for serialized items
                        "sale_price": getattr(item_data, 'sale_price', None) or item.sale_price,
                        "rental_rate_per_period": getattr(item_data, 'rental_rate_per_period', None) or item.rental_rate_per_period,
                        "rental_period": getattr(item_data, 'rental_period', None) or item.rental_period,
                        "security_deposit": getattr(item_data, 'security_deposit', None) or item.security_deposit,
                        "model_number": getattr(item_data, 'model_number', None) or item.model_number,
                        "warranty_period_days": warranty_days,
                        "quantity": Decimal("1.00"),  # Each unit represents quantity of 1
                        "remarks": getattr(item_data, 'remarks', None),
                        
                        "created_by": "system",
                        "updated_by": "system"
                    })
                    
                    print(f"[INVENTORY-UPDATE] ✔ Created inventory unit: {sku} with serial: {serial_no}")
                    
                except ValueError as ve:
                    # Handle specific validation errors from repository
                    print(f"[INVENTORY-UPDATE] ✖ Validation error for unit {i+1}: {ve}")
                    raise ValidationError(str(ve))
                except Exception as e:
                    print(f"[INVENTORY-UPDATE] ✖ Failed to create inventory unit {i+1}: {e}")
                    print(f"[INVENTORY-UPDATE] Details - SKU: {sku}, Serial: {serial_no}")
                    print(f"[INVENTORY-UPDATE] Error type: {type(e).__name__}")
                    print(f"[INVENTORY-UPDATE] Full error: {str(e)}")
                    raise
        else:
            # NON-SERIALIZED ITEMS: Create single batch unit
            print(f"[INVENTORY-UPDATE] Creating batch inventory unit for {quantity} non-serialized items")
            
            try:
                # Generate unique SKU and batch ID
                sku = await self.inventory_unit_repo.generate_sku(item_id)
                
                # Auto-generate batch ID if not provided
                batch_code = getattr(item_data, 'batch_code', None)
                if not batch_code:
                    batch_code = await self.inventory_unit_repo.generate_batch_id(item_id, transaction_id)
                    print(f"[INVENTORY-UPDATE] Generated batch ID: {batch_code}")
                else:
                    # Validate batch code uniqueness if provided
                    if await self.inventory_unit_repo.batch_code_exists(batch_code):
                        print(f"[INVENTORY-UPDATE] Batch code '{batch_code}' already exists, generating new one")
                        batch_code = await self.inventory_unit_repo.generate_batch_id(item_id, transaction_id)
                        print(f"[INVENTORY-UPDATE] New batch ID generated: {batch_code}")
                
                # Use pre-fetched item (no need to query again)
                
                # Determine warranty expiry if warranty period is provided
                warranty_expiry = None
                warranty_days = getattr(item_data, 'warranty_period_days', None) or item.warranty_period_days
                if warranty_days and warranty_days > 0:
                    warranty_expiry = (datetime.now(timezone.utc) + timedelta(days=warranty_days)).replace(tzinfo=None)
                
                # Calculate proper purchase price according to business rule
                # For batch items, total cost for the entire batch
                discount_amount = getattr(item_data, 'discount_amount', Decimal("0")) or Decimal("0")
                tax_rate = getattr(item_data, 'tax_rate', Decimal("0")) or Decimal("0")
                
                cost_breakdown = self._calculate_total_item_cost(
                    unit_cost=unit_cost,
                    quantity=quantity,
                    discount_amount=discount_amount,
                    tax_rate=tax_rate
                )
                total_batch_cost = cost_breakdown["total_cost"]
                
                # Create single inventory unit representing the entire batch
                inventory_unit = await self.inventory_unit_repo.create({
                    "item_id": str(item_id),
                    "location_id": str(location_id),
                    "sku": sku,
                    "serial_number": None,  # No serial number for non-serialized items
                    "batch_code": batch_code,  # Auto-generated batch ID
                    "quantity": quantity,  # Full quantity in this batch
                    "status": "AVAILABLE",
                    "condition": self._map_condition_code_to_enum(condition),
                    "purchase_date": datetime.now(timezone.utc).replace(tzinfo=None),
                    "purchase_price": total_batch_cost,  # Total cost for the entire batch after discount and tax
                    "warranty_expiry": warranty_expiry,
                    "last_maintenance_date": None,
                    "next_maintenance_date": None,
                    "notes": getattr(item_data, 'notes', None),
                    
                    # Pricing fields
                    "sale_price": getattr(item_data, 'sale_price', None) or item.sale_price,
                    "rental_rate_per_period": getattr(item_data, 'rental_rate_per_period', None) or item.rental_rate_per_period,
                    "rental_period": getattr(item_data, 'rental_period', None) or item.rental_period,
                    "security_deposit": getattr(item_data, 'security_deposit', None) or item.security_deposit,
                    "model_number": getattr(item_data, 'model_number', None) or item.model_number,
                    "warranty_period_days": warranty_days,
                    "remarks": getattr(item_data, 'remarks', None),
                    
                    "created_by": "system",
                    "updated_by": "system"
                })
                
                print(f"[INVENTORY-UPDATE] ✔ Created batch inventory unit: {sku} with batch ID: {batch_code} for quantity: {quantity}")
                
            except ValueError as ve:
                # Handle specific validation errors from repository
                print(f"[INVENTORY-UPDATE] ✖ Validation error for batch unit: {ve}")
                raise ValidationError(str(ve))
            except Exception as e:
                print(f"[INVENTORY-UPDATE] ✖ Failed to create batch inventory unit: {e}")
                print(f"[INVENTORY-UPDATE] Details - SKU: {sku}, Batch: {batch_code}, Quantity: {quantity}")
                print(f"[INVENTORY-UPDATE] Error type: {type(e).__name__}")
                print(f"[INVENTORY-UPDATE] Full error: {str(e)}")
                raise
        
        print(f"[INVENTORY-UPDATE] ✔ Inventory update completed for item {item_id}")

    async def _get_quantity_before_transaction(self, item_id: UUID, original_quantity_on_hand: Decimal) -> Decimal:
        """
        Determine the quantity before this transaction for StockMovement.quantity_before.
        
        Logic:
        1. If there are previous StockMovements, use the latest quantity_after
        2. If no previous StockMovements but original stock exists, use original quantity_on_hand
        3. If neither exists, use 0
        
        This provides accurate tracking of stock changes over time.
        """
        from sqlalchemy import select, desc
        
        # First, check for previous StockMovements
        stmt = (
            select(StockMovement.quantity_after)
            .where(StockMovement.item_id == str(item_id))
            .order_by(desc(StockMovement.created_at))
            .limit(1)
        )
        
        result = await self.session.execute(stmt)
        latest_quantity_after = result.scalar_one_or_none()
        
        if latest_quantity_after is not None:
            print(f"[INVENTORY-UPDATE] Found latest stock movement quantity_after: {latest_quantity_after}")
            return Decimal(str(latest_quantity_after))
        elif original_quantity_on_hand > 0:
            # No previous StockMovements, but original stock exists - use original quantity_on_hand
            print(f"[INVENTORY-UPDATE] No previous stock movement found, using original StockLevel quantity_on_hand: {original_quantity_on_hand}")
            return original_quantity_on_hand
        else:
            print(f"[INVENTORY-UPDATE] No previous stock movement or original stock found, using quantity_before = 0")
            return Decimal("0")

    async def _get_latest_stock_movement_quantity_after(self, item_id: UUID) -> Decimal:
        """
        Find the latest StockMovement entry for the given item_id and return its quantity_after.
        If no previous entry exists, return 0.
        
        This implements requirement 3.6: "find the latest row created for the id from ItemMaster 
        in StockMovement, if exist, use quantity_after from that row to populate this field. 
        if previous entry not existed put 0."
        """
        from sqlalchemy import select, desc
        
        stmt = (
            select(StockMovement.quantity_after)
            .where(StockMovement.item_id == str(item_id))
            .order_by(desc(StockMovement.created_at))
            .limit(1)
        )
        
        result = await self.session.execute(stmt)
        latest_quantity_after = result.scalar_one_or_none()
        
        if latest_quantity_after is not None:
            print(f"[INVENTORY-UPDATE] Found latest stock movement quantity_after: {latest_quantity_after}")
            return Decimal(str(latest_quantity_after))
        else:
            print(f"[INVENTORY-UPDATE] No previous stock movement found, using quantity_before = 0")
            return Decimal("0")