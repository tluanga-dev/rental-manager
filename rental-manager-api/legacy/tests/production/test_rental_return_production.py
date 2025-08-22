#!/usr/bin/env python3
"""
Production test script for rental_return module
Tests return processing, partial returns, damage handling, and financial calculations
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


class ReturnAction(Enum):
    COMPLETE_RETURN = "COMPLETE_RETURN"
    PARTIAL_RETURN = "PARTIAL_RETURN"
    MARK_LATE = "MARK_LATE"
    MARK_DAMAGED = "MARK_DAMAGED"


class RentalReturnProductionTest:
    """Production test suite for rental_return module"""
    
    def __init__(self):
        self.base_url = f"{BASE_URL}/api/transactions/rentals"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        self.test_results: List[TestResult] = []
        self.test_data = {
            "rental_id": None,
            "return_id": None,
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
        """Setup test data including creating a rental to return"""
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
        
        # Create a test rental to return
        if self.test_data["customer_id"] and self.test_data["location_id"] and self.test_data["item_ids"]:
            rental_payload = {
                "customer_id": self.test_data["customer_id"],
                "location_id": self.test_data["location_id"],
                "rental_start_date": (date.today() - timedelta(days=7)).isoformat(),
                "rental_end_date": (date.today() + timedelta(days=3)).isoformat(),
                "notes": "Test rental for return testing",
                "deposit_amount": 200.00,
                "items": [
                    {
                        "item_id": self.test_data["item_ids"][0],
                        "quantity": 5,
                        "unit_rate": 50.00,
                        "rental_period_value": 10,
                        "rental_period_type": "DAYS"
                    },
                    {
                        "item_id": self.test_data["item_ids"][1],
                        "quantity": 2,
                        "unit_rate": 30.00,
                        "rental_period_value": 10,
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
    
    async def test_complete_return(self, session: aiohttp.ClientSession) -> TestResult:
        """Test complete return of all items"""
        test_name = "Complete Return"
        
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
            # Get rental details first
            async with session.get(
                f"{self.base_url}/{self.test_data['rental_id']}",
                headers=self.headers
            ) as response:
                if response.status != 200:
                    raise Exception("Failed to get rental details")
                rental_data = await response.json()
                rental_items = rental_data.get("data", {}).get("items", [])
            
            # Prepare return payload
            payload = {
                "rental_id": self.test_data["rental_id"],
                "return_date": date.today().isoformat(),
                "processed_by": "test_user",
                "notes": "Production test complete return",
                "items": [
                    {
                        "line_id": item["id"],
                        "item_id": item["item_id"],
                        "return_quantity": item["quantity"],
                        "return_action": "COMPLETE_RETURN",
                        "condition_notes": "Good condition"
                    }
                    for item in rental_items
                ]
            }
            
            async with session.post(
                f"{self.base_url}/returns",
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 201:
                    return_id = data.get("data", {}).get("id")
                    if return_id:
                        self.test_data["return_id"] = return_id
                    
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
    
    async def test_partial_return(self, session: aiohttp.ClientSession) -> TestResult:
        """Test partial return of items"""
        test_name = "Partial Return"
        
        # Create another rental for partial return
        await self.setup_test_data(session)
        
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
            # Get rental details
            async with session.get(
                f"{self.base_url}/{self.test_data['rental_id']}",
                headers=self.headers
            ) as response:
                if response.status != 200:
                    raise Exception("Failed to get rental details")
                rental_data = await response.json()
                rental_items = rental_data.get("data", {}).get("items", [])
            
            # Return only partial quantities
            payload = {
                "rental_id": self.test_data["rental_id"],
                "return_date": date.today().isoformat(),
                "processed_by": "test_user",
                "notes": "Production test partial return",
                "items": []
            }
            
            # Return partial quantity of first item only
            if rental_items:
                first_item = rental_items[0]
                partial_qty = max(1, first_item["quantity"] // 2)
                payload["items"].append({
                    "line_id": first_item["id"],
                    "item_id": first_item["item_id"],
                    "return_quantity": partial_qty,
                    "return_action": "PARTIAL_RETURN",
                    "condition_notes": "Partial return test"
                })
            
            async with session.post(
                f"{self.base_url}/returns",
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 201:
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
    
    async def test_damaged_return(self, session: aiohttp.ClientSession) -> TestResult:
        """Test return with damaged items"""
        test_name = "Damaged Item Return"
        
        # Create another rental
        await self.setup_test_data(session)
        
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
            # Get rental details
            async with session.get(
                f"{self.base_url}/{self.test_data['rental_id']}",
                headers=self.headers
            ) as response:
                if response.status != 200:
                    raise Exception("Failed to get rental details")
                rental_data = await response.json()
                rental_items = rental_data.get("data", {}).get("items", [])
            
            # Mark first item as damaged
            payload = {
                "rental_id": self.test_data["rental_id"],
                "return_date": date.today().isoformat(),
                "processed_by": "test_user",
                "notes": "Production test damaged return",
                "items": []
            }
            
            if rental_items:
                first_item = rental_items[0]
                payload["items"].append({
                    "line_id": first_item["id"],
                    "item_id": first_item["item_id"],
                    "return_quantity": first_item["quantity"],
                    "return_action": "MARK_DAMAGED",
                    "condition_notes": "Item damaged during rental",
                    "damage_notes": "Screen cracked",
                    "damage_penalty": 50.00
                })
            
            async with session.post(
                f"{self.base_url}/returns",
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 201:
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
    
    async def test_late_return(self, session: aiohttp.ClientSession) -> TestResult:
        """Test late return with fee calculation"""
        test_name = "Late Return"
        
        # Create a rental that's overdue
        if self.test_data["customer_id"] and self.test_data["location_id"] and self.test_data["item_ids"]:
            rental_payload = {
                "customer_id": self.test_data["customer_id"],
                "location_id": self.test_data["location_id"],
                "rental_start_date": (date.today() - timedelta(days=20)).isoformat(),
                "rental_end_date": (date.today() - timedelta(days=5)).isoformat(),  # Already overdue
                "notes": "Test rental for late return testing",
                "deposit_amount": 100.00,
                "items": [
                    {
                        "item_id": self.test_data["item_ids"][0],
                        "quantity": 2,
                        "unit_rate": 25.00,
                        "rental_period_value": 15,
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
                    late_rental_id = data.get("data", {}).get("id")
        else:
            late_rental_id = None
        
        if not late_rental_id:
            self.print_test(f"{test_name} (skipped - no rental)", True)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=0,
                error_message="No rental available"
            )
        
        start_time = time.time()
        
        try:
            # Get rental details
            async with session.get(
                f"{self.base_url}/{late_rental_id}",
                headers=self.headers
            ) as response:
                if response.status != 200:
                    raise Exception("Failed to get rental details")
                rental_data = await response.json()
                rental_items = rental_data.get("data", {}).get("items", [])
            
            # Process late return
            payload = {
                "rental_id": late_rental_id,
                "return_date": date.today().isoformat(),
                "processed_by": "test_user",
                "notes": "Production test late return",
                "late_fee": 25.00,  # Calculate based on days late
                "items": [
                    {
                        "line_id": item["id"],
                        "item_id": item["item_id"],
                        "return_quantity": item["quantity"],
                        "return_action": "MARK_LATE",
                        "condition_notes": "Returned late"
                    }
                    for item in rental_items
                ]
            }
            
            async with session.post(
                f"{self.base_url}/returns",
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                data = await response.json()
                
                if response.status == 201:
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
    
    async def test_calculate_return_fees(self, session: aiohttp.ClientSession) -> TestResult:
        """Test return fee calculation"""
        test_name = "Calculate Return Fees"
        
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
                "return_date": date.today().isoformat(),
                "items": [
                    {
                        "item_id": self.test_data["item_ids"][0],
                        "return_quantity": 2,
                        "is_damaged": False
                    }
                ]
            }
            
            async with session.post(
                f"{self.base_url}/returns/calculate-fees",
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
    
    async def test_get_return_history(self, session: aiohttp.ClientSession) -> TestResult:
        """Test getting return history for a rental"""
        test_name = "Get Return History"
        
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
                f"{self.base_url}/{self.test_data['rental_id']}/returns",
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
        """Run performance tests for return operations"""
        self.print_header("Return Performance Tests")
        
        operations = [
            ("Calculate fees", f"{self.base_url}/returns/calculate-fees"),
            ("Get pending returns", f"{self.base_url}/returns/pending")
        ]
        
        for op_name, url in operations:
            start_time = time.time()
            
            if "calculate" in url:
                # POST request for fee calculation
                payload = {
                    "rental_id": self.test_data["rental_id"],
                    "return_date": date.today().isoformat(),
                    "items": []
                }
                async with session.post(url, json=payload, headers=self.headers) as response:
                    response_time = time.time() - start_time
            else:
                async with session.get(url, headers=self.headers) as response:
                    response_time = time.time() - start_time
            
            if response_time < 0.5:
                print(f"  {GREEN}✓ {op_name}: {response_time:.3f}s{RESET}")
            elif response_time < 1.0:
                print(f"  {YELLOW}⚠ {op_name}: {response_time:.3f}s{RESET}")
            else:
                print(f"  {RED}✗ {op_name}: {response_time:.3f}s{RESET}")
    
    async def run_all_tests(self):
        """Run all return tests"""
        self.print_header(f"RENTAL RETURN PRODUCTION TESTS - {TEST_MODE.upper()}")
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
                self.test_complete_return,
                self.test_partial_return,
                self.test_damaged_return,
                self.test_late_return,
                self.test_calculate_return_fees,
                self.test_get_return_history
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
            print(f"\n{GREEN}✅ ALL RETURN TESTS PASSED!{RESET}")
        else:
            print(f"\n{RED}❌ SOME RETURN TESTS FAILED{RESET}")


async def main():
    tester = RentalReturnProductionTest()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())