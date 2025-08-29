"""
Rental Service - Business logic for rental transactions with lifecycle management.
Handles rental creation, pickup, return, extension, and damage assessment.
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
import logging
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.models.transaction import (
    TransactionHeader, TransactionLine, TransactionEvent, TransactionInspection,
    TransactionType, TransactionStatus, PaymentStatus, PaymentMethod,
    LineItemType, RentalStatus, RentalPeriodUnit,
    InspectionStatus, ConditionRating, ItemDisposition
)
from app.models.transaction.rental_lifecycle import (
    RentalLifecycle, RentalReturnEvent, RentalItemInspection,
    ReturnEventType, InspectionCondition
)
from app.models.customer import Customer
from app.models.location import Location
from app.models.item import Item

from app.crud.transaction import (
    TransactionHeaderRepository,
    TransactionLineRepository,
    TransactionEventRepository,
)
from app.crud.customer import CustomerRepository
from app.crud.location import LocationCRUD
from app.crud.item import ItemRepository

from app.schemas.transaction.rental import (
    RentalCreate, RentalResponse, RentalItemCreate,
    RentalReturnRequest, RentalExtensionRequest,
    RentalValidationError, RentalPickupRequest,
    RentalDamageAssessment, RentalAvailabilityCheck
)

from app.core.errors import NotFoundError, ValidationError, ConflictError
from app.services.inventory.inventory_service import inventory_service

logger = logging.getLogger(__name__)


class RentalPricingStrategy(Enum):
    """Rental pricing calculation strategies."""
    STANDARD = "STANDARD"  # Fixed daily/weekly/monthly rates
    DYNAMIC = "DYNAMIC"    # Demand-based pricing
    SEASONAL = "SEASONAL"  # Season-adjusted pricing
    TIERED = "TIERED"     # Duration-based discounts


class RentalService:
    """Service for handling rental transaction operations with lifecycle management."""
    
    # Configuration constants
    GRACE_PERIOD_DAYS = 1  # Grace period before late fees
    LATE_FEE_MULTIPLIER = Decimal("1.5")  # 150% of daily rate for late fees
    SECURITY_DEPOSIT_PERCENTAGE = Decimal("0.20")  # 20% of item value
    MIN_RENTAL_HOURS = 4  # Minimum rental duration
    MAX_EXTENSION_COUNT = 3  # Maximum number of extensions allowed
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.transaction_repo = TransactionHeaderRepository(session)
        self.line_repo = TransactionLineRepository(session)
        self.event_repo = TransactionEventRepository(session)
        self.customer_repo = CustomerRepository(session)
        self.location_repo = LocationCRUD(session)
        self.item_repo = ItemRepository(session)
    
    async def create_rental(
        self,
        rental_data: RentalCreate,
        created_by: Optional[str] = None
    ) -> RentalResponse:
        """
        Create a new rental transaction with lifecycle initialization.
        
        Args:
            rental_data: Rental creation data
            created_by: User creating the rental
            
        Returns:
            Created rental transaction
            
        Raises:
            ValidationError: If validation fails
            NotFoundError: If referenced entities not found
            ConflictError: If items not available for rental
        """
        try:
            start_time = datetime.now(timezone.utc)
            
            # Validate rental data
            validation_errors = await self._validate_rental_data(rental_data)
            if validation_errors:
                raise ValidationError(
                    "Rental validation failed",
                    details={"errors": validation_errors}
                )
            
            # Check item availability
            availability_issues = await self._check_item_availability(
                rental_data.items,
                rental_data.rental_start_date,
                rental_data.rental_end_date
            )
            if availability_issues:
                raise ConflictError(
                    "Some items are not available for the requested period",
                    details={"unavailable_items": availability_issues}
                )
            
            # Generate transaction number
            transaction_number = await self._generate_transaction_number()
            
            # Calculate rental pricing
            pricing = await self._calculate_rental_pricing(
                rental_data.items,
                rental_data.rental_start_date,
                rental_data.rental_end_date,
                rental_data.pricing_strategy or RentalPricingStrategy.STANDARD
            )
            
            # Create transaction header
            transaction = TransactionHeader(
                transaction_type=TransactionType.RENTAL,
                transaction_number=transaction_number,
                status=TransactionStatus.PENDING,
                transaction_date=datetime.now(timezone.utc),
                customer_id=rental_data.customer_id,
                location_id=rental_data.location_id,
                currency=rental_data.currency,
                subtotal=pricing["subtotal"],
                discount_amount=pricing["discount_amount"],
                tax_amount=pricing["tax_amount"],
                total_amount=pricing["total_amount"],
                deposit_amount=pricing["security_deposit"],
                deposit_paid=False,
                paid_amount=Decimal("0.00"),
                payment_status=PaymentStatus.PENDING,
                payment_method=rental_data.payment_method,
                notes=rental_data.notes,
                pickup_required=rental_data.pickup_required,
                pickup_date=rental_data.pickup_date,
                pickup_time=rental_data.pickup_time,
                delivery_required=rental_data.delivery_required,
                delivery_address=rental_data.delivery_address,
                delivery_date=rental_data.delivery_date,
                delivery_time=rental_data.delivery_time,
                created_by=created_by,
                updated_by=created_by
            )
            
            self.session.add(transaction)
            await self.session.flush()
            
            # Create transaction lines with rental details
            lines = await self._create_rental_lines(
                transaction.id,
                rental_data.items,
                rental_data.rental_start_date,
                rental_data.rental_end_date,
                created_by
            )
            
            # Create rental lifecycle record
            lifecycle = await self._create_rental_lifecycle(
                transaction.id,
                rental_data,
                pricing,
                created_by
            )
            
            # Create initial event
            await self.event_repo.create_transaction_event(
                transaction_id=transaction.id,
                event_type="RENTAL_CREATED",
                description=f"Rental transaction {transaction_number} created",
                user_id=created_by,
                operation="create_rental",
                duration_ms=int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            )
            
            # Block items from inventory for rental period
            await self._block_items_for_rental(
                lines,
                rental_data.rental_start_date,
                rental_data.rental_end_date,
                rental_data.customer_id,
                transaction.id,
                rental_data.location_id,
                created_by
            )
            
            await self.session.commit()
            
            # Reload with relationships
            transaction = await self.transaction_repo.get_by_id(
                transaction.id,
                include_lines=True,
                include_lifecycle=True
            )
            
            return RentalResponse.from_transaction(transaction)
            
        except IntegrityError as e:
            await self.session.rollback()
            logger.error(f"Database integrity error: {e}")
            raise ConflictError("Rental creation failed due to data conflict")
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Rental creation failed: {e}")
            raise
    
    async def process_pickup(
        self,
        rental_id: UUID,
        pickup_data: Optional[RentalPickupRequest] = None,
        processed_by: Optional[str] = None
    ) -> RentalResponse:
        """
        Process rental pickup - marks items as picked up and starts rental period.
        
        Args:
            rental_id: Rental transaction ID
            pickup_data: Optional pickup details
            processed_by: User processing the pickup
            
        Returns:
            Updated rental transaction
        """
        transaction = await self.transaction_repo.get_by_id(
            rental_id,
            include_lines=True,
            include_lifecycle=True
        )
        
        if not transaction:
            raise NotFoundError(f"Rental transaction {rental_id} not found")
        
        if transaction.transaction_type != TransactionType.RENTAL:
            raise ValidationError(f"Transaction {rental_id} is not a rental")
        
        if transaction.status != TransactionStatus.PENDING:
            raise ValidationError(f"Rental {rental_id} is not pending pickup")
        
        # Update transaction status
        transaction.status = TransactionStatus.IN_PROGRESS
        transaction.updated_by = processed_by
        
        # Update rental lifecycle
        if transaction.rental_lifecycle:
            transaction.rental_lifecycle.actual_pickup_date = datetime.now(timezone.utc)
            transaction.rental_lifecycle.pickup_processed_by = processed_by
            
            if pickup_data and pickup_data.pickup_notes:
                transaction.rental_lifecycle.pickup_notes = pickup_data.pickup_notes
        
        # Update line items status
        for line in transaction.transaction_lines:
            line.current_rental_status = RentalStatus.RENTAL_INPROGRESS
            line.status = "ACTIVE"
        
        # Create pickup event
        await self.event_repo.create_transaction_event(
            transaction_id=transaction.id,
            event_type="RENTAL_PICKUP",
            description="Rental items picked up",
            user_id=processed_by,
            event_data={
                "pickup_date": datetime.now(timezone.utc).isoformat(),
                "items_count": len(transaction.transaction_lines)
            }
        )
        
        await self.session.commit()
        
        return RentalResponse.from_transaction(transaction)
    
    async def process_return(
        self,
        rental_id: UUID,
        return_data: RentalReturnRequest,
        processed_by: Optional[str] = None
    ) -> RentalResponse:
        """
        Process rental return with inspection and damage assessment.
        
        Args:
            rental_id: Rental transaction ID
            return_data: Return details including item conditions
            processed_by: User processing the return
            
        Returns:
            Updated rental transaction with return details
        """
        transaction = await self.transaction_repo.get_by_id(
            rental_id,
            include_lines=True,
            include_lifecycle=True
        )
        
        if not transaction:
            raise NotFoundError(f"Rental transaction {rental_id} not found")
        
        if transaction.transaction_type != TransactionType.RENTAL:
            raise ValidationError(f"Transaction {rental_id} is not a rental")
        
        if transaction.status not in [TransactionStatus.IN_PROGRESS]:
            raise ValidationError(f"Rental {rental_id} is not active")
        
        # Process each returned item
        total_damage_charges = Decimal("0.00")
        total_late_fees = Decimal("0.00")
        all_returned = True
        
        for item_return in return_data.items:
            line = await self._get_transaction_line(transaction.id, item_return.line_id)
            if not line:
                continue
            
            # Process return for this line
            line.returned_quantity += item_return.quantity_returned
            line.return_date = date.today()
            line.return_condition = item_return.condition_rating
            
            # Create inspection record if needed
            if item_return.requires_inspection:
                inspection = await self._create_inspection_record(
                    line.id,
                    item_return,
                    processed_by
                )
                
                # Calculate damage charges
                if inspection.repair_cost_estimate:
                    total_damage_charges += inspection.repair_cost_estimate
            
            # Update rental status
            if line.returned_quantity >= line.quantity:
                line.current_rental_status = RentalStatus.RENTAL_COMPLETED
            elif line.returned_quantity > 0:
                line.current_rental_status = RentalStatus.RENTAL_PARTIAL_RETURN
                all_returned = False
            else:
                all_returned = False
            
            # Calculate late fees if applicable
            if line.rental_end_date and line.rental_end_date < date.today():
                days_late = (date.today() - line.rental_end_date).days
                if days_late > self.GRACE_PERIOD_DAYS:
                    late_fee = await self._calculate_late_fee(line, days_late)
                    total_late_fees += late_fee
        
        # Update transaction status
        if all_returned:
            transaction.status = TransactionStatus.COMPLETED
        
        # Update lifecycle
        if transaction.rental_lifecycle:
            transaction.rental_lifecycle.actual_return_date = datetime.now(timezone.utc)
            transaction.rental_lifecycle.return_processed_by = processed_by
            transaction.rental_lifecycle.late_fees = total_late_fees
            transaction.rental_lifecycle.damage_charges = total_damage_charges
            
            # Calculate deposit refund
            deposit_refund = transaction.deposit_amount - total_damage_charges - total_late_fees
            transaction.rental_lifecycle.deposit_refund_amount = max(deposit_refund, Decimal("0.00"))
        
        # Create return event
        await self._create_return_event(
            transaction.id,
            return_data,
            total_damage_charges,
            total_late_fees,
            processed_by
        )
        
        # Release items back to inventory
        await self._release_rental_items(
            transaction.transaction_lines,
            transaction.location_id,
            transaction.id,
            {"item_returns": [item.__dict__ for item in return_data.items], "inspector_notes": return_data.inspector_notes},
            processed_by
        )
        
        await self.session.commit()
        
        return RentalResponse.from_transaction(transaction)
    
    async def extend_rental(
        self,
        rental_id: UUID,
        extension_data: RentalExtensionRequest,
        processed_by: Optional[str] = None
    ) -> RentalResponse:
        """
        Extend rental period with recalculated pricing.
        
        Args:
            rental_id: Rental transaction ID
            extension_data: Extension details
            processed_by: User processing the extension
            
        Returns:
            Updated rental transaction with extended period
        """
        transaction = await self.transaction_repo.get_by_id(
            rental_id,
            include_lines=True,
            include_lifecycle=True
        )
        
        if not transaction:
            raise NotFoundError(f"Rental transaction {rental_id} not found")
        
        if transaction.transaction_type != TransactionType.RENTAL:
            raise ValidationError(f"Transaction {rental_id} is not a rental")
        
        if transaction.status != TransactionStatus.IN_PROGRESS:
            raise ValidationError(f"Rental {rental_id} is not active")
        
        # Check extension limit
        if transaction.extension_count >= self.MAX_EXTENSION_COUNT:
            raise ValidationError(
                f"Rental has reached maximum extension limit ({self.MAX_EXTENSION_COUNT})"
            )
        
        # Check availability for extended period
        current_end_date = max(
            line.rental_end_date for line in transaction.transaction_lines
            if line.rental_end_date
        )
        
        availability_issues = await self._check_item_availability(
            [{"item_id": line.item_id, "quantity": line.quantity} 
             for line in transaction.transaction_lines],
            current_end_date + timedelta(days=1),
            extension_data.new_end_date
        )
        
        if availability_issues:
            raise ConflictError(
                "Some items are not available for the extended period",
                details={"unavailable_items": availability_issues}
            )
        
        # Calculate extension charges
        extension_charges = await self._calculate_extension_charges(
            transaction.transaction_lines,
            current_end_date,
            extension_data.new_end_date
        )
        
        # Update transaction
        transaction.extension_count += 1
        transaction.total_extension_charges += extension_charges
        transaction.total_amount += extension_charges
        transaction.updated_by = processed_by
        
        # Update line items
        for line in transaction.transaction_lines:
            line.rental_end_date = extension_data.new_end_date
            line.current_rental_status = RentalStatus.RENTAL_EXTENDED
        
        # Update lifecycle
        if transaction.rental_lifecycle:
            transaction.rental_lifecycle.expected_return_date = extension_data.new_end_date
            transaction.rental_lifecycle.extension_count += 1
            transaction.rental_lifecycle.total_extension_charges += extension_charges
        
        # Create extension event
        await self.event_repo.create_transaction_event(
            transaction_id=transaction.id,
            event_type="RENTAL_EXTENDED",
            description=f"Rental extended to {extension_data.new_end_date}",
            user_id=processed_by,
            event_data={
                "old_end_date": current_end_date.isoformat(),
                "new_end_date": extension_data.new_end_date.isoformat(),
                "extension_charges": str(extension_charges),
                "extension_count": transaction.extension_count
            }
        )
        
        await self.session.commit()
        
        return RentalResponse.from_transaction(transaction)
    
    async def check_availability(
        self,
        availability_check: RentalAvailabilityCheck
    ) -> Dict[str, Any]:
        """
        Check item availability for rental period.
        
        Args:
            availability_check: Availability check parameters
            
        Returns:
            Availability status and alternative suggestions
        """
        results = {}
        
        for item_request in availability_check.items:
            item = await self.item_repo.get_by_id(item_request.item_id)
            if not item:
                results[str(item_request.item_id)] = {
                    "available": False,
                    "reason": "Item not found"
                }
                continue
            
            # Check if item is rentable
            if not item.is_rentable:
                results[str(item_request.item_id)] = {
                    "available": False,
                    "reason": "Item is not available for rental"
                }
                continue
            
            # Check existing rentals for conflicts
            conflicts = await self._find_rental_conflicts(
                item_request.item_id,
                availability_check.start_date,
                availability_check.end_date
            )
            
            if conflicts:
                # Find alternative dates
                alternatives = await self._find_alternative_dates(
                    item_request.item_id,
                    availability_check.start_date,
                    availability_check.end_date,
                    item_request.quantity
                )
                
                results[str(item_request.item_id)] = {
                    "available": False,
                    "reason": "Item is already rented for this period",
                    "conflicts": conflicts,
                    "alternatives": alternatives
                }
            else:
                results[str(item_request.item_id)] = {
                    "available": True,
                    "quantity_available": await self._get_available_quantity(
                        item_request.item_id,
                        availability_check.start_date,
                        availability_check.end_date
                    )
                }
        
        return results
    
    async def get_overdue_rentals(
        self,
        location_id: Optional[UUID] = None
    ) -> List[RentalResponse]:
        """Get all overdue rental transactions."""
        query = select(TransactionHeader).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionHeader.status == TransactionStatus.IN_PROGRESS
            )
        ).options(
            selectinload(TransactionHeader.transaction_lines),
            selectinload(TransactionHeader.rental_lifecycle)
        )
        
        if location_id:
            query = query.where(TransactionHeader.location_id == location_id)
        
        result = await self.session.execute(query)
        transactions = result.scalars().all()
        
        # Filter for overdue
        overdue = []
        today = date.today()
        
        for transaction in transactions:
            max_end_date = max(
                (line.rental_end_date for line in transaction.transaction_lines
                 if line.rental_end_date),
                default=None
            )
            
            if max_end_date and max_end_date < today:
                overdue.append(RentalResponse.from_transaction(transaction))
        
        return overdue
    
    # Private helper methods
    
    async def _validate_rental_data(
        self,
        rental_data: RentalCreate
    ) -> List[RentalValidationError]:
        """Validate rental data and return list of errors."""
        errors = []
        
        # Validate customer
        customer = await self.customer_repo.get_by_id(rental_data.customer_id)
        if not customer:
            errors.append(RentalValidationError(
                field="customer_id",
                message="Customer not found",
                code="CUSTOMER_NOT_FOUND"
            ))
        elif customer.status != "ACTIVE":
            errors.append(RentalValidationError(
                field="customer_id",
                message="Customer is not active",
                code="CUSTOMER_INACTIVE"
            ))
        
        # Validate dates
        if rental_data.rental_start_date > rental_data.rental_end_date:
            errors.append(RentalValidationError(
                field="rental_dates",
                message="Start date must be before end date",
                code="INVALID_DATE_RANGE"
            ))
        
        # Calculate rental duration
        duration_days = (rental_data.rental_end_date - rental_data.rental_start_date).days
        if duration_days < 1 and rental_data.rental_period_unit == RentalPeriodUnit.DAY:
            errors.append(RentalValidationError(
                field="rental_dates",
                message="Minimum rental period is 1 day",
                code="DURATION_TOO_SHORT"
            ))
        
        # Validate items
        for idx, item_data in enumerate(rental_data.items):
            item = await self.item_repo.get_by_id(item_data.item_id)
            if not item:
                errors.append(RentalValidationError(
                    field=f"items[{idx}].item_id",
                    message="Item not found",
                    code="ITEM_NOT_FOUND"
                ))
            elif not item.is_rentable:
                errors.append(RentalValidationError(
                    field=f"items[{idx}].item_id",
                    message="Item is not available for rental",
                    code="ITEM_NOT_RENTABLE"
                ))
        
        return errors
    
    async def _check_item_availability(
        self,
        items: List[Dict],
        start_date: date,
        end_date: date
    ) -> List[Dict]:
        """Check if items are available for the requested period."""
        unavailable = []
        
        for item_data in items:
            conflicts = await self._find_rental_conflicts(
                item_data["item_id"],
                start_date,
                end_date
            )
            
            if conflicts:
                unavailable.append({
                    "item_id": str(item_data["item_id"]),
                    "conflicts": conflicts
                })
        
        return unavailable
    
    async def _find_rental_conflicts(
        self,
        item_id: UUID,
        start_date: date,
        end_date: date
    ) -> List[Dict]:
        """Find existing rentals that conflict with the requested period."""
        query = select(TransactionLine).where(
            and_(
                TransactionLine.item_id == item_id,
                TransactionLine.current_rental_status.in_([
                    RentalStatus.RENTAL_INPROGRESS,
                    RentalStatus.RENTAL_EXTENDED
                ]),
                or_(
                    and_(
                        TransactionLine.rental_start_date <= start_date,
                        TransactionLine.rental_end_date >= start_date
                    ),
                    and_(
                        TransactionLine.rental_start_date <= end_date,
                        TransactionLine.rental_end_date >= end_date
                    ),
                    and_(
                        TransactionLine.rental_start_date >= start_date,
                        TransactionLine.rental_end_date <= end_date
                    )
                )
            )
        ).options(selectinload(TransactionLine.transaction))
        
        result = await self.session.execute(query)
        conflicts = result.scalars().all()
        
        return [
            {
                "transaction_id": str(line.transaction_header_id),
                "transaction_number": line.transaction.transaction_number,
                "start_date": line.rental_start_date.isoformat(),
                "end_date": line.rental_end_date.isoformat()
            }
            for line in conflicts
        ]
    
    async def _calculate_rental_pricing(
        self,
        items: List[RentalItemCreate],
        start_date: date,
        end_date: date,
        strategy: RentalPricingStrategy
    ) -> Dict[str, Decimal]:
        """Calculate rental pricing based on items and period, using the new pricing system."""
        from app.services.rental_pricing_service import RentalPricingService, PricingOptimizationStrategy
        
        subtotal = Decimal("0.00")
        security_deposit = Decimal("0.00")
        discount_amount = Decimal("0.00")
        total_savings = Decimal("0.00")  # Track savings from tiered pricing
        
        duration_days = (end_date - start_date).days
        pricing_service = RentalPricingService(self.session)
        
        for item_data in items:
            item = await self.item_repo.get_by_id(item_data.item_id)
            if not item:
                continue
            
            # Use custom rate if provided, otherwise use pricing service
            if item_data.custom_daily_rate:
                # Custom rate overrides pricing system
                daily_rate = item_data.custom_daily_rate
                line_total = daily_rate * duration_days * item_data.quantity
            else:
                try:
                    # Use the new pricing service to get optimal pricing
                    pricing_result = await pricing_service.calculate_rental_pricing(
                        item_id=item_data.item_id,
                        rental_days=duration_days,
                        calculation_date=start_date,
                        optimization_strategy=PricingOptimizationStrategy.LOWEST_COST
                    )
                    
                    # Use the calculated total cost
                    line_total = pricing_result.total_cost * item_data.quantity
                    
                    # Track savings if any
                    if pricing_result.savings_compared_to_daily:
                        total_savings += pricing_result.savings_compared_to_daily * item_data.quantity
                    
                except Exception as e:
                    # Fallback to item's base daily rate if pricing calculation fails
                    logger.warning(f"Failed to calculate pricing for item {item_data.item_id}: {e}")
                    
                    # Try to get the best rate from the item model
                    best_rate = item.get_best_rental_rate(duration_days)
                    if best_rate:
                        line_total = best_rate * item_data.quantity
                    else:
                        # Final fallback to daily rate
                        daily_rate = item.rental_rate_per_day or Decimal("0.00")
                        line_total = daily_rate * duration_days * item_data.quantity
            
            # Apply legacy pricing strategy modifiers if needed
            if strategy == RentalPricingStrategy.SEASONAL:
                # Apply seasonal adjustments on top of calculated price
                current_month = datetime.now().month
                if current_month in [6, 7, 8]:  # Summer peak
                    line_total *= Decimal("1.2")  # 20% increase
                elif current_month in [12, 1, 2]:  # Winter low
                    line_total *= Decimal("0.9")  # 10% discount
            
            subtotal += line_total
            
            # Calculate security deposit
            # Use item's security deposit if set, otherwise calculate based on value
            if item.security_deposit:
                item_deposit = item.security_deposit * item_data.quantity
            else:
                # Fallback to percentage of sale price or rental rate
                base_value = item.sale_price or (item.rental_rate_per_day * 30) or Decimal("100.00")
                item_deposit = base_value * self.SECURITY_DEPOSIT_PERCENTAGE * item_data.quantity
            security_deposit += item_deposit
            
            # Apply item-specific discount if provided
            if item_data.discount_percent:
                item_discount = line_total * item_data.discount_percent / 100
                discount_amount += item_discount
        
        # Add total savings from tiered pricing to discount amount
        if total_savings > 0:
            discount_amount += total_savings
        
        # Calculate tax (simplified - would be more complex in production)
        tax_rate = Decimal("0.10")  # 10% tax
        taxable_amount = subtotal - discount_amount
        tax_amount = taxable_amount * tax_rate
        
        total_amount = taxable_amount + tax_amount
        
        return {
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "security_deposit": security_deposit,
            "savings_from_tiered_pricing": total_savings  # New field to track savings
        }
    
    async def _create_rental_lines(
        self,
        transaction_id: UUID,
        items: List[RentalItemCreate],
        start_date: date,
        end_date: date,
        created_by: Optional[str] = None
    ) -> List[TransactionLine]:
        """Create transaction lines for rental."""
        lines = []
        duration_days = (end_date - start_date).days
        
        for idx, item_data in enumerate(items, 1):
            item = await self.item_repo.get_by_id(item_data.item_id)
            if not item:
                continue
            
            # Get rental rate
            if item_data.custom_daily_rate:
                daily_rate = item_data.custom_daily_rate
            else:
                daily_rate = item.rental_rates.get("daily", Decimal("0.00"))
            
            # Calculate line totals
            line_total = daily_rate * duration_days * item_data.quantity
            
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
                unit_price=daily_rate,
                total_price=line_total,
                line_total=line_total,
                rental_start_date=start_date,
                rental_end_date=end_date,
                rental_period=duration_days,
                rental_period_unit=RentalPeriodUnit.DAY,
                current_rental_status=RentalStatus.RENTAL_INPROGRESS,
                daily_rate=daily_rate,
                location_id=item_data.pickup_location_id,
                status="PENDING",
                fulfillment_status="PENDING",
                created_by=created_by,
                updated_by=created_by
            )
            
            self.session.add(line)
            lines.append(line)
        
        await self.session.flush()
        return lines
    
    async def _create_rental_lifecycle(
        self,
        transaction_id: UUID,
        rental_data: RentalCreate,
        pricing: Dict[str, Decimal],
        created_by: Optional[str] = None
    ) -> RentalLifecycle:
        """Create rental lifecycle record."""
        lifecycle = RentalLifecycle(
            transaction_id=transaction_id,
            rental_start_date=rental_data.rental_start_date,
            rental_end_date=rental_data.rental_end_date,
            expected_pickup_date=rental_data.pickup_date or rental_data.rental_start_date,
            expected_return_date=rental_data.rental_end_date,
            total_rental_days=(rental_data.rental_end_date - rental_data.rental_start_date).days,
            security_deposit_amount=pricing["security_deposit"],
            deposit_paid=False,
            created_by=created_by
        )
        
        self.session.add(lifecycle)
        await self.session.flush()
        return lifecycle
    
    async def _generate_transaction_number(self) -> str:
        """Generate unique rental transaction number."""
        now = datetime.now(timezone.utc)
        prefix = f"RNT-{now.strftime('%Y%m%d')}"
        
        # Get count of rentals today
        start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        query = select(func.count(TransactionHeader.id)).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionHeader.transaction_date >= start_of_day
            )
        )
        result = await self.session.execute(query)
        count = result.scalar() or 0
        
        return f"{prefix}-{count + 1:04d}"
    
    async def _block_items_for_rental(
        self,
        lines: List[TransactionLine],
        start_date: date,
        end_date: date,
        customer_id: UUID,
        transaction_id: UUID,
        location_id: UUID,
        performed_by: UUID
    ):
        """Block items from inventory for the rental period."""
        try:
            for line in lines:
                if line.item_id and line.quantity > 0:
                    # Process rental checkout - move from available to on-rent
                    units, stock, movement = await inventory_service.process_rental_checkout(
                        self.session,
                        item_id=line.item_id,
                        location_id=location_id,
                        quantity=line.quantity,
                        customer_id=customer_id,
                        transaction_id=transaction_id,
                        performed_by=performed_by
                    )
                    
                    logger.info(
                        f"Blocked {len(units)} units of item {line.item_id} for rental "
                        f"from {start_date} to {end_date}"
                    )
                    
        except Exception as e:
            logger.error(f"Failed to block items for rental: {str(e)}")
            raise ConflictError(f"Insufficient inventory available for rental: {str(e)}")
    
    async def _release_rental_items(
        self,
        lines: List[TransactionLine],
        location_id: UUID,
        transaction_id: UUID,
        return_data: Dict[str, Any],
        performed_by: UUID
    ):
        """Release items back to inventory after return."""
        try:
            for line in lines:
                if line.item_id and line.returned_quantity > 0:
                    # Calculate damaged quantity based on return assessment
                    damaged_quantity = Decimal("0")
                    if return_data.get("item_returns"):
                        for item_return in return_data["item_returns"]:
                            if item_return.get("line_id") == str(line.id):
                                # Check condition rating - poor or damaged items count as damaged
                                condition = item_return.get("condition_rating", "A")
                                if condition in ["D", "F"]:  # Damaged or Failed conditions
                                    damaged_quantity = line.returned_quantity
                                break
                    
                    # Get unit IDs for this line (simplified - would need proper tracking)
                    unit_ids = []  # Would need to track which units were rented
                    
                    # Process rental return
                    units, stock, movement = await inventory_service.process_rental_return(
                        self.session,
                        item_id=line.item_id,
                        location_id=location_id,
                        quantity=line.returned_quantity,
                        damaged_quantity=damaged_quantity,
                        transaction_id=transaction_id,
                        unit_ids=unit_ids,
                        condition_notes=return_data.get("inspector_notes"),
                        performed_by=performed_by
                    )
                    
                    logger.info(
                        f"Released {len(units)} units of item {line.item_id} back to inventory "
                        f"(damaged: {damaged_quantity})"
                    )
                    
        except Exception as e:
            logger.error(f"Failed to release rental items: {str(e)}")
            # Don't raise - return processing shouldn't fail due to inventory issues
            logger.exception("Detailed inventory release error:")
    
    async def _get_transaction_line(
        self,
        transaction_id: UUID,
        line_id: UUID
    ) -> Optional[TransactionLine]:
        """Get specific transaction line."""
        query = select(TransactionLine).where(
            and_(
                TransactionLine.id == line_id,
                TransactionLine.transaction_header_id == transaction_id
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def _create_inspection_record(
        self,
        line_id: UUID,
        item_return: Dict,
        inspector_id: Optional[str] = None
    ) -> TransactionInspection:
        """Create inspection record for returned item."""
        inspection = TransactionInspection(
            transaction_line_id=line_id,
            condition_rating=ConditionRating[item_return.condition_rating],
            inspector_id=inspector_id,
            damage_description=item_return.damage_description,
            repair_cost_estimate=item_return.repair_cost_estimate or Decimal("0.00"),
            disposition=ItemDisposition.RETURN_TO_STOCK 
                if item_return.condition_rating in ["A", "B"] 
                else ItemDisposition.SEND_TO_REPAIR,
            return_to_stock=item_return.condition_rating in ["A", "B"],
            photos_taken=bool(item_return.photo_urls),
            photo_urls=json.dumps(item_return.photo_urls) if item_return.photo_urls else None,
            inspection_notes=item_return.inspection_notes
        )
        
        self.session.add(inspection)
        await self.session.flush()
        return inspection
    
    async def _calculate_late_fee(
        self,
        line: TransactionLine,
        days_late: int
    ) -> Decimal:
        """Calculate late fee for a rental line."""
        if days_late <= self.GRACE_PERIOD_DAYS:
            return Decimal("0.00")
        
        billable_days = days_late - self.GRACE_PERIOD_DAYS
        daily_rate = line.daily_rate or Decimal("0.00")
        late_fee = daily_rate * self.LATE_FEE_MULTIPLIER * billable_days * line.quantity
        
        return late_fee
    
    async def _calculate_extension_charges(
        self,
        lines: List[TransactionLine],
        current_end: date,
        new_end: date
    ) -> Decimal:
        """Calculate charges for rental extension."""
        extension_days = (new_end - current_end).days
        total_charges = Decimal("0.00")
        
        for line in lines:
            daily_rate = line.daily_rate or Decimal("0.00")
            line_charges = daily_rate * extension_days * line.quantity
            total_charges += line_charges
        
        return total_charges
    
    async def _create_return_event(
        self,
        transaction_id: UUID,
        return_data: RentalReturnRequest,
        damage_charges: Decimal,
        late_fees: Decimal,
        user_id: Optional[str] = None
    ):
        """Create comprehensive return event."""
        await self.event_repo.create_transaction_event(
            transaction_id=transaction_id,
            event_type="RENTAL_RETURNED",
            description="Rental items returned",
            user_id=user_id,
            event_data={
                "return_date": datetime.now(timezone.utc).isoformat(),
                "items_returned": len(return_data.items),
                "damage_charges": str(damage_charges),
                "late_fees": str(late_fees),
                "total_charges": str(damage_charges + late_fees)
            }
        )
    
    async def _find_alternative_dates(
        self,
        item_id: UUID,
        preferred_start: date,
        preferred_end: date,
        quantity: int
    ) -> List[Dict]:
        """Find alternative rental dates for unavailable item."""
        alternatives = []
        duration = (preferred_end - preferred_start).days
        
        # Check next 30 days for availability
        for offset in range(1, 31):
            test_start = preferred_start + timedelta(days=offset)
            test_end = test_start + timedelta(days=duration)
            
            conflicts = await self._find_rental_conflicts(
                item_id,
                test_start,
                test_end
            )
            
            if not conflicts:
                alternatives.append({
                    "start_date": test_start.isoformat(),
                    "end_date": test_end.isoformat(),
                    "available": True
                })
                
                if len(alternatives) >= 3:  # Return up to 3 alternatives
                    break
        
        return alternatives
    
    async def _get_available_quantity(
        self,
        item_id: UUID,
        start_date: date,
        end_date: date
    ) -> int:
        """Get available quantity for an item during a period."""
        # This would check against inventory levels and existing rentals
        # Simplified for now
        item = await self.item_repo.get_by_id(item_id)
        if not item:
            return 0
        
        # Get total quantity from inventory (would be from stock levels)
        total_quantity = 10  # Placeholder
        
        # Get rented quantity for the period
        query = select(func.sum(TransactionLine.quantity)).where(
            and_(
                TransactionLine.item_id == item_id,
                TransactionLine.current_rental_status.in_([
                    RentalStatus.RENTAL_INPROGRESS,
                    RentalStatus.RENTAL_EXTENDED
                ]),
                or_(
                    and_(
                        TransactionLine.rental_start_date <= start_date,
                        TransactionLine.rental_end_date >= start_date
                    ),
                    and_(
                        TransactionLine.rental_start_date <= end_date,
                        TransactionLine.rental_end_date >= end_date
                    )
                )
            )
        )
        result = await self.session.execute(query)
        rented_quantity = result.scalar() or 0
        
        return max(0, total_quantity - int(rented_quantity))