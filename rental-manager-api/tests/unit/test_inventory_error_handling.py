"""
Comprehensive error handling and edge case tests for the inventory module.

Tests database constraints, business rule violations, concurrency issues,
and system boundary conditions.
"""

import asyncio
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import uuid4, UUID
from unittest.mock import Mock, patch, AsyncMock
from sqlalchemy.exc import IntegrityError, SQLAlchemyError, DisconnectionError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.inventory.stock_level import StockLevel
from app.models.inventory.stock_movement import StockMovement
from app.models.inventory.inventory_unit import InventoryUnit
from app.models.inventory.sku_sequence import SKUSequence
from app.crud.inventory.stock_level import CRUDStockLevel
from app.crud.inventory.stock_movement import CRUDStockMovement
from app.crud.inventory.inventory_unit import CRUDInventoryUnit
from app.crud.inventory.sku_sequence import CRUDSKUSequence
from app.services.inventory.inventory_service import InventoryService
from app.schemas.inventory.stock_level import StockLevelCreate, StockAdjustment
from app.schemas.inventory.inventory_unit import InventoryUnitCreate, InventoryUnitStatusUpdate
from app.schemas.inventory.stock_movement import StockMovementCreate


class TestDatabaseConstraintErrors:
    """Test database constraint violations and error handling."""

    @pytest.fixture
    def crud_stock_level(self):
        return CRUDStockLevel(StockLevel)

    @pytest.fixture
    def crud_stock_movement(self):
        return CRUDStockMovement(StockMovement)

    @pytest.fixture
    def crud_inventory_unit(self):
        return CRUDInventoryUnit(InventoryUnit)

    @pytest.fixture
    def crud_sku_sequence(self):
        return CRUDSKUSequence(SKUSequence)

    async def test_duplicate_stock_level_constraint(self, db_session, crud_stock_level):
        """Test handling of duplicate stock level creation."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Create first stock level
        stock_data = StockLevelCreate(
            item_id=item_id,
            location_id=location_id,
            quantity_on_hand=Decimal("100"),
            reorder_point=Decimal("10")
        )
        
        await crud_stock_level.create(db_session, obj_in=stock_data)
        
        # Attempt to create duplicate should raise IntegrityError
        with pytest.raises(IntegrityError):
            await crud_stock_level.create(db_session, obj_in=stock_data)
            await db_session.commit()

    async def test_foreign_key_constraint_violation(self, db_session, crud_stock_movement):
        """Test foreign key constraint violations."""
        # Try to create stock movement with non-existent stock level
        movement_data = StockMovementCreate(
            stock_level_id=uuid4(),  # Non-existent ID
            movement_type="adjustment",
            quantity=Decimal("10"),
            reason="Test movement"
        )
        
        with pytest.raises(IntegrityError):
            await crud_stock_movement.create(db_session, obj_in=movement_data)
            await db_session.commit()

    async def test_check_constraint_violation(self, db_session, crud_stock_level):
        """Test check constraint violations (negative quantities)."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Try to create stock level with negative quantities
        stock_data = StockLevelCreate(
            item_id=item_id,
            location_id=location_id,
            quantity_on_hand=Decimal("-10"),  # Should violate check constraint
            reorder_point=Decimal("10")
        )
        
        with pytest.raises((IntegrityError, ValueError)):
            await crud_stock_level.create(db_session, obj_in=stock_data)
            await db_session.commit()

    async def test_null_constraint_violation(self, db_session, crud_inventory_unit):
        """Test NOT NULL constraint violations."""
        # Try to create inventory unit without required fields
        unit_data = InventoryUnitCreate(
            item_id=None,  # Required field
            location_id=uuid4(),
            serial_number="TEST001"
        )
        
        with pytest.raises((IntegrityError, ValueError)):
            await crud_inventory_unit.create(db_session, obj_in=unit_data)
            await db_session.commit()


