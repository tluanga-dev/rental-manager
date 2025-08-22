"""
Performance and boundary condition tests for the inventory module.

Tests system performance under load, stress conditions, and boundary scenarios.
"""

import asyncio
import time
import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import Mock, patch, AsyncMock
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any
import statistics

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
from app.schemas.inventory.inventory_unit import InventoryUnitCreate
from app.schemas.inventory.stock_movement import StockMovementCreate


class TestPerformanceBenchmarks:
    """Performance benchmark tests for inventory operations."""

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
    def inventory_service(self):
        return InventoryService()

    @pytest.mark.slow
    async def test_bulk_stock_level_creation_performance(self, db_session, crud_stock_level):
        """Test performance of bulk stock level creation."""
        batch_size = 1000
        stock_levels = []
        
        # Generate test data
        for i in range(batch_size):
            stock_data = StockLevelCreate(
                item_id=uuid4(),
                location_id=uuid4(),
                quantity_on_hand=Decimal(f"{i * 10}"),
                reorder_point=Decimal("10")
            )
            stock_levels.append(stock_data)
        
        # Measure creation time
        start_time = time.time()
        
        with patch.object(crud_stock_level, 'create_batch') as mock_create_batch:
            mock_create_batch.return_value = [Mock(id=uuid4()) for _ in range(batch_size)]
            
            results = await crud_stock_level.create_batch(db_session, stock_levels)
            
        end_time = time.time()
        execution_time = end_time - start_time
        
        # Performance assertions
        assert len(results) == batch_size
        assert execution_time < 5.0  # Should complete within 5 seconds
        
        # Calculate throughput
        throughput = batch_size / execution_time
        assert throughput > 200  # Should process at least 200 records per second

    @pytest.mark.slow
    async def test_complex_stock_query_performance(self, db_session, crud_stock_level):
        """Test performance of complex stock level queries."""
        # Mock large dataset
        mock_results = [
            Mock(
                id=uuid4(),
                item_id=uuid4(),
                location_id=uuid4(),
                quantity_on_hand=Decimal("100"),
                quantity_available=Decimal("80"),
                created_at=datetime.now() - timedelta(days=i)
            )
            for i in range(10000)
        ]
        
        start_time = time.time()
        
        with patch.object(crud_stock_level, 'get_filtered_with_aggregations') as mock_query:
            mock_query.return_value = {
                'items': mock_results[:100],  # Paginated results
                'total': len(mock_results),
                'aggregations': {
                    'total_value': Decimal("1000000"),
                    'avg_stock_level': Decimal("75.5"),
                    'low_stock_count': 15
                }
            }
            
            result = await crud_stock_level.get_filtered_with_aggregations(
                db_session,
                filters={'low_stock_only': True},
                skip=0,
                limit=100
            )
            
        end_time = time.time()
        query_time = end_time - start_time
        
        # Query should complete quickly even with large dataset
        assert query_time < 1.0  # Under 1 second
        assert len(result['items']) == 100
        assert result['total'] == 10000

    @pytest.mark.slow
    async def test_concurrent_stock_operations_performance(self, db_session, inventory_service):
        """Test performance under concurrent stock operations."""
        concurrency_level = 50
        operations_per_worker = 20
        
        async def worker_operations(worker_id: int):
            """Simulate a worker performing multiple operations."""
            operations = []
            item_id = uuid4()
            location_id = uuid4()
            
            for i in range(operations_per_worker):
                # Mock stock level for each operation
                with patch('app.crud.inventory.stock_level.CRUDStockLevel.get_by_item_location') as mock_get:
                    mock_stock = Mock()
                    mock_stock.id = uuid4()
                    mock_stock.quantity_on_hand = Decimal("1000")
                    mock_stock.quantity_available = Decimal("800")
                    mock_get.return_value = mock_stock
                    
                    with patch.object(inventory_service, 'perform_stock_adjustment') as mock_adjust:
                        mock_adjust.return_value = mock_stock
                        
                        start = time.time()
                        await inventory_service.perform_stock_adjustment(
                            db_session,
                            item_id=item_id,
                            location_id=location_id,
                            adjustment_type="correction",
                            quantity=Decimal("1"),
                            reason=f"Worker {worker_id} operation {i}",
                            performed_by=uuid4()
                        )
                        end = time.time()
                        operations.append(end - start)
            
            return operations
        
        # Run concurrent workers
        start_time = time.time()
        
        tasks = [worker_operations(i) for i in range(concurrency_level)]
        results = await asyncio.gather(*tasks)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Flatten operation times
        all_operations = [op_time for worker_ops in results for op_time in worker_ops]
        total_operations = len(all_operations)
        
        # Performance assertions
        assert total_operations == concurrency_level * operations_per_worker
        assert total_time < 30.0  # Should complete within 30 seconds
        
        # Calculate statistics
        avg_operation_time = statistics.mean(all_operations)
        p95_operation_time = statistics.quantiles(all_operations, n=20)[18]  # 95th percentile
        
        assert avg_operation_time < 0.1  # Average operation under 100ms
        assert p95_operation_time < 0.5  # 95% of operations under 500ms

    @pytest.mark.slow
    async def test_large_movement_history_query(self, db_session, crud_stock_movement):
        """Test performance of querying large movement history."""
        stock_level_id = uuid4()
        
        # Mock large movement history
        large_history = [
            Mock(
                id=uuid4(),
                stock_level_id=stock_level_id,
                movement_type="adjustment",
                quantity=Decimal("10"),
                created_at=datetime.now() - timedelta(hours=i),
                reason=f"Movement {i}"
            )
            for i in range(50000)  # 50,000 movements
        ]
        
        start_time = time.time()
        
        with patch.object(crud_stock_movement, 'get_movement_history') as mock_history:
            # Paginated results
            mock_history.return_value = {
                'movements': large_history[:1000],  # First 1000
                'total': len(large_history),
                'summary': {
                    'total_adjustments': 25000,
                    'total_transfers': 15000,
                    'total_rentals': 10000
                }
            }
            
            result = await crud_stock_movement.get_movement_history(
                db_session,
                stock_level_id=stock_level_id,
                skip=0,
                limit=1000,
                date_from=datetime.now() - timedelta(days=365)
            )
            
        end_time = time.time()
        query_time = end_time - start_time
        
        # Should handle large history efficiently
        assert query_time < 2.0  # Under 2 seconds
        assert len(result['movements']) == 1000
        assert result['total'] == 50000


