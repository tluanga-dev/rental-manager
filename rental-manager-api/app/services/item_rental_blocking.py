"""Item Rental Blocking Service for managing rental availability and blocking history."""

from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.item import Item
from app.crud.item import ItemRepository
from app.schemas.item import (
    ItemRentalStatusRequest,
    ItemRentalStatusResponse,
    ItemAvailabilityResponse,
    ItemBulkOperation,
    ItemBulkResult
)
from app.core.errors import NotFoundError, ValidationError, BusinessRuleError


class RentalBlockHistory:
    """Model for rental block history (placeholder for future inventory module)."""
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)
    
    @classmethod
    def create_item_entry(cls, **kwargs):
        """Create a rental block history entry."""
        return cls(**kwargs)


class ItemRentalBlockingService:
    """Service for managing item rental blocking functionality."""
    
    def __init__(self, session: AsyncSession, item_repository: ItemRepository):
        """Initialize service with database session and item repository."""
        self.session = session
        self.item_repository = item_repository
    
    async def toggle_item_rental_status(
        self,
        item_id: UUID,
        request: ItemRentalStatusRequest,
        changed_by: UUID
    ) -> ItemRentalStatusResponse:
        """Toggle rental status for an item.
        
        Args:
            item_id: Item UUID
            request: Rental status change request
            changed_by: User making the change
            
        Returns:
            Rental status response
            
        Raises:
            NotFoundError: If item not found
        """
        # Get the item
        item = await self.item_repository.get_by_id(item_id)
        if not item or not item.is_active:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # Store previous status
        previous_status = item.is_rental_blocked
        
        # Check if status is actually changing
        if previous_status == request.is_rental_blocked:
            return ItemRentalStatusResponse(
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
        if request.is_rental_blocked:
            item.block_rental(request.remarks or "Manual block", changed_by)
        else:
            item.unblock_rental()
        
        # Create history entry (placeholder - would integrate with proper history system)
        await self._create_history_entry(
            item_id=item.id,
            is_blocked=request.is_rental_blocked,
            remarks=request.remarks,
            changed_by=changed_by,
            previous_status=previous_status
        )
        
        # Save changes
        update_data = {
            "is_rental_blocked": item.is_rental_blocked,
            "rental_block_reason": item.rental_block_reason,
            "rental_blocked_at": item.rental_blocked_at,
            "rental_blocked_by": item.rental_blocked_by,
            "updated_by": str(changed_by)
        }
        
        await self.item_repository.update(item_id, update_data)
        
        status_word = "blocked" if request.is_rental_blocked else "unblocked"
        return ItemRentalStatusResponse(
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
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get rental blocking history for an item.
        
        Args:
            item_id: Item UUID
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (history_entries, total_count)
            
        Raises:
            NotFoundError: If item not found
        """
        # Check if item exists
        item = await self.item_repository.get_by_id(item_id)
        if not item or not item.is_active:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # For now, return mock history data
        # In a full implementation, this would query a proper history table
        history_entries = []
        
        if item.rental_blocked_at:
            history_entries.append({
                "id": str(UUID(int=1)),
                "entity_type": "ITEM",
                "entity_id": str(item.id),
                "item_id": str(item.id),
                "inventory_unit_id": None,
                "is_blocked": item.is_rental_blocked,
                "previous_status": not item.is_rental_blocked,
                "remarks": item.rental_block_reason,
                "changed_by": item.rental_blocked_by,
                "changed_at": item.rental_blocked_at,
                "status_change_description": f"Item {'blocked' if item.is_rental_blocked else 'unblocked'} from rental",
                "entity_display_name": item.item_name
            })
        
        total = len(history_entries)
        
        # Apply pagination
        paginated_entries = history_entries[skip:skip + limit]
        
        return paginated_entries, total
    
    async def get_blocked_items(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get list of all blocked items.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (blocked_items, total_count)
        """
        # Get blocked items using repository
        filters = {"is_rental_blocked": True}
        items, total = await self.item_repository.get_paginated(
            page=(skip // limit) + 1,
            page_size=limit,
            filters=filters,
            sort_by="rental_blocked_at",
            sort_order="desc",
            include_inactive=False
        )
        
        blocked_items = []
        for item in items:
            blocked_items.append({
                "item_id": item.id,
                "item_name": item.item_name,
                "sku": item.sku,
                "rental_block_reason": item.rental_block_reason,
                "rental_blocked_at": item.rental_blocked_at,
                "rental_blocked_by": item.rental_blocked_by
            })
        
        return blocked_items, total
    
    async def check_item_rental_availability(
        self,
        item_id: UUID
    ) -> ItemAvailabilityResponse:
        """Check rental availability for an item.
        
        Args:
            item_id: Item UUID
            
        Returns:
            Rental availability response
            
        Raises:
            NotFoundError: If item not found
        """
        # Get item
        item = await self.item_repository.get_by_id(item_id, include_relations=True)
        if not item:
            raise NotFoundError(f"Item with id {item_id} not found")
        
        # Mock inventory data (would integrate with inventory system)
        total_units = 1  # Placeholder
        available_units = 1 if item.can_be_rented() else 0
        blocked_units = 1 if item.is_rental_blocked else 0
        reserved_quantity = 0  # Would come from reservations
        
        # Determine availability
        can_be_rented = item.can_be_rented() and available_units > 0
        
        # Create availability message
        if item.is_rental_blocked:
            availability_message = f"Item blocked from rental: {item.rental_block_reason}"
        elif not item.is_rentable:
            availability_message = "Item is not configured for rental"
        elif not item.is_active:
            availability_message = "Item is inactive"
        elif item.status != "ACTIVE":
            availability_message = f"Item status is {item.status}"
        elif total_units == 0:
            availability_message = "No inventory units available"
        elif available_units == 0:
            if blocked_units > 0:
                availability_message = f"All {total_units} units are blocked or unavailable"
            else:
                availability_message = "All units are currently rented or unavailable"
        else:
            availability_message = f"{available_units} of {total_units} units available for rental"
        
        return ItemAvailabilityResponse(
            item_id=item.id,
            item_name=item.item_name,
            is_available=can_be_rented,
            available_quantity=available_units,
            total_quantity=total_units,
            reserved_quantity=reserved_quantity,
            can_be_rented=can_be_rented,
            can_be_sold=item.can_be_sold(),
            availability_message=availability_message,
            next_available_date=None  # Would be calculated from rental return dates
        )
    
    async def bulk_toggle_rental_status(
        self,
        item_ids: List[UUID],
        is_rental_blocked: bool,
        remarks: Optional[str],
        changed_by: UUID
    ) -> ItemBulkResult:
        """Toggle rental status for multiple items.
        
        Args:
            item_ids: List of item UUIDs
            is_rental_blocked: Whether to block or unblock rental
            remarks: Reason for the change
            changed_by: User making the change
            
        Returns:
            Bulk operation result
        """
        successful_items = []
        failed_items = []
        
        for item_id in item_ids:
            try:
                request = ItemRentalStatusRequest(
                    is_rental_blocked=is_rental_blocked,
                    remarks=remarks
                )
                
                result = await self.toggle_item_rental_status(
                    item_id=item_id,
                    request=request,
                    changed_by=changed_by
                )
                
                successful_items.append(item_id)
                
            except Exception as e:
                failed_items.append({
                    "item_id": str(item_id),
                    "error": str(e)
                })
        
        return ItemBulkResult(
            total_requested=len(item_ids),
            success_count=len(successful_items),
            failure_count=len(failed_items),
            successful_items=successful_items,
            failed_items=failed_items
        )
    
    async def get_rental_blocking_statistics(self) -> Dict[str, Any]:
        """Get statistics about rental blocking.
        
        Returns:
            Rental blocking statistics
        """
        # Count blocked items
        blocked_query = select(func.count()).select_from(Item).where(
            and_(Item.is_active == True, Item.is_rental_blocked == True)
        )
        blocked_result = await self.session.execute(blocked_query)
        blocked_count = blocked_result.scalar_one()
        
        # Count rentable items
        rentable_query = select(func.count()).select_from(Item).where(
            and_(Item.is_active == True, Item.is_rentable == True)
        )
        rentable_result = await self.session.execute(rentable_query)
        rentable_count = rentable_result.scalar_one()
        
        # Count available items (rentable and not blocked)
        available_query = select(func.count()).select_from(Item).where(
            and_(
                Item.is_active == True,
                Item.is_rentable == True,
                Item.is_rental_blocked == False,
                Item.status == "ACTIVE"
            )
        )
        available_result = await self.session.execute(available_query)
        available_count = available_result.scalar_one()
        
        # Get recent blockings (last 30 days)
        thirty_days_ago = datetime.now().replace(microsecond=0).replace(second=0, minute=0, hour=0)
        
        recent_blocks_query = select(func.count()).select_from(Item).where(
            and_(
                Item.is_rental_blocked == True,
                Item.rental_blocked_at >= thirty_days_ago
            )
        )
        recent_blocks_result = await self.session.execute(recent_blocks_query)
        recent_blocks_count = recent_blocks_result.scalar_one()
        
        return {
            "total_rentable_items": rentable_count,
            "blocked_items": blocked_count,
            "available_items": available_count,
            "blocked_percentage": (blocked_count / rentable_count * 100) if rentable_count > 0 else 0,
            "available_percentage": (available_count / rentable_count * 100) if rentable_count > 0 else 0,
            "recent_blockings_30_days": recent_blocks_count
        }
    
    async def get_blocking_reasons_summary(self) -> List[Dict[str, Any]]:
        """Get summary of common blocking reasons.
        
        Returns:
            List of blocking reasons with counts
        """
        query = select(
            Item.rental_block_reason,
            func.count().label("count")
        ).where(
            and_(
                Item.is_active == True,
                Item.is_rental_blocked == True,
                Item.rental_block_reason.is_not(None)
            )
        ).group_by(
            Item.rental_block_reason
        ).order_by(
            func.count().desc()
        ).limit(10)
        
        result = await self.session.execute(query)
        rows = result.fetchall()
        
        return [
            {
                "reason": row.rental_block_reason,
                "count": row.count
            }
            for row in rows
        ]
    
    async def auto_unblock_expired_items(
        self,
        auto_unblock_after_days: int = 90
    ) -> List[UUID]:
        """Automatically unblock items that have been blocked for too long.
        
        Args:
            auto_unblock_after_days: Days after which to auto-unblock
            
        Returns:
            List of unblocked item IDs
        """
        cutoff_date = datetime.now().replace(microsecond=0, second=0, minute=0, hour=0)
        
        # Find items blocked for more than specified days
        query = select(Item).where(
            and_(
                Item.is_active == True,
                Item.is_rental_blocked == True,
                Item.rental_blocked_at < cutoff_date
            )
        )
        
        result = await self.session.execute(query)
        items_to_unblock = result.scalars().all()
        
        unblocked_items = []
        
        for item in items_to_unblock:
            # Unblock the item
            item.unblock_rental()
            
            # Create history entry
            await self._create_history_entry(
                item_id=item.id,
                is_blocked=False,
                remarks="Auto-unblocked after expiry",
                changed_by=None,
                previous_status=True
            )
            
            unblocked_items.append(item.id)
        
        # Save changes
        if unblocked_items:
            await self.session.commit()
        
        return unblocked_items
    
    async def get_items_blocked_by_user(
        self,
        user_id: UUID,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get items blocked by a specific user.
        
        Args:
            user_id: User UUID
            limit: Optional limit on results
            
        Returns:
            List of items blocked by the user
        """
        query = select(Item).where(
            and_(
                Item.is_active == True,
                Item.is_rental_blocked == True,
                Item.rental_blocked_by == user_id
            )
        ).order_by(Item.rental_blocked_at.desc())
        
        if limit:
            query = query.limit(limit)
        
        result = await self.session.execute(query)
        items = result.scalars().all()
        
        return [
            {
                "item_id": item.id,
                "item_name": item.item_name,
                "sku": item.sku,
                "rental_block_reason": item.rental_block_reason,
                "rental_blocked_at": item.rental_blocked_at
            }
            for item in items
        ]
    
    async def validate_rental_unblock(self, item_id: UUID) -> Dict[str, Any]:
        """Validate if an item can be unblocked for rental.
        
        Args:
            item_id: Item UUID
            
        Returns:
            Validation result with warnings/errors
        """
        item = await self.item_repository.get_by_id(item_id)
        if not item:
            return {
                "can_unblock": False,
                "errors": ["Item not found"],
                "warnings": []
            }
        
        errors = []
        warnings = []
        
        if not item.is_rental_blocked:
            warnings.append("Item is not currently blocked")
        
        if not item.is_rentable:
            errors.append("Item is not configured for rental")
        
        if not item.is_active:
            errors.append("Item is inactive")
        
        if item.status != "ACTIVE":
            warnings.append(f"Item status is {item.status}")
        
        # Check for maintenance due
        if item.is_maintenance_due:
            warnings.append("Item maintenance is due")
        
        # Check for warranty expiry
        if item.is_warranty_expired:
            warnings.append("Item warranty has expired")
        
        return {
            "can_unblock": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    async def _create_history_entry(
        self,
        item_id: UUID,
        is_blocked: bool,
        remarks: Optional[str],
        changed_by: Optional[UUID],
        previous_status: bool
    ):
        """Create a history entry for rental status change.
        
        This is a placeholder implementation. In a full system, this would
        create entries in a proper history table.
        """
        # Placeholder - would create actual history record
        history_entry = RentalBlockHistory.create_item_entry(
            item_id=item_id,
            is_blocked=is_blocked,
            remarks=remarks,
            changed_by=changed_by,
            previous_status=previous_status,
            changed_at=datetime.utcnow()
        )
        
        # In a full implementation, this would be saved to database
        # self.session.add(history_entry)
        # await self.session.commit()
        
        return history_entry