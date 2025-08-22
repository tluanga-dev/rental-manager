#!/usr/bin/env python3
"""
Fix Alembic migration issue in production
"""
import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

async def fix_alembic():
    database_url = os.getenv("DATABASE_URL", "")
    
    # Convert to asyncpg URL
    if "postgres://" in database_url:
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif "postgresql://" in database_url and "+asyncpg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    if not database_url:
        print("DATABASE_URL not set")
        return False
    
    engine = create_async_engine(database_url)
    
    try:
        async with engine.begin() as conn:
            # Check current alembic version
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            current_version = result.scalar()
            print(f"Current alembic version: {current_version}")
            
            # If the version is incorrect or missing, set it to the latest
            if current_version != "00221414c0fc":
                print("Updating alembic version to latest...")
                await conn.execute(text("DELETE FROM alembic_version"))
                await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('00221414c0fc')"))
                print("Alembic version updated successfully")
            else:
                print("Alembic version is already correct")
                
        return True
    except Exception as e:
        print(f"Error fixing alembic: {e}")
        # If alembic_version table doesn't exist, that's okay - migrations will create it
        if "alembic_version" in str(e):
            print("Alembic version table doesn't exist yet - migrations will create it")
            return True
        return False
    finally:
        await engine.dispose()

if __name__ == "__main__":
    success = asyncio.run(fix_alembic())
    sys.exit(0 if success else 1)