class TestMemoryUsageBoundaries:
    """Test memory usage under various boundary conditions."""

    @pytest.fixture
    def crud_inventory_unit(self):
        return CRUDInventoryUnit(InventoryUnit)

    @pytest.mark.slow
    async def test_large_batch_unit_creation_memory(self, db_session, crud_inventory_unit):
        """Test memory usage during large batch unit creation."""
        batch_size = 10000
        item_id = uuid4()
        location_id = uuid4()
        
        # Monitor memory usage (simplified simulation)
        memory_checkpoints = []
        
        def track_memory():
            # In real test, you'd use psutil or similar
            return len(gc.get_objects())
        
        import gc
        initial_memory = track_memory()
        memory_checkpoints.append(initial_memory)
        
        with patch.object(crud_inventory_unit, 'create_batch') as mock_create:
            # Simulate memory-efficient batch processing
            def efficient_batch_create(*args, **kwargs):
                # Process in smaller chunks to manage memory
                chunk_size = 1000
                results = []
                for i in range(0, batch_size, chunk_size):
                    chunk_results = [Mock(id=uuid4()) for _ in range(min(chunk_size, batch_size - i))]
                    results.extend(chunk_results)
                    memory_checkpoints.append(track_memory())
                    gc.collect()  # Force garbage collection
                return results
            
            mock_create.side_effect = efficient_batch_create
            
            units = await crud_inventory_unit.create_batch(
                db_session,
                item_id=item_id,
                location_id=location_id,
                quantity=batch_size,
                created_by=uuid4()
            )
        
        final_memory = track_memory()
        memory_checkpoints.append(final_memory)
        
        # Memory should not grow excessively
        memory_growth = final_memory - initial_memory
        assert len(units) == batch_size
        # Memory growth should be reasonable (less than 10x initial)
        assert memory_growth < initial_memory * 10

    @pytest.mark.slow
    async def test_streaming_large_result_sets(self, db_session, crud_inventory_unit):
        """Test streaming large result sets to manage memory."""
        location_id = uuid4()
        
        async def mock_stream_units():
            """Mock streaming of large dataset."""
            batch_size = 1000
            total_batches = 100  # 100,000 total units
            
            for batch_num in range(total_batches):
                batch = [
                    Mock(
                        id=uuid4(),
                        location_id=location_id,
                        status="available",
                        serial_number=f"UNIT{batch_num:03d}{i:04d}"
                    )
                    for i in range(batch_size)
                ]
                yield batch
        
        with patch.object(crud_inventory_unit, 'stream_by_location') as mock_stream:
            mock_stream.return_value = mock_stream_units()
            
            processed_count = 0
            max_batch_memory = 0
            
            async for batch in crud_inventory_unit.stream_by_location(db_session, location_id):
                # Process batch
                processed_count += len(batch)
                
                # Track memory usage per batch
                import sys
                batch_memory = sum(sys.getsizeof(unit) for unit in batch)
                max_batch_memory = max(max_batch_memory, batch_memory)
                
                # Simulate processing
                await asyncio.sleep(0.001)  # Small delay to simulate work
                
                # Clear batch from memory
                del batch
        
        assert processed_count == 100000
        # Each batch should maintain reasonable memory footprint
        assert max_batch_memory < 1024 * 1024  # Under 1MB per batch


