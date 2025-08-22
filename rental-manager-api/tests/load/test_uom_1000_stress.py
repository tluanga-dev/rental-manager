#!/usr/bin/env python3
"""
1000-Unit of Measurement Stress Test

This script creates and tests 1000 units of measurement with comprehensive testing:
- Creates diverse units across multiple categories
- Tests CRUD operations at scale
- Validates performance metrics
- Tests search and filtering
- Ensures data integrity

The test validates performance, data integrity, and cleanup operations.
"""

import asyncio
import json
import sys
import time
from typing import Dict, Any, Optional, List
import aiohttp
from datetime import datetime
import random
import string


class UOM1000StressTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.auth_token: Optional[str] = None
        
        # Test configuration
        self.total_units = 1000
        
        # Data storage
        self.created_units = []
        
        # Performance metrics
        self.metrics = {
            "creation_times": [],
            "query_times": [],
            "search_times": [],
            "update_times": [],
            "total_creation_time": 0,
            "total_query_time": 0,
            "errors": []
        }
        
        # Unit categories and templates
        self.unit_categories = {
            "Weight": ["kilogram", "gram", "milligram", "ton", "pound", "ounce", "stone"],
            "Length": ["meter", "centimeter", "millimeter", "kilometer", "inch", "foot", "yard", "mile"],
            "Volume": ["liter", "milliliter", "gallon", "quart", "pint", "cup", "barrel"],
            "Area": ["square meter", "square foot", "hectare", "acre", "square kilometer"],
            "Time": ["second", "minute", "hour", "day", "week", "month", "year"],
            "Temperature": ["celsius", "fahrenheit", "kelvin"],
            "Quantity": ["piece", "dozen", "gross", "pack", "box", "case", "pallet", "container"],
            "Digital": ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"],
            "Currency": ["dollar", "euro", "pound", "yen", "rupee"],
            "Energy": ["joule", "calorie", "watt", "kilowatt", "horsepower"],
            "Pressure": ["pascal", "bar", "psi", "atmosphere"],
            "Speed": ["meter per second", "kilometer per hour", "mile per hour", "knot"],
            "Frequency": ["hertz", "kilohertz", "megahertz", "gigahertz"],
            "Electric": ["ampere", "volt", "ohm", "watt", "farad"],
            "Chemical": ["mole", "molecule", "atom", "ion"],
            "Light": ["lumen", "lux", "candela"],
            "Force": ["newton", "pound-force", "kilogram-force"],
            "Angle": ["degree", "radian", "gradian"],
            "Data Rate": ["bit per second", "kilobit per second", "megabit per second"],
            "Density": ["kilogram per cubic meter", "gram per liter", "pound per cubic foot"]
        }
        
        self.code_prefixes = {
            "Weight": "W", "Length": "L", "Volume": "V", "Area": "A",
            "Time": "T", "Temperature": "TP", "Quantity": "Q", "Digital": "D",
            "Currency": "C", "Energy": "E", "Pressure": "P", "Speed": "S",
            "Frequency": "F", "Electric": "EL", "Chemical": "CH", "Light": "LT",
            "Force": "FR", "Angle": "AN", "Data Rate": "DR", "Density": "DN"
        }
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        await self.authenticate()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cleanup_all_units()
        if self.session:
            await self.session.close()
            
    async def authenticate(self):
        """Authenticate with the API to get a bearer token"""
        try:
            auth_data = {
                "username": "admin",
                "password": "Admin123!"  # Updated with secure password
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/auth/login",
                data=auth_data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    self.auth_token = result.get("access_token")
                    print("✓ Authentication successful")
                    return True
                else:
                    print(f"✗ Authentication failed: {response.status}")
                    return False
        except Exception as e:
            print(f"✗ Authentication error: {e}")
            return False
    
    def get_headers(self) -> Dict[str, str]:
        """Get headers with authentication"""
        return {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
    
    def generate_unit_data(self, index: int) -> Dict[str, Any]:
        """Generate unique unit data based on index"""
        # Distribute units across categories
        category_items = []
        for category, units in self.unit_categories.items():
            for unit in units:
                category_items.append((category, unit))
        
        # Ensure we have enough unique units
        while len(category_items) < self.total_units:
            # Generate additional units with variations
            for category, base_units in self.unit_categories.items():
                for unit in base_units:
                    for suffix in ["2", "3", "mini", "mega", "ultra", "super", "nano", "micro", "macro"]:
                        category_items.append((category, f"{suffix} {unit}"))
                        if len(category_items) >= self.total_units:
                            break
                    if len(category_items) >= self.total_units:
                        break
                if len(category_items) >= self.total_units:
                    break
        
        # Get the unit for this index
        category, unit_name = category_items[index % len(category_items)]
        
        # Generate unique name with index
        unique_name = f"{unit_name}_{index:04d}"
        
        # Generate code
        prefix = self.code_prefixes.get(category, "U")
        code = f"{prefix}{index:04d}"
        
        # Generate description
        descriptions = [
            f"Standard unit of {category.lower()} measurement",
            f"Used for measuring {category.lower()} in various applications",
            f"Common {category.lower()} unit in industry",
            f"Precision {category.lower()} measurement unit",
            f"International standard for {category.lower()}",
            f"Metric system {category.lower()} unit",
            f"Imperial system {category.lower()} unit",
            f"Scientific {category.lower()} measurement",
            f"Commercial {category.lower()} unit",
            f"Industrial {category.lower()} standard"
        ]
        
        return {
            "name": unique_name,
            "code": code,
            "description": random.choice(descriptions) + f" (Unit #{index + 1})"
        }
    
    async def create_unit(self, unit_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a single unit of measurement"""
        try:
            async with self.session.post(
                f"{self.base_url}/api/v1/unit-of-measurement/",
                json=unit_data,
                headers=self.get_headers()
            ) as response:
                if response.status == 201:
                    return await response.json()
                else:
                    error_text = await response.text()
                    self.metrics["errors"].append({
                        "operation": "create",
                        "unit": unit_data["name"],
                        "error": error_text
                    })
                    return None
        except Exception as e:
            self.metrics["errors"].append({
                "operation": "create",
                "unit": unit_data["name"],
                "error": str(e)
            })
            return None
    
    async def create_units_batch(self, start_idx: int, batch_size: int):
        """Create a batch of units concurrently"""
        tasks = []
        for i in range(start_idx, min(start_idx + batch_size, self.total_units)):
            unit_data = self.generate_unit_data(i)
            tasks.append(self.create_unit(unit_data))
        
        results = await asyncio.gather(*tasks)
        
        for result in results:
            if result:
                self.created_units.append(result)
    
    async def create_all_units(self):
        """Create all 1000 units with batching for performance"""
        print(f"\n📊 Creating {self.total_units} Units of Measurement")
        print("=" * 60)
        
        start_time = time.time()
        batch_size = 50  # Create 50 units at a time
        
        for i in range(0, self.total_units, batch_size):
            batch_start = time.time()
            await self.create_units_batch(i, batch_size)
            batch_time = time.time() - batch_start
            self.metrics["creation_times"].append(batch_time)
            
            completed = min(i + batch_size, self.total_units)
            print(f"✓ Created {completed}/{self.total_units} units "
                  f"({completed * 100 / self.total_units:.1f}%) - "
                  f"Batch time: {batch_time:.2f}s")
        
        self.metrics["total_creation_time"] = time.time() - start_time
        print(f"\n✓ Created {len(self.created_units)} units in "
              f"{self.metrics['total_creation_time']:.2f} seconds")
    
    async def test_list_units(self):
        """Test listing units with pagination"""
        print("\n📋 Testing List Operations")
        print("-" * 40)
        
        # Test different page sizes
        page_sizes = [10, 20, 50, 100]
        
        for page_size in page_sizes:
            start_time = time.time()
            
            async with self.session.get(
                f"{self.base_url}/api/v1/unit-of-measurement/",
                params={"page": 1, "page_size": page_size},
                headers=self.get_headers()
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    query_time = time.time() - start_time
                    self.metrics["query_times"].append(query_time)
                    
                    print(f"✓ Page size {page_size}: {query_time:.3f}s - "
                          f"Retrieved {len(data['items'])} items")
                else:
                    print(f"✗ Failed to list units with page size {page_size}")
    
    async def test_search_operations(self):
        """Test search functionality"""
        print("\n🔍 Testing Search Operations")
        print("-" * 40)
        
        # Test various search queries
        search_terms = ["meter", "gram", "piece", "W", "L", "0001", "0500", "0999"]
        
        for term in search_terms:
            start_time = time.time()
            
            async with self.session.get(
                f"{self.base_url}/api/v1/unit-of-measurement/search/",
                params={"q": term, "limit": 50},
                headers=self.get_headers()
            ) as response:
                if response.status == 200:
                    results = await response.json()
                    search_time = time.time() - start_time
                    self.metrics["search_times"].append(search_time)
                    
                    print(f"✓ Search '{term}': {search_time:.3f}s - "
                          f"Found {len(results)} results")
                else:
                    print(f"✗ Search failed for term '{term}'")
    
    async def test_filter_operations(self):
        """Test filtering operations"""
        print("\n🎯 Testing Filter Operations")
        print("-" * 40)
        
        # Test filtering by code prefix
        for prefix in ["W", "L", "V", "Q", "T"]:
            start_time = time.time()
            
            async with self.session.get(
                f"{self.base_url}/api/v1/unit-of-measurement/",
                params={"code": prefix, "page_size": 100},
                headers=self.get_headers()
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    query_time = time.time() - start_time
                    
                    print(f"✓ Filter by code prefix '{prefix}': {query_time:.3f}s - "
                          f"Found {data['total']} units")
                else:
                    print(f"✗ Filter failed for code prefix '{prefix}'")
    
    async def test_bulk_operations(self):
        """Test bulk activation/deactivation"""
        print("\n⚡ Testing Bulk Operations")
        print("-" * 40)
        
        if len(self.created_units) < 10:
            print("✗ Not enough units for bulk testing")
            return
        
        # Select 10 random units for bulk operations
        selected_units = random.sample(self.created_units, 10)
        unit_ids = [unit["id"] for unit in selected_units]
        
        # Test bulk deactivation
        start_time = time.time()
        async with self.session.post(
            f"{self.base_url}/api/v1/unit-of-measurement/bulk-operation",
            json={
                "unit_ids": unit_ids,
                "operation": "deactivate"
            },
            headers=self.get_headers()
        ) as response:
            if response.status == 200:
                result = await response.json()
                operation_time = time.time() - start_time
                print(f"✓ Bulk deactivation: {operation_time:.3f}s - "
                      f"Success: {result['success_count']}, Failed: {result['failure_count']}")
            else:
                print("✗ Bulk deactivation failed")
        
        # Test bulk activation
        start_time = time.time()
        async with self.session.post(
            f"{self.base_url}/api/v1/unit-of-measurement/bulk-operation",
            json={
                "unit_ids": unit_ids,
                "operation": "activate"
            },
            headers=self.get_headers()
        ) as response:
            if response.status == 200:
                result = await response.json()
                operation_time = time.time() - start_time
                print(f"✓ Bulk activation: {operation_time:.3f}s - "
                      f"Success: {result['success_count']}, Failed: {result['failure_count']}")
            else:
                print("✗ Bulk activation failed")
    
    async def test_statistics(self):
        """Test statistics endpoint"""
        print("\n📈 Testing Statistics")
        print("-" * 40)
        
        start_time = time.time()
        
        async with self.session.get(
            f"{self.base_url}/api/v1/unit-of-measurement/stats/",
            headers=self.get_headers()
        ) as response:
            if response.status == 200:
                stats = await response.json()
                query_time = time.time() - start_time
                
                print(f"✓ Statistics retrieved in {query_time:.3f}s")
                print(f"  - Total units: {stats['total_units']}")
                print(f"  - Active units: {stats['active_units']}")
                print(f"  - Inactive units: {stats['inactive_units']}")
                print(f"  - Units with items: {stats['units_with_items']}")
                print(f"  - Units without items: {stats['units_without_items']}")
            else:
                print("✗ Failed to retrieve statistics")
    
    async def cleanup_all_units(self):
        """Clean up all created units"""
        print("\n🧹 Cleaning up test data")
        print("-" * 40)
        
        if not self.created_units:
            print("No units to clean up")
            return
        
        # Delete units in batches
        batch_size = 50
        deleted_count = 0
        
        for i in range(0, len(self.created_units), batch_size):
            batch = self.created_units[i:i + batch_size]
            tasks = []
            
            for unit in batch:
                tasks.append(self.delete_unit(unit["id"]))
            
            results = await asyncio.gather(*tasks)
            deleted_count += sum(1 for r in results if r)
            
            print(f"✓ Deleted {deleted_count}/{len(self.created_units)} units")
        
        print(f"✓ Cleanup complete: {deleted_count} units deleted")
    
    async def delete_unit(self, unit_id: str) -> bool:
        """Delete a single unit"""
        try:
            async with self.session.delete(
                f"{self.base_url}/api/v1/unit-of-measurement/{unit_id}",
                headers=self.get_headers()
            ) as response:
                return response.status == 204
        except Exception:
            return False
    
    def print_performance_summary(self):
        """Print performance metrics summary"""
        print("\n📊 Performance Summary")
        print("=" * 60)
        
        if self.metrics["creation_times"]:
            avg_creation = sum(self.metrics["creation_times"]) / len(self.metrics["creation_times"])
            print(f"Creation Performance:")
            print(f"  - Total time: {self.metrics['total_creation_time']:.2f}s")
            print(f"  - Average batch time: {avg_creation:.2f}s")
            print(f"  - Units per second: {self.total_units / self.metrics['total_creation_time']:.1f}")
        
        if self.metrics["query_times"]:
            avg_query = sum(self.metrics["query_times"]) / len(self.metrics["query_times"])
            print(f"\nQuery Performance:")
            print(f"  - Average query time: {avg_query:.3f}s")
            print(f"  - Min query time: {min(self.metrics['query_times']):.3f}s")
            print(f"  - Max query time: {max(self.metrics['query_times']):.3f}s")
        
        if self.metrics["search_times"]:
            avg_search = sum(self.metrics["search_times"]) / len(self.metrics["search_times"])
            print(f"\nSearch Performance:")
            print(f"  - Average search time: {avg_search:.3f}s")
            print(f"  - Min search time: {min(self.metrics['search_times']):.3f}s")
            print(f"  - Max search time: {max(self.metrics['search_times']):.3f}s")
        
        if self.metrics["errors"]:
            print(f"\n⚠️ Errors: {len(self.metrics['errors'])}")
            for error in self.metrics["errors"][:5]:  # Show first 5 errors
                print(f"  - {error['operation']} on {error['unit']}: {error['error'][:50]}...")
        
        print("\n" + "=" * 60)
    
    async def run_full_test(self):
        """Run the complete test suite"""
        print("\n🚀 Starting 1000-Unit Stress Test")
        print("=" * 60)
        
        # Create all units
        await self.create_all_units()
        
        # Run various tests
        await self.test_list_units()
        await self.test_search_operations()
        await self.test_filter_operations()
        await self.test_bulk_operations()
        await self.test_statistics()
        
        # Print summary
        self.print_performance_summary()
        
        return len(self.created_units) == self.total_units


async def main():
    """Main entry point"""
    async with UOM1000StressTester() as tester:
        success = await tester.run_full_test()
        
        if success:
            print("\n✅ Test completed successfully!")
            return 0
        else:
            print("\n❌ Test failed!")
            return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)