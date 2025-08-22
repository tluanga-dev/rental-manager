#!/usr/bin/env python3
"""
Force create all database tables by explicitly importing all models
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import database engine and base
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

# Explicitly import ALL models to ensure they're registered
print("Importing all models...")

# Base model
from app.db.base import Base

# Auth models
from app.modules.auth.models import RefreshToken, LoginAttempt, PasswordResetToken, Role, Permission

# User models  
from app.modules.users.models import User, UserProfile

# Company models
from app.modules.company.models import Company

# Customer models
from app.modules.customers.models import Customer

# Master data models
from app.modules.master_data.brands.models import Brand
from app.modules.master_data.categories.models import Category
from app.modules.master_data.locations.models import Location
from app.modules.master_data.units.models import UnitOfMeasurement
from app.modules.master_data.item_master.models import Item

# Supplier models
from app.modules.suppliers.models import Supplier

# Inventory models
from app.modules.inventory.models import InventoryUnit, SKUSequence, StockLevel
from app.modules.inventory.damage_models import DamageAssessment, RepairOrder

# Transaction models
from app.modules.transactions.base.models.transaction_headers import TransactionHeader
from app.modules.transactions.base.models.transaction_lines import TransactionLine
from app.modules.transactions.base.models.events import TransactionEvent
from app.modules.transactions.base.models.metadata import TransactionMetadata
from app.modules.transactions.base.models.rental_lifecycle import (
    RentalLifecycle, RentalStatusLog, RentalItemInspection, RentalReturnEvent
)
from app.modules.transactions.base.models.inspections import (
    RentalInspection, PurchaseCreditMemo
)

# Rental specific models
from app.modules.transactions.rentals.booking_models import RentalBooking
from app.modules.transactions.rentals.extension_models import RentalExtension, RentalExtensionLine

# System models
from app.modules.system.models import AuditLog, SystemBackup, SystemSetting

print("✓ All models imported successfully")


async def create_enums(engine):
    """Create all PostgreSQL ENUM types"""
    # Define all ENUMs that need to be created
    enum_definitions = [
        # Customer enums
        ("customer_type_enum", ["INDIVIDUAL", "BUSINESS"]),
        ("customer_tier_enum", ["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
        ("customer_status_enum", ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"]),
        ("blacklist_status_enum", ["CLEAR", "WARNING", "BLACKLISTED"]),
        ("credit_rating_enum", ["EXCELLENT", "GOOD", "FAIR", "POOR", "NO_RATING"]),
        
        # Supplier enums
        ("supplier_type_enum", ["MANUFACTURER", "DISTRIBUTOR", "WHOLESALER", "RETAILER", "INVENTORY", "SERVICE", "DIRECT"]),
        ("supplier_tier_enum", ["PREMIUM", "STANDARD", "BASIC", "TRIAL"]),
        ("supplier_status_enum", ["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "SUSPENDED", "BLACKLISTED"]),
        
        # Item and location enums
        ("item_status_enum", ["ACTIVE", "INACTIVE", "DISCONTINUED"]),
        ("location_type_enum", ["STORE", "WAREHOUSE", "SERVICE_CENTER"]),
    ]
    
    async with engine.begin() as conn:
        print("\nCreating PostgreSQL ENUM types...")
        
        for enum_name, values in enum_definitions:
            try:
                # Drop if exists and recreate
                await conn.execute(text(f"DROP TYPE IF EXISTS {enum_name} CASCADE"))
                
                # Create ENUM type
                values_str = ", ".join([f"'{value}'" for value in values])
                await conn.execute(text(f"CREATE TYPE {enum_name} AS ENUM ({values_str})"))
                print(f"✓ Created {enum_name}")
            except Exception as e:
                print(f"Warning: Could not create {enum_name}: {e}")
    
    print("✓ ENUM creation completed")


async def create_tables():
    """Create all tables in the database"""
    print(f"\nConnecting to database: {settings.DATABASE_URL}")
    
    # Create engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=True,  # Enable SQL logging to see what's happening
        pool_pre_ping=True
    )
    
    # First create ENUMs
    await create_enums(engine)
    
    async with engine.begin() as conn:
        # Print all table names that will be created
        print("\nTables to be created:")
        for table in Base.metadata.sorted_tables:
            print(f"  - {table.name}")
        
        print("\nDropping all existing tables...")
        await conn.run_sync(Base.metadata.drop_all)
        
        print("\nCreating all tables...")
        await conn.run_sync(Base.metadata.create_all)
        
        print("\n✓ All tables created successfully!")
    
    await engine.dispose()


async def verify_tables():
    """Verify that tables were created"""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    
    async with engine.connect() as conn:
        # Check what tables exist
        result = await conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        )
        tables = [row[0] for row in result]
        
        print(f"\n✓ Found {len(tables)} tables in database:")
        for table in sorted(tables):
            print(f"  - {table}")
    
    await engine.dispose()


async def main():
    """Main function"""
    try:
        print("=== Force Creating Database Tables ===")
        await create_tables()
        await verify_tables()
        print("\n✓ Database initialization completed successfully!")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())