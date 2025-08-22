#!/usr/bin/env python3
"""
Create 100 diverse items for the rental management system
"""
import asyncio
import sys
import os
import uuid
import random
from pathlib import Path
from decimal import Decimal

# Add the backend root directory to Python path
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

from sqlalchemy import text
from app.core.database import AsyncSessionLocal

# Item data templates organized by category
ITEM_TEMPLATES = {
    'CON-EXC': {  # Excavators
        'items': [
            {'name': 'Mini Excavator', 'models': ['320E', '315F', '308E2', '305.5E2', '303.5E2'], 'price_range': (35000, 95000), 'rental_range': (145, 320), 'weight_range': (1800, 6000)},
            {'name': 'Standard Excavator', 'models': ['320D', '330D', '336F', '349F', '374F'], 'price_range': (125000, 450000), 'rental_range': (385, 895), 'weight_range': (18000, 75000)},
            {'name': 'Compact Excavator', 'models': ['E26', 'E35', 'E42', 'E50', 'E63'], 'price_range': (42000, 78000), 'rental_range': (165, 285), 'weight_range': (2600, 6300)},
        ]
    },
    'CON-BUL': {  # Bulldozers
        'items': [
            {'name': 'Crawler Dozer', 'models': ['D6T', 'D7E', 'D8T', 'D9T', 'D10T'], 'price_range': (285000, 950000), 'rental_range': (685, 1850), 'weight_range': (18500, 54000)},
            {'name': 'Compact Dozer', 'models': ['D3K2', 'D4K2', 'D5K2'], 'price_range': (165000, 285000), 'rental_range': (425, 695), 'weight_range': (8500, 12500)},
        ]
    },
    'CON-CRN': {  # Cranes
        'items': [
            {'name': 'Mobile Crane', 'models': ['RT540E', 'RT765E-2', 'RT890E'], 'price_range': (425000, 875000), 'rental_range': (895, 1650), 'weight_range': (36000, 58000)},
            {'name': 'Tower Crane', 'models': ['MDT178', 'MDT219', 'MDT259'], 'price_range': (650000, 1250000), 'rental_range': (1285, 2450), 'weight_range': (12000, 18000)},
            {'name': 'Crawler Crane', 'models': ['CC-2800-1', 'CC-3800-1', 'CC-6800'], 'price_range': (850000, 2500000), 'rental_range': (1850, 4250), 'weight_range': (280000, 680000)},
        ]
    },
    'CON-FOR': {  # Forklifts & Telehandlers
        'items': [
            {'name': 'Forklift', 'models': ['GC15K-5', 'GC25K-5', 'GC35K-5'], 'price_range': (18500, 45000), 'rental_range': (65, 145), 'weight_range': (1500, 3500)},
            {'name': 'Telehandler', 'models': ['TH255C', 'TH407C', 'TH514C'], 'price_range': (95000, 185000), 'rental_range': (185, 385), 'weight_range': (5500, 14000)},
            {'name': 'Rough Terrain Forklift', 'models': ['RT25', 'RT40', 'RT60'], 'price_range': (75000, 125000), 'rental_range': (145, 285), 'weight_range': (2500, 6000)},
        ]
    },
    'CON-AWP': {  # Aerial Work Platforms
        'items': [
            {'name': 'Scissor Lift', 'models': ['GS-1930', 'GS-2646', 'GS-3246'], 'price_range': (15000, 35000), 'rental_range': (45, 95), 'weight_range': (1100, 2300)},
            {'name': 'Boom Lift', 'models': ['S-40', 'S-60', 'S-85'], 'price_range': (65000, 145000), 'rental_range': (145, 325), 'weight_range': (6800, 15500)},
            {'name': 'Articulating Boom', 'models': ['A46JE', 'A62JE', 'A80JE'], 'price_range': (85000, 165000), 'rental_range': (185, 385), 'weight_range': (8500, 16800)},
        ]
    },
    'CON-LOD': {  # Loaders
        'items': [
            {'name': 'Wheel Loader', 'models': ['950M', '962M', '972M', '980M'], 'price_range': (185000, 485000), 'rental_range': (385, 895), 'weight_range': (16500, 42000)},
            {'name': 'Skid Steer Loader', 'models': ['226D', '242D', '259D', '272D'], 'price_range': (35000, 65000), 'rental_range': (85, 165), 'weight_range': (2600, 4200)},
            {'name': 'Track Loader', 'models': ['279D', '289D', '299D'], 'price_range': (45000, 85000), 'rental_range': (125, 225), 'weight_range': (3900, 6800)},
        ]
    },
    'PWR': {  # Power & Electrical Tools
        'items': [
            {'name': 'Generator', 'models': ['C4.4', 'C7.1', 'C9'], 'price_range': (8500, 25000), 'rental_range': (25, 75), 'weight_range': (450, 1200)},
            {'name': 'Compressor', 'models': ['XAS 185', 'XAS 375', 'XAS 750'], 'price_range': (12500, 45000), 'rental_range': (35, 125), 'weight_range': (850, 2500)},
            {'name': 'Light Tower', 'models': ['VT1', 'VT3', 'VT8'], 'price_range': (15000, 35000), 'rental_range': (45, 95), 'weight_range': (680, 1500)},
        ]
    },
    'CLN': {  # Cleaning & Sanitation Equipment
        'items': [
            {'name': 'Pressure Washer', 'models': ['PW3000', 'PW4000', 'PW5000'], 'price_range': (2500, 8500), 'rental_range': (15, 45), 'weight_range': (85, 250)},
            {'name': 'Floor Scrubber', 'models': ['T300e', 'T500e', 'T700e'], 'price_range': (8500, 25000), 'rental_range': (35, 85), 'weight_range': (180, 450)},
            {'name': 'Carpet Cleaner', 'models': ['CC100', 'CC200', 'CC300'], 'price_range': (3500, 12500), 'rental_range': (25, 65), 'weight_range': (45, 125)},
        ]
    },
    'CAT-COOK': {  # Cooking Equipment
        'items': [
            {'name': 'Commercial Oven', 'models': ['CO600', 'CO800', 'CO1200'], 'price_range': (15000, 45000), 'rental_range': (85, 225), 'weight_range': (450, 850)},
            {'name': 'Griddle', 'models': ['G24', 'G36', 'G48'], 'price_range': (8500, 18500), 'rental_range': (45, 95), 'weight_range': (125, 285)},
            {'name': 'Fryer', 'models': ['F35', 'F50', 'F75'], 'price_range': (6500, 15000), 'rental_range': (35, 75), 'weight_range': (85, 185)},
        ]
    },
    'EVT-AUD': {  # Audio Equipment
        'items': [
            {'name': 'PA System', 'models': ['PA500', 'PA1000', 'PA2000'], 'price_range': (2500, 8500), 'rental_range': (25, 65), 'weight_range': (25, 85)},
            {'name': 'Microphone System', 'models': ['MS4', 'MS8', 'MS16'], 'price_range': (1500, 4500), 'rental_range': (15, 35), 'weight_range': (5, 15)},
            {'name': 'Mixing Console', 'models': ['MX16', 'MX24', 'MX32'], 'price_range': (3500, 12500), 'rental_range': (35, 85), 'weight_range': (15, 45)},
        ]
    }
}

