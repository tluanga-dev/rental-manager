"""
Load testing script for Location module with 1000+ locations.
Tests performance under realistic load conditions using Docker Compose.
"""

import asyncio
import time
import random
import statistics
from decimal import Decimal
from typing import List, Dict, Any, Tuple
from uuid import uuid4
import json

import pytest
import httpx
from faker import Faker

from app.models.location import LocationType


fake = Faker()

# Global configuration
LOAD_TEST_CONFIG = {
    "total_locations": 1000,
    "concurrent_users": 50,
    "test_duration_seconds": 300,  # 5 minutes
    "base_url": "http://localhost:8000",
    "api_prefix": "/api/v1/locations",
    
    # Performance thresholds
    "max_response_time_ms": 500,  # 500ms max response time
    "max_95th_percentile_ms": 200,  # 95th percentile < 200ms
    "min_throughput_rps": 100,  # Minimum 100 requests per second
    "max_error_rate_percent": 1.0,  # Max 1% error rate
}


class LocationPerformanceTester:
    """
    Comprehensive performance tester for Location API.
    Tests creation, retrieval, search, and geospatial operations at scale.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.base_url = config["base_url"]
        self.api_prefix = config["api_prefix"]
        self.created_locations: List[Dict[str, Any]] = []
        self.performance_metrics: Dict[str, List[float]] = {
            "create": [],
            "get": [],
            "search": [],
            "geospatial": [],
            "bulk_create": [],
            "statistics": []
        }
        self.error_counts: Dict[str, int] = {
            "create": 0,
            "get": 0, 
            "search": 0,
            "geospatial": 0,
            "bulk_create": 0,
            "statistics": 0
        }
        
    def generate_realistic_location_data(self, index: int) -> Dict[str, Any]:
        """Generate realistic location data for testing."""
        location_types = ["STORE", "WAREHOUSE", "SERVICE_CENTER", "DISTRIBUTION_CENTER", "OFFICE"]
        
        # Generate coordinates for major cities around the world
        city_coordinates = [
            ("New York", 40.7128, -74.0060, "America/New_York", "NY", "USA"),
            ("Los Angeles", 34.0522, -118.2437, "America/Los_Angeles", "CA", "USA"),
            ("Chicago", 41.8781, -87.6298, "America/Chicago", "IL", "USA"),
            ("Houston", 29.7604, -95.3698, "America/Chicago", "TX", "USA"),
            ("Phoenix", 33.4484, -112.0740, "America/Phoenix", "AZ", "USA"),
            ("Philadelphia", 39.9526, -75.1652, "America/New_York", "PA", "USA"),
            ("San Antonio", 29.4241, -98.4936, "America/Chicago", "TX", "USA"),
            ("San Diego", 32.7157, -117.1611, "America/Los_Angeles", "CA", "USA"),
            ("Dallas", 32.7767, -96.7970, "America/Chicago", "TX", "USA"),
            ("San Jose", 37.3382, -121.8863, "America/Los_Angeles", "CA", "USA"),
            ("Austin", 30.2672, -97.7431, "America/Chicago", "TX", "USA"),
            ("Jacksonville", 30.3322, -81.6557, "America/New_York", "FL", "USA"),
            ("Fort Worth", 32.7555, -97.3308, "America/Chicago", "TX", "USA"),
            ("Columbus", 39.9612, -82.9988, "America/New_York", "OH", "USA"),
            ("Charlotte", 35.2271, -80.8431, "America/New_York", "NC", "USA"),
            ("San Francisco", 37.7749, -122.4194, "America/Los_Angeles", "CA", "USA"),
            ("Indianapolis", 39.7684, -86.1581, "America/New_York", "IN", "USA"),
            ("Seattle", 47.6062, -122.3321, "America/Los_Angeles", "WA", "USA"),
            ("Denver", 39.7392, -104.9903, "America/Denver", "CO", "USA"),
            ("Boston", 42.3601, -71.0589, "America/New_York", "MA", "USA"),
            ("London", 51.5074, -0.1278, "Europe/London", "England", "UK"),
            ("Toronto", 43.6532, -79.3832, "America/Toronto", "ON", "Canada"),
            ("Sydney", -33.8688, 151.2093, "Australia/Sydney", "NSW", "Australia"),
            ("Tokyo", 35.6762, 139.6503, "Asia/Tokyo", "Tokyo", "Japan"),
            ("Singapore", 1.3521, 103.8198, "Asia/Singapore", "Singapore", "Singapore")
        ]
        
        # Select random city for location
        city_data = random.choice(city_coordinates)
        city, lat, lon, timezone, state, country = city_data
        
        # Add some randomness to coordinates (within 50km of city center)
        lat_offset = random.uniform(-0.5, 0.5)  # ~50km
        lon_offset = random.uniform(-0.5, 0.5)
        
        actual_lat = lat + lat_offset
        actual_lon = lon + lon_offset
        
        # Generate operating hours
        operating_hours = None
        if random.random() > 0.2:  # 80% chance of having operating hours
            operating_hours = {
                "monday": {"open": "09:00", "close": "17:00"},
                "tuesday": {"open": "09:00", "close": "17:00"},
                "wednesday": {"open": "09:00", "close": "17:00"},
                "thursday": {"open": "09:00", "close": "17:00"},
                "friday": {"open": "09:00", "close": "17:00"},
                "saturday": {"open": "10:00", "close": "16:00"},
                "sunday": {"closed": True} if random.random() > 0.3 else {"open": "12:00", "close": "17:00"}
            }
        
        return {
            "location_code": f"LOAD-{index:06d}",
            "location_name": f"{fake.company()} {city} {random.choice(['Store', 'Outlet', 'Branch', 'Location'])}",
            "location_type": random.choice(location_types),
            "address": fake.street_address(),
            "city": city,
            "state": state,
            "country": country,
            "postal_code": fake.postcode(),
            "contact_number": fake.phone_number()[:30],  # Ensure within limit
            "email": fake.email(),
            "website": fake.url() if random.random() > 0.3 else None,  # 70% have websites
            "latitude": str(actual_lat),
            "longitude": str(actual_lon),
            "timezone": timezone,
            "operating_hours": operating_hours,
            "capacity": random.randint(50, 2000) if random.random() > 0.2 else None,  # 80% have capacity
            "is_default": index == 0,  # First location is default
            "metadata": {
                "zone": random.choice(["A", "B", "C", "D"]),
                "floor": random.randint(1, 5),
                "section": random.choice(["electronics", "clothing", "food", "automotive", "general"])
            } if random.random() > 0.3 else None  # 70% have metadata
        }
    
    async def measure_operation(self, operation_name: str, operation_func):
        """Measure the performance of an operation."""
        start_time = time.time()
        try:
            result = await operation_func()
            end_time = time.time()
            
            response_time_ms = (end_time - start_time) * 1000
            self.performance_metrics[operation_name].append(response_time_ms)
            
            return result, True
        except Exception as e:
            end_time = time.time()
            response_time_ms = (end_time - start_time) * 1000
            
            self.error_counts[operation_name] += 1
            print(f"Error in {operation_name}: {str(e)}")
            
            return None, False
    
    async def bulk_create_locations(self, client: httpx.AsyncClient, batch_size: int = 100):
        """Create locations in bulk for better performance."""
        print(f"Creating {self.config['total_locations']} locations in batches of {batch_size}...")
        
        for batch_start in range(0, self.config['total_locations'], batch_size):
            batch_end = min(batch_start + batch_size, self.config['total_locations'])
            batch_locations = []
            
            for i in range(batch_start, batch_end):
                location_data = self.generate_realistic_location_data(i)
                batch_locations.append(location_data)
            
            bulk_data = {
                "locations": batch_locations,
                "skip_duplicates": True
            }
            
            async def bulk_create_operation():
                response = await client.post(f"{self.api_prefix}/bulk", json=bulk_data)
                response.raise_for_status()
                return response.json()
            
            created_locations, success = await self.measure_operation("bulk_create", bulk_create_operation)
            
            if success and created_locations:
                self.created_locations.extend(created_locations)
                print(f"Created batch {batch_start//batch_size + 1}: {len(created_locations)} locations")
            else:
                print(f"Failed to create batch {batch_start//batch_size + 1}")
        
        print(f"Total locations created: {len(self.created_locations)}")
    
    async def test_individual_create_performance(self, client: httpx.AsyncClient, num_locations: int = 50):
        """Test individual location creation performance."""
        print(f"Testing individual creation of {num_locations} locations...")
        
        for i in range(num_locations):
            location_data = self.generate_realistic_location_data(len(self.created_locations) + i + 10000)
            
            async def create_operation():
                response = await client.post(f"{self.api_prefix}/", json=location_data)
                response.raise_for_status()
                return response.json()
            
            created_location, success = await self.measure_operation("create", create_operation)
            
            if success and created_location:
                self.created_locations.append(created_location)
    
    async def test_retrieval_performance(self, client: httpx.AsyncClient, num_requests: int = 200):
        """Test location retrieval performance."""
        if not self.created_locations:
            print("No locations available for retrieval testing")
            return
        
        print(f"Testing retrieval performance with {num_requests} requests...")
        
        for _ in range(num_requests):
            # Randomly choose between ID and code retrieval
            location = random.choice(self.created_locations)
            
            if random.random() > 0.5:
                # Test get by ID
                async def get_by_id_operation():
                    response = await client.get(f"{self.api_prefix}/{location['id']}")
                    response.raise_for_status()
                    return response.json()
                
                await self.measure_operation("get", get_by_id_operation)
            else:
                # Test get by code
                async def get_by_code_operation():
                    response = await client.get(f"{self.api_prefix}/code/{location['location_code']}")
                    response.raise_for_status()
                    return response.json()
                
                await self.measure_operation("get", get_by_code_operation)
    
    async def test_search_performance(self, client: httpx.AsyncClient, num_requests: int = 100):
        """Test search functionality performance."""
        print(f"Testing search performance with {num_requests} requests...")
        
        search_scenarios = [
            # Search by text
            {"search_term": "Store"},
            {"search_term": "New York"},
            {"search_term": "Warehouse"},
            
            # Search by location type
            {"location_type": "STORE"},
            {"location_type": "WAREHOUSE"},
            {"location_type": "OFFICE"},
            
            # Search by geographic filters
            {"city": "New York"},
            {"state": "CA"},
            {"country": "USA"},
            
            # Complex searches
            {"location_type": "STORE", "country": "USA"},
            {"city": "Los Angeles", "location_type": "STORE"},
            {"search_term": "Store", "country": "USA", "is_active": True},
            
            # Paginated searches
            {"limit": 50, "skip": 0, "sort_by": "location_name", "sort_order": "asc"},
            {"limit": 20, "skip": 100, "sort_by": "created_at", "sort_order": "desc"},
        ]
        
        for _ in range(num_requests):
            search_params = random.choice(search_scenarios)
            
            async def search_operation():
                response = await client.post(f"{self.api_prefix}/search", json=search_params)
                response.raise_for_status()
                return response.json()
            
            await self.measure_operation("search", search_operation)
    
    async def test_geospatial_performance(self, client: httpx.AsyncClient, num_requests: int = 100):
        """Test geospatial query performance."""
        print(f"Testing geospatial performance with {num_requests} requests...")
        
        # Define some major city centers for nearby searches
        search_centers = [
            (40.7128, -74.0060),  # New York
            (34.0522, -118.2437),  # Los Angeles
            (41.8781, -87.6298),   # Chicago
            (29.7604, -95.3698),   # Houston
            (51.5074, -0.1278),    # London
            (43.6532, -79.3832),   # Toronto
        ]
        
        radius_options = [1, 5, 10, 25, 50, 100, 500]  # kilometers
        
        for _ in range(num_requests):
            center_lat, center_lon = random.choice(search_centers)
            radius = random.choice(radius_options)
            
            nearby_params = {
                "latitude": str(center_lat),
                "longitude": str(center_lon),
                "radius_km": radius,
                "limit": random.choice([5, 10, 20, 50])
            }
            
            # Sometimes add location type filter
            if random.random() > 0.5:
                nearby_params["location_type"] = random.choice(["STORE", "WAREHOUSE", "OFFICE"])
            
            async def geospatial_operation():
                response = await client.post(f"{self.api_prefix}/nearby", json=nearby_params)
                response.raise_for_status()
                return response.json()
            
            await self.measure_operation("geospatial", geospatial_operation)
    
    async def test_statistics_performance(self, client: httpx.AsyncClient, num_requests: int = 50):
        """Test statistics endpoint performance."""
        print(f"Testing statistics performance with {num_requests} requests...")
        
        for _ in range(num_requests):
            async def statistics_operation():
                response = await client.get(f"{self.api_prefix}/analytics/statistics")
                response.raise_for_status()
                return response.json()
            
            await self.measure_operation("statistics", statistics_operation)
    
    async def run_concurrent_load_test(self, num_concurrent_users: int = 20, duration_seconds: int = 60):
        """Run concurrent load test with multiple users."""
        print(f"Running concurrent load test with {num_concurrent_users} users for {duration_seconds} seconds...")
        
        async def user_simulation(user_id: int):
            """Simulate a user's behavior."""
            async with httpx.AsyncClient(timeout=30.0) as client:
                end_time = time.time() + duration_seconds
                requests_made = 0
                
                while time.time() < end_time:
                    # Randomly choose operation based on realistic usage patterns
                    operation_weights = {
                        "get": 0.4,        # 40% - Most common operation
                        "search": 0.3,     # 30% - Second most common
                        "geospatial": 0.15, # 15% - Moderate usage
                        "statistics": 0.1,  # 10% - Less frequent
                        "create": 0.05     # 5% - Least frequent
                    }
                    
                    operation = random.choices(
                        list(operation_weights.keys()),
                        weights=list(operation_weights.values())
                    )[0]
                    
                    try:
                        if operation == "get" and self.created_locations:
                            location = random.choice(self.created_locations)
                            await client.get(f"{self.api_prefix}/{location['id']}")
                        
                        elif operation == "search":
                            search_params = {"limit": 20, "country": "USA"}
                            await client.post(f"{self.api_prefix}/search", json=search_params)
                        
                        elif operation == "geospatial":
                            nearby_params = {
                                "latitude": "40.7128",
                                "longitude": "-74.0060", 
                                "radius_km": 50,
                                "limit": 10
                            }
                            await client.post(f"{self.api_prefix}/nearby", json=nearby_params)
                        
                        elif operation == "statistics":
                            await client.get(f"{self.api_prefix}/analytics/statistics")
                        
                        elif operation == "create":
                            location_data = self.generate_realistic_location_data(user_id * 1000 + requests_made)
                            location_data["location_code"] = f"CONC-{user_id}-{requests_made:04d}"
                            await client.post(f"{self.api_prefix}/", json=location_data)
                        
                        requests_made += 1
                        
                        # Add small delay to simulate human behavior
                        await asyncio.sleep(random.uniform(0.1, 0.5))
                        
                    except Exception as e:
                        print(f"User {user_id} error: {str(e)}")
                
                print(f"User {user_id} completed {requests_made} requests")
                return requests_made
        
        # Run concurrent users
        tasks = [user_simulation(i) for i in range(num_concurrent_users)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful_results = [r for r in results if isinstance(r, int)]
        total_requests = sum(successful_results)
        throughput = total_requests / duration_seconds
        
        print(f"Concurrent test completed:")
        print(f"  Total requests: {total_requests}")
        print(f"  Throughput: {throughput:.2f} requests/second")
        print(f"  Successful users: {len(successful_results)}/{num_concurrent_users}")
    
    def calculate_performance_metrics(self) -> Dict[str, Any]:
        """Calculate and return performance metrics."""
        metrics = {}
        
        for operation, times in self.performance_metrics.items():
            if times:
                metrics[operation] = {
                    "count": len(times),
                    "average_ms": statistics.mean(times),
                    "median_ms": statistics.median(times),
                    "min_ms": min(times),
                    "max_ms": max(times),
                    "95th_percentile_ms": statistics.quantiles(times, n=20)[18] if len(times) >= 20 else max(times),
                    "99th_percentile_ms": statistics.quantiles(times, n=100)[98] if len(times) >= 100 else max(times),
                    "std_dev_ms": statistics.stdev(times) if len(times) > 1 else 0,
                    "error_count": self.error_counts[operation],
                    "error_rate_percent": (self.error_counts[operation] / len(times)) * 100 if times else 0
                }
            else:
                metrics[operation] = {
                    "count": 0,
                    "error_count": self.error_counts[operation]
                }
        
        return metrics
    
    def print_performance_report(self, metrics: Dict[str, Any]):
        """Print detailed performance report."""
        print("\n" + "="*80)
        print("LOCATION MODULE PERFORMANCE TEST REPORT")
        print("="*80)
        
        total_requests = sum(m.get("count", 0) for m in metrics.values())
        total_errors = sum(m.get("error_count", 0) for m in metrics.values())
        overall_error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0
        
        print(f"Total Requests: {total_requests}")
        print(f"Total Errors: {total_errors}")
        print(f"Overall Error Rate: {overall_error_rate:.2f}%")
        print(f"Locations Created: {len(self.created_locations)}")
        print()
        
        # Performance by operation
        for operation, data in metrics.items():
            if data.get("count", 0) > 0:
                print(f"{operation.upper()} OPERATION:")
                print(f"  Requests: {data['count']}")
                print(f"  Average Response Time: {data['average_ms']:.2f}ms")
                print(f"  Median Response Time: {data['median_ms']:.2f}ms")
                print(f"  95th Percentile: {data['95th_percentile_ms']:.2f}ms")
                print(f"  Max Response Time: {data['max_ms']:.2f}ms")
                print(f"  Error Rate: {data['error_rate_percent']:.2f}%")
                print()
        
        # Performance assessment
        print("PERFORMANCE ASSESSMENT:")
        print("-" * 30)
        
        # Check thresholds
        issues = []
        
        for operation, data in metrics.items():
            if data.get("count", 0) > 0:
                if data["95th_percentile_ms"] > self.config["max_95th_percentile_ms"]:
                    issues.append(f"{operation} 95th percentile ({data['95th_percentile_ms']:.2f}ms) exceeds threshold ({self.config['max_95th_percentile_ms']}ms)")
                
                if data["error_rate_percent"] > self.config["max_error_rate_percent"]:
                    issues.append(f"{operation} error rate ({data['error_rate_percent']:.2f}%) exceeds threshold ({self.config['max_error_rate_percent']}%)")
        
        if overall_error_rate > self.config["max_error_rate_percent"]:
            issues.append(f"Overall error rate ({overall_error_rate:.2f}%) exceeds threshold ({self.config['max_error_rate_percent']}%)")
        
        if issues:
            print("⚠️  PERFORMANCE ISSUES DETECTED:")
            for issue in issues:
                print(f"   - {issue}")
        else:
            print("✅ All performance metrics within acceptable thresholds")
        
        print("\n" + "="*80)
    
    async def run_complete_performance_test(self):
        """Run the complete performance test suite."""
        print("Starting Location Module Performance Test Suite")
        print("=" * 60)
        
        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(30.0)
        ) as client:
            
            # Phase 1: Bulk creation of test data
            print("PHASE 1: Creating test data...")
            await self.bulk_create_locations(client)
            
            # Phase 2: Individual operation performance tests
            print("\nPHASE 2: Individual operation performance...")
            await self.test_individual_create_performance(client, 50)
            await self.test_retrieval_performance(client, 200)
            await self.test_search_performance(client, 100)
            await self.test_geospatial_performance(client, 100)
            await self.test_statistics_performance(client, 50)
            
            # Phase 3: Concurrent load test
            print("\nPHASE 3: Concurrent load test...")
            await self.run_concurrent_load_test(
                num_concurrent_users=self.config["concurrent_users"],
                duration_seconds=60  # Shorter duration for CI/CD
            )
            
            # Calculate and display results
            metrics = self.calculate_performance_metrics()
            self.print_performance_report(metrics)
            
            return metrics


