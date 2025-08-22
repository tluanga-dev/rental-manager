#!/usr/bin/env python3
"""
Comprehensive Supplier API Test Suite
====================================

This script tests all supplier management endpoints with comprehensive coverage:
- CRUD operations (Create, Read, Update, Delete)
- Search functionality
- Status management
- Statistics and analytics
- Authentication and authorization
- Data validation
- Business logic validation

Usage:
    python test_supplier_api.py

Expected: All 15 tests should pass for a fully functional supplier management system.
"""

import requests
import time
import json
from typing import Dict, Any, Optional
from decimal import Decimal

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"

class SupplierAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = {"Content-Type": "application/json"}
        self.auth_token = None
        self.test_supplier_id = None
        self.test_supplier_code = None
        
    def authenticate(self) -> bool:
        """Authenticate and get access token."""
        print("🔐 Authenticating admin user...")
        auth_data = {
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/auth/login",
                data=auth_data,  # Form data for OAuth2
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code == 200:
                token_data = response.json()
                self.auth_token = token_data["access_token"]
                self.headers["Authorization"] = f"Bearer {self.auth_token}"
                print("✅ Authentication successful")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Authentication error: {e}")
            return False
    
    def test_create_supplier(self) -> bool:
        """Test creating a new supplier."""
        print("\n📝 Testing supplier creation...")
        
        timestamp = int(time.time())
        supplier_data = {
            "supplier_code": f"SUPP_TEST_{timestamp}",
            "company_name": f"Test Supplier Company {timestamp}",
            "supplier_type": "MANUFACTURER",
            "contact_person": "John Smith",
            "email": f"supplier{timestamp}@testcompany.com",
            "phone": "+1-555-0123",
            "mobile": "+1-555-0124",
            "address_line1": "123 Business Ave",
            "address_line2": "Suite 456",
            "city": "New York",
            "state": "NY",
            "postal_code": "10001",
            "country": "USA",
            "tax_id": f"TAX{timestamp}",
            "payment_terms": "NET30",
            "credit_limit": "50000.00",
            "supplier_tier": "STANDARD",
            "status": "ACTIVE",
            "notes": "Test supplier for API validation",
            "website": "https://testcompany.com",
            "account_manager": "Jane Doe",
            "preferred_payment_method": "Bank Transfer"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/suppliers/",
                json=supplier_data,
                headers=self.headers
            )
            
            if response.status_code == 201:
                supplier = response.json()
                self.test_supplier_id = supplier["id"]
                self.test_supplier_code = supplier["supplier_code"]
                print(f"✅ Supplier created successfully: {supplier['company_name']} ({supplier['supplier_code']})")
                
                # Validate response structure
                required_fields = ["id", "supplier_code", "company_name", "supplier_type", "status"]
                for field in required_fields:
                    if field not in supplier:
                        print(f"❌ Missing required field in response: {field}")
                        return False
                
                # Validate data integrity
                if supplier["supplier_code"] != supplier_data["supplier_code"]:
                    print(f"❌ Supplier code mismatch: expected {supplier_data['supplier_code']}, got {supplier['supplier_code']}")
                    return False
                    
                return True
            else:
                print(f"❌ Supplier creation failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Supplier creation error: {e}")
            return False
    
    def test_get_supplier(self) -> bool:
        """Test retrieving a supplier by ID."""
        print("\n🔍 Testing supplier retrieval by ID...")
        
        if not self.test_supplier_id:
            print("❌ No test supplier ID available")
            return False
        
        try:
            response = requests.get(
                f"{self.base_url}/suppliers/{self.test_supplier_id}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                supplier = response.json()
                print(f"✅ Supplier retrieved successfully: {supplier['company_name']}")
                
                # Validate response structure
                if supplier["id"] != self.test_supplier_id:
                    print(f"❌ Supplier ID mismatch: expected {self.test_supplier_id}, got {supplier['id']}")
                    return False
                    
                return True
            else:
                print(f"❌ Supplier retrieval failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Supplier retrieval error: {e}")
            return False
    
    def test_list_suppliers(self) -> bool:
        """Test listing suppliers with pagination."""
        print("\n📋 Testing supplier listing...")
        
        try:
            response = requests.get(
                f"{self.base_url}/suppliers/?skip=0&limit=10",
                headers=self.headers
            )
            
            if response.status_code == 200:
                suppliers = response.json()
                print(f"✅ Retrieved {len(suppliers)} suppliers")
                
                # Validate response structure
                if isinstance(suppliers, list):
                    if len(suppliers) > 0:
                        first_supplier = suppliers[0]
                        required_fields = ["id", "supplier_code", "company_name", "supplier_type"]
                        for field in required_fields:
                            if field not in first_supplier:
                                print(f"❌ Missing field in supplier list item: {field}")
                                return False
                    return True
                else:
                    print(f"❌ Expected list response, got: {type(suppliers)}")
                    return False
            else:
                print(f"❌ Supplier listing failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Supplier listing error: {e}")
            return False
    
    def test_search_suppliers(self) -> bool:
        """Test supplier search functionality."""
        print("\n🔍 Testing supplier search...")
        
        if not self.test_supplier_code:
            print("❌ No test supplier code available for search")
            return False
        
        try:
            # Search by supplier code
            search_term = self.test_supplier_code[:8]  # Partial search
            response = requests.get(
                f"{self.base_url}/suppliers/search?search_term={search_term}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                suppliers = response.json()
                print(f"✅ Search returned {len(suppliers)} suppliers for term '{search_term}'")
                
                # Validate that our test supplier is in the results
                found = any(s["supplier_code"] == self.test_supplier_code for s in suppliers)
                if found:
                    print("✅ Test supplier found in search results")
                    return True
                else:
                    print("❌ Test supplier not found in search results")
                    return False
            else:
                print(f"❌ Supplier search failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Supplier search error: {e}")
            return False
    
    def test_update_supplier(self) -> bool:
        """Test updating supplier information."""
        print("\n✏️ Testing supplier update...")
        
        if not self.test_supplier_id:
            print("❌ No test supplier ID available")
            return False
        
        update_data = {
            "company_name": "Updated Test Supplier Company",
            "contact_person": "Jane Smith",
            "notes": "Updated notes for testing"
        }
        
        try:
            response = requests.put(
                f"{self.base_url}/suppliers/{self.test_supplier_id}",
                json=update_data,
                headers=self.headers
            )
            
            if response.status_code == 200:
                supplier = response.json()
                print(f"✅ Supplier updated successfully: {supplier['company_name']}")
                
                # Validate updated fields
                if supplier["company_name"] != update_data["company_name"]:
                    print(f"❌ Company name not updated: expected {update_data['company_name']}, got {supplier['company_name']}")
                    return False
                    
                return True
            else:
                print(f"❌ Supplier update failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Supplier update error: {e}")
            return False
    
    def test_supplier_status_update(self) -> bool:
        """Test updating supplier status."""
        print("\n🔄 Testing supplier status update...")
        
        if not self.test_supplier_id:
            print("❌ No test supplier ID available")
            return False
        
        status_data = {
            "status": "SUSPENDED",
            "notes": "Temporarily suspended for testing"
        }
        
        try:
            response = requests.put(
                f"{self.base_url}/suppliers/{self.test_supplier_id}/status",
                json=status_data,
                headers=self.headers
            )
            
            if response.status_code == 200:
                supplier = response.json()
                print(f"✅ Supplier status updated to: {supplier['status']}")
                
                # Validate status change
                if supplier["status"] != status_data["status"]:
                    print(f"❌ Status not updated: expected {status_data['status']}, got {supplier['status']}")
                    return False
                    
                return True
            else:
                print(f"❌ Supplier status update failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Supplier status update error: {e}")
            return False
    
    def test_supplier_statistics(self) -> bool:
        """Test supplier statistics endpoint."""
        print("\n📊 Testing supplier statistics...")
        
        try:
            response = requests.get(
                f"{self.base_url}/suppliers/statistics",
                headers=self.headers
            )
            
            if response.status_code == 200:
                stats = response.json()
                print("✅ Supplier statistics retrieved successfully")
                
                # Validate statistics structure
                required_stats = ["total_suppliers", "active_suppliers", "inactive_suppliers"]
                for stat in required_stats:
                    if stat not in stats:
                        print(f"❌ Missing statistic: {stat}")
                        return False
                
                print(f"   📈 Total suppliers: {stats.get('total_suppliers', 0)}")
                print(f"   📈 Active suppliers: {stats.get('active_suppliers', 0)}")
                print(f"   📈 Inactive suppliers: {stats.get('inactive_suppliers', 0)}")
                
                return True
            else:
                print(f"❌ Supplier statistics failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Supplier statistics error: {e}")
            return False
    
    def test_supplier_filtering(self) -> bool:
        """Test supplier filtering by type and status."""
        print("\n🔽 Testing supplier filtering...")
        
        try:
            # Test filtering by supplier type
            response = requests.get(
                f"{self.base_url}/suppliers/?supplier_type=MANUFACTURER",
                headers=self.headers
            )
            
            if response.status_code == 200:
                suppliers = response.json()
                print(f"✅ Filtering by type returned {len(suppliers)} suppliers")
                
                # Validate that all returned suppliers are manufacturers
                if suppliers:
                    for supplier in suppliers:
                        if supplier["supplier_type"] != "MANUFACTURER":
                            print(f"❌ Found non-manufacturer in filtered results: {supplier['supplier_type']}")
                            return False
                
                return True
            else:
                print(f"❌ Supplier filtering failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Supplier filtering error: {e}")
            return False
    
    def test_duplicate_supplier_code(self) -> bool:
        """Test validation for duplicate supplier codes."""
        print("\n🚫 Testing duplicate supplier code validation...")
        
        if not self.test_supplier_code:
            print("❌ No test supplier code available")
            return False
        
        duplicate_data = {
            "supplier_code": self.test_supplier_code,  # Use existing code
            "company_name": "Duplicate Supplier Company",
            "supplier_type": "DISTRIBUTOR",
            "email": "duplicate@testcompany.com"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/suppliers/",
                json=duplicate_data,
                headers=self.headers
            )
            
            if response.status_code == 409:  # Conflict expected
                print("✅ Duplicate supplier code properly rejected")
                return True
            else:
                print(f"❌ Expected 409 Conflict, got {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Duplicate validation test error: {e}")
            return False
    
    def test_invalid_supplier_data(self) -> bool:
        """Test validation for invalid supplier data."""
        print("\n❌ Testing invalid supplier data validation...")
        
        invalid_data = {
            "supplier_code": "",  # Empty code
            "company_name": "",   # Empty name
            "supplier_type": "INVALID_TYPE",  # Invalid type
            "email": "invalid-email"  # Invalid email
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/suppliers/",
                json=invalid_data,
                headers=self.headers
            )
            
            if response.status_code == 422:  # Validation error expected
                print("✅ Invalid supplier data properly rejected")
                return True
            else:
                print(f"❌ Expected 422 Validation Error, got {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Invalid data validation test error: {e}")
            return False
    
    def test_unauthorized_access(self) -> bool:
        """Test unauthorized access protection."""
        print("\n🔒 Testing unauthorized access protection...")
        
        # Remove authorization header
        headers_no_auth = {"Content-Type": "application/json"}
        
        try:
            response = requests.get(
                f"{self.base_url}/suppliers/",
                headers=headers_no_auth
            )
            
            if response.status_code in [401, 403]:  # Unauthorized or Forbidden expected
                print("✅ Unauthorized access properly blocked")
                return True
            else:
                print(f"❌ Expected 401/403 Unauthorized, got {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Unauthorized access test error: {e}")
            return False
    
    def test_nonexistent_supplier(self) -> bool:
        """Test handling of nonexistent supplier requests."""
        print("\n🚫 Testing nonexistent supplier handling...")
        
        fake_id = "00000000-0000-0000-0000-000000000000"
        
        try:
            response = requests.get(
                f"{self.base_url}/suppliers/{fake_id}",
                headers=self.headers
            )
            
            if response.status_code == 404:  # Not found expected
                print("✅ Nonexistent supplier properly handled")
                return True
            else:
                print(f"❌ Expected 404 Not Found, got {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Nonexistent supplier test error: {e}")
            return False
    
    def test_delete_supplier(self) -> bool:
        """Test deleting a supplier (should be last test)."""
        print("\n🗑️ Testing supplier deletion...")
        
        if not self.test_supplier_id:
            print("❌ No test supplier ID available")
            return False
        
        try:
            response = requests.delete(
                f"{self.base_url}/suppliers/{self.test_supplier_id}",
                headers=self.headers
            )
            
            if response.status_code == 204:  # No content expected
                print("✅ Supplier deleted successfully")
                
                # Verify deletion by trying to retrieve
                verify_response = requests.get(
                    f"{self.base_url}/suppliers/{self.test_supplier_id}",
                    headers=self.headers
                )
                
                if verify_response.status_code == 404:
                    print("✅ Supplier deletion verified (hard delete)")
                    return True
                elif verify_response.status_code == 200:
                    # Check if soft deleted (is_active = false)
                    supplier_data = verify_response.json()
                    if not supplier_data.get("is_active", True):
                        print("✅ Supplier deletion verified (soft delete)")
                        return True
                    else:
                        print(f"❌ Supplier still active after deletion")
                        return False
                else:
                    print(f"❌ Unexpected response after deletion: {verify_response.status_code}")
                    return False
            else:
                print(f"❌ Supplier deletion failed: {response.status_code} - {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Supplier deletion error: {e}")
            return False
    
    def run_all_tests(self) -> None:
        """Run all supplier API tests."""
        print("🚀 Starting Comprehensive Supplier API Test Suite")
        print("=" * 60)
        
        # Authentication is required for all tests
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return
        
        # Define test methods and their descriptions
        tests = [
            (self.test_create_supplier, "Create Supplier"),
            (self.test_get_supplier, "Get Supplier by ID"),
            (self.test_list_suppliers, "List Suppliers"),
            (self.test_search_suppliers, "Search Suppliers"),
            (self.test_update_supplier, "Update Supplier"),
            (self.test_supplier_status_update, "Update Supplier Status"),
            (self.test_supplier_statistics, "Get Supplier Statistics"),
            (self.test_supplier_filtering, "Filter Suppliers"),
            (self.test_duplicate_supplier_code, "Duplicate Code Validation"),
            (self.test_invalid_supplier_data, "Invalid Data Validation"),
            (self.test_unauthorized_access, "Unauthorized Access Protection"),
            (self.test_nonexistent_supplier, "Nonexistent Supplier Handling"),
            (self.test_delete_supplier, "Delete Supplier"),  # Must be last
        ]
        
        # Run tests and track results
        passed = 0
        failed = 0
        
        for test_func, test_name in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ Test '{test_name}' crashed: {e}")
                failed += 1
        
        # Print final results
        print("\n" + "=" * 60)
        print("📊 SUPPLIER API TEST RESULTS")
        print("=" * 60)
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed == 0:
            print("\n🎉 ALL TESTS PASSED! Supplier management system is fully functional.")
        else:
            print(f"\n⚠️  {failed} test(s) failed. Please review the output above for details.")
        
        print("\n📋 Test Coverage Summary:")
        print("   ✅ CRUD Operations (Create, Read, Update, Delete)")
        print("   ✅ Search and Filtering")
        print("   ✅ Status Management")
        print("   ✅ Statistics and Analytics")
        print("   ✅ Data Validation")
        print("   ✅ Authentication and Authorization")
        print("   ✅ Error Handling")


def main():
    """Main function to run the test suite."""
    tester = SupplierAPITester()
    tester.run_all_tests()


if __name__ == "__main__":
    main()