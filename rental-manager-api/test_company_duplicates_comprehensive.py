#!/usr/bin/env python3
"""
Comprehensive Company Duplicate Prevention Test Suite

This script tests duplicate prevention with 10,000 variations to ensure
100% reliability of the company name, GST, and registration number uniqueness constraints.
"""

import asyncio
import json
import sys
import uuid
import random
import string
from typing import Dict, Any, Optional, List, Set
import aiohttp
from datetime import datetime
import time


class CompanyDuplicateStressTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.auth_token: Optional[str] = None
        self.test_results = []
        self.created_companies: List[str] = []
        self.test_company_pattern = "STRESS_TEST_"
        self.total_tests = 0
        self.successful_tests = 0
        self.failed_tests = 0
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        await self.authenticate()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def authenticate(self):
        """Authenticate with the API to get a bearer token"""
        try:
            auth_data = {
                "username": "admin",
                "password": "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"
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
                    text = await response.text()
                    print(f"Response: {text}")
                    return False
        except Exception as e:
            print(f"✗ Authentication error: {e}")
            return False
            
    def get_auth_headers(self) -> Dict[str, str]:
        """Get headers with authorization token"""
        if self.auth_token:
            return {
                "Authorization": f"Bearer {self.auth_token}",
                "Content-Type": "application/json"
            }
        return {"Content-Type": "application/json"}
    
    def generate_unique_company_data(self, index: int) -> Dict[str, Any]:
        """Generate unique company data for stress testing"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        return {
            "company_name": f"{self.test_company_pattern}Company_{index}_{timestamp}_{random_suffix}",
            "address": f"{index} Test Street\nTest City, TC {10000 + index}\nTestland",
            "email": f"test{index}_{timestamp}@stresstest.com",
            "phone": f"+1-555-{(1000000 + index) % 9999999:07d}",
            "gst_no": f"{index:06d}{timestamp[:6]}RT{index:04d}",
            "registration_number": f"ST{index:08d}_{timestamp[:8]}"
        }
    
    def generate_random_words(self, count: int = 3) -> str:
        """Generate random words for company names"""
        words = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", 
                "Solutions", "Technologies", "Industries", "Corporation", "Enterprises",
                "Global", "International", "Advanced", "Premium", "Elite", "Supreme"]
        return " ".join(random.choices(words, k=count))
    
    async def create_company(self, company_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a company and return the result"""
        url = f"{self.base_url}/api/v1/companies/"
        headers = self.get_auth_headers()
        
        try:
            async with self.session.post(url, headers=headers, data=json.dumps(company_data)) as response:
                response_data = {}
                try:
                    response_data = await response.json()
                except:
                    response_data = {"text": await response.text()}
                
                result = {
                    "status": response.status,
                    "success": response.status == 201,
                    "response_data": response_data,
                    "company_data": company_data
                }
                
                if result["success"] and "id" in response_data:
                    self.created_companies.append(response_data["id"])
                
                return result
                
        except Exception as e:
            return {
                "status": 0,
                "success": False,
                "error": str(e),
                "company_data": company_data
            }
    
    async def update_company(self, company_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update a company and return the result"""
        url = f"{self.base_url}/api/v1/companies/{company_id}"
        headers = self.get_auth_headers()
        
        try:
            async with self.session.put(url, headers=headers, data=json.dumps(update_data)) as response:
                response_data = {}
                try:
                    response_data = await response.json()
                except:
                    response_data = {"text": await response.text()}
                
                return {
                    "status": response.status,
                    "success": response.status == 200,
                    "response_data": response_data,
                    "update_data": update_data
                }
                
        except Exception as e:
            return {
                "status": 0,
                "success": False,
                "error": str(e),
                "update_data": update_data
            }
    
    async def test_duplicate_attempt(self, original_data: Dict[str, Any], duplicate_field: str) -> bool:
        """Test that creating/updating with duplicate data fails"""
        self.total_tests += 1
        
        # Create duplicate data
        duplicate_data = self.generate_unique_company_data(99999)
        duplicate_data[duplicate_field] = original_data[duplicate_field]
        
        # Try to create duplicate
        result = await self.create_company(duplicate_data)
        
        if result["status"] == 409:  # Conflict - duplicate rejected
            self.successful_tests += 1
            return True
        else:
            self.failed_tests += 1
            print(f"✗ FAILED: Duplicate {duplicate_field} was allowed!")
            print(f"  Original: {original_data[duplicate_field]}")
            print(f"  Status: {result['status']}")
            return False
    
    async def cleanup_test_companies(self):
        """Clean up all test companies created during the stress test"""
        print(f"\n🧹 Cleaning up {len(self.created_companies)} test companies...")
        
        cleanup_count = 0
        for company_id in self.created_companies:
            try:
                url = f"{self.base_url}/api/v1/companies/{company_id}"
                headers = self.get_auth_headers()
                
                async with self.session.delete(url, headers=headers) as response:
                    if response.status == 204:
                        cleanup_count += 1
                    
            except Exception as e:
                print(f"Failed to delete company {company_id}: {e}")
        
        print(f"✓ Cleaned up {cleanup_count}/{len(self.created_companies)} companies")
        
        # Additional cleanup: Find any companies with test pattern and delete them
        try:
            url = f"{self.base_url}/api/v1/companies/?search={self.test_company_pattern}&page_size=100"
            headers = self.get_auth_headers()
            
            async with self.session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    additional_companies = data.get("items", [])
                    
                    for company in additional_companies:
                        company_id = company.get("id")
                        if company_id:
                            try:
                                delete_url = f"{self.base_url}/api/v1/companies/{company_id}"
                                async with self.session.delete(delete_url, headers=headers) as del_response:
                                    if del_response.status == 204:
                                        cleanup_count += 1
                            except:
                                pass
                    
                    if additional_companies:
                        print(f"✓ Found and cleaned up {len(additional_companies)} additional test companies")
        except:
            pass
    
    async def run_core_duplicate_tests(self):
        """Run core duplicate prevention tests (100 variations)"""
        print("\n" + "="*80)
        print("Core Duplicate Prevention Tests (100 variations)")
        print("="*80)
        
        test_cases = []
        
        # Test 1-20: Company name duplicates with various patterns
        for i in range(20):
            base_data = self.generate_unique_company_data(i)
            test_cases.append((base_data, "company_name", f"Company name duplicate test {i+1}"))
        
        # Test 21-40: GST number duplicates
        for i in range(20, 40):
            base_data = self.generate_unique_company_data(i)
            test_cases.append((base_data, "gst_no", f"GST number duplicate test {i+1}"))
        
        # Test 41-60: Registration number duplicates
        for i in range(40, 60):
            base_data = self.generate_unique_company_data(i)
            test_cases.append((base_data, "registration_number", f"Registration number duplicate test {i+1}"))
        
        # Test 61-80: Mixed field duplicates
        fields = ["company_name", "gst_no", "registration_number"]
        for i in range(60, 80):
            base_data = self.generate_unique_company_data(i)
            field = fields[i % 3]
            test_cases.append((base_data, field, f"Mixed field duplicate test {i+1}"))
        
        # Test 81-100: Special characters and edge cases
        for i in range(80, 100):
            base_data = self.generate_unique_company_data(i)
            # Add special characters to company name
            base_data["company_name"] = f"Special & Co. Ltd #{i} (Test)"
            test_cases.append((base_data, "company_name", f"Special character test {i+1}"))
        
        # Run all core tests
        core_successful = 0
        for base_data, duplicate_field, test_name in test_cases:
            # First create the original company
            create_result = await self.create_company(base_data)
            if create_result["success"]:
                # Test duplicate prevention
                if await self.test_duplicate_attempt(base_data, duplicate_field):
                    core_successful += 1
                    print(f"✓ {test_name}")
                else:
                    print(f"✗ {test_name}")
            else:
                print(f"✗ {test_name} - Failed to create original company")
                self.failed_tests += 1
        
        print(f"\nCore Tests: {core_successful}/{len(test_cases)} passed")
        return core_successful, len(test_cases)
    
    async def run_stress_test_10000(self):
        """Run stress test with 10,000 duplicate prevention attempts"""
        print("\n" + "="*80)
        print("Stress Test: 10,000 Duplicate Prevention Attempts")
        print("="*80)
        
        batch_size = 100
        total_variations = 10000
        stress_successful = 0
        
        for batch_start in range(0, total_variations, batch_size):
            batch_end = min(batch_start + batch_size, total_variations)
            batch_size_actual = batch_end - batch_start
            
            print(f"Processing batch {batch_start//batch_size + 1}/{(total_variations + batch_size - 1)//batch_size} (items {batch_start+1}-{batch_end})")
            
            # Create batch of original companies
            batch_companies = []
            for i in range(batch_start, batch_end):
                company_data = self.generate_unique_company_data(i)
                create_result = await self.create_company(company_data)
                if create_result["success"]:
                    batch_companies.append(company_data)
            
            # Test duplicates for each company in batch
            batch_success = 0
            for company_data in batch_companies:
                # Test company name duplicate
                if await self.test_duplicate_attempt(company_data, "company_name"):
                    batch_success += 1
                
                # Test GST number duplicate
                if await self.test_duplicate_attempt(company_data, "gst_no"):
                    batch_success += 1
                
                # Test registration number duplicate
                if await self.test_duplicate_attempt(company_data, "registration_number"):
                    batch_success += 1
            
            stress_successful += batch_success
            print(f"Batch {batch_start//batch_size + 1} completed: {batch_success}/{len(batch_companies) * 3} duplicate attempts properly rejected")
            
            # Small delay to avoid overwhelming the system
            await asyncio.sleep(0.1)
        
        expected_tests = total_variations * 3  # 3 fields per company
        print(f"\nStress Test: {stress_successful}/{expected_tests} duplicate attempts properly rejected")
        return stress_successful, expected_tests
    
    async def run_update_duplicate_tests(self):
        """Test duplicate prevention during updates"""
        print("\n" + "="*80)
        print("Update Duplicate Prevention Tests")
        print("="*80)
        
        # Create two companies
        company1_data = self.generate_unique_company_data(10001)
        company2_data = self.generate_unique_company_data(10002)
        
        result1 = await self.create_company(company1_data)
        result2 = await self.create_company(company2_data)
        
        if not (result1["success"] and result2["success"]):
            print("✗ Failed to create companies for update test")
            return 0, 3
        
        company1_id = result1["response_data"]["id"]
        company2_id = result2["response_data"]["id"]
        
        update_tests_passed = 0
        
        # Test 1: Try to update company2 to have company1's name
        update_data = {"company_name": company1_data["company_name"]}
        update_result = await self.update_company(company2_id, update_data)
        if update_result["status"] == 409:
            update_tests_passed += 1
            print("✓ Update duplicate company name properly rejected")
        else:
            print(f"✗ Update duplicate company name was allowed (status: {update_result['status']})")
        
        # Test 2: Try to update company2 to have company1's GST
        update_data = {"gst_no": company1_data["gst_no"]}
        update_result = await self.update_company(company2_id, update_data)
        if update_result["status"] == 409:
            update_tests_passed += 1
            print("✓ Update duplicate GST number properly rejected")
        else:
            print(f"✗ Update duplicate GST number was allowed (status: {update_result['status']})")
        
        # Test 3: Try to update company2 to have company1's registration number
        update_data = {"registration_number": company1_data["registration_number"]}
        update_result = await self.update_company(company2_id, update_data)
        if update_result["status"] == 409:
            update_tests_passed += 1
            print("✓ Update duplicate registration number properly rejected")
        else:
            print(f"✗ Update duplicate registration number was allowed (status: {update_result['status']})")
        
        return update_tests_passed, 3
    
    def print_final_summary(self, core_results, stress_results, update_results):
        """Print comprehensive test summary"""
        print("\n" + "="*80)
        print("COMPREHENSIVE DUPLICATE PREVENTION TEST SUMMARY")
        print("="*80)
        
        core_passed, core_total = core_results
        stress_passed, stress_total = stress_results
        update_passed, update_total = update_results
        
        total_passed = core_passed + stress_passed + update_passed
        total_tests = core_total + stress_total + update_total
        
        print(f"Core Duplicate Tests:        {core_passed:5}/{core_total:5} ({(core_passed/core_total)*100:.1f}%)")
        print(f"Stress Test (10K variations): {stress_passed:5}/{stress_total:5} ({(stress_passed/stress_total)*100:.1f}%)")
        print(f"Update Duplicate Tests:      {update_passed:5}/{update_total:5} ({(update_passed/update_total)*100:.1f}%)")
        print("-" * 80)
        print(f"TOTAL:                       {total_passed:5}/{total_tests:5} ({(total_passed/total_tests)*100:.1f}%)")
        
        if total_passed == total_tests:
            print("\n🎉 ALL TESTS PASSED! Duplicate prevention is 100% reliable!")
            return True
        else:
            print(f"\n❌ {total_tests - total_passed} tests failed. Duplicate prevention needs attention.")
            return False


async def main():
    """Main test runner"""
    print("Company Duplicate Prevention Comprehensive Test Suite")
    print("Testing with 10,000+ variations to ensure 100% reliability")
    print("="*80)
    
    start_time = time.time()
    
    try:
        async with CompanyDuplicateStressTester() as tester:
            # Run core duplicate tests
            core_results = await tester.run_core_duplicate_tests()
            
            # Run update duplicate tests
            update_results = await tester.run_update_duplicate_tests()
            
            # Run stress test with 10,000 variations
            stress_results = await tester.run_stress_test_10000()
            
            # Print final summary
            all_passed = tester.print_final_summary(core_results, stress_results, update_results)
            
            # Cleanup
            await tester.cleanup_test_companies()
            
            end_time = time.time()
            duration = end_time - start_time
            print(f"\nTest duration: {duration:.2f} seconds")
            print(f"Created and cleaned up: {len(tester.created_companies)} companies")
            
            # Exit with appropriate code
            if all_passed:
                print("\n🎉 SUCCESS: All duplicate prevention tests passed!")
                sys.exit(0)
            else:
                print("\n❌ FAILURE: Some duplicate prevention tests failed!")
                sys.exit(1)
                
    except Exception as e:
        print(f"\n💥 Test suite failed with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())