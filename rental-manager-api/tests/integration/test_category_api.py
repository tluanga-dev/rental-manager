#!/usr/bin/env python3
"""
Comprehensive Category API Test Script

This script tests all category-related API endpoints with hierarchical operations.
"""

import asyncio
import json
import sys
from typing import Dict, Any, Optional, List
import aiohttp
from datetime import datetime


class CategoryAPITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.auth_token: Optional[str] = None
        self.test_results = []
        self.created_categories = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        await self.authenticate()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cleanup_test_data()
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
                    print(await response.text())
                    return False
        except Exception as e:
            print(f"✗ Authentication error: {e}")
            return False
    
    def get_headers(self) -> Dict[str, str]:
        """Get headers with authentication"""
        return {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
    
    async def log_test_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✓" if success else "✗"
        print(f"{status} {test_name}")
        if details:
            print(f"  Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    async def test_create_root_category(self) -> Optional[str]:
        """Test creating a root category"""
        test_name = "Create Root Category"
        try:
            # Use timestamp to ensure unique name
            import time
            timestamp = int(time.time())
            category_data = {
                "name": f"Electronics_{timestamp}",
                "display_order": 1
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/categories/",
                headers=self.get_headers(),
                json=category_data
            ) as response:
                if response.status == 201:
                    result = await response.json()
                    category_id = result.get("id")
                    self.created_categories.append(category_id)
                    
                    # Verify the response structure
                    required_fields = ["id", "name", "category_code", "category_path", "category_level", "is_leaf", "is_root"]
                    missing_fields = [field for field in required_fields if field not in result]
                    
                    if missing_fields:
                        await self.log_test_result(test_name, False, f"Missing fields: {missing_fields}")
                        return None
                    
                    # Verify root category properties
                    if result["category_level"] != 1 or not result["is_root"] or not result["is_leaf"]:
                        await self.log_test_result(test_name, False, "Invalid root category properties")
                        return None
                    
                    await self.log_test_result(test_name, True, f"Created category: {result['name']} (ID: {category_id})")
                    return category_id
                else:
                    error_text = await response.text()
                    await self.log_test_result(test_name, False, f"Status: {response.status}, Error: {error_text}")
                    return None
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return None
    
    async def test_create_child_category(self, parent_id: str) -> Optional[str]:
        """Test creating a child category"""
        test_name = "Create Child Category"
        try:
            category_data = {
                "name": "Computers",
                "parent_category_id": parent_id,
                "display_order": 1
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/categories/",
                headers=self.get_headers(),
                json=category_data
            ) as response:
                if response.status == 201:
                    result = await response.json()
                    category_id = result.get("id")
                    self.created_categories.append(category_id)
                    
                    # Verify child category properties
                    if result["category_level"] != 2 or result["is_root"] or not result["is_leaf"]:
                        await self.log_test_result(test_name, False, "Invalid child category properties")
                        return None
                    
                    # Verify path contains parent path
                    if "Electronics" not in result["category_path"]:
                        await self.log_test_result(test_name, False, "Invalid category path")
                        return None
                    
                    await self.log_test_result(test_name, True, f"Created child category: {result['name']} (Level: {result['category_level']})")
                    return category_id
                else:
                    error_text = await response.text()
                    await self.log_test_result(test_name, False, f"Status: {response.status}, Error: {error_text}")
                    return None
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return None
    
    async def test_get_category(self, category_id: str):
        """Test getting a category by ID"""
        test_name = "Get Category by ID"
        try:
            async with self.session.get(
                f"{self.base_url}/api/v1/categories/{category_id}",
                headers=self.get_headers()
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    await self.log_test_result(test_name, True, f"Retrieved category: {result['name']}")
                    return result
                else:
                    await self.log_test_result(test_name, False, f"Status: {response.status}")
                    return None
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return None
    
    async def test_list_categories(self):
        """Test listing categories with pagination"""
        test_name = "List Categories"
        try:
            async with self.session.get(
                f"{self.base_url}/api/v1/categories/?page=1&page_size=10",
                headers=self.get_headers()
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    # Verify pagination structure
                    required_fields = ["items", "total", "page", "page_size", "has_next", "has_previous"]
                    missing_fields = [field for field in required_fields if field not in result]
                    
                    if missing_fields:
                        await self.log_test_result(test_name, False, f"Missing pagination fields: {missing_fields}")
                        return None
                    
                    await self.log_test_result(test_name, True, f"Retrieved {len(result['items'])} categories")
                    return result
                else:
                    await self.log_test_result(test_name, False, f"Status: {response.status}")
                    return None
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return None
    
    async def test_search_categories(self):
        """Test searching categories"""
        test_name = "Search Categories"
        try:
            async with self.session.get(
                f"{self.base_url}/api/v1/categories/search/?q=Electronics&limit=5",
                headers=self.get_headers()
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    if isinstance(result, list):
                        await self.log_test_result(test_name, True, f"Found {len(result)} categories")
                        return result
                    else:
                        await self.log_test_result(test_name, False, "Invalid response format")
                        return None
                else:
                    await self.log_test_result(test_name, False, f"Status: {response.status}")
                    return None
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return None
    
    async def test_get_category_tree(self):
        """Test getting category tree"""
        test_name = "Get Category Tree"
        try:
            async with self.session.get(
                f"{self.base_url}/api/v1/categories/tree/",
                headers=self.get_headers()
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    if isinstance(result, list):
                        await self.log_test_result(test_name, True, f"Retrieved tree with {len(result)} root nodes")
                        return result
                    else:
                        await self.log_test_result(test_name, False, "Invalid response format")
                        return None
                else:
                    await self.log_test_result(test_name, False, f"Status: {response.status}")
                    return None
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return None
    
    async def test_update_category(self, category_id: str):
        """Test updating a category"""
        test_name = "Update Category"
        try:
            update_data = {
                "name": "Electronics & Technology",
                "display_order": 5
            }
            
            async with self.session.put(
                f"{self.base_url}/api/v1/categories/{category_id}",
                headers=self.get_headers(),
                json=update_data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    if result["name"] == update_data["name"] and result["display_order"] == update_data["display_order"]:
                        await self.log_test_result(test_name, True, f"Updated category: {result['name']}")
                        return result
                    else:
                        await self.log_test_result(test_name, False, "Update values not reflected")
                        return None
                else:
                    error_text = await response.text()
                    await self.log_test_result(test_name, False, f"Status: {response.status}, Error: {error_text}")
                    return None
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return None
    
    async def test_move_category(self, category_id: str, new_parent_id: Optional[str] = None):
        """Test moving a category"""
        test_name = "Move Category"
        try:
            move_data = {
                "new_parent_id": new_parent_id,
                "new_display_order": 1
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/categories/{category_id}/move",
                headers=self.get_headers(),
                json=move_data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    await self.log_test_result(test_name, True, f"Moved category to new parent")
                    return result
                else:
                    error_text = await response.text()
                    await self.log_test_result(test_name, False, f"Status: {response.status}, Error: {error_text}")
                    return None
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return None
    
    async def test_get_parent_categories(self):
        """Test getting parent categories"""
        test_name = "Get Parent Categories"
        try:
            async with self.session.get(
                f"{self.base_url}/api/v1/categories/parents/",
                headers=self.get_headers()
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    if isinstance(result, list):
                        await self.log_test_result(test_name, True, f"Retrieved {len(result)} parent categories")
                        return result
                    else:
                        await self.log_test_result(test_name, False, "Invalid response format")
                        return None
                else:
                    await self.log_test_result(test_name, False, f"Status: {response.status}")
                    return None
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return None
    
    async def test_duplicate_prevention(self):
        """Test duplicate category name prevention"""
        test_name = "Duplicate Prevention"
        try:
            category_data = {
                "name": "Electronics & Technology",  # Should already exist
                "display_order": 1
            }
            
            async with self.session.post(
                f"{self.base_url}/api/v1/categories/",
                headers=self.get_headers(),
                json=category_data
            ) as response:
                if response.status == 409:  # Conflict expected
                    await self.log_test_result(test_name, True, "Correctly prevented duplicate category creation")
                    return True
                else:
                    await self.log_test_result(test_name, False, f"Expected 409 Conflict, got {response.status}")
                    return False
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return False
    
    async def test_delete_category(self, category_id: str):
        """Test deleting a category"""
        test_name = "Delete Category"
        try:
            async with self.session.delete(
                f"{self.base_url}/api/v1/categories/{category_id}",
                headers=self.get_headers()
            ) as response:
                if response.status == 204:
                    await self.log_test_result(test_name, True, f"Successfully deleted category")
                    return True
                else:
                    error_text = await response.text()
                    await self.log_test_result(test_name, False, f"Status: {response.status}, Error: {error_text}")
                    return False
        except Exception as e:
            await self.log_test_result(test_name, False, f"Exception: {e}")
            return False
    
    async def cleanup_test_data(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete categories in reverse order (children first)
        for category_id in reversed(self.created_categories):
            try:
                async with self.session.delete(
                    f"{self.base_url}/api/v1/categories/{category_id}",
                    headers=self.get_headers()
                ) as response:
                    if response.status == 204:
                        print(f"✓ Deleted category {category_id}")
                    else:
                        print(f"✗ Failed to delete category {category_id}: {response.status}")
            except Exception as e:
                print(f"✗ Error deleting category {category_id}: {e}")
    
    async def run_all_tests(self):
        """Run all category tests"""
        print("🏁 Starting Category API Tests...\n")
        
        # Test 1: Create root category
        root_category_id = await self.test_create_root_category()
        if not root_category_id:
            print("❌ Root category creation failed - stopping tests")
            return
        
        # Test 2: Create child category
        child_category_id = await self.test_create_child_category(root_category_id)
        
        # Test 3: Get category
        await self.test_get_category(root_category_id)
        
        # Test 4: List categories
        await self.test_list_categories()
        
        # Test 5: Search categories
        await self.test_search_categories()
        
        # Test 6: Get category tree
        await self.test_get_category_tree()
        
        # Test 7: Update category
        await self.test_update_category(root_category_id)
        
        # Test 8: Move category (if child exists)
        if child_category_id:
            await self.test_move_category(child_category_id, None)  # Move to root
        
        # Test 9: Get parent categories
        await self.test_get_parent_categories()
        
        # Test 10: Test duplicate prevention
        await self.test_duplicate_prevention()
        
        # Print test summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        percentage = (passed / total * 100) if total > 0 else 0
        
        print(f"✅ Passed: {passed}/{total} ({percentage:.1f}%)")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if total - passed > 0:
            print("\n📋 Failed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        print("\n🎯 Category API Test Results:")
        if percentage >= 90:
            print("🟢 EXCELLENT: Category API is working correctly!")
        elif percentage >= 70:
            print("🟡 GOOD: Most category features are working, minor issues detected")
        else:
            print("🔴 NEEDS ATTENTION: Multiple category API issues detected")


async def main():
    """Main test function"""
    try:
        async with CategoryAPITester() as tester:
            if tester.auth_token:
                await tester.run_all_tests()
            else:
                print("❌ Failed to authenticate - cannot run tests")
                sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n💥 Test execution failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    print("🧪 Category API Comprehensive Test Suite")
    print("=" * 50)
    asyncio.run(main())