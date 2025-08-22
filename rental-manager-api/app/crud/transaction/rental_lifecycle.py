"""
Rental Lifecycle CRUD operations.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import select, and_, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.transaction import (
    RentalLifecycle, RentalReturnEvent, RentalItemInspection,
    RentalStatusLog, ReturnEventType
)


class RentalLifecycleRepository:
    """Repository for Rental Lifecycle operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(
        self,
        transaction_id: UUID,
        current_status: str,
        expected_return_date: Optional[date] = None,
        notes: Optional[str] = None
    ) -> RentalLifecycle:
        """Create a new rental lifecycle."""
        lifecycle = RentalLifecycle(
            transaction_id=transaction_id,
            current_status=current_status,
            expected_return_date=expected_return_date,
            notes=notes
        )
        self.session.add(lifecycle)
        await self.session.flush()
        return lifecycle
    
    async def get_by_transaction_id(
        self,
        transaction_id: UUID,
        include_events: bool = False
    ) -> Optional[RentalLifecycle]:
        """Get rental lifecycle by transaction ID."""
        query = select(RentalLifecycle).where(
            RentalLifecycle.transaction_id == transaction_id
        )
        
        if include_events:
            query = query.options(selectinload(RentalLifecycle.return_events))
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def update_status(
        self,
        lifecycle_id: UUID,
        new_status: str,
        changed_by: Optional[UUID] = None,
        notes: Optional[str] = None
    ) -> Optional[RentalLifecycle]:
        """Update rental status."""
        lifecycle = await self.session.get(RentalLifecycle, lifecycle_id)
        if not lifecycle:
            return None
        
        lifecycle.update_status(new_status, changed_by)
        if notes:
            lifecycle.notes = notes
        
        await self.session.flush()
        return lifecycle
    
    async def add_fees(
        self,
        lifecycle_id: UUID,
        late_fees: Decimal = Decimal("0.00"),
        damage_fees: Decimal = Decimal("0.00"),
        other_fees: Decimal = Decimal("0.00")
    ) -> Optional[RentalLifecycle]:
        """Add fees to rental."""
        lifecycle = await self.session.get(RentalLifecycle, lifecycle_id)
        if not lifecycle:
            return None
        
        lifecycle.add_fees(late_fees, damage_fees, other_fees)
        await self.session.flush()
        return lifecycle
    
    async def create_return_event(
        self,
        lifecycle_id: UUID,
        event_type: str,
        event_date: date,
        items_returned: Optional[List[Dict]] = None,
        total_quantity_returned: Decimal = Decimal("0.00"),
        processed_by: Optional[UUID] = None,
        **kwargs
    ) -> RentalReturnEvent:
        """Create a return event."""
        event = RentalReturnEvent(
            rental_lifecycle_id=lifecycle_id,
            event_type=event_type,
            event_date=event_date,
            items_returned=items_returned or [],
            total_quantity_returned=total_quantity_returned,
            processed_by=processed_by,
            **kwargs
        )
        self.session.add(event)
        await self.session.flush()
        return event
    
    async def get_return_events(
        self,
        lifecycle_id: UUID,
        event_type: Optional[str] = None
    ) -> List[RentalReturnEvent]:
        """Get return events for a rental."""
        query = select(RentalReturnEvent).where(
            RentalReturnEvent.rental_lifecycle_id == lifecycle_id
        )
        
        if event_type:
            query = query.where(RentalReturnEvent.event_type == event_type)
        
        query = query.order_by(RentalReturnEvent.event_date.desc())
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def create_item_inspection(
        self,
        return_event_id: UUID,
        transaction_line_id: UUID,
        quantity_inspected: Decimal,
        condition: str,
        inspected_by: Optional[UUID] = None,
        **kwargs
    ) -> RentalItemInspection:
        """Create an item inspection record."""
        inspection = RentalItemInspection(
            return_event_id=return_event_id,
            transaction_line_id=transaction_line_id,
            quantity_inspected=quantity_inspected,
            condition=condition,
            inspected_by=inspected_by,
            **kwargs
        )
        self.session.add(inspection)
        await self.session.flush()
        return inspection
    
    async def get_item_inspections(
        self,
        return_event_id: UUID
    ) -> List[RentalItemInspection]:
        """Get item inspections for a return event."""
        query = select(RentalItemInspection).where(
            RentalItemInspection.return_event_id == return_event_id
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def create_status_log(
        self,
        transaction_id: UUID,
        new_status: str,
        change_reason: str,
        old_status: Optional[str] = None,
        transaction_line_id: Optional[UUID] = None,
        rental_lifecycle_id: Optional[UUID] = None,
        changed_by: Optional[UUID] = None,
        **kwargs
    ) -> RentalStatusLog:
        """Create a status change log entry."""
        log = RentalStatusLog(
            transaction_id=transaction_id,
            new_status=new_status,
            change_reason=change_reason,
            old_status=old_status,
            transaction_line_id=transaction_line_id,
            rental_lifecycle_id=rental_lifecycle_id,
            changed_by=changed_by,
            **kwargs
        )
        self.session.add(log)
        await self.session.flush()
        return log
    
    async def get_status_logs(
        self,
        transaction_id: UUID,
        transaction_line_id: Optional[UUID] = None
    ) -> List[RentalStatusLog]:
        """Get status change logs."""
        query = select(RentalStatusLog).where(
            RentalStatusLog.transaction_id == transaction_id
        )
        
        if transaction_line_id:
            query = query.where(
                RentalStatusLog.transaction_line_id == transaction_line_id
            )
        
        query = query.order_by(RentalStatusLog.changed_at.desc())
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_overdue_rentals(
        self,
        as_of_date: Optional[date] = None
    ) -> List[RentalLifecycle]:
        """Get overdue rental lifecycles."""
        as_of_date = as_of_date or date.today()
        
        query = select(RentalLifecycle).where(
            and_(
                RentalLifecycle.expected_return_date < as_of_date,
                RentalLifecycle.current_status.in_([
                    "RENTAL_INPROGRESS",
                    "RENTAL_EXTENDED",
                    "RENTAL_PARTIAL_RETURN"
                ])
            )
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def calculate_total_fees(
        self,
        lifecycle_id: UUID
    ) -> Dict[str, Decimal]:
        """Calculate total fees for a rental."""
        lifecycle = await self.session.get(RentalLifecycle, lifecycle_id)
        if not lifecycle:
            return {
                "late_fees": Decimal("0.00"),
                "damage_fees": Decimal("0.00"),
                "other_fees": Decimal("0.00"),
                "total_fees": Decimal("0.00")
            }
        
        return {
            "late_fees": lifecycle.total_late_fees,
            "damage_fees": lifecycle.total_damage_fees,
            "other_fees": lifecycle.total_other_fees,
            "total_fees": lifecycle.total_fees
        }
    
    async def process_extension(
        self,
        lifecycle_id: UUID,
        new_return_date: date,
        extension_reason: Optional[str] = None,
        processed_by: Optional[UUID] = None
    ) -> Optional[RentalReturnEvent]:
        """Process a rental extension."""
        lifecycle = await self.session.get(RentalLifecycle, lifecycle_id)
        if not lifecycle:
            return None
        
        # Create extension event
        event = await self.create_return_event(
            lifecycle_id=lifecycle_id,
            event_type=ReturnEventType.EXTENSION.value,
            event_date=date.today(),
            new_return_date=new_return_date,
            extension_reason=extension_reason,
            processed_by=processed_by
        )
        
        # Update expected return date
        lifecycle.expected_return_date = new_return_date
        lifecycle.current_status = "RENTAL_EXTENDED"
        
        await self.session.flush()
        return event