#!/usr/bin/env python3
"""
Contact Person Load Testing
Performance testing with 1000 contact persons and concurrent operations
"""

import asyncio
import sys
import os
import time
import statistics
from typing import List, Dict, Any, Tuple
import httpx
import random
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import json

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class ContactPersonLoadTester:
    """Load testing for Contact Person API with performance metrics."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.auth_token = None
        
        # Performance tracking
        self.metrics = {
            "create_times": [],
            "read_times": [],
            "update_times": [],
            "delete_times": [],
            "search_times": [],
            "list_times": [],
            "errors": [],
            "total_requests": 0,
            "successful_requests": 0
        }
        
        # Test data
        self.test_contacts = []
        self.created_contact_ids = []
    
    @property
    def auth_headers(self) -> Dict[str, str]:
        """Get authorization headers."""
        if self.auth_token:
            return {"Authorization": f"Bearer {self.auth_token}"}
        return {}
    
    async def setup(self):
        """Setup load testing environment."""
        print("🔧 Setting up load testing environment...")
        
        # Test API connectivity
        async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
            try:
                response = await client.get("/health")
                if response.status_code != 200:
                    raise Exception(f"Health check failed: {response.status_code}")
                print("✅ API connectivity verified")
            except Exception as e:
                print(f"❌ API not available: {e}")
                raise
        
        print("✅ Load testing setup completed")
    
    def generate_test_contact(self, index: int) -> Dict[str, Any]:
        """Generate test contact data."""
        companies = [
            "TechCorp Solutions", "Global Industries", "Innovation Labs", 
            "Digital Dynamics", "Future Systems", "Alpha Technologies",
            "Beta Enterprises", "Gamma Networks", "Delta Services", "Omega Corp"
        ]
        
        titles = [
            "Software Engineer", "Senior Developer", "Team Lead", "Manager",
            "Director", "VP Engineering", "CTO", "Principal Engineer",
            "Architect", "Consultant", "Analyst", "Specialist"
        ]
        
        departments = [
            "Engineering", "Software Development", "IT", "Operations",
            "Sales", "Marketing", "Finance", "HR", "Support", "R&D"
        ]
        
        first_names = [
            "John", "Jane", "Michael", "Sarah", "David", "Emily", "Chris", "Anna",
            "Robert", "Lisa", "Mark", "Jennifer", "Paul", "Susan", "Kevin", "Laura"
        ]
        
        last_names = [
            "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
            "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
            "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"
        ]
        
        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        company = random.choice(companies)
        
        return {
            "first_name": first_name,
            "last_name": last_name,
            "email": f"{first_name.lower()}.{last_name.lower()}.{index}@{company.lower().replace(' ', '').replace(',', '')}.com",
            "phone": f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
            "mobile": f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}" if random.random() > 0.3 else None,
            "title": random.choice(titles),
            "department": random.choice(departments),
            "company": company,
            "address": f"{random.randint(100, 9999)} {random.choice(['Main St', 'Oak Ave', 'First St', 'Second Ave', 'Park Blvd'])}",
            "city": random.choice(["San Francisco", "New York", "Los Angeles", "Chicago", "Austin", "Seattle", "Boston"]),
            "state": random.choice(["CA", "NY", "TX", "IL", "WA", "MA"]),
            "country": "USA",
            "postal_code": f"{random.randint(10000, 99999)}",
            "notes": f"Load test contact #{index}" if random.random() > 0.7 else None,
            "is_primary": random.random() < 0.15  # 15% are primary
        }
    
    async def time_operation(self, operation_name: str, operation_func, *args, **kwargs):
        """Time an operation and record metrics."""
        start_time = time.time()
        
        try:
            result = await operation_func(*args, **kwargs)
            end_time = time.time()
            duration = end_time - start_time
            
            self.metrics[f"{operation_name}_times"].append(duration)
            self.metrics["total_requests"] += 1
            self.metrics["successful_requests"] += 1
            
            return result, duration
        
        except Exception as e:
            end_time = time.time()
            duration = end_time - start_time
            
            self.metrics["errors"].append({
                "operation": operation_name,
                "error": str(e),
                "duration": duration,
                "timestamp": datetime.now().isoformat()
            })
            self.metrics["total_requests"] += 1
            
            raise e
    
    async def create_contact_batch(self, client: httpx.AsyncClient, contacts_batch: List[Dict]) -> List[str]:
        """Create a batch of contacts."""
        created_ids = []
        
        for contact_data in contacts_batch:
            try:
                result, duration = await self.time_operation(
                    "create",
                    self._create_single_contact,
                    client,
                    contact_data
                )
                if result:
                    created_ids.append(result["id"])
            except Exception:
                pass  # Error already recorded in time_operation
        
        return created_ids
    
    async def _create_single_contact(self, client: httpx.AsyncClient, contact_data: Dict) -> Dict:
        """Create a single contact."""
        response = await client.post(
            "/api/v1/contact-persons/",
            json=contact_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 201:
            return response.json()
        else:
            raise Exception(f"Failed to create contact: {response.status_code}")
    
    async def read_contact_batch(self, client: httpx.AsyncClient, contact_ids: List[str]) -> int:
        """Read a batch of contacts."""
        successful_reads = 0
        
        for contact_id in contact_ids:
            try:
                result, duration = await self.time_operation(
                    "read",
                    self._read_single_contact,
                    client,
                    contact_id
                )
                if result:
                    successful_reads += 1
            except Exception:
                pass  # Error already recorded
        
        return successful_reads
    
    async def _read_single_contact(self, client: httpx.AsyncClient, contact_id: str) -> Dict:
        """Read a single contact."""
        response = await client.get(
            f"/api/v1/contact-persons/{contact_id}",
            headers=self.auth_headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to read contact: {response.status_code}")
    
    async def search_contacts(self, client: httpx.AsyncClient, search_term: str) -> List[Dict]:
        """Search contacts."""
        search_data = {
            "search_term": search_term,
            "skip": 0,
            "limit": 50,
            "active_only": True
        }
        
        response = await client.post(
            "/api/v1/contact-persons/search",
            json=search_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to search contacts: {response.status_code}")
    
    async def list_contacts(self, client: httpx.AsyncClient, skip: int = 0, limit: int = 50) -> List[Dict]:
        """List contacts with pagination."""
        response = await client.get(
            f"/api/v1/contact-persons/?skip={skip}&limit={limit}",
            headers=self.auth_headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to list contacts: {response.status_code}")
    
    async def update_contact_batch(self, client: httpx.AsyncClient, contact_ids: List[str]) -> int:
        """Update a batch of contacts."""
        successful_updates = 0
        
        update_data = {
            "notes": f"Updated during load test at {datetime.now().isoformat()}",
            "title": "Load Test Updated Title"
        }
        
        for contact_id in contact_ids:
            try:
                result, duration = await self.time_operation(
                    "update",
                    self._update_single_contact,
                    client,
                    contact_id,
                    update_data
                )
                if result:
                    successful_updates += 1
            except Exception:
                pass  # Error already recorded
        
        return successful_updates
    
    async def _update_single_contact(self, client: httpx.AsyncClient, contact_id: str, update_data: Dict) -> Dict:
        """Update a single contact."""
        response = await client.put(
            f"/api/v1/contact-persons/{contact_id}",
            json=update_data,
            headers=self.auth_headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to update contact: {response.status_code}")
    
    async def delete_contact_batch(self, client: httpx.AsyncClient, contact_ids: List[str]) -> int:
        """Delete a batch of contacts."""
        successful_deletes = 0
        
        for contact_id in contact_ids:
            try:
                result, duration = await self.time_operation(
                    "delete",
                    self._delete_single_contact,
                    client,
                    contact_id
                )
                successful_deletes += 1
            except Exception:
                pass  # Error already recorded
        
        return successful_deletes
    
    async def _delete_single_contact(self, client: httpx.AsyncClient, contact_id: str) -> bool:
        """Delete a single contact."""
        response = await client.delete(
            f"/api/v1/contact-persons/{contact_id}",
            headers=self.auth_headers
        )
        
        if response.status_code == 204:
            return True
        else:
            raise Exception(f"Failed to delete contact: {response.status_code}")
    
    async def run_concurrent_operations(self, operation_name: str, operation_func, data_batches: List, max_concurrent: int = 10):
        """Run operations concurrently with controlled concurrency."""
        print(f"🔄 Running {operation_name} operations (max {max_concurrent} concurrent)...")
        
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def controlled_operation(batch):
            async with semaphore:
                async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
                    return await operation_func(client, batch)
        
        start_time = time.time()
        results = await asyncio.gather(*[controlled_operation(batch) for batch in data_batches], return_exceptions=True)
        end_time = time.time()
        
        # Count successful operations
        successful_ops = sum(r for r in results if isinstance(r, (int, list)) and not isinstance(r, Exception))
        total_time = end_time - start_time
        
        print(f"✅ {operation_name}: {successful_ops} operations in {total_time:.2f}s ({successful_ops/total_time:.2f} ops/sec)")
        
        return results
    
    async def run_search_load_test(self, client: httpx.AsyncClient):
        """Run search load test with various search terms."""
        print("🔍 Running search load test...")
        
        search_terms = [
            "John", "Jane", "Tech", "Corp", "Engineer", "Manager",
            "San Francisco", "New York", "Software", "Senior"
        ]
        
        search_tasks = []
        for _ in range(50):  # 50 searches
            search_term = random.choice(search_terms)
            search_tasks.append(self.time_operation("search", self.search_contacts, client, search_term))
        
        start_time = time.time()
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        end_time = time.time()
        
        successful_searches = sum(1 for r in results if not isinstance(r, Exception))
        total_time = end_time - start_time
        
        print(f"✅ Search: {successful_searches} searches in {total_time:.2f}s ({successful_searches/total_time:.2f} searches/sec)")
    
    async def run_list_load_test(self, client: httpx.AsyncClient):
        """Run list load test with pagination."""
        print("📋 Running list load test...")
        
        list_tasks = []
        for i in range(20):  # 20 list operations with different pagination
            skip = i * 50
            list_tasks.append(self.time_operation("list", self.list_contacts, client, skip, 50))
        
        start_time = time.time()
        results = await asyncio.gather(*list_tasks, return_exceptions=True)
        end_time = time.time()
        
        successful_lists = sum(1 for r in results if not isinstance(r, Exception))
        total_time = end_time - start_time
        
        print(f"✅ List: {successful_lists} list operations in {total_time:.2f}s ({successful_lists/total_time:.2f} lists/sec)")
    
    def calculate_statistics(self, operation_name: str) -> Dict[str, float]:
        """Calculate statistics for an operation."""
        times = self.metrics.get(f"{operation_name}_times", [])
        
        if not times:
            return {"count": 0}
        
        return {
            "count": len(times),
            "mean": statistics.mean(times),
            "median": statistics.median(times),
            "min": min(times),
            "max": max(times),
            "std_dev": statistics.stdev(times) if len(times) > 1 else 0,
            "p95": sorted(times)[int(len(times) * 0.95)] if len(times) > 1 else times[0],
            "p99": sorted(times)[int(len(times) * 0.99)] if len(times) > 1 else times[0]
        }
    
    def print_performance_report(self):
        """Print comprehensive performance report."""
        print("\n" + "=" * 80)
        print("📊 CONTACT PERSON LOAD TEST PERFORMANCE REPORT")
        print("=" * 80)
        
        operations = ["create", "read", "update", "delete", "search", "list"]
        
        print(f"{'Operation':<12} {'Count':<8} {'Mean':<8} {'Median':<8} {'Min':<8} {'Max':<8} {'P95':<8} {'P99':<8}")
        print("-" * 80)
        
        for op in operations:
            stats = self.calculate_statistics(op)
            if stats["count"] > 0:
                print(f"{op.capitalize():<12} {stats['count']:<8} {stats['mean']:<8.3f} {stats['median']:<8.3f} "
                      f"{stats['min']:<8.3f} {stats['max']:<8.3f} {stats['p95']:<8.3f} {stats['p99']:<8.3f}")
        
        print("\n📈 SUMMARY STATISTICS")
        print("-" * 40)
        print(f"Total Requests: {self.metrics['total_requests']}")
        print(f"Successful Requests: {self.metrics['successful_requests']}")
        print(f"Failed Requests: {len(self.metrics['errors'])}")
        print(f"Success Rate: {(self.metrics['successful_requests']/self.metrics['total_requests']*100):.2f}%")
        
        if self.metrics['errors']:
            print(f"\n❌ ERROR SUMMARY ({len(self.metrics['errors'])} errors)")
            print("-" * 40)
            error_types = {}
            for error in self.metrics['errors']:
                op = error['operation']
                error_types[op] = error_types.get(op, 0) + 1
            
            for op, count in error_types.items():
                print(f"{op.capitalize()}: {count} errors")
    
    async def run_comprehensive_load_test(self, num_contacts: int = 1000):
        """Run comprehensive load test with specified number of contacts."""
        print(f"🚀 Starting comprehensive load test with {num_contacts} contacts")
        print("=" * 80)
        
        try:
            await self.setup()
            
            # Phase 1: Generate test data
            print(f"\n📊 Phase 1: Generating {num_contacts} test contacts...")
            self.test_contacts = [self.generate_test_contact(i) for i in range(num_contacts)]
            print(f"✅ Generated {len(self.test_contacts)} test contacts")
            
            # Phase 2: Bulk create contacts
            print(f"\n⚡ Phase 2: Creating {num_contacts} contacts in batches...")
            batch_size = 50
            contact_batches = [
                self.test_contacts[i:i + batch_size] 
                for i in range(0, len(self.test_contacts), batch_size)
            ]
            
            create_results = await self.run_concurrent_operations(
                "create", self.create_contact_batch, contact_batches, max_concurrent=5
            )
            
            # Collect created IDs
            for batch_result in create_results:
                if isinstance(batch_result, list):
                    self.created_contact_ids.extend(batch_result)
            
            print(f"✅ Created {len(self.created_contact_ids)} contacts successfully")
            
            if not self.created_contact_ids:
                print("❌ No contacts created, aborting load test")
                return
            
            # Phase 3: Read operations
            print(f"\n🔍 Phase 3: Reading contacts...")
            read_batches = [
                self.created_contact_ids[i:i + 25] 
                for i in range(0, min(500, len(self.created_contact_ids)), 25)  # Read first 500
            ]
            
            await self.run_concurrent_operations(
                "read", self.read_contact_batch, read_batches, max_concurrent=10
            )
            
            # Phase 4: Search operations
            print(f"\n🔎 Phase 4: Search operations...")
            async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
                await self.run_search_load_test(client)
            
            # Phase 5: List operations
            print(f"\n📋 Phase 5: List operations...")
            async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
                await self.run_list_load_test(client)
            
            # Phase 6: Update operations
            print(f"\n✏️ Phase 6: Update operations...")
            update_ids = self.created_contact_ids[:200]  # Update first 200
            update_batches = [update_ids[i:i + 20] for i in range(0, len(update_ids), 20)]
            
            await self.run_concurrent_operations(
                "update", self.update_contact_batch, update_batches, max_concurrent=5
            )
            
            # Phase 7: Delete operations (optional, cleanup)
            print(f"\n🗑️ Phase 7: Cleanup - Deleting test contacts...")
            delete_batches = [
                self.created_contact_ids[i:i + 25] 
                for i in range(0, len(self.created_contact_ids), 25)
            ]
            
            await self.run_concurrent_operations(
                "delete", self.delete_contact_batch, delete_batches, max_concurrent=5
            )
            
        except Exception as e:
            print(f"\n❌ Load test failed: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            # Print performance report
            self.print_performance_report()
    
    async def run_stress_test(self, duration_minutes: int = 5):
        """Run stress test for specified duration."""
        print(f"\n🔥 Running stress test for {duration_minutes} minutes...")
        
        end_time = time.time() + (duration_minutes * 60)
        iteration = 0
        
        while time.time() < end_time:
            iteration += 1
            print(f"\n🔄 Stress test iteration {iteration}")
            
            # Create some contacts
            test_contacts = [self.generate_test_contact(i) for i in range(10)]
            async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
                created_ids = await self.create_contact_batch(client, test_contacts)
                
                if created_ids:
                    # Read them
                    await self.read_contact_batch(client, created_ids)
                    
                    # Search
                    await self.search_contacts(client, "stress")
                    
                    # Delete them
                    await self.delete_contact_batch(client, created_ids)
            
            await asyncio.sleep(1)  # Brief pause between iterations
        
        print(f"✅ Stress test completed after {duration_minutes} minutes")


async def main():
    """Run load testing."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Contact Person Load Testing")
    parser.add_argument("--url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--contacts", type=int, default=1000, help="Number of contacts to test with")
    parser.add_argument("--stress", type=int, help="Run stress test for N minutes")
    
    args = parser.parse_args()
    
    tester = ContactPersonLoadTester(args.url)
    
    if args.stress:
        await tester.run_stress_test(args.stress)
    else:
        await tester.run_comprehensive_load_test(args.contacts)


if __name__ == "__main__":
    asyncio.run(main())