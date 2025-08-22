"""
Service for handling item rental blocking operations.
"""

from typing import Optional, List, Tuple
from datetime import datetime
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.modules.master_data.item_master.models import Item
from app.modules.inventory.models import InventoryUnit
from app.modules.inventory.rental_block_history import RentalBlockHistory, EntityType
from app.modules.master_data.item_master.rental_blocking_schemas import (
    RentalStatusRequest,
    RentalStatusResponse,
    RentalBlockHistoryResponse,
    BlockedItemSummary,
    RentalAvailabilityResponse,
    BulkRentalStatusRequest,
    BulkRentalStatusResponse
)
from app.shared.exceptions import NotFoundError, ValidationError


class ItemRentalBlockingService:
    """Service for managing item rental blocking functionality."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def toggle_item_rental_status(
        self, 
        item_id: UUID, 
        request: RentalStatusRequest, 
        changed_by: UUID
    ) -> RentalStatusResponse:
        """Toggle rental status for an item."""
        
        # Get the item
        result = await self.db.execute(
            select(Item).where(and_(Item.id == item_id, Item.is_active == True))
        )
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # Store previous status
        previous_status = item.is_rental_blocked
        
        # Check if status is actually changing
        if previous_status == request.is_rental_blocked:
            return RentalStatusResponse(
                item_id=item.id,
                item_name=item.item_name,
                is_rental_blocked=item.is_rental_blocked,
                rental_block_reason=item.rental_block_reason,
                rental_blocked_at=item.rental_blocked_at,
                rental_blocked_by=item.rental_blocked_by,
                previous_status=previous_status,
                message="No change - status already set to requested value"
            )
        
        # Update item status
        item.is_rental_blocked = request.is_rental_blocked
        item.rental_block_reason = request.remarks
        item.rental_blocked_at = datetime.utcnow() if request.is_rental_blocked else None
        item.rental_blocked_by = changed_by if request.is_rental_blocked else None
        item.updated_by = str(changed_by)
        
        # Create history entry
        history_entry = RentalBlockHistory.create_item_entry(
            item_id=item.id,
            is_blocked=request.is_rental_blocked,
            remarks=request.remarks,
            changed_by=changed_by,
            previous_status=previous_status
        )
        
        self.db.add(history_entry)
        await self.db.commit()
        await self.db.refresh(item)
        
        status_word = "blocked" if request.is_rental_blocked else "unblocked"
        return RentalStatusResponse(
            item_id=item.id,
            item_name=item.item_name,
            is_rental_blocked=item.is_rental_blocked,
            rental_block_reason=item.rental_block_reason,
            rental_blocked_at=item.rental_blocked_at,
            rental_blocked_by=item.rental_blocked_by,
            previous_status=previous_status,
            message=f"Item successfully {status_word} from rental"
        )
    
    async def get_item_rental_history(
        self, 
        item_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> Tuple[List[RentalBlockHistoryResponse], int]:
        """Get rental blocking history for an item."""
        
        # Check if item exists
        result = await self.db.execute(
            select(Item).where(and_(Item.id == item_id, Item.is_active == True))
        )
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # Get history entries
        query = select(RentalBlockHistory).where(
            RentalBlockHistory.item_id == item_id
        ).order_by(RentalBlockHistory.changed_at.desc())
        
        # Get total count
        count_result = await self.db.execute(
            select(func.count()).select_from(
                query.subquery()
            )
        )
        total = count_result.scalar()
        
        # Get paginated results
        result = await self.db.execute(
            query.offset(skip).limit(limit)
        )
        entries = result.scalars().all()
        
        history_responses = []
        for entry in entries:
            history_responses.append(RentalBlockHistoryResponse(
                id=entry.id,
                entity_type=entry.entity_type.value,
                entity_id=entry.entity_id,
                item_id=entry.item_id,
                inventory_unit_id=entry.inventory_unit_id,
                is_blocked=entry.is_blocked,
                previous_status=entry.previous_status,
                remarks=entry.remarks,
                changed_by=entry.changed_by,
                changed_at=entry.changed_at,
                status_change_description=entry.status_change_description,
                entity_display_name=entry.entity_display_name
            ))
        
        return history_responses, total
    
    async def get_blocked_items(
        self, 
        skip: int = 0, 
        limit: int = 100
    ) -> Tuple[List[BlockedItemSummary], int]:
        """Get list of all blocked items."""
        
        query = select(Item).where(
            and_(
                Item.is_active == True,
                Item.is_rental_blocked == True
            )
        ).order_by(Item.rental_blocked_at.desc())
        
        # Get total count
        count_result = await self.db.execute(
            select(func.count()).select_from(
                query.subquery()
            )
        )
        total = count_result.scalar()
        
        # Get paginated results
        result = await self.db.execute(
            query.offset(skip).limit(limit)
        )
        items = result.scalars().all()
        
        blocked_items = []
        for item in items:
            blocked_items.append(BlockedItemSummary(
                item_id=item.id,
                item_name=item.item_name,
                sku=item.sku,
                rental_block_reason=item.rental_block_reason,
                rental_blocked_at=item.rental_blocked_at,
                rental_blocked_by=item.rental_blocked_by
            ))
        
        return blocked_items, total
    
    async def check_item_rental_availability(self, item_id: UUID) -> RentalAvailabilityResponse:
        """Check rental availability for an item."""
        
        # Get item with inventory units
        result = await self.db.execute(
            select(Item)
            .options(selectinload(Item.inventory_units))
            .where(and_(Item.id == item_id, Item.is_active == True))
        )
        item = result.scalar_one_or_none()
        if not item:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # Calculate unit statistics
        total_units = len(item.inventory_units) if item.inventory_units else 0
        available_units = 0
        blocked_units = 0
        
        if item.inventory_units:
            for unit in item.inventory_units:
                if unit.is_active:
                    if unit.is_rental_blocked:
                        blocked_units += 1
                    elif unit.status == "AVAILABLE":
                        available_units += 1
        
        # Determine availability
        can_be_rented = item.can_be_rented() and available_units > 0
        
        # Create availability message
        if item.is_rental_blocked:
            availability_message = f"Item blocked from rental: {item.rental_block_reason}"
        elif not item.is_rentable:
            availability_message = "Item is not configured for rental"
        elif total_units == 0:
            availability_message = "No inventory units available"
        elif available_units == 0:
            if blocked_units > 0:
                availability_message = f"All {total_units} units are blocked or unavailable"
            else:
                availability_message = "All units are currently rented or unavailable"
        else:
            availability_message = f"{available_units} of {total_units} units available for rental"
        
        return RentalAvailabilityResponse(
            item_id=item.id,
            item_name=item.item_name,
            sku=item.sku,
            is_rentable=item.is_rentable,
            is_item_blocked=item.is_rental_blocked,
            block_reason=item.rental_block_reason,
            total_units=total_units,
            available_units=available_units,
            blocked_units=blocked_units,
            can_be_rented=can_be_rented,
            availability_message=availability_message
        )
    
    async def bulk_toggle_rental_status(
        self, 
        request: BulkRentalStatusRequest, 
        changed_by: UUID
    ) -> BulkRentalStatusResponse:
        """Toggle rental status for multiple items."""
        
        successful_changes = []
        failed_changes = []
        
        for item_id in request.item_ids:
            try:
                status_request = RentalStatusRequest(
                    is_rental_blocked=request.is_rental_blocked,
                    remarks=request.remarks
                )
                
                result = await self.toggle_item_rental_status(
                    item_id=item_id,
                    request=status_request,
                    changed_by=changed_by
                )
                successful_changes.append(result)
                
            except Exception as e:
                failed_changes.append({
                    "item_id": str(item_id),
                    "error_message": str(e)
                })
        
        return BulkRentalStatusResponse(
            successful_changes=successful_changes,
            failed_changes=failed_changes,
            total_requested=len(request.item_ids),
            total_successful=len(successful_changes),
            total_failed=len(failed_changes)
        )