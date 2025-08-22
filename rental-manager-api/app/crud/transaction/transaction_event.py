"""
Transaction Event CRUD operations.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, date
from sqlalchemy import select, and_, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import TransactionEvent


class TransactionEventRepository:
    """Repository for Transaction Event operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(
        self,
        transaction_id: UUID,
        event_type: str,
        description: str,
        event_category: str = "GENERAL",
        event_data: Optional[Dict[str, Any]] = None,
        user_id: Optional[UUID] = None,
        status: str = "SUCCESS",
        **kwargs
    ) -> TransactionEvent:
        """Create a new transaction event."""
        event = TransactionEvent(
            transaction_id=transaction_id,
            event_type=event_type,
            description=description,
            event_category=event_category,
            event_data=event_data or {},
            user_id=user_id,
            status=status,
            **kwargs
        )
        self.session.add(event)
        await self.session.flush()
        return event
    
    async def create_transaction_event(
        self,
        transaction_id: UUID,
        event_type: str,
        description: str,
        user_id: Optional[UUID] = None,
        operation: Optional[str] = None,
        duration_ms: Optional[int] = None
    ) -> TransactionEvent:
        """Create a standard transaction event."""
        event = TransactionEvent.create_transaction_event(
            transaction_id=transaction_id,
            event_type=event_type,
            description=description,
            user_id=user_id,
            operation=operation,
            duration_ms=duration_ms
        )
        self.session.add(event)
        await self.session.flush()
        return event
    
    async def create_inventory_event(
        self,
        transaction_id: UUID,
        event_type: str,
        item_id: UUID,
        item_name: str,
        quantity_change: str,
        location_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None
    ) -> TransactionEvent:
        """Create an inventory-related event."""
        event = TransactionEvent.create_inventory_event(
            transaction_id=transaction_id,
            event_type=event_type,
            item_id=item_id,
            item_name=item_name,
            quantity_change=quantity_change,
            location_id=location_id,
            user_id=user_id
        )
        self.session.add(event)
        await self.session.flush()
        return event
    
    async def create_payment_event(
        self,
        transaction_id: UUID,
        event_type: str,
        amount: str,
        payment_method: str,
        payment_status: str,
        reference: Optional[str] = None,
        user_id: Optional[UUID] = None
    ) -> TransactionEvent:
        """Create a payment-related event."""
        event = TransactionEvent.create_payment_event(
            transaction_id=transaction_id,
            event_type=event_type,
            amount=amount,
            payment_method=payment_method,
            payment_status=payment_status,
            reference=reference,
            user_id=user_id
        )
        self.session.add(event)
        await self.session.flush()
        return event
    
    async def create_error_event(
        self,
        transaction_id: UUID,
        error_type: str,
        error_message: str,
        error_code: Optional[str] = None,
        error_data: Optional[Dict[str, Any]] = None,
        user_id: Optional[UUID] = None
    ) -> TransactionEvent:
        """Create an error event."""
        event = TransactionEvent.create_error_event(
            transaction_id=transaction_id,
            error_type=error_type,
            error_message=error_message,
            error_code=error_code,
            error_data=error_data,
            user_id=user_id
        )
        self.session.add(event)
        await self.session.flush()
        return event
    
    async def get_by_transaction_id(
        self,
        transaction_id: UUID,
        event_type: Optional[str] = None,
        event_category: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[TransactionEvent]:
        """Get events for a transaction."""
        query = select(TransactionEvent).where(
            TransactionEvent.transaction_id == transaction_id
        )
        
        # Apply filters
        if event_type:
            query = query.where(TransactionEvent.event_type == event_type)
        if event_category:
            query = query.where(TransactionEvent.event_category == event_category)
        if status:
            query = query.where(TransactionEvent.status == status)
        
        query = query.order_by(TransactionEvent.event_timestamp.desc()).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_by_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
        event_category: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[TransactionEvent]:
        """Get events within a date range."""
        query = select(TransactionEvent).where(
            and_(
                TransactionEvent.event_timestamp >= start_date,
                TransactionEvent.event_timestamp <= end_date
            )
        )
        
        if event_category:
            query = query.where(TransactionEvent.event_category == event_category)
        if status:
            query = query.where(TransactionEvent.status == status)
        
        query = query.order_by(TransactionEvent.event_timestamp.desc())
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_error_events(
        self,
        transaction_id: Optional[UUID] = None,
        limit: int = 100
    ) -> List[TransactionEvent]:
        """Get error events."""
        query = select(TransactionEvent).where(
            TransactionEvent.event_category == "ERROR"
        )
        
        if transaction_id:
            query = query.where(TransactionEvent.transaction_id == transaction_id)
        
        query = query.order_by(TransactionEvent.event_timestamp.desc()).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def count_events_by_category(
        self,
        transaction_id: UUID
    ) -> Dict[str, int]:
        """Count events by category for a transaction."""
        query = select(
            TransactionEvent.event_category,
            func.count(TransactionEvent.id).label("count")
        ).where(
            TransactionEvent.transaction_id == transaction_id
        ).group_by(TransactionEvent.event_category)
        
        result = await self.session.execute(query)
        return {row.event_category: row.count for row in result}
    
    async def delete_old_events(
        self,
        older_than: datetime,
        event_category: Optional[str] = None
    ) -> int:
        """Delete events older than specified date."""
        query = delete(TransactionEvent).where(
            TransactionEvent.event_timestamp < older_than
        )
        
        if event_category:
            query = query.where(TransactionEvent.event_category == event_category)
        
        result = await self.session.execute(query)
        await self.session.flush()
        return result.rowcount