# Brand categories for realistic assignment
BRAND_CATEGORIES = {
    'construction': ['CAT', 'JD', 'KOM', 'VOLVO', 'LIEBH', 'HIT', 'HYU', 'JCB', 'CASE', 'NH', 'BOB', 'KUB', 'TAKE', 'YAN', 'DOO'],
    'tools': ['MAK', 'DEW', 'MIL', 'BOS', 'HIL'],
    'catering': ['WEB', 'VIK', 'HOB', 'VUL', 'GAR', 'TRUE', 'BEV', 'TRA', 'CAM', 'VOL', 'CDD'],
    'events': ['PRP', 'EPR', 'YAM', 'JBL', 'SHU', 'QSC', 'CHU']
}

async def get_reference_data():
    """Get brands, categories, and units from database"""
    async with AsyncSessionLocal() as session:
        # Get brands
        result = await session.execute(text("SELECT id, code, name FROM brands WHERE is_active = true"))
        brands = {row.code: {'id': row.id, 'name': row.name} for row in result}
        
        # Get categories
        result = await session.execute(text("SELECT id, category_code, name FROM categories WHERE is_active = true"))
        categories = {row.category_code: {'id': row.id, 'name': row.name} for row in result}
        
        # Get units
        result = await session.execute(text("SELECT id, code, name FROM units_of_measurement WHERE is_active = true"))
        units = {row.code: {'id': row.id, 'name': row.name} for row in result}
        
        return brands, categories, units