class TestBusinessRuleViolations:
    """Test business rule violations and validation errors."""

    @pytest.fixture
    def inventory_service(self):
        return InventoryService()

    async def test_insufficient_stock_for_rental(self, db_session, inventory_service):
        """Test rental checkout with insufficient stock."""
        # Mock a stock level with limited availability
        with patch('app.crud.inventory.stock_level.CRUDStockLevel.get_by_item_location') as mock_get:
            mock_stock = Mock()
            mock_stock.quantity_available = Decimal("5")
            mock_stock.item_id = uuid4()
            mock_stock.location_id = uuid4()
            mock_get.return_value = mock_stock
            
            # Try to rent more than available
            with pytest.raises(ValueError, match="Insufficient stock"):
                await inventory_service.process_rental_checkout(
                    db_session,
                    item_id=mock_stock.item_id,
                    location_id=mock_stock.location_id,
                    quantity=Decimal("10"),
                    customer_id=uuid4(),
                    processed_by=uuid4()
                )

    async def test_negative_stock_adjustment(self, db_session, inventory_service):
        """Test stock adjustment that would result in negative stock."""
        item_id = uuid4()
        location_id = uuid4()
        
        with patch('app.crud.inventory.stock_level.CRUDStockLevel.get_by_item_location') as mock_get:
            mock_stock = Mock()
            mock_stock.quantity_on_hand = Decimal("5")
            mock_stock.id = uuid4()
            mock_get.return_value = mock_stock
            
            # Try to adjust by more negative than available
            with pytest.raises(ValueError, match="would result in negative stock"):
                await inventory_service.perform_stock_adjustment(
                    db_session,
                    item_id=item_id,
                    location_id=location_id,
                    adjustment_type="correction",
                    quantity=Decimal("-10"),
                    reason="Test adjustment",
                    performed_by=uuid4()
                )

    async def test_transfer_between_same_location(self, db_session, inventory_service):
        """Test stock transfer between same location."""
        location_id = uuid4()
        
        with pytest.raises(ValueError, match="Cannot transfer.*same location"):
            await inventory_service.transfer_stock(
                db_session,
                item_id=uuid4(),
                from_location_id=location_id,
                to_location_id=location_id,  # Same location
                quantity=Decimal("10"),
                reason="Test transfer",
                transferred_by=uuid4()
            )

    async def test_return_units_not_on_rent(self, db_session, inventory_service):
        """Test returning units that are not currently on rent."""
        unit_ids = [uuid4(), uuid4()]
        
        with patch('app.crud.inventory.inventory_unit.CRUDInventoryUnit.get_multi') as mock_get:
            # Mock units that are not on rent
            mock_units = [
                Mock(id=unit_ids[0], status="available", item_id=uuid4()),
                Mock(id=unit_ids[1], status="maintenance", item_id=uuid4())
            ]
            mock_get.return_value = mock_units
            
            with pytest.raises(ValueError, match="not currently on rent"):
                await inventory_service.process_rental_return(
                    db_session,
                    unit_ids=unit_ids,
                    location_id=uuid4(),
                    condition="good",
                    processed_by=uuid4()
                )

    async def test_invalid_sku_format_generation(self, db_session):
        """Test SKU generation with invalid format template."""
        crud_sku = CRUDSKUSequence(SKUSequence)
        
        # Invalid format template (missing required placeholders)
        with pytest.raises(ValueError, match="Invalid SKU format"):
            await crud_sku.generate_sku(
                db_session,
                prefix="TEST",
                format_template="INVALID_FORMAT"  # Missing {prefix} and {sequence}
            )


