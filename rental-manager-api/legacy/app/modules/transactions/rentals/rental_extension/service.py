"""
Rental Extension Service for processing rental extensions
"""

from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.modules.transactions.rentals.rental_extension.models import (
    RentalExtension, 
    RentalExtensionLine, 
    ExtensionType,
    ReturnCondition,
    PaymentStatus as ExtensionPaymentStatus
)
# BookingConflictService removed - conflict checking now in unified booking module
# from app.modules.transactions.rentals.booking_service import BookingConflictService
from app.modules.transactions.base.models import TransactionHeader, TransactionLine
from app.modules.transactions.base.models.transaction_headers import (
    TransactionType, 
    RentalStatus,
    PaymentStatus
)
from app.modules.transactions.base.models.rental_lifecycle import RentalLifecycle
from app.modules.inventory.service import InventoryService
from app.modules.transactions.rentals.rental_return.service import RentalReturnService
from app.shared.exceptions import ValidationError, NotFoundError
import logging

logger = logging.getLogger(__name__)


class RentalExtensionService:
    """Service for processing rental extensions with flexible payment"""
    
    def __init__(self):
        # Conflict checking now handled in unified booking module
        self.inventory_service = InventoryService()
        self.return_service = RentalReturnService()
    
    async def check_extension_availability(
        self,
        session: AsyncSession,
        rental_id: str,
        new_end_date: date,
        items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Check if rental can be extended to the specified date
        
        Args:
            session: Database session
            rental_id: Rental transaction ID
            new_end_date: Proposed new end date
            items: List of items to check with quantities
            
        Returns:
            Availability information including conflicts and charges
        """
        # Get rental details
        rental = await self._get_rental_with_details(session, rental_id)
        
        # Validate rental can be extended
        self._validate_rental_for_extension(rental)
        
        # Check for booking conflicts
        # TODO: Integrate with unified booking module's availability checking
        conflicts = []  # Temporarily disabled - needs integration with booking module
        
        # Calculate extension charges
        charges = await self._calculate_extension_charges(
            rental, items, new_end_date
        )
        
        # Get current balance
        balance = self._calculate_rental_balance(rental)
        
        return {
            "can_extend": not conflicts["has_conflicts"],
            "conflicts": conflicts["conflicts"] if conflicts["has_conflicts"] else {},
            "extension_charges": float(charges),
            "current_balance": float(balance["balance_due"]),
            "total_with_extension": float(Decimal(str(balance["balance_due"])) + charges),
            "payment_required": False,  # Payment always optional
            "items": await self._get_item_availability_details(
                session, rental, items, new_end_date
            )
        }
    
    async def process_extension(
        self,
        session: AsyncSession,
        rental_id: str,
        extension_request: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a rental extension with optional payment
        
        Args:
            session: Database session
            rental_id: Rental transaction ID
            extension_request: Extension request data including:
                - new_end_date: New end date for the rental
                - items: List of items to extend/return
                - payment_option: PAY_NOW or PAY_LATER
                - payment_amount: Optional payment amount
                
        Returns:
            Extension result with updated rental information
        """
        # Get rental with all related data
        rental = await self._get_rental_with_details(session, rental_id)
        
        # Validate extension eligibility
        self._validate_rental_for_extension(rental)
        
        # Check for booking conflicts  
        # TODO: Integrate with unified booking module's availability checking
        conflicts = []  # Temporarily disabled - needs integration with booking module
        
        if conflicts["has_conflicts"]:
            raise ValidationError(f"Cannot extend due to booking conflicts: {conflicts['conflicts']}")
        
        # Determine extension type
        extension_type = self._determine_extension_type(extension_request["items"])
        
        # Calculate charges
        extension_charges = await self._calculate_extension_charges(
            rental, extension_request["items"], extension_request["new_end_date"]
        )
        
        # Create extension record
        extension = await self._create_extension_record(
            session,
            rental,
            extension_request["new_end_date"],
            extension_type,
            extension_charges,
            extension_request.get("payment_amount", Decimal("0")),
            extension_request.get("extended_by"),
            extension_request.get("notes")
        )
        
        # Process each item
        for item in extension_request["items"]:
            await self._process_extension_item(
                session, extension, rental, item
            )
        
        # Update rental header
        await self._update_rental_header(
            session, rental, extension_request["new_end_date"], extension_charges
        )
        
        # Process optional payment
        payment_received = Decimal(str(extension_request.get("payment_amount", 0)))
        if payment_received > 0:
            await self._process_payment(session, rental, payment_received)
        
        # Update rental lifecycle
        await self._update_rental_lifecycle(
            session, rental, extension_request["new_end_date"]
        )
        
        await session.flush()
        
        # Calculate updated balance
        updated_balance = self._calculate_rental_balance(rental)
        
        logger.info(f"Processed extension for rental {rental.transaction_number}")
        
        return {
            "success": True,
            "extension_id": str(extension.id),
            "rental_id": rental_id,
            "transaction_number": rental.transaction_number,
            "original_end_date": rental.transaction_lines[0].rental_end_date.isoformat(),
            "new_end_date": extension_request["new_end_date"].isoformat(),
            "extension_charges": float(extension_charges),
            "payment_received": float(payment_received),
            "total_balance": float(updated_balance["balance_due"]),
            "payment_status": rental.payment_status.value,
            "extension_count": rental.extension_count
        }
    
    async def _get_rental_with_details(
        self,
        session: AsyncSession,
        rental_id: str
    ) -> TransactionHeader:
        """Get rental transaction with all related data"""
        stmt = select(TransactionHeader).where(
            TransactionHeader.id == UUID(rental_id)
        ).options(
            selectinload(TransactionHeader.transaction_lines).selectinload(TransactionLine.item),
            selectinload(TransactionHeader.rental_lifecycle),
            selectinload(TransactionHeader.extensions),
            selectinload(TransactionHeader.customer)
        )
        
        result = await session.execute(stmt)
        rental = result.scalar_one_or_none()
        
        if not rental:
            raise NotFoundError(f"Rental {rental_id} not found")
        
        if rental.transaction_type != TransactionType.RENTAL:
            raise ValidationError(f"Transaction {rental_id} is not a rental")
        
        return rental
    
    def _validate_rental_for_extension(self, rental: TransactionHeader):
        """Validate that rental can be extended"""
        # Check rental status
        valid_statuses = [
            RentalStatus.RENTAL_INPROGRESS,
            RentalStatus.RENTAL_EXTENDED,
            RentalStatus.RENTAL_LATE,
            RentalStatus.RENTAL_PARTIAL_RETURN,
            RentalStatus.RENTAL_LATE_PARTIAL_RETURN
        ]
        
        if rental.rental_lifecycle:
            current_status = rental.rental_lifecycle.current_status
            if current_status not in [s.value for s in valid_statuses]:
                raise ValidationError(f"Cannot extend rental with status {current_status}")
        
        # Check if rental is completed
        if rental.status.value == "COMPLETED":
            raise ValidationError("Cannot extend a completed rental")
    
    def _determine_extension_type(self, items: List[Dict[str, Any]]) -> ExtensionType:
        """Determine if extension is full or partial"""
        has_returns = any(
            item.get("action") in ["PARTIAL_RETURN", "FULL_RETURN"] or 
            item.get("return_quantity", 0) > 0
            for item in items
        )
        
        return ExtensionType.PARTIAL if has_returns else ExtensionType.FULL
    
    async def _calculate_extension_charges(
        self,
        rental: TransactionHeader,
        items: List[Dict[str, Any]],
        new_end_date: date
    ) -> Decimal:
        """Calculate charges for the extension"""
        total_charges = Decimal("0")
        
        for item in items:
            # Find corresponding transaction line
            line_id = item.get("line_id") or item.get("transaction_line_id")
            line = next(
                (l for l in rental.transaction_lines if str(l.id) == line_id),
                None
            )
            
            if not line:
                continue
            
            # Get quantities
            extend_quantity = Decimal(str(item.get("extend_quantity", line.quantity)))
            
            if extend_quantity <= 0:
                continue
            
            # Calculate days
            current_end_date = line.rental_end_date
            extension_days = (new_end_date - current_end_date).days
            
            if extension_days <= 0:
                continue
            
            # Use same rate as original rental
            daily_rate = Decimal(str(line.unit_price))  # Ensure Decimal type
            item_charges = daily_rate * extend_quantity * Decimal(str(extension_days))
            
            total_charges = total_charges + item_charges
        
        return total_charges
    
    async def _create_extension_record(
        self,
        session: AsyncSession,
        rental: TransactionHeader,
        new_end_date: date,
        extension_type: ExtensionType,
        extension_charges: Decimal,
        payment_received: Decimal,
        extended_by: Optional[str],
        notes: Optional[str]
    ) -> RentalExtension:
        """Create extension record"""
        # Get original end date from first line
        original_end_date = rental.transaction_lines[0].rental_end_date
        
        # Determine payment status
        if extension_charges == 0 or payment_received >= extension_charges:
            payment_status = ExtensionPaymentStatus.PAID
        elif payment_received > 0:
            payment_status = ExtensionPaymentStatus.PARTIAL
        else:
            payment_status = ExtensionPaymentStatus.PENDING
        
        extension = RentalExtension(
            parent_rental_id=rental.id,
            original_end_date=original_end_date,
            new_end_date=new_end_date,
            extension_type=extension_type,
            extended_by=extended_by or rental.created_by,
            extension_charges=extension_charges,
            payment_received=payment_received,
            payment_status=payment_status,
            notes=notes
        )
        
        session.add(extension)
        await session.flush()
        
        return extension
    
    async def _process_extension_item(
        self,
        session: AsyncSession,
        extension: RentalExtension,
        rental: TransactionHeader,
        item: Dict[str, Any]
    ):
        """Process individual item in extension"""
        # Find transaction line
        line_id = item.get("line_id") or item.get("transaction_line_id")
        line = next(
            (l for l in rental.transaction_lines if str(l.id) == line_id),
            None
        )
        
        if not line:
            return
        
        # Get quantities
        original_quantity = line.quantity
        extend_quantity = Decimal(str(item.get("extend_quantity", original_quantity)))
        return_quantity = Decimal(str(item.get("return_quantity", 0)))
        
        # Create extension line record
        extension_line = RentalExtensionLine(
            extension_id=extension.id,
            transaction_line_id=line.id,
            original_quantity=original_quantity,
            extended_quantity=extend_quantity,
            returned_quantity=return_quantity,
            return_condition=ReturnCondition[item["return_condition"]] if item.get("return_condition") else None,
            condition_notes=item.get("condition_notes"),
            damage_assessment=Decimal(str(item.get("damage_assessment", 0))),
            item_new_end_date=item.get("new_end_date") or extension.new_end_date
        )
        
        session.add(extension_line)
        
        # Update transaction line end date
        line.rental_end_date = item.get("new_end_date") or extension.new_end_date
        
        # Process returns if any
        if return_quantity > 0:
            await self._process_partial_return(
                session, rental, line, return_quantity, item
            )
    
    async def _process_partial_return(
        self,
        session: AsyncSession,
        rental: TransactionHeader,
        line: TransactionLine,
        return_quantity: Decimal,
        item: Dict[str, Any]
    ):
        """Process partial return of items during extension"""
        # Update inventory for returned items
        await self.inventory_service.return_rental_item(
            session,
            line.item_id,
            rental.location_id,
            return_quantity,
            item.get("return_condition", "GOOD")
        )
        
        # Update line quantity
        line.quantity -= return_quantity
    
    async def _update_rental_header(
        self,
        session: AsyncSession,
        rental: TransactionHeader,
        new_end_date: date,
        extension_charges: Decimal
    ):
        """Update rental transaction header"""
        rental.extension_count += 1
        rental.total_extension_charges += extension_charges
        rental.total_amount += extension_charges
        rental.updated_at = datetime.utcnow()
        
        # Update rental status if needed
        if rental.rental_lifecycle and rental.rental_lifecycle.current_status == RentalStatus.RENTAL_INPROGRESS.value:
            rental.rental_lifecycle.current_status = RentalStatus.RENTAL_EXTENDED.value
            rental.rental_lifecycle.last_status_change = datetime.utcnow()
    
    async def _process_payment(
        self,
        session: AsyncSession,
        rental: TransactionHeader,
        payment_amount: Decimal
    ):
        """Process payment for the extension"""
        rental.paid_amount += payment_amount
        
        # Update payment status
        if rental.paid_amount >= rental.total_amount:
            rental.payment_status = PaymentStatus.PAID
        elif rental.paid_amount > 0:
            rental.payment_status = PaymentStatus.PARTIAL
        else:
            rental.payment_status = PaymentStatus.PENDING
    
    async def _update_rental_lifecycle(
        self,
        session: AsyncSession,
        rental: TransactionHeader,
        new_end_date: date
    ):
        """Update rental lifecycle record"""
        if rental.rental_lifecycle:
            rental.rental_lifecycle.expected_return_date = new_end_date
            rental.rental_lifecycle.updated_at = datetime.utcnow()
    
    def _calculate_rental_balance(self, rental: TransactionHeader) -> Dict[str, Any]:
        """Calculate current rental balance"""
        return {
            "original_rental": float(rental.subtotal),
            "extension_charges": float(rental.total_extension_charges),
            "late_fees": 0,  # Calculate based on current date
            "damage_fees": 0,
            "total_charges": float(rental.total_amount),
            "payments_received": float(rental.paid_amount),
            "balance_due": float(rental.total_amount - rental.paid_amount),
            "payment_status": rental.payment_status.value
        }
    
    async def _get_item_availability_details(
        self,
        session: AsyncSession,
        rental: TransactionHeader,
        items: List[Dict[str, Any]],
        new_end_date: date
    ) -> List[Dict[str, Any]]:
        """Get detailed availability information for each item"""
        details = []
        
        for item in items:
            line_id = item.get("line_id") or item.get("transaction_line_id")
            line = next(
                (l for l in rental.transaction_lines if str(l.id) == line_id),
                None
            )
            
            if not line:
                continue
            
            # Get next available date if there's a conflict
            # TODO: Integrate with unified booking module's availability checking
            next_available = None  # Temporarily disabled
            # Old code for reference:
            # next_available = await self.conflict_service.get_next_available_date(
            #     session,
            #     str(line.item_id),
            #     line.quantity,
            #     line.rental_end_date
            # )
            
            details.append({
                "line_id": str(line.id),
                "item_id": str(line.item_id),
                "item_name": line.item.item_name if line.item else "Unknown",
                "current_end_date": line.rental_end_date.isoformat(),
                "can_extend_to": new_end_date.isoformat() if not next_available else None,
                "max_extension_date": next_available.isoformat() if next_available else None,
                "has_conflict": bool(next_available and next_available < new_end_date)
            })
        
        return details