"""
Comprehensive unit tests for Item Rental Blocking Service
Target: 100% coverage for rental blocking functionality
"""

import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from datetime import datetime

from app.services.item_rental_blocking import ItemRentalBlockingService
from app.core.exceptions import NotFoundError, ValidationError
from tests.conftest import ItemFactory


@pytest.mark.unit
@pytest.mark.asyncio
class TestItemRentalBlockingService:
    """Test Item Rental Blocking Service functionality."""
    
    async def test_block_item_rental(self, item_rental_blocking_service, test_item):
        """Test blocking an item for rental."""
        user_id = uuid4()
        reason = "Maintenance required"
        
        # Mock repository methods
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        item_rental_blocking_service.item_repository.update = AsyncMock(return_value=test_item)
        
        result = await item_rental_blocking_service.block_item_rental(
            item_id=test_item.id,
            reason=reason,
            blocked_by=user_id
        )
        
        assert result.is_rental_blocked is True
        assert result.rental_blocked_reason == reason
        assert result.rental_blocked_by == user_id
        assert result.rental_blocked_at is not None
    
    async def test_block_item_rental_not_found(self, item_rental_blocking_service):
        """Test blocking rental for non-existent item."""
        non_existent_id = uuid4()
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=None)
        
        with pytest.raises(NotFoundError, match=f"Item with id {non_existent_id} not found"):
            await item_rental_blocking_service.block_item_rental(
                item_id=non_existent_id,
                reason="Test reason",
                blocked_by=uuid4()
            )
    
    async def test_block_item_rental_already_blocked(self, item_rental_blocking_service, test_item):
        """Test blocking rental for already blocked item."""
        test_item.is_rental_blocked = True
        test_item.rental_blocked_reason = "Already blocked"
        
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        
        with pytest.raises(ValidationError, match="Item is already blocked for rental"):
            await item_rental_blocking_service.block_item_rental(
                item_id=test_item.id,
                reason="New reason",
                blocked_by=uuid4()
            )
    
    async def test_block_item_rental_not_rentable(self, item_rental_blocking_service, test_item):
        """Test blocking rental for non-rentable item."""
        test_item.is_rentable = False
        
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        
        with pytest.raises(ValidationError, match="Item is not rentable"):
            await item_rental_blocking_service.block_item_rental(
                item_id=test_item.id,
                reason="Test reason",
                blocked_by=uuid4()
            )
    
    async def test_unblock_item_rental(self, item_rental_blocking_service, test_item):
        """Test unblocking an item for rental."""
        # Set item as blocked
        test_item.is_rental_blocked = True
        test_item.rental_blocked_reason = "Maintenance"
        test_item.rental_blocked_by = uuid4()
        test_item.rental_blocked_at = datetime.now()
        
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        item_rental_blocking_service.item_repository.update = AsyncMock(return_value=test_item)
        
        result = await item_rental_blocking_service.unblock_item_rental(test_item.id)
        
        assert result.is_rental_blocked is False
        assert result.rental_blocked_reason is None
        assert result.rental_blocked_by is None
        assert result.rental_unblocked_at is not None
    
    async def test_unblock_item_rental_not_blocked(self, item_rental_blocking_service, test_item):
        """Test unblocking rental for non-blocked item."""
        test_item.is_rental_blocked = False
        
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        
        with pytest.raises(ValidationError, match="Item is not blocked for rental"):
            await item_rental_blocking_service.unblock_item_rental(test_item.id)
    
    async def test_get_rental_blocking_history(self, item_rental_blocking_service):
        """Test retrieving rental blocking history."""
        item_id = uuid4()
        mock_history = [
            {
                "id": uuid4(),
                "item_id": item_id,
                "action": "BLOCKED",
                "reason": "Maintenance",
                "performed_by": uuid4(),
                "performed_at": datetime.now()
            },
            {
                "id": uuid4(),
                "item_id": item_id,
                "action": "UNBLOCKED",
                "reason": None,
                "performed_by": uuid4(),
                "performed_at": datetime.now()
            }
        ]
        
        item_rental_blocking_service.item_repository.get_rental_blocking_history = AsyncMock(
            return_value=mock_history
        )
        
        history = await item_rental_blocking_service.get_rental_blocking_history(item_id)
        
        assert len(history) == 2
        assert history[0]["action"] == "BLOCKED"
        assert history[1]["action"] == "UNBLOCKED"
    
    async def test_bulk_block_items(self, item_rental_blocking_service):
        """Test bulk blocking multiple items."""
        item_ids = [uuid4(), uuid4(), uuid4()]
        reason = "Bulk maintenance"
        blocked_by = uuid4()
        
        # Mock successful bulk operation
        mock_result = {
            "successful": item_ids,
            "failed": [],
            "total_processed": len(item_ids)
        }
        
        item_rental_blocking_service.item_repository.bulk_block_rental = AsyncMock(
            return_value=mock_result
        )
        
        result = await item_rental_blocking_service.bulk_block_items(
            item_ids=item_ids,
            reason=reason,
            blocked_by=blocked_by
        )
        
        assert result["total_processed"] == 3
        assert len(result["successful"]) == 3
        assert len(result["failed"]) == 0
    
    async def test_bulk_block_items_partial_failure(self, item_rental_blocking_service):
        """Test bulk blocking with some failures."""
        item_ids = [uuid4(), uuid4(), uuid4()]
        reason = "Bulk maintenance"
        blocked_by = uuid4()
        
        # Mock partial failure
        mock_result = {
            "successful": item_ids[:2],
            "failed": [{"id": item_ids[2], "error": "Item not found"}],
            "total_processed": len(item_ids)
        }
        
        item_rental_blocking_service.item_repository.bulk_block_rental = AsyncMock(
            return_value=mock_result
        )
        
        result = await item_rental_blocking_service.bulk_block_items(
            item_ids=item_ids,
            reason=reason,
            blocked_by=blocked_by
        )
        
        assert result["total_processed"] == 3
        assert len(result["successful"]) == 2
        assert len(result["failed"]) == 1
    
    async def test_bulk_unblock_items(self, item_rental_blocking_service):
        """Test bulk unblocking multiple items."""
        item_ids = [uuid4(), uuid4(), uuid4()]
        
        mock_result = {
            "successful": item_ids,
            "failed": [],
            "total_processed": len(item_ids)
        }
        
        item_rental_blocking_service.item_repository.bulk_unblock_rental = AsyncMock(
            return_value=mock_result
        )
        
        result = await item_rental_blocking_service.bulk_unblock_items(item_ids)
        
        assert result["total_processed"] == 3
        assert len(result["successful"]) == 3
        assert len(result["failed"]) == 0
    
    async def test_get_blocked_items(self, item_rental_blocking_service):
        """Test retrieving all blocked items."""
        mock_blocked_items = [
            {"id": uuid4(), "item_name": "Item 1", "rental_blocked_reason": "Maintenance"},
            {"id": uuid4(), "item_name": "Item 2", "rental_blocked_reason": "Repair needed"},
        ]
        
        item_rental_blocking_service.item_repository.get_blocked_items = AsyncMock(
            return_value=mock_blocked_items
        )
        
        blocked_items = await item_rental_blocking_service.get_blocked_items()
        
        assert len(blocked_items) == 2
        assert all("rental_blocked_reason" in item for item in blocked_items)
    
    async def test_get_blocked_items_by_reason(self, item_rental_blocking_service):
        """Test retrieving blocked items filtered by reason."""
        reason_filter = "maintenance"
        mock_items = [
            {"id": uuid4(), "item_name": "Item 1", "rental_blocked_reason": "Maintenance required"},
        ]
        
        item_rental_blocking_service.item_repository.get_blocked_items = AsyncMock(
            return_value=mock_items
        )
        
        items = await item_rental_blocking_service.get_blocked_items(reason_filter=reason_filter)
        
        assert len(items) == 1
        item_rental_blocking_service.item_repository.get_blocked_items.assert_called_with(
            reason_filter=reason_filter
        )
    
    async def test_get_blocked_items_by_user(self, item_rental_blocking_service):
        """Test retrieving blocked items filtered by user."""
        user_id = uuid4()
        mock_items = [
            {"id": uuid4(), "item_name": "Item 1", "rental_blocked_by": user_id},
        ]
        
        item_rental_blocking_service.item_repository.get_blocked_items = AsyncMock(
            return_value=mock_items
        )
        
        items = await item_rental_blocking_service.get_blocked_items(blocked_by=user_id)
        
        assert len(items) == 1
        item_rental_blocking_service.item_repository.get_blocked_items.assert_called_with(
            blocked_by=user_id
        )
    
    async def test_check_item_blocking_status(self, item_rental_blocking_service, test_item):
        """Test checking item blocking status."""
        test_item.is_rental_blocked = True
        test_item.rental_blocked_reason = "Under repair"
        
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        
        status = await item_rental_blocking_service.check_item_blocking_status(test_item.id)
        
        assert status["is_blocked"] is True
        assert status["reason"] == "Under repair"
        assert "blocked_at" in status
        assert "blocked_by" in status
    
    async def test_check_item_blocking_status_not_blocked(self, item_rental_blocking_service, test_item):
        """Test checking status for non-blocked item."""
        test_item.is_rental_blocked = False
        
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        
        status = await item_rental_blocking_service.check_item_blocking_status(test_item.id)
        
        assert status["is_blocked"] is False
        assert status["reason"] is None