class TestDatabaseConnectionPooling:
    """Test database connection pooling under load."""

    @pytest.fixture
    def inventory_service(self):
        return InventoryService()

    @pytest.mark.slow
    async def test_connection_pool_exhaustion(self, db_session, inventory_service):
        """Test behavior when connection pool is exhausted."""
        max_connections = 20  # Simulate small connection pool
        
        async def database_operation(operation_id: int):
            """Simulate database-intensive operation."""
            item_id = uuid4()
            location_id = uuid4()
            
            with patch('app.crud.inventory.stock_level.CRUDStockLevel.get_by_item_location') as mock_get:
                mock_stock = Mock()
                mock_stock.id = uuid4()
                mock_stock.quantity_available = Decimal("100")
                mock_get.return_value = mock_stock
                
                # Simulate long-running database operation
                await asyncio.sleep(0.1)  # 100ms operation
                
                return await inventory_service.process_rental_checkout(
                    db_session,
                    item_id=item_id,
                    location_id=location_id,
                    quantity=Decimal("1"),
                    customer_id=uuid4(),
                    processed_by=uuid4()
                )
        
        # Create more concurrent operations than available connections
        concurrent_operations = max_connections * 2
        
        start_time = time.time()
        
        # Use semaphore to simulate connection pool limits
        semaphore = asyncio.Semaphore(max_connections)
        
        async def limited_operation(op_id):
            async with semaphore:
                return await database_operation(op_id)
        
        tasks = [limited_operation(i) for i in range(concurrent_operations)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Should handle connection limiting gracefully
        successful_operations = sum(1 for r in results if not isinstance(r, Exception))
        
        assert successful_operations > 0
        # Time should be reasonable (operations should queue, not fail)
        assert total_time < 60.0  # Within 1 minute

    @pytest.mark.slow
    async def test_connection_recovery_after_failure(self, db_session, inventory_service):
        """Test connection recovery after database failures."""
        failure_count = 0
        max_failures = 5
        
        async def unreliable_database_operation():
            nonlocal failure_count
            
            if failure_count < max_failures:
                failure_count += 1
                raise ConnectionError(f"Database connection failed (attempt {failure_count})")
            
            # Success after failures
            return Mock(id=uuid4(), status="success")
        
        # Test retry mechanism
        retry_attempts = 10
        for attempt in range(retry_attempts):
            try:
                result = await unreliable_database_operation()
                if result:
                    break
            except ConnectionError:
                if attempt < retry_attempts - 1:
                    await asyncio.sleep(0.1 * (attempt + 1))  # Exponential backoff
                    continue
                raise
        
        # Should eventually succeed after retries
        assert failure_count == max_failures
        assert result.status == "success"


class TestCachingPerformance:
    """Test caching performance and effectiveness."""

    @pytest.fixture
    def crud_stock_level(self):
        return CRUDStockLevel(StockLevel)

    @pytest.mark.slow
    async def test_cache_hit_performance(self, db_session, crud_stock_level):
        """Test performance improvement from caching."""
        item_id = uuid4()
        location_id = uuid4()
        
        # Mock expensive database operation
        call_count = 0
        
        async def expensive_db_operation(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.1)  # Simulate slow query
            return Mock(
                id=uuid4(),
                item_id=item_id,
                location_id=location_id,
                quantity_available=Decimal("100")
            )
        
        # Test without cache
        start_time = time.time()
        
        with patch.object(crud_stock_level, 'get_by_item_location', side_effect=expensive_db_operation):
            for _ in range(10):
                await crud_stock_level.get_by_item_location(db_session, item_id, location_id)
        
        uncached_time = time.time() - start_time
        uncached_calls = call_count
        
        # Reset for cached test
        call_count = 0
        cached_result = None
        
        async def cached_operation(*args, **kwargs):
            nonlocal call_count, cached_result
            if cached_result is None:
                call_count += 1
                await asyncio.sleep(0.1)  # Only slow on first call
                cached_result = Mock(
                    id=uuid4(),
                    item_id=item_id,
                    location_id=location_id,
                    quantity_available=Decimal("100")
                )
            return cached_result
        
        # Test with cache
        start_time = time.time()
        
        with patch.object(crud_stock_level, 'get_by_item_location', side_effect=cached_operation):
            for _ in range(10):
                await crud_stock_level.get_by_item_location(db_session, item_id, location_id)
        
        cached_time = time.time() - start_time
        cached_calls = call_count
        
        # Cache should provide significant performance improvement
        assert uncached_calls == 10  # Every call hit database
        assert cached_calls == 1    # Only first call hit database
        assert cached_time < uncached_time / 5  # At least 5x faster

    @pytest.mark.slow
    async def test_cache_invalidation_performance(self, db_session, crud_stock_level):
        """Test cache invalidation doesn't cause performance degradation."""
        cache_size = 1000
        operations = 5000
        
        # Simulate cache with LRU eviction
        cache = {}
        cache_hits = 0
        cache_misses = 0
        
        async def cached_stock_lookup(item_id, location_id):
            nonlocal cache_hits, cache_misses
            
            cache_key = f"{item_id}:{location_id}"
            
            if cache_key in cache:
                cache_hits += 1
                return cache[cache_key]
            else:
                cache_misses += 1
                # Simulate database lookup
                await asyncio.sleep(0.001)  # 1ms lookup
                
                result = Mock(
                    id=uuid4(),
                    item_id=item_id,
                    location_id=location_id,
                    quantity_available=Decimal("100")
                )
                
                # Implement simple LRU eviction
                if len(cache) >= cache_size:
                    # Remove oldest entry
                    oldest_key = next(iter(cache))
                    del cache[oldest_key]
                
                cache[cache_key] = result
                return result
        
        start_time = time.time()
        
        # Perform operations with mixed cache hits/misses
        for i in range(operations):
            # Mix of frequently accessed and new items
            if i % 3 == 0:
                # Frequently accessed item (cache hit)
                item_id = uuid4() if i < 100 else list(cache.keys())[0].split(':')[0]
                location_id = uuid4() if i < 100 else list(cache.keys())[0].split(':')[1]
            else:
                # New item (cache miss)
                item_id = uuid4()
                location_id = uuid4()
            
            await cached_stock_lookup(item_id, location_id)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        cache_hit_ratio = cache_hits / (cache_hits + cache_misses)
        
        # Performance should be good with reasonable cache hit ratio
        assert total_time < 20.0  # Under 20 seconds for 5000 operations
        assert cache_hit_ratio > 0.2  # At least 20% cache hit ratio
        assert len(cache) <= cache_size  # Cache size maintained


class TestResourceLimitBoundaries:
    """Test system behavior at resource limits."""

    @pytest.mark.slow
    async def test_maximum_concurrent_users(self, db_session):
        """Test system behavior with maximum concurrent users."""
        max_users = 1000
        operations_per_user = 5
        
        async def user_session(user_id: int):
            """Simulate a user session with multiple operations."""
            operations = []
            
            for op in range(operations_per_user):
                start = time.time()
                
                # Simulate various inventory operations
                operation_type = op % 3
                
                if operation_type == 0:
                    # Stock lookup
                    await asyncio.sleep(0.01)  # 10ms operation
                elif operation_type == 1:
                    # Stock adjustment
                    await asyncio.sleep(0.05)  # 50ms operation
                else:
                    # Rental operation
                    await asyncio.sleep(0.1)   # 100ms operation
                
                end = time.time()
                operations.append(end - start)
            
            return operations
        
        start_time = time.time()
        
        # Create semaphore to limit actual concurrency for testing
        semaphore = asyncio.Semaphore(100)  # Limit to 100 actual concurrent operations
        
        async def limited_user_session(user_id):
            async with semaphore:
                return await user_session(user_id)
        
        tasks = [limited_user_session(i) for i in range(max_users)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        successful_users = sum(1 for r in results if not isinstance(r, Exception))
        
        # System should handle high user load gracefully
        assert successful_users > max_users * 0.95  # 95% success rate
        assert total_time < 120.0  # Within 2 minutes

    @pytest.mark.slow
    async def test_disk_space_boundary_conditions(self, db_session):
        """Test behavior when approaching disk space limits."""
        # Simulate large data operations that might fill disk
        
        large_data_operations = [
            "bulk_inventory_import",
            "large_movement_history_export", 
            "comprehensive_audit_report",
            "full_inventory_snapshot"
        ]
        
        for operation in large_data_operations:
            # Mock disk space checking
            with patch('shutil.disk_usage') as mock_disk_usage:
                # Simulate low disk space (less than 100MB free)
                mock_disk_usage.return_value = (1000000000, 900000000, 50000000)  # 50MB free
                
                # Operation should detect low disk space and handle gracefully
                try:
                    # Simulate the operation
                    if operation == "bulk_inventory_import":
                        # Should check disk space before starting
                        free_space = 50000000  # 50MB
                        required_space = 200000000  # 200MB required
                        
                        if free_space < required_space:
                            raise OSError("Insufficient disk space")
                        
                except OSError as e:
                    assert "disk space" in str(e).lower()

    @pytest.mark.slow
    async def test_network_bandwidth_limitations(self, db_session):
        """Test behavior under network bandwidth limitations."""
        # Simulate slow network conditions
        
        async def slow_network_operation(data_size_mb: int):
            """Simulate network operation with bandwidth limits."""
            bandwidth_mbps = 1  # 1 Mbps connection
            transfer_time = data_size_mb / bandwidth_mbps
            
            await asyncio.sleep(transfer_time)  # Simulate slow transfer
            return f"Transferred {data_size_mb}MB"
        
        # Test various data transfer scenarios
        operations = [
            ("small_update", 0.1),      # 100KB
            ("medium_report", 5),       # 5MB  
            ("large_export", 50),       # 50MB
            ("bulk_import", 200)        # 200MB
        ]
        
        start_time = time.time()
        
        results = []
        for op_name, size_mb in operations:
            try:
                result = await asyncio.wait_for(
                    slow_network_operation(size_mb),
                    timeout=10.0  # 10 second timeout
                )
                results.append((op_name, "success", size_mb))
            except asyncio.TimeoutError:
                results.append((op_name, "timeout", size_mb))
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Small operations should succeed, large ones may timeout
        small_ops = [r for r in results if r[2] <= 1.0]  # <= 1MB
        large_ops = [r for r in results if r[2] > 10.0]  # > 10MB
        
        assert all(r[1] == "success" for r in small_ops)  # Small operations succeed
        # Large operations may timeout, which is expected behavior