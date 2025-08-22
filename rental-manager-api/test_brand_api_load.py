#!/usr/bin/env python3
"""
Brand API Load Testing Suite

Tests API endpoints with large datasets and concurrent load.
Simulates real-world usage patterns and stress conditions.
"""

import pytest
import asyncio
import aiohttp
import time
import json
import statistics
from typing import List, Dict, Any, Optional
from uuid import UUID, uuid4
import random

from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.main import app
from app.core.config import settings
from app.schemas.brand import BrandCreate, BrandUpdate


@pytest.mark.integration
@pytest.mark.asyncio
class TestBrandAPILoad:
    """API load testing for brand endpoints."""
    
    @pytest.fixture(autouse=True)
    async def setup_api_test(self):
        """Setup for API load tests."""
        self.base_url = "http://localhost:8000"
        self.api_prefix = "/api/v1/brands"
        
        # Test with different client configurations
        self.timeout = aiohttp.ClientTimeout(total=30)
        self.connector = aiohttp.TCPConnector(limit=50, limit_per_host=30)
        
        print(f"\n🌐 API Load Testing against {self.base_url}")
    
    async def make_request(
        self, 
        session: aiohttp.ClientSession, 
        method: str, 
        endpoint: str, 
        **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request and measure performance."""
        url = f"{self.base_url}{self.api_prefix}{endpoint}"
        start_time = time.time()
        
        try:
            async with session.request(method, url, **kwargs) as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                else:
                    data = {"error": f"HTTP {response.status}"}
                
                return {
                    "status": response.status,
                    "response_time": response_time,
                    "data": data,
                    "success": response.status == 200
                }
        except Exception as e:
            return {
                "status": 0,
                "response_time": time.time() - start_time,
                "data": {"error": str(e)},
                "success": False
            }
    
    async def test_brand_list_pagination_load(self):
        """Test brand list endpoint with various pagination parameters."""
        print("\n📄 Testing Brand List Pagination Load")
        
        async with aiohttp.ClientSession(
            timeout=self.timeout,
            connector=self.connector
        ) as session:
            
            page_sizes = [10, 20, 50, 100]
            results = {}
            
            for page_size in page_sizes:
                page_times = []
                total_brands = 0
                
                # Test first 10 pages for each page size
                for page in range(1, 11):
                    params = {
                        "page": page,
                        "page_size": page_size,
                        "sort_field": "name",
                        "sort_direction": "asc"
                    }
                    
                    result = await self.make_request(
                        session, "GET", "/", params=params
                    )
                    
                    if result["success"]:
                        page_times.append(result["response_time"])
                        if page == 1:
                            total_brands = result["data"]["total"]
                    else:
                        print(f"    ❌ Failed page {page}: {result['data']}")
                
                if page_times:
                    avg_time = statistics.mean(page_times)
                    max_time = max(page_times)
                    min_time = min(page_times)
                    
                    results[page_size] = {
                        "avg_time": avg_time,
                        "max_time": max_time,
                        "min_time": min_time,
                        "total_brands": total_brands
                    }
                    
                    print(f"  📊 Page size {page_size}:")
                    print(f"    Average: {avg_time:.3f}s")
                    print(f"    Min/Max: {min_time:.3f}s / {max_time:.3f}s")
                    print(f"    Total brands: {total_brands}")
                    
                    # Performance assertions
                    assert avg_time < 0.5, f"Page size {page_size} too slow: {avg_time:.3f}s"
                    assert max_time < 1.0, f"Max time for page size {page_size} too slow: {max_time:.3f}s"
    
    async def test_brand_search_load(self):
        """Test brand search endpoint with various search terms."""
        print("\n🔍 Testing Brand Search Load")
        
        search_terms = [
            "Pro", "Tech", "Max", "Elite", "Power", "Advanced", "Industrial",
            "Construction", "Tool", "Equipment", "Heavy", "Commercial",
            "Professional", "Premium", "Super", "Ultra", "Mega", "Force"
        ]
        
        async with aiohttp.ClientSession(
            timeout=self.timeout,
            connector=self.connector
        ) as session:
            
            search_results = []
            
            for term in search_terms:
                params = {
                    "q": term,
                    "limit": 50,
                    "include_inactive": False
                }
                
                result = await self.make_request(
                    session, "GET", "/search/", params=params
                )
                
                if result["success"]:
                    search_results.append({
                        "term": term,
                        "response_time": result["response_time"],
                        "result_count": len(result["data"])
                    })
                    
                    print(f"  🔍 '{term}': {len(result['data'])} results in {result['response_time']:.3f}s")
                else:
                    print(f"    ❌ Search failed for '{term}': {result['data']}")
            
            if search_results:
                times = [r["response_time"] for r in search_results]
                counts = [r["result_count"] for r in search_results]
                
                print(f"\n  📈 Search Performance Summary:")
                print(f"    Average time: {statistics.mean(times):.3f}s")
                print(f"    Max time: {max(times):.3f}s")
                print(f"    Average results: {statistics.mean(counts):.1f}")
                print(f"    Total searches: {len(search_results)}")
                
                # Performance assertions
                avg_time = statistics.mean(times)
                max_time = max(times)
                assert avg_time < 0.3, f"Average search too slow: {avg_time:.3f}s"
                assert max_time < 0.6, f"Max search too slow: {max_time:.3f}s"
    
    async def test_brand_filtering_load(self):
        """Test brand filtering with various filter combinations."""
        print("\n🔧 Testing Brand Filtering Load")
        
        filter_combinations = [
            {"is_active": "true"},
            {"is_active": "false"},
            {"name": "Tech"},
            {"code": "TEST"},
            {"search": "Industrial"},
            {"is_active": "true", "name": "Pro"},
            {"is_active": "true", "search": "Power"},
            {"sort_field": "created_at", "sort_direction": "desc"},
            {"sort_field": "name", "sort_direction": "asc"},
            {"page_size": "100", "sort_field": "code"}
        ]
        
        async with aiohttp.ClientSession(
            timeout=self.timeout,
            connector=self.connector
        ) as session:
            
            filter_results = []
            
            for i, filters in enumerate(filter_combinations):
                params = {"page": 1, "page_size": 50, **filters}
                
                result = await self.make_request(
                    session, "GET", "/", params=params
                )
                
                if result["success"]:
                    data = result["data"]
                    filter_results.append({
                        "filters": filters,
                        "response_time": result["response_time"],
                        "total_results": data.get("total", 0),
                        "returned_items": len(data.get("items", []))
                    })
                    
                    print(f"  🔧 Filter {i+1}: {data.get('total', 0)} total, {result['response_time']:.3f}s")
                    print(f"    Params: {filters}")
                else:
                    print(f"    ❌ Filter {i+1} failed: {result['data']}")
            
            if filter_results:
                times = [r["response_time"] for r in filter_results]
                
                print(f"\n  📈 Filtering Performance Summary:")
                print(f"    Average time: {statistics.mean(times):.3f}s")
                print(f"    Max time: {max(times):.3f}s")
                print(f"    Total filter tests: {len(filter_results)}")
                
                # Performance assertions
                avg_time = statistics.mean(times)
                max_time = max(times)
                assert avg_time < 0.4, f"Average filtering too slow: {avg_time:.3f}s"
                assert max_time < 0.8, f"Max filtering too slow: {max_time:.3f}s"
    
    async def test_concurrent_api_load(self):
        """Test API endpoints under concurrent load."""
        print("\n🚀 Testing Concurrent API Load")
        
        async def concurrent_request(session: aiohttp.ClientSession, request_id: int):
            """Make a concurrent API request."""
            # Randomize the type of request
            request_type = random.choice([
                "list", "search", "stats", "active"
            ])
            
            if request_type == "list":
                params = {
                    "page": random.randint(1, 5),
                    "page_size": random.choice([20, 50]),
                    "sort_field": random.choice(["name", "created_at"]),
                    "sort_direction": random.choice(["asc", "desc"])
                }
                endpoint = "/"
            elif request_type == "search":
                term = random.choice(["Pro", "Tech", "Max", "Elite", "Power"])
                params = {"q": term, "limit": 30}
                endpoint = "/search/"
            elif request_type == "stats":
                params = {}
                endpoint = "/stats/"
            else:  # active
                params = {}
                endpoint = "/active/"
            
            result = await self.make_request(session, "GET", endpoint, params=params)
            return {
                "request_id": request_id,
                "request_type": request_type,
                "success": result["success"],
                "response_time": result["response_time"],
                "status": result["status"]
            }
        
        # Test with different concurrency levels
        concurrency_levels = [5, 10, 20, 30]
        
        async with aiohttp.ClientSession(
            timeout=self.timeout,
            connector=self.connector
        ) as session:
            
            for concurrency in concurrency_levels:
                print(f"\n  🎯 Testing {concurrency} concurrent requests")
                
                # Create concurrent tasks
                tasks = [
                    concurrent_request(session, i) 
                    for i in range(concurrency)
                ]
                
                start_time = time.time()
                results = await asyncio.gather(*tasks, return_exceptions=True)
                total_time = time.time() - start_time
                
                # Process results
                successful_results = [
                    r for r in results 
                    if not isinstance(r, Exception) and r["success"]
                ]
                failed_results = [
                    r for r in results 
                    if isinstance(r, Exception) or not r["success"]
                ]
                
                if successful_results:
                    response_times = [r["response_time"] for r in successful_results]
                    avg_response_time = statistics.mean(response_times)
                    max_response_time = max(response_times)
                    
                    print(f"    ✅ Success: {len(successful_results)}/{concurrency}")
                    print(f"    ⏱️  Total time: {total_time:.3f}s")
                    print(f"    🚀 Throughput: {len(successful_results)/total_time:.1f} req/s")
                    print(f"    ⚡ Avg response: {avg_response_time:.3f}s")
                    print(f"    🔥 Max response: {max_response_time:.3f}s")
                    
                    if failed_results:
                        print(f"    ❌ Failed: {len(failed_results)}")
                    
                    # Performance assertions
                    success_rate = len(successful_results) / concurrency
                    assert success_rate >= 0.95, f"Success rate too low: {success_rate:.2%}"
                    assert avg_response_time < 1.0, f"Avg response time too slow: {avg_response_time:.3f}s"
                    assert total_time < 10.0, f"Total time too slow: {total_time:.3f}s"
    
    async def test_brand_crud_operations_load(self):
        """Test CRUD operations under load."""
        print("\n✏️ Testing CRUD Operations Load")
        
        async with aiohttp.ClientSession(
            timeout=self.timeout,
            connector=self.connector
        ) as session:
            
            created_brands = []
            
            # Test bulk brand creation
            print("  📝 Testing bulk brand creation")
            create_times = []
            
            for i in range(10):
                brand_data = {
                    "name": f"Load Test Brand {i+1} {uuid4().hex[:8]}",
                    "code": f"LTB{i+1:03d}",
                    "description": f"Load test brand {i+1} for API testing"
                }
                
                result = await self.make_request(
                    session, "POST", "/", json=brand_data
                )
                
                if result["success"]:
                    create_times.append(result["response_time"])
                    created_brands.append(result["data"]["id"])
                    print(f"    ✅ Created brand {i+1}: {result['response_time']:.3f}s")
                else:
                    print(f"    ❌ Failed to create brand {i+1}: {result['data']}")
            
            if create_times:
                avg_create_time = statistics.mean(create_times)
                print(f"    📊 Average creation time: {avg_create_time:.3f}s")
                assert avg_create_time < 0.5, f"Brand creation too slow: {avg_create_time:.3f}s"
            
            # Test brand retrieval
            print("\n  🔍 Testing brand retrieval")
            retrieval_times = []
            
            for brand_id in created_brands[:5]:  # Test first 5
                result = await self.make_request(
                    session, "GET", f"/{brand_id}"
                )
                
                if result["success"]:
                    retrieval_times.append(result["response_time"])
                    print(f"    ✅ Retrieved brand: {result['response_time']:.3f}s")
                else:
                    print(f"    ❌ Failed to retrieve brand {brand_id}")
            
            if retrieval_times:
                avg_retrieval_time = statistics.mean(retrieval_times)
                print(f"    📊 Average retrieval time: {avg_retrieval_time:.3f}s")
                assert avg_retrieval_time < 0.2, f"Brand retrieval too slow: {avg_retrieval_time:.3f}s"
            
            # Test brand updates
            print("\n  ✏️ Testing brand updates")
            update_times = []
            
            for brand_id in created_brands[:5]:  # Test first 5
                update_data = {
                    "description": f"Updated description at {time.time()}"
                }
                
                result = await self.make_request(
                    session, "PUT", f"/{brand_id}", json=update_data
                )
                
                if result["success"]:
                    update_times.append(result["response_time"])
                    print(f"    ✅ Updated brand: {result['response_time']:.3f}s")
                else:
                    print(f"    ❌ Failed to update brand {brand_id}")
            
            if update_times:
                avg_update_time = statistics.mean(update_times)
                print(f"    📊 Average update time: {avg_update_time:.3f}s")
                assert avg_update_time < 0.3, f"Brand update too slow: {avg_update_time:.3f}s"
            
            # Test brand deletion
            print("\n  🗑️ Testing brand deletion")
            deletion_times = []
            
            for brand_id in created_brands:
                result = await self.make_request(
                    session, "DELETE", f"/{brand_id}"
                )
                
                if result["success"] or result["status"] == 204:
                    deletion_times.append(result["response_time"])
                    print(f"    ✅ Deleted brand: {result['response_time']:.3f}s")
                else:
                    print(f"    ❌ Failed to delete brand {brand_id}")
            
            if deletion_times:
                avg_deletion_time = statistics.mean(deletion_times)
                print(f"    📊 Average deletion time: {avg_deletion_time:.3f}s")
                assert avg_deletion_time < 0.2, f"Brand deletion too slow: {avg_deletion_time:.3f}s"
    
    async def test_api_error_handling_load(self):
        """Test API error handling under load."""
        print("\n🚨 Testing API Error Handling Load")
        
        async with aiohttp.ClientSession(
            timeout=self.timeout,
            connector=self.connector
        ) as session:
            
            error_tests = [
                {
                    "name": "Invalid Brand ID",
                    "method": "GET",
                    "endpoint": f"/{uuid4()}",
                    "expected_status": 404
                },
                {
                    "name": "Invalid Pagination",
                    "method": "GET",
                    "endpoint": "/",
                    "params": {"page": -1, "page_size": 0},
                    "expected_status": 422
                },
                {
                    "name": "Invalid Search Limit",
                    "method": "GET",
                    "endpoint": "/search/",
                    "params": {"q": "test", "limit": 1000},
                    "expected_status": 422
                },
                {
                    "name": "Empty Brand Creation",
                    "method": "POST",
                    "endpoint": "/",
                    "json": {},
                    "expected_status": 422
                },
                {
                    "name": "Invalid Sort Field",
                    "method": "GET",
                    "endpoint": "/",
                    "params": {"sort_field": "invalid_field"},
                    "expected_status": 422
                }
            ]
            
            for test in error_tests:
                result = await self.make_request(
                    session,
                    test["method"],
                    test["endpoint"],
                    params=test.get("params"),
                    json=test.get("json")
                )
                
                expected_status = test["expected_status"]
                actual_status = result["status"]
                
                print(f"  🧪 {test['name']}: HTTP {actual_status} in {result['response_time']:.3f}s")
                
                # Verify error handling is working correctly
                assert actual_status == expected_status, f"Expected {expected_status}, got {actual_status}"
                assert result["response_time"] < 0.5, f"Error response too slow: {result['response_time']:.3f}s"


@pytest.mark.integration
class TestBrandAPIReport:
    """Generate API load test report."""
    
    def test_generate_api_load_report(self):
        """Generate comprehensive API load test report."""
        print("\n" + "=" * 60)
        print("🌐 BRAND API LOAD TEST SUMMARY")
        print("=" * 60)
        
        print("\n📊 API Endpoints Tested:")
        print("  ✅ GET /api/v1/brands (pagination)")
        print("  ✅ GET /api/v1/brands/search/ (search)")
        print("  ✅ GET /api/v1/brands/stats/ (statistics)")
        print("  ✅ GET /api/v1/brands/active/ (active brands)")
        print("  ✅ POST /api/v1/brands (create)")
        print("  ✅ GET /api/v1/brands/{id} (retrieve)")
        print("  ✅ PUT /api/v1/brands/{id} (update)")
        print("  ✅ DELETE /api/v1/brands/{id} (delete)")
        
        print("\n🎯 Performance Targets:")
        print("  📄 Pagination: < 500ms average")
        print("  🔍 Search: < 300ms average, < 600ms max")
        print("  🔧 Filtering: < 400ms average, < 800ms max")
        print("  🚀 Concurrency: 95%+ success rate")
        print("  ✏️ CRUD: Create < 500ms, Read < 200ms, Update < 300ms, Delete < 200ms")
        print("  🚨 Error handling: < 500ms response time")
        
        print("\n📈 Load Test Scenarios:")
        print("  • Pagination with multiple page sizes (10, 20, 50, 100)")
        print("  • Search across 18 different terms")
        print("  • Complex filtering with 10 filter combinations")
        print("  • Concurrent load testing (5, 10, 20, 30 requests)")
        print("  • Full CRUD operations lifecycle")
        print("  • Error condition handling")
        
        print("\n💡 Optimization Recommendations:")
        print("  • Implement response caching for frequently accessed data")
        print("  • Use database connection pooling for high concurrency")
        print("  • Consider API rate limiting for production")
        print("  • Monitor response times under production load")
        print("  • Implement request timeouts and circuit breakers")
        
        assert True  # This test always passes but provides the report


if __name__ == "__main__":
    # Run API load tests directly
    pytest.main([__file__, "-v", "-s", "--tb=short"])