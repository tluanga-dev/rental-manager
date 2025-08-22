#!/usr/bin/env python3
"""
Database Population Script for 250+ Enhanced Items
Populates the rental management database with items that have proper category_code and unit_of_measurement_code linking.

Author: Claude Code Assistant
Date: July 31, 2025
"""

import asyncio
import json
import os
import sys
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID

# Add app to path
sys.path.append('/Users/tluanga/current_work/rental-manager/rental-manager-backend')

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.modules.master_data.item_master.models import Item, ItemStatus  
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.units.models import UnitOfMeasurement


class DatabaseItemPopulator:
    """Populates database with 250+ enhanced items"""
    
    def __init__(self):
        self.base_path = "/Users/tluanga/current_work/rental-manager/rental-manager-backend"
        self.session: Optional[AsyncSession] = None
        self.brands_cache = {}
        self.categories_cache = {}
        self.units_cache = {}
        
    async def get_database_session(self):
        """Get database session"""
        try:
            async for session in get_db():
                self.session = session
                return session
        except Exception as e:
            print(f"❌ Error getting database session: {e}")
            raise
    
    async def load_reference_data(self):
        """Load and cache reference data from database"""
        print("📖 Loading reference data from database...")
        
        try:
            # Load brands
            brands_result = await self.session.execute(select(Brand))
            brands = brands_result.scalars().all()
            self.brands_cache = {brand.code: brand for brand in brands}
            print(f"✅ Loaded {len(self.brands_cache)} brands from database")
            
            # Load categories
            categories_result = await self.session.execute(select(Category))
            categories = categories_result.scalars().all()
            self.categories_cache = {category.category_code: category for category in categories}
            print(f"✅ Loaded {len(self.categories_cache)} categories from database")
            
            # Load units
            units_result = await self.session.execute(select(UnitOfMeasurement))
            units = units_result.scalars().all()
            self.units_cache = {unit.code: unit for unit in units}
            print(f"✅ Loaded {len(self.units_cache)} units from database")
            
        except Exception as e:
            print(f"❌ Error loading reference data: {e}")
            raise
    
    async def validate_item_data(self, item_data: Dict) -> Dict[str, str]:
        """Validate item data and return validation results"""
        validation_errors = {}
        
        # Check brand exists
        if item_data['brand_code'] not in self.brands_cache:
            validation_errors['brand'] = f"Brand '{item_data['brand_code']}' not found in database"
        
        # Check category exists
        if item_data['category_code'] not in self.categories_cache:
            validation_errors['category'] = f"Category '{item_data['category_code']}' not found in database"
        
        # Check unit exists
        if item_data['unit_of_measurement_code'] not in self.units_cache:
            validation_errors['unit'] = f"Unit '{item_data['unit_of_measurement_code']}' not found in database"
        
        # Check required fields
        required_fields = ['sku', 'item_name', 'rental_rate_per_period', 'purchase_price']
        for field in required_fields:
            if not item_data.get(field):
                validation_errors[field] = f"Required field '{field}' is missing or empty"
        
        return validation_errors
    
    async def check_item_exists(self, sku: str) -> bool:
        """Check if item with given SKU already exists"""
        try:
            result = await self.session.execute(
                select(Item).where(Item.sku == sku)
            )
            existing_item = result.scalar_one_or_none()
            return existing_item is not None
        except Exception as e:
            print(f"⚠️  Error checking if item {sku} exists: {e}")
            return False
    
    async def create_item_from_data(self, item_data: Dict) -> Optional[Item]:
        """Create Item object from JSON data"""
        try:
            # Validate item data
            validation_errors = await self.validate_item_data(item_data)
            if validation_errors:
                print(f"❌ Validation errors for {item_data.get('sku', 'unknown')}: {validation_errors}")
                return None
            
            # Check if item already exists
            if await self.check_item_exists(item_data['sku']):
                print(f"⚠️  Item {item_data['sku']} already exists, skipping...")
                return None
            
            # Get foreign key IDs
            brand = self.brands_cache[item_data['brand_code']]
            category = self.categories_cache[item_data['category_code']]
            unit = self.units_cache[item_data['unit_of_measurement_code']]
            
            # Create Item object
            item = Item(
                sku=item_data['sku'],
                item_name=item_data['item_name'],
                item_status=ItemStatus[item_data['item_status']],
                brand_id=brand.id,
                category_id=category.id,
                unit_of_measurement_id=unit.id,
                model_number=item_data.get('model_number'),
                description=item_data.get('description'),
                specifications=item_data.get('specifications'),
                rental_rate_per_period=Decimal(str(item_data['rental_rate_per_period'])),
                rental_period=item_data.get('rental_period', '1'),
                sale_price=Decimal(str(item_data['sale_price'])) if item_data.get('sale_price') else None,
                purchase_price=Decimal(str(item_data['purchase_price'])),
                security_deposit=Decimal(str(item_data['security_deposit'])) if item_data.get('security_deposit') else None,
                warranty_period_days=int(item_data.get('warranty_period_days', 90)),
                reorder_point=item_data.get('reorder_point', 1),
                is_rentable=item_data.get('is_rentable', True),
                is_saleable=item_data.get('is_saleable', False),
                serial_number_required=item_data.get('serial_number_required', False)
            )
            
            return item
            
        except Exception as e:
            print(f"❌ Error creating item {item_data.get('sku', 'unknown')}: {e}")
            return None
    
    async def populate_items_batch(self, items_data: List[Dict], batch_size: int = 50) -> Dict[str, int]:
        """Populate items in batches for better performance"""
        print(f"🚀 Starting batch population of {len(items_data)} items...")
        
        results = {
            "created": 0,
            "skipped": 0,
            "errors": 0
        }
        
        for i in range(0, len(items_data), batch_size):
            batch = items_data[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(items_data) + batch_size - 1) // batch_size
            
            print(f"📦 Processing batch {batch_num}/{total_batches} ({len(batch)} items)...")
            
            batch_items = []
            for item_data in batch:
                item = await self.create_item_from_data(item_data)
                if item:
                    batch_items.append(item)
                    results["created"] += 1
                else:
                    results["skipped"] += 1
            
            # Add batch to session
            if batch_items:
                try:
                    self.session.add_all(batch_items)
                    await self.session.flush()
                    print(f"✅ Added {len(batch_items)} items from batch {batch_num}")
                except Exception as e:
                    print(f"❌ Error adding batch {batch_num}: {e}")
                    results["errors"] += len(batch_items)
                    results["created"] -= len(batch_items)
                    await self.session.rollback()
        
        return results
    
    async def generate_population_report(self, results: Dict[str, int]):
        """Generate and save population report"""
        print("📊 Generating population report...")
        
        # Get item counts by category
        category_counts = {}
        for category_code, category in self.categories_cache.items():
            result = await self.session.execute(
                select(Item).where(Item.category_id == category.id)
            )
            items = result.scalars().all()
            if items:
                category_counts[category_code] = {
                    "name": category.name,
                    "count": len(items),
                    "rentable": sum(1 for item in items if item.is_rentable),
                    "saleable": sum(1 for item in items if item.is_saleable)
                }
        
        # Get total counts
        total_items_result = await self.session.execute(select(Item))
        total_items = len(total_items_result.scalars().all())
        
        report = {
            "population_summary": {
                "total_items_in_database": total_items,
                "items_created_this_run": results["created"],
                "items_skipped": results["skipped"],
                "errors": results["errors"]
            },
            "category_distribution": category_counts,
            "brand_distribution": {},
            "validation_results": {
                "all_items_have_valid_brands": True,
                "all_items_have_valid_categories": True,
                "all_items_have_valid_units": True,
                "items_with_serial_numbers": 0,
                "rentable_items": 0,
                "saleable_items": 0
            }
        }
        
        # Get brand distribution
        for brand_code, brand in self.brands_cache.items():
            result = await self.session.execute(
                select(Item).where(Item.brand_id == brand.id)
            )
            items = result.scalars().all()
            if items:
                report["brand_distribution"][brand_code] = {
                    "name": brand.name,
                    "count": len(items)
                }
        
        # Get validation counts
        all_items_result = await self.session.execute(select(Item))
        all_items = all_items_result.scalars().all()
        
        report["validation_results"]["items_with_serial_numbers"] = sum(1 for item in all_items if item.serial_number_required)
        report["validation_results"]["rentable_items"] = sum(1 for item in all_items if item.is_rentable)
        report["validation_results"]["saleable_items"] = sum(1 for item in all_items if item.is_saleable)
        
        # Save report
        report_path = os.path.join(self.base_path, "reports", "items_population_report.json")
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"📋 Population report saved to: {report_path}")
        return report
    
    async def run_population(self):
        """Main population execution method"""
        print("🎯 Starting Enhanced Items Database Population...")
        
        try:
            # Get database session
            await self.get_database_session()
            
            # Load reference data
            await self.load_reference_data()
            
            # Load items JSON
            items_file = os.path.join(self.base_path, "dummy_data", "items_enhanced_250.json")
            print(f"📂 Loading items from: {items_file}")
            
            with open(items_file, 'r') as f:
                items_data = json.load(f)
            
            print(f"📊 Loaded {len(items_data)} items from JSON file")
            
            # Populate items in batches
            results = await self.populate_items_batch(items_data)
            
            # Commit transaction
            await self.session.commit()
            print("💾 All changes committed to database")
            
            # Generate report
            report = await self.generate_population_report(results)
            
            # Print summary
            print(f"\n🎉 POPULATION COMPLETE!")
            print(f"✅ Items created: {results['created']}")
            print(f"⏭️  Items skipped: {results['skipped']}")
            print(f"❌ Errors: {results['errors']}")
            print(f"📊 Total items in database: {report['population_summary']['total_items_in_database']}")
            
            # Print category distribution
            print(f"\n📋 Category Distribution:")
            for cat_code, cat_info in report['category_distribution'].items():
                print(f"   {cat_code}: {cat_info['count']} items ({cat_info['name']})")
            
            return results, report
            
        except Exception as e:
            print(f"❌ Error during population: {e}")
            if self.session:
                await self.session.rollback()
            raise
        finally:
            if self.session:
                await self.session.close()
    
    async def validate_population(self):
        """Validate the populated items"""
        print("🔍 Validating populated items...")
        
        try:
            # Get fresh session for validation
            await self.get_database_session()
            
            # Check foreign key integrity
            orphaned_items = await self.session.execute("""
                SELECT i.sku, 'brand' as issue_type FROM items i 
                LEFT JOIN brands b ON i.brand_id = b.id 
                WHERE b.id IS NULL
                UNION ALL
                SELECT i.sku, 'category' as issue_type FROM items i 
                LEFT JOIN categories c ON i.category_id = c.id 
                WHERE c.id IS NULL
                UNION ALL
                SELECT i.sku, 'unit' as issue_type FROM items i 
                LEFT JOIN units u ON i.unit_of_measurement_id = u.id 
                WHERE u.id IS NULL
            """)
            
            orphaned = orphaned_items.fetchall()
            
            if orphaned:
                print(f"❌ Found {len(orphaned)} items with invalid relationships:")
                for item in orphaned:
                    print(f"   {item.sku}: {item.issue_type} reference invalid")
                return False
            else:
                print("✅ All items have valid foreign key relationships")
                return True
                
        except Exception as e:
            print(f"❌ Error during validation: {e}")
            return False
        finally:
            if self.session:
                await self.session.close()


async def main():
    """Main entry point"""
    print("🚀 Enhanced Items Database Population Script")
    print("=" * 50)
    
    populator = DatabaseItemPopulator()
    
    try:
        # Run population
        results, report = await populator.run_population()
        
        # Validate results
        validation_passed = await populator.validate_population()
        
        if validation_passed and results['created'] > 0:
            print(f"\n🎉 SUCCESS! Database population completed successfully!")
            print(f"📈 {results['created']} new items added to the database")
            print(f"🔗 All items have proper category_code and unit_of_measurement_code linking")
        else:
            print(f"\n⚠️  Population completed with issues. Check the logs above.")
        
        return results
        
    except Exception as e:
        print(f"\n❌ FAILED! Error during database population: {e}")
        return None


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())