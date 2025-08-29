"""
CRUD operations for Stock Level.

Handles database operations for stock level management with atomic updates.
"""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from decimal import Decimal
from datetime import datetime

from sqlalchemy import select, and_, or_, func, update, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.crud.inventory.base import CRUDBase
from app.models.inventory.stock_level import StockLevel
from app.models.inventory.stock_movement import StockMovement
from app.models.inventory.enums import StockStatus, StockMovementType
from app.schemas.inventory.stock_level import (
    StockLevelCreate,
    StockLevelUpdate,
    StockLevelFilter,
    StockAdjustment,
    StockReservation,
    RentalOperation,
    RentalReturn,
    StockTransfer
)


class CRUDStockLevel(CRUDBase[StockLevel, StockLevelCreate, StockLevelUpdate]):
    """CRUD operations for stock levels with atomic updates."""
    
    async def get_or_create(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        location_id: UUID,
        created_by: Optional[UUID] = None
    ) -> StockLevel:
        """
        Get existing stock level or create new one.
        
        Args:
            db: Database session
            item_id: Item ID
            location_id: Location ID
            created_by: User creating the record
            
        Returns:
            Stock level instance
        """
        # Try to get existing
        query = select(StockLevel).where(
            and_(
                StockLevel.item_id == item_id,
                StockLevel.location_id == location_id
            )
        )
        
        result = await db.execute(query)
        stock_level = result.scalar_one_or_none()
        
        if stock_level:
            return stock_level
        
        # Create new
        try:
            stock_level = StockLevel(
                item_id=item_id,
                location_id=location_id,
                quantity_on_hand=Decimal("0"),
                quantity_available=Decimal("0"),
                quantity_reserved=Decimal("0"),
                quantity_on_rent=Decimal("0"),
                quantity_damaged=Decimal("0"),
                quantity_under_repair=Decimal("0"),
                quantity_beyond_repair=Decimal("0")
            )
            
            if created_by:
                stock_level.created_by = created_by
                stock_level.updated_by = created_by
            
            db.add(stock_level)
            await db.flush()
            await db.refresh(stock_level)
            
            return stock_level
            
        except IntegrityError:
            # Race condition - another process created it
            await db.rollback()
            result = await db.execute(query)
            return result.scalar_one()
    
    async def adjust_quantity(
        self,
        db: AsyncSession,
        *,
        stock_level_id: UUID,
        adjustment: StockAdjustment,
        performed_by: UUID
    ) -> Tuple[StockLevel, StockMovement]:
        """
        Adjust stock quantity with movement tracking.
        
        Args:
            db: Database session
            stock_level_id: Stock level ID
            adjustment: Adjustment details
            performed_by: User performing adjustment
            
        Returns:
            Tuple of updated stock level and created movement
        """
        # Get stock level with lock
        query = (
            select(StockLevel)
            .where(StockLevel.id == stock_level_id)
            .with_for_update()
        )
        
        result = await db.execute(query)
        stock_level = result.scalar_one_or_none()
        
        if not stock_level:
            raise ValueError(f"Stock level {stock_level_id} not found")
        
        # Store before values
        quantity_before = stock_level.quantity_on_hand
        
        # Perform adjustment
        stock_level.adjust_quantity(
            adjustment.adjustment,
            affect_available=adjustment.affect_available
        )
        
        # Determine movement type
        if adjustment.adjustment > 0:
            movement_type = StockMovementType.ADJUSTMENT_POSITIVE
        else:
            movement_type = StockMovementType.ADJUSTMENT_NEGATIVE
        
        # Create movement record
        movement = StockMovement(
            stock_level_id=stock_level_id,
            item_id=stock_level.item_id,
            location_id=stock_level.location_id,
            movement_type=movement_type,
            quantity_change=adjustment.adjustment,
            quantity_before=quantity_before,
            quantity_after=stock_level.quantity_on_hand,
            reason=adjustment.reason,
            notes=adjustment.notes,
            performed_by_id=adjustment.performed_by_id,  # Use adjustment's performed_by_id (None for dev mode)
            movement_date=datetime.utcnow()
        )
        
        db.add(movement)
        await db.flush()
        await db.refresh(stock_level)
        await db.refresh(movement)
        
        return stock_level, movement
    
    async def reserve_stock(
        self,
        db: AsyncSession,
        *,
        stock_level_id: UUID,
        reservation: StockReservation,
        performed_by: UUID
    ) -> StockLevel:
        """
        Reserve stock for a transaction.
        
        Args:
            db: Database session
            stock_level_id: Stock level ID
            reservation: Reservation details
            performed_by: User performing reservation
            
        Returns:
            Updated stock level
        """
        # Get stock level with lock
        query = (
            select(StockLevel)
            .where(StockLevel.id == stock_level_id)
            .with_for_update()
        )
        
        result = await db.execute(query)
        stock_level = result.scalar_one_or_none()
        
        if not stock_level:
            raise ValueError(f"Stock level {stock_level_id} not found")
        
        # Reserve quantity
        stock_level.reserve_quantity(reservation.quantity)
        
        # Create movement record
        movement = StockMovement(
            stock_level_id=stock_level_id,
            item_id=stock_level.item_id,
            location_id=stock_level.location_id,
            movement_type=StockMovementType.RESERVATION_CREATED,
            quantity_change=Decimal("0"),  # No actual change, just allocation
            quantity_before=stock_level.quantity_on_hand,
            quantity_after=stock_level.quantity_on_hand,
            notes=f"Reserved {reservation.quantity} units",
            performed_by_id=performed_by,
            transaction_header_id=reservation.transaction_id
        )
        
        db.add(movement)
        await db.flush()
        await db.refresh(stock_level)
        
        return stock_level
    
    async def process_rental_out(
        self,
        db: AsyncSession,
        *,
        stock_level_id: UUID,
        rental: RentalOperation,
        performed_by: UUID
    ) -> Tuple[StockLevel, StockMovement]:
        """
        Process rental out operation.
        
        Args:
            db: Database session
            stock_level_id: Stock level ID
            rental: Rental operation details
            performed_by: User performing operation
            
        Returns:
            Tuple of updated stock level and movement
        """
        # Get stock level with lock
        query = (
            select(StockLevel)
            .where(StockLevel.id == stock_level_id)
            .with_for_update()
        )
        
        result = await db.execute(query)
        stock_level = result.scalar_one_or_none()
        
        if not stock_level:
            raise ValueError(f"Stock level {stock_level_id} not found")
        
        # Store before values
        quantity_before = stock_level.quantity_on_hand
        
        # Process rental
        stock_level.rent_out_quantity(rental.quantity)
        
        # Create movement
        movement = StockMovement.create_rental_out_movement(
            stock_level_id=stock_level_id,
            item_id=stock_level.item_id,
            location_id=stock_level.location_id,
            quantity=rental.quantity,
            quantity_before=quantity_before,
            transaction_header_id=rental.transaction_id,
            performed_by_id=performed_by
        )
        
        db.add(movement)
        await db.flush()
        await db.refresh(stock_level)
        await db.refresh(movement)
        
        return stock_level, movement
    
    async def process_rental_return(
        self,
        db: AsyncSession,
        *,
        stock_level_id: UUID,
        rental_return: RentalReturn,
        performed_by: UUID
    ) -> Tuple[StockLevel, StockMovement]:
        """
        Process rental return operation.
        
        Args:
            db: Database session
            stock_level_id: Stock level ID
            rental_return: Return details
            performed_by: User performing operation
            
        Returns:
            Tuple of updated stock level and movement
        """
        # Get stock level with lock
        query = (
            select(StockLevel)
            .where(StockLevel.id == stock_level_id)
            .with_for_update()
        )
        
        result = await db.execute(query)
        stock_level = result.scalar_one_or_none()
        
        if not stock_level:
            raise ValueError(f"Stock level {stock_level_id} not found")
        
        # Store before values
        quantity_before = stock_level.quantity_on_hand
        
        # Process return
        stock_level.return_from_rent(
            rental_return.quantity,
            damaged_quantity=rental_return.damaged_quantity
        )
        
        # Determine movement type
        if rental_return.damaged_quantity > 0:
            if rental_return.damaged_quantity == rental_return.quantity:
                movement_type = StockMovementType.RENTAL_RETURN_DAMAGED
            else:
                movement_type = StockMovementType.RENTAL_RETURN_MIXED
        else:
            movement_type = StockMovementType.RENTAL_RETURN
        
        # Create movement
        movement = StockMovement(
            stock_level_id=stock_level_id,
            item_id=stock_level.item_id,
            location_id=stock_level.location_id,
            movement_type=movement_type,
            quantity_change=rental_return.quantity,  # Positive for return
            quantity_before=quantity_before,
            quantity_after=stock_level.quantity_on_hand,
            transaction_header_id=rental_return.transaction_id,
            performed_by_id=performed_by,
            notes=rental_return.condition_notes
        )
        
        db.add(movement)
        await db.flush()
        await db.refresh(stock_level)
        await db.refresh(movement)
        
        return stock_level, movement
    
    async def get_by_item_location(
        self,
        db: AsyncSession,
        *,
        item_id: UUID,
        location_id: UUID
    ) -> Optional[StockLevel]:
        """
        Get stock level for item at location.
        
        Args:
            db: Database session
            item_id: Item ID
            location_id: Location ID
            
        Returns:
            Stock level or None
        """
        query = select(StockLevel).where(
            and_(
                StockLevel.item_id == item_id,
                StockLevel.location_id == location_id
            )
        )
        
        result = await db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_by_item(
        self,
        db: AsyncSession,
        *,
        item_id: UUID
    ) -> List[StockLevel]:
        """
        Get all stock levels for an item across locations.
        
        Args:
            db: Database session
            item_id: Item ID
            
        Returns:
            List of stock levels
        """
        query = (
            select(StockLevel)
            .where(StockLevel.item_id == item_id)
            .options(selectinload(StockLevel.location))
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_by_location(
        self,
        db: AsyncSession,
        *,
        location_id: UUID,
        skip: int = 0,
        limit: int = 100
    ) -> List[StockLevel]:
        """
        Get all stock levels at a location.
        
        Args:
            db: Database session
            location_id: Location ID
            skip: Number to skip
            limit: Maximum to return
            
        Returns:
            List of stock levels
        """
        query = (
            select(StockLevel)
            .where(StockLevel.location_id == location_id)
            .options(selectinload(StockLevel.item))
            .offset(skip)
            .limit(limit)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_filtered(
        self,
        db: AsyncSession,
        *,
        filter_params: StockLevelFilter,
        skip: int = 0,
        limit: int = 100
    ) -> List[StockLevel]:
        """
        Get filtered stock levels.
        
        Args:
            db: Database session
            filter_params: Filter parameters
            skip: Number to skip
            limit: Maximum to return
            
        Returns:
            List of filtered stock levels
        """
        query = select(StockLevel)
        
        # Apply filters
        if filter_params.item_id:
            query = query.where(StockLevel.item_id == filter_params.item_id)
        
        if filter_params.location_id:
            query = query.where(StockLevel.location_id == filter_params.location_id)
        
        if filter_params.stock_status:
            query = query.where(StockLevel.stock_status == filter_params.stock_status.value)
        
        if filter_params.has_stock is not None:
            if filter_params.has_stock:
                query = query.where(StockLevel.quantity_on_hand > 0)
            else:
                query = query.where(StockLevel.quantity_on_hand == 0)
        
        if filter_params.is_available is not None:
            if filter_params.is_available:
                query = query.where(StockLevel.quantity_available > 0)
            else:
                query = query.where(StockLevel.quantity_available == 0)
        
        if filter_params.is_low_stock is not None:
            if filter_params.is_low_stock:
                query = query.where(
                    and_(
                        StockLevel.reorder_point.isnot(None),
                        StockLevel.quantity_available <= StockLevel.reorder_point
                    )
                )
        
        if filter_params.is_overstocked is not None:
            if filter_params.is_overstocked:
                query = query.where(
                    and_(
                        StockLevel.maximum_stock.isnot(None),
                        StockLevel.quantity_on_hand > StockLevel.maximum_stock
                    )
                )
        
        if filter_params.min_quantity is not None:
            query = query.where(StockLevel.quantity_on_hand >= filter_params.min_quantity)
        
        if filter_params.max_quantity is not None:
            query = query.where(StockLevel.quantity_on_hand <= filter_params.max_quantity)
        
        # Apply ordering and pagination
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_low_stock_items(
        self,
        db: AsyncSession,
        *,
        location_id: Optional[UUID] = None
    ) -> List[StockLevel]:
        """
        Get items that are low on stock.
        
        Args:
            db: Database session
            location_id: Optional location filter
            
        Returns:
            List of low stock items
        """
        query = select(StockLevel).where(
            and_(
                StockLevel.reorder_point.isnot(None),
                StockLevel.quantity_available <= StockLevel.reorder_point
            )
        )
        
        if location_id:
            query = query.where(StockLevel.location_id == location_id)
        
        query = query.options(
            selectinload(StockLevel.item),
            selectinload(StockLevel.location)
        )
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_total_value_by_location(
        self,
        db: AsyncSession,
        *,
        location_id: UUID
    ) -> Decimal:
        """
        Get total inventory value at a location.
        
        Args:
            db: Database session
            location_id: Location ID
            
        Returns:
            Total value
        """
        query = (
            select(func.sum(StockLevel.total_value))
            .where(StockLevel.location_id == location_id)
        )
        
        result = await db.execute(query)
        total = result.scalar()
        
        return Decimal(str(total or 0))
    
    async def update_average_cost(
        self,
        db: AsyncSession,
        *,
        stock_level_id: UUID,
        new_quantity: Decimal,
        new_cost: Decimal
    ) -> StockLevel:
        """
        Update average cost with new purchase.
        
        Args:
            db: Database session
            stock_level_id: Stock level ID
            new_quantity: New quantity being added
            new_cost: Cost per unit of new quantity
            
        Returns:
            Updated stock level
        """
        stock_level = await self.get(db, id=stock_level_id)
        
        if not stock_level:
            raise ValueError(f"Stock level {stock_level_id} not found")
        
        stock_level.update_average_cost(new_quantity, new_cost)
        
        await db.flush()
        await db.refresh(stock_level)
        
        return stock_level


# Create singleton instance
stock_level = CRUDStockLevel(StockLevel)