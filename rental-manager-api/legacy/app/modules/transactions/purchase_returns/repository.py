"""
Purchase Returns Repository

Data access layer for purchase return operations.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.transactions.base.models.transaction_headers import TransactionHeader, TransactionType, TransactionStatus
from app.modules.transactions.base.models.transaction_lines import TransactionLine
from app.modules.suppliers.models import Supplier
from app.modules.master_data.item_master.models import Item
from app.modules.customers.models import Customer
from app.shared.repository import BaseRepository
from .schemas import (
    PurchaseReturnFilters,
    ReturnStatus,
    ReturnReason,
    PaymentStatus
)


class PurchaseReturnRepository(BaseRepository[TransactionHeader]):
    """Repository for purchase return operations"""
    
    def __init__(self, session: AsyncSession):
        super().__init__(TransactionHeader, session)
    
    async def get_purchase_returns(
        self,
        filters: PurchaseReturnFilters
    ) -> tuple[List[TransactionHeader], int]:
        """
        Get purchase returns with filtering and pagination.
        
        Args:
            filters: Filter parameters
            
        Returns:
            Tuple of (returns list, total count)
        """
        # Base query for RETURN type transactions
        query = select(TransactionHeader).where(
            TransactionHeader.transaction_type == TransactionType.RETURN
        )
        
        # Apply filters
        conditions = []
        
        if filters.supplier_id:
            conditions.append(TransactionHeader.supplier_id == filters.supplier_id)
        
        if filters.original_purchase_id:
            conditions.append(
                TransactionHeader.metadata_entries.any(
                    key='original_purchase_id',
                    value=str(filters.original_purchase_id)
                )
            )
        
        if filters.status:
            # Map our ReturnStatus to TransactionStatus
            status_map = {
                ReturnStatus.PENDING: TransactionStatus.PENDING,
                ReturnStatus.PROCESSING: TransactionStatus.IN_PROGRESS,
                ReturnStatus.COMPLETED: TransactionStatus.COMPLETED,
                ReturnStatus.CANCELLED: TransactionStatus.CANCELLED
            }
            if filters.status in status_map:
                conditions.append(TransactionHeader.status == status_map[filters.status])
        
        if filters.start_date:
            conditions.append(TransactionHeader.transaction_date >= datetime.combine(filters.start_date, datetime.min.time()))
        
        if filters.end_date:
            conditions.append(TransactionHeader.transaction_date <= datetime.combine(filters.end_date, datetime.max.time()))
        
        if filters.search:
            search_term = f"%{filters.search}%"
            conditions.append(
                or_(
                    TransactionHeader.transaction_number.ilike(search_term),
                    TransactionHeader.notes.ilike(search_term),
                    TransactionHeader.reference_number.ilike(search_term)
                )
            )
        
        if conditions:
            query = query.where(and_(*conditions))
        
        # Include related data
        query = query.options(
            selectinload(TransactionHeader.transaction_lines).selectinload(TransactionLine.item),
            selectinload(TransactionHeader.supplier),
            selectinload(TransactionHeader.metadata_entries)
        )
        
        # Count total before pagination
        count_query = select(func.count()).select_from(TransactionHeader).where(
            TransactionHeader.transaction_type == TransactionType.RETURN
        )
        if conditions:
            count_query = count_query.where(and_(*conditions))
        
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0
        
        # Apply sorting
        sort_field = getattr(TransactionHeader, filters.sort_by, TransactionHeader.transaction_date)
        if filters.sort_order == "asc":
            query = query.order_by(asc(sort_field))
        else:
            query = query.order_by(desc(sort_field))
        
        # Apply pagination
        query = query.offset(filters.skip).limit(filters.limit)
        
        # Execute query
        result = await self.session.execute(query)
        returns = result.scalars().all()
        
        return returns, total
    
    async def get_purchase_return_by_id(self, return_id: UUID) -> Optional[TransactionHeader]:
        """
        Get a single purchase return by ID with all related data.
        
        Args:
            return_id: Return transaction ID
            
        Returns:
            Purchase return transaction or None
        """
        query = select(TransactionHeader).where(
            and_(
                TransactionHeader.id == return_id,
                TransactionHeader.transaction_type == TransactionType.RETURN
            )
        ).options(
            selectinload(TransactionHeader.transaction_lines).selectinload(TransactionLine.item),
            selectinload(TransactionHeader.supplier),
            selectinload(TransactionHeader.customer),
            selectinload(TransactionHeader.metadata_entries)
        )
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def get_returns_by_purchase(self, purchase_id: UUID) -> List[TransactionHeader]:
        """
        Get all returns for a specific purchase.
        
        Args:
            purchase_id: Original purchase ID
            
        Returns:
            List of return transactions
        """
        query = select(TransactionHeader).where(
            and_(
                TransactionHeader.transaction_type == TransactionType.RETURN,
                TransactionHeader.metadata_entries.any(
                    key='original_purchase_id',
                    value=str(purchase_id)
                )
            )
        ).options(
            selectinload(TransactionHeader.transaction_lines).selectinload(TransactionLine.item),
            selectinload(TransactionHeader.supplier)
        )
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_original_purchase(self, purchase_id: UUID) -> Optional[TransactionHeader]:
        """
        Get the original purchase transaction.
        
        Args:
            purchase_id: Purchase transaction ID
            
        Returns:
            Purchase transaction or None
        """
        query = select(TransactionHeader).where(
            and_(
                TransactionHeader.id == purchase_id,
                TransactionHeader.transaction_type == TransactionType.PURCHASE
            )
        ).options(
            selectinload(TransactionHeader.transaction_lines).selectinload(TransactionLine.item),
            selectinload(TransactionHeader.supplier)
        )
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
    
    async def validate_return_quantities(
        self,
        purchase_id: UUID,
        return_items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Validate that return quantities don't exceed purchased quantities.
        
        Args:
            purchase_id: Original purchase ID
            return_items: Items to return with quantities
            
        Returns:
            Validation result with available quantities
        """
        # Get original purchase
        purchase = await self.get_original_purchase(purchase_id)
        if not purchase:
            return {
                "is_valid": False,
                "errors": ["Original purchase not found"],
                "available_items": []
            }
        
        # Get existing returns for this purchase
        existing_returns = await self.get_returns_by_purchase(purchase_id)
        
        # Calculate already returned quantities
        returned_quantities = {}
        for return_txn in existing_returns:
            if return_txn.status != TransactionStatus.CANCELLED:
                for line in return_txn.transaction_lines:
                    if line.item_id not in returned_quantities:
                        returned_quantities[line.item_id] = 0
                    returned_quantities[line.item_id] += line.quantity
        
        # Calculate available quantities
        available_items = []
        errors = []
        
        for line in purchase.transaction_lines:
            already_returned = returned_quantities.get(line.item_id, 0)
            available_qty = line.quantity - already_returned
            
            available_items.append({
                "item_id": str(line.item_id),
                "item_name": line.item.item_name if line.item else "Unknown",
                "original_quantity": line.quantity,
                "already_returned": already_returned,
                "available_quantity": available_qty,
                "unit_cost": float(line.unit_price)
            })
            
            # Check if requested return quantity is valid
            for return_item in return_items:
                if str(return_item.get("item_id")) == str(line.item_id):
                    requested_qty = return_item.get("quantity", 0)
                    if requested_qty > available_qty:
                        errors.append(
                            f"Cannot return {requested_qty} of {line.item.item_name}. "
                            f"Only {available_qty} available for return."
                        )
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "available_items": available_items,
            "warnings": []
        }
    
    async def get_return_analytics(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        supplier_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Get analytics for purchase returns.
        
        Args:
            start_date: Start date for analytics
            end_date: End date for analytics
            supplier_id: Filter by supplier
            
        Returns:
            Analytics data
        """
        # Base conditions
        conditions = [TransactionHeader.transaction_type == TransactionType.RETURN]
        
        if start_date:
            conditions.append(TransactionHeader.transaction_date >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            conditions.append(TransactionHeader.transaction_date <= datetime.combine(end_date, datetime.max.time()))
        if supplier_id:
            conditions.append(TransactionHeader.supplier_id == supplier_id)
        
        # Total returns and amount
        query = select(
            func.count(TransactionHeader.id).label('total_returns'),
            func.sum(TransactionHeader.total_amount).label('total_refund_amount')
        ).where(and_(*conditions))
        
        result = await self.session.execute(query)
        totals = result.first()
        
        # Returns by status
        status_query = select(
            TransactionHeader.status,
            func.count(TransactionHeader.id).label('count')
        ).where(and_(*conditions)).group_by(TransactionHeader.status)
        
        status_result = await self.session.execute(status_query)
        returns_by_status = {str(row.status): row.count for row in status_result}
        
        # Top returned items
        items_query = select(
            TransactionLine.item_id,
            func.sum(TransactionLine.quantity).label('total_quantity'),
            func.count(func.distinct(TransactionHeader.id)).label('return_count')
        ).select_from(TransactionHeader).join(
            TransactionLine, TransactionHeader.id == TransactionLine.transaction_id
        ).where(and_(*conditions)).group_by(
            TransactionLine.item_id
        ).order_by(desc('total_quantity')).limit(10)
        
        items_result = await self.session.execute(items_query)
        top_items = []
        for row in items_result:
            # Get item details
            item_query = select(Item).where(Item.id == row.item_id)
            item_result = await self.session.execute(item_query)
            item = item_result.scalar_one_or_none()
            
            if item:
                top_items.append({
                    "item_id": str(row.item_id),
                    "item_name": item.item_name,
                    "sku": item.sku,
                    "total_quantity": row.total_quantity,
                    "return_count": row.return_count
                })
        
        return {
            "total_returns": totals.total_returns or 0,
            "total_refund_amount": float(totals.total_refund_amount or 0),
            "returns_by_status": returns_by_status,
            "returns_by_reason": {},  # Would need metadata for this
            "top_returned_items": top_items,
            "returns_trend": []  # Would need date grouping for this
        }