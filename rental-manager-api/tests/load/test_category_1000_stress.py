#!/usr/bin/env python3
"""
1000-Category Stress Test with 4-Tier Hierarchy

This script creates and tests a hierarchical category structure with exactly 1000 categories
distributed across 4 tiers as follows:
- Tier 1 (Root): 10 categories
- Tier 2: 30 categories (3 per root)
- Tier 3: 270 categories (9 per tier-2)
- Tier 4: 690 categories (~2.56 per tier-3)
Total: 1000 categories exactly

The test validates performance, hierarchy integrity, and cleanup operations.
"""

import asyncio
import json
import sys
import time
from typing import Dict, Any, Optional, List
import aiohttp
from datetime import datetime
import random
import math


class Category1000StressTester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.auth_token: Optional[str] = None
        
        # Test configuration
        self.tier_1_count = 10    # Root categories
        self.tier_2_count = 30    # 3 per root
        self.tier_3_count = 270   # 9 per tier-2
        self.tier_4_count = 690   # Remaining to reach 1000
        self.total_count = 1000
        
        # Data storage
        self.created_categories = {
            1: [],  # tier_1 categories
            2: [],  # tier_2 categories
            3: [],  # tier_3 categories
            4: []   # tier_4 categories
        }
        
        # Performance metrics
        self.metrics = {
            "creation_times": [],
            "query_times": [],
            "total_creation_time": 0,
            "total_query_time": 0,
            "errors": []
        }
        
        # Category templates
        self.tier_1_categories = [
            "Electronics", "Home & Garden", "Sports & Outdoors", "Automotive", "Health & Beauty",
            "Toys & Games", "Books & Media", "Clothing & Fashion", "Food & Beverages", "Office Supplies"
        ]
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        await self.authenticate()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cleanup_all_categories()
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
    
    async def create_category(self, name: str, parent_id: Optional[str] = None, tier: int = 1) -> Optional[str]:
        """Create a single category and track performance"""
        start_time = time.time()
        
        try:
            category_data = {
                "name": name,
                "display_order": len(self.created_categories[tier]) + 1
            }
            
            if parent_id:
                category_data["parent_category_id"] = parent_id
            
            async with self.session.post(
                f"{self.base_url}/api/v1/categories/",
                headers=self.get_headers(),
                json=category_data
            ) as response:
                
                creation_time = time.time() - start_time
                self.metrics["creation_times"].append(creation_time)
                
                if response.status == 201:
                    result = await response.json()
                    category_id = result.get("id")
                    
                    # Verify tier properties
                    expected_level = tier
                    if result.get("category_level") != expected_level:
                        self.metrics["errors"].append(f"Wrong level for {name}: got {result.get('category_level')}, expected {expected_level}")
                    
                    # Store in appropriate tier
                    self.created_categories[tier].append({
                        "id": category_id,
                        "name": name,
                        "parent_id": parent_id,
                        "tier": tier,
                        "creation_time": creation_time,
                        "path": result.get("category_path"),
                        "level": result.get("category_level")
                    })
                    
                    return category_id
                else:
                    error_text = await response.text()
                    self.metrics["errors"].append(f"Failed to create {name}: {response.status} - {error_text}")
                    return None
                    
        except Exception as e:
            creation_time = time.time() - start_time
            self.metrics["creation_times"].append(creation_time)
            self.metrics["errors"].append(f"Exception creating {name}: {e}")
            return None
    
    async def create_tier_1_categories(self):
        """Create 10 root categories (Tier 1)"""
        print(f"\n🌳 Creating Tier 1 Categories (Root): {self.tier_1_count} categories")
        
        for i, base_name in enumerate(self.tier_1_categories):
            # Add timestamp to ensure uniqueness
            timestamp = int(time.time()) + i
            name = f"{base_name}_{timestamp}"
            
            category_id = await self.create_category(name, tier=1)
            if category_id:
                print(f"  ✓ Created: {name} (ID: {category_id})")
            else:
                print(f"  ✗ Failed: {name}")
        
        print(f"✅ Tier 1 Complete: {len(self.created_categories[1])}/{self.tier_1_count} categories created")
    
    async def create_tier_2_categories(self):
        """Create 30 tier-2 categories (3 per root)"""
        print(f"\n🌿 Creating Tier 2 Categories: {self.tier_2_count} categories")
        
        if len(self.created_categories[1]) == 0:
            print("❌ No Tier 1 categories available!")
            return
        
        categories_per_parent = 3
        created_count = 0
        
        for parent_data in self.created_categories[1]:
            parent_id = parent_data["id"]
            parent_name = parent_data["name"]
            
            for i in range(categories_per_parent):
                subcategory_names = [
                    "Premium", "Standard", "Budget",
                    "Professional", "Consumer", "Industrial",
                    "Indoor", "Outdoor", "Portable"
                ]
                
                base_name = subcategory_names[i % len(subcategory_names)]
                name = f"{parent_name}_{base_name}_{created_count + 1}"
                
                category_id = await self.create_category(name, parent_id, tier=2)
                if category_id:
                    created_count += 1
                    if created_count % 10 == 0:
                        print(f"  ✓ Progress: {created_count}/{self.tier_2_count}")
                
                if created_count >= self.tier_2_count:
                    break
            
            if created_count >= self.tier_2_count:
                break
        
        print(f"✅ Tier 2 Complete: {len(self.created_categories[2])}/{self.tier_2_count} categories created")
    
    async def create_tier_3_categories(self):
        """Create 270 tier-3 categories (9 per tier-2)"""
        print(f"\n🍃 Creating Tier 3 Categories: {self.tier_3_count} categories")
        
        if len(self.created_categories[2]) == 0:
            print("❌ No Tier 2 categories available!")
            return
        
        categories_per_parent = 9
        created_count = 0
        
        for parent_data in self.created_categories[2]:
            parent_id = parent_data["id"]
            parent_name = parent_data["name"]
            
            for i in range(categories_per_parent):
                subcategory_names = [
                    "Type_A", "Type_B", "Type_C", "Type_D", "Type_E",
                    "Model_X", "Model_Y", "Model_Z", "Special_Edition"
                ]
                
                base_name = subcategory_names[i % len(subcategory_names)]
                name = f"{parent_name}_{base_name}_{created_count + 1}"
                
                category_id = await self.create_category(name, parent_id, tier=3)
                if category_id:
                    created_count += 1
                    if created_count % 50 == 0:
                        print(f"  ✓ Progress: {created_count}/{self.tier_3_count}")
                
                if created_count >= self.tier_3_count:
                    break
            
            if created_count >= self.tier_3_count:
                break
        
        print(f"✅ Tier 3 Complete: {len(self.created_categories[3])}/{self.tier_3_count} categories created")
    
    async def create_tier_4_categories(self):
        """Create 690 tier-4 categories (distributed across tier-3)"""
        print(f"\n🌱 Creating Tier 4 Categories: {self.tier_4_count} categories")
        
        if len(self.created_categories[3]) == 0:
            print("❌ No Tier 3 categories available!")
            return
        
        # Distribute tier-4 categories across tier-3 parents
        tier_3_count = len(self.created_categories[3])
        base_per_parent = self.tier_4_count // tier_3_count
        extra_categories = self.tier_4_count % tier_3_count
        
        created_count = 0
        
        for idx, parent_data in enumerate(self.created_categories[3]):
            parent_id = parent_data["id"]
            parent_name = parent_data["name"]
            
            # Some parents get one extra category
            categories_for_this_parent = base_per_parent + (1 if idx < extra_categories else 0)
            
            for i in range(categories_for_this_parent):
                variants = [
                    "Small", "Medium", "Large", "XL", "Compact", "Extended",
                    "Basic", "Advanced", "Pro", "Elite", "Limited", "Standard"
                ]
                
                variant = variants[i % len(variants)]
                name = f"{parent_name}_{variant}_{created_count + 1}"
                
                category_id = await self.create_category(name, parent_id, tier=4)
                if category_id:
                    created_count += 1
                    if created_count % 100 == 0:
                        print(f"  ✓ Progress: {created_count}/{self.tier_4_count}")
                
                if created_count >= self.tier_4_count:
                    break
            
            if created_count >= self.tier_4_count:
                break
        
        print(f"✅ Tier 4 Complete: {len(self.created_categories[4])}/{self.tier_4_count} categories created")
    
    async def test_hierarchy_queries(self):
        """Test various hierarchy queries for performance"""
        print(f"\n🔍 Testing Hierarchy Queries...")
        
        # Test tree retrieval
        start_time = time.time()
        try:
            async with self.session.get(
                f"{self.base_url}/api/v1/categories/tree/",
                headers=self.get_headers()
            ) as response:
                tree_time = time.time() - start_time
                self.metrics["query_times"].append(("full_tree", tree_time))
                
                if response.status == 200:
                    tree_data = await response.json()
                    print(f"  ✓ Full Tree Query: {tree_time:.2f}s ({len(tree_data)} root nodes)")
                else:
                    print(f"  ✗ Full Tree Query Failed: {response.status}")
        except Exception as e:
            print(f"  ✗ Full Tree Query Error: {e}")
        
        # Test search queries
        search_terms = ["Electronics", "Type_A", "Standard", "Pro"]
        for term in search_terms:
            start_time = time.time()
            try:
                async with self.session.get(
                    f"{self.base_url}/api/v1/categories/search/?q={term}&limit=50",
                    headers=self.get_headers()
                ) as response:
                    search_time = time.time() - start_time
                    self.metrics["query_times"].append(("search", search_time))
                    
                    if response.status == 200:
                        results = await response.json()
                        print(f"  ✓ Search '{term}': {search_time:.3f}s ({len(results)} results)")
                    else:
                        print(f"  ✗ Search '{term}' Failed: {response.status}")
            except Exception as e:
                print(f"  ✗ Search '{term}' Error: {e}")
        
        # Test pagination with large datasets
        start_time = time.time()
        try:
            async with self.session.get(
                f"{self.base_url}/api/v1/categories/?page=1&page_size=100",
                headers=self.get_headers()
            ) as response:
                page_time = time.time() - start_time
                self.metrics["query_times"].append(("pagination", page_time))
                
                if response.status == 200:
                    page_data = await response.json()
                    print(f"  ✓ Pagination (100 items): {page_time:.3f}s ({page_data.get('total', 0)} total)")
                else:
                    print(f"  ✗ Pagination Failed: {response.status}")
        except Exception as e:
            print(f"  ✗ Pagination Error: {e}")
    
    async def validate_hierarchy_integrity(self):
        """Validate the created hierarchy structure"""
        print(f"\n🔍 Validating Hierarchy Integrity...")
        
        total_created = sum(len(tier) for tier in self.created_categories.values())
        print(f"📊 Created Categories by Tier:")
        print(f"  Tier 1 (Root): {len(self.created_categories[1])}")
        print(f"  Tier 2: {len(self.created_categories[2])}")
        print(f"  Tier 3: {len(self.created_categories[3])}")
        print(f"  Tier 4: {len(self.created_categories[4])}")
        print(f"  Total: {total_created}/{self.total_count}")
        
        # Validate hierarchy relationships
        validation_errors = []
        
        # Check tier-1 categories (should be roots)
        for cat in self.created_categories[1]:
            if cat["level"] != 1:
                validation_errors.append(f"Tier 1 category {cat['name']} has wrong level: {cat['level']}")
        
        # Check tier-2 categories (should have tier-1 parents)
        for cat in self.created_categories[2]:
            if cat["level"] != 2:
                validation_errors.append(f"Tier 2 category {cat['name']} has wrong level: {cat['level']}")
            if not cat["parent_id"]:
                validation_errors.append(f"Tier 2 category {cat['name']} has no parent")
        
        # Check tier-3 categories (should have tier-2 parents)
        for cat in self.created_categories[3]:
            if cat["level"] != 3:
                validation_errors.append(f"Tier 3 category {cat['name']} has wrong level: {cat['level']}")
            if not cat["parent_id"]:
                validation_errors.append(f"Tier 3 category {cat['name']} has no parent")
        
        # Check tier-4 categories (should have tier-3 parents)
        for cat in self.created_categories[4]:
            if cat["level"] != 4:
                validation_errors.append(f"Tier 4 category {cat['name']} has wrong level: {cat['level']}")
            if not cat["parent_id"]:
                validation_errors.append(f"Tier 4 category {cat['name']} has no parent")
        
        if validation_errors:
            print(f"❌ Validation Errors Found: {len(validation_errors)}")
            for error in validation_errors[:10]:  # Show first 10 errors
                print(f"  ❌ {error}")
            if len(validation_errors) > 10:
                print(f"  ... and {len(validation_errors) - 10} more errors")
        else:
            print("✅ Hierarchy integrity validation passed!")
        
        return len(validation_errors) == 0
    
    async def performance_summary(self):
        """Generate performance summary"""
        print(f"\n📊 PERFORMANCE SUMMARY")
        print("=" * 60)
        
        # Creation performance
        creation_times = self.metrics["creation_times"]
        if creation_times:
            avg_creation = sum(creation_times) / len(creation_times)
            min_creation = min(creation_times)
            max_creation = max(creation_times)
            total_creation = sum(creation_times)
            
            print(f"📈 Category Creation Performance:")
            print(f"  Total Categories: {len(creation_times)}")
            print(f"  Total Time: {total_creation:.2f}s")
            print(f"  Average Time: {avg_creation:.3f}s per category")
            print(f"  Min Time: {min_creation:.3f}s")
            print(f"  Max Time: {max_creation:.3f}s")
            print(f"  Throughput: {len(creation_times)/total_creation:.1f} categories/second")
        
        # Query performance
        if self.metrics["query_times"]:
            print(f"\n🔍 Query Performance:")
            for query_type, query_time in self.metrics["query_times"]:
                print(f"  {query_type}: {query_time:.3f}s")
        
        # Error summary
        if self.metrics["errors"]:
            print(f"\n❌ Errors Encountered: {len(self.metrics['errors'])}")
            for error in self.metrics["errors"][:5]:  # Show first 5 errors
                print(f"  ❌ {error}")
            if len(self.metrics["errors"]) > 5:
                print(f"  ... and {len(self.metrics['errors']) - 5} more errors")
        
        # Overall assessment
        total_created = sum(len(tier) for tier in self.created_categories.values())
        success_rate = (total_created / self.total_count) * 100
        
        print(f"\n🎯 Overall Assessment:")
        print(f"  Target: {self.total_count} categories")
        print(f"  Created: {total_created} categories")
        print(f"  Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 95:
            print("  🟢 EXCELLENT: Stress test passed!")
        elif success_rate >= 80:
            print("  🟡 GOOD: Most categories created successfully")
        else:
            print("  🔴 NEEDS ATTENTION: Many categories failed to create")
    
    async def cleanup_all_categories(self):
        """Clean up all created categories"""
        print(f"\n🧹 Cleaning up all test categories...")
        
        total_to_delete = sum(len(tier) for tier in self.created_categories.values())
        deleted_count = 0
        
        # Delete in reverse tier order (4, 3, 2, 1) to avoid constraint issues
        for tier in [4, 3, 2, 1]:
            for category in self.created_categories[tier]:
                try:
                    async with self.session.delete(
                        f"{self.base_url}/api/v1/categories/{category['id']}",
                        headers=self.get_headers()
                    ) as response:
                        if response.status == 204:
                            deleted_count += 1
                            if deleted_count % 100 == 0:
                                print(f"  ✓ Deleted {deleted_count}/{total_to_delete} categories")
                        else:
                            print(f"  ✗ Failed to delete {category['name']}: {response.status}")
                except Exception as e:
                    print(f"  ✗ Error deleting {category['name']}: {e}")
        
        print(f"✅ Cleanup complete: {deleted_count}/{total_to_delete} categories deleted")
    
    async def run_stress_test(self):
        """Run the complete 1000-category stress test"""
        print("🚀 Starting 1000-Category Stress Test with 4-Tier Hierarchy")
        print("=" * 70)
        print(f"Target Distribution:")
        print(f"  Tier 1 (Root): {self.tier_1_count} categories")
        print(f"  Tier 2: {self.tier_2_count} categories")  
        print(f"  Tier 3: {self.tier_3_count} categories")
        print(f"  Tier 4: {self.tier_4_count} categories")
        print(f"  TOTAL: {self.total_count} categories")
        
        start_time = time.time()
        
        # Create categories tier by tier
        await self.create_tier_1_categories()
        await self.create_tier_2_categories()
        await self.create_tier_3_categories()
        await self.create_tier_4_categories()
        
        creation_time = time.time() - start_time
        self.metrics["total_creation_time"] = creation_time
        
        # Validate hierarchy
        integrity_valid = await self.validate_hierarchy_integrity()
        
        # Test queries
        query_start = time.time()
        await self.test_hierarchy_queries()
        self.metrics["total_query_time"] = time.time() - query_start
        
        # Generate performance summary
        await self.performance_summary()
        
        return integrity_valid


async def main():
    """Main test function"""
    try:
        async with Category1000StressTester() as tester:
            if tester.auth_token:
                success = await tester.run_stress_test()
                
                if success:
                    print("\n🎉 1000-Category Stress Test COMPLETED SUCCESSFULLY!")
                else:
                    print("\n⚠️ 1000-Category Stress Test completed with issues")
                    sys.exit(1)
            else:
                print("❌ Failed to authenticate - cannot run stress test")
                sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 Stress test interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n💥 Stress test execution failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    print("🧪 1000-Category Hierarchical Stress Test")
    print("=" * 50)
    asyncio.run(main())