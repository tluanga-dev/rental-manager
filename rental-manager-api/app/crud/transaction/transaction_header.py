"""
Transaction Header CRUD operations.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import select, and_, or_, func, update, delete, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.transaction import (
    TransactionHeader, TransactionLine, TransactionType, TransactionStatus,
    PaymentStatus, RentalStatus
)


class TransactionHeaderRepository:
    """Repository for Transaction Header operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(
        self, 
        transaction_id: UUID,
        include_lines: bool = False,
        include_events: bool = False,
        include_metadata: bool = False
    ) -> Optional[TransactionHeader]:
        """Get transaction by ID with optional relationships."""
        query = select(TransactionHeader).where(
            TransactionHeader.id == transaction_id
        )
        
        # Always eager load basic relationships to avoid lazy loading issues
        query = query.options(
            joinedload(TransactionHeader.customer),
            joinedload(TransactionHeader.supplier),  
            joinedload(TransactionHeader.location)
        )
        
        # Add eager loading for collections as needed
        if include_lines:
            # Include item details for each transaction line
            query = query.options(
                selectinload(TransactionHeader.transaction_lines).selectinload(TransactionLine.item),
                selectinload(TransactionHeader.transaction_lines).selectinload(TransactionLine.location)
            )
        if include_events:
            query = query.options(selectinload(TransactionHeader.events))
        if include_metadata:
            query = query.options(selectinload(TransactionHeader.metadata_entries))
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_transaction_number(
        self, 
        transaction_number: str
    ) -> Optional[TransactionHeader]:
        """Get transaction by transaction number."""
        query = select(TransactionHeader).where(
            TransactionHeader.transaction_number == transaction_number
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def list_transactions(
        self,
        transaction_type: Optional[TransactionType] = None,
        status: Optional[TransactionStatus] = None,
        customer_id: Optional[UUID] = None,
        supplier_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None,
        payment_status: Optional[PaymentStatus] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        skip: int = 0,
        limit: int = 100,
        order_by: str = "transaction_date",
        order_desc: bool = True
    ) -> List[TransactionHeader]:
        """List transactions with filtering and pagination."""
        query = select(TransactionHeader)
        
        # Apply filters
        conditions = []
        if transaction_type:
            conditions.append(TransactionHeader.transaction_type == transaction_type)
        if status:
            conditions.append(TransactionHeader.status == status)
        if customer_id:
            conditions.append(TransactionHeader.customer_id == customer_id)
        if supplier_id:
            conditions.append(TransactionHeader.supplier_id == supplier_id)
        if location_id:
            conditions.append(TransactionHeader.location_id == location_id)
        if payment_status:
            conditions.append(TransactionHeader.payment_status == payment_status)
        if date_from:
            conditions.append(TransactionHeader.transaction_date >= date_from)
        if date_to:
            conditions.append(TransactionHeader.transaction_date <= date_to)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        # Apply ordering
        order_column = getattr(TransactionHeader, order_by, TransactionHeader.transaction_date)
        if order_desc:
            query = query.order_by(desc(order_column))
        else:
            query = query.order_by(asc(order_column))
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def create(
        self, 
        transaction: TransactionHeader
    ) -> TransactionHeader:
        """Create a new transaction."""
        self.session.add(transaction)
        await self.session.flush()
        return transaction
    
    async def update(
        self,
        transaction_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[TransactionHeader]:
        """Update transaction fields."""
        # Remove None values
        updates = {k: v for k, v in updates.items() if v is not None}
        
        if not updates:
            return await self.get_by_id(transaction_id)
        
        # Update the transaction
        query = update(TransactionHeader).where(
            TransactionHeader.id == transaction_id
        ).values(**updates)
        
        await self.session.execute(query)
        await self.session.flush()
        
        # Return updated transaction
        return await self.get_by_id(transaction_id)
    
    async def delete(self, transaction_id: UUID) -> bool:
        """Delete a transaction."""
        query = delete(TransactionHeader).where(
            TransactionHeader.id == transaction_id
        )
        result = await self.session.execute(query)
        await self.session.flush()
        return result.rowcount > 0
    
    async def soft_delete(
        self,
        transaction_id: UUID,
        deleted_by: Optional[str] = None
    ) -> Optional[TransactionHeader]:
        """Soft delete a transaction."""
        transaction = await self.get_by_id(transaction_id)
        if transaction:
            transaction.soft_delete(by=deleted_by)
            await self.session.flush()
        return transaction
    
    async def get_overdue_rentals(
        self,
        location_id: Optional[UUID] = None,
        customer_id: Optional[UUID] = None,
        as_of_date: Optional[date] = None
    ) -> List[TransactionHeader]:
        """Get overdue rental transactions."""
        as_of_date = as_of_date or date.today()
        
        query = select(TransactionHeader).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RENTAL,
                TransactionHeader.status.in_([
                    TransactionStatus.IN_PROGRESS,
                    TransactionStatus.PROCESSING
                ]),
                TransactionHeader.is_active == True
            )
        )
        
        # Add filters
        if location_id:
            query = query.where(TransactionHeader.location_id == location_id)
        if customer_id:
            query = query.where(TransactionHeader.customer_id == customer_id)
        
        # Execute and filter by rental end date
        result = await self.session.execute(query)
        transactions = result.scalars().all()
        
        # Filter overdue transactions
        overdue = []
        for tx in transactions:
            if tx.rental_end_date and tx.rental_end_date < as_of_date:
                overdue.append(tx)
        
        return overdue
    
    async def get_transaction_totals(
        self,
        transaction_type: Optional[TransactionType] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        location_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Get aggregated transaction totals."""
        query = select(
            func.count(TransactionHeader.id).label("count"),
            func.sum(TransactionHeader.total_amount).label("total_amount"),
            func.sum(TransactionHeader.paid_amount).label("paid_amount"),
            func.sum(TransactionHeader.tax_amount).label("tax_amount"),
            func.sum(TransactionHeader.discount_amount).label("discount_amount")
        )
        
        # Apply filters
        conditions = [TransactionHeader.is_active == True]
        if transaction_type:
            conditions.append(TransactionHeader.transaction_type == transaction_type)
        if date_from:
            conditions.append(TransactionHeader.transaction_date >= date_from)
        if date_to:
            conditions.append(TransactionHeader.transaction_date <= date_to)
        if location_id:
            conditions.append(TransactionHeader.location_id == location_id)
        
        query = query.where(and_(*conditions))
        
        result = await self.session.execute(query)
        row = result.one()
        
        return {
            "count": row.count or 0,
            "total_amount": row.total_amount or Decimal("0.00"),
            "paid_amount": row.paid_amount or Decimal("0.00"),
            "tax_amount": row.tax_amount or Decimal("0.00"),
            "discount_amount": row.discount_amount or Decimal("0.00"),
            "outstanding_amount": (row.total_amount or Decimal("0.00")) - (row.paid_amount or Decimal("0.00"))
        }
    
    async def search_transactions(
        self,
        search_term: str,
        transaction_type: Optional[TransactionType] = None,
        limit: int = 50
    ) -> List[TransactionHeader]:
        """Search transactions by various fields."""
        # Create search conditions
        search_conditions = or_(
            TransactionHeader.transaction_number.ilike(f"%{search_term}%"),
            TransactionHeader.reference_number.ilike(f"%{search_term}%"),
            TransactionHeader.notes.ilike(f"%{search_term}%"),
            TransactionHeader.payment_reference.ilike(f"%{search_term}%")
        )
        
        query = select(TransactionHeader).where(
            and_(
                search_conditions,
                TransactionHeader.is_active == True
            )
        )
        
        if transaction_type:
            query = query.where(TransactionHeader.transaction_type == transaction_type)
        
        query = query.order_by(desc(TransactionHeader.transaction_date)).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_customer_transaction_history(
        self,
        customer_id: UUID,
        transaction_type: Optional[TransactionType] = None,
        limit: int = 100
    ) -> List[TransactionHeader]:
        """Get transaction history for a customer."""
        query = select(TransactionHeader).where(
            and_(
                TransactionHeader.customer_id == customer_id,
                TransactionHeader.is_active == True
            )
        )
        
        if transaction_type:
            query = query.where(TransactionHeader.transaction_type == transaction_type)
        
        query = query.order_by(desc(TransactionHeader.transaction_date)).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_supplier_transaction_history(
        self,
        supplier_id: UUID,
        transaction_type: Optional[TransactionType] = None,
        limit: int = 100
    ) -> List[TransactionHeader]:
        """Get transaction history for a supplier."""
        query = select(TransactionHeader).where(
            and_(
                TransactionHeader.supplier_id == supplier_id,
                TransactionHeader.is_active == True
            )
        )
        
        if transaction_type:
            query = query.where(TransactionHeader.transaction_type == transaction_type)
        
        query = query.order_by(desc(TransactionHeader.transaction_date)).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def update_payment_status(
        self,
        transaction_id: UUID,
        amount_paid: Decimal,
        payment_method: str,
        payment_reference: Optional[str] = None,
        updated_by: Optional[str] = None
    ) -> Optional[TransactionHeader]:
        """Update payment status and amount for a transaction."""
        transaction = await self.get_by_id(transaction_id)
        if not transaction:
            return None
        
        # Update payment
        transaction.add_payment(amount_paid, updated_by=updated_by)
        transaction.payment_method = payment_method
        if payment_reference:
            transaction.payment_reference = payment_reference
        
        await self.session.flush()
        return transaction
    
    async def count_transactions(
        self,
        transaction_type: Optional[TransactionType] = None,
        status: Optional[TransactionStatus] = None,
        customer_id: Optional[UUID] = None,
        supplier_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None
    ) -> int:
        """Count transactions with filters."""
        query = select(func.count(TransactionHeader.id))
        
        # Apply filters
        conditions = [TransactionHeader.is_active == True]
        if transaction_type:
            conditions.append(TransactionHeader.transaction_type == transaction_type)
        if status:
            conditions.append(TransactionHeader.status == status)
        if customer_id:
            conditions.append(TransactionHeader.customer_id == customer_id)
        if supplier_id:
            conditions.append(TransactionHeader.supplier_id == supplier_id)
        if location_id:
            conditions.append(TransactionHeader.location_id == location_id)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        result = await self.session.execute(query)
        return result.scalar() or 0