@pytest.mark.unit
@pytest.mark.asyncio
class TestItemRentalBlockingValidation:
    """Test Item Rental Blocking Service validation logic."""
    
    async def test_validate_blocking_reason_empty(self, item_rental_blocking_service, test_item):
        """Test validation with empty blocking reason."""
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        
        with pytest.raises(ValidationError, match="Blocking reason cannot be empty"):
            await item_rental_blocking_service.block_item_rental(
                item_id=test_item.id,
                reason="",
                blocked_by=uuid4()
            )
    
    async def test_validate_blocking_reason_whitespace(self, item_rental_blocking_service, test_item):
        """Test validation with whitespace-only reason."""
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        
        with pytest.raises(ValidationError, match="Blocking reason cannot be empty"):
            await item_rental_blocking_service.block_item_rental(
                item_id=test_item.id,
                reason="   ",
                blocked_by=uuid4()
            )
    
    async def test_validate_blocking_reason_too_long(self, item_rental_blocking_service, test_item):
        """Test validation with overly long reason."""
        long_reason = "A" * 501
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        
        with pytest.raises(ValidationError, match="Blocking reason cannot exceed 500 characters"):
            await item_rental_blocking_service.block_item_rental(
                item_id=test_item.id,
                reason=long_reason,
                blocked_by=uuid4()
            )
    
    async def test_validate_bulk_block_empty_list(self, item_rental_blocking_service):
        """Test validation with empty item list for bulk blocking."""
        with pytest.raises(ValidationError, match="Item IDs list cannot be empty"):
            await item_rental_blocking_service.bulk_block_items(
                item_ids=[],
                reason="Test reason",
                blocked_by=uuid4()
            )
    
    async def test_validate_bulk_block_too_many_items(self, item_rental_blocking_service):
        """Test validation with too many items for bulk operation."""
        # Create list with more than allowed maximum
        item_ids = [uuid4() for _ in range(1001)]  # Assuming max is 1000
        
        with pytest.raises(ValidationError, match="Cannot block more than 1000 items at once"):
            await item_rental_blocking_service.bulk_block_items(
                item_ids=item_ids,
                reason="Test reason",
                blocked_by=uuid4()
            )
    
    async def test_validate_user_id_none(self, item_rental_blocking_service, test_item):
        """Test validation with None user ID."""
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        
        with pytest.raises(ValidationError, match="Blocked by user ID cannot be None"):
            await item_rental_blocking_service.block_item_rental(
                item_id=test_item.id,
                reason="Test reason",
                blocked_by=None
            )


