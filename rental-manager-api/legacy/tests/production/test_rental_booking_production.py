#!/usr/bin/env python3
"""
Production test script for rental_booking module
Tests booking creation, availability checks, confirmations, and cancellations
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


class BookingStatus(Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class RentalBookingProductionTest:
    """Production test suite for rental_booking module"""
    
    def __init__(self):
        self.base_url = f"{BASE_URL}/api/transactions/rentals/booking"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}"
        }
        self.test_results: List[TestResult] = []
        self.test_data = {
            "booking_ids": [],
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
        """Setup test data for booking tests"""
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
    
    async def test_create_booking(self, session: aiohttp.ClientSession) -> TestResult:
        """Test booking creation"""
        test_name = "Create Booking"
        start_time = time.time()
        
        try:
            payload = {
                "customer_id": self.test_data["customer_id"],
                "location_id": self.test_data["location_id"],
                "booking_date": date.today().isoformat(),
                "rental_start_date": (date.today() + timedelta(days=7)).isoformat(),
                "rental_end_date": (date.today() + timedelta(days=14)).isoformat(),
                "notes": "Production test booking",
                "items": [
                    {
                        "item_id": self.test_data["item_ids"][0],
                        "quantity": 2,
                        "unit_rate": 50.00
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
                    booking_id = data.get("data", {}).get("id")
                    if booking_id:
                        self.test_data["booking_ids"].append(booking_id)
                    
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
    
    async def test_check_availability(self, session: aiohttp.ClientSession) -> TestResult:
        """Test availability check"""
        test_name = "Check Availability"
        start_time = time.time()
        
        try:
            payload = {
                "item_id": self.test_data["item_ids"][0],
                "location_id": self.test_data["location_id"],
                "start_date": (date.today() + timedelta(days=30)).isoformat(),
                "end_date": (date.today() + timedelta(days=35)).isoformat(),
                "quantity": 1
            }
            
            async with session.post(
                f"{self.base_url}/availability",
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
    
    async def test_confirm_booking(self, session: aiohttp.ClientSession) -> TestResult:
        """Test booking confirmation"""
        test_name = "Confirm Booking"
        
        if not self.test_data["booking_ids"]:
            self.print_test(f"{test_name} (skipped - no booking)", True)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=0,
                error_message="No booking available"
            )
        
        start_time = time.time()
        
        try:
            booking_id = self.test_data["booking_ids"][0]
            
            async with session.post(
                f"{self.base_url}/{booking_id}/confirm",
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
    
    async def test_get_bookings(self, session: aiohttp.ClientSession) -> TestResult:
        """Test getting all bookings"""
        test_name = "Get All Bookings"
        start_time = time.time()
        
        try:
            async with session.get(
                f"{self.base_url}?limit=10",
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
    
    async def test_update_booking(self, session: aiohttp.ClientSession) -> TestResult:
        """Test booking update"""
        test_name = "Update Booking"
        
        if not self.test_data["booking_ids"]:
            self.print_test(f"{test_name} (skipped)", True)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=0,
                error_message="No booking available"
            )
        
        start_time = time.time()
        
        try:
            booking_id = self.test_data["booking_ids"][0]
            payload = {
                "notes": "Updated production test booking",
                "rental_end_date": (date.today() + timedelta(days=15)).isoformat()
            }
            
            async with session.put(
                f"{self.base_url}/{booking_id}",
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
    
    async def test_cancel_booking(self, session: aiohttp.ClientSession) -> TestResult:
        """Test booking cancellation"""
        test_name = "Cancel Booking"
        
        # Create a new booking to cancel
        await self.test_create_booking(session)
        
        if not self.test_data["booking_ids"]:
            self.print_test(f"{test_name} (skipped)", True)
            return TestResult(
                test_name=test_name,
                passed=True,
                response_time=0,
                error_message="No booking available"
            )
        
        start_time = time.time()
        
        try:
            booking_id = self.test_data["booking_ids"][-1]
            
            async with session.post(
                f"{self.base_url}/{booking_id}/cancel",
                headers=self.headers,
                json={"reason": "Production test cancellation"}
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
    
    async def test_conflict_detection(self, session: aiohttp.ClientSession) -> TestResult:
        """Test booking conflict detection"""
        test_name = "Conflict Detection"
        start_time = time.time()
        
        try:
            # Try to create overlapping booking
            payload = {
                "customer_id": self.test_data["customer_id"],
                "location_id": self.test_data["location_id"],
                "booking_date": date.today().isoformat(),
                "rental_start_date": (date.today() + timedelta(days=7)).isoformat(),
                "rental_end_date": (date.today() + timedelta(days=14)).isoformat(),
                "items": [
                    {
                        "item_id": self.test_data["item_ids"][0],
                        "quantity": 1000  # Excessive quantity to trigger conflict
                    }
                ]
            }
            
            async with session.post(
                self.base_url,
                json=payload,
                headers=self.headers
            ) as response:
                response_time = time.time() - start_time
                
                # Expecting 400 or 409 for conflict
                if response.status in [400, 409]:
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
                        error_message=f"Expected conflict, got {response.status}"
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
        """Run performance tests for booking operations"""
        self.print_header("Booking Performance Tests")
        
        operations = [
            ("List bookings", f"{self.base_url}?limit=10"),
            ("Check availability", f"{self.base_url}/availability")
        ]
        
        for op_name, url in operations:
            start_time = time.time()
            
            if "availability" in url:
                # POST request for availability
                payload = {
                    "item_id": self.test_data["item_ids"][0],
                    "location_id": self.test_data["location_id"],
                    "start_date": date.today().isoformat(),
                    "end_date": (date.today() + timedelta(days=7)).isoformat(),
                    "quantity": 1
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
        """Run all booking tests"""
        self.print_header(f"RENTAL BOOKING PRODUCTION TESTS - {TEST_MODE.upper()}")
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
                self.test_create_booking,
                self.test_check_availability,
                self.test_get_bookings,
                self.test_confirm_booking,
                self.test_update_booking,
                self.test_conflict_detection,
                self.test_cancel_booking
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
            print(f"\n{GREEN}✅ ALL BOOKING TESTS PASSED!{RESET}")
        else:
            print(f"\n{RED}❌ SOME BOOKING TESTS FAILED{RESET}")


async def main():
    tester = RentalBookingProductionTest()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())