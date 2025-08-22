#!/usr/bin/env python3
"""
Script to apply rental extension migration and verify tables
"""

import asyncio
import sys
from pathlib import Path
from sqlalchemy import text

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal, engine


async def check_tables_exist(session):
    """Check if the extension tables exist"""
    query = text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('rental_bookings', 'rental_extensions', 'rental_extension_lines')
        ORDER BY table_name;
    """)
    
    result = await session.execute(query)
    tables = [row[0] for row in result]
    
    return tables


async def check_columns_exist(session):
    """Check if the new columns exist in transaction_headers"""
    query = text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transaction_headers'
        AND column_name IN ('extension_count', 'total_extension_charges')
        ORDER BY column_name;
    """)
    
    result = await session.execute(query)
    columns = [row[0] for row in result]
    
    return columns


async def main():
    """Main function to check migration status"""
    print("🔍 Checking rental extension migration status...")
    print("-" * 50)
    
    async with AsyncSessionLocal() as session:
        # Check tables
        tables = await check_tables_exist(session)
        
        print("\n📋 Extension Tables:")
        expected_tables = ['rental_bookings', 'rental_extensions', 'rental_extension_lines']
        
        for table in expected_tables:
            if table in tables:
                print(f"  ✅ {table} exists")
            else:
                print(f"  ❌ {table} missing")
        
        # Check columns
        columns = await check_columns_exist(session)
        
        print("\n📋 Transaction Header Columns:")
        expected_columns = ['extension_count', 'total_extension_charges']
        
        for column in expected_columns:
            if column in columns:
                print(f"  ✅ {column} exists")
            else:
                print(f"  ❌ {column} missing")
        
        # Summary
        print("\n" + "=" * 50)
        if len(tables) == len(expected_tables) and len(columns) == len(expected_columns):
            print("✅ All rental extension tables and columns are present!")
            print("\nYou can now use the rental extension feature.")
        else:
            print("⚠️  Some tables or columns are missing.")
            print("\nTo apply the migration, run:")
            print("  cd rental-manager-backend")
            print("  alembic upgrade head")
            print("\nOr manually run the migration file:")
            print("  alembic upgrade rental_extension_001")
        
        # Check for sample data
        print("\n📊 Checking for existing rentals that can be extended...")
        try:
            rental_query = text("""
                SELECT 
                    th.id,
                    th.transaction_number,
                    th.transaction_type,
                    th.status,
                    COUNT(tl.id) as item_count
                FROM transaction_headers th
                LEFT JOIN transaction_lines tl ON th.id = tl.transaction_header_id
                WHERE th.transaction_type = 'RENTAL'
                AND th.status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')
                GROUP BY th.id, th.transaction_number, th.transaction_type, th.status
                LIMIT 5;
            """)
            
            result = await session.execute(rental_query)
            rentals = result.fetchall()
            
            if rentals:
                print(f"\nFound {len(rentals)} rental(s):")
                for rental in rentals:
                    print(f"  - {rental.transaction_number} (Status: {rental.status}, Items: {rental.item_count})")
            else:
                print("\nNo rentals found. Create a rental first to test extensions.")
        except Exception as e:
            print(f"\n⚠️ Could not check for existing rentals: {str(e)}")


if __name__ == "__main__":
    asyncio.run(main())