@pytest.mark.load
@pytest.mark.asyncio
async def test_location_performance_comprehensive():
    """
    Comprehensive performance test for Location module.
    This test creates 1000+ locations and tests various operations under load.
    """
    # Initialize performance tester
    tester = LocationPerformanceTester(LOAD_TEST_CONFIG)
    
    # Run complete test suite
    metrics = await tester.run_complete_performance_test()
    
    # Assert performance requirements
    assert len(tester.created_locations) >= 1000, "Should create at least 1000 locations"
    
    # Check key performance metrics
    for operation in ["create", "get", "search", "geospatial"]:
        if operation in metrics and metrics[operation].get("count", 0) > 0:
            operation_metrics = metrics[operation]
            
            # 95th percentile should be under threshold
            assert operation_metrics["95th_percentile_ms"] <= LOAD_TEST_CONFIG["max_95th_percentile_ms"], \
                f"{operation} 95th percentile ({operation_metrics['95th_percentile_ms']:.2f}ms) exceeds threshold"
            
            # Error rate should be under threshold
            assert operation_metrics["error_rate_percent"] <= LOAD_TEST_CONFIG["max_error_rate_percent"], \
                f"{operation} error rate ({operation_metrics['error_rate_percent']:.2f}%) exceeds threshold"


@pytest.mark.load
@pytest.mark.asyncio
async def test_location_geospatial_performance_specific():
    """
    Specific performance test for geospatial operations.
    Tests the most performance-critical functionality.
    """
    print("Running specific geospatial performance test...")
    
    tester = LocationPerformanceTester(LOAD_TEST_CONFIG)
    
    async with httpx.AsyncClient(
        base_url=LOAD_TEST_CONFIG["base_url"],
        timeout=httpx.Timeout(30.0)
    ) as client:
        
        # Create locations with known coordinates
        print("Creating locations with geographic distribution...")
        await tester.bulk_create_locations(client, batch_size=200)
        
        # Test various geospatial query scenarios
        geospatial_scenarios = [
            # Small radius queries (most common)
            {"radius_km": 5, "requests": 50},
            {"radius_km": 10, "requests": 30},
            
            # Medium radius queries
            {"radius_km": 50, "requests": 20},
            {"radius_km": 100, "requests": 10},
            
            # Large radius queries (least common but most expensive)
            {"radius_km": 500, "requests": 10},
        ]
        
        for scenario in geospatial_scenarios:
            print(f"Testing {scenario['radius_km']}km radius queries...")
            
            for _ in range(scenario["requests"]):
                nearby_params = {
                    "latitude": "40.7128",  # NYC
                    "longitude": "-74.0060",
                    "radius_km": scenario["radius_km"],
                    "limit": 20
                }
                
                async def geospatial_operation():
                    response = await client.post(f"{tester.api_prefix}/nearby", json=nearby_params)
                    response.raise_for_status()
                    return response.json()
                
                await tester.measure_operation("geospatial", geospatial_operation)
        
        # Calculate results
        metrics = tester.calculate_performance_metrics()
        geospatial_metrics = metrics.get("geospatial", {})
        
        if geospatial_metrics.get("count", 0) > 0:
            print(f"Geospatial Performance Results:")
            print(f"  Total Queries: {geospatial_metrics['count']}")
            print(f"  Average Response Time: {geospatial_metrics['average_ms']:.2f}ms")
            print(f"  95th Percentile: {geospatial_metrics['95th_percentile_ms']:.2f}ms")
            print(f"  Max Response Time: {geospatial_metrics['max_ms']:.2f}ms")
            
            # Geospatial queries should complete within reasonable time
            assert geospatial_metrics["95th_percentile_ms"] <= 1000, \
                f"Geospatial 95th percentile too high: {geospatial_metrics['95th_percentile_ms']:.2f}ms"
            
            assert geospatial_metrics["error_rate_percent"] <= 1.0, \
                f"Geospatial error rate too high: {geospatial_metrics['error_rate_percent']:.2f}%"


