#!/usr/bin/env python3
"""
Comprehensive System-Wide Test for All Endpoints
Tests every API endpoint to ensure full functionality
"""
import asyncio
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import httpx
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import os

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "AdminSecure@Password123!")

# Test results tracking
results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "errors": []
}


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


async def print_test(endpoint: str, method: str, status: bool, message: str = ""):
    """Print test result with colors"""
    results["total"] += 1
    if status:
        results["passed"] += 1
        print(f"{Colors.GREEN}✓{Colors.ENDC} {method} {endpoint} - {message}")
    else:
        results["failed"] += 1
        results["errors"].append(f"{method} {endpoint}: {message}")
        print(f"{Colors.RED}✗{Colors.ENDC} {method} {endpoint} - {message}")


async def get_auth_headers(client: httpx.AsyncClient) -> Dict[str, str]:
    """Get authentication headers"""
    response = await client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    else:
        raise Exception(f"Authentication failed: {response.text}")


async def test_auth_endpoints(client: httpx.AsyncClient):
    """Test authentication endpoints"""
    print(f"\n{Colors.BOLD}Testing Authentication Endpoints{Colors.ENDC}")
    
    # Test login
    response = await client.post(
        "/api/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    await print_test("/api/auth/login", "POST", response.status_code == 200, 
                    f"Status: {response.status_code}")
    
    if response.status_code == 200:
        tokens = response.json()
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]
        
        # Test token refresh
        response = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        await print_test("/api/auth/refresh", "POST", response.status_code == 200,
                        f"Status: {response.status_code}")
        
        # Test me endpoint
        headers = {"Authorization": f"Bearer {access_token}"}
        response = await client.get("/api/auth/me", headers=headers)
        await print_test("/api/auth/me", "GET", response.status_code == 200,
                        f"Status: {response.status_code}")


async def test_crud_endpoints(client: httpx.AsyncClient, headers: Dict[str, str], 
                            endpoint_base: str, name: str, sample_data: dict):
    """Generic CRUD endpoint tester"""
    print(f"\n{Colors.BOLD}Testing {name} Endpoints{Colors.ENDC}")
    
    # Test list
    response = await client.get(f"{endpoint_base}", headers=headers)
    await print_test(f"{endpoint_base}", "GET", response.status_code == 200,
                    f"List - Status: {response.status_code}")
    
    # Test create
    response = await client.post(f"{endpoint_base}", headers=headers, json=sample_data)
    await print_test(f"{endpoint_base}", "POST", response.status_code in [200, 201],
                    f"Create - Status: {response.status_code}")
    
    if response.status_code in [200, 201]:
        created_item = response.json()
        item_id = created_item.get("id")
        
        if item_id:
            # Test get by id
            response = await client.get(f"{endpoint_base}/{item_id}", headers=headers)
            await print_test(f"{endpoint_base}/{item_id}", "GET", response.status_code == 200,
                            f"Get by ID - Status: {response.status_code}")
            
            # Test update
            update_data = sample_data.copy()
            if "name" in update_data:
                update_data["name"] = f"Updated {update_data['name']}"
            response = await client.put(f"{endpoint_base}/{item_id}", headers=headers, json=update_data)
            await print_test(f"{endpoint_base}/{item_id}", "PUT", response.status_code == 200,
                            f"Update - Status: {response.status_code}")
            
            # Test delete
            response = await client.delete(f"{endpoint_base}/{item_id}", headers=headers)
            await print_test(f"{endpoint_base}/{item_id}", "DELETE", response.status_code in [200, 204],
                            f"Delete - Status: {response.status_code}")


