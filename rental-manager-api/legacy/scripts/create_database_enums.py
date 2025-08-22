#!/usr/bin/env python3
"""
Create PostgreSQL ENUM types before creating tables
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings


async def create_enums():
    """Create all PostgreSQL ENUM types"""
    engine = create_async_engine(settings.DATABASE_URL)
    
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
        print("Creating PostgreSQL ENUM types...")
        
        for enum_name, values in enum_definitions:
            # Drop if exists and recreate
            await conn.execute(f"DROP TYPE IF EXISTS {enum_name} CASCADE")
            
            # Create ENUM type
            values_str = ", ".join([f"'{value}'" for value in values])
            await conn.execute(f"CREATE TYPE {enum_name} AS ENUM ({values_str})")
            print(f"✓ Created {enum_name}")
    
    await engine.dispose()
    print("\n✓ All ENUM types created successfully!")


async def main():
    """Main function"""
    try:
        await create_enums()
    except Exception as e:
        print(f"Error creating ENUMs: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())