#!/usr/bin/env python3
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import db_manager, Base
from app.models import (
    User, Property, Tenant, Lease, Payment, MaintenanceRequest
)


async def main():
    """Create all database tables"""
    print("Creating database tables...")
    
    # Connect to database
    await db_manager.connect()
    
    # Create all tables
    async with db_manager.engine.begin() as conn:
        # Drop all tables first (for clean slate)
        await conn.run_sync(Base.metadata.drop_all)
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Database tables created successfully!")
    
    # List created tables
    async with db_manager.engine.connect() as conn:
        from sqlalchemy import text
        result = await conn.execute(text("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename;
        """))
        tables = result.fetchall()
        print("\nCreated tables:")
        for table in tables:
            print(f"  - {table[0]}")


if __name__ == "__main__":
    asyncio.run(main())