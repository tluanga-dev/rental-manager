from typing import List, Optional
from decimal import Decimal
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, Field

from app.modules.inventory.schemas import ItemInventorySchema
from app.modules.inventory.models import StockLevel, StockMovement
from app.modules.inventory.enums import StockMovementType, InventoryUnitStatus
import logging

logger = logging.getLogger(__name__)

class InventoryService:
    def __init__(self, repo=None):
        self.repo = repo

    async def list_all_items_inventory(self, session, **filters) -> List[ItemInventorySchema]:
        raw = await self.repo.get_all_items_inventory(session, **filters)
        return [ItemInventorySchema(**row) for row in raw]
    
    async def return_rental_item(
        self,
        session: AsyncSession,
        item_id: str,
        location_id: str,
        quantity: Decimal,
        condition: str = "GOOD"
    ) -> bool:
        """
        Process the return of rental items to inventory
        
        Args:
            session: Database session
            item_id: Item being returned
            location_id: Location to return to
            quantity: Quantity being returned
            condition: Condition of returned items (GOOD, DAMAGED, BEYOND_REPAIR)
            
        Returns:
            Success status
        """
        try:
            # Get or create stock level for this item/location
            stmt = select(StockLevel).where(
                StockLevel.item_id == UUID(item_id),
                StockLevel.location_id == UUID(location_id)
            )
            result = await session.execute(stmt)
            stock_level = result.scalar_one_or_none()
            
            if not stock_level:
                # Create new stock level if it doesn't exist
                stock_level = StockLevel(
                    item_id=item_id,
                    location_id=location_id,
                    quantity_on_hand=Decimal("0"),
                    available_quantity=Decimal("0"),
                    reserved_quantity=Decimal("0")
                )
                session.add(stock_level)
                await session.flush()
            
            # Update quantities based on condition
            if condition == "GOOD":
                # Return to available inventory
                stock_level.quantity_on_hand += quantity
                stock_level.available_quantity += quantity
            elif condition == "DAMAGED":
                # Add to on-hand but not available (needs repair)
                stock_level.quantity_on_hand += quantity
                # Don't add to available_quantity
            elif condition == "BEYOND_REPAIR":
                # Don't add to inventory at all
                logger.info(f"Item {item_id} returned as beyond repair, not adding to inventory")
            
            # Create stock movement record
            movement = StockMovement(
                item_id=item_id,
                location_id=location_id,
                movement_type=StockMovementType.RENTAL_RETURN,
                quantity=quantity,
                movement_date=datetime.utcnow(),
                reference_type="RENTAL_RETURN",
                notes=f"Returned in {condition} condition"
            )
            session.add(movement)
            
            await session.flush()
            
            logger.info(f"Returned {quantity} of item {item_id} to location {location_id} in {condition} condition")
            return True
            
        except Exception as e:
            logger.error(f"Error returning rental item: {str(e)}")
            raise
    
    async def extend_rental_reservation(
        self,
        session: AsyncSession,
        item_id: str,
        location_id: str,
        quantity: Decimal,
        old_end_date: str,
        new_end_date: str
    ) -> bool:
        """
        Extend the reservation period for rental items
        
        Args:
            session: Database session
            item_id: Item being extended
            location_id: Location of the item
            quantity: Quantity being extended
            old_end_date: Current reservation end date
            new_end_date: New reservation end date
            
        Returns:
            Success status
        """
        try:
            # For now, just log the extension
            # In a full implementation, this would update reservation records
            logger.info(
                f"Extended reservation for {quantity} of item {item_id} "
                f"from {old_end_date} to {new_end_date}"
            )
            
            # Create stock movement record for tracking
            movement = StockMovement(
                item_id=item_id,
                location_id=location_id,
                movement_type=StockMovementType.RESERVATION_EXTENDED,
                quantity=quantity,
                movement_date=datetime.utcnow(),
                reference_type="RENTAL_EXTENSION",
                notes=f"Extended from {old_end_date} to {new_end_date}"
            )
            session.add(movement)
            
            await session.flush()
            return True
            
        except Exception as e:
            logger.error(f"Error extending rental reservation: {str(e)}")
            raise

    async def update_inventory_unit_rental_rate(
        self,
        session: AsyncSession,
        unit_id: UUID,
        rental_rate_per_period: Decimal,
        user_id: UUID
    ) -> bool:
        """
        Update the rental rate for a specific inventory unit.
        
        Args:
            session: Database session
            unit_id: Inventory unit ID to update
            rental_rate_per_period: New rental rate per period
            user_id: ID of the user making the change
            
        Returns:
            Success status
        """
        try:
            from app.modules.inventory.models import InventoryUnit
            
            # Validate rental rate
            if rental_rate_per_period < 0:
                raise ValueError("Rental rate cannot be negative")
                
            # Update the inventory unit
            stmt = update(InventoryUnit).where(
                InventoryUnit.id == unit_id
            ).values(
                rental_rate_per_period=rental_rate_per_period,
                updated_at=datetime.utcnow(),
                updated_by=user_id
            )
            
            result = await session.execute(stmt)
            
            if result.rowcount == 0:
                logger.warning(f"No inventory unit found with ID: {unit_id}")
                return False
                
            await session.flush()
            
            logger.info(
                f"Updated rental rate for inventory unit {unit_id} to {rental_rate_per_period} "
                f"by user {user_id}"
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating inventory unit rental rate: {str(e)}")
            raise

    async def batch_update_inventory_unit_rental_rate(
        self,
        session: AsyncSession,
        item_id: UUID,
        location_id: UUID,
        rental_rate_per_period: Decimal,
        user_id: UUID
    ) -> int:
        """
        Update the rental rate for all inventory units of a specific item at a location.
        
        Args:
            session: Database session
            item_id: Item ID to update
            location_id: Location ID to update
            rental_rate_per_period: New rental rate per period
            user_id: ID of the user making the change
            
        Returns:
            Number of units updated
        """
        try:
            from app.modules.inventory.models import InventoryUnit
            
            # Validate rental rate
            if rental_rate_per_period < 0:
                raise ValueError("Rental rate cannot be negative")
                
            # Update all inventory units for this item at this location
            stmt = update(InventoryUnit).where(
                and_(
                    InventoryUnit.item_id == item_id,
                    InventoryUnit.location_id == location_id
                )
            ).values(
                rental_rate_per_period=rental_rate_per_period,
                updated_at=datetime.utcnow(),
                updated_by=user_id
            )
            
            result = await session.execute(stmt)
            updated_count = result.rowcount
            
            await session.flush()
            
            logger.info(
                f"Batch updated rental rate for {updated_count} inventory units "
                f"(item: {item_id}, location: {location_id}) to {rental_rate_per_period} "
                f"by user {user_id}"
            )
            
            return updated_count
            
        except Exception as e:
            logger.error(f"Error batch updating inventory unit rental rates: {str(e)}")
            raise