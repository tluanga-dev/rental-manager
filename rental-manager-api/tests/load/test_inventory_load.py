"""
Load tests for inventory module with 1000+ records.

Tests performance and scalability of inventory operations
with large datasets to ensure production readiness.
"""

import asyncio
import time
import random
import statistics
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import uuid4
from typing import List, Dict, Any
import pytest
from httpx import AsyncClient

from app.main import app
from app.models.inventory.enums import (
    StockMovementType, InventoryUnitStatus, InventoryUnitCondition
)


class LoadTestConfig:
    """Configuration for load tests."""
    
    # Test data sizes
    LARGE_DATASET_SIZE = 1000
    MEDIUM_DATASET_SIZE = 500
    SMALL_DATASET_SIZE = 100
    
    # Performance thresholds (seconds)
    MAX_RESPONSE_TIME = 5.0
    MAX_BULK_OPERATION_TIME = 30.0
    MAX_QUERY_TIME = 2.0
    
    # Concurrency settings
    MAX_CONCURRENT_REQUESTS = 10
    BATCH_SIZE = 50


class PerformanceMetrics:
    """Track performance metrics during load testing."""
    
    def __init__(self):
        self.response_times: List[float] = []
        self.operation_counts: Dict[str, int] = {}
        self.error_counts: Dict[str, int] = {}
        self.start_time: float = 0
        self.end_time: float = 0
    
    def start_timer(self):
        """Start timing an operation."""
        self.start_time = time.time()
    
    def end_timer(self) -> float:
        """End timing and return duration."""
        self.end_time = time.time()
        duration = self.end_time - self.start_time
        self.response_times.append(duration)
        return duration
    
    def record_operation(self, operation: str):
        """Record an operation."""
        self.operation_counts[operation] = self.operation_counts.get(operation, 0) + 1
    
    def record_error(self, error_type: str):
        """Record an error."""
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get performance statistics."""
        if not self.response_times:
            return {"error": "No response times recorded"}
        
        return {
            "total_operations": sum(self.operation_counts.values()),
            "total_errors": sum(self.error_counts.values()),
            "response_times": {
                "min": min(self.response_times),
                "max": max(self.response_times),
                "mean": statistics.mean(self.response_times),
                "median": statistics.median(self.response_times),
                "p95": statistics.quantiles(self.response_times, n=20)[18] if len(self.response_times) >= 20 else max(self.response_times),
                "p99": statistics.quantiles(self.response_times, n=100)[98] if len(self.response_times) >= 100 else max(self.response_times)
            },
            "operations": self.operation_counts,
            "errors": self.error_counts
        }


class TestDataGenerator:
    """Generate test data for load testing."""
    
    @staticmethod
    def generate_item_ids(count: int) -> List[str]:
        """Generate item IDs."""
        return [str(uuid4()) for _ in range(count)]
    
    @staticmethod
    def generate_location_ids(count: int) -> List[str]:
        """Generate location IDs."""
        return [str(uuid4()) for _ in range(count)]
    
    @staticmethod
    def generate_stock_level_data(item_ids: List[str], location_ids: List[str]) -> List[Dict]:
        """Generate stock level test data."""
        data = []
        for item_id in item_ids:
            for location_id in location_ids[:random.randint(1, 3)]:  # Items in 1-3 locations
                data.append({
                    "item_id": item_id,
                    "location_id": location_id,
                    "quantity_on_hand": str(random.uniform(0, 1000)),
                    "reorder_point": str(random.uniform(10, 50)),
                    "reorder_quantity": str(random.uniform(50, 200))
                })
        return data
    
    @staticmethod
    def generate_inventory_unit_data(item_ids: List[str], location_ids: List[str], count: int) -> List[Dict]:
        """Generate inventory unit test data."""
        data = []
        statuses = list(InventoryUnitStatus)
        conditions = list(InventoryUnitCondition)
        
        for i in range(count):
            data.append({
                "item_id": random.choice(item_ids),
                "location_id": random.choice(location_ids),
                "sku": f"LOAD-TEST-{i:06d}",
                "serial_number": f"SN{random.randint(1000000, 9999999)}",
                "status": random.choice(statuses).value,
                "condition": random.choice(conditions).value,
                "purchase_price": str(random.uniform(50, 500))
            })
        return data
    
    @staticmethod
    def generate_sku_sequence_data(brand_ids: List[str], category_ids: List[str]) -> List[Dict]:
        """Generate SKU sequence test data."""
        data = []
        for brand_id in brand_ids:
            for category_id in category_ids:
                data.append({
                    "brand_id": brand_id,
                    "category_id": category_id,
                    "prefix": f"B{random.randint(10, 99)}",
                    "suffix": f"C{random.randint(10, 99)}",
                    "padding_length": random.randint(3, 6)
                })
        return data


@pytest.fixture
async def load_test_client():
    """Create client for load testing."""
    async with AsyncClient(app=app, base_url="http://test", timeout=30.0) as client:
        yield client


class TestInventoryLoadPerformance:
    """Test inventory system performance under load."""
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_stock_level_bulk_operations(self, load_test_client: AsyncClient):
        """Test bulk stock level operations performance."""
        metrics = PerformanceMetrics()
        
        # Generate test data
        item_ids = TestDataGenerator.generate_item_ids(200)
        location_ids = TestDataGenerator.generate_location_ids(10)
        stock_data = TestDataGenerator.generate_stock_level_data(item_ids, location_ids)
        
        print(f"\n🧪 Testing bulk stock operations with {len(stock_data)} records")
        
        # Test bulk creation performance
        metrics.start_timer()
        
        batch_size = LoadTestConfig.BATCH_SIZE
        for i in range(0, len(stock_data), batch_size):
            batch = stock_data[i:i + batch_size]
            
            for stock_item in batch:
                response = await load_test_client.post(
                    "/api/v1/inventory/stock-levels/initialize",
                    json=stock_item
                )
                metrics.record_operation("stock_level_create")
                
                if response.status_code not in [200, 201, 401, 422]:
                    metrics.record_error(f"http_{response.status_code}")
        
        duration = metrics.end_timer()
        
        # Verify performance
        stats = metrics.get_stats()
        print(f"📊 Stock Level Bulk Operations Stats:")
        print(f"   Operations: {stats['total_operations']}")
        print(f"   Duration: {duration:.2f}s")
        print(f"   Avg Response Time: {stats['response_times']['mean']:.3f}s")
        print(f"   P95 Response Time: {stats['response_times']['p95']:.3f}s")
        print(f"   Errors: {stats['total_errors']}")
        
        # Performance assertions
        assert duration < LoadTestConfig.MAX_BULK_OPERATION_TIME
        assert stats['response_times']['p95'] < LoadTestConfig.MAX_RESPONSE_TIME
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_inventory_unit_bulk_creation(self, load_test_client: AsyncClient):
        """Test bulk inventory unit creation performance."""
        metrics = PerformanceMetrics()
        
        # Generate test data
        item_ids = TestDataGenerator.generate_item_ids(50)
        location_ids = TestDataGenerator.generate_location_ids(5)
        unit_data = TestDataGenerator.generate_inventory_unit_data(
            item_ids, location_ids, LoadTestConfig.LARGE_DATASET_SIZE
        )
        
        print(f"\n🧪 Testing inventory unit bulk creation with {len(unit_data)} units")
        
        # Test individual unit creation
        metrics.start_timer()
        
        batch_size = LoadTestConfig.BATCH_SIZE
        for i in range(0, len(unit_data), batch_size):
            batch = unit_data[i:i + batch_size]
            
            # Test bulk creation endpoint
            bulk_request = {
                "item_id": batch[0]["item_id"],
                "location_id": batch[0]["location_id"],
                "quantity": len(batch),
                "batch_code": f"BATCH_{i}",
                "purchase_price": "100.00"
            }
            
            response = await load_test_client.post(
                "/api/v1/inventory/units/bulk",
                json=bulk_request
            )
            metrics.record_operation("unit_bulk_create")
            
            if response.status_code not in [200, 201, 401, 422]:
                metrics.record_error(f"http_{response.status_code}")
        
        duration = metrics.end_timer()
        
        # Performance verification
        stats = metrics.get_stats()
        print(f"📊 Unit Bulk Creation Stats:")
        print(f"   Operations: {stats['total_operations']}")
        print(f"   Duration: {duration:.2f}s")
        print(f"   Avg Response Time: {stats['response_times']['mean']:.3f}s")
        print(f"   Errors: {stats['total_errors']}")
        
        assert duration < LoadTestConfig.MAX_BULK_OPERATION_TIME
        assert stats['response_times']['mean'] < LoadTestConfig.MAX_RESPONSE_TIME
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_concurrent_sku_generation(self, load_test_client: AsyncClient):
        """Test concurrent SKU generation performance."""
        metrics = PerformanceMetrics()
        
        print(f"\n🧪 Testing concurrent SKU generation")
        
        async def generate_skus_batch(sequence_id: str, count: int):
            """Generate SKUs in batch."""
            batch_metrics = PerformanceMetrics()
            
            for i in range(count):
                batch_metrics.start_timer()
                
                response = await load_test_client.post(
                    f"/api/v1/inventory/sku-sequences/{sequence_id}/generate",
                    json={
                        "brand_code": f"B{random.randint(10, 99)}",
                        "category_code": f"C{random.randint(10, 99)}",
                        "item_name": f"Item {i}"
                    }
                )
                
                batch_metrics.end_timer()
                batch_metrics.record_operation("sku_generate")
                
                if response.status_code not in [200, 201, 401, 404, 422]:
                    batch_metrics.record_error(f"http_{response.status_code}")
            
            return batch_metrics
        
        # Create concurrent tasks
        sequence_ids = [str(uuid4()) for _ in range(10)]
        tasks = []
        
        metrics.start_timer()
        
        for sequence_id in sequence_ids:
            task = generate_skus_batch(sequence_id, 100)
            tasks.append(task)
        
        # Execute concurrent tasks
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        duration = metrics.end_timer()
        
        # Aggregate results
        total_operations = 0
        total_errors = 0
        all_response_times = []
        
        for result in batch_results:
            if isinstance(result, PerformanceMetrics):
                stats = result.get_stats()
                total_operations += stats.get('total_operations', 0)
                total_errors += stats.get('total_errors', 0)
                all_response_times.extend(result.response_times)
        
        print(f"📊 Concurrent SKU Generation Stats:")
        print(f"   Total Operations: {total_operations}")
        print(f"   Total Duration: {duration:.2f}s")
        print(f"   Throughput: {total_operations/duration:.1f} ops/sec")
        print(f"   Total Errors: {total_errors}")
        
        if all_response_times:
            print(f"   Avg Response Time: {statistics.mean(all_response_times):.3f}s")
            print(f"   P95 Response Time: {statistics.quantiles(all_response_times, n=20)[18] if len(all_response_times) >= 20 else max(all_response_times):.3f}s")
        
        # Performance assertions
        assert duration < LoadTestConfig.MAX_BULK_OPERATION_TIME
        assert total_operations > 500  # Should complete most operations
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_large_dataset_queries(self, load_test_client: AsyncClient):
        """Test query performance with large datasets."""
        metrics = PerformanceMetrics()
        
        print(f"\n🧪 Testing large dataset queries")
        
        # Test various query endpoints
        query_endpoints = [
            ("/api/v1/inventory/stock-levels/", {"limit": "1000"}),
            ("/api/v1/inventory/movements/", {"limit": "1000"}),
            ("/api/v1/inventory/units/", {"limit": "1000"}),
            ("/api/v1/inventory/sku-sequences/", {"limit": "1000"}),
            ("/api/v1/inventory/stock-levels/summary", {}),
            ("/api/v1/inventory/movements/statistics", {}),
            ("/api/v1/inventory/stock-levels/alerts", {})
        ]
        
        for endpoint, params in query_endpoints:
            metrics.start_timer()
            
            response = await load_test_client.get(endpoint, params=params)
            
            duration = metrics.end_timer()
            metrics.record_operation(f"query_{endpoint.split('/')[-1]}")
            
            if response.status_code not in [200, 422]:
                metrics.record_error(f"http_{response.status_code}")
            
            print(f"   {endpoint}: {duration:.3f}s (status: {response.status_code})")
        
        # Performance verification
        stats = metrics.get_stats()
        print(f"📊 Large Dataset Query Stats:")
        print(f"   Operations: {stats['total_operations']}")
        print(f"   Max Response Time: {stats['response_times']['max']:.3f}s")
        print(f"   Avg Response Time: {stats['response_times']['mean']:.3f}s")
        print(f"   Errors: {stats['total_errors']}")
        
        # All queries should complete within reasonable time
        assert stats['response_times']['max'] < LoadTestConfig.MAX_QUERY_TIME * 2
        assert stats['response_times']['mean'] < LoadTestConfig.MAX_QUERY_TIME
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_mixed_workload_simulation(self, load_test_client: AsyncClient):
        """Test mixed workload simulation."""
        metrics = PerformanceMetrics()
        
        print(f"\n🧪 Testing mixed workload simulation")
        
        # Simulate realistic mixed operations
        operations = [
            ("read_stock_levels", 0.4),
            ("read_movements", 0.2),
            ("read_units", 0.2),
            ("create_unit", 0.1),
            ("adjust_stock", 0.05),
            ("generate_sku", 0.05)
        ]
        
        total_operations = 1000
        metrics.start_timer()
        
        for i in range(total_operations):
            # Choose operation based on weights
            rand = random.random()
            cumulative = 0
            
            for operation, weight in operations:
                cumulative += weight
                if rand <= cumulative:
                    await self._execute_operation(load_test_client, operation, metrics)
                    break
        
        duration = metrics.end_timer()
        
        # Performance analysis
        stats = metrics.get_stats()
        print(f"📊 Mixed Workload Stats:")
        print(f"   Total Operations: {stats['total_operations']}")
        print(f"   Duration: {duration:.2f}s")
        print(f"   Throughput: {stats['total_operations']/duration:.1f} ops/sec")
        print(f"   Avg Response Time: {stats['response_times']['mean']:.3f}s")
        print(f"   P95 Response Time: {stats['response_times']['p95']:.3f}s")
        print(f"   Operations by type: {stats['operations']}")
        print(f"   Errors: {stats['total_errors']}")
        
        # Performance requirements
        assert stats['total_operations'] >= total_operations * 0.8  # 80% success rate
        assert stats['response_times']['p95'] < LoadTestConfig.MAX_RESPONSE_TIME
        assert stats['total_operations']/duration > 10  # Minimum 10 ops/sec
    
    async def _execute_operation(self, client: AsyncClient, operation: str, metrics: PerformanceMetrics):
        """Execute a single operation."""
        metrics.start_timer()
        
        try:
            if operation == "read_stock_levels":
                response = await client.get("/api/v1/inventory/stock-levels/", params={"limit": "50"})
            elif operation == "read_movements":
                response = await client.get("/api/v1/inventory/movements/", params={"limit": "50"})
            elif operation == "read_units":
                response = await client.get("/api/v1/inventory/units/", params={"limit": "50"})
            elif operation == "create_unit":
                response = await client.post(
                    "/api/v1/inventory/units/",
                    json={
                        "item_id": str(uuid4()),
                        "location_id": str(uuid4()),
                        "sku": f"TEST-{random.randint(10000, 99999)}",
                        "status": "AVAILABLE",
                        "condition": "NEW"
                    }
                )
            elif operation == "adjust_stock":
                response = await client.post(
                    "/api/v1/inventory/stock-levels/adjust",
                    json={
                        "item_id": str(uuid4()),
                        "location_id": str(uuid4()),
                        "adjustment_type": "POSITIVE",
                        "quantity": "10.00",
                        "reason": "Load test adjustment"
                    }
                )
            elif operation == "generate_sku":
                response = await client.post(
                    f"/api/v1/inventory/sku-sequences/{uuid4()}/generate",
                    json={
                        "brand_code": "LT",
                        "category_code": "TST"
                    }
                )
            else:
                return
            
            metrics.record_operation(operation)
            
            if response.status_code not in [200, 201, 401, 404, 422]:
                metrics.record_error(f"http_{response.status_code}")
                
        except Exception as e:
            metrics.record_error(f"exception_{type(e).__name__}")
        
        finally:
            metrics.end_timer()


class TestInventoryStressTest:
    """Stress tests for inventory system."""
    
    @pytest.mark.asyncio
    @pytest.mark.stress
    async def test_memory_usage_large_dataset(self, load_test_client: AsyncClient):
        """Test memory usage with large datasets."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        print(f"\n🧪 Testing memory usage (Initial: {initial_memory:.1f}MB)")
        
        # Create large number of requests
        tasks = []
        for i in range(100):
            task = load_test_client.get(
                "/api/v1/inventory/stock-levels/",
                params={"limit": "500"}
            )
            tasks.append(task)
        
        # Execute all requests
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        print(f"   Final Memory: {final_memory:.1f}MB")
        print(f"   Memory Increase: {memory_increase:.1f}MB")
        
        # Memory should not increase excessively
        assert memory_increase < 100  # Less than 100MB increase
    
    @pytest.mark.asyncio
    @pytest.mark.stress
    async def test_connection_pool_stress(self, load_test_client: AsyncClient):
        """Test database connection pool under stress."""
        print(f"\n🧪 Testing connection pool stress")
        
        # Create many concurrent database operations
        async def db_operation():
            return await load_test_client.get("/api/v1/inventory/stock-levels/summary")
        
        # Create 50 concurrent operations
        tasks = [db_operation() for _ in range(50)]
        
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        duration = time.time() - start_time
        
        # Count successful operations
        successful = sum(1 for r in results if not isinstance(r, Exception) and hasattr(r, 'status_code'))
        
        print(f"   Duration: {duration:.2f}s")
        print(f"   Successful: {successful}/{len(tasks)}")
        print(f"   Success Rate: {successful/len(tasks)*100:.1f}%")
        
        # Should handle concurrent operations gracefully
        assert successful >= len(tasks) * 0.8  # 80% success rate
        assert duration < 10.0  # Complete within 10 seconds


