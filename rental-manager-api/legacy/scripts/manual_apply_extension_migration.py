#!/usr/bin/env python3
"""
Manual script to apply rental extension migration
"""

import asyncio
import sys
from pathlib import Path
from sqlalchemy import text

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal, engine


async def create_enums(session):
    """Create enum types if they don't exist"""
    print("📋 Creating enum types...")
    
    # Check and create bookingstatus
    try:
        await session.execute(text("""
            CREATE TYPE bookingstatus AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'CONVERTED')
        """))
        print("  ✅ Created bookingstatus enum")
    except Exception as e:
        if "already exists" in str(e):
            print("  ℹ️  bookingstatus enum already exists")
        else:
            raise
    
    # Check and create extensiontype
    try:
        await session.execute(text("""
            CREATE TYPE extensiontype AS ENUM ('FULL', 'PARTIAL')
        """))
        print("  ✅ Created extensiontype enum")
    except Exception as e:
        if "already exists" in str(e):
            print("  ℹ️  extensiontype enum already exists")
        else:
            raise
    
    # Check and create returncondition
    try:
        await session.execute(text("""
            CREATE TYPE returncondition AS ENUM ('GOOD', 'DAMAGED', 'BEYOND_REPAIR')
        """))
        print("  ✅ Created returncondition enum")
    except Exception as e:
        if "already exists" in str(e):
            print("  ℹ️  returncondition enum already exists")
        else:
            raise
    
    # Check and create paymentstatus_ext
    try:
        await session.execute(text("""
            CREATE TYPE paymentstatus_ext AS ENUM ('PENDING', 'PARTIAL', 'PAID')
        """))
        print("  ✅ Created paymentstatus_ext enum")
    except Exception as e:
        if "already exists" in str(e):
            print("  ℹ️  paymentstatus_ext enum already exists")
        else:
            raise
    
    await session.commit()


async def create_rental_bookings_table(session):
    """Create rental_bookings table"""
    print("\n📋 Creating rental_bookings table...")
    
    try:
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS rental_bookings (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                item_id UUID NOT NULL REFERENCES items(id),
                quantity_reserved NUMERIC(10, 2) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                customer_id UUID NOT NULL REFERENCES customers(id),
                location_id UUID NOT NULL REFERENCES locations(id),
                booking_status bookingstatus NOT NULL,
                estimated_rental_rate NUMERIC(15, 2),
                estimated_total NUMERIC(15, 2),
                deposit_required NUMERIC(15, 2),
                deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
                booking_reference VARCHAR(50) NOT NULL UNIQUE,
                converted_rental_id UUID REFERENCES transaction_headers(id),
                notes TEXT,
                cancelled_reason TEXT,
                cancelled_at TIMESTAMP WITH TIME ZONE,
                cancelled_by UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                created_by VARCHAR(255),
                updated_by VARCHAR(255),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                deleted_at TIMESTAMP WITH TIME ZONE,
                deleted_by VARCHAR(255)
            )
        """))
        
        # Create indexes
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_booking_item_dates ON rental_bookings(item_id, start_date, end_date)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_booking_customer ON rental_bookings(customer_id)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_booking_status ON rental_bookings(booking_status)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_booking_dates ON rental_bookings(start_date, end_date)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_booking_reference ON rental_bookings(booking_reference)"))
        
        print("  ✅ rental_bookings table created with indexes")
    except Exception as e:
        if "already exists" in str(e):
            print("  ℹ️  rental_bookings table already exists")
        else:
            raise
    
    await session.commit()


async def create_rental_extensions_table(session):
    """Create rental_extensions table"""
    print("\n📋 Creating rental_extensions table...")
    
    try:
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS rental_extensions (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                parent_rental_id UUID NOT NULL REFERENCES transaction_headers(id),
                extension_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                original_end_date DATE NOT NULL,
                new_end_date DATE NOT NULL,
                extension_type extensiontype NOT NULL,
                extension_charges NUMERIC(15, 2) NOT NULL DEFAULT 0,
                payment_received NUMERIC(15, 2) NOT NULL DEFAULT 0,
                payment_status paymentstatus_ext NOT NULL,
                extended_by UUID NOT NULL REFERENCES users(id),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                created_by VARCHAR(255),
                updated_by VARCHAR(255),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                deleted_at TIMESTAMP WITH TIME ZONE,
                deleted_by VARCHAR(255)
            )
        """))
        
        # Create indexes
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_extension_rental ON rental_extensions(parent_rental_id)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_extension_date ON rental_extensions(extension_date)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_extension_payment_status ON rental_extensions(payment_status)"))
        
        print("  ✅ rental_extensions table created with indexes")
    except Exception as e:
        if "already exists" in str(e):
            print("  ℹ️  rental_extensions table already exists")
        else:
            raise
    
    await session.commit()


