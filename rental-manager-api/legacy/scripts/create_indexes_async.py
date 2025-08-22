#!/usr/bin/env python3
"""
Asynchronous Database Index Creation for Production
Creates performance indexes without blocking
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/rental_db")

# Convert Railway's postgres:// to postgresql:// if needed
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Convert to async URL if needed
if "postgresql://" in DATABASE_URL and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


async def create_indexes():
    """Create all performance indexes"""
    
    indexes = [
        # Transaction indexes
        """CREATE INDEX IF NOT EXISTS idx_transaction_headers_rental_queries 
           ON transaction_headers (transaction_type, status, created_at DESC) 
           WHERE transaction_type = 'RENTAL'""",
        
        """CREATE INDEX IF NOT EXISTS idx_transaction_headers_search
           ON transaction_headers (transaction_type, customer_id, location_id, transaction_date)""",
        
        """CREATE INDEX IF NOT EXISTS idx_transaction_lines_header_item
           ON transaction_lines (transaction_header_id, item_id, line_number)""",
        
        """CREATE INDEX IF NOT EXISTS idx_transaction_lines_rental_dates
           ON transaction_lines (rental_end_date, rental_return_date)
           WHERE rental_end_date IS NOT NULL""",
        
        # Stock and inventory indexes
        """CREATE INDEX IF NOT EXISTS idx_stock_levels_item_location_available
           ON stock_levels (item_id, location_id, quantity_available)
           WHERE quantity_available > 0""",
        
        """CREATE INDEX IF NOT EXISTS idx_inventory_units_rental_lookup
           ON inventory_units (item_id, location_id, status)
           WHERE status = 'AVAILABLE'""",
        
        """CREATE INDEX IF NOT EXISTS idx_stock_movements_item_created
           ON stock_movements (item_id, created_at DESC)""",
        
        # Master data indexes
        """CREATE INDEX IF NOT EXISTS idx_items_active_rentable
           ON items (category_id, is_rentable, rental_rate_per_period)
           WHERE is_active = true AND is_rentable = true""",
        
        """CREATE INDEX IF NOT EXISTS idx_customers_active_search
           ON customers (customer_type, business_name, first_name, last_name)
           WHERE is_active = true""",
        
        """CREATE INDEX IF NOT EXISTS idx_suppliers_active
           ON suppliers (supplier_name, contact_person)
           WHERE is_active = true""",
        
        """CREATE INDEX IF NOT EXISTS idx_categories_parent
           ON categories (parent_id, is_active)
           WHERE is_active = true""",
        
        # Rental lifecycle index
        """CREATE INDEX IF NOT EXISTS idx_rental_lifecycle_status
           ON rental_lifecycle (transaction_header_id, status, created_at DESC)""",
    ]
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        created_count = 0
        skipped_count = 0
        
        for index_sql in indexes:
            try:
                # Extract index name for logging
                index_name = index_sql.split("IF NOT EXISTS")[1].split("ON")[0].strip()
                
                logger.info(f"Creating index: {index_name}")
                await conn.execute(text(index_sql))
                created_count += 1
                logger.info(f"✓ Created index: {index_name}")
                
            except Exception as e:
                if "already exists" in str(e).lower():
                    skipped_count += 1
                    logger.info(f"⏭ Index already exists: {index_name}")
                else:
                    logger.error(f"✗ Error creating index {index_name}: {e}")
        
        # Update table statistics
        logger.info("Updating table statistics...")
        tables = [
            "transaction_headers", "transaction_lines", "stock_levels",
            "inventory_units", "stock_movements", "rental_lifecycle",
            "items", "categories", "customers", "suppliers"
        ]
        
        for table in tables:
            try:
                await conn.execute(text(f"ANALYZE {table}"))
                logger.info(f"✓ Analyzed {table}")
            except Exception as e:
                logger.warning(f"Could not analyze {table}: {e}")
    
    await engine.dispose()
    
    logger.info(f"""
    =====================================
    Index Creation Complete
    =====================================
    Created: {created_count} indexes
    Skipped: {skipped_count} indexes (already exist)
    =====================================
    """)
    
    return created_count, skipped_count


async def main():
    """Main entry point"""
    try:
        await create_indexes()
    except Exception as e:
        logger.error(f"Failed to create indexes: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())