#!/usr/bin/env python3
"""
Production test script for rental_core module
Runs comprehensive tests against production API
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Dict, List, Any, Optional
import uuid
import time
from dataclasses import dataclass
from enum import Enum

# Configuration
PRODUCTION_URL = os.getenv("PRODUCTION_API_URL", "https://api.production.com")
STAGING_URL = os.getenv("STAGING_API_URL", "http://localhost:8000")
API_KEY = os.getenv("API_KEY", "")
TEST_MODE = os.getenv("TEST_MODE", "staging")  # staging or production

# Use staging by default for safety
BASE_URL = PRODUCTION_URL if TEST_MODE == "production" else STAGING_URL

# Test colors for console output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


@dataclass
class TestResult:
    """Test result tracking"""
    test_name: str
    passed: bool
    response_time: float
    error_message: Optional[str] = None
    response_data: Optional[Dict] = None


class TestStatus(Enum):
    """Test status enum"""
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class RentalCoreProductionTest:
    """Production test suite for rental_core module"""
    
    def __init__(self):
        self.base_url = f"{BASE_URL}/api/transactions/rentals"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        self.test_results: List[TestResult] = []
        self.test_data = {
            "rental_ids": [],
            "customer_id": None,
            "location_id": None,
            "item_ids": []
        }
    
    def print_header(self, text: str):
        """Print section header"""
        print(f"\n{BLUE}{'='*60}{RESET}")
        print(f"{BLUE}{text}{RESET}")
        print(f"{BLUE}{'='*60}{RESET}")
    
    def print_test(self, name: str, status: TestStatus):
        """Print test status"""
        if status == TestStatus.PASSED:
            print(f"  {GREEN}✓ {name}{RESET}")
        elif status == TestStatus.FAILED:
            print(f"  {RED}✗ {name}{RESET}")
        elif status == TestStatus.RUNNING:
            print(f"  {YELLOW}⟳ {name}...{RESET}", end="\r")
        elif status == TestStatus.SKIPPED:
            print(f"  {YELLOW}⊘ {name} (skipped){RESET}")
    
    async def setup_test_data(self, session: aiohttp.ClientSession):
        """Setup test data for production testing"""
        self.print_header("Setting Up Test Data")
        
        # Get test customer
        async with session.get(
            f"{BASE_URL}/api/customers?limit=1",
            headers=self.headers
        ) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("data"):
                    self.test_data["customer_id"] = data["data"][0]["id"]
                    print(f"  {GREEN}✓ Test customer found{RESET}")
        
        # Get test location
        async with session.get(
            f"{BASE_URL}/api/master-data/locations?limit=1",
            headers=self.headers
        ) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("data"):
                    self.test_data["location_id"] = data["data"][0]["id"]
                    print(f"  {GREEN}✓ Test location found{RESET}")
        
        # Get test items
        async with session.get(
            f"{BASE_URL}/api/master-data/items?limit=3",
            headers=self.headers
        ) as response:
            if response.status == 200:
                data = await response.json()
                if data.get("data"):
                    self.test_data["item_ids"] = [item["id"] for item in data["data"]]
                    print(f"  {GREEN}✓ {len(self.test_data['item_ids'])} test items found{RESET}")
    
    async def test_create_rental(self, session: aiohttp.ClientSession) -> TestResult:
        """Test rental creation"""
        test_name = "Create Rental"
        self.print_test(test_name, TestStatus.RUNNING)
        
        start_time = time.time()
        
        try:
            payload = {
                "customer_id": self.test_data["customer_id"],
                "location_id": self.test_data["location_id"],
                "transaction_date": date.today().isoformat(),
                "rental_start_date": date.today().isoformat(),
                "rental_end_date": (date.today() + timedelta(days=7)).isoformat(),
                "payment_method": "CASH",
                "notes": "Production test rental",
                "items": [
                    {
                        "item_id": self.test_data["item_ids"][0],
                        "quantity": 1,
                        "rental_period_value": 7,
                        "rental_period_type": "DAILY",
                        "unit_rate": 100.00,
                        "discount_value": 10.00,
                        "rental_start_date": date.today().isoformat(),
                        "rental_end_date": (date.today() + timedelta(days=7)).isoformat()
                    }
                ]
            }
            
            async with session.post(
                self.base_url,
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 201:
                    rental_id = data.get("data", {}).get("id")
                    if rental_id:
                        self.test_data["rental_ids"].append(rental_id)
                    
                    self.print_test(test_name, TestStatus.PASSED)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, TestStatus.FAILED)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}: {data}",
                        response_data=data
                    )
        
        except Exception as e:
            self.print_test(test_name, TestStatus.FAILED)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_get_all_rentals(self, session: aiohttp.ClientSession) -> TestResult:
        """Test getting all rentals"""
        test_name = "Get All Rentals"
        self.print_test(test_name, TestStatus.RUNNING)
        
        start_time = time.time()
        
        try:
            async with session.get(
                f"{self.base_url}?limit=10",
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 200:
                    self.print_test(test_name, TestStatus.PASSED)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, TestStatus.FAILED)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}",
                        response_data=data
                    )
        
        except Exception as e:
            self.print_test(test_name, TestStatus.FAILED)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_get_rental_by_id(self, session: aiohttp.ClientSession) -> TestResult:
        """Test getting rental by ID"""
        test_name = "Get Rental by ID"
        
        if not self.test_data["rental_ids"]:
            self.print_test(test_name, TestStatus.SKIPPED)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=0,
                error_message="No rental ID available for testing"
            )
        
        self.print_test(test_name, TestStatus.RUNNING)
        start_time = time.time()
        
        try:
            rental_id = self.test_data["rental_ids"][0]
            async with session.get(
                f"{self.base_url}/{rental_id}",
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 200:
                    self.print_test(test_name, TestStatus.PASSED)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, TestStatus.FAILED)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}",
                        response_data=data
                    )
        
        except Exception as e:
            self.print_test(test_name, TestStatus.FAILED)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_get_active_rentals(self, session: aiohttp.ClientSession) -> TestResult:
        """Test getting active rentals"""
        test_name = "Get Active Rentals"
        self.print_test(test_name, TestStatus.RUNNING)
        
        start_time = time.time()
        
        try:
            async with session.get(
                f"{self.base_url}/active",
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 200:
                    self.print_test(test_name, TestStatus.PASSED)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, TestStatus.FAILED)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}",
                        response_data=data
                    )
        
        except Exception as e:
            self.print_test(test_name, TestStatus.FAILED)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_get_overdue_rentals(self, session: aiohttp.ClientSession) -> TestResult:
        """Test getting overdue rentals"""
        test_name = "Get Overdue Rentals"
        self.print_test(test_name, TestStatus.RUNNING)
        
        start_time = time.time()
        
        try:
            async with session.get(
                f"{self.base_url}/overdue",
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 200:
                    self.print_test(test_name, TestStatus.PASSED)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, TestStatus.FAILED)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}",
                        response_data=data
                    )
        
        except Exception as e:
            self.print_test(test_name, TestStatus.FAILED)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_search_rentals(self, session: aiohttp.ClientSession) -> TestResult:
        """Test rental search functionality"""
        test_name = "Search Rentals"
        self.print_test(test_name, TestStatus.RUNNING)
        
        start_time = time.time()
        
        try:
            async with session.get(
                f"{self.base_url}?search=test&limit=10",
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 200:
                    self.print_test(test_name, TestStatus.PASSED)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, TestStatus.FAILED)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}",
                        response_data=data
                    )
        
        except Exception as e:
            self.print_test(test_name, TestStatus.FAILED)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_pagination(self, session: aiohttp.ClientSession) -> TestResult:
        """Test pagination"""
        test_name = "Pagination Test"
        self.print_test(test_name, TestStatus.RUNNING)
        
        start_time = time.time()
        
        try:
            # Test different page sizes
            for page_size in [1, 10, 50]:
                async with session.get(
                    f"{self.base_url}?limit={page_size}&skip=0",
                    headers=self.headers
                ) as response:
                    if response.status != 200:
                        self.print_test(test_name, TestStatus.FAILED)
                        return TestResult(
                            test_name=test_name,
                            passed=False,
                            response_time=time.time() - start_time,
                            error_message=f"Failed for page size {page_size}"
                        )
            
            self.print_test(test_name, TestStatus.PASSED)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=time.time() - start_time
            )
        
        except Exception as e:
            self.print_test(test_name, TestStatus.FAILED)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_error_handling(self, session: aiohttp.ClientSession) -> TestResult:
        """Test error handling"""
        test_name = "Error Handling"
        self.print_test(test_name, TestStatus.RUNNING)
        
        start_time = time.time()
        
        try:
            # Test invalid rental ID
            async with session.get(
                f"{self.base_url}/invalid-uuid-123",
                headers=self.headers
            ) as response:
                if response.status == 404 or response.status == 400:
                    self.print_test(test_name, TestStatus.PASSED)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=time.time() - start_time
                    )
                else:
                    self.print_test(test_name, TestStatus.FAILED)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=time.time() - start_time,
                        error_message=f"Expected 404/400, got {response.status}"
                    )
        
        except Exception as e:
            self.print_test(test_name, TestStatus.FAILED)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def run_performance_tests(self, session: aiohttp.ClientSession):
        """Run performance tests"""
        self.print_header("Performance Tests")
        
        # Test response times for different operations
        operations = [
            ("List 10 rentals", f"{self.base_url}?limit=10"),
            ("List 100 rentals", f"{self.base_url}?limit=100"),
            ("Active rentals", f"{self.base_url}/active"),
            ("Overdue rentals", f"{self.base_url}/overdue")
        ]
        
        for op_name, url in operations:
            start_time = time.time()
            async with session.get(url, headers=self.headers) as response:
                response_time = time.time() - start_time
                
                if response_time < 0.5:
                    print(f"  {GREEN}✓ {op_name}: {response_time:.3f}s (Good){RESET}")
                elif response_time < 1.0:
                    print(f"  {YELLOW}⚠ {op_name}: {response_time:.3f}s (Acceptable){RESET}")
                else:
                    print(f"  {RED}✗ {op_name}: {response_time:.3f}s (Slow){RESET}")
    
    async def run_all_tests(self):
        """Run all production tests"""
        self.print_header(f"RENTAL CORE PRODUCTION TESTS - {TEST_MODE.upper()}")
        print(f"Testing against: {BASE_URL}")
        
        async with aiohttp.ClientSession() as session:
            # Setup test data
            await self.setup_test_data(session)
            
            if not self.test_data["customer_id"] or not self.test_data["location_id"]:
                print(f"{RED}✗ Failed to setup test data. Aborting tests.{RESET}")
                return
            
            # Run functional tests
            self.print_header("Functional Tests")
            
            tests = [
                self.test_create_rental,
                self.test_get_all_rentals,
                self.test_get_rental_by_id,
                self.test_get_active_rentals,
                self.test_get_overdue_rentals,
                self.test_search_rentals,
                self.test_pagination,
                self.test_error_handling
            ]
            
            for test in tests:
                result = await test(session)
                self.test_results.append(result)
            
            # Run performance tests
            await self.run_performance_tests(session)
            
            # Print summary
            self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        self.print_header("TEST SUMMARY")
        
        passed = sum(1 for r in self.test_results if r.passed)
        failed = sum(1 for r in self.test_results if not r.passed)
        total = len(self.test_results)
        
        print(f"\nTotal Tests: {total}")
        print(f"{GREEN}Passed: {passed}{RESET}")
        print(f"{RED}Failed: {failed}{RESET}")
        
        if failed > 0:
            print(f"\n{RED}Failed Tests:{RESET}")
            for result in self.test_results:
                if not result.passed:
                    print(f"  - {result.test_name}: {result.error_message}")
        
        # Performance summary
        avg_response_time = sum(r.response_time for r in self.test_results) / len(self.test_results)
        print(f"\nAverage Response Time: {avg_response_time:.3f}s")
        
        if failed == 0:
            print(f"\n{GREEN}✅ ALL TESTS PASSED!{RESET}")
        else:
            print(f"\n{RED}❌ SOME TESTS FAILED{RESET}")


async def main():
    """Main entry point"""
    tester = RentalCoreProductionTest()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())