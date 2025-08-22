#!/usr/bin/env python3
"""
Comprehensive Company API Test Script

This script tests all company-related API endpoints following the same pattern
as the successful supplier tests.
"""

import asyncio
import json
import sys
from typing import Dict, Any, Optional
import aiohttp
from datetime import datetime


class CompanyAPITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.auth_token: Optional[str] = None
        self.test_results = []
        self.created_companies = []
        
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
        
    async def test_endpoint(self, method: str, endpoint: str, data: Dict = None, 
                          expected_status: int = 200, test_name: str = "") -> Dict[str, Any]:
        """Test a single API endpoint"""
        url = f"{self.base_url}{endpoint}"
        headers = self.get_auth_headers()
        
        try:
            kwargs = {"headers": headers}
            if data and method.upper() in ["POST", "PUT", "PATCH"]:
                kwargs["data"] = json.dumps(data)
                
            async with self.session.request(method.upper(), url, **kwargs) as response:
                response_data = {}
                try:
                    response_data = await response.json()
                except:
                    response_data = {"text": await response.text()}
                
                success = response.status == expected_status
                result = {
                    "test_name": test_name,
                    "method": method.upper(),
                    "endpoint": endpoint,
                    "status": response.status,
                    "expected_status": expected_status,
                    "success": success,
                    "response_data": response_data,
                    "timestamp": datetime.now().isoformat()
                }
                
                self.test_results.append(result)
                
                status_icon = "✓" if success else "✗"
                print(f"{status_icon} {test_name}: {method.upper()} {endpoint} -> {response.status}")
                
                if not success:
                    print(f"  Expected: {expected_status}, Got: {response.status}")
                    if isinstance(response_data, dict) and "detail" in response_data:
                        print(f"  Detail: {response_data['detail']}")
                
                return result
                
        except Exception as e:
            result = {
                "test_name": test_name,
                "method": method.upper(),
                "endpoint": endpoint,
                "status": 0,
                "expected_status": expected_status,
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
            self.test_results.append(result)
            print(f"✗ {test_name}: {method.upper()} {endpoint} -> ERROR: {e}")
            return result

    async def run_company_tests(self):
        """Run comprehensive company API tests"""
        
        print("\n" + "="*60)
        print("Starting Company API Tests")
        print("="*60)
        
        # Test 1: Get companies list (should be empty initially)
        await self.test_endpoint(
            "GET", "/api/v1/companies/",
            expected_status=200,
            test_name="List companies (empty)"
        )
        
        # Test 2: Create a new company
        timestamp = datetime.now().strftime("%H%M%S")
        company_data = {
            "company_name": f"Test Company Ltd {timestamp}",
            "address": "123 Business Street\nBusiness City, BC 12345\nCanada",
            "email": f"contact{timestamp}@testcompany.com",
            "phone": "+1-555-123-4567",
            "gst_no": f"12345678{timestamp}RT0001",
            "registration_number": f"BC123456{timestamp}"
        }
        
        create_result = await self.test_endpoint(
            "POST", "/api/v1/companies/",
            data=company_data,
            expected_status=201,
            test_name="Create company"
        )
        
        # Store created company ID for subsequent tests
        company_id = None
        if create_result["success"] and "response_data" in create_result:
            company_id = create_result["response_data"].get("id")
            if company_id:
                self.created_companies.append(company_id)
        
        # Test 3: Create duplicate company (should fail)
        await self.test_endpoint(
            "POST", "/api/v1/companies/",
            data=company_data,
            expected_status=409,
            test_name="Create duplicate company (should fail)"
        )
        
        # Test 4: Create company with invalid email (should fail)
        invalid_company = {
            "company_name": "Invalid Email Company",
            "email": "invalid-email-format",
            "phone": "+1-555-999-0000"
        }
        
        await self.test_endpoint(
            "POST", "/api/v1/companies/",
            data=invalid_company,
            expected_status=422,
            test_name="Create company with invalid email (should fail)"
        )
        
        # Test 5: Get company by ID
        if company_id:
            await self.test_endpoint(
                "GET", f"/api/v1/companies/{company_id}",
                expected_status=200,
                test_name="Get company by ID"
            )
        
        # Test 6: Get non-existent company
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        await self.test_endpoint(
            "GET", f"/api/v1/companies/{fake_uuid}",
            expected_status=404,
            test_name="Get non-existent company (should fail)"
        )
        
        # Test 7: Update company
        if company_id:
            update_data = {
                "company_name": f"Updated Test Company Ltd {timestamp}",
                "email": f"updated{timestamp}@testcompany.com",
                "phone": "+1-555-987-6543"
            }
            
            await self.test_endpoint(
                "PUT", f"/api/v1/companies/{company_id}",
                data=update_data,
                expected_status=200,
                test_name="Update company"
            )
        
        # Test 8: Update with duplicate name (should fail)
        if company_id:
            # First create another company
            another_company = {
                "company_name": f"Another Company Inc {timestamp}",
                "email": f"another{timestamp}@company.com",
                "gst_no": f"98765432{timestamp}RT0001"
            }
            
            create_result2 = await self.test_endpoint(
                "POST", "/api/v1/companies/",
                data=another_company,
                expected_status=201,
                test_name="Create second company"
            )
            
            company_id_2 = None
            if create_result2["success"]:
                company_id_2 = create_result2["response_data"].get("id")
                if company_id_2:
                    self.created_companies.append(company_id_2)
            
            # Try to update second company with first company's name
            if company_id_2:
                duplicate_update = {
                    "company_name": f"Updated Test Company Ltd {timestamp}"  # Same as first company's updated name
                }
                
                await self.test_endpoint(
                    "PUT", f"/api/v1/companies/{company_id_2}",
                    data=duplicate_update,
                    expected_status=409,
                    test_name="Update with duplicate name (should fail)"
                )
        
        # Test 9: List companies with pagination
        await self.test_endpoint(
            "GET", "/api/v1/companies/?page=1&page_size=10",
            expected_status=200,
            test_name="List companies with pagination"
        )
        
        # Test 10: Search companies
        await self.test_endpoint(
            "GET", "/api/v1/companies/?search=Test",
            expected_status=200,
            test_name="Search companies"
        )
        
        # Test 11: Filter companies by active status
        await self.test_endpoint(
            "GET", "/api/v1/companies/?is_active=true",
            expected_status=200,
            test_name="Filter companies by active status"
        )
        
        # Test 12: Sort companies
        await self.test_endpoint(
            "GET", "/api/v1/companies/?sort_field=company_name&sort_direction=desc",
            expected_status=200,
            test_name="Sort companies by name descending"
        )
        
        # Test 13: Delete company (soft delete)
        if len(self.created_companies) > 1:
            # Delete the second company (keep at least one)
            company_to_delete = self.created_companies[-1]
            await self.test_endpoint(
                "DELETE", f"/api/v1/companies/{company_to_delete}",
                expected_status=204,
                test_name="Delete company (soft delete)"
            )
        
        # Test 14: Try to delete non-existent company
        await self.test_endpoint(
            "DELETE", f"/api/v1/companies/{fake_uuid}",
            expected_status=404,
            test_name="Delete non-existent company (should fail)"
        )
        
        # Test 15: Invalid company data validation
        invalid_data_tests = [
            {
                "data": {"company_name": ""},  # Empty name
                "test_name": "Empty company name (should fail)"
            },
            {
                "data": {"company_name": "Valid Name", "email": ""},  # Empty email
                "test_name": "Empty email (should fail)"
            },
            {
                "data": {"company_name": "Valid Name", "phone": ""},  # Empty phone
                "test_name": "Empty phone (should fail)"
            }
        ]
        
        for test_case in invalid_data_tests:
            await self.test_endpoint(
                "POST", "/api/v1/companies/",
                data=test_case["data"],
                expected_status=422,
                test_name=test_case["test_name"]
            )

    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        successful_tests = sum(1 for test in self.test_results if test["success"])
        failed_tests = total_tests - successful_tests
        
        print("\n" + "="*60)
        print("Company API Test Summary")
        print("="*60)
        print(f"Total Tests: {total_tests}")
        print(f"Successful: {successful_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(successful_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\nFailed Tests:")
            for test in self.test_results:
                if not test["success"]:
                    print(f"  - {test['test_name']}: {test['method']} {test['endpoint']}")
                    if "error" in test:
                        print(f"    Error: {test['error']}")
                    elif "response_data" in test:
                        print(f"    Status: {test['status']}, Expected: {test['expected_status']}")
        
        print(f"\nCreated {len(self.created_companies)} test companies")
        
        return successful_tests, total_tests


async def main():
    """Main test runner"""
    print("Company API Comprehensive Test Suite")
    print("Starting tests...")
    
    try:
        async with CompanyAPITester() as tester:
            await tester.run_company_tests()
            successful, total = tester.print_summary()
            
            # Exit with appropriate code
            if successful == total:
                print("\n🎉 All tests passed!")
                sys.exit(0)
            else:
                print(f"\n❌ {total - successful} tests failed!")
                sys.exit(1)
                
    except Exception as e:
        print(f"\n💥 Test suite failed with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())