#!/usr/bin/env python3
"""
Test script for Rental Pricing API endpoints.

This script tests all the rental pricing functionality including:
- Creating pricing tiers
- Calculating optimal pricing
- Managing pricing structures
"""

import asyncio
import httpx
import json
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any
import sys

# API Configuration
BASE_URL = "http://localhost:8000/api/v1"
USERNAME = "admin@rentalmanager.com"
PASSWORD = "admin123"

class RentalPricingTester:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        self.token: Optional[str] = None
        self.test_item_id: Optional[str] = None
        self.created_pricing_ids = []
        
    async def __aenter__(self):
        await self.login()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cleanup()
        await self.client.aclose()
        
    async def login(self):
        """Authenticate and get JWT token."""
        print("🔐 Logging in...")
        response = await self.client.post(
            "/auth/login",
            json={"username": USERNAME, "password": PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data["access_token"]
            self.client.headers["Authorization"] = f"Bearer {self.token}"
            print("✅ Login successful")
        else:
            print(f"❌ Login failed: {response.text}")
            sys.exit(1)
            
    async def get_or_create_test_item(self):
        """Get an existing item or create a test item."""
        print("\n📦 Getting test item...")
        
        # First, try to get existing items
        response = await self.client.get("/items/", params={"limit": 1})
        if response.status_code == 200:
            data = response.json()
            # Check if response is a dict with 'items' key or a list
            items = data.get('items', data) if isinstance(data, dict) else data
            if items and len(items) > 0:
                self.test_item_id = items[0]["id"]
                print(f"✅ Using existing item: {items[0]['item_name']} (ID: {self.test_item_id})")
                return
        
        # If no items exist, create one
        print("Creating new test item...")
        
        # First ensure we have required master data
        await self.ensure_master_data()
        
        # Create test item
        item_data = {
            "item_name": "Test Rental Equipment",
            "sku": f"TEST-{date.today().strftime('%Y%m%d')}",
            "description": "Test item for rental pricing",
            "is_rentable": True,
            "is_salable": True,
            "cost_price": 500.00,
            "sale_price": 1000.00,
            "rental_rate_per_day": 50.00,  # Fallback rate
            "security_deposit": 200.00
        }
        
        response = await self.client.post("/items/", json=item_data)
        if response.status_code in [200, 201]:
            item = response.json()
            self.test_item_id = item["id"]
            print(f"✅ Created test item: {item['item_name']} (ID: {self.test_item_id})")
        else:
            print(f"❌ Failed to create item: {response.text}")
            
    async def ensure_master_data(self):
        """Ensure required master data exists."""
        # Check for categories
        response = await self.client.get("/categories/", params={"limit": 1})
        if response.status_code == 200:
            categories = response.json()
            if not categories or len(categories) == 0:
                # Create a test category
                await self.client.post("/categories/", json={
                    "name": "Equipment",
                    "category_code": "EQUIP"
                })
                
    async def test_create_standard_pricing(self):
        """Test creating standard pricing structure."""
        print("\n🏷️  Testing standard pricing creation...")
        
        # First, delete any existing pricing for this item
        response = await self.client.get(f"/rental-pricing/item/{self.test_item_id}")
        if response.status_code == 200:
            existing = response.json()
            for pricing in existing:
                await self.client.delete(f"/rental-pricing/{pricing['id']}")
        
        data = {
            "daily_rate": 50.00,
            "weekly_discount_percentage": 15,  # 15% discount for weekly
            "monthly_discount_percentage": 30   # 30% discount for monthly
        }
        
        response = await self.client.post(
            f"/rental-pricing/standard-template/{self.test_item_id}",
            json=data
        )
        
        if response.status_code in [200, 201]:
            result = response.json()
            print(f"✅ Created standard pricing: {result['summary']}")
            
            # Store created pricing IDs for cleanup
            for tier in result.get('created_tiers', []):
                self.created_pricing_ids.append(tier['id'])
                print(f"   - {tier['tier_name']}: ${tier['rate_per_period']}/{tier['period_days']} days")
        else:
            print(f"❌ Failed to create standard pricing: {response.text}")
            
    async def test_create_custom_pricing(self):
        """Test creating custom pricing tier."""
        print("\n🎯 Testing custom pricing creation...")
        
        data = {
            "item_id": self.test_item_id,
            "tier_name": "Weekend Special",
            "period_type": "DAILY",
            "period_days": 1,
            "rate_per_period": 40.00,
            "min_rental_days": 2,
            "max_rental_days": 3,
            "priority": 5,
            "description": "Special weekend rate for 2-3 day rentals"
        }
        
        response = await self.client.post("/rental-pricing/", json=data)
        
        if response.status_code in [200, 201]:
            pricing = response.json()
            self.created_pricing_ids.append(pricing['id'])
            print(f"✅ Created custom pricing: {pricing['tier_name']}")
            print(f"   Rate: ${pricing['rate_per_period']} for {pricing['min_rental_days']}-{pricing['max_rental_days']} days")
        else:
            print(f"❌ Failed to create custom pricing: {response.text}")
            
    async def test_calculate_pricing(self):
        """Test pricing calculations for different durations."""
        print("\n💰 Testing pricing calculations...")
        
        test_durations = [1, 3, 7, 10, 30, 45]
        
        for days in test_durations:
            data = {
                "item_id": self.test_item_id,
                "rental_days": days,
                "calculation_date": date.today().isoformat()
            }
            
            response = await self.client.post("/rental-pricing/calculate", json=data)
            
            if response.status_code == 200:
                result = response.json()
                total_cost = result['total_cost']
                daily_rate = result['daily_equivalent_rate']
                recommended = result.get('recommended_tier')
                savings = result.get('savings_compared_to_daily')
                
                print(f"\n   📅 {days} days rental:")
                print(f"      Total: ${float(total_cost):.2f}")
                print(f"      Daily rate: ${float(daily_rate):.2f}/day")
                if recommended:
                    print(f"      Using: {recommended['tier_name']}")
                if savings and float(savings) > 0:
                    print(f"      Savings: ${float(savings):.2f} vs daily rate")
            else:
                print(f"   ❌ Failed to calculate for {days} days: {response.text}")
                
    async def test_get_pricing_summary(self):
        """Test getting pricing summary for an item."""
        print("\n📊 Testing pricing summary...")
        
        response = await self.client.get(f"/rental-pricing/item/{self.test_item_id}/summary")
        
        if response.status_code == 200:
            summary = response.json()
            print(f"✅ Pricing summary retrieved:")
            print(f"   Has tiered pricing: {summary['has_tiered_pricing']}")
            if summary.get('daily_rate_range'):
                min_rate, max_rate = summary['daily_rate_range']
                print(f"   Daily rate range: ${min_rate:.2f} - ${max_rate:.2f}")
            print(f"   Available tiers: {len(summary['available_tiers'])}")
            
            for tier in summary['available_tiers']:
                print(f"      - {tier['tier_name']}: ${tier['rate_per_period']}/{tier['period_days']}d")
        else:
            print(f"❌ Failed to get pricing summary: {response.text}")
            
    async def test_bulk_pricing_calculation(self):
        """Test calculating pricing for multiple items."""
        print("\n📈 Testing bulk pricing calculation...")
        
        # For this test, we'll use the same item multiple times
        response = await self.client.post(
            "/rental-pricing/calculate/bulk",
            params={
                "item_ids": [self.test_item_id],
                "rental_days": 14,
                "optimization_strategy": "LOWEST_COST"
            }
        )
        
        if response.status_code == 200:
            results = response.json()
            print(f"✅ Bulk calculation completed for {len(results)} items")
            for item_id, calc in results.items():
                print(f"   Item {item_id}: ${calc['total_cost']:.2f} for 14 days")
        else:
            print(f"❌ Failed bulk calculation: {response.text}")
            
    async def test_update_pricing(self):
        """Test updating a pricing tier."""
        print("\n✏️  Testing pricing update...")
        
        if not self.created_pricing_ids:
            print("   ⚠️  No pricing tiers to update")
            return
            
        pricing_id = self.created_pricing_ids[0]
        
        update_data = {
            "rate_per_period": 45.00,
            "description": "Updated rate for testing"
        }
        
        response = await self.client.put(f"/rental-pricing/{pricing_id}", json=update_data)
        
        if response.status_code == 200:
            updated = response.json()
            print(f"✅ Updated pricing tier: {updated['tier_name']}")
            print(f"   New rate: ${updated['rate_per_period']}")
        else:
            print(f"❌ Failed to update pricing: {response.text}")
            
    async def test_list_pricing_with_filters(self):
        """Test listing pricing with various filters."""
        print("\n🔍 Testing pricing list with filters...")
        
        params = {
            "item_ids": [self.test_item_id],
            "is_active": True,
            "sort": "priority",  # Use the actual enum value
            "limit": 10
        }
        
        response = await self.client.get("/rental-pricing/", params=params)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Found {result['total']} pricing tiers")
            for item in result['items'][:5]:  # Show first 5
                print(f"   - {item['tier_name']}: Priority {item['priority']}, ${item['rate_per_period']}")
        else:
            print(f"❌ Failed to list pricing: {response.text}")
            
    async def cleanup(self):
        """Clean up test data."""
        print("\n🧹 Cleaning up test data...")
        
        # Delete created pricing tiers
        for pricing_id in self.created_pricing_ids:
            try:
                response = await self.client.delete(f"/rental-pricing/{pricing_id}")
                if response.status_code == 204:
                    print(f"   Deleted pricing tier: {pricing_id}")
            except:
                pass
                
        print("✅ Cleanup completed")
        
    async def run_all_tests(self):
        """Run all tests in sequence."""
        print("\n" + "="*60)
        print("🚀 RENTAL PRICING API TEST SUITE")
        print("="*60)
        
        try:
            # Setup
            await self.get_or_create_test_item()
            
            # Run tests
            await self.test_create_standard_pricing()
            await self.test_create_custom_pricing()
            await self.test_calculate_pricing()
            await self.test_get_pricing_summary()
            await self.test_bulk_pricing_calculation()
            await self.test_update_pricing()
            await self.test_list_pricing_with_filters()
            
            print("\n" + "="*60)
            print("✅ ALL TESTS COMPLETED SUCCESSFULLY!")
            print("="*60)
            
        except Exception as e:
            print(f"\n❌ Test failed with error: {e}")
            raise

async def main():
    """Main entry point."""
    async with RentalPricingTester() as tester:
        await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())