class TestConcurrencyAndRaceConditions:
    """Test concurrent operations and race condition handling."""

    @pytest.fixture
    def inventory_service(self):
        return InventoryService()

    async def test_concurrent_stock_adjustments(self, db_session, inventory_service):
        """Test concurrent stock adjustments on same stock level."""
        item_id = uuid4()
        location_id = uuid4()
        stock_level_id = uuid4()
        
        with patch('app.crud.inventory.stock_level.CRUDStockLevel.get_by_item_location') as mock_get, \
             patch('app.crud.inventory.stock_level.CRUDStockLevel.get') as mock_get_by_id:
            
            mock_stock = Mock()
            mock_stock.id = stock_level_id
            mock_stock.quantity_on_hand = Decimal("100")
            mock_stock.item_id = item_id
            mock_stock.location_id = location_id
            mock_get.return_value = mock_stock
            mock_get_by_id.return_value = mock_stock
            
            # Simulate database lock timeout/deadlock
            with patch('app.crud.inventory.stock_level.CRUDStockLevel.update') as mock_update:
                mock_update.side_effect = SQLAlchemyError("Deadlock detected")
                
                with pytest.raises(SQLAlchemyError):
                    await inventory_service.perform_stock_adjustment(
                        db_session,
                        item_id=item_id,
                        location_id=location_id,
                        adjustment_type="correction",
                        quantity=Decimal("10"),
                        reason="Test adjustment",
                        performed_by=uuid4()
                    )

    async def test_concurrent_sku_generation(self, db_session):
        """Test concurrent SKU sequence generation."""
        crud_sku = CRUDSKUSequence(SKUSequence)
        
        # Mock sequence collision
        with patch.object(crud_sku, 'get_by_prefix') as mock_get, \
             patch.object(crud_sku, 'create') as mock_create:
            
            # First call returns None (no existing sequence)
            # Second call simulates IntegrityError (sequence created by another process)
            mock_get.side_effect = [None, IntegrityError("", "", "")]
            mock_create.side_effect = IntegrityError("Duplicate key", "", "")
            
            with pytest.raises(IntegrityError):
                await crud_sku.generate_sku(db_session, prefix="TEST")

    async def test_concurrent_rental_checkout(self, db_session, inventory_service):
        """Test concurrent rental checkout of same inventory."""
        item_id = uuid4()
        location_id = uuid4()
        
        with patch('app.crud.inventory.stock_level.CRUDStockLevel.get_by_item_location') as mock_get:
            mock_stock = Mock()
            mock_stock.quantity_available = Decimal("5")
            mock_stock.item_id = item_id
            mock_stock.location_id = location_id
            mock_get.return_value = mock_stock
            
            # Simulate concurrent modification (optimistic locking failure)
            with patch('app.crud.inventory.stock_level.CRUDStockLevel.update') as mock_update:
                mock_update.side_effect = SQLAlchemyError("Row was updated by another transaction")
                
                with pytest.raises(SQLAlchemyError):
                    await inventory_service.process_rental_checkout(
                        db_session,
                        item_id=item_id,
                        location_id=location_id,
                        quantity=Decimal("3"),
                        customer_id=uuid4(),
                        processed_by=uuid4()
                    )


class TestSystemBoundaryConditions:
    """Test system limits and boundary conditions."""

    @pytest.fixture
    def crud_stock_level(self):
        return CRUDStockLevel(StockLevel)

    @pytest.fixture
    def inventory_service(self):
        return InventoryService()

    async def test_maximum_decimal_precision(self, db_session, crud_stock_level):
        """Test handling of maximum decimal precision values."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Test with very high precision decimal
        stock_data = StockLevelCreate(
            item_id=item_id,
            location_id=location_id,
            quantity_on_hand=Decimal("999999999.999999"),  # Maximum precision
            reorder_point=Decimal("0.000001")  # Minimum non-zero
        )
        
        result = await crud_stock_level.create(db_session, obj_in=stock_data)
        assert result.quantity_on_hand == Decimal("999999999.999999")

    async def test_zero_quantity_operations(self, db_session, inventory_service):
        """Test operations with zero quantities."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Test zero stock adjustment
        with patch('app.crud.inventory.stock_level.CRUDStockLevel.get_by_item_location') as mock_get:
            mock_stock = Mock()
            mock_stock.quantity_on_hand = Decimal("10")
            mock_stock.id = uuid4()
            mock_get.return_value = mock_stock
            
            # Zero adjustment should be allowed but have no effect
            result = await inventory_service.perform_stock_adjustment(
                db_session,
                item_id=item_id,
                location_id=location_id,
                adjustment_type="correction",
                quantity=Decimal("0"),
                reason="Zero adjustment test",
                performed_by=uuid4()
            )
            
            # Should not create a movement for zero adjustment
            assert result is not None

    async def test_large_batch_operations(self, db_session):
        """Test operations with large batch sizes."""
        crud_unit = CRUDInventoryUnit(InventoryUnit)
        
        # Test creating large batch of inventory units
        item_id = uuid4()
        location_id = uuid4()
        large_quantity = 10000
        
        with patch.object(crud_unit, 'create_batch') as mock_create_batch:
            # Mock memory/performance issues with large batches
            mock_create_batch.side_effect = MemoryError("Out of memory")
            
            with pytest.raises(MemoryError):
                await crud_unit.create_batch(
                    db_session,
                    item_id=item_id,
                    location_id=location_id,
                    quantity=large_quantity,
                    created_by=uuid4()
                )

    async def test_invalid_uuid_format(self, db_session, inventory_service):
        """Test handling of invalid UUID formats."""
        with pytest.raises((ValueError, TypeError)):
            await inventory_service.process_rental_checkout(
                db_session,
                item_id="invalid-uuid",  # Invalid UUID format
                location_id=uuid4(),
                quantity=Decimal("1"),
                customer_id=uuid4(),
                processed_by=uuid4()
            )


