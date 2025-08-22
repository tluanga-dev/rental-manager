"""
Transaction Line CRUD operations.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select, and_, or_, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.transaction import TransactionLine, LineItemType, RentalStatus


class TransactionLineRepository:
    """Repository for Transaction Line operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(
        self, 
        line_id: UUID,
        include_transaction: bool = False
    ) -> Optional[TransactionLine]:
        """Get transaction line by ID."""
        query = select(TransactionLine).where(
            TransactionLine.id == line_id
        )
        
        if include_transaction:
            query = query.options(selectinload(TransactionLine.transaction))
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_transaction_id(
        self,
        transaction_id: UUID,
        include_item: bool = False
    ) -> List[TransactionLine]:
        """Get all lines for a transaction."""
        query = select(TransactionLine).where(
            TransactionLine.transaction_header_id == transaction_id
        ).order_by(TransactionLine.line_number)
        
        if include_item:
            query = query.options(selectinload(TransactionLine.item))
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def create(
        self,
        transaction_line: TransactionLine
    ) -> TransactionLine:
        """Create a new transaction line."""
        self.session.add(transaction_line)
        await self.session.flush()
        return transaction_line
    
    async def create_batch(
        self,
        transaction_lines: List[TransactionLine]
    ) -> List[TransactionLine]:
        """Create multiple transaction lines."""
        self.session.add_all(transaction_lines)
        await self.session.flush()
        return transaction_lines
    
    async def update(
        self,
        line_id: UUID,
        updates: Dict[str, Any]
    ) -> Optional[TransactionLine]:
        """Update transaction line fields."""
        # Remove None values
        updates = {k: v for k, v in updates.items() if v is not None}
        
        if not updates:
            return await self.get_by_id(line_id)
        
        query = update(TransactionLine).where(
            TransactionLine.id == line_id
        ).values(**updates)
        
        await self.session.execute(query)
        await self.session.flush()
        
        return await self.get_by_id(line_id)
    
    async def delete(self, line_id: UUID) -> bool:
        """Delete a transaction line."""
        query = delete(TransactionLine).where(
            TransactionLine.id == line_id
        )
        result = await self.session.execute(query)
        await self.session.flush()
        return result.rowcount > 0
    
    async def delete_by_transaction_id(
        self,
        transaction_id: UUID
    ) -> int:
        """Delete all lines for a transaction."""
        query = delete(TransactionLine).where(
            TransactionLine.transaction_header_id == transaction_id
        )
        result = await self.session.execute(query)
        await self.session.flush()
        return result.rowcount
    
    async def get_rental_lines_by_status(
        self,
        rental_status: RentalStatus,
        location_id: Optional[UUID] = None,
        limit: int = 100
    ) -> List[TransactionLine]:
        """Get rental lines by status."""
        query = select(TransactionLine).where(
            TransactionLine.current_rental_status == rental_status
        )
        
        if location_id:
            query = query.where(TransactionLine.location_id == location_id)
        
        query = query.limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_overdue_rental_lines(
        self,
        as_of_date: Optional[date] = None,
        location_id: Optional[UUID] = None
    ) -> List[TransactionLine]:
        """Get overdue rental lines."""
        as_of_date = as_of_date or date.today()
        
        query = select(TransactionLine).where(
            and_(
                TransactionLine.rental_end_date < as_of_date,
                TransactionLine.returned_quantity < TransactionLine.quantity,
                TransactionLine.current_rental_status.in_([
                    RentalStatus.RENTAL_INPROGRESS,
                    RentalStatus.RENTAL_EXTENDED,
                    RentalStatus.RENTAL_PARTIAL_RETURN
                ])
            )
        )
        
        if location_id:
            query = query.where(TransactionLine.location_id == location_id)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_item_transaction_history(
        self,
        item_id: UUID,
        limit: int = 100
    ) -> List[TransactionLine]:
        """Get transaction history for an item."""
        query = select(TransactionLine).where(
            TransactionLine.item_id == item_id
        ).order_by(TransactionLine.created_at.desc()).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def update_return_status(
        self,
        line_id: UUID,
        returned_quantity: Decimal,
        return_condition: str,
        return_date: date,
        notes: Optional[str] = None,
        updated_by: Optional[str] = None
    ) -> Optional[TransactionLine]:
        """Update return status for a line."""
        line = await self.get_by_id(line_id)
        if not line:
            return None
        
        line.process_return(
            return_quantity=returned_quantity,
            return_condition=return_condition,
            notes=notes,
            updated_by=updated_by
        )
        line.return_date = return_date
        
        await self.session.flush()
        return line
    
    async def calculate_line_totals(
        self,
        transaction_id: UUID
    ) -> Dict[str, Decimal]:
        """Calculate totals for all lines in a transaction."""
        query = select(
            func.sum(TransactionLine.quantity).label("total_quantity"),
            func.sum(TransactionLine.line_total).label("total_amount"),
            func.sum(TransactionLine.tax_amount).label("total_tax"),
            func.sum(TransactionLine.discount_amount).label("total_discount")
        ).where(TransactionLine.transaction_header_id == transaction_id)
        
        result = await self.session.execute(query)
        row = result.one()
        
        return {
            "total_quantity": row.total_quantity or Decimal("0.00"),
            "total_amount": row.total_amount or Decimal("0.00"),
            "total_tax": row.total_tax or Decimal("0.00"),
            "total_discount": row.total_discount or Decimal("0.00")
        }
    
    async def get_lines_by_sku(
        self,
        sku: str,
        transaction_id: Optional[UUID] = None
    ) -> List[TransactionLine]:
        """Get lines by SKU."""
        query = select(TransactionLine).where(
            TransactionLine.sku == sku
        )
        
        if transaction_id:
            query = query.where(
                TransactionLine.transaction_header_id == transaction_id
            )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_pending_fulfillment_lines(
        self,
        location_id: Optional[UUID] = None,
        limit: int = 100
    ) -> List[TransactionLine]:
        """Get lines pending fulfillment."""
        query = select(TransactionLine).where(
            TransactionLine.fulfillment_status == "PENDING"
        )
        
        if location_id:
            query = query.where(TransactionLine.location_id == location_id)
        
        query = query.limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def update_fulfillment_status(
        self,
        line_id: UUID,
        fulfillment_status: str,
        warehouse_location: Optional[str] = None,
        updated_by: Optional[str] = None
    ) -> Optional[TransactionLine]:
        """Update fulfillment status for a line."""
        updates = {
            "fulfillment_status": fulfillment_status,
            "updated_by": updated_by,
            "updated_at": date.today()
        }
        
        if warehouse_location:
            updates["warehouse_location"] = warehouse_location
        
        return await self.update(line_id, updates)