async def test_master_data_endpoints(client: httpx.AsyncClient, headers: Dict[str, str]):
    """Test all master data endpoints"""
    
    # Test Brands
    await test_crud_endpoints(
        client, headers, "/api/master-data/brands/", "Brands",
        {"name": "Test Brand", "description": "Test Description"}
    )
    
    # Test Categories
    await test_crud_endpoints(
        client, headers, "/api/master-data/categories/", "Categories",
        {"name": "Test Category", "description": "Test Description", "parent_id": None}
    )
    
    # Test Units
    await test_crud_endpoints(
        client, headers, "/api/master-data/units/", "Units",
        {"name": "Test Unit", "abbreviation": "TU"}
    )
    
    # Test Locations
    await test_crud_endpoints(
        client, headers, "/api/master-data/locations/", "Locations",
        {"name": "Test Location", "type": "WAREHOUSE", "address": "123 Test St"}
    )
    
    # Test Items (need category and brand first)
    # Create category for item
    cat_response = await client.post(
        "/api/master-data/categories", headers=headers,
        json={"name": "Item Test Category", "description": "For testing items"}
    )
    category_id = cat_response.json().get("id") if cat_response.status_code in [200, 201] else None
    
    # Create brand for item
    brand_response = await client.post(
        "/api/master-data/brands", headers=headers,
        json={"name": "Item Test Brand", "description": "For testing items"}
    )
    brand_id = brand_response.json().get("id") if brand_response.status_code in [200, 201] else None
    
    # Create unit for item
    unit_response = await client.post(
        "/api/master-data/units", headers=headers,
        json={"name": "Piece", "abbreviation": "PC"}
    )
    unit_id = unit_response.json().get("id") if unit_response.status_code in [200, 201] else None
    
    if category_id and brand_id and unit_id:
        await test_crud_endpoints(
            client, headers, "/api/master-data/items", "Items",
            {
                "item_name": "Test Item",
                "category_id": category_id,
                "brand_id": brand_id,
                "unit_of_measure_id": unit_id,
                "purchase_price": 100.00,
                "rental_price": 10.00,
                "is_active": True
            }
        )


async def test_customer_endpoints(client: httpx.AsyncClient, headers: Dict[str, str]):
    """Test customer endpoints"""
    await test_crud_endpoints(
        client, headers, "/api/customers/", "Customers",
        {
            "name": "Test Customer",
            "email": "test@customer.com",
            "phone": "1234567890",
            "address": "123 Customer St",
            "city": "Test City",
            "state": "TS",
            "zip_code": "12345",
            "customer_type": "INDIVIDUAL"
        }
    )


async def test_supplier_endpoints(client: httpx.AsyncClient, headers: Dict[str, str]):
    """Test supplier endpoints"""
    await test_crud_endpoints(
        client, headers, "/api/suppliers/", "Suppliers",
        {
            "name": "Test Supplier",
            "contact_person": "John Doe",
            "email": "test@supplier.com",
            "phone": "0987654321",
            "address": "456 Supplier Ave",
            "city": "Supply City",
            "state": "SC",
            "zip_code": "54321"
        }
    )


async def test_inventory_endpoints(client: httpx.AsyncClient, headers: Dict[str, str]):
    """Test inventory endpoints"""
    print(f"\n{Colors.BOLD}Testing Inventory Endpoints{Colors.ENDC}")
    
    # Get inventory summary
    response = await client.get("/api/inventory", headers=headers)
    await print_test("/api/inventory", "GET", response.status_code == 200,
                    f"Inventory list - Status: {response.status_code}")
    
    # Get low stock items
    response = await client.get("/api/inventory/low-stock", headers=headers)
    await print_test("/api/inventory/low-stock", "GET", response.status_code == 200,
                    f"Low stock items - Status: {response.status_code}")
    
    # Get inventory by location
    response = await client.get("/api/inventory/by-location", headers=headers)
    await print_test("/api/inventory/by-location", "GET", response.status_code == 200,
                    f"Inventory by location - Status: {response.status_code}")


