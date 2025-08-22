#!/usr/bin/env python3
"""
Quick data seeding script for testing purchases
"""

import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def seed_data():
    """Seed minimum data for purchase testing"""
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Check if data already exists
            result = await session.execute(text("SELECT COUNT(*) FROM suppliers"))
            supplier_count = result.scalar()
            
            if supplier_count == 0:
                print("📦 Creating test supplier...")
                supplier_id = str(uuid.uuid4())
                await session.execute(text("""
                    INSERT INTO suppliers (id, name, contact_person, email, phone, address, is_active, created_at, updated_at)
                    VALUES (:id, :name, :contact, :email, :phone, :address, true, :now, :now)
                """), {
                    "id": supplier_id,
                    "name": "Test Supplier Inc",
                    "contact": "John Doe",
                    "email": "supplier@test.com",
                    "phone": "555-0100",
                    "address": "123 Supply Street",
                    "now": datetime.utcnow()
                })
                print(f"  ✅ Supplier created: {supplier_id}")
            
            # Check locations
            result = await session.execute(text("SELECT COUNT(*) FROM locations"))
            location_count = result.scalar()
            
            if location_count == 0:
                print("📍 Creating test location...")
                location_id = str(uuid.uuid4())
                await session.execute(text("""
                    INSERT INTO locations (id, name, address, is_active, location_type, created_at, updated_at)
                    VALUES (:id, :name, :address, true, 'WAREHOUSE', :now, :now)
                """), {
                    "id": location_id,
                    "name": "Main Warehouse",
                    "address": "456 Storage Blvd",
                    "now": datetime.utcnow()
                })
                print(f"  ✅ Location created: {location_id}")
            
            # Check categories
            result = await session.execute(text("SELECT COUNT(*) FROM categories"))
            category_count = result.scalar()
            
            if category_count == 0:
                print("📂 Creating test category...")
                category_id = str(uuid.uuid4())
                await session.execute(text("""
                    INSERT INTO categories (id, name, code, is_active, created_at, updated_at)
                    VALUES (:id, :name, :code, true, :now, :now)
                """), {
                    "id": category_id,
                    "name": "Electronics",
                    "code": "ELEC",
                    "now": datetime.utcnow()
                })
                print(f"  ✅ Category created: {category_id}")
            else:
                # Get existing category
                result = await session.execute(text("SELECT id FROM categories LIMIT 1"))
                category_id = result.scalar()
            
            # Check brands
            result = await session.execute(text("SELECT COUNT(*) FROM brands"))
            brand_count = result.scalar()
            
            if brand_count == 0:
                print("🏷️ Creating test brand...")
                brand_id = str(uuid.uuid4())
                await session.execute(text("""
                    INSERT INTO brands (id, name, code, is_active, created_at, updated_at)
                    VALUES (:id, :name, :code, true, :now, :now)
                """), {
                    "id": brand_id,
                    "name": "TestBrand",
                    "code": "TB",
                    "now": datetime.utcnow()
                })
                print(f"  ✅ Brand created: {brand_id}")
            else:
                # Get existing brand
                result = await session.execute(text("SELECT id FROM brands LIMIT 1"))
                brand_id = result.scalar()
            
            # Check units
            result = await session.execute(text("SELECT COUNT(*) FROM units_of_measurement"))
            unit_count = result.scalar()
            
            if unit_count == 0:
                print("📏 Creating test unit...")
                unit_id = str(uuid.uuid4())
                await session.execute(text("""
                    INSERT INTO units_of_measurement (id, name, code, is_active, created_at, updated_at)
                    VALUES (:id, :name, :code, true, :now, :now)
                """), {
                    "id": unit_id,
                    "name": "Piece",
                    "code": "PC",
                    "now": datetime.utcnow()
                })
                print(f"  ✅ Unit created: {unit_id}")
            else:
                # Get existing unit
                result = await session.execute(text("SELECT id FROM units_of_measurement LIMIT 1"))
                unit_id = result.scalar()
            
            # Check items
            result = await session.execute(text("SELECT COUNT(*) FROM items"))
            item_count = result.scalar()
            
            if item_count == 0:
                print("🛒 Creating test items...")
                for i in range(3):
                    item_id = str(uuid.uuid4())
                    sku = f"TEST-{str(i+1).zfill(4)}"
                    await session.execute(text("""
                        INSERT INTO items (
                            id, sku, item_name, item_status, 
                            category_id, brand_id, unit_of_measurement_id,
                            purchase_price, sale_price, rental_rate_per_period,
                            is_serialized, is_active, reorder_point,
                            created_at, updated_at
                        )
                        VALUES (
                            :id, :sku, :name, 'AVAILABLE',
                            :cat_id, :brand_id, :unit_id,
                            100.00, 150.00, 25.00,
                            false, true, 10,
                            :now, :now
                        )
                    """), {
                        "id": item_id,
                        "sku": sku,
                        "name": f"Test Item {i+1}",
                        "cat_id": category_id,
                        "brand_id": brand_id,
                        "unit_id": unit_id,
                        "now": datetime.utcnow()
                    })
                    print(f"  ✅ Item created: {sku}")
            
            await session.commit()
            print("\n✅ Data seeding completed successfully!")
            
        except Exception as e:
            print(f"❌ Error seeding data: {e}")
            await session.rollback()
            raise
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_data())