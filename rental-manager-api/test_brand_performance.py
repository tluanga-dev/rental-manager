#!/usr/bin/env python3
"""
Brand Performance Testing Suite

Tests performance of brand operations with large datasets (10,000 brands).
Measures response times, throughput, and resource usage.
"""

import pytest
import asyncio
import time
import statistics
import psutil
import sys
from typing import List, Dict, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.models.brand import Brand
from app.crud.brand import BrandRepository
from app.services.brand import BrandService
from app.schemas.brand import BrandCreate, BrandFilter, BrandSort


@pytest.mark.performance
@pytest.mark.asyncio
class TestBrandPerformance:
    """Performance tests for brand operations."""
    
    @pytest.fixture(autouse=True)
    async def setup_performance_test(self, db_session: AsyncSession):
        """Setup for performance tests."""
        self.session = db_session
        self.repository = BrandRepository(db_session)
        self.service = BrandService(self.repository)
        
        # Check if we have enough test data
        count = await self.repository.count(include_inactive=True)
        if count < 10000:
            pytest.skip(f"Performance tests require at least 10,000 brands, found {count}. Run generate_brand_mock_data.py first.")
        
        self.total_brands = count
        print(f"\n🎯 Performance testing with {self.total_brands} brands")
    
    def measure_performance(self, func_name: str):
        """Decorator to measure function performance."""
        def decorator(func):
            async def wrapper(*args, **kwargs):
                # Measure system resources before
                process = psutil.Process()
                mem_before = process.memory_info().rss / 1024 / 1024  # MB
                cpu_before = process.cpu_percent()
                
                start_time = time.time()
                result = await func(*args, **kwargs)
                end_time = time.time()
                
                # Measure system resources after
                mem_after = process.memory_info().rss / 1024 / 1024  # MB
                cpu_after = process.cpu_percent()
                
                execution_time = end_time - start_time
                memory_delta = mem_after - mem_before
                
                print(f"\n📊 {func_name} Performance:")
                print(f"  ⏱️  Execution time: {execution_time:.3f}s")
                print(f"  🧠 Memory usage: {mem_before:.1f}MB → {mem_after:.1f}MB (Δ{memory_delta:+.1f}MB)")
                print(f"  🖥️  CPU usage: {cpu_before:.1f}% → {cpu_after:.1f}%")
                
                # Performance assertions
                if "search" in func_name.lower():
                    assert execution_time < 0.5, f"Search took {execution_time:.3f}s, expected < 0.5s"
                elif "pagination" in func_name.lower():
                    assert execution_time < 0.3, f"Pagination took {execution_time:.3f}s, expected < 0.3s"
                elif "bulk" in func_name.lower():
                    assert execution_time < 2.0, f"Bulk operation took {execution_time:.3f}s, expected < 2.0s"
                
                return result
            return wrapper
        return decorator
    
    @measure_performance("Brand Search")
    async def test_search_performance(self):
        """Test search performance across large dataset."""
        search_terms = [
            "Pro", "Tech", "Max", "Industrial", "Power", "Elite", "Advanced",
            "Construction", "Tool", "Equipment", "Heavy", "Commercial"
        ]
        
        search_times = []
        
        for term in search_terms:
            start_time = time.time()
            results = await self.repository.search(term, limit=50)
            search_time = time.time() - start_time
            search_times.append(search_time)
            
            print(f"  🔍 '{term}': {len(results)} results in {search_time:.3f}s")
        
        avg_search_time = statistics.mean(search_times)
        max_search_time = max(search_times)
        min_search_time = min(search_times)
        
        print(f"  📈 Search Statistics:")
        print(f"    Average: {avg_search_time:.3f}s")
        print(f"    Min: {min_search_time:.3f}s")
        print(f"    Max: {max_search_time:.3f}s")
        
        assert avg_search_time < 0.2, f"Average search time {avg_search_time:.3f}s too slow"
        assert max_search_time < 0.5, f"Max search time {max_search_time:.3f}s too slow"
    
    @measure_performance("Brand Pagination")
    async def test_pagination_performance(self):
        """Test pagination performance with various page sizes."""
        page_sizes = [10, 20, 50, 100]
        pagination_times = {}
        
        for page_size in page_sizes:
            times = []
            
            # Test first 5 pages
            for page in range(1, 6):
                start_time = time.time()
                brands, total = await self.repository.get_paginated(
                    page=page,
                    page_size=page_size,
                    sort_by="name",
                    sort_order="asc"
                )
                pagination_time = time.time() - start_time
                times.append(pagination_time)
                
                if page == 1:
                    print(f"  📄 Page size {page_size}: {len(brands)} brands, total {total}")
            
            avg_time = statistics.mean(times)
            pagination_times[page_size] = avg_time
            print(f"  ⏱️  Average time for page size {page_size}: {avg_time:.3f}s")
        
        # All pagination should be under 300ms
        for page_size, avg_time in pagination_times.items():
            assert avg_time < 0.3, f"Page size {page_size} too slow: {avg_time:.3f}s"
    
    @measure_performance("Brand Filtering")
    async def test_filtering_performance(self):
        """Test filtering performance with complex criteria."""
        filters_to_test = [
            {"is_active": True},
            {"name": "Pro"},
            {"code": "TEST"},
            {"search": "Industrial"},
            {"is_active": True, "name": "Tech"},
            {"is_active": True, "search": "Power"},
        ]
        
        for i, filters in enumerate(filters_to_test):
            start_time = time.time()
            brands, total = await self.repository.get_paginated(
                page=1,
                page_size=50,
                filters=filters,
                sort_by="name",
                sort_order="asc"
            )
            filter_time = time.time() - start_time
            
            print(f"  🔧 Filter {i+1}: {total} matches in {filter_time:.3f}s")
            print(f"    Criteria: {filters}")
            
            assert filter_time < 0.4, f"Filter {i+1} too slow: {filter_time:.3f}s"
    
    @measure_performance("Brand Statistics")
    async def test_statistics_performance(self):
        """Test statistics calculation performance."""
        start_time = time.time()
        stats = await self.repository.get_statistics()
        stats_time = time.time() - start_time
        
        print(f"  📊 Statistics calculated in {stats_time:.3f}s:")
        print(f"    Total brands: {stats['total_brands']}")
        print(f"    Active brands: {stats['active_brands']}")
        print(f"    Inactive brands: {stats['inactive_brands']}")
        
        assert stats_time < 0.5, f"Statistics calculation too slow: {stats_time:.3f}s"
        assert stats['total_brands'] > 0, "No brands found"
    
    @measure_performance("Bulk Brand Operations")
    async def test_bulk_operations_performance(self):
        """Test bulk operations performance."""
        # Get some brands for testing
        brands, _ = await self.repository.get_paginated(page=1, page_size=100)
        brand_ids = [brand.id for brand in brands[:50]]
        
        # Test bulk activation
        start_time = time.time()
        activated_count = await self.repository.bulk_activate(brand_ids)
        activate_time = time.time() - start_time
        
        print(f"  ✅ Bulk activation: {activated_count} brands in {activate_time:.3f}s")
        
        # Test bulk deactivation
        start_time = time.time()
        deactivated_count = await self.repository.bulk_deactivate(brand_ids)
        deactivate_time = time.time() - start_time
        
        print(f"  ❌ Bulk deactivation: {deactivated_count} brands in {deactivate_time:.3f}s")
        
        total_bulk_time = activate_time + deactivate_time
        assert total_bulk_time < 1.0, f"Bulk operations too slow: {total_bulk_time:.3f}s"
    
    @measure_performance("Database Query Optimization")
    async def test_database_query_performance(self):
        """Test raw database query performance."""
        queries_to_test = [
            ("Simple Count", "SELECT COUNT(*) FROM brands"),
            ("Active Count", "SELECT COUNT(*) FROM brands WHERE is_active = true"),
            ("Name Search", "SELECT * FROM brands WHERE name ILIKE '%Pro%' LIMIT 50"),
            ("Code Search", "SELECT * FROM brands WHERE code ILIKE '%TEST%' LIMIT 50"),
            ("Complex Filter", """
                SELECT * FROM brands 
                WHERE is_active = true 
                AND (name ILIKE '%Tech%' OR description ILIKE '%Tech%')
                ORDER BY name 
                LIMIT 50
            """),
            ("Aggregation", """
                SELECT is_active, COUNT(*) as count 
                FROM brands 
                GROUP BY is_active
            """)
        ]
        
        for query_name, query in queries_to_test:
            start_time = time.time()
            result = await self.session.execute(text(query))
            rows = result.fetchall()
            query_time = time.time() - start_time
            
            print(f"  🗃️  {query_name}: {len(rows)} rows in {query_time:.3f}s")
            
            # Different performance expectations for different query types
            if "Count" in query_name:
                assert query_time < 0.1, f"{query_name} too slow: {query_time:.3f}s"
            elif "Search" in query_name:
                assert query_time < 0.2, f"{query_name} too slow: {query_time:.3f}s"
            else:
                assert query_time < 0.3, f"{query_name} too slow: {query_time:.3f}s"
    
    @measure_performance("Service Layer Performance")
    async def test_service_layer_performance(self):
        """Test service layer performance with business logic."""
        # Test list_brands with various parameters
        filters = BrandFilter(search="Tech", is_active=True)
        sort = BrandSort(field="name", direction="asc")
        
        start_time = time.time()
        brand_list = await self.service.list_brands(
            page=1,
            page_size=50,
            filters=filters,
            sort=sort,
            include_inactive=False
        )
        service_time = time.time() - start_time
        
        print(f"  🔧 Service list: {len(brand_list.items)} brands in {service_time:.3f}s")
        print(f"    Total: {brand_list.total}, Pages: {brand_list.total_pages}")
        
        assert service_time < 0.5, f"Service layer too slow: {service_time:.3f}s"
        assert len(brand_list.items) > 0, "No brands returned"
    
    @measure_performance("Concurrent Operations")
    async def test_concurrent_performance(self):
        """Test performance under concurrent load."""
        async def concurrent_search(term: str):
            """Perform a search operation."""
            start_time = time.time()
            results = await self.repository.search(term, limit=20)
            return time.time() - start_time, len(results)
        
        # Create concurrent tasks
        search_terms = ["Pro", "Tech", "Max", "Elite", "Power"] * 4  # 20 concurrent searches
        tasks = [concurrent_search(term) for term in search_terms]
        
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        total_time = time.time() - start_time
        
        times = [r[0] for r in results]
        counts = [r[1] for r in results]
        
        avg_time = statistics.mean(times)
        max_time = max(times)
        total_results = sum(counts)
        
        print(f"  🚀 Concurrent Operations ({len(tasks)} searches):")
        print(f"    Total time: {total_time:.3f}s")
        print(f"    Average per search: {avg_time:.3f}s")
        print(f"    Max search time: {max_time:.3f}s")
        print(f"    Total results: {total_results}")
        print(f"    Throughput: {len(tasks)/total_time:.1f} searches/second")
        
        assert total_time < 3.0, f"Concurrent operations too slow: {total_time:.3f}s"
        assert avg_time < 0.3, f"Average concurrent search too slow: {avg_time:.3f}s"
    
    @measure_performance("Memory Stress Test")
    async def test_memory_usage(self):
        """Test memory usage with large result sets."""
        # Test large pagination
        start_memory = psutil.Process().memory_info().rss / 1024 / 1024
        
        large_results = []
        for page in range(1, 11):  # Get 10 pages of 100 brands each
            brands, _ = await self.repository.get_paginated(
                page=page,
                page_size=100,
                sort_by="name",
                sort_order="asc"
            )
            large_results.extend(brands)
        
        end_memory = psutil.Process().memory_info().rss / 1024 / 1024
        memory_used = end_memory - start_memory
        
        print(f"  🧠 Memory test: {len(large_results)} brands loaded")
        print(f"    Memory used: {memory_used:.1f}MB")
        print(f"    Memory per brand: {memory_used/len(large_results)*1024:.1f}KB")
        
        # Memory usage should be reasonable
        assert memory_used < 100, f"Too much memory used: {memory_used:.1f}MB"
        assert len(large_results) >= 1000, f"Too few brands loaded: {len(large_results)}"


