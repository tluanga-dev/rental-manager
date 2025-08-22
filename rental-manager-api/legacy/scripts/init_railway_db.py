#!/usr/bin/env python3
"""
Initialize Railway database with all tables
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from app.db.base import Base
from app.core.config import settings

# Import all models to ensure they're registered
from app.modules.auth.models import *
from app.modules.users.models import *
from app.modules.company.models import *
from app.modules.customers.models import *
from app.modules.suppliers.models import *
from app.modules.master_data.brands.models import *
from app.modules.master_data.categories.models import *
from app.modules.master_data.locations.models import *
from app.modules.master_data.units.models import *
from app.modules.master_data.item_master.models import *
from app.modules.inventory.models import *
from app.modules.transactions.base.models.transaction_headers import *
from app.modules.transactions.base.models.transaction_lines import *
from app.modules.transactions.base.models.rental_lifecycle import *
from app.modules.system.models import *

async def create_tables():
    """Create all tables in the database"""
    print("Creating database tables...")
    
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=True,
        pool_pre_ping=True
    )
    
    async with engine.begin() as conn:
        # Drop all tables first (be careful in production!)
        # await conn.run_sync(Base.metadata.drop_all)
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        print("✓ All tables created successfully")
    
    await engine.dispose()

async def main():
    """Main function"""
    try:
        await create_tables()
        print("Database initialization complete!")
        return 0
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)