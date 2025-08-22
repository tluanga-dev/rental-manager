#!/usr/bin/env python3
"""
Database Performance Optimization Script
Adds missing indexes and optimizes query performance
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/rental_db")

class IndexOptimizer:
    """Database index optimization manager"""
    
    def __init__(self):
        self.engine = create_async_engine(DATABASE_URL, echo=True)
        self.indexes = self._get_index_definitions()
    
    def _get_index_definitions(self):
        """Define all performance indexes"""
        return [
            # Composite indexes for common queries
            {
                "name": "idx_transaction_headers_rental_queries",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_headers_rental_queries 
                    ON transaction_headers (transaction_type, status, created_at DESC) 
                    WHERE transaction_type = 'RENTAL'
                """,
                "description": "Optimize rental transaction queries"
            },
            {
                "name": "idx_transaction_headers_search",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_headers_search
                    ON transaction_headers (transaction_type, customer_id, location_id, transaction_date)
                """,
                "description": "Optimize transaction search queries"
            },
            {
                "name": "idx_stock_levels_item_location_available",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_levels_item_location_available
                    ON stock_levels (item_id, location_id, quantity_available)
                    WHERE quantity_available > 0
                """,
                "description": "Optimize stock availability lookups"
            },
            {
                "name": "idx_inventory_units_rental_lookup",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_units_rental_lookup
                    ON inventory_units (item_id, location_id, status)
                    WHERE status = 'AVAILABLE'
                """,
                "description": "Optimize available inventory unit queries"
            },
            {
                "name": "idx_stock_movements_item_created",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_item_created
                    ON stock_movements (item_id, created_at DESC)
                """,
                "description": "Optimize stock movement history queries"
            },
            # Partial indexes for active records
            {
                "name": "idx_items_active_rentable",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_active_rentable
                    ON items (category_id, is_rentable, rental_rate_per_period)
                    WHERE is_active = true AND is_rentable = true
                """,
                "description": "Optimize active rentable items queries"
            },
            {
                "name": "idx_customers_active_search",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_active_search
                    ON customers (customer_type, business_name, first_name, last_name)
                    WHERE is_active = true
                """,
                "description": "Optimize active customer searches"
            },
            {
                "name": "idx_suppliers_active",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_active
                    ON suppliers (supplier_name, contact_person)
                    WHERE is_active = true
                """,
                "description": "Optimize active supplier queries"
            },
            # Transaction line indexes
            {
                "name": "idx_transaction_lines_header_item",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_lines_header_item
                    ON transaction_lines (transaction_header_id, item_id, line_number)
                """,
                "description": "Optimize transaction line lookups"
            },
            {
                "name": "idx_transaction_lines_rental_dates",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_lines_rental_dates
                    ON transaction_lines (rental_end_date, rental_return_date)
                    WHERE rental_end_date IS NOT NULL
                """,
                "description": "Optimize rental date queries"
            },
            # Rental lifecycle indexes
            {
                "name": "idx_rental_lifecycle_status",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rental_lifecycle_status
                    ON rental_lifecycle (transaction_header_id, status, created_at DESC)
                """,
                "description": "Optimize rental lifecycle queries"
            },
            # Category hierarchy index
            {
                "name": "idx_categories_parent",
                "sql": """
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_parent
                    ON categories (parent_id, is_active)
                    WHERE is_active = true
                """,
                "description": "Optimize category hierarchy queries"
            }
        ]
    
    async def check_existing_indexes(self, session: AsyncSession):
        """Check which indexes already exist"""
        query = """
            SELECT indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public'
        """
        result = await session.execute(text(query))
        existing = {row[0] for row in result.fetchall()}
        return existing
    
    async def create_indexes(self, force: bool = False):
        """Create performance indexes"""
        print("🔍 Checking and creating performance indexes...")
        
        # Check existing indexes using a separate connection
        async with self.engine.connect() as conn:
            async with AsyncSession(conn) as session:
                existing_indexes = await self.check_existing_indexes(session)
        
        created_count = 0
        skipped_count = 0
        
        for index_def in self.indexes:
            index_name = index_def["name"]
            
            if index_name in existing_indexes and not force:
                print(f"  ⏭️  Skipping {index_name} (already exists)")
                skipped_count += 1
                continue
            
            try:
                print(f"  🔄 Creating {index_name}: {index_def['description']}")
                # Use raw connection for CONCURRENT index creation (cannot be in transaction)
                async with self.engine.connect() as conn:
                    await conn.execute(text(index_def["sql"]))
                    await conn.commit()
                print(f"  ✅ Created {index_name}")
                created_count += 1
            except Exception as e:
                if "already exists" in str(e).lower():
                    print(f"  ⏭️  {index_name} already exists")
                    skipped_count += 1
                else:
                    print(f"  ❌ Error creating {index_name}: {e}")
        
        return created_count, skipped_count
    
    async def analyze_tables(self, session: AsyncSession):
        """Run ANALYZE on all tables to update statistics"""
        print("\n📊 Updating table statistics...")
        
        tables = [
            "transaction_headers",
            "transaction_lines",
            "stock_levels",
            "inventory_units",
            "stock_movements",
            "rental_lifecycle",
            "items",
            "categories",
            "customers",
            "suppliers"
        ]
        
        for table in tables:
            try:
                await session.execute(text(f"ANALYZE {table}"))
                print(f"  ✅ Analyzed {table}")
            except Exception as e:
                print(f"  ❌ Error analyzing {table}: {e}")
        
        await session.commit()
    
    async def get_index_usage_stats(self, session: AsyncSession):
        """Get index usage statistics"""
        query = """
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan as index_scans,
                idx_tup_read as tuples_read,
                idx_tup_fetch as tuples_fetched,
                pg_size_pretty(pg_relation_size(indexrelid)) as index_size
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            ORDER BY idx_scan DESC
            LIMIT 20
        """
        
        result = await session.execute(text(query))
        return result.fetchall()