@pytest.mark.unit
@pytest.mark.asyncio
class TestItemRentalBlockingHistory:
    """Test rental blocking history functionality."""
    
    async def test_create_blocking_history_entry(self, item_rental_blocking_service):
        """Test creating a blocking history entry."""
        item_id = uuid4()
        user_id = uuid4()
        reason = "Scheduled maintenance"
        
        mock_entry = {
            "id": uuid4(),
            "item_id": item_id,
            "action": "BLOCKED",
            "reason": reason,
            "performed_by": user_id,
            "performed_at": datetime.now()
        }
        
        item_rental_blocking_service.item_repository.create_blocking_history = AsyncMock(
            return_value=mock_entry
        )
        
        entry = await item_rental_blocking_service._create_blocking_history_entry(
            item_id=item_id,
            action="BLOCKED",
            reason=reason,
            performed_by=user_id
        )
        
        assert entry["action"] == "BLOCKED"
        assert entry["reason"] == reason
        assert entry["performed_by"] == user_id
    
    async def test_create_unblocking_history_entry(self, item_rental_blocking_service):
        """Test creating an unblocking history entry."""
        item_id = uuid4()
        user_id = uuid4()
        
        mock_entry = {
            "id": uuid4(),
            "item_id": item_id,
            "action": "UNBLOCKED",
            "reason": None,
            "performed_by": user_id,
            "performed_at": datetime.now()
        }
        
        item_rental_blocking_service.item_repository.create_blocking_history = AsyncMock(
            return_value=mock_entry
        )
        
        entry = await item_rental_blocking_service._create_blocking_history_entry(
            item_id=item_id,
            action="UNBLOCKED",
            performed_by=user_id
        )
        
        assert entry["action"] == "UNBLOCKED"
        assert entry["reason"] is None
    
    async def test_get_history_with_pagination(self, item_rental_blocking_service):
        """Test retrieving history with pagination."""
        item_id = uuid4()
        
        item_rental_blocking_service.item_repository.get_rental_blocking_history = AsyncMock()
        
        await item_rental_blocking_service.get_rental_blocking_history(
            item_id=item_id,
            page=2,
            page_size=10
        )
        
        item_rental_blocking_service.item_repository.get_rental_blocking_history.assert_called_with(
            item_id=item_id,
            page=2,
            page_size=10
        )
    
    async def test_get_history_summary(self, item_rental_blocking_service):
        """Test retrieving blocking history summary."""
        item_id = uuid4()
        mock_summary = {
            "total_blocks": 5,
            "total_unblocks": 4,
            "currently_blocked": True,
            "last_blocked_at": datetime.now(),
            "total_blocked_duration": 3600,  # seconds
            "most_common_reason": "Maintenance"
        }
        
        item_rental_blocking_service.item_repository.get_blocking_summary = AsyncMock(
            return_value=mock_summary
        )
        
        summary = await item_rental_blocking_service.get_blocking_summary(item_id)
        
        assert summary["total_blocks"] == 5
        assert summary["currently_blocked"] is True
        assert "most_common_reason" in summary


