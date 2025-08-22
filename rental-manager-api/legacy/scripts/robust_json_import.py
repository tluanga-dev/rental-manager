#!/usr/bin/env python3
"""
Robust JSON Data Import with separate transactions per entity type
Handles errors gracefully and continues importing other entities
"""

import asyncio
import json
import sys
from pathlib import Path
from decimal import Decimal
from uuid import uuid4
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.database import AsyncSessionLocal, engine


class RobustJSONImporter:
    def __init__(self):
        self.data_path = Path(__file__).parent.parent / "dummy_data"
        self.stats = {
            'units': {'imported': 0, 'errors': 0},
            'brands': {'imported': 0, 'errors': 0},
            'categories': {'imported': 0, 'errors': 0},
            'locations': {'imported': 0, 'errors': 0},
            'suppliers': {'imported': 0, 'errors': 0},
            'customers': {'imported': 0, 'errors': 0},
            'items': {'imported': 0, 'errors': 0}
        }
        
    def load_json(self, filename):
        filepath = self.data_path / filename
        if filepath.exists():
            with open(filepath, 'r') as f:
                return json.load(f)
        return []
    
    async def import_units(self):
        """Import units in a separate transaction"""
        async with AsyncSessionLocal() as session:
            try:
                print("\n📏 Importing Units...")
                units_data = self.load_json("units.json")
                
                for unit in units_data:
                    try:
                        await session.execute(text("""
                            INSERT INTO units_of_measurement (id, name, code, description, is_active, created_at, updated_at)
                            VALUES (:id, :name, :code, :description, true, now(), now())
                            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
                        """), {
                            'id': str(uuid4()),
                            'name': unit['name'],
                            'code': unit['code'],
                            'description': unit.get('description', '')
                        })
                        self.stats['units']['imported'] += 1
                    except Exception as e:
                        self.stats['units']['errors'] += 1
                        print(f"  ❌ Error: unit {unit.get('code', 'unknown')}: {str(e)[:100]}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['units']['imported']} units ({self.stats['units']['errors']} errors)")
                
            except Exception as e:
                await session.rollback()
                print(f"  ❌ Failed to import units: {e}")
    
    async def import_brands(self):
        """Import brands in a separate transaction"""
        async with AsyncSessionLocal() as session:
            try:
                print("\n🏷️ Importing Brands...")
                brands_data = self.load_json("brands.json")
                
                # Track used codes to avoid duplicates
                used_codes = set()
                
                for brand in brands_data:
                    try:
                        # Generate unique code from name if not present
                        code = brand.get('code')
                        if not code:
                            # Take first 3 chars and make unique
                            base_code = ''.join(c for c in brand['name'][:10] if c.isalnum()).upper()[:3]
                            code = base_code
                            counter = 1
                            while code in used_codes:
                                code = f"{base_code}{counter}"
                                counter += 1
                        
                        used_codes.add(code)
                        
                        await session.execute(text("""
                            INSERT INTO brands (id, name, code, description, is_active, created_at, updated_at)
                            VALUES (:id, :name, :code, :description, true, now(), now())
                            ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
                        """), {
                            'id': str(uuid4()),
                            'name': brand['name'],
                            'code': code,
                            'description': brand.get('description', '')
                        })
                        self.stats['brands']['imported'] += 1
                    except Exception as e:
                        self.stats['brands']['errors'] += 1
                        print(f"  ❌ Error: brand {brand.get('name', 'unknown')}: {str(e)[:100]}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['brands']['imported']} brands ({self.stats['brands']['errors']} errors)")
                
            except Exception as e:
                await session.rollback()
                print(f"  ❌ Failed to import brands: {e}")
    
    async def import_locations(self):
        """Import locations in a separate transaction"""
        async with AsyncSessionLocal() as session:
            try:
                print("\n📍 Importing Locations...")
                locations_data = self.load_json("locations.json")
                
                for loc in locations_data:
                    try:
                        await session.execute(text("""
                            INSERT INTO locations (id, location_code, location_name, location_type, 
                                                 address, city, state, postal_code, country, 
                                                 contact_number, email, is_active, created_at, updated_at)
                            VALUES (:id, :code, :name, :type, :address, :city, :state, :postal, 
                                  :country, :contact, :email, true, now(), now())
                            ON CONFLICT (location_code) DO UPDATE SET location_name = EXCLUDED.location_name
                        """), {
                            'id': str(uuid4()),
                            'code': loc['location_code'],
                            'name': loc['location_name'],
                            'type': loc.get('location_type', 'WAREHOUSE'),
                            'address': loc.get('address'),
                            'city': loc.get('city'),
                            'state': loc.get('state'),
                            'postal': loc.get('postal_code'),
                            'country': loc.get('country'),
                            'contact': loc.get('contact_number'),
                            'email': loc.get('email')
                        })
                        self.stats['locations']['imported'] += 1
                    except Exception as e:
                        self.stats['locations']['errors'] += 1
                        print(f"  ❌ Error: location {loc.get('location_code', 'unknown')}: {str(e)[:100]}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['locations']['imported']} locations ({self.stats['locations']['errors']} errors)")
                
            except Exception as e:
                await session.rollback()
                print(f"  ❌ Failed to import locations: {e}")
    
    async def import_categories(self):
        """Import categories in a separate transaction"""
        async with AsyncSessionLocal() as session:
            try:
                print("\n📂 Importing Categories...")
                categories_data = self.load_json("categories.json")
                
                # Create a mapping of codes to IDs for parent lookups
                category_ids = {}
                
                # First pass - root categories
                for cat in categories_data:
                    if cat.get('parent_category_id') is None:
                        try:
                            cat_id = str(uuid4())
                            await session.execute(text("""
                                INSERT INTO categories (id, category_code, name, category_path, 
                                                      category_level, display_order, is_leaf, 
                                                      is_active, created_at, updated_at)
                                VALUES (:id, :code, :name, :path, :level, :order, :leaf, 
                                      true, now(), now())
                                ON CONFLICT (category_code) DO UPDATE SET name = EXCLUDED.name
                                RETURNING id
                            """), {
                                'id': cat_id,
                                'code': cat['category_code'],
                                'name': cat['name'],
                                'path': cat.get('category_path', cat['name']),
                                'level': cat.get('category_level', 1),
                                'order': cat.get('display_order', 0),
                                'leaf': cat.get('is_leaf', False)
                            })
                            category_ids[cat['category_code']] = cat_id
                            self.stats['categories']['imported'] += 1
                        except Exception as e:
                            self.stats['categories']['errors'] += 1
                            print(f"  ❌ Error: root category {cat.get('name', 'unknown')}: {str(e)[:100]}")
                
                await session.commit()
                
                # Second pass - child categories
                for cat in categories_data:
                    if cat.get('parent_category_id') is not None:
                        try:
                            parent_id = category_ids.get(cat['parent_category_id'])
                            if not parent_id:
                                # Try to find parent in database
                                result = await session.execute(text(
                                    "SELECT id FROM categories WHERE category_code = :code"
                                ), {'code': cat['parent_category_id']})
                                parent = result.first()
                                if parent:
                                    parent_id = parent[0]
                            
                            if parent_id:
                                await session.execute(text("""
                                    INSERT INTO categories (id, category_code, name, parent_category_id,
                                                          category_path, category_level, display_order, 
                                                          is_leaf, is_active, created_at, updated_at)
                                    VALUES (:id, :code, :name, :parent, :path, :level, :order, 
                                          :leaf, true, now(), now())
                                    ON CONFLICT (category_code) DO UPDATE SET name = EXCLUDED.name
                                """), {
                                    'id': str(uuid4()),
                                    'code': cat['category_code'],
                                    'name': cat['name'],
                                    'parent': parent_id,
                                    'path': cat.get('category_path', cat['name']),
                                    'level': cat.get('category_level', 2),
                                    'order': cat.get('display_order', 0),
                                    'leaf': cat.get('is_leaf', True)
                                })
                                self.stats['categories']['imported'] += 1
                            else:
                                print(f"  ⚠️  Parent not found for {cat['name']}")
                                self.stats['categories']['errors'] += 1
                        except Exception as e:
                            self.stats['categories']['errors'] += 1
                            print(f"  ❌ Error: child category {cat.get('name', 'unknown')}: {str(e)[:100]}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['categories']['imported']} categories ({self.stats['categories']['errors']} errors)")
                
            except Exception as e:
                await session.rollback()
                print(f"  ❌ Failed to import categories: {e}")
    
    async def import_customers(self):
        """Import customers in a separate transaction"""
        async with AsyncSessionLocal() as session:
            try:
                print("\n👥 Importing Customers...")
                customers_data = self.load_json("customers.json")
                
                for cust in customers_data:
                    try:
                        await session.execute(text("""
                            INSERT INTO customers (id, customer_code, customer_type, business_name,
                                                 first_name, last_name, email, phone, mobile,
                                                 address_line1, address_line2, city, state, country,
                                                 postal_code, tax_number, payment_terms, customer_tier,
                                                 credit_limit, status, blacklist_status, credit_rating,
                                                 notes, is_active, created_at, updated_at)
                            VALUES (:id, :code, :type, :business, :first, :last, :email, :phone, 
                                  :mobile, :addr1, :addr2, :city, :state, :country, :postal,
                                  :tax, :terms, :tier, :limit, :status, :blacklist, :rating,
                                  :notes, true, now(), now())
                            ON CONFLICT (customer_code) DO NOTHING
                        """), {
                            'id': str(uuid4()),
                            'code': cust['customer_code'],
                            'type': cust.get('customer_type', 'INDIVIDUAL'),
                            'business': cust.get('business_name'),
                            'first': cust.get('first_name'),
                            'last': cust.get('last_name'),
                            'email': cust.get('email'),
                            'phone': cust.get('phone'),
                            'mobile': cust.get('mobile'),
                            'addr1': cust.get('address_line1'),
                            'addr2': cust.get('address_line2'),
                            'city': cust.get('city'),
                            'state': cust.get('state'),
                            'country': cust.get('country'),
                            'postal': cust.get('postal_code'),
                            'tax': cust.get('tax_number'),
                            'terms': cust.get('payment_terms'),
                            'tier': cust.get('customer_tier', 'BRONZE'),
                            'limit': float(cust.get('credit_limit', 0)),
                            'status': cust.get('status', 'ACTIVE'),
                            'blacklist': cust.get('blacklist_status', 'CLEAR'),
                            'rating': cust.get('credit_rating', 'GOOD'),
                            'notes': cust.get('notes')
                        })
                        self.stats['customers']['imported'] += 1
                    except Exception as e:
                        self.stats['customers']['errors'] += 1
                        print(f"  ❌ Error: customer {cust.get('customer_code', 'unknown')}: {str(e)[:100]}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['customers']['imported']} customers ({self.stats['customers']['errors']} errors)")
                
            except Exception as e:
                await session.rollback()
                print(f"  ❌ Failed to import customers: {e}")
    
    async def import_suppliers(self):
        """Import suppliers in a separate transaction"""
        async with AsyncSessionLocal() as session:
            try:
                print("\n🏢 Importing Suppliers...")
                suppliers_data = self.load_json("suppliers.json")
                
                for supp in suppliers_data:
                    try:
                        await session.execute(text("""
                            INSERT INTO suppliers (id, supplier_code, company_name, supplier_type,
                                                 contact_person, email, phone, mobile,
                                                 address_line1, address_line2, city, state, country,
                                                 postal_code, tax_id, payment_terms, credit_limit,
                                                 supplier_tier, status, quality_rating, delivery_rating,
                                                 notes, website, account_manager, preferred_payment_method,
                                                 certifications, is_active, created_at, updated_at)
                            VALUES (:id, :code, :company, :type, :contact, :email, :phone, :mobile,
                                  :addr1, :addr2, :city, :state, :country, :postal, :tax,
                                  :terms, :limit, :tier, :status, :quality, :delivery,
                                  :notes, :website, :manager, :payment, :certs,
                                  true, now(), now())
                            ON CONFLICT (supplier_code) DO NOTHING
                        """), {
                            'id': str(uuid4()),
                            'code': supp['supplier_code'],
                            'company': supp['company_name'],
                            'type': supp.get('supplier_type', 'GENERAL'),
                            'contact': supp.get('contact_person'),
                            'email': supp.get('email'),
                            'phone': supp.get('phone'),
                            'mobile': supp.get('mobile'),
                            'addr1': supp.get('address_line1'),
                            'addr2': supp.get('address_line2'),
                            'city': supp.get('city'),
                            'state': supp.get('state'),
                            'country': supp.get('country'),
                            'postal': supp.get('postal_code'),
                            'tax': supp.get('tax_id'),
                            'terms': supp.get('payment_terms', 'NET30'),
                            'limit': float(supp.get('credit_limit', 0)),
                            'tier': supp.get('supplier_tier', 'STANDARD'),
                            'status': supp.get('status', 'ACTIVE'),
                            'quality': float(supp.get('quality_rating', 0)) if supp.get('quality_rating') else None,
                            'delivery': float(supp.get('delivery_rating', 0)) if supp.get('delivery_rating') else None,
                            'notes': supp.get('notes'),
                            'website': supp.get('website'),
                            'manager': supp.get('account_manager'),
                            'payment': supp.get('preferred_payment_method'),
                            'certs': supp.get('certifications')
                        })
                        self.stats['suppliers']['imported'] += 1
                    except Exception as e:
                        self.stats['suppliers']['errors'] += 1
                        print(f"  ❌ Error: supplier {supp.get('supplier_code', 'unknown')}: {str(e)[:100]}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['suppliers']['imported']} suppliers ({self.stats['suppliers']['errors']} errors)")
                
            except Exception as e:
                await session.rollback()
                print(f"  ❌ Failed to import suppliers: {e}")
    
    async def import_items(self):
        """Import items in a separate transaction"""
        async with AsyncSessionLocal() as session:
            try:
                print("\n📦 Importing Items...")
                items_data = self.load_json("items_enhanced_250.json")
                
                for idx, item in enumerate(items_data):
                    try:
                        # Get foreign key IDs
                        unit_result = await session.execute(text(
                            "SELECT id FROM units_of_measurement WHERE code = :code"
                        ), {'code': item.get('unit_of_measurement_code', 'pcs')})
                        unit = unit_result.first()
                        
                        brand_result = await session.execute(text(
                            "SELECT id FROM brands WHERE code = :code OR name = :name LIMIT 1"
                        ), {'code': item.get('brand_code', ''), 'name': item.get('brand_name', '')})
                        brand = brand_result.first()
                        
                        cat_result = await session.execute(text(
                            "SELECT id FROM categories WHERE category_code = :code"
                        ), {'code': item.get('category_code', '')})
                        category = cat_result.first()
                        
                        if unit:
                            await session.execute(text("""
                                INSERT INTO items (id, sku, item_name, item_status,
                                                 unit_of_measurement_id, brand_id, category_id,
                                                 model_number, description, specifications,
                                                 rental_rate_per_period, rental_period,
                                                 sale_price, purchase_price, security_deposit,
                                                 warranty_period_days, reorder_point,
                                                 is_rentable, is_saleable, serial_number_required,
                                                 is_active, created_at, updated_at)
                                VALUES (:id, :sku, :name, :status, :unit, :brand, :category,
                                      :model, :desc, :specs, :rental_rate, :rental_period,
                                      :sale, :purchase, :deposit, :warranty, :reorder,
                                      :rentable, :saleable, :serial, true, now(), now())
                                ON CONFLICT (sku) DO NOTHING
                            """), {
                                'id': str(uuid4()),
                                'sku': item['sku'],
                                'name': item['item_name'],
                                'status': item.get('item_status', 'ACTIVE'),
                                'unit': unit[0] if unit else None,
                                'brand': brand[0] if brand else None,
                                'category': category[0] if category else None,
                                'model': item.get('model_number'),
                                'desc': item.get('description'),
                                'specs': item.get('specifications'),
                                'rental_rate': float(item.get('rental_rate_per_period', 0)),
                                'rental_period': item.get('rental_period', '1'),
                                'sale': float(item.get('sale_price', 0)) if item.get('sale_price') else None,
                                'purchase': float(item.get('purchase_price', 0)),
                                'deposit': float(item.get('security_deposit', 0)),
                                'warranty': item.get('warranty_period_days', '0'),
                                'reorder': int(item.get('reorder_point', 0)),
                                'rentable': item.get('is_rentable', True),
                                'saleable': item.get('is_saleable', False),
                                'serial': item.get('serial_number_required', False)
                            })
                            self.stats['items']['imported'] += 1
                            
                            if (idx + 1) % 25 == 0:
                                print(f"    Processed {idx + 1} items...")
                        else:
                            self.stats['items']['errors'] += 1
                            print(f"  ⚠️  No unit found for item {item['sku']}")
                                
                    except Exception as e:
                        self.stats['items']['errors'] += 1
                        print(f"  ❌ Error: item {item.get('sku', 'unknown')}: {str(e)[:100]}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['items']['imported']} items ({self.stats['items']['errors']} errors)")
                
            except Exception as e:
                await session.rollback()
                print(f"  ❌ Failed to import items: {e}")
    
    async def import_all(self):
        """Import all data types"""
        print("🚀 Starting Robust JSON Import...")
        print("=" * 50)
        
        # Import in dependency order
        await self.import_units()
        await self.import_brands()
        await self.import_locations()
        await self.import_categories()
        await self.import_customers()
        await self.import_suppliers()
        await self.import_items()
        
        # Print summary
        print("\n" + "=" * 50)
        print("🎉 Import Complete!")
        print("=" * 50)
        
        total_imported = 0
        total_errors = 0
        
        for entity, stats in self.stats.items():
            imported = stats['imported']
            errors = stats['errors']
            total_imported += imported
            total_errors += errors
            
            status = "✅" if errors == 0 else "⚠️" if imported > 0 else "❌"
            print(f"{status} {entity.capitalize()}: {imported} imported, {errors} errors")
        
        print(f"\n📊 Total: {total_imported} records imported, {total_errors} errors")
        
        return total_imported > 0


async def main():
    try:
        importer = RobustJSONImporter()
        success = await importer.import_all()
        return 0 if success else 1
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return 1
    finally:
        await engine.dispose()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)