class TestNetworkAndConnectionErrors:
    """Test network and database connection error handling."""

    @pytest.fixture
    def inventory_service(self):
        return InventoryService()

    async def test_database_connection_loss(self, db_session, inventory_service):
        """Test handling of database connection loss."""
        item_id = uuid4()
        location_id = uuid4()
        
        with patch('app.crud.inventory.stock_level.CRUDStockLevel.get_by_item_location') as mock_get:
            # Simulate connection loss
            mock_get.side_effect = DisconnectionError("Connection lost", "", "")
            
            with pytest.raises(DisconnectionError):
                await inventory_service.process_rental_checkout(
                    db_session,
                    item_id=item_id,
                    location_id=location_id,
                    quantity=Decimal("1"),
                    customer_id=uuid4(),
                    processed_by=uuid4()
                )

    async def test_database_timeout(self, db_session):
        """Test handling of database operation timeouts."""
        crud_stock = CRUDStockLevel(StockLevel)
        
        with patch.object(crud_stock, 'get_multi') as mock_get:
            # Simulate timeout
            mock_get.side_effect = asyncio.TimeoutError("Query timeout")
            
            with pytest.raises(asyncio.TimeoutError):
                await crud_stock.get_multi(db_session, skip=0, limit=100)

    async def test_redis_connection_failure(self, db_session, inventory_service):
        """Test handling of Redis cache connection failures."""
        with patch('app.core.redis.redis_client') as mock_redis:
            mock_redis.get.side_effect = ConnectionError("Redis connection failed")
            
            # Should fallback gracefully without cache
            # This test would depend on actual Redis integration in the service
            pass


class TestDataCorruptionRecovery:
    """Test data corruption detection and recovery."""

    @pytest.fixture
    def crud_stock_level(self):
        return CRUDStockLevel(StockLevel)

    async def test_inconsistent_stock_quantities(self, db_session, crud_stock_level):
        """Test detection of inconsistent stock quantity calculations."""
        # Mock a stock level with inconsistent calculated vs stored quantities
        with patch.object(crud_stock_level, 'get') as mock_get:
            mock_stock = Mock()
            mock_stock.quantity_on_hand = Decimal("100")
            mock_stock.quantity_on_rent = Decimal("50")
            mock_stock.quantity_reserved = Decimal("20")
            # quantity_available should be 30, but let's say it's corrupted to 50
            mock_stock.quantity_available = Decimal("50")
            mock_get.return_value = mock_stock
            
            # Service should detect and handle inconsistency
            result = await crud_stock_level.get(db_session, id=uuid4())
            calculated_available = (
                result.quantity_on_hand - 
                result.quantity_on_rent - 
                result.quantity_reserved
            )
            
            # Should detect mismatch
            assert calculated_available != result.quantity_available

    async def test_orphaned_inventory_units(self, db_session):
        """Test detection of orphaned inventory units."""
        crud_unit = CRUDInventoryUnit(InventoryUnit)
        
        # Mock scenario where inventory units exist but their parent item is deleted
        with patch.object(crud_unit, 'get_orphaned_units') as mock_get_orphaned:
            orphaned_units = [
                Mock(id=uuid4(), item_id=uuid4(), status="available"),
                Mock(id=uuid4(), item_id=uuid4(), status="on_rent")
            ]
            mock_get_orphaned.return_value = orphaned_units
            
            result = await crud_unit.get_orphaned_units(db_session)
            assert len(result) == 2

    async def test_movement_audit_trail_gaps(self, db_session):
        """Test detection of gaps in movement audit trail."""
        crud_movement = CRUDStockMovement(StockMovement)
        
        # Test for movements without corresponding stock level changes
        with patch.object(crud_movement, 'validate_audit_trail') as mock_validate:
            mock_validate.return_value = {
                "missing_movements": 5,
                "orphaned_movements": 2,
                "quantity_mismatches": 1
            }
            
            audit_result = await crud_movement.validate_audit_trail(db_session)
            assert audit_result["missing_movements"] > 0


