"""
Purchase Service - Business logic for purchase transactions.
Modernized version with comprehensive validation and error handling.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.models.transaction import (
    TransactionHeader, TransactionLine, TransactionEvent,
    TransactionType, TransactionStatus, PaymentStatus, LineItemType
)
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.location import Location
from app.models.item import Item

from app.crud.transaction import (
    TransactionHeaderRepository,
    TransactionLineRepository,
    TransactionEventRepository,
)
from app.crud.supplier import SupplierRepository
from app.crud.location import LocationCRUD
from app.crud.item import ItemRepository

from app.schemas.transaction.purchase import (
    PurchaseCreate, PurchaseResponse, PurchaseItemCreate,
    PurchaseValidationError
)

from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.services.inventory.inventory_service import inventory_service

logger = logging.getLogger(__name__)


class PurchaseService:
    """Service for handling purchase transaction operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.transaction_repo = TransactionHeaderRepository(session)
        self.line_repo = TransactionLineRepository(session)
        self.event_repo = TransactionEventRepository(session)
        self.supplier_repo = SupplierRepository(session)
        self.location_repo = LocationCRUD(session)
        self.item_repo = ItemRepository(session)
    
    async def create_purchase(
        self,
        purchase_data: PurchaseCreate,
        created_by: Optional[str] = None
    ) -> PurchaseResponse:
        """
        Create a new purchase transaction with comprehensive validation.
        
        Args:
            purchase_data: Purchase creation data
            created_by: User creating the purchase
            
        Returns:
            Created purchase transaction
            
        Raises:
            ValidationError: If validation fails
            NotFoundError: If referenced entities not found
        """
        try:
            # Start timing for performance tracking
            start_time = datetime.now(timezone.utc)
            
            # Pre-validation phase
            validation_errors = await self._validate_purchase_data(purchase_data)
            if validation_errors:
                raise ValidationError(
                    "Purchase validation failed",
                    details={"errors": validation_errors}
                )
            
            # Generate transaction number
            transaction_number = await self._generate_transaction_number()
            
            # Calculate totals
            totals = self._calculate_purchase_totals(purchase_data.items)
            
            # Generate UUID and timestamps manually to avoid server_default issues
            transaction_id = uuid.uuid4()
            now = datetime.now(timezone.utc)
            
            # Use raw SQL to insert transaction header to avoid ORM issues
            from sqlalchemy import text
            
            insert_sql = text("""
                INSERT INTO transaction_headers (
                    id, transaction_type, transaction_number, status,
                    transaction_date, due_date, supplier_id, location_id,
                    currency, subtotal, discount_amount, tax_amount,
                    shipping_amount, total_amount, paid_amount, deposit_paid,
                    customer_advance_balance, delivery_required, pickup_required,
                    extension_count, total_extension_charges,
                    payment_status, payment_method, reference_number,
                    notes, delivery_address, delivery_date,
                    is_active, created_at, updated_at, created_by, updated_by
                ) VALUES (
                    :id, :transaction_type, :transaction_number, :status,
                    :transaction_date, :due_date, :supplier_id, :location_id,
                    :currency, :subtotal, :discount_amount, :tax_amount,
                    :shipping_amount, :total_amount, :paid_amount, :deposit_paid,
                    :customer_advance_balance, :delivery_required, :pickup_required,
                    :extension_count, :total_extension_charges,
                    :payment_status, :payment_method, :reference_number,
                    :notes, :delivery_address, :delivery_date,
                    :is_active, :created_at, :updated_at, :created_by, :updated_by
                )
            """)
            
            await self.session.execute(
                insert_sql,
                {
                    "id": transaction_id,
                    "transaction_type": TransactionType.PURCHASE.value,
                    "transaction_number": transaction_number,
                    "status": TransactionStatus.COMPLETED.value if purchase_data.auto_complete else TransactionStatus.PENDING.value,
                    "transaction_date": purchase_data.purchase_date or now,
                    "due_date": purchase_data.due_date,
                    "supplier_id": purchase_data.supplier_id,
                    "location_id": purchase_data.location_id,
                    "currency": purchase_data.currency,
                    "subtotal": totals["subtotal"],
                    "discount_amount": totals["discount_amount"],
                    "tax_amount": totals["tax_amount"],
                    "shipping_amount": purchase_data.shipping_amount,
                    "total_amount": totals["total_amount"] + purchase_data.shipping_amount,
                    "paid_amount": Decimal("0.00"),
                    "deposit_paid": False,  # Boolean field, not Decimal
                    "customer_advance_balance": Decimal("0.00"),  # Required NOT NULL field
                    "delivery_required": purchase_data.delivery_required or False,  # Required NOT NULL field
                    "pickup_required": False,  # Required NOT NULL field
                    "extension_count": 0,  # Required NOT NULL field
                    "total_extension_charges": Decimal("0.00"),  # Required NOT NULL field
                    "payment_status": PaymentStatus.PENDING.value,
                    "payment_method": purchase_data.payment_method,
                    "reference_number": purchase_data.reference_number,
                    "notes": purchase_data.notes,
                    "delivery_address": purchase_data.delivery_address,
                    "delivery_date": purchase_data.delivery_date,
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": created_by,
                    "updated_by": created_by
                }
            )
            
            # Create a transaction object for return (without adding to session)
            transaction = TransactionHeader()
            transaction.id = transaction_id
            transaction.transaction_number = transaction_number
            transaction.status = TransactionStatus.COMPLETED if purchase_data.auto_complete else TransactionStatus.PENDING
            transaction.total_amount = totals["total_amount"] + purchase_data.shipping_amount
            
            # Create transaction lines
            lines = await self._create_purchase_lines(
                transaction.id,
                purchase_data.items,
                created_by
            )
            
            # Create initial event
            await self.event_repo.create_transaction_event(
                transaction_id=transaction.id,
                event_type="PURCHASE_CREATED",
                description=f"Purchase transaction {transaction_number} created",
                user_id=created_by,
                operation="create_purchase",
                duration_ms=int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            )
            
            # Update inventory - create inventory units for completed purchase
            if purchase_data.auto_complete:
                await self._update_inventory_for_purchase(
                    transaction_id=transaction.id,
                    purchase_data=purchase_data,
                    lines=lines,
                    created_by=created_by
                )
            
            # Create completion event if auto-complete is enabled
            if purchase_data.auto_complete:
                await self.event_repo.create_transaction_event(
                    transaction_id=transaction_id,
                    event_type="PURCHASE_COMPLETED",
                    description="Purchase transaction auto-completed with inventory updates",
                    user_id=created_by
                )
            
            # Commit the transaction
            await self.session.commit()
            
            # Build response manually since we used raw SQL
            total_amount_final = totals["total_amount"] + purchase_data.shipping_amount
            return PurchaseResponse(
                id=transaction_id,
                transaction_number=transaction_number,
                status=TransactionStatus.COMPLETED.value if purchase_data.auto_complete else TransactionStatus.PENDING.value,
                transaction_date=purchase_data.purchase_date or now,
                supplier_id=purchase_data.supplier_id,
                location_id=purchase_data.location_id,
                currency=purchase_data.currency,
                subtotal=totals["subtotal"],
                discount_amount=totals["discount_amount"],
                tax_amount=totals["tax_amount"],
                shipping_amount=purchase_data.shipping_amount,
                total_amount=total_amount_final,
                paid_amount=Decimal("0.00"),
                balance_due=total_amount_final,  # Required field: total - paid
                payment_status=PaymentStatus.PENDING.value,
                payment_method=purchase_data.payment_method,
                delivery_required=purchase_data.delivery_required or False,  # Required field
                lines=[],  # Lines could be added if needed
                created_at=now,
                updated_at=now
            )
            
        except IntegrityError as e:
            await self.session.rollback()
            logger.error(f"Database integrity error: {e}")
            raise ConflictError("Purchase creation failed due to data conflict")
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Purchase creation failed: {e}")
            raise
    
    async def get_purchase(
        self,
        purchase_id: UUID,
        include_details: bool = True
    ) -> PurchaseResponse:
        """Get purchase transaction by ID."""
        transaction = await self.transaction_repo.get_by_id(
            purchase_id,
            include_lines=include_details,
            include_events=include_details
        )
        
        if not transaction:
            raise NotFoundError(f"Purchase transaction {purchase_id} not found")
        
        if transaction.transaction_type != TransactionType.PURCHASE:
            raise ValidationError(f"Transaction {purchase_id} is not a purchase")
        
        return PurchaseResponse.from_transaction(transaction, include_details)
    
    async def list_purchases(
        self,
        supplier_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None,
        status: Optional[TransactionStatus] = None,
        payment_status: Optional[PaymentStatus] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[PurchaseResponse]:
        """List purchase transactions with filters."""
        transactions = await self.transaction_repo.list_transactions(
            transaction_type=TransactionType.PURCHASE,
            supplier_id=supplier_id,
            location_id=location_id,
            status=status,
            payment_status=payment_status,
            date_from=date_from,
            date_to=date_to,
            skip=skip,
            limit=limit
        )
        
        return [
            PurchaseResponse.from_transaction(tx)
            for tx in transactions
        ]
    
    async def update_purchase_status(
        self,
        purchase_id: UUID,
        status: TransactionStatus,
        updated_by: Optional[str] = None,
        notes: Optional[str] = None
    ) -> PurchaseResponse:
        """Update purchase transaction status."""
        transaction = await self.transaction_repo.get_by_id(purchase_id)
        
        if not transaction:
            raise NotFoundError(f"Purchase transaction {purchase_id} not found")
        
        if transaction.transaction_type != TransactionType.PURCHASE:
            raise ValidationError(f"Transaction {purchase_id} is not a purchase")
        
        # Validate status transition
        if not self._is_valid_status_transition(transaction.status, status):
            raise ValidationError(
                f"Invalid status transition from {transaction.status} to {status}"
            )
        
        # Update status
        old_status = transaction.status
        transaction.status = status
        transaction.updated_by = updated_by
        
        if notes:
            transaction.notes = (transaction.notes or "") + f"\n{notes}"
        
        await self.session.flush()
        
        # Create status change event
        await self.event_repo.create_transaction_event(
            transaction_id=transaction.id,
            event_type="STATUS_CHANGED",
            description=f"Status changed from {old_status} to {status}",
            user_id=updated_by,
            event_data={"old_status": old_status.value, "new_status": status.value}
        )
        
        await self.session.commit()
        
        return PurchaseResponse.from_transaction(transaction)
    
    async def add_payment(
        self,
        purchase_id: UUID,
        amount: Decimal,
        payment_method: str,
        payment_reference: Optional[str] = None,
        updated_by: Optional[str] = None
    ) -> PurchaseResponse:
        """Add payment to purchase transaction."""
        transaction = await self.transaction_repo.update_payment_status(
            transaction_id=purchase_id,
            amount_paid=amount,
            payment_method=payment_method,
            payment_reference=payment_reference,
            updated_by=updated_by
        )
        
        if not transaction:
            raise NotFoundError(f"Purchase transaction {purchase_id} not found")
        
        # Create payment event
        await self.event_repo.create_payment_event(
            transaction_id=transaction.id,
            event_type="PAYMENT_RECEIVED",
            amount=str(amount),
            payment_method=payment_method,
            payment_status=transaction.payment_status.value,
            reference=payment_reference,
            user_id=updated_by
        )
        
        await self.session.commit()
        
        return PurchaseResponse.from_transaction(transaction)
    
    # Private helper methods
    
    async def _validate_purchase_data(
        self,
        purchase_data: PurchaseCreate
    ) -> List[PurchaseValidationError]:
        """Validate purchase data and return list of errors."""
        errors = []
        
        # Validate supplier
        supplier = await self.supplier_repo.get_by_id(purchase_data.supplier_id)
        if not supplier:
            errors.append(PurchaseValidationError(
                field="supplier_id",
                message="Supplier not found",
                code="SUPPLIER_NOT_FOUND"
            ))
        elif supplier.status != "ACTIVE":
            errors.append(PurchaseValidationError(
                field="supplier_id",
                message="Supplier is not active",
                code="SUPPLIER_INACTIVE"
            ))
        
        # Validate location
        location = await self.location_repo.get(purchase_data.location_id)
        if not location:
            errors.append(PurchaseValidationError(
                field="location_id",
                message="Location not found",
                code="LOCATION_NOT_FOUND"
            ))
        elif not location.is_active:
            errors.append(PurchaseValidationError(
                field="location_id",
                message="Location is not active",
                code="LOCATION_INACTIVE"
            ))
        
        # Validate items (load with relations to avoid lazy loading issues)
        item_ids = {item.item_id for item in purchase_data.items}
        items = await self.item_repo.get_by_ids(list(item_ids), include_relations=True)
        item_map = {item.id: item for item in items}
        
        for idx, item_data in enumerate(purchase_data.items):
            if item_data.item_id not in item_map:
                errors.append(PurchaseValidationError(
                    field=f"items[{idx}].item_id",
                    message="Item not found",
                    code="ITEM_NOT_FOUND",
                    details={"item_id": str(item_data.item_id)}
                ))
                continue
            
            item = item_map[item_data.item_id]
            
            # Validate serial numbers if provided
            if item_data.serial_numbers:
                if not item.requires_serial_number:
                    errors.append(PurchaseValidationError(
                        field=f"items[{idx}].serial_numbers",
                        message="Item does not require serial numbers",
                        code="SERIAL_NOT_REQUIRED",
                        details={"item_id": str(item.id)}
                    ))
                elif len(item_data.serial_numbers) != int(item_data.quantity):
                    errors.append(PurchaseValidationError(
                        field=f"items[{idx}].serial_numbers",
                        message="Number of serial numbers must match quantity",
                        code="SERIAL_COUNT_MISMATCH",
                        details={
                            "expected": int(item_data.quantity),
                            "provided": len(item_data.serial_numbers)
                        }
                    ))
                
                # Check for duplicate serial numbers
                # (Would check against database in production)
            
            # Validate batch code if provided
            if item_data.batch_code and item_data.serial_numbers:
                errors.append(PurchaseValidationError(
                    field=f"items[{idx}]",
                    message="Cannot specify both batch code and serial numbers",
                    code="BATCH_SERIAL_CONFLICT"
                ))
        
        return errors
    
    async def _generate_transaction_number(self) -> str:
        """Generate unique transaction number."""
        # Get current date components
        now = datetime.now(timezone.utc)
        prefix = f"PUR-{now.strftime('%Y%m%d')}"
        
        # Get count of transactions today
        start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        query = select(func.count(TransactionHeader.id)).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.PURCHASE,
                TransactionHeader.transaction_date >= start_of_day
            )
        )
        result = await self.session.execute(query)
        count = result.scalar() or 0
        
        # Generate number
        return f"{prefix}-{count + 1:04d}"
    
    def _calculate_purchase_totals(
        self,
        items: List[PurchaseItemCreate]
    ) -> Dict[str, Decimal]:
        """Calculate purchase totals from items."""
        subtotal = Decimal("0.00")
        tax_amount = Decimal("0.00")
        discount_amount = Decimal("0.00")
        
        for item in items:
            line_subtotal = item.quantity * item.unit_price
            
            # Calculate discount
            if item.discount_percent:
                item_discount = line_subtotal * item.discount_percent / 100
            else:
                item_discount = item.discount_amount or Decimal("0.00")
            
            # Calculate tax on discounted amount
            taxable = line_subtotal - item_discount
            item_tax = taxable * (item.tax_rate or Decimal("0.00")) / 100
            
            subtotal += line_subtotal
            discount_amount += item_discount
            tax_amount += item_tax
        
        total_amount = subtotal - discount_amount + tax_amount
        
        return {
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "tax_amount": tax_amount,
            "total_amount": total_amount
        }
    
    async def _create_purchase_lines(
        self,
        transaction_id: UUID,
        items: List[PurchaseItemCreate],
        created_by: Optional[str] = None
    ) -> List[TransactionLine]:
        """Create transaction lines for purchase."""
        lines = []
        
        # Get item details with related data
        item_ids = {item.item_id for item in items}
        item_entities = await self.item_repo.get_by_ids(list(item_ids), include_relations=True)
        
        # Pre-fetch all relationship data to avoid lazy loading issues
        # Force evaluation of relationships before using them
        item_data_map = {}
        for item in item_entities:
            item_info = {
                'id': item.id,
                'sku': item.sku,
                'item_name': item.item_name,
                'category_name': None,
                'unit_code': None
            }
            
            # Access relationships in async context
            if item.category:
                try:
                    item_info['category_name'] = item.category.name
                except:
                    pass
            
            if item.unit_of_measurement:
                try:
                    item_info['unit_code'] = item.unit_of_measurement.code
                except:
                    pass
            
            item_data_map[item.id] = item_info
        
        for idx, item_data in enumerate(items, 1):
            item_info = item_data_map.get(item_data.item_id)
            if not item_info:
                continue
            
            # Calculate line totals
            line_subtotal = item_data.quantity * item_data.unit_price
            
            if item_data.discount_percent:
                discount = line_subtotal * item_data.discount_percent / 100
            else:
                discount = item_data.discount_amount or Decimal("0.00")
            
            taxable = line_subtotal - discount
            tax = taxable * (item_data.tax_rate or Decimal("0.00")) / 100
            line_total = taxable + tax
            
            # Generate UUID and timestamps for line to avoid server_default issues
            line_id = uuid.uuid4()
            now = datetime.now(timezone.utc)
            
            # Use raw SQL to insert transaction line
            from sqlalchemy import text
            
            insert_line_sql = text("""
                INSERT INTO transaction_lines (
                    id, transaction_header_id, line_number, line_type,
                    item_id, sku, description, category, quantity,
                    unit_of_measure, unit_price, total_price,
                    discount_percent, discount_amount, tax_rate, tax_amount,
                    line_total, location_id, warehouse_location,
                    status, fulfillment_status, returned_quantity,
                    is_active, created_at, updated_at, created_by, updated_by
                ) VALUES (
                    :id, :transaction_header_id, :line_number, :line_type,
                    :item_id, :sku, :description, :category, :quantity,
                    :unit_of_measure, :unit_price, :total_price,
                    :discount_percent, :discount_amount, :tax_rate, :tax_amount,
                    :line_total, :location_id, :warehouse_location,
                    :status, :fulfillment_status, :returned_quantity,
                    :is_active, :created_at, :updated_at, :created_by, :updated_by
                )
            """)
            
            await self.session.execute(
                insert_line_sql,
                {
                    "id": line_id,
                    "transaction_header_id": transaction_id,
                    "line_number": idx,
                    "line_type": LineItemType.PRODUCT.value,
                    "item_id": item_data.item_id,
                    "sku": item_info['sku'],
                    "description": item_info['item_name'],
                    "category": item_info['category_name'],
                    "quantity": item_data.quantity,
                    "unit_of_measure": item_info['unit_code'],
                    "unit_price": item_data.unit_price,
                    "total_price": line_subtotal,
                    "discount_percent": item_data.discount_percent or Decimal("0.00"),
                    "discount_amount": discount,
                    "tax_rate": item_data.tax_rate or Decimal("0.00"),
                    "tax_amount": tax,
                    "line_total": line_total,
                    "location_id": item_data.location_id,
                    "warehouse_location": item_data.warehouse_location,
                    "status": "PENDING",
                    "fulfillment_status": "PENDING",
                    "returned_quantity": Decimal("0.00"),  # Required NOT NULL field
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": created_by,
                    "updated_by": created_by
                }
            )
            
            # Create line object for return (without adding to session)
            line = TransactionLine()
            line.id = line_id
            line.item_id = item_data.item_id
            line.quantity = item_data.quantity
            line.unit_price = item_data.unit_price
            line.location_id = item_data.location_id
            lines.append(line)
        
        # No need to flush since we used raw SQL
        return lines
    
    def _is_valid_status_transition(
        self,
        current: TransactionStatus,
        new: TransactionStatus
    ) -> bool:
        """Check if status transition is valid."""
        valid_transitions = {
            TransactionStatus.PENDING: [
                TransactionStatus.PROCESSING,
                TransactionStatus.COMPLETED,
                TransactionStatus.CANCELLED
            ],
            TransactionStatus.PROCESSING: [
                TransactionStatus.COMPLETED,
                TransactionStatus.ON_HOLD,
                TransactionStatus.CANCELLED
            ],
            TransactionStatus.ON_HOLD: [
                TransactionStatus.PROCESSING,
                TransactionStatus.CANCELLED
            ],
            TransactionStatus.COMPLETED: [],  # Cannot transition from completed
            TransactionStatus.CANCELLED: [],  # Cannot transition from cancelled
        }
        
        return new in valid_transitions.get(current, [])
    
    async def _update_inventory_for_purchase(
        self,
        transaction_id: UUID,
        purchase_data,
        lines: List[TransactionLine],
        created_by: UUID
    ) -> None:
        """
        Create inventory units and update stock levels for completed purchases.
        
        Args:
            transaction_id: Purchase transaction ID
            purchase_data: Purchase creation data
            lines: Transaction lines with item details
            created_by: User who created the purchase
        """
        try:
            logger.info(f"Updating inventory for purchase transaction {transaction_id}")
            logger.info(f"Lines to process: {len(lines) if lines else 0}")
            
            # Process each line item
            for line in lines:
                if line.item_id and line.quantity > 0:
                    # Get item details
                    item_query = select(Item).where(Item.id == line.item_id)
                    item_result = await self.session.execute(item_query)
                    item = item_result.scalar_one_or_none()
                    
                    if not item:
                        logger.warning(f"Item {line.item_id} not found, skipping inventory creation")
                        continue
                    
                    # Determine if items should be tracked as units
                    # For now, create units for all purchased items
                    # TODO: This could be configurable per item or category
                    
                    quantity_to_create = int(line.quantity)  # Convert to int for unit creation
                    
                    # Generate serial numbers or use batch tracking
                    serial_numbers = None
                    batch_code = None
                    
                    # Check if item should have serial numbers (optional enhancement)
                    # For now, use batch tracking for all items
                    if quantity_to_create == 1:
                        # Single item - could use serial number if configured
                        serial_numbers = []  # Will be auto-generated if needed
                    else:
                        # Multiple items - use batch code
                        batch_code = f"PO-{getattr(purchase_data, 'purchase_order_number', None) or purchase_data.reference_number or transaction_id.hex[:8]}-{datetime.now().strftime('%Y%m%d')}"
                    
                    # Create inventory units and update stock levels
                    units, stock, movement = await inventory_service.create_inventory_units(
                        self.session,
                        item_id=line.item_id,
                        location_id=purchase_data.location_id,
                        quantity=quantity_to_create,
                        unit_cost=line.unit_price,
                        serial_numbers=serial_numbers,
                        batch_code=batch_code,
                        supplier_id=purchase_data.supplier_id,
                        purchase_order_number=getattr(purchase_data, 'purchase_order_number', None) or purchase_data.reference_number,
                        created_by=created_by
                    )
                    
                    # Update movement with transaction linkage
                    if movement:
                        movement.transaction_header_id = transaction_id
                        movement.transaction_line_id = line.id
                        movement.reference_number = getattr(purchase_data, 'purchase_order_number', None) or purchase_data.reference_number
                        movement.movement_type = "STOCK_MOVEMENT_PURCHASE"
                    
                    logger.info(
                        f"Created {len(units)} inventory units for item {line.item_id}, "
                        f"updated stock level {stock.id}"
                    )
            
            # Flush changes to ensure they're persisted
            await self.session.flush()
            
            logger.info(f"Successfully updated inventory for purchase {transaction_id}")
            
        except Exception as e:
            logger.error(f"Failed to update inventory for purchase {transaction_id}: {str(e)}")
            # Don't raise the exception - inventory creation failure shouldn't fail the purchase
            # But log it for investigation
            logger.exception("Detailed inventory update error:")
            # Re-raise for debugging
            raise
    
    async def complete_purchase_and_update_inventory(
        self,
        purchase_id: UUID,
        completed_by: UUID
    ) -> bool:
        """
        Complete a pending purchase and update inventory.
        
        Args:
            purchase_id: Purchase transaction ID
            completed_by: User completing the purchase
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get the purchase transaction
            transaction_query = (
                select(TransactionHeader)
                .options(selectinload(TransactionHeader.transaction_lines))
                .where(TransactionHeader.id == purchase_id)
            )
            result = await self.session.execute(transaction_query)
            transaction = result.scalar_one_or_none()
            
            if not transaction:
                logger.error(f"Purchase transaction {purchase_id} not found")
                return False
            
            # Check if already completed
            if transaction.status == TransactionStatus.COMPLETED.value:
                logger.info(f"Purchase {purchase_id} already completed")
                return True
            
            # Check if can be completed
            if transaction.status not in [TransactionStatus.PENDING.value, TransactionStatus.PROCESSING.value]:
                logger.error(f"Purchase {purchase_id} cannot be completed from status {transaction.status}")
                return False
            
            # Create pseudo purchase data for inventory update
            class PseudoPurchaseData:
                def __init__(self, transaction):
                    self.supplier_id = transaction.supplier_id
                    self.location_id = transaction.location_id
                    self.purchase_order_number = transaction.reference_number
            
            purchase_data = PseudoPurchaseData(transaction)
            
            # Update inventory
            await self._update_inventory_for_purchase(
                transaction_id=purchase_id,
                purchase_data=purchase_data,
                lines=transaction.transaction_lines,
                created_by=completed_by
            )
            
            # Update transaction status
            transaction.status = TransactionStatus.COMPLETED.value
            transaction.updated_at = datetime.now(timezone.utc)
            transaction.updated_by = completed_by
            
            # Create completion event
            await self.event_repo.create_transaction_event(
                transaction_id=purchase_id,
                event_type="PURCHASE_COMPLETED",
                description="Purchase completed and inventory updated",
                user_id=completed_by
            )
            
            await self.session.commit()
            
            logger.info(f"Successfully completed purchase {purchase_id} and updated inventory")
            return True
            
        except Exception as e:
            logger.error(f"Failed to complete purchase {purchase_id}: {str(e)}")
            await self.session.rollback()
            return False