async def create_rental_extension_lines_table(session):
    """Create rental_extension_lines table"""
    print("\n📋 Creating rental_extension_lines table...")
    
    try:
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS rental_extension_lines (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                extension_id UUID NOT NULL REFERENCES rental_extensions(id),
                transaction_line_id UUID NOT NULL REFERENCES transaction_lines(id),
                original_quantity NUMERIC(10, 2) NOT NULL,
                extended_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
                returned_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
                return_condition returncondition,
                condition_notes TEXT,
                damage_assessment NUMERIC(15, 2),
                item_new_end_date DATE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
                created_by VARCHAR(255),
                updated_by VARCHAR(255),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                deleted_at TIMESTAMP WITH TIME ZONE,
                deleted_by VARCHAR(255)
            )
        """))
        
        # Create indexes
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_extension_line_extension ON rental_extension_lines(extension_id)"))
        await session.execute(text("CREATE INDEX IF NOT EXISTS idx_extension_line_transaction ON rental_extension_lines(transaction_line_id)"))
        
        print("  ✅ rental_extension_lines table created with indexes")
    except Exception as e:
        if "already exists" in str(e):
            print("  ℹ️  rental_extension_lines table already exists")
        else:
            raise
    
    await session.commit()


async def add_transaction_header_columns(session):
    """Add new columns to transaction_headers"""
    print("\n📋 Adding columns to transaction_headers...")
    
    try:
        await session.execute(text("""
            ALTER TABLE transaction_headers 
            ADD COLUMN IF NOT EXISTS extension_count INTEGER NOT NULL DEFAULT 0
        """))
        print("  ✅ Added extension_count column")
    except Exception as e:
        if "already exists" in str(e):
            print("  ℹ️  extension_count column already exists")
        else:
            raise
    
    try:
        await session.execute(text("""
            ALTER TABLE transaction_headers 
            ADD COLUMN IF NOT EXISTS total_extension_charges NUMERIC(15, 2) NOT NULL DEFAULT 0
        """))
        print("  ✅ Added total_extension_charges column")
    except Exception as e:
        if "already exists" in str(e):
            print("  ℹ️  total_extension_charges column already exists")
        else:
            raise
    
    await session.commit()


async def update_stock_movement_enum(session):
    """Add new value to stockmovementtype enum"""
    print("\n📋 Updating stockmovementtype enum...")
    
    try:
        await session.execute(text("""
            ALTER TYPE stockmovementtype ADD VALUE IF NOT EXISTS 'STOCK_MOVEMENT_RESERVATION_EXTENDED'
        """))
        print("  ✅ Added STOCK_MOVEMENT_RESERVATION_EXTENDED to enum")
    except Exception as e:
        if "already exists" in str(e):
            print("  ℹ️  STOCK_MOVEMENT_RESERVATION_EXTENDED already exists")
        else:
            # Enum might not exist at all, which is fine
            print("  ⚠️  stockmovementtype enum not found (might be okay)")
    
    await session.commit()


async def update_alembic_version(session):
    """Update alembic version table"""
    print("\n📋 Updating alembic version...")
    
    try:
        # Check if version already exists
        result = await session.execute(text("""
            SELECT version_num FROM alembic_version WHERE version_num = 'rental_extension_001'
        """))
        if result.fetchone():
            print("  ℹ️  Migration already marked as applied")
        else:
            # Insert the version
            await session.execute(text("""
                INSERT INTO alembic_version (version_num) VALUES ('rental_extension_001')
            """))
            print("  ✅ Marked migration as applied")
    except Exception as e:
        print(f"  ⚠️  Could not update alembic version: {str(e)}")
    
    await session.commit()


async def verify_tables(session):
    """Verify all tables and columns were created"""
    print("\n📋 Verifying migration...")
    
    # Check tables
    result = await session.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('rental_bookings', 'rental_extensions', 'rental_extension_lines')
        ORDER BY table_name
    """))
    tables = [row[0] for row in result]
    
    # Check columns
    result = await session.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transaction_headers'
        AND column_name IN ('extension_count', 'total_extension_charges')
        ORDER BY column_name
    """))
    columns = [row[0] for row in result]
    
    print("\n✅ Verification Results:")
    print(f"  Tables created: {', '.join(tables)}")
    print(f"  Columns added: {', '.join(columns)}")
    
    if len(tables) == 3 and len(columns) == 2:
        print("\n🎉 All extension tables and columns are present!")
        return True
    else:
        print("\n⚠️  Some tables or columns might be missing")
        return False


async def main():
    """Main function to manually apply the migration"""
    print("=" * 60)
    print("🚀 Manual Rental Extension Migration")
    print("=" * 60)
    
    async with AsyncSessionLocal() as session:
        try:
            # Apply migration steps
            await create_enums(session)
            await create_rental_bookings_table(session)
            await create_rental_extensions_table(session)
            await create_rental_extension_lines_table(session)
            await add_transaction_header_columns(session)
            await update_stock_movement_enum(session)
            
            # Verify and update alembic
            success = await verify_tables(session)
            if success:
                await update_alembic_version(session)
                print("\n" + "=" * 60)
                print("✅ Migration completed successfully!")
                print("You can now test the rental extension feature.")
                print("=" * 60)
            else:
                print("\n" + "=" * 60)
                print("⚠️  Migration partially completed. Please check for errors.")
                print("=" * 60)
                
        except Exception as e:
            print(f"\n❌ Error during migration: {str(e)}")
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())