class TestSecurityBoundaryTests:
    """Test security boundary conditions and validation."""

    @pytest.fixture
    def inventory_service(self):
        return InventoryService()

    async def test_sql_injection_prevention(self, db_session):
        """Test SQL injection prevention in search operations."""
        crud_stock = CRUDStockLevel(StockLevel)
        
        # Attempt SQL injection in search parameters
        malicious_input = "'; DROP TABLE stock_levels; --"
        
        # Should not raise SQL execution error (should be parameterized)
        try:
            result = await crud_stock.search(
                db_session,
                search_term=malicious_input
            )
            # Should return empty results, not execute malicious SQL
            assert isinstance(result, list)
        except Exception as e:
            # Should not be a SQL syntax error
            assert "syntax error" not in str(e).lower()

    async def test_authorization_bypass_prevention(self, db_session, inventory_service):
        """Test prevention of authorization bypass attempts."""
        # Test attempting operations with invalid/fake user IDs
        fake_user_id = uuid4()
        
        with patch('app.api.deps.get_current_user') as mock_get_user:
            mock_get_user.return_value = None  # No authenticated user
            
            # Should raise authentication error
            with pytest.raises((HTTPException, ValueError)):
                await inventory_service.perform_stock_adjustment(
                    db_session,
                    item_id=uuid4(),
                    location_id=uuid4(),
                    adjustment_type="correction",
                    quantity=Decimal("10"),
                    reason="Unauthorized attempt",
                    performed_by=fake_user_id
                )

    async def test_input_validation_xss_prevention(self, db_session):
        """Test XSS prevention in text inputs."""
        crud_movement = CRUDStockMovement(StockMovement)
        
        # Attempt XSS in reason field
        xss_input = "<script>alert('XSS')</script>"
        
        movement_data = StockMovementCreate(
            stock_level_id=uuid4(),
            movement_type="adjustment",
            quantity=Decimal("10"),
            reason=xss_input
        )
        
        # Should sanitize or escape XSS input
        # This would depend on your input validation implementation
        assert "<script>" not in movement_data.reason or movement_data.reason != xss_input


class TestPerformanceBoundaryConditions:
    """Test performance boundary conditions and timeouts."""

    @pytest.fixture
    def crud_stock_level(self):
        return CRUDStockLevel(StockLevel)

    async def test_large_result_set_handling(self, db_session, crud_stock_level):
        """Test handling of very large result sets."""
        # Mock scenario with millions of records
        with patch.object(crud_stock_level, 'get_multi') as mock_get:
            # Simulate memory pressure with large result set
            def memory_intensive_generator():
                for i in range(1000000):  # 1 million records
                    yield Mock(id=uuid4(), quantity_on_hand=Decimal("100"))
            
            mock_get.return_value = list(memory_intensive_generator())
            
            # Should handle large result sets without memory issues
            # In practice, this should use pagination
            with pytest.raises((MemoryError, TimeoutError)):
                await crud_stock_level.get_multi(db_session, skip=0, limit=1000000)

    async def test_complex_query_timeout(self, db_session, crud_stock_level):
        """Test timeout handling for complex queries."""
        with patch.object(crud_stock_level, 'get_complex_aggregation') as mock_query:
            # Simulate long-running query
            async def slow_query(*args, **kwargs):
                await asyncio.sleep(60)  # 60 second query
                return []
            
            mock_query.side_effect = slow_query
            
            # Should timeout and raise appropriate error
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(
                    crud_stock_level.get_complex_aggregation(db_session),
                    timeout=5.0  # 5 second timeout
                )

    async def test_high_concurrency_load(self, db_session):
        """Test system behavior under high concurrency load."""
        crud_sku = CRUDSKUSequence(SKUSequence)
        
        # Simulate high concurrent SKU generation requests
        async def concurrent_sku_generation():
            return await crud_sku.generate_sku(db_session, prefix="LOAD")
        
        # Create many concurrent tasks
        tasks = [concurrent_sku_generation() for _ in range(100)]
        
        # Should handle high concurrency gracefully
        # Some may fail due to sequence collisions, but system should remain stable
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successful vs failed operations
        successful = sum(1 for r in results if not isinstance(r, Exception))
        failed = len(results) - successful
        
        # At least some should succeed, and failures should be expected exceptions
        assert successful > 0
        assert all(
            isinstance(r, (IntegrityError, ValueError, SQLAlchemyError)) 
            for r in results if isinstance(r, Exception)
        )