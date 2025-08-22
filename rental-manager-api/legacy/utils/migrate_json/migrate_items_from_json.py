#!/usr/bin/env python3
"""
Migrate items from JSON to database
"""
import asyncio
import json
import uuid
import sys
import os
from pathlib import Path
from decimal import Decimal
from sqlalchemy import text

# Add the project root directory to the path so we can import the app modules
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent.parent  # Go up from migrate_json -> utils -> project_root
sys.path.insert(0, str(project_root))

# Change to project root directory for relative paths to work
original_cwd = os.getcwd()
if not original_cwd.endswith('rental-manager-backend'):
    os.chdir(project_root)

# Now import after path setup
from app.core.database import AsyncSessionLocal

async def migrate_items():
    """Migrate items from JSON file to database"""
    print("🚀 Starting items migration...")
    
    # Load items data - try comprehensive_items.json first, then items.json
    items_data = None
    json_file = None
    
    for filename in ['dummy_data/comprehensive_items.json', 'dummy_data/items.json']:
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                items_data = json.load(f)
            json_file = filename
            print(f"📄 Loaded {len(items_data)} items from {filename}")
            break
        except FileNotFoundError:
            continue
        except Exception as e:
            print(f"❌ Error loading {filename}: {e}")
            continue
    
    if not items_data:
        print("❌ No items JSON file found. Please ensure either comprehensive_items.json or items.json exists in dummy_data/")
        return False
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if items table exists
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'items'
                );
            """))
            table_exists = result.scalar()
            
            if not table_exists:
                print("❌ Items table does not exist. Please run migrations first:")
                print("   alembic upgrade head")
                return False
            
            # Check existing data
            result = await session.execute(text("SELECT COUNT(*) FROM items"))
            existing_count = result.scalar()
            
            # Clear existing items
            if existing_count > 0:
                print(f"🧹 Clearing {existing_count} existing items...")
                await session.execute(text("DELETE FROM items"))
                print("✅ Existing items cleared")
            else:
                print("ℹ️  No existing items to clear")
            
            # Create lookup dictionaries for foreign keys
            print("🔍 Building lookup dictionaries for foreign keys...")
            
            # Brand lookup
            brand_lookup = {}
            result = await session.execute(text("SELECT id, code FROM brands WHERE is_active = true"))
            for row in result:
                brand_lookup[row.code] = row.id
            print(f"   • Loaded {len(brand_lookup)} brands")
            
            # Category lookup
            category_lookup = {}
            result = await session.execute(text("SELECT id, category_code FROM categories WHERE is_active = true"))
            for row in result:
                category_lookup[row.category_code] = row.id
            print(f"   • Loaded {len(category_lookup)} categories")
            
            # Unit lookup
            unit_lookup = {}
            result = await session.execute(text("SELECT id, code FROM units_of_measurement WHERE is_active = true"))
            for row in result:
                unit_lookup[row.code] = row.id
            print(f"   • Loaded {len(unit_lookup)} units")
            
            # Insert items one by one
            created_count = 0
            failed_count = 0
            
            for item_data in items_data:
                # Create a savepoint for each item
                savepoint = await session.begin_nested()
                try:
                    # Generate UUID for the item
                    item_id = uuid.uuid4()
                    
                    # Resolve foreign key IDs
                    brand_id = None
                    if item_data.get('brand_code'):
                        brand_id = brand_lookup.get(item_data['brand_code'])
                        if not brand_id:
                            print(f"⚠️  Brand code '{item_data['brand_code']}' not found for item {item_data['sku']}")
                    
                    category_id = None
                    # Try both category_code and category_name for backward compatibility
                    category_key = item_data.get('category_code') or item_data.get('category_name')
                    if category_key:
                        category_id = category_lookup.get(category_key)
                        if not category_id:
                            print(f"⚠️  Category '{category_key}' not found for item {item_data['sku']}")
                    
                    unit_id = None
                    if item_data.get('unit_code'):
                        unit_id = unit_lookup.get(item_data['unit_code'])
                        if not unit_id:
                            print(f"❌ Unit code '{item_data['unit_code']}' not found for item {item_data['sku']} - skipping")
                            await savepoint.rollback()
                            failed_count += 1
                            continue
                    else:
                        print(f"❌ No unit_code specified for item {item_data['sku']} - skipping")
                        await savepoint.rollback()
                        failed_count += 1
                        continue
                    
                    # Convert numeric fields
                    rental_rate = None
                    if item_data.get('rental_rate_per_period'):
                        rental_rate = Decimal(str(item_data['rental_rate_per_period']))
                    
                    sale_price = None
                    if item_data.get('sale_price'):
                        sale_price = Decimal(str(item_data['sale_price']))
                    
                    purchase_price = None
                    if item_data.get('purchase_price'):
                        purchase_price = Decimal(str(item_data['purchase_price']))
                    
                    security_deposit = Decimal('0.00')
                    if item_data.get('security_deposit'):
                        security_deposit = Decimal(str(item_data['security_deposit']))
                    
                    # Convert warranty period to string
                    warranty_period = str(item_data.get('warranty_period_days', '0'))
                    
                    # Convert rental period to string
                    rental_period = str(item_data.get('rental_period', '1'))
                    
                    # Convert reorder_point to integer
                    reorder_point = int(item_data.get('reorder_point', 0))
                    
                    # Insert item with proper data types
                    insert_query = text("""
                        INSERT INTO items (
                            id, sku, item_name, item_status, brand_id, category_id, 
                            unit_of_measurement_id, rental_rate_per_period, rental_period,
                            sale_price, purchase_price, security_deposit, description,
                            specifications, model_number, serial_number_required,
                            warranty_period_days, reorder_point, is_rentable, is_saleable,
                            is_active
                        ) VALUES (
                            :id, :sku, :item_name, :item_status, :brand_id, :category_id,
                            :unit_of_measurement_id, :rental_rate_per_period, :rental_period,
                            :sale_price, :purchase_price, :security_deposit, :description,
                            :specifications, :model_number, :serial_number_required,
                            :warranty_period_days, :reorder_point, :is_rentable, :is_saleable,
                            :is_active
                        )
                    """)
                    
                    await session.execute(insert_query, {
                        'id': item_id,
                        'sku': item_data['sku'],
                        'item_name': item_data['item_name'],
                        'item_status': item_data.get('item_status', 'ACTIVE'),
                        'brand_id': brand_id,
                        'category_id': category_id,
                        'unit_of_measurement_id': unit_id,
                        'rental_rate_per_period': rental_rate,
                        'rental_period': rental_period,
                        'sale_price': sale_price,
                        'purchase_price': purchase_price,
                        'security_deposit': security_deposit,
                        'description': item_data.get('description'),
                        'specifications': item_data.get('specifications'),
                        'model_number': item_data.get('model_number'),
                        'serial_number_required': item_data.get('serial_number_required', False),
                        'warranty_period_days': warranty_period,
                        'reorder_point': reorder_point,
                        'is_rentable': item_data.get('is_rentable', True),
                        'is_saleable': item_data.get('is_saleable', False),
                        'is_active': True
                    })
                    
                    await savepoint.commit()
                    created_count += 1
                    
                    # Create display info
                    display_name = f"{item_data['item_name']} ({item_data['sku']})"
                    print(f"✅ Created item: {display_name}")
                    
                except Exception as e:
                    await savepoint.rollback()
                    failed_count += 1
                    print(f"❌ Error creating item {item_data.get('sku', 'Unknown')}: {e}")
                    continue
            
            # Commit all changes
            await session.commit()
            print(f"\n🎉 Successfully migrated {created_count} items to database!")
            
            # Show summary statistics
            print(f"\n📊 Migration Summary:")
            print(f"   • Total items processed: {len(items_data)}")
            print(f"   • Successfully created: {created_count}")
            print(f"   • Failed: {failed_count}")
            print(f"   • Success rate: {(created_count/len(items_data)*100):.1f}%")
            
            return True
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Migration failed: {e}")
            return False

async def verify_items_migration():
    """Verify the items migration was successful"""
    print("\n🔍 Verifying items migration...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Count total items
            result = await session.execute(text("SELECT COUNT(*) FROM items WHERE is_active = true"))
            total_count = result.scalar()
            print(f"✅ Total active items in database: {total_count}")
            
            # Group items by status
            result = await session.execute(text("""
                SELECT item_status, COUNT(*) as count
                FROM items 
                WHERE is_active = true 
                GROUP BY item_status
                ORDER BY count DESC
            """))
            
            print(f"\n📊 Items by Status:")
            for row in result:
                print(f"   • {row.item_status}: {row.count} items")
            
            # Group items by rental vs sale
            result = await session.execute(text("""
                SELECT 
                    CASE 
                        WHEN is_rentable = true THEN 'Rentable'
                        WHEN is_saleable = true THEN 'Saleable'
                        ELSE 'Other'
                    END as item_type,
                    COUNT(*) as count
                FROM items 
                WHERE is_active = true 
                GROUP BY item_type
                ORDER BY count DESC
            """))
            
            print(f"\n🏷️  Items by Type:")
            for row in result:
                print(f"   • {row.item_type}: {row.count} items")
            
            # Show items by brand (top 10)
            result = await session.execute(text("""
                SELECT b.name as brand_name, COUNT(i.id) as count
                FROM items i
                LEFT JOIN brands b ON i.brand_id = b.id
                WHERE i.is_active = true
                GROUP BY b.name
                ORDER BY count DESC
                LIMIT 10
            """))
            
            print(f"\n🏭 Top 10 Brands by Item Count:")
            for row in result:
                brand_name = row.brand_name or "No Brand"
                print(f"   • {brand_name}: {row.count} items")
            
            # Show items by category (top 10)
            result = await session.execute(text("""
                SELECT c.name as category_name, COUNT(i.id) as count
                FROM items i
                LEFT JOIN categories c ON i.category_id = c.id
                WHERE i.is_active = true
                GROUP BY c.name
                ORDER BY count DESC
                LIMIT 10
            """))
            
            print(f"\n📂 Top 10 Categories by Item Count:")
            for row in result:
                category_name = row.category_name or "No Category"
                print(f"   • {category_name}: {row.count} items")
            
            # Show rental rate statistics
            result = await session.execute(text("""
                SELECT 
                    COUNT(*) as total_rentable,
                    AVG(rental_rate_per_period) as avg_rate,
                    MIN(rental_rate_per_period) as min_rate,
                    MAX(rental_rate_per_period) as max_rate
                FROM items 
                WHERE is_active = true 
                AND is_rentable = true 
                AND rental_rate_per_period IS NOT NULL
            """))
            
            row = result.fetchone()
            if row and row.total_rentable > 0:
                print(f"\n💰 Rental Rate Statistics:")
                print(f"   • Total rentable items: {row.total_rentable}")
                print(f"   • Average rate: ${float(row.avg_rate):.2f}")
                print(f"   • Minimum rate: ${float(row.min_rate):.2f}")
                print(f"   • Maximum rate: ${float(row.max_rate):.2f}")
            
            # Show sample items from different categories
            result = await session.execute(text("""
                SELECT i.sku, i.item_name, b.name as brand_name, c.name as category_name,
                       i.rental_rate_per_period, i.is_rentable, i.is_saleable
                FROM items i
                LEFT JOIN brands b ON i.brand_id = b.id
                LEFT JOIN categories c ON i.category_id = c.id
                WHERE i.is_active = true
                ORDER BY i.item_name
                LIMIT 10
            """))
            
            print(f"\n📋 Sample Items:")
            for row in result:
                brand_name = row.brand_name or "No Brand"
                category_name = row.category_name or "No Category"
                rate_info = f"${float(row.rental_rate_per_period):.2f}/period" if row.rental_rate_per_period else "No rate"
                item_type = "Rentable" if row.is_rentable else "Saleable" if row.is_saleable else "Other"
                print(f"   • {row.sku}: {row.item_name}")
                print(f"     Brand: {brand_name} | Category: {category_name}")
                print(f"     Type: {item_type} | Rate: {rate_info}")
            
            # Show items requiring serial numbers
            result = await session.execute(text("""
                SELECT COUNT(*) as count
                FROM items 
                WHERE is_active = true 
                AND serial_number_required = true
            """))
            
            serial_count = result.scalar()
            print(f"\n🔢 Items requiring serial numbers: {serial_count}")
            
        except Exception as e:
            print(f"❌ Items verification failed: {e}")

if __name__ == "__main__":
    async def main():
        success = await migrate_items()
        if success:
            await verify_items_migration()
            print("\n✅ Items migration completed successfully!")
        else:
            print("\n❌ Items migration failed!")
    
    asyncio.run(main())