def generate_sku(category_code, brand_code, model, sequence):
    """Generate a unique SKU"""
    return f"{brand_code}-{model.replace(' ', '').replace('.', '').replace('-', '')}-{sequence:03d}"

def get_suitable_brands(category_code, brands):
    """Get suitable brands for a category"""
    if category_code.startswith('CON-'):
        return [code for code in BRAND_CATEGORIES['construction'] if code in brands]
    elif category_code == 'PWR' or category_code == 'CLN':
        return [code for code in BRAND_CATEGORIES['tools'] if code in brands]
    elif category_code.startswith('CAT-'):
        return [code for code in BRAND_CATEGORIES['catering'] if code in brands]
    elif category_code.startswith('EVT-'):
        return [code for code in BRAND_CATEGORIES['events'] if code in brands]
    else:
        return list(brands.keys())

def generate_description(item_type, model, weight, specs):
    """Generate a realistic description"""
    descriptions = [
        f"Professional {item_type.lower()} model {model} designed for commercial and industrial applications",
        f"Heavy-duty {item_type.lower()} {model} with advanced features and reliable performance",
        f"Commercial-grade {item_type.lower()} {model} ideal for construction and rental operations",
        f"High-performance {item_type.lower()} {model} built for demanding work environments",
        f"Versatile {item_type.lower()} {model} suitable for various commercial applications"
    ]
    
    base_desc = random.choice(descriptions)
    if weight:
        base_desc += f". Operating weight: {weight:,} kg"
    if specs:
        base_desc += f". {specs}"
    
    return base_desc

def generate_specifications(item_type, model, weight):
    """Generate realistic specifications"""
    specs = []
    
    if 'Excavator' in item_type or 'Dozer' in item_type or 'Loader' in item_type:
        if weight:
            if weight < 5000:
                power = random.randint(15, 35)
                dig_depth = round(random.uniform(2.2, 3.5), 1)
                bucket = round(random.uniform(0.08, 0.18), 2)
            elif weight < 15000:
                power = random.randint(30, 80)
                dig_depth = round(random.uniform(3.0, 5.5), 1)
                bucket = round(random.uniform(0.15, 0.45), 2)
            else:
                power = random.randint(75, 250)
                dig_depth = round(random.uniform(5.0, 8.5), 1)
                bucket = round(random.uniform(0.4, 2.2), 2)
            
            specs.append(f"Engine power: {power} kW")
            if 'Excavator' in item_type:
                specs.append(f"Max dig depth: {dig_depth} m")
                specs.append(f"Bucket capacity: {bucket} m³")
    
    elif 'Crane' in item_type:
        if weight:
            capacity = random.randint(15, 800)
            reach = random.randint(25, 85)
            specs.append(f"Lifting capacity: {capacity} tons")
            specs.append(f"Maximum reach: {reach} m")
    
    elif 'Forklift' in item_type or 'Telehandler' in item_type:
        capacity = random.randint(1500, 8000)
        lift_height = round(random.uniform(3.2, 18.5), 1)
        specs.append(f"Lifting capacity: {capacity} kg")
        specs.append(f"Max lift height: {lift_height} m")
    
    elif 'Generator' in item_type:
        power = random.randint(20, 500)
        specs.append(f"Power output: {power} kVA")
        specs.append(f"Fuel type: Diesel")
    
    elif 'Oven' in item_type or 'Fryer' in item_type:
        temp = random.randint(180, 450)
        specs.append(f"Max temperature: {temp}°C")
        specs.append(f"Energy source: Gas/Electric")
    
    return ", ".join(specs) if specs else None

