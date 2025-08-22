#!/usr/bin/env python3
"""
Check the count of records in all database tables
"""
import asyncio
import sys
import os
from pathlib import Path

# Add the backend root directory to Python path
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

from sqlalchemy import text, inspect
from app.core.database import AsyncSessionLocal

async def get_table_counts():
    """Get the count of records in all database tables"""
    print("📊 DATABASE TABLE RECORD COUNTS")
    print("=" * 60)
    
    async with AsyncSessionLocal() as session:
        try:
            # Get all table names from the database
            result = await session.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """))
            
            tables = [row.table_name for row in result]
            print(f"Found {len(tables)} tables in the database\n")
            
            # Count records in each table
            table_counts = []
            total_records = 0
            
            for table_name in tables:
                try:
                    # Get count for this table
                    count_result = await session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                    count = count_result.scalar()
                    table_counts.append((table_name, count))
                    total_records += count
                    
                    # Show progress
                    if count > 0:
                        print(f"✅ {table_name:<30} {count:>8} records")
                    else:
                        print(f"⚪ {table_name:<30} {count:>8} records")
                        
                except Exception as e:
                    print(f"❌ {table_name:<30} ERROR: {e}")
                    table_counts.append((table_name, "ERROR"))
            
            print("\n" + "=" * 60)
            print("📈 SUMMARY STATISTICS")
            print("=" * 60)
            
            # Sort by count (descending)
            valid_counts = [(name, count) for name, count in table_counts if isinstance(count, int)]
            valid_counts.sort(key=lambda x: x[1], reverse=True)
            
            print(f"🎯 Total Records: {total_records:,}")
            print(f"📋 Total Tables: {len(tables)}")
            print(f"✅ Non-empty Tables: {len([c for _, c in valid_counts if c > 0])}")
            print(f"⚪ Empty Tables: {len([c for _, c in valid_counts if c == 0])}")
            
            if valid_counts:
                print(f"\n🏆 TOP 10 TABLES BY RECORD COUNT:")
                print("-" * 45)
                for i, (table_name, count) in enumerate(valid_counts[:10], 1):
                    if count > 0:
                        percentage = (count / total_records * 100) if total_records > 0 else 0
                        print(f"{i:2d}. {table_name:<25} {count:>8} ({percentage:.1f}%)")
                
                if len([c for _, c in valid_counts if c == 0]) > 0:
                    print(f"\n⚪ EMPTY TABLES:")
                    print("-" * 30)
                    empty_tables = [name for name, count in valid_counts if count == 0]
                    for table_name in empty_tables:
                        print(f"   • {table_name}")
            
            # Show detailed breakdown by category
            print(f"\n📊 BREAKDOWN BY TABLE CATEGORY:")
            print("-" * 50)
            
            categories = {
                'Master Data': ['brands', 'categories', 'units_of_measurement', 'items', 'locations'],
                'Users & Auth': ['users', 'roles', 'user_roles', 'permissions', 'role_permissions'],
                'Business Data': ['customers', 'suppliers', 'companies'],
                'Inventory': ['inventory_units', 'stock_levels', 'stock_movements'],
                'Transactions': ['transaction_headers', 'transaction_lines', 'rental_lifecycle'],
                'System': ['alembic_version', 'audit_logs', 'system_settings']
            }
            
            for category, table_list in categories.items():
                category_total = 0
                category_tables = []
                
                for table_name in table_list:
                    table_count = next((count for name, count in table_counts if name == table_name and isinstance(count, int)), 0)
                    if table_name in [name for name, _ in table_counts]:  # Table exists
                        category_total += table_count
                        category_tables.append((table_name, table_count))
                
                if category_tables:
                    print(f"\n{category}: {category_total:,} total records")
                    for table_name, count in category_tables:
                        status = "✅" if count > 0 else "⚪"
                        print(f"  {status} {table_name:<25} {count:>6}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error getting table counts: {e}")
            return False

async def get_detailed_stats():
    """Get detailed statistics for key tables"""
    print(f"\n🔍 DETAILED TABLE ANALYSIS")
    print("=" * 60)
    
    async with AsyncSessionLocal() as session:
        try:
            # Items analysis
            result = await session.execute(text("""
                SELECT 
                    item_status,
                    COUNT(*) as count,
                    ROUND(AVG(rental_rate_per_period::numeric), 2) as avg_rental_rate
                FROM items 
                GROUP BY item_status
                ORDER BY count DESC
            """))
            
            print("📦 ITEMS BREAKDOWN:")
            for row in result:
                print(f"   • {row.item_status}: {row.count} items (avg rate: ${row.avg_rental_rate or 0})")
            
            # Categories analysis
            result = await session.execute(text("""
                SELECT 
                    c.name as category_name,
                    COUNT(i.id) as item_count
                FROM categories c
                LEFT JOIN items i ON c.id = i.category_id
                WHERE c.is_active = true
                GROUP BY c.name
                HAVING COUNT(i.id) > 0
                ORDER BY item_count DESC
                LIMIT 5
            """))
            
            print(f"\n📁 TOP CATEGORIES BY ITEM COUNT:")
            for row in result:
                print(f"   • {row.category_name}: {row.item_count} items")
            
            # Brands analysis
            result = await session.execute(text("""
                SELECT 
                    b.name as brand_name,
                    COUNT(i.id) as item_count
                FROM brands b
                LEFT JOIN items i ON b.id = i.brand_id
                WHERE b.is_active = true
                GROUP BY b.name
                HAVING COUNT(i.id) > 0
                ORDER BY item_count DESC
                LIMIT 5
            """))
            
            print(f"\n🏷️ TOP BRANDS BY ITEM COUNT:")
            for row in result:
                print(f"   • {row.brand_name}: {row.item_count} items")
                
        except Exception as e:
            print(f"❌ Error getting detailed stats: {e}")

if __name__ == "__main__":
    async def main():
        print("🚀 Starting database table analysis...\n")
        
        success = await get_table_counts()
        if success:
            await get_detailed_stats()
            print(f"\n✅ Database analysis completed successfully!")
        else:
            print(f"\n❌ Database analysis failed!")
    
    asyncio.run(main())