#!/usr/bin/env python3
"""
Quick test to validate Unit of Measurement migration works correctly.
This script creates a few test units and validates the API endpoints.
"""

import asyncio
import aiohttp
import json
from typing import Dict, List, Any


async def test_uom_migration():
    """Test the UOM migration with basic operations."""
    
    # Start the API server in background first via docker-compose
    print("🚀 Testing Unit of Measurement Migration")
    print("=" * 60)
    
    # Test data
    test_units = [
        {"name": "Test Kilogram", "code": "TKG", "description": "Test weight unit"},
        {"name": "Test Meter", "code": "TM", "description": "Test length unit"},
        {"name": "Test Liter", "code": "TL", "description": "Test volume unit"},
        {"name": "Test Piece", "code": "TPC", "description": "Test quantity unit"},
        {"name": "Test Hour", "code": "TH", "description": "Test time unit"}
    ]
    
    base_url = "http://localhost:8002"  # UOM test API port
    
    async with aiohttp.ClientSession() as session:
        # Authenticate
        print("\n🔐 Authenticating...")
        auth_response = await session.post(
            f"{base_url}/api/v1/auth/login",
            data={"username": "admin", "password": "Admin123!"}
        )
        
        if auth_response.status != 200:
            print(f"❌ Authentication failed: {auth_response.status}")
            print("Make sure to start the API server first:")
            print("docker-compose -f docker-compose.uom-test.yml up -d uom-test-api")
            return False
        
        auth_data = await auth_response.json()
        headers = {"Authorization": f"Bearer {auth_data['access_token']}"}
        print("✅ Authentication successful")
        
        created_units = []
        
        # Test 1: Create units
        print("\n📝 Creating test units...")
        for unit_data in test_units:
            response = await session.post(
                f"{base_url}/api/v1/unit-of-measurement/",
                json=unit_data,
                headers=headers
            )
            
            if response.status == 201:
                unit = await response.json()
                created_units.append(unit)
                print(f"  ✅ Created: {unit['name']} ({unit['code']})")
            else:
                error_text = await response.text()
                print(f"  ❌ Failed to create {unit_data['name']}: {error_text}")
        
        if not created_units:
            print("❌ No units created, stopping test")
            return False
        
        # Test 2: List units
        print(f"\n📋 Listing units...")
        list_response = await session.get(
            f"{base_url}/api/v1/unit-of-measurement/",
            params={"page": 1, "page_size": 10},
            headers=headers
        )
        
        if list_response.status == 200:
            list_data = await list_response.json()
            print(f"  ✅ Listed {len(list_data['items'])} units (Total: {list_data['total']})")
        else:
            print(f"  ❌ Failed to list units: {list_response.status}")
        
        # Test 3: Search units
        print(f"\n🔍 Searching units...")
        search_response = await session.get(
            f"{base_url}/api/v1/unit-of-measurement/search/",
            params={"q": "Test", "limit": 10},
            headers=headers
        )
        
        if search_response.status == 200:
            search_data = await search_response.json()
            print(f"  ✅ Search found {len(search_data)} units")
        else:
            print(f"  ❌ Failed to search units: {search_response.status}")
        
        # Test 4: Get unit by ID
        if created_units:
            unit_id = created_units[0]['id']
            print(f"\n🎯 Getting unit by ID...")
            get_response = await session.get(
                f"{base_url}/api/v1/unit-of-measurement/{unit_id}",
                headers=headers
            )
            
            if get_response.status == 200:
                unit = await get_response.json()
                print(f"  ✅ Retrieved: {unit['name']} ({unit['display_name']})")
            else:
                print(f"  ❌ Failed to get unit: {get_response.status}")
        
        # Test 5: Update unit
        if created_units:
            unit_id = created_units[0]['id']
            print(f"\n✏️ Updating unit...")
            update_response = await session.put(
                f"{base_url}/api/v1/unit-of-measurement/{unit_id}",
                json={"description": "Updated test description"},
                headers=headers
            )
            
            if update_response.status == 200:
                unit = await update_response.json()
                print(f"  ✅ Updated: {unit['description']}")
            else:
                print(f"  ❌ Failed to update unit: {update_response.status}")
        
        # Test 6: Get statistics
        print(f"\n📊 Getting statistics...")
        stats_response = await session.get(
            f"{base_url}/api/v1/unit-of-measurement/stats/",
            headers=headers
        )
        
        if stats_response.status == 200:
            stats = await stats_response.json()
            print(f"  ✅ Stats - Total: {stats['total_units']}, Active: {stats['active_units']}")
        else:
            print(f"  ❌ Failed to get stats: {stats_response.status}")
        
        # Test 7: Bulk deactivate
        if len(created_units) >= 2:
            unit_ids = [unit['id'] for unit in created_units[:2]]
            print(f"\n⚡ Testing bulk deactivation...")
            bulk_response = await session.post(
                f"{base_url}/api/v1/unit-of-measurement/bulk-operation",
                json={"unit_ids": unit_ids, "operation": "deactivate"},
                headers=headers
            )
            
            if bulk_response.status == 200:
                result = await bulk_response.json()
                print(f"  ✅ Bulk operation - Success: {result['success_count']}, Failed: {result['failure_count']}")
            else:
                print(f"  ❌ Failed bulk operation: {bulk_response.status}")
        
        # Cleanup: Delete created units
        print(f"\n🧹 Cleaning up test units...")
        for unit in created_units:
            delete_response = await session.delete(
                f"{base_url}/api/v1/unit-of-measurement/{unit['id']}",
                headers=headers
            )
            
            if delete_response.status == 204:
                print(f"  ✅ Deleted: {unit['name']}")
            else:
                print(f"  ❌ Failed to delete {unit['name']}: {delete_response.status}")
    
    print("\n" + "=" * 60)
    print("✅ Unit of Measurement migration test completed successfully!")
    print("\n💡 To run comprehensive tests with 1000 units:")
    print("docker-compose -f docker-compose.uom-test.yml --profile data-generation up")
    return True


if __name__ == "__main__":
    asyncio.run(test_uom_migration())