async def test_transaction_endpoints(client: httpx.AsyncClient, headers: Dict[str, str]):
    """Test transaction endpoints"""
    print(f"\n{Colors.BOLD}Testing Transaction Endpoints{Colors.ENDC}")
    
    # First create necessary data
    # Create supplier
    supplier_response = await client.post(
        "/api/suppliers", headers=headers,
        json={
            "name": "Transaction Test Supplier",
            "contact_person": "Test Person",
            "email": "trans@supplier.com",
            "phone": "1111111111"
        }
    )
    supplier_id = supplier_response.json().get("id") if supplier_response.status_code in [200, 201] else None
    
    # Create location
    location_response = await client.post(
        "/api/master-data/locations", headers=headers,
        json={"name": "Transaction Test Location", "type": "WAREHOUSE"}
    )
    location_id = location_response.json().get("id") if location_response.status_code in [200, 201] else None
    
    # Create item
    item_response = await client.get("/api/master-data/items", headers=headers)
    items = item_response.json().get("items", [])
    item_id = items[0]["id"] if items else None
    
    if supplier_id and location_id and item_id:
        # Test purchase transaction
        purchase_data = {
            "supplier_id": supplier_id,
            "location_id": location_id,
            "transaction_date": datetime.now().isoformat(),
            "items": [
                {
                    "item_id": item_id,
                    "quantity": 10,
                    "unit_price": 50.00,
                    "total_price": 500.00
                }
            ],
            "notes": "Test purchase"
        }
        
        response = await client.post("/api/transactions/purchases", headers=headers, json=purchase_data)
        await print_test("/api/transactions/purchases", "POST", response.status_code in [200, 201],
                        f"Create purchase - Status: {response.status_code}")
        
        # Get purchase transactions
        response = await client.get("/api/transactions/purchases", headers=headers)
        await print_test("/api/transactions/purchases", "GET", response.status_code == 200,
                        f"List purchases - Status: {response.status_code}")


async def test_rental_endpoints(client: httpx.AsyncClient, headers: Dict[str, str]):
    """Test rental endpoints"""
    print(f"\n{Colors.BOLD}Testing Rental Endpoints{Colors.ENDC}")
    
    # Create customer for rental
    customer_response = await client.post(
        "/api/customers", headers=headers,
        json={
            "name": "Rental Test Customer",
            "email": "rental@customer.com",
            "phone": "2222222222",
            "customer_type": "INDIVIDUAL"
        }
    )
    customer_id = customer_response.json().get("id") if customer_response.status_code in [200, 201] else None
    
    # Get available items
    response = await client.get("/api/rentals/available-items/", headers=headers)
    await print_test("/api/rentals/available-items/", "GET", response.status_code == 200,
                    f"Available items - Status: {response.status_code}")
    
    # Get active rentals
    response = await client.get("/api/rentals/active/", headers=headers)
    await print_test("/api/rentals/active/", "GET", response.status_code == 200,
                    f"Active rentals - Status: {response.status_code}")
    
    # Get overdue rentals
    response = await client.get("/api/rentals/overdue/", headers=headers)
    await print_test("/api/rentals/overdue/", "GET", response.status_code == 200,
                    f"Overdue rentals - Status: {response.status_code}")


async def test_analytics_endpoints(client: httpx.AsyncClient, headers: Dict[str, str]):
    """Test analytics endpoints"""
    print(f"\n{Colors.BOLD}Testing Analytics Endpoints{Colors.ENDC}")
    
    # Dashboard summary
    response = await client.get("/api/analytics/dashboard/summary/", headers=headers)
    await print_test("/api/analytics/dashboard/summary/", "GET", response.status_code == 200,
                    f"Dashboard summary - Status: {response.status_code}")
    
    # Revenue analytics
    response = await client.get("/api/analytics/revenue/", headers=headers)
    await print_test("/api/analytics/revenue/", "GET", response.status_code == 200,
                    f"Revenue analytics - Status: {response.status_code}")
    
    # Inventory analytics
    response = await client.get("/api/analytics/inventory/", headers=headers)
    await print_test("/api/analytics/inventory/", "GET", response.status_code == 200,
                    f"Inventory analytics - Status: {response.status_code}")


async def test_system_endpoints(client: httpx.AsyncClient, headers: Dict[str, str]):
    """Test system endpoints"""
    print(f"\n{Colors.BOLD}Testing System Endpoints{Colors.ENDC}")
    
    # Health check
    response = await client.get("/api/health")
    await print_test("/api/health", "GET", response.status_code == 200,
                    f"Health check - Status: {response.status_code}")
    
    # System info
    response = await client.get("/api/system/info", headers=headers)
    await print_test("/api/system/info", "GET", response.status_code == 200,
                    f"System info - Status: {response.status_code}")
    
    # Timezone endpoints
    response = await client.get("/api/timezones/", headers=headers)
    await print_test("/api/timezones/", "GET", response.status_code == 200,
                    f"List timezones - Status: {response.status_code}")
    
    # Company settings
    response = await client.get("/api/company/", headers=headers)
    await print_test("/api/company/", "GET", response.status_code == 200,
                    f"Company settings - Status: {response.status_code}")