async def create_100_items():
    """Create 100 diverse items"""
    print("🚀 Starting creation of 100 diverse items...")
    
    # Get reference data
    brands, categories, units = await get_reference_data()
    print(f"📋 Loaded {len(brands)} brands, {len(categories)} categories, {len(units)} units")
    
    # Get unit IDs
    pcs_unit_id = units.get('pcs', {}).get('id')
    if not pcs_unit_id:
        print("❌ 'pcs' unit not found!")
        return False
    
    async with AsyncSessionLocal() as session:
        try:
            created_count = 0
            failed_count = 0
            
            # Clear existing items
            result = await session.execute(text("SELECT COUNT(*) FROM items"))
            existing_count = result.scalar()
            if existing_count > 0:
                print(f"🧹 Clearing {existing_count} existing items...")
                await session.execute(text("DELETE FROM items"))
                print("✅ Existing items cleared")
            
            # Generate items for each category
            item_sequence = 1
            
            for category_code, template_data in ITEM_TEMPLATES.items():
                if category_code not in categories:
                    print(f"⚠️  Category {category_code} not found, skipping...")
                    continue
                
                category_id = categories[category_code]['id']
                suitable_brands = get_suitable_brands(category_code, brands)
                
                if not suitable_brands:
                    print(f"⚠️  No suitable brands for category {category_code}")
                    continue
                
                # Generate items for this category
                items_per_category = min(12, 100 // len(ITEM_TEMPLATES))  # Distribute evenly
                
                for _ in range(items_per_category):
                    if created_count >= 100:
                        break
                    
                    # Create a savepoint for each item
                    savepoint = await session.begin_nested()
                    try:
                        # Select random item template
                        item_template = random.choice(template_data['items'])
                        
                        # Select random brand and model
                        brand_code = random.choice(suitable_brands)
                        brand_id = brands[brand_code]['id']
                        model = random.choice(item_template['models'])
                        
                        # Generate item details
                        item_name = f"{brands[brand_code]['name']} {model} {item_template['name']}"
                        sku = generate_sku(category_code, brand_code, model, item_sequence)
                        
                        # Generate pricing
                        purchase_price = random.randint(*item_template['price_range'])
                        rental_rate = random.randint(*item_template['rental_range'])
                        security_deposit = max(100, int(rental_rate * random.uniform(3, 8)))
                        
                        # Generate weight and specs
                        weight = random.randint(*item_template['weight_range']) if 'weight_range' in item_template else None
                        specifications = generate_specifications(item_template['name'], model, weight)
                        description = generate_description(item_template['name'], model, weight, specifications)
                        
                        # Generate other attributes
                        warranty_days = random.choice([30, 60, 90, 180, 365])
                        reorder_point = random.randint(1, 5)
                        rental_period = random.choice(['1', '7', '30'])  # daily, weekly, monthly
                        
                        # Insert item
                        item_id = uuid.uuid4()
                        insert_query = text("""
                            INSERT INTO items (
                                id, sku, item_name, item_status, brand_id, category_id, 
                                unit_of_measurement_id, rental_rate_per_period, rental_period,
                                sale_price, purchase_price, security_deposit, description,
                                specifications, model_number, serial_number_required,
                                warranty_period_days, reorder_point, is_rentable, is_saleable, is_active
                            ) VALUES (
                                :id, :sku, :item_name, :item_status, :brand_id, :category_id,
                                :unit_of_measurement_id, :rental_rate_per_period, :rental_period,
                                :sale_price, :purchase_price, :security_deposit, :description,
                                :specifications, :model_number, :serial_number_required,
                                :warranty_period_days, :reorder_point, :is_rentable, :is_saleable, :is_active
                            )
                        """)
                        
                        await session.execute(insert_query, {
                            'id': item_id,
                            'sku': sku,
                            'item_name': item_name,
                            'item_status': 'ACTIVE',
                            'brand_id': brand_id,
                            'category_id': category_id,
                            'unit_of_measurement_id': pcs_unit_id,
                            'rental_rate_per_period': Decimal(str(rental_rate)),
                            'rental_period': rental_period,
                            'sale_price': None,
                            'purchase_price': Decimal(str(purchase_price)),
                            'security_deposit': Decimal(str(security_deposit)),
                            'description': description,
                            'specifications': specifications,
                            'model_number': model,
                            'serial_number_required': random.choice([True, False]),
                            'warranty_period_days': str(warranty_days),
                            'reorder_point': reorder_point,
                            'is_rentable': True,
                            'is_saleable': False,
                            'is_active': True
                        })
                        
                        await savepoint.commit()
                        created_count += 1
                        item_sequence += 1
                        
                        # Show progress
                        if created_count % 10 == 0:
                            print(f"✅ Created {created_count} items...")
                        
                    except Exception as e:
                        await savepoint.rollback()
                        print(f"❌ Error creating item {item_sequence}: {e}")
                        failed_count += 1
                        item_sequence += 1
                        continue
                    
                    if created_count >= 100:
                        break
            
            # Commit all changes
            await session.commit()
            print(f"\n🎉 Successfully created {created_count} items!")
            
            # Show summary statistics
            print(f"\n📊 Creation Summary:")
            print(f"   • Total items created: {created_count}")
            print(f"   • Failed creations: {failed_count}")
            print(f"   • Success rate: {(created_count/(created_count+failed_count))*100:.1f}%")
            
            return created_count >= 100
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Item creation failed: {e}")
            return False

async def verify_creation():
    """Verify the item creation was successful"""
    print("\n🔍 Verifying item creation...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Count total items
            result = await session.execute(text("SELECT COUNT(*) FROM items WHERE is_active = true"))
            total_count = result.scalar()
            print(f"✅ Total active items in database: {total_count}")
            
            # Count by category
            result = await session.execute(text("""
                SELECT c.name, COUNT(i.id) as count, 
                       MIN(i.rental_rate_per_period) as min_rate,
                       MAX(i.rental_rate_per_period) as max_rate,
                       ROUND(AVG(i.rental_rate_per_period), 2) as avg_rate
                FROM categories c
                LEFT JOIN items i ON c.id = i.category_id AND i.is_active = true
                WHERE c.is_active = true
                GROUP BY c.name
                HAVING COUNT(i.id) > 0
                ORDER BY count DESC
            """))
            
            print(f"\n📁 Items by Category:")
            for row in result:
                print(f"   • {row.name}: {row.count} items (${row.min_rate}-${row.max_rate}, avg: ${row.avg_rate})")
            
            # Count by brand
            result = await session.execute(text("""
                SELECT b.name, COUNT(i.id) as count
                FROM brands b
                LEFT JOIN items i ON b.id = i.brand_id AND i.is_active = true
                WHERE b.is_active = true
                GROUP BY b.name
                HAVING COUNT(i.id) > 0
                ORDER BY count DESC
                LIMIT 10
            """))
            
            print(f"\n🏷️ Top 10 Brands by Item Count:")
            for row in result:
                print(f"   • {row.name}: {row.count} items")
            
            # Price analysis
            result = await session.execute(text("""
                SELECT 
                    MIN(rental_rate_per_period) as min_rental,
                    MAX(rental_rate_per_period) as max_rental,
                    ROUND(AVG(rental_rate_per_period), 2) as avg_rental,
                    MIN(purchase_price) as min_purchase,
                    MAX(purchase_price) as max_purchase,
                    ROUND(AVG(purchase_price), 2) as avg_purchase
                FROM items 
                WHERE is_active = true
            """))
            
            row = result.fetchone()
            print(f"\n💰 Pricing Analysis:")
            print(f"   • Rental rates: ${row.min_rental} - ${row.max_rental} (avg: ${row.avg_rental})")
            print(f"   • Purchase prices: ${row.min_purchase:,} - ${row.max_purchase:,} (avg: ${row.avg_purchase:,})")
                
        except Exception as e:
            print(f"❌ Verification failed: {e}")

if __name__ == "__main__":
    async def main():
        success = await create_100_items()
        if success:
            await verify_creation()
            print("\n✅ 100 items creation completed successfully!")
        else:
            print("\n❌ 100 items creation failed!")
    
    asyncio.run(main())