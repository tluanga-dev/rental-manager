#!/usr/bin/env python3
"""
Seed basic master data for testing
"""
import asyncio
# Import all models to avoid relationship errors
from app.db.all_models import Base
from app.db.session import get_session_context
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.locations.models import Location
from app.modules.master_data.units.models import UnitOfMeasurement
from app.modules.master_data.item_master.models import Item
from app.modules.suppliers.models import Supplier
from app.modules.customers.models import Customer

async def seed_basic_data():
    from sqlalchemy import select
    
    async with get_session_context() as db:
        print("Seeding basic master data...")
        
        # Create Units
        units = [
            {"name": "Piece", "code": "PC", "description": "Individual piece"},
            {"name": "Kilogram", "code": "KG", "description": "Weight in kilograms"},
            {"name": "Meter", "code": "M", "description": "Length in meters"},
        ]
        
        for unit_data in units:
            result = await db.execute(
                select(UnitOfMeasurement).where(UnitOfMeasurement.code == unit_data["code"])
            )
            existing = result.scalar_one_or_none()
            if not existing:
                unit = UnitOfMeasurement(**unit_data)
                db.add(unit)
                print(f"  ✓ Created unit: {unit_data['name']}")
        
        # Create Brands
        brands = [
            {"name": "Dell", "description": "Computer manufacturer"},
            {"name": "HP", "description": "Technology company"},
            {"name": "Canon", "description": "Imaging equipment"},
        ]
        
        for brand_data in brands:
            result = await db.execute(
                select(Brand).where(Brand.name == brand_data["name"])
            )
            existing = result.scalar_one_or_none()
            if not existing:
                brand = Brand(**brand_data)
                db.add(brand)
                print(f"  ✓ Created brand: {brand_data['name']}")
        
        # Create Categories  
        categories = [
            {"name": "Electronics", "category_code": "ELEC"},
            {"name": "Furniture", "category_code": "FURN"},
            {"name": "Office Supplies", "category_code": "OFFC"},
        ]
        
        for cat_data in categories:
            result = await db.execute(
                select(Category).where(Category.category_code == cat_data["category_code"])
            )
            existing = result.scalar_one_or_none()
            if not existing:
                category = Category(**cat_data)
                db.add(category)
                print(f"  ✓ Created category: {cat_data['name']}")
        
        # Create Location
        location_data = {
            "location_name": "Main Warehouse",
            "location_code": "MAIN-WH",
            "location_type": "WAREHOUSE",
            "address": "123 Main St, City, State 12345"
        }
        
        result = await db.execute(
            select(Location).where(Location.location_name == location_data["location_name"])
        )
        existing = result.scalar_one_or_none()
        if not existing:
            location = Location(**location_data)
            db.add(location)
            print(f"  ✓ Created location: {location_data['location_name']}")
        
        # Create Supplier
        supplier_data = {
            "company_name": "Tech Supplies Inc",
            "supplier_code": "SUP001",
            "supplier_type": "DISTRIBUTOR",
            "contact_person": "John Doe",
            "email": "contact@techsupplies.com",
            "phone": "555-0100",
            "address_line1": "456 Business Ave"
        }
        
        result = await db.execute(
            select(Supplier).where(Supplier.company_name == supplier_data["company_name"])
        )
        existing = result.scalar_one_or_none()
        if not existing:
            supplier = Supplier(**supplier_data)
            db.add(supplier)
            print(f"  ✓ Created supplier: {supplier_data['company_name']}")
        
        await db.commit()
        print("\n✅ Basic data seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_basic_data())