async def test_user_management_endpoints(client: httpx.AsyncClient, headers: Dict[str, str]):
    """Test user management endpoints"""
    print(f"\n{Colors.BOLD}Testing User Management Endpoints{Colors.ENDC}")
    
    # List users
    response = await client.get("/api/users/", headers=headers)
    await print_test("/api/users/", "GET", response.status_code == 200,
                    f"List users - Status: {response.status_code}")
    
    # Create user
    user_data = {
        "username": "testuser",
        "email": "testuser@test.com",
        "full_name": "Test User",
        "password": "TestPassword123!",
        "is_active": True,
        "is_superuser": False
    }
    response = await client.post("/api/users/", headers=headers, json=user_data)
    await print_test("/api/users/", "POST", response.status_code in [200, 201],
                    f"Create user - Status: {response.status_code}")
    
    if response.status_code in [200, 201]:
        user_id = response.json().get("id")
        if user_id:
            # Get user by id
            response = await client.get(f"/api/users/{user_id}", headers=headers)
            await print_test(f"/api/users/{user_id}", "GET", response.status_code == 200,
                            f"Get user - Status: {response.status_code}")
            
            # Delete user
            response = await client.delete(f"/api/users/{user_id}", headers=headers)
            await print_test(f"/api/users/{user_id}", "DELETE", response.status_code in [200, 204],
                            f"Delete user - Status: {response.status_code}")


async def main():
    """Run all endpoint tests"""
    print(f"{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
    print(f"{Colors.BOLD}System-Wide Endpoint Testing{Colors.ENDC}")
    print(f"{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
    print(f"Testing against: {BASE_URL}")
    print(f"Admin user: {ADMIN_USERNAME}")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        try:
            # Test health first
            response = await client.get("/api/health")
            if response.status_code != 200:
                print(f"{Colors.RED}Server is not responding at {BASE_URL}/api/health{Colors.ENDC}")
                print("Please ensure the backend is running.")
                return
            
            # Get auth headers
            print(f"\n{Colors.YELLOW}Authenticating...{Colors.ENDC}")
            headers = await get_auth_headers(client)
            print(f"{Colors.GREEN}✓ Authentication successful{Colors.ENDC}")
            
            # Run all tests
            await test_auth_endpoints(client)
            await test_system_endpoints(client, headers)
            await test_user_management_endpoints(client, headers)
            await test_master_data_endpoints(client, headers)
            await test_customer_endpoints(client, headers)
            await test_supplier_endpoints(client, headers)
            await test_inventory_endpoints(client, headers)
            await test_transaction_endpoints(client, headers)
            await test_rental_endpoints(client, headers)
            await test_analytics_endpoints(client, headers)
            
        except Exception as e:
            print(f"{Colors.RED}Error during testing: {str(e)}{Colors.ENDC}")
            results["errors"].append(f"Fatal error: {str(e)}")
    
    # Print summary
    print(f"\n{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
    print(f"{Colors.BOLD}Test Summary{Colors.ENDC}")
    print(f"{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
    print(f"Total tests: {results['total']}")
    print(f"{Colors.GREEN}Passed: {results['passed']}{Colors.ENDC}")
    print(f"{Colors.RED}Failed: {results['failed']}{Colors.ENDC}")
    
    if results["errors"]:
        print(f"\n{Colors.RED}Errors:{Colors.ENDC}")
        for error in results["errors"]:
            print(f"  - {error}")
    
    success_rate = (results['passed'] / results['total'] * 100) if results['total'] > 0 else 0
    print(f"\n{Colors.BOLD}Success Rate: {success_rate:.1f}%{Colors.ENDC}")
    
    if success_rate == 100:
        print(f"{Colors.GREEN}✅ All endpoints are working correctly!{Colors.ENDC}")
    elif success_rate >= 90:
        print(f"{Colors.YELLOW}⚠️  Most endpoints are working, but some issues found.{Colors.ENDC}")
    else:
        print(f"{Colors.RED}❌ Significant issues found. Please check the errors above.{Colors.ENDC}")


if __name__ == "__main__":
    asyncio.run(main())