"""
Purchase Service - Business logic for purchase transactions.
Modernized version with comprehensive validation and error handling.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
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
            
            # Create transaction header
            transaction = TransactionHeader(
                transaction_type=TransactionType.PURCHASE,
                transaction_number=transaction_number,
                status=TransactionStatus.PENDING,
                transaction_date=purchase_data.purchase_date or datetime.now(timezone.utc),
                due_date=purchase_data.due_date,
                supplier_id=purchase_data.supplier_id,
                location_id=purchase_data.location_id,
                currency=purchase_data.currency,
                subtotal=totals["subtotal"],
                discount_amount=totals["discount_amount"],
                tax_amount=totals["tax_amount"],
                shipping_amount=purchase_data.shipping_amount,
                total_amount=totals["total_amount"] + purchase_data.shipping_amount,
                paid_amount=Decimal("0.00"),
                payment_status=PaymentStatus.PENDING,
                payment_method=purchase_data.payment_method,
                reference_number=purchase_data.reference_number,
                notes=purchase_data.notes,
                delivery_required=purchase_data.delivery_required,
                delivery_address=purchase_data.delivery_address,
                delivery_date=purchase_data.delivery_date,
                created_by=created_by,
                updated_by=created_by
            )
            
            # Add to session
            self.session.add(transaction)
            await self.session.flush()
            
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
            
            # Update inventory (would be implemented when inventory module is ready)
            # await self._update_inventory_for_purchase(transaction.id, lines)
            
            # Mark as completed if auto-complete is enabled
            if purchase_data.get("auto_complete", False):
                transaction.status = TransactionStatus.COMPLETED
                await self.session.flush()
                
                await self.event_repo.create_transaction_event(
                    transaction_id=transaction.id,
                    event_type="PURCHASE_COMPLETED",
                    description="Purchase transaction auto-completed",
                    user_id=created_by
                )
            
            # Commit the transaction
            await self.session.commit()
            
            # Reload with relationships
            transaction = await self.transaction_repo.get_by_id(
                transaction.id,
                include_lines=True
            )
            
            # Return response
            return PurchaseResponse.from_transaction(transaction)
            
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
        location = await self.location_repo.get_by_id(purchase_data.location_id)
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
        
        # Validate items
        item_ids = {item.item_id for item in purchase_data.items}
        items = await self.item_repo.get_by_ids(list(item_ids))
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
        
        # Get item details
        item_ids = {item.item_id for item in items}
        item_entities = await self.item_repo.get_by_ids(list(item_ids))
        item_map = {item.id: item for item in item_entities}
        
        for idx, item_data in enumerate(items, 1):
            item = item_map.get(item_data.item_id)
            if not item:
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
            
            # Create line
            line = TransactionLine(
                transaction_header_id=transaction_id,
                line_number=idx,
                line_type=LineItemType.PRODUCT,
                item_id=item_data.item_id,
                sku=item.sku,
                description=item.item_name,
                category=item.category.category_name if item.category else None,
                quantity=item_data.quantity,
                unit_of_measure=item.unit_of_measurement.abbreviation if item.unit_of_measurement else None,
                unit_price=item_data.unit_price,
                total_price=line_subtotal,
                discount_percent=item_data.discount_percent or Decimal("0.00"),
                discount_amount=discount,
                tax_rate=item_data.tax_rate or Decimal("0.00"),
                tax_amount=tax,
                line_total=line_total,
                location_id=item_data.location_id,
                warehouse_location=item_data.warehouse_location,
                status="PENDING",
                fulfillment_status="PENDING",
                created_by=created_by,
                updated_by=created_by
            )
            
            self.session.add(line)
            lines.append(line)
        
        await self.session.flush()
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