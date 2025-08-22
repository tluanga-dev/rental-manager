#!/usr/bin/env python3
"""
Simple database initialization script
Creates all tables without using Alembic migrations
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import engine, Base

# Import all models to ensure they are registered
from app.db.base import Base  # This imports all models


async def init_db():
    """Initialize database by creating all tables"""
    print("Creating database tables...")
    async with engine.begin() as conn:
        # Drop all tables first (for clean start)
        await conn.run_sync(Base.metadata.drop_all)
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    print("✓ Database tables created successfully!")


async def main():
    """Main function"""
    try:
        await init_db()
        print("\nDatabase initialization completed!")
    except Exception as e:
        print(f"Error initializing database: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())