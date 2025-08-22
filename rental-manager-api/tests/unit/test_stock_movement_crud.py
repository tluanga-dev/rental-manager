"""
Comprehensive CRUD tests for StockMovement.

Tests all CRUD operations with edge cases, error conditions, and business logic validation.
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from unittest.mock import AsyncMock
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.crud.inventory.stock_movement import CRUDStockMovement, stock_movement
from app.models.inventory.stock_movement import StockMovement
from app.models.inventory.enums import StockMovementType
from app.schemas.inventory.stock_movement import (
    StockMovementCreate,
    StockMovementUpdate,
    StockMovementFilter
)


class TestCRUDStockMovement:
    """Test suite for StockMovement CRUD operations."""
    
    @pytest_asyncio.fixture
    async def crud_instance(self):
        """Create CRUD instance for testing."""
        return CRUDStockMovement(StockMovement)
    
    @pytest_asyncio.fixture
    async def sample_stock_movement_data(self):
        """Sample stock movement data for testing."""
        return {
            "movement_type": StockMovementType.PURCHASE,
            "quantity_change": Decimal("10.00"),
            "quantity_before": Decimal("5.00"),
            "quantity_after": Decimal("15.00"),
            "unit_cost": Decimal("25.50"),
            "reference_number": "PO-2024-001",
            "reason": "Initial purchase",
            "notes": "First stock purchase",
            "movement_date": datetime.utcnow(),
            "stock_level_id": uuid4(),
            "item_id": uuid4(),
            "location_id": uuid4(),
            "performed_by_id": uuid4()
        }
    
    @pytest_asyncio.fixture
    async def stock_movement_create_schema(self, sample_stock_movement_data):
        """Create StockMovementCreate schema."""
        return StockMovementCreate(**sample_stock_movement_data)
    
    # CREATE TESTS
    
    @pytest.mark.asyncio
    async def test_create_movement_success(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        stock_movement_create_schema: StockMovementCreate
    ):
        """Test successful stock movement creation."""
        performed_by = uuid4()
        
        # Create movement
        movement = await crud_instance.create_movement(
            db_session,
            movement_in=stock_movement_create_schema,
            performed_by=performed_by
        )
        
        # Assertions
        assert movement.id is not None
        assert movement.movement_type == StockMovementType.PURCHASE
        assert movement.quantity_change == Decimal("10.00")
        assert movement.quantity_before == Decimal("5.00")
        assert movement.quantity_after == Decimal("15.00")
        assert movement.performed_by_id == performed_by
        assert movement.total_cost == Decimal("255.00")  # 10 * 25.50
        assert movement.created_at is not None
    
    @pytest.mark.asyncio
    async def test_create_movement_with_validation_error(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        sample_stock_movement_data
    ):
        """Test movement creation with math validation error."""
        # Create invalid data (math doesn't add up)
        sample_stock_movement_data["quantity_after"] = Decimal("20.00")  # Should be 15.00
        movement_in = StockMovementCreate(**sample_stock_movement_data)
        
        # Should raise validation error
        with pytest.raises(ValueError, match="Quantity math error"):
            await crud_instance.create_movement(
                db_session,
                movement_in=movement_in,
                performed_by=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_create_adjustment_without_reason(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        sample_stock_movement_data
    ):
        """Test adjustment creation without required reason."""
        sample_stock_movement_data["movement_type"] = StockMovementType.ADJUSTMENT_POSITIVE
        sample_stock_movement_data["reason"] = None
        movement_in = StockMovementCreate(**sample_stock_movement_data)
        
        with pytest.raises(ValueError, match="Reason is required for adjustments"):
            await crud_instance.create_movement(
                db_session,
                movement_in=movement_in,
                performed_by=uuid4()
            )
    
    @pytest.mark.asyncio
    async def test_create_movement_calculates_total_cost(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        sample_stock_movement_data
    ):
        """Test that total cost is calculated correctly."""
        movement_in = StockMovementCreate(**sample_stock_movement_data)
        
        movement = await crud_instance.create_movement(
            db_session,
            movement_in=movement_in,
            performed_by=uuid4()
        )
        
        expected_total = abs(movement.quantity_change) * movement.unit_cost
        assert movement.total_cost == expected_total
    
    @pytest.mark.asyncio
    async def test_create_movement_without_unit_cost(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        sample_stock_movement_data
    ):
        """Test movement creation without unit cost."""
        sample_stock_movement_data["unit_cost"] = None
        movement_in = StockMovementCreate(**sample_stock_movement_data)
        
        movement = await crud_instance.create_movement(
            db_session,
            movement_in=movement_in,
            performed_by=uuid4()
        )
        
        assert movement.unit_cost is None
        assert movement.total_cost is None
    
    # READ TESTS
    
    @pytest.mark.asyncio
    async def test_get_by_stock_level(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        stock_movement_create_schema: StockMovementCreate
    ):
        """Test getting movements by stock level."""
        stock_level_id = uuid4()
        
        # Create multiple movements for same stock level
        movements_data = [
            stock_movement_create_schema.dict(),
            stock_movement_create_schema.dict(),
            stock_movement_create_schema.dict()
        ]
        
        for data in movements_data:
            data["stock_level_id"] = stock_level_id
            data["quantity_before"] = Decimal("0.00")
            data["quantity_after"] = data["quantity_change"]
            movement_in = StockMovementCreate(**data)
            await crud_instance.create_movement(
                db_session,
                movement_in=movement_in,
                performed_by=uuid4()
            )
        
        # Test retrieval
        movements = await crud_instance.get_by_stock_level(
            db_session,
            stock_level_id=stock_level_id
        )
        
        assert len(movements) == 3
        assert all(m.stock_level_id == stock_level_id for m in movements)
    
    @pytest.mark.asyncio
    async def test_get_by_stock_level_with_pagination(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        stock_movement_create_schema: StockMovementCreate
    ):
        """Test pagination in get_by_stock_level."""
        stock_level_id = uuid4()
        
        # Create 5 movements
        for i in range(5):
            data = stock_movement_create_schema.dict()
            data["stock_level_id"] = stock_level_id
            data["quantity_before"] = Decimal(f"{i}.00")
            data["quantity_after"] = Decimal(f"{i + 10}.00")
            movement_in = StockMovementCreate(**data)
            await crud_instance.create_movement(
                db_session,
                movement_in=movement_in,
                performed_by=uuid4()
            )
        
        # Test pagination
        page1 = await crud_instance.get_by_stock_level(
            db_session,
            stock_level_id=stock_level_id,
            skip=0,
            limit=2
        )
        page2 = await crud_instance.get_by_stock_level(
            db_session,
            stock_level_id=stock_level_id,
            skip=2,
            limit=2
        )
        
        assert len(page1) == 2
        assert len(page2) == 2
        # Ensure different movements (ordered by movement_date desc)
        assert page1[0].id != page2[0].id
    
    @pytest.mark.asyncio
    async def test_get_by_item(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        stock_movement_create_schema: StockMovementCreate
    ):
        """Test getting movements by item."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Create movements for item
        for i in range(3):
            data = stock_movement_create_schema.dict()
            data["item_id"] = item_id
            data["location_id"] = location_id if i < 2 else uuid4()  # Mix locations
            data["quantity_before"] = Decimal(f"{i}.00")
            data["quantity_after"] = Decimal(f"{i + 10}.00")
            movement_in = StockMovementCreate(**data)
            await crud_instance.create_movement(
                db_session,
                movement_in=movement_in,
                performed_by=uuid4()
            )
        
        # Test get all movements for item
        all_movements = await crud_instance.get_by_item(
            db_session,
            item_id=item_id
        )
        assert len(all_movements) == 3
        
        # Test with location filter
        location_movements = await crud_instance.get_by_item(
            db_session,
            item_id=item_id,
            location_id=location_id
        )
        assert len(location_movements) == 2
    
    @pytest.mark.asyncio
    async def test_get_by_transaction(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        stock_movement_create_schema: StockMovementCreate
    ):
        """Test getting movements by transaction."""
        transaction_id = uuid4()
        
        # Create movements linked to transaction
        for i in range(3):
            data = stock_movement_create_schema.dict()
            data["transaction_header_id"] = transaction_id
            data["quantity_before"] = Decimal(f"{i}.00")
            data["quantity_after"] = Decimal(f"{i + 10}.00")
            movement_in = StockMovementCreate(**data)
            await crud_instance.create_movement(
                db_session,
                movement_in=movement_in,
                performed_by=uuid4()
            )
        
        movements = await crud_instance.get_by_transaction(
            db_session,
            transaction_header_id=transaction_id
        )
        
        assert len(movements) == 3
        assert all(m.transaction_header_id == transaction_id for m in movements)
    
    @pytest.mark.asyncio
    async def test_get_filtered_comprehensive(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        stock_movement_create_schema: StockMovementCreate
    ):
        """Test comprehensive filtering functionality."""
        item_id = uuid4()
        location_id = uuid4()
        user_id = uuid4()
        
        # Create diverse movements
        movements_data = [
            {
                **stock_movement_create_schema.dict(),
                "movement_type": StockMovementType.PURCHASE,
                "item_id": item_id,
                "location_id": location_id,
                "performed_by_id": user_id,
                "quantity_change": Decimal("5.00"),
                "quantity_before": Decimal("0.00"),
                "quantity_after": Decimal("5.00"),
                "movement_date": datetime.now() - timedelta(days=1)
            },
            {
                **stock_movement_create_schema.dict(),
                "movement_type": StockMovementType.SALE,
                "item_id": item_id,
                "location_id": location_id,
                "performed_by_id": user_id,
                "quantity_change": Decimal("-2.00"),
                "quantity_before": Decimal("5.00"),
                "quantity_after": Decimal("3.00"),
                "movement_date": datetime.now()
            },
            {
                **stock_movement_create_schema.dict(),
                "movement_type": StockMovementType.ADJUSTMENT_POSITIVE,
                "item_id": uuid4(),  # Different item
                "quantity_change": Decimal("10.00"),
                "quantity_before": Decimal("0.00"),
                "quantity_after": Decimal("10.00"),
            }
        ]
        
        for data in movements_data:
            movement_in = StockMovementCreate(**data)
            await crud_instance.create_movement(
                db_session,
                movement_in=movement_in,
                performed_by=uuid4()
            )
        
        # Test item filter
        filter_params = StockMovementFilter(item_id=item_id)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 2
        
        # Test movement type filter
        filter_params = StockMovementFilter(movement_type=StockMovementType.PURCHASE)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 1
        assert filtered[0].movement_type == StockMovementType.PURCHASE
        
        # Test quantity range filter
        filter_params = StockMovementFilter(min_quantity=Decimal("5.00"))
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) == 2  # Purchase (5) and Adjustment (10)
        
        # Test date range filter
        yesterday = datetime.now() - timedelta(days=1)
        today = datetime.now() + timedelta(hours=1)
        filter_params = StockMovementFilter(date_from=yesterday, date_to=today)
        filtered = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        assert len(filtered) >= 2  # Should include movements from yesterday and today
    
    @pytest.mark.asyncio
    async def test_get_summary_statistics(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        stock_movement_create_schema: StockMovementCreate
    ):
        """Test summary statistics generation."""
        item_id = uuid4()
        
        # Create movements with different types
        movements_data = [
            {
                **stock_movement_create_schema.dict(),
                "movement_type": StockMovementType.PURCHASE,
                "item_id": item_id,
                "quantity_change": Decimal("10.00"),
                "quantity_before": Decimal("0.00"),
                "quantity_after": Decimal("10.00"),
            },
            {
                **stock_movement_create_schema.dict(),
                "movement_type": StockMovementType.SALE,
                "item_id": item_id,
                "quantity_change": Decimal("-3.00"),
                "quantity_before": Decimal("10.00"),
                "quantity_after": Decimal("7.00"),
            },
            {
                **stock_movement_create_schema.dict(),
                "movement_type": StockMovementType.PURCHASE,
                "item_id": item_id,
                "quantity_change": Decimal("5.00"),
                "quantity_before": Decimal("7.00"),
                "quantity_after": Decimal("12.00"),
            }
        ]
        
        for data in movements_data:
            movement_in = StockMovementCreate(**data)
            await crud_instance.create_movement(
                db_session,
                movement_in=movement_in,
                performed_by=uuid4()
            )
        
        # Get summary
        summary = await crud_instance.get_summary(
            db_session,
            item_id=item_id
        )
        
        assert summary["total_movements"] == 3
        assert summary["total_increase"] == 15.0  # 10 + 5
        assert summary["total_decrease"] == 3.0   # 3
        assert summary["net_change"] == 12.0      # 15 - 3
        assert summary["movements_by_type"]["purchase"] == 2
        assert summary["movements_by_type"]["sale"] == 1
        assert summary["quantity_by_type"]["purchase"] == 15.0
        assert summary["quantity_by_type"]["sale"] == 3.0
    
    @pytest.mark.asyncio
    async def test_get_recent_movements(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        stock_movement_create_schema: StockMovementCreate
    ):
        """Test getting recent movements within time window."""
        current_time = datetime.utcnow()
        
        # Create movements at different times
        movements_data = [
            {
                **stock_movement_create_schema.dict(),
                "movement_date": current_time,  # Recent
                "quantity_before": Decimal("0.00"),
                "quantity_after": Decimal("10.00"),
            },
            {
                **stock_movement_create_schema.dict(),
                "movement_date": current_time - timedelta(hours=12),  # Recent
                "quantity_before": Decimal("10.00"),
                "quantity_after": Decimal("20.00"),
            },
            {
                **stock_movement_create_schema.dict(),
                "movement_date": current_time - timedelta(hours=30),  # Old
                "quantity_before": Decimal("20.00"),
                "quantity_after": Decimal("30.00"),
            }
        ]
        
        for data in movements_data:
            movement_in = StockMovementCreate(**data)
            await crud_instance.create_movement(
                db_session,
                movement_in=movement_in,
                performed_by=uuid4()
            )
        
        # Get recent movements (last 24 hours)
        recent = await crud_instance.get_recent_movements(
            db_session,
            hours=24
        )
        
        assert len(recent) == 2  # Only the recent ones
        
        # Test with shorter window
        very_recent = await crud_instance.get_recent_movements(
            db_session,
            hours=6
        )
        
        assert len(very_recent) == 1  # Only the most recent
    
    @pytest.mark.asyncio
    async def test_get_adjustments_pending_approval(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        sample_stock_movement_data
    ):
        """Test getting adjustments that need approval."""
        # Create approved adjustment
        approved_data = sample_stock_movement_data.copy()
        approved_data["movement_type"] = StockMovementType.ADJUSTMENT_POSITIVE
        approved_data["reason"] = "Stock correction"
        approved_movement_in = StockMovementCreate(**approved_data)
        approved_movement = await crud_instance.create_movement(
            db_session,
            movement_in=approved_movement_in,
            performed_by=uuid4()
        )
        # Approve it
        approved_movement.approved_by_id = uuid4()
        
        # Create pending adjustments
        pending_data = sample_stock_movement_data.copy()
        pending_data["movement_type"] = StockMovementType.ADJUSTMENT_NEGATIVE
        pending_data["reason"] = "Damage adjustment"
        pending_data["quantity_change"] = Decimal("-2.00")
        pending_data["quantity_after"] = Decimal("3.00")
        pending_movement_in = StockMovementCreate(**pending_data)
        await crud_instance.create_movement(
            db_session,
            movement_in=pending_movement_in,
            performed_by=uuid4()
        )
        
        # Get pending approvals
        pending = await crud_instance.get_adjustments_pending_approval(db_session)
        
        assert len(pending) == 1
        assert pending[0].movement_type == StockMovementType.ADJUSTMENT_NEGATIVE
        assert pending[0].approved_by_id is None
    
    # UPDATE TESTS
    
    @pytest.mark.asyncio
    async def test_approve_adjustment(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        sample_stock_movement_data
    ):
        """Test approving an adjustment movement."""
        # Create adjustment
        sample_stock_movement_data["movement_type"] = StockMovementType.SYSTEM_CORRECTION
        sample_stock_movement_data["reason"] = "System sync correction"
        movement_in = StockMovementCreate(**sample_stock_movement_data)
        movement = await crud_instance.create_movement(
            db_session,
            movement_in=movement_in,
            performed_by=uuid4()
        )
        
        # Approve it
        approver_id = uuid4()
        approval_notes = "Verified with physical count"
        
        approved = await crud_instance.approve_adjustment(
            db_session,
            movement_id=movement.id,
            approved_by=approver_id,
            notes=approval_notes
        )
        
        assert approved is not None
        assert approved.approved_by_id == approver_id
        assert approval_notes in approved.notes
    
    @pytest.mark.asyncio
    async def test_approve_nonexistent_movement(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement
    ):
        """Test approving a non-existent movement."""
        result = await crud_instance.approve_adjustment(
            db_session,
            movement_id=uuid4(),
            approved_by=uuid4()
        )
        
        assert result is None
    
    # BULK OPERATIONS TESTS
    
    @pytest.mark.asyncio
    async def test_create_bulk_movements(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        stock_movement_create_schema: StockMovementCreate
    ):
        """Test creating multiple movements in bulk."""
        # Create multiple movement schemas
        movements_data = []
        for i in range(3):
            data = stock_movement_create_schema.dict()
            data["quantity_before"] = Decimal(f"{i}.00")
            data["quantity_after"] = Decimal(f"{i + 10}.00")
            movements_data.append(StockMovementCreate(**data))
        
        # Create bulk
        movements = await crud_instance.create_bulk_movements(
            db_session,
            movements_in=movements_data,
            performed_by=uuid4()
        )
        
        assert len(movements) == 3
        assert all(m.id is not None for m in movements)
        assert all(m.performed_by_id is not None for m in movements)
    
    # ERROR HANDLING TESTS
    
    @pytest.mark.asyncio
    async def test_create_movement_with_invalid_foreign_key(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        sample_stock_movement_data
    ):
        """Test handling of invalid foreign key references."""
        # This would typically raise an IntegrityError in a real database
        # For in-memory SQLite tests, we'll simulate the validation
        movement_in = StockMovementCreate(**sample_stock_movement_data)
        
        # In a real scenario, this would fail at flush/commit time
        # Here we test that the movement object is created correctly
        movement = await crud_instance.create_movement(
            db_session,
            movement_in=movement_in,
            performed_by=uuid4()
        )
        
        assert movement.stock_level_id == sample_stock_movement_data["stock_level_id"]
        assert movement.item_id == sample_stock_movement_data["item_id"]
        assert movement.location_id == sample_stock_movement_data["location_id"]
    
    @pytest.mark.asyncio
    async def test_filter_with_invalid_dates(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement
    ):
        """Test filtering with invalid date ranges."""
        # Date range where start > end
        filter_params = StockMovementFilter(
            date_from=datetime.now(),
            date_to=datetime.now() - timedelta(days=1)
        )
        
        # Should not raise error, just return empty results
        movements = await crud_instance.get_filtered(
            db_session,
            filter_params=filter_params
        )
        
        assert isinstance(movements, list)
        # Could be empty if no movements exist in this invalid range
    
    @pytest.mark.asyncio
    async def test_get_summary_with_no_data(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement
    ):
        """Test summary generation with no movements."""
        summary = await crud_instance.get_summary(
            db_session,
            item_id=uuid4()
        )
        
        assert summary["total_movements"] == 0
        assert summary["total_increase"] == 0.0
        assert summary["total_decrease"] == 0.0
        assert summary["net_change"] == 0.0
        assert isinstance(summary["movements_by_type"], dict)
        assert isinstance(summary["quantity_by_type"], dict)
    
    # EDGE CASES
    
    @pytest.mark.asyncio
    async def test_movement_with_zero_quantity_change(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        sample_stock_movement_data
    ):
        """Test movement with zero quantity change."""
        sample_stock_movement_data["quantity_change"] = Decimal("0.00")
        sample_stock_movement_data["quantity_before"] = Decimal("10.00")
        sample_stock_movement_data["quantity_after"] = Decimal("10.00")
        movement_in = StockMovementCreate(**sample_stock_movement_data)
        
        movement = await crud_instance.create_movement(
            db_session,
            movement_in=movement_in,
            performed_by=uuid4()
        )
        
        assert movement.quantity_change == Decimal("0.00")
        assert movement.quantity_before == movement.quantity_after
    
    @pytest.mark.asyncio
    async def test_movement_with_large_quantities(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        sample_stock_movement_data
    ):
        """Test movement with very large quantities."""
        large_qty = Decimal("999999.99")
        sample_stock_movement_data["quantity_change"] = large_qty
        sample_stock_movement_data["quantity_before"] = Decimal("0.00")
        sample_stock_movement_data["quantity_after"] = large_qty
        movement_in = StockMovementCreate(**sample_stock_movement_data)
        
        movement = await crud_instance.create_movement(
            db_session,
            movement_in=movement_in,
            performed_by=uuid4()
        )
        
        assert movement.quantity_change == large_qty
        assert movement.quantity_after == large_qty
    
    @pytest.mark.asyncio
    async def test_movement_with_precision_handling(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        sample_stock_movement_data
    ):
        """Test decimal precision handling."""
        # Test with various decimal precisions
        sample_stock_movement_data["quantity_change"] = Decimal("10.123")  # 3 decimal places
        sample_stock_movement_data["quantity_before"] = Decimal("5.456")
        sample_stock_movement_data["quantity_after"] = Decimal("15.579")
        movement_in = StockMovementCreate(**sample_stock_movement_data)
        
        movement = await crud_instance.create_movement(
            db_session,
            movement_in=movement_in,
            performed_by=uuid4()
        )
        
        # Should be rounded to 2 decimal places
        assert movement.quantity_change == Decimal("10.12")
        assert movement.quantity_before == Decimal("5.46")
        assert movement.quantity_after == Decimal("15.58")
    
    # CONCURRENCY TESTS
    
    @pytest.mark.asyncio
    async def test_concurrent_movement_creation(
        self, 
        db_session: AsyncSession, 
        crud_instance: CRUDStockMovement,
        stock_movement_create_schema: StockMovementCreate
    ):
        """Test handling of concurrent movement creation."""
        import asyncio
        
        # Create multiple movements concurrently
        tasks = []
        for i in range(5):
            data = stock_movement_create_schema.dict()
            data["quantity_before"] = Decimal(f"{i}.00")
            data["quantity_after"] = Decimal(f"{i + 10}.00")
            movement_in = StockMovementCreate(**data)
            
            task = crud_instance.create_movement(
                db_session,
                movement_in=movement_in,
                performed_by=uuid4()
            )
            tasks.append(task)
        
        # Execute concurrently
        movements = await asyncio.gather(*tasks)
        
        assert len(movements) == 5
        assert all(m.id is not None for m in movements)
        # All movements should have unique IDs
        ids = [m.id for m in movements]
        assert len(set(ids)) == 5


class TestStockMovementSingleton:
    """Test the singleton instance."""
    
    def test_singleton_instance(self):
        """Test that the singleton instance is properly configured."""
        assert stock_movement is not None
        assert isinstance(stock_movement, CRUDStockMovement)
        assert stock_movement.model == StockMovement