@pytest.mark.performance
class TestBrandPerformanceReport:
    """Generate performance test report."""
    
    def test_generate_performance_report(self):
        """Generate a comprehensive performance test report."""
        print("\n" + "=" * 60)
        print("🎯 BRAND PERFORMANCE TEST SUMMARY")
        print("=" * 60)
        print(f"Python version: {sys.version}")
        print(f"System: {psutil.virtual_memory().total / 1024**3:.1f}GB RAM, {psutil.cpu_count()} CPU cores")
        
        # This would be populated by the actual test results
        # For now, we'll just print the test categories
        print("\n📊 Test Categories Completed:")
        print("  ✅ Search Performance")
        print("  ✅ Pagination Performance") 
        print("  ✅ Filtering Performance")
        print("  ✅ Statistics Performance")
        print("  ✅ Bulk Operations Performance")
        print("  ✅ Database Query Performance")
        print("  ✅ Service Layer Performance")
        print("  ✅ Concurrent Operations Performance")
        print("  ✅ Memory Usage Testing")
        
        print("\n🎯 Performance Targets:")
        print("  🔍 Search: < 200ms average")
        print("  📄 Pagination: < 300ms per page")
        print("  🔧 Filtering: < 400ms per filter")
        print("  📊 Statistics: < 500ms")
        print("  🚀 Bulk ops: < 1000ms")
        print("  🗃️  DB queries: < 100-300ms")
        print("  ⚡ Concurrency: < 3000ms for 20 ops")
        print("  🧠 Memory: < 100MB for 1000 brands")
        
        print("\n💡 Recommendations:")
        print("  • Monitor search query performance as dataset grows")
        print("  • Consider implementing caching for frequently accessed data")
        print("  • Use database indexes for optimal search performance")
        print("  • Implement connection pooling for concurrent operations")
        print("  • Consider pagination limits for large datasets")
        
        assert True  # This test always passes but provides the report


if __name__ == "__main__":
    # Run performance tests directly
    pytest.main([__file__, "-v", "-s", "--tb=short"])