@pytest.mark.unit
@pytest.mark.asyncio
class TestItemRentalBlockingErrorHandling:
    """Test error handling in rental blocking service."""
    
    async def test_database_error_in_blocking(self, item_rental_blocking_service, test_item):
        """Test handling database errors during blocking."""
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        item_rental_blocking_service.item_repository.update = AsyncMock(
            side_effect=Exception("Database error")
        )
        
        with pytest.raises(Exception, match="Database error"):
            await item_rental_blocking_service.block_item_rental(
                item_id=test_item.id,
                reason="Test reason",
                blocked_by=uuid4()
            )
    
    async def test_database_error_in_history_retrieval(self, item_rental_blocking_service):
        """Test handling database errors during history retrieval."""
        item_id = uuid4()
        item_rental_blocking_service.item_repository.get_rental_blocking_history = AsyncMock(
            side_effect=Exception("Database connection failed")
        )
        
        with pytest.raises(Exception, match="Database connection failed"):
            await item_rental_blocking_service.get_rental_blocking_history(item_id)
    
    async def test_concurrent_blocking_conflict(self, item_rental_blocking_service, test_item):
        """Test handling concurrent blocking attempts."""
        # Simulate a race condition where item gets blocked between check and update
        test_item.is_rental_blocked = False
        item_rental_blocking_service.item_repository.get = AsyncMock(return_value=test_item)
        
        # Mock update to simulate conflict
        from app.core.exceptions import ConflictError
        item_rental_blocking_service.item_repository.update = AsyncMock(
            side_effect=ConflictError("Item was blocked by another user")
        )
        
        with pytest.raises(ConflictError, match="Item was blocked by another user"):
            await item_rental_blocking_service.block_item_rental(
                item_id=test_item.id,
                reason="Test reason",
                blocked_by=uuid4()
            )
    
    async def test_partial_bulk_operation_rollback(self, item_rental_blocking_service):
        """Test rollback behavior in partial bulk operation failures."""
        item_ids = [uuid4(), uuid4(), uuid4()]
        
        # Mock partial failure that should trigger rollback
        item_rental_blocking_service.item_repository.bulk_block_rental = AsyncMock(
            side_effect=Exception("Bulk operation failed")
        )
        
        with pytest.raises(Exception, match="Bulk operation failed"):
            await item_rental_blocking_service.bulk_block_items(
                item_ids=item_ids,
                reason="Test reason",
                blocked_by=uuid4()
            )