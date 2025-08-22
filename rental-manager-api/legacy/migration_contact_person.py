#!/usr/bin/env python3
"""
Database migration script for Railway deployment
This will be run during the app startup to ensure contact_person column exists
"""

import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

logger = logging.getLogger(__name__)

async def migrate_contact_person_column():
    """Add contact person fields to locations table if they don't exist."""
    
    engine = None
    try:
        # Use the same database URL as the main app
        database_url = str(settings.DATABASE_URL)
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
        if '+asyncpg' not in database_url:
            database_url = database_url.replace('postgresql://', 'postgresql+asyncpg://')
        
        logger.info("🔄 Starting contact person fields migration...")
        logger.info(f"🔗 Using database URL: {database_url.replace(database_url.split('@')[0].split('/')[-1], '***')}")
        
        engine = create_async_engine(database_url, echo=False)  # Disable echo for cleaner logs
        
        async with engine.begin() as conn:
            # First, check if the locations table exists
            table_result = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'locations'
            """))
            
            table_exists = table_result.fetchone()
            if not table_exists:
                logger.error("❌ locations table does not exist!")
                return False
            
            logger.info("✅ locations table exists, checking for contact person fields...")
            
            # Define contact person fields to add
            contact_fields = [
                ("contact_person_name", "VARCHAR(255)", "Primary contact person name"),
                ("contact_person_title", "VARCHAR(100)", "Contact person job title"),
                ("contact_person_phone", "VARCHAR(20)", "Contact person phone number"),
                ("contact_person_email", "VARCHAR(255)", "Contact person email address"),
                ("contact_person_notes", "TEXT", "Additional notes about contact person")
            ]
            
            migration_needed = False
            
            for field_name, field_type, field_comment in contact_fields:
                # Check if column already exists
                result = await conn.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'locations' 
                    AND column_name = :field_name
                """), {"field_name": field_name})
                
                exists = result.fetchone()
                
                if not exists:
                    logger.info(f"📝 Adding {field_name} column to locations table...")
                    
                    # Add the column with proper type and nullable
                    await conn.execute(text(f"""
                        ALTER TABLE locations 
                        ADD COLUMN {field_name} {field_type} NULL
                    """))
                    
                    # Add comment if supported
                    try:
                        await conn.execute(text(f"""
                            COMMENT ON COLUMN locations.{field_name} IS '{field_comment}'
                        """))
                    except:
                        pass  # Comments might not be supported in all environments
                    
                    logger.info(f"✅ Successfully added {field_name} column!")
                    migration_needed = True
                    
                    # Verify the column was added
                    verify_result = await conn.execute(text("""
                        SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns 
                        WHERE table_name = 'locations' 
                        AND column_name = :field_name
                    """), {"field_name": field_name})
                    
                    verify_row = verify_result.fetchone()
                    if verify_row:
                        logger.info(f"✅ Column verified: {verify_row.column_name} ({verify_row.data_type}, nullable: {verify_row.is_nullable})")
                    else:
                        logger.error(f"❌ Column {field_name} was not properly added!")
                        return False
                        
                else:
                    logger.info(f"✅ {field_name} column already exists!")
            
            if migration_needed:
                logger.info("✅ Contact person fields migration completed successfully!")
                return True
            else:
                logger.info("ℹ️ All contact person fields already exist - no migration needed")
                return False
                
    except Exception as e:
        logger.error(f"❌ Error applying migration: {str(e)}")
        logger.exception("Full error details:")
        # Don't fail the app startup if migration fails
        return False
    finally:
        if engine:
            try:
                await engine.dispose()
                logger.info("🔌 Database connection disposed")
            except Exception as e:
                logger.error(f"Error disposing engine: {e}")

if __name__ == "__main__":
    # Can be run standalone for testing
    import sys
    import os
    
    # Add the project root to Python path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    # Setup basic logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    asyncio.run(migrate_contact_person_column())
