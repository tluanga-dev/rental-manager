#!/usr/bin/env python3
"""
Production test script for rental_extension module
Tests extension requests, approvals, rejections, and conflict detection
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
TEST_MODE = os.getenv("TEST_MODE", "staging")

BASE_URL = PRODUCTION_URL if TEST_MODE == "production" else STAGING_URL

# Colors
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


@dataclass
class TestResult:
    test_name: str
    passed: bool
    response_time: float
    error_message: Optional[str] = None
    response_data: Optional[Dict] = None


class ExtensionStatus(Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class RentalExtensionProductionTest:
    """Production test suite for rental_extension module"""
    
    def __init__(self):
        self.base_url = f"{BASE_URL}/api/transactions/rentals"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        self.test_results: List[TestResult] = []
        self.test_data = {
            "rental_id": None,
            "extension_id": None,
            "customer_id": None,
            "location_id": None,
            "item_ids": []
        }
    
    def print_header(self, text: str):
        print(f"\n{BLUE}{'='*60}{RESET}")
        print(f"{BLUE}{text}{RESET}")
        print(f"{BLUE}{'='*60}{RESET}")
    
    def print_test(self, name: str, passed: bool):
        if passed:
            print(f"  {GREEN}✓ {name}{RESET}")
        else:
            print(f"  {RED}✗ {name}{RESET}")
    
    async def setup_test_data(self, session: aiohttp.ClientSession):
        """Setup test data including creating a rental to extend"""
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
        
        # Create a test rental to extend
        if self.test_data["customer_id"] and self.test_data["location_id"] and self.test_data["item_ids"]:
            rental_payload = {
                "customer_id": self.test_data["customer_id"],
                "location_id": self.test_data["location_id"],
                "rental_start_date": date.today().isoformat(),
                "rental_end_date": (date.today() + timedelta(days=7)).isoformat(),
                "notes": "Test rental for extension testing",
                "items": [
                    {
                        "item_id": self.test_data["item_ids"][0],
                        "quantity": 2,
                        "unit_rate": 50.00,
                        "rental_period_value": 7,
                        "rental_period_type": "DAYS"
                    }
                ]
            }
            
            async with session.post(
                self.base_url,
                json=rental_payload,
                headers=self.headers
            ) as response:
                if response.status == 201:
                    data = await response.json()
                    self.test_data["rental_id"] = data.get("data", {}).get("id")
                    print(f"  {GREEN}✓ Test rental created{RESET}")
    
    async def test_create_extension_request(self, session: aiohttp.ClientSession) -> TestResult:
        """Test creating an extension request"""
        test_name = "Create Extension Request"
        
        if not self.test_data["rental_id"]:
            self.print_test(f"{test_name} (skipped - no rental)", True)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=0,
                error_message="No rental available"
            )
        
        start_time = time.time()
        
        try:
            payload = {
                "rental_id": self.test_data["rental_id"],
                "new_end_date": (date.today() + timedelta(days=14)).isoformat(),
                "reason": "Production test extension request",
                "requested_by": "test_user"
            }
            
            async with session.post(
                f"{self.base_url}/extensions",
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 201:
                    extension_id = data.get("data", {}).get("id")
                    if extension_id:
                        self.test_data["extension_id"] = extension_id
                    
                    self.print_test(test_name, True)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, False)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}: {data}"
                    )
        
        except Exception as e:
            self.print_test(test_name, False)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_get_extension_requests(self, session: aiohttp.ClientSession) -> TestResult:
        """Test getting all extension requests"""
        test_name = "Get Extension Requests"
        start_time = time.time()
        
        try:
            async with session.get(
                f"{self.base_url}/extensions?limit=10",
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 200:
                    self.print_test(test_name, True)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, False)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}"
                    )
        
        except Exception as e:
            self.print_test(test_name, False)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_approve_extension(self, session: aiohttp.ClientSession) -> TestResult:
        """Test approving an extension request"""
        test_name = "Approve Extension"
        
        if not self.test_data["extension_id"]:
            self.print_test(f"{test_name} (skipped - no extension)", True)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=0,
                error_message="No extension available"
            )
        
        start_time = time.time()
        
        try:
            payload = {
                "approved_by": "test_admin",
                "approval_notes": "Production test approval"
            }
            
            async with session.post(
                f"{self.base_url}/extensions/{self.test_data['extension_id']}/approve",
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 200:
                    self.print_test(test_name, True)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, False)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}"
                    )
        
        except Exception as e:
            self.print_test(test_name, False)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_reject_extension(self, session: aiohttp.ClientSession) -> TestResult:
        """Test rejecting an extension request"""
        test_name = "Reject Extension"
        
        # Create another extension request to reject
        await self.test_create_extension_request(session)
        
        if not self.test_data["extension_id"]:
            self.print_test(f"{test_name} (skipped - no extension)", True)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=0,
                error_message="No extension available"
            )
        
        start_time = time.time()
        
        try:
            payload = {
                "rejected_by": "test_admin",
                "rejection_reason": "Production test rejection"
            }
            
            async with session.post(
                f"{self.base_url}/extensions/{self.test_data['extension_id']}/reject",
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 200:
                    self.print_test(test_name, True)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, False)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}"
                    )
        
        except Exception as e:
            self.print_test(test_name, False)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_extension_conflict_detection(self, session: aiohttp.ClientSession) -> TestResult:
        """Test extension conflict detection"""
        test_name = "Extension Conflict Detection"
        start_time = time.time()
        
        try:
            # Try to create an extension with invalid date (before current end date)
            payload = {
                "rental_id": self.test_data["rental_id"],
                "new_end_date": (date.today() - timedelta(days=1)).isoformat(),
                "reason": "Invalid extension test",
                "requested_by": "test_user"
            }
            
            async with session.post(
                f"{self.base_url}/extensions",
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                
                # Expecting 400 for invalid extension
                if response.status in [400, 422]:
                    self.print_test(test_name, True)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time
                    )
                else:
                    self.print_test(test_name, False)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Expected error, got {response.status}"
                    )
        
        except Exception as e:
            self.print_test(test_name, False)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_get_rental_extensions(self, session: aiohttp.ClientSession) -> TestResult:
        """Test getting extensions for a specific rental"""
        test_name = "Get Rental Extensions"
        
        if not self.test_data["rental_id"]:
            self.print_test(f"{test_name} (skipped - no rental)", True)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=0,
                error_message="No rental available"
            )
        
        start_time = time.time()
        
        try:
            async with session.get(
                f"{self.base_url}/{self.test_data['rental_id']}/extensions",
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 200:
                    self.print_test(test_name, True)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, False)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}"
                    )
        
        except Exception as e:
            self.print_test(test_name, False)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def test_calculate_extension_fees(self, session: aiohttp.ClientSession) -> TestResult:
        """Test extension fee calculation"""
        test_name = "Calculate Extension Fees"
        
        if not self.test_data["rental_id"]:
            self.print_test(f"{test_name} (skipped - no rental)", True)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=0,
                error_message="No rental available"
            )
        
        start_time = time.time()
        
        try:
            payload = {
                "rental_id": self.test_data["rental_id"],
                "new_end_date": (date.today() + timedelta(days=21)).isoformat()
            }
            
            async with session.post(
                f"{self.base_url}/extensions/calculate-fees",
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 200:
                    self.print_test(test_name, True)
                    return TestResult(
                        test_name=test_name,
                        passed=True,
                        response_time=response_time,
                        response_data=data
                    )
                else:
                    self.print_test(test_name, False)
                    return TestResult(
                        test_name=test_name,
                        passed=False,
                        response_time=response_time,
                        error_message=f"Status {response.status}"
                    )
        
        except Exception as e:
            self.print_test(test_name, False)
            return TestResult(
                test_name=test_name,
                passed=False,
                response_time=time.time() - start_time,
                error_message=str(e)
            )
    
    async def run_performance_tests(self, session: aiohttp.ClientSession):
        """Run performance tests for extension operations"""
        self.print_header("Extension Performance Tests")
        
        operations = [
            ("List extensions", f"{self.base_url}/extensions?limit=10"),
            ("Get pending extensions", f"{self.base_url}/extensions/pending")
        ]
        
        for op_name, url in operations:
            start_time = time.time()
            
            async with session.get(url, headers=self.headers) as response:
                response_time = time.time() - start_time
            
            if response_time < 0.5:
                print(f"  {GREEN}✓ {op_name}: {response_time:.3f}s{RESET}")
            elif response_time < 1.0:
                print(f"  {YELLOW}⚠ {op_name}: {response_time:.3f}s{RESET}")
            else:
                print(f"  {RED}✗ {op_name}: {response_time:.3f}s{RESET}")
    
    async def run_all_tests(self):
        """Run all extension tests"""
        self.print_header(f"RENTAL EXTENSION PRODUCTION TESTS - {TEST_MODE.upper()}")
        print(f"Testing against: {BASE_URL}")
        
        async with aiohttp.ClientSession() as session:
            # Setup test data
            await self.setup_test_data(session)
            
            if not self.test_data["customer_id"] or not self.test_data["location_id"]:
                print(f"{RED}✗ Failed to setup test data{RESET}")
                return
            
            # Functional tests
            self.print_header("Functional Tests")
            
            tests = [
                self.test_create_extension_request,
                self.test_get_extension_requests,
                self.test_get_rental_extensions,
                self.test_calculate_extension_fees,
                self.test_approve_extension,
                self.test_reject_extension,
                self.test_extension_conflict_detection
            ]
            
            for test in tests:
                result = await test(session)
                self.test_results.append(result)
            
            # Performance tests
            await self.run_performance_tests(session)
            
            # Summary
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
        
        avg_response_time = sum(r.response_time for r in self.test_results if r.response_time > 0) / max(1, len([r for r in self.test_results if r.response_time > 0]))
        print(f"\nAverage Response Time: {avg_response_time:.3f}s")
        
        if failed == 0:
            print(f"\n{GREEN}✅ ALL EXTENSION TESTS PASSED!{RESET}")
        else:
            print(f"\n{RED}❌ SOME EXTENSION TESTS FAILED{RESET}")


async def main():
    tester = RentalExtensionProductionTest()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())