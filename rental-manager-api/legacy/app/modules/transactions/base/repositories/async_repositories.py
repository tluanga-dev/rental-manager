"""
Async versions of transaction repositories for use with AsyncSession.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.modules.transactions.base.models import TransactionHeader, TransactionLine
from app.modules.transactions.base.models.transaction_headers import TransactionStatus, TransactionType


class AsyncTransactionHeaderRepository:
    """
    Async CRUD operations for TransactionHeader.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, obj_in: Dict[str, Any]) -> TransactionHeader:
        """Create a new TransactionHeader."""
        db_obj = TransactionHeader(**obj_in)
        self.session.add(db_obj)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def get_by_id(self, transaction_id: UUID) -> Optional[TransactionHeader]:
        """Get transaction by ID."""
        stmt = select(TransactionHeader).where(TransactionHeader.id == transaction_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_with_lines(self, transaction_id: UUID) -> Optional[TransactionHeader]:
        """Get transaction header with lines."""
        stmt = (
            select(TransactionHeader)
            .options(selectinload(TransactionHeader.transaction_lines))
            .where(TransactionHeader.id == transaction_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_number(self, transaction_number: str) -> Optional[TransactionHeader]:
        """Get transaction by number."""
        stmt = select(TransactionHeader).where(
            TransactionHeader.transaction_number == transaction_number
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update(self, db_obj: TransactionHeader, updates: Dict[str, Any]) -> TransactionHeader:
        """Update transaction header."""
        for k, v in updates.items():
            setattr(db_obj, k, v)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete(self, db_obj: TransactionHeader) -> None:
        """Delete transaction header."""
        await self.session.delete(db_obj)
        await self.session.commit()

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        transaction_type: Optional[TransactionType] = None,
        status: Optional[TransactionStatus] = None,
        status_list: Optional[List[TransactionStatus]] = None,
        payment_status: Optional[str] = None,
        customer_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[TransactionHeader]:
        """Get all transactions with optional filtering."""
        stmt = select(TransactionHeader).where(TransactionHeader.is_active == True)
        
        if transaction_type:
            stmt = stmt.where(TransactionHeader.transaction_type == transaction_type)
        if status:
            stmt = stmt.where(TransactionHeader.status == status)
        if status_list:
            stmt = stmt.where(TransactionHeader.status.in_(status_list))
        if payment_status:
            stmt = stmt.where(TransactionHeader.payment_status == payment_status)
        if customer_id:
            stmt = stmt.where(TransactionHeader.customer_id == str(customer_id))
        if location_id:
            stmt = stmt.where(TransactionHeader.location_id == str(location_id))
        if date_from:
            stmt = stmt.where(TransactionHeader.transaction_date >= date_from)
        if date_to:
            stmt = stmt.where(TransactionHeader.transaction_date <= date_to)
        
        stmt = stmt.order_by(TransactionHeader.transaction_date.desc()).offset(skip).limit(limit)
        
        result = await self.session.execute(stmt)
        return result.scalars().all()


class AsyncTransactionLineRepository:
    """
    Async CRUD operations for TransactionLine.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, obj_in: Dict[str, Any]) -> TransactionLine:
        """Create a new TransactionLine."""
        db_obj = TransactionLine(**obj_in)
        self.session.add(db_obj)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def get_by_id(self, line_id: UUID) -> Optional[TransactionLine]:
        """Get transaction line by ID."""
        stmt = select(TransactionLine).where(TransactionLine.id == line_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_transaction_id(self, transaction_id: UUID) -> List[TransactionLine]:
        """Get all lines for a transaction."""
        stmt = select(TransactionLine).where(
            TransactionLine.transaction_id == transaction_id
        ).order_by(TransactionLine.line_number)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update(self, db_obj: TransactionLine, updates: Dict[str, Any]) -> TransactionLine:
        """Update transaction line."""
        for k, v in updates.items():
            setattr(db_obj, k, v)
        await self.session.commit()
        await self.session.refresh(db_obj)
        return db_obj

    async def delete(self, db_obj: TransactionLine) -> None:
        """Delete transaction line."""
        await self.session.delete(db_obj)
        await self.session.commit()