#!/usr/bin/env python3
"""
Simple JSON Data Import using raw SQL
Avoids model relationship issues by using direct SQL inserts
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


class SimpleJSONImporter:
    def __init__(self):
        self.data_path = Path(__file__).parent.parent / "dummy_data"
        self.stats = {
            'units': 0,
            'brands': 0,
            'categories': 0,
            'locations': 0,
            'suppliers': 0,
            'customers': 0,
            'items': 0
        }
        
    def load_json(self, filename):
        filepath = self.data_path / filename
        if filepath.exists():
            with open(filepath, 'r') as f:
                return json.load(f)
        return []
    
    async def import_all(self):
        async with AsyncSessionLocal() as session:
            try:
                print("🚀 Starting Simple JSON Import...")
                
                # Import units
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
                        self.stats['units'] += 1
                    except Exception as e:
                        print(f"  Error inserting unit {unit['code']}: {e}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['units']} units")
                
                # Import brands
                print("\n🏷️ Importing Brands...")
                brands_data = self.load_json("brands.json")
                for brand in brands_data:
                    try:
                        # Generate code from name if not present
                        code = brand.get('code')
                        if not code:
                            code = brand['name'][:3].upper()
                        
                        await session.execute(text("""
                            INSERT INTO brands (id, name, code, description, is_active, created_at, updated_at)
                            VALUES (:id, :name, :code, :description, true, now(), now())
                            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
                        """), {
                            'id': str(uuid4()),
                            'name': brand['name'],
                            'code': code,
                            'description': brand.get('description', '')
                        })
                        self.stats['brands'] += 1
                    except Exception as e:
                        print(f"  Error inserting brand {brand['name']}: {e}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['brands']} brands")
                
                # Import locations
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
                        self.stats['locations'] += 1
                    except Exception as e:
                        print(f"  Error inserting location {loc['location_code']}: {e}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['locations']} locations")
                
                # Import categories
                print("\n📂 Importing Categories...")
                categories_data = self.load_json("categories.json")
                
                # First pass - root categories
                for cat in categories_data:
                    if cat.get('parent_category_id') is None:
                        try:
                            await session.execute(text("""
                                INSERT INTO categories (id, category_code, name, category_path, 
                                                      category_level, display_order, is_leaf, 
                                                      is_active, created_at, updated_at)
                                VALUES (:id, :code, :name, :path, :level, :order, :leaf, 
                                      true, now(), now())
                                ON CONFLICT (category_code) DO UPDATE SET name = EXCLUDED.name
                            """), {
                                'id': str(uuid4()),
                                'code': cat['category_code'],
                                'name': cat['name'],
                                'path': cat.get('category_path'),
                                'level': cat.get('category_level', 1),
                                'order': cat.get('display_order', 0),
                                'leaf': cat.get('is_leaf', False)
                            })
                            self.stats['categories'] += 1
                        except Exception as e:
                            print(f"  Error inserting category {cat['name']}: {e}")
                
                # Second pass - child categories
                for cat in categories_data:
                    if cat.get('parent_category_id') is not None:
                        try:
                            # Get parent ID
                            result = await session.execute(text(
                                "SELECT id FROM categories WHERE category_code = :code"
                            ), {'code': cat['parent_category_id']})
                            parent = result.first()
                            
                            if parent:
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
                                    'parent': parent[0],
                                    'path': cat.get('category_path'),
                                    'level': cat.get('category_level', 2),
                                    'order': cat.get('display_order', 0),
                                    'leaf': cat.get('is_leaf', True)
                                })
                                self.stats['categories'] += 1
                        except Exception as e:
                            print(f"  Error inserting category {cat['name']}: {e}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['categories']} categories")
                
                # Import customers
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
                        self.stats['customers'] += 1
                    except Exception as e:
                        print(f"  Error inserting customer {cust['customer_code']}: {e}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['customers']} customers")
                
                # Import suppliers
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
                        self.stats['suppliers'] += 1
                    except Exception as e:
                        print(f"  Error inserting supplier {supp['supplier_code']}: {e}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['suppliers']} suppliers")
                
                # Import items
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
                            "SELECT id FROM brands WHERE code = :code"
                        ), {'code': item.get('brand_code')})
                        brand = brand_result.first()
                        
                        cat_result = await session.execute(text(
                            "SELECT id FROM categories WHERE category_code = :code"
                        ), {'code': item.get('category_code')})
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
                            self.stats['items'] += 1
                            
                            if (idx + 1) % 25 == 0:
                                print(f"    Processed {idx + 1} items...")
                                
                    except Exception as e:
                        print(f"  Error inserting item {item['sku']}: {e}")
                
                await session.commit()
                print(f"  ✅ Imported {self.stats['items']} items")
                
                print("\n🎉 Import Complete!")
                print(f"  Units: {self.stats['units']}")
                print(f"  Brands: {self.stats['brands']}")
                print(f"  Categories: {self.stats['categories']}")
                print(f"  Locations: {self.stats['locations']}")
                print(f"  Customers: {self.stats['customers']}")
                print(f"  Suppliers: {self.stats['suppliers']}")
                print(f"  Items: {self.stats['items']}")
                
            except Exception as e:
                print(f"❌ Import failed: {e}")
                await session.rollback()
                raise


async def main():
    try:
        importer = SimpleJSONImporter()
        await importer.import_all()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())