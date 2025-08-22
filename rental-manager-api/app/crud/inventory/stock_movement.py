"""
CRUD operations for Stock Movement.

Handles database operations for stock movement tracking.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.inventory.base import CRUDBase
from app.models.inventory.stock_movement import StockMovement
from app.models.inventory.enums import StockMovementType, get_movement_category
from app.schemas.inventory.stock_movement import (
    StockMovementCreate,
    StockMovementUpdate,
    StockMovementFilter
)


class CRUDStockMovement(CRUDBase[StockMovement, StockMovementCreate, StockMovementUpdate]):
    """CRUD operations for stock movements."""
    
    async def create_movement(
        self,
        db: AsyncSession,
        *,
        movement_in: StockMovementCreate,
        performed_by: UUID
    ) -> StockMovement:
        """
        Create a new stock movement with validation.
        
        Args:
            db: Database session
            movement_in: Movement creation data
            performed_by: User performing the movement
            
        Returns:
            Created stock movement
        """
        # Validate the movement math
        movement_in.validate_math()
        
        # Check if adjustment requires approval
        if hasattr(movement_in, 'validate_for_adjustment'):
            movement_in.validate_for_adjustment()
        
        movement_data = movement_in.dict()
        movement_data['performed_by_id'] = performed_by
        
        # Calculate total cost if unit cost provided
        if movement_data.get('unit_cost'):
            movement_data['total_cost'] = (
                abs(movement_data['quantity_change']) * movement_data['unit_cost']
            )
        
        movement = StockMovement(**movement_data)
        movement.validate()
        
        db.add(movement)
        await db.flush()
        await db.refresh(movement)
        
        return movement
    
    async def get_by_stock_level(
        self,
        db: AsyncSession,
        *,
        stock_level_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[StockMovement]:
        """
        Get movements for a specific stock level.
        
        Args:
            db: Database session
            stock_level_id: Stock level ID
            skip: Number to skip
            limit: Maximum to return
            
        Returns:
            List of stock movements
        """
        query = (
            select(StockMovement)
            .where(StockMovement.stock_level_id == stock_level_id)
            .order_by(desc(StockMovement.movement_date))
            .offset(skip)
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_by_item(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        location_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[StockMovement]:
        """
        Get movements for a specific item.
        
        Args:
            db: Database session
            item_id: Item ID
            location_id: Optional location filter
            skip: Number to skip
            limit: Maximum to return
            
        Returns:
            List of stock movements
        """
        query = select(StockMovement).where(StockMovement.item_id == item_id)
        
        if location_id:
            query = query.where(StockMovement.location_id == location_id)
        
        query = (
            query.order_by(desc(StockMovement.movement_date))
            .offset(skip)
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_by_transaction(
        self,
        db: AsyncSession,
        *,
        transaction_header_id: UUID
    ) -> List[StockMovement]:
        """
        Get all movements for a transaction.
        
        Args:
            db: Database session
            transaction_header_id: Transaction header ID
            
        Returns:
            List of stock movements
        """
        query = (
            select(StockMovement)
            .where(StockMovement.transaction_header_id == transaction_header_id)
            .order_by(StockMovement.created_at)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        filter_params: StockMovementFilter,
        skip: int = 0,
        limit: int = 100
    ) -> List[StockMovement]:
        """
        Get filtered stock movements.
        
        Args:
            db: Database session
            filter_params: Filter parameters
            skip: Number to skip
            limit: Maximum to return
            
        Returns:
            List of filtered stock movements
        """
        query = select(StockMovement)
        
        # Apply filters
        if filter_params.item_id:
            query = query.where(StockMovement.item_id == filter_params.item_id)
        
        if filter_params.location_id:
            query = query.where(StockMovement.location_id == filter_params.location_id)
        
        if filter_params.movement_type:
            query = query.where(StockMovement.movement_type == filter_params.movement_type)
        
        if filter_params.movement_category:
            # Get all movement types for this category
            category_types = [
                mt for mt in StockMovementType
                if get_movement_category(mt) == filter_params.movement_category
            ]
            if category_types:
                query = query.where(StockMovement.movement_type.in_(category_types))
        
        if filter_params.date_from:
            query = query.where(StockMovement.movement_date >= filter_params.date_from)
        
        if filter_params.date_to:
            query = query.where(StockMovement.movement_date <= filter_params.date_to)
        
        if filter_params.performed_by_id:
            query = query.where(StockMovement.performed_by_id == filter_params.performed_by_id)
        
        if filter_params.has_transaction is not None:
            if filter_params.has_transaction:
                query = query.where(StockMovement.transaction_header_id.isnot(None))
            else:
                query = query.where(StockMovement.transaction_header_id.is_(None))
        
        if filter_params.min_quantity is not None:
            query = query.where(
                func.abs(StockMovement.quantity_change) >= filter_params.min_quantity
            )
        
        if filter_params.max_quantity is not None:
            query = query.where(
                func.abs(StockMovement.quantity_change) <= filter_params.max_quantity
            )
        
        # Apply ordering and pagination
        query = (
            query.order_by(desc(StockMovement.movement_date))
            .offset(skip)
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_summary(
        self,
        db: AsyncSession,
        *,
        item_id: Optional[UUID] = None,
        location_id: Optional[UUID] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get summary statistics for stock movements.
        
        Args:
            db: Database session
            item_id: Optional item filter
            location_id: Optional location filter
            date_from: Start date filter
            date_to: End date filter
            
        Returns:
            Summary statistics dictionary
        """
        # Base query
        query = select(
            func.count(StockMovement.id).label('total_movements'),
            func.sum(
                func.case(
                    (StockMovement.quantity_change > 0, StockMovement.quantity_change),
                    else_=0
                )
            ).label('total_increase'),
            func.sum(
                func.case(
                    (StockMovement.quantity_change < 0, func.abs(StockMovement.quantity_change)),
                    else_=0
                )
            ).label('total_decrease')
        )
        
        # Apply filters
        if item_id:
            query = query.where(StockMovement.item_id == item_id)
        
        if location_id:
            query = query.where(StockMovement.location_id == location_id)
        
        if date_from:
            query = query.where(StockMovement.movement_date >= date_from)
        
        if date_to:
            query = query.where(StockMovement.movement_date <= date_to)
        
        result = await db.execute(query)
        row = result.first()
        
        # Get movements by type
        type_query = (
            select(
                StockMovement.movement_type,
                func.count(StockMovement.id).label('count'),
                func.sum(func.abs(StockMovement.quantity_change)).label('quantity')
            )
            .group_by(StockMovement.movement_type)
        )
        
        # Apply same filters
        if item_id:
            type_query = type_query.where(StockMovement.item_id == item_id)
        
        if location_id:
            type_query = type_query.where(StockMovement.location_id == location_id)
        
        if date_from:
            type_query = type_query.where(StockMovement.movement_date >= date_from)
        
        if date_to:
            type_query = type_query.where(StockMovement.movement_date <= date_to)
        
        type_result = await db.execute(type_query)
        type_rows = type_result.all()
        
        movements_by_type = {}
        quantity_by_type = {}
        
        for type_row in type_rows:
            movements_by_type[type_row.movement_type.value] = type_row.count
            quantity_by_type[type_row.movement_type.value] = float(type_row.quantity or 0)
        
        return {
            'total_movements': row.total_movements or 0,
            'total_increase': float(row.total_increase or 0),
            'total_decrease': float(row.total_decrease or 0),
            'net_change': float((row.total_increase or 0) - (row.total_decrease or 0)),
            'movements_by_type': movements_by_type,
            'quantity_by_type': quantity_by_type,
            'period_start': date_from,
            'period_end': date_to
        }
    
    async def get_recent_movements(
        self,
        db: AsyncSession,
        *,
        hours: int = 24,
        limit: int = 100
    ) -> List[StockMovement]:
        """
        Get recent movements within specified hours.
        
        Args:
            db: Database session
            hours: Number of hours to look back
            limit: Maximum number of movements
            
        Returns:
            List of recent movements
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        query = (
            select(StockMovement)
            .where(StockMovement.movement_date >= cutoff_time)
            .order_by(desc(StockMovement.movement_date))
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_adjustments_pending_approval(
        self,
        db: AsyncSession
    ) -> List[StockMovement]:
        """
        Get adjustments that are pending approval.
        
        Args:
            db: Database session
            
        Returns:
            List of movements pending approval
        """
        adjustment_types = [
            StockMovementType.ADJUSTMENT_POSITIVE,
            StockMovementType.ADJUSTMENT_NEGATIVE,
            StockMovementType.SYSTEM_CORRECTION
        ]
        
        query = (
            select(StockMovement)
            .where(
                and_(
                    StockMovement.movement_type.in_(adjustment_types),
                    StockMovement.approved_by_id.is_(None)
                )
            )
            .order_by(StockMovement.created_at)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def approve_adjustment(
        self,
        db: AsyncSession,
        *,
        movement_id: UUID,
        approved_by: UUID,
        notes: Optional[str] = None
    ) -> Optional[StockMovement]:
        """
        Approve a pending adjustment.
        
        Args:
            db: Database session
            movement_id: Movement ID to approve
            approved_by: User approving
            notes: Optional approval notes
            
        Returns:
            Approved movement or None
        """
        movement = await self.get(db, id=movement_id)
        
        if not movement:
            return None
        
        movement.approved_by_id = approved_by
        
        if notes:
            current_notes = movement.notes or ""
            movement.notes = f"{current_notes}\nApproved: {notes}".strip()
        
        await db.flush()
        await db.refresh(movement)
        
        return movement
    
    async def create_bulk_movements(
        self,
        db: AsyncSession,
        *,
        movements_in: List[StockMovementCreate],
        performed_by: UUID
    ) -> List[StockMovement]:
        """
        Create multiple movements in bulk.
        
        Args:
            db: Database session
            movements_in: List of movement data
            performed_by: User performing movements
            
        Returns:
            List of created movements
        """
        movements = []
        
        for movement_in in movements_in:
            movement = await self.create_movement(
                db,
                movement_in=movement_in,
                performed_by=performed_by
            )
            movements.append(movement)
        
        return movements


# Create singleton instance
stock_movement = CRUDStockMovement(StockMovement)