@pytest.mark.load
@pytest.mark.asyncio
async def test_location_bulk_operations_performance():
    """
    Test performance of bulk operations specifically.
    """
    print("Running bulk operations performance test...")
    
    tester = LocationPerformanceTester(LOAD_TEST_CONFIG)
    
    async with httpx.AsyncClient(
        base_url=LOAD_TEST_CONFIG["base_url"],
        timeout=httpx.Timeout(60.0)  # Longer timeout for bulk operations
    ) as client:
        
        # Test various bulk sizes
        bulk_sizes = [10, 50, 100, 200, 500]
        
        for bulk_size in bulk_sizes:
            print(f"Testing bulk creation of {bulk_size} locations...")
            
            # Generate batch data
            batch_locations = []
            for i in range(bulk_size):
                location_data = tester.generate_realistic_location_data(i + len(tester.created_locations) + 1000)
                location_data["location_code"] = f"BULK-{bulk_size}-{i:04d}"
                batch_locations.append(location_data)
            
            bulk_data = {
                "locations": batch_locations,
                "skip_duplicates": True
            }
            
            async def bulk_create_operation():
                response = await client.post(f"{tester.api_prefix}/bulk", json=bulk_data)
                response.raise_for_status()
                return response.json()
            
            created_locations, success = await tester.measure_operation("bulk_create", bulk_create_operation)
            
            if success and created_locations:
                tester.created_locations.extend(created_locations)
                print(f"Successfully created {len(created_locations)} locations in bulk")
        
        # Calculate results
        metrics = tester.calculate_performance_metrics()
        bulk_metrics = metrics.get("bulk_create", {})
        
        if bulk_metrics.get("count", 0) > 0:
            print(f"Bulk Operations Performance Results:")
            print(f"  Total Bulk Operations: {bulk_metrics['count']}")
            print(f"  Average Response Time: {bulk_metrics['average_ms']:.2f}ms")
            print(f"  95th Percentile: {bulk_metrics['95th_percentile_ms']:.2f}ms")
            print(f"  Max Response Time: {bulk_metrics['max_ms']:.2f}ms")
            print(f"  Total Locations Created: {len(tester.created_locations)}")
            
            # Bulk operations should be reasonably fast
            assert bulk_metrics["average_ms"] <= 5000, \
                f"Bulk operations average time too high: {bulk_metrics['average_ms']:.2f}ms"
            
            assert bulk_metrics["error_rate_percent"] <= 1.0, \
                f"Bulk operations error rate too high: {bulk_metrics['error_rate_percent']:.2f}%"


if __name__ == "__main__":
    """
    Run performance tests directly.
    Usage: python test_location_performance.py
    """
    asyncio.run(test_location_performance_comprehensive())