async def main():
    """Main entry point"""
    optimizer = IndexOptimizer()
    
    print("=" * 60)
    print("DATABASE PERFORMANCE OPTIMIZER")
    print("=" * 60)
    print("\nThis script will add performance indexes to optimize query speed.")
    print("Indexes will be created CONCURRENTLY to avoid locking tables.")
    
    print("\nOptions:")
    print("1. Create missing indexes only")
    print("2. Force recreate all indexes")
    print("3. Analyze tables (update statistics)")
    print("4. Show index usage statistics")
    print("5. Full optimization (create indexes + analyze)")
    print("0. Exit")
    
    choice = input("\nEnter your choice (0-5): ").strip()
    
    if choice == "0":
        print("Exiting...")
        return
    
    try:
        if choice == "1":
            created, skipped = await optimizer.create_indexes(force=False)
            print(f"\n✅ Created {created} indexes, skipped {skipped} existing")
            
        elif choice == "2":
            confirm = input("\n⚠️  This will recreate all indexes. Continue? (yes/no): ").lower()
            if confirm == "yes":
                created, skipped = await optimizer.create_indexes(force=True)
                print(f"\n✅ Created {created} indexes")
            
        elif choice == "3":
            async with optimizer.engine.connect() as conn:
                async with AsyncSession(conn) as session:
                    await optimizer.analyze_tables(session)
            print("\n✅ Table statistics updated")
            
        elif choice == "4":
            async with optimizer.engine.connect() as conn:
                async with AsyncSession(conn) as session:
                    print("\n📊 Index Usage Statistics:")
                    stats = await optimizer.get_index_usage_stats(session)
                    print(f"\n{'Index Name':<40} {'Scans':<10} {'Size':<10}")
                    print("-" * 60)
                    for row in stats:
                        print(f"{row[2]:<40} {row[3]:<10} {row[6]:<10}")
            
        elif choice == "5":
            created, skipped = await optimizer.create_indexes(force=False)
            async with optimizer.engine.connect() as conn:
                async with AsyncSession(conn) as session:
                    await optimizer.analyze_tables(session)
            print(f"\n✅ Full optimization complete!")
            print(f"   Created {created} indexes, skipped {skipped} existing")
            print(f"   Updated statistics for all tables")
            
        else:
            print("Invalid choice.")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())