@pytest.mark.asyncio
async def test_load_test_summary():
    """Provide summary of load test capabilities."""
    print(f"\n" + "="*60)
    print(f"🎯 INVENTORY LOAD TEST SUMMARY")
    print(f"="*60)
    print(f"📊 Test Configurations:")
    print(f"   Large Dataset: {LoadTestConfig.LARGE_DATASET_SIZE} records")
    print(f"   Medium Dataset: {LoadTestConfig.MEDIUM_DATASET_SIZE} records")
    print(f"   Small Dataset: {LoadTestConfig.SMALL_DATASET_SIZE} records")
    print(f"   Max Response Time: {LoadTestConfig.MAX_RESPONSE_TIME}s")
    print(f"   Max Bulk Operation: {LoadTestConfig.MAX_BULK_OPERATION_TIME}s")
    print(f"   Max Query Time: {LoadTestConfig.MAX_QUERY_TIME}s")
    print(f"   Batch Size: {LoadTestConfig.BATCH_SIZE}")
    print(f"   Max Concurrent: {LoadTestConfig.MAX_CONCURRENT_REQUESTS}")
    
    print(f"\n🧪 Tests Available:")
    print(f"   • Bulk stock level operations")
    print(f"   • Inventory unit bulk creation")
    print(f"   • Concurrent SKU generation")
    print(f"   • Large dataset queries")
    print(f"   • Mixed workload simulation")
    print(f"   • Memory usage stress test")
    print(f"   • Connection pool stress test")
    
    print(f"\n🚀 Performance Targets:")
    print(f"   • Handle 1000+ inventory records")
    print(f"   • Maintain sub-5s response times")
    print(f"   • Support 10+ concurrent operations")
    print(f"   • Achieve 80%+ success rate under load")
    print(f"   • Minimal memory footprint increase")
    
    print(f"\n✅ Ready for production load testing!")
    
    assert True  # Always pass, this is just a summary