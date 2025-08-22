#!/usr/bin/env python3
"""
Migrate units of measurement from JSON to database
"""
import asyncio
import json
import uuid
import sys
import os
from pathlib import Path
from sqlalchemy import text

# Add the project root directory to the path so we can import the app modules
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent.parent  # Go up from migrate_json -> utils -> project_root
sys.path.insert(0, str(project_root))

# Change to project root directory for relative paths to work
original_cwd = os.getcwd()
if not original_cwd.endswith('rental-manager-backend'):
    os.chdir(project_root)

# Now import after path setup
from app.core.database import AsyncSessionLocal

async def migrate_units():
    """Migrate units of measurement from JSON file to database"""
    print("🚀 Starting units of measurement migration...")
    
    # Load units data
    try:
        with open('dummy_data/units.json', 'r', encoding='utf-8') as f:
            units_data = json.load(f)
        print(f"📄 Loaded {len(units_data)} units from JSON")
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return False
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if units_of_measurement table exists
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'units_of_measurement'
                );
            """))
            table_exists = result.scalar()
            
            if not table_exists:
                print("❌ Units of measurement table does not exist. Please run migrations first:")
                print("   alembic upgrade head")
                return False
            
            # Check existing data
            result = await session.execute(text("SELECT COUNT(*) FROM units_of_measurement"))
            existing_count = result.scalar()
            
            # Clear existing units
            if existing_count > 0:
                print(f"🧹 Clearing {existing_count} existing units of measurement...")
                await session.execute(text("DELETE FROM units_of_measurement"))
                print("✅ Existing units of measurement cleared")
            else:
                print("ℹ️  No existing units of measurement to clear")
            
            # Insert units one by one
            created_count = 0
            for unit_data in units_data:
                # Create a savepoint for each unit
                savepoint = await session.begin_nested()
                try:
                    # Generate UUID for the unit
                    unit_id = uuid.uuid4()
                    
                    # Insert unit with proper data types
                    insert_query = text("""
                        INSERT INTO units_of_measurement (
                            id, name, code, description, is_active
                        ) VALUES (
                            :id, :name, :code, :description, :is_active
                        )
                    """)
                    
                    await session.execute(insert_query, {
                        'id': unit_id,
                        'name': unit_data['name'],
                        'code': unit_data['code'],
                        'description': unit_data.get('description'),
                        'is_active': True
                    })
                    
                    await savepoint.commit()
                    created_count += 1
                    
                    # Create display info
                    display_name = f"{unit_data['name']} ({unit_data['code']})"
                    print(f"✅ Created unit: {display_name}")
                    
                except Exception as e:
                    await savepoint.rollback()
                    print(f"❌ Error creating unit {unit_data.get('name', 'Unknown')}: {e}")
                    continue
            
            # Commit all changes
            await session.commit()
            print(f"\n🎉 Successfully migrated {created_count} units of measurement to database!")
            
            # Show summary statistics
            print(f"\n📊 Migration Summary:")
            print(f"   • Total units processed: {len(units_data)}")
            print(f"   • Successfully created: {created_count}")
            print(f"   • Failed: {len(units_data) - created_count}")
            
            return True
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Migration failed: {e}")
            return False

async def verify_units_migration():
    """Verify the units migration was successful"""
    print("\n🔍 Verifying units of measurement migration...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Count total units
            result = await session.execute(text("SELECT COUNT(*) FROM units_of_measurement WHERE is_active = true"))
            total_count = result.scalar()
            print(f"✅ Total active units in database: {total_count}")
            
            # Group units by type based on description patterns
            result = await session.execute(text("""
                SELECT 
                    CASE 
                        WHEN description LIKE '%Weight%' THEN 'Weight'
                        WHEN description LIKE '%Volume%' THEN 'Volume'
                        WHEN description LIKE '%Linear%' OR description LIKE '%measurement%' THEN 'Measurement'
                        WHEN description LIKE '%Area%' THEN 'Area'
                        WHEN description LIKE '%Time%' OR description LIKE '%rental%' THEN 'Time/Rental'
                        WHEN description LIKE '%countable%' OR description LIKE '%Individual%' THEN 'Count'
                        WHEN description LIKE '%Collection%' OR description LIKE '%Groups%' THEN 'Groups'
                        ELSE 'Other'
                    END as unit_type,
                    COUNT(*) as count
                FROM units_of_measurement 
                WHERE is_active = true 
                GROUP BY unit_type
                ORDER BY count DESC
            """))
            
            print(f"\n📊 Units by Type:")
            for row in result:
                print(f"   • {row.unit_type}: {row.count} units")
            
            # Show sample units from each major category
            categories = ['Weight', 'Volume', 'Time', 'Count']
            for category in categories:
                result = await session.execute(text("""
                    SELECT name, code, description 
                    FROM units_of_measurement 
                    WHERE is_active = true 
                    AND description LIKE :pattern
                    ORDER BY name
                    LIMIT 5
                """), {'pattern': f'%{category}%'})
                
                units = result.fetchall()
                if units:
                    print(f"\n📏 Sample {category} Units:")
                    for unit in units:
                        print(f"   • {unit.name} ({unit.code}) - {unit.description}")
            
            # Show units with shortest and longest codes
            result = await session.execute(text("""
                SELECT name, code, description 
                FROM units_of_measurement 
                WHERE is_active = true 
                ORDER BY LENGTH(code), name
                LIMIT 5
            """))
            
            print(f"\n🔤 Units with Shortest Codes:")
            for row in result:
                print(f"   • {row.name} ({row.code})")
            
            result = await session.execute(text("""
                SELECT name, code, description 
                FROM units_of_measurement 
                WHERE is_active = true 
                ORDER BY LENGTH(code) DESC, name
                LIMIT 5
            """))
            
            print(f"\n📝 Units with Longest Codes:")
            for row in result:
                print(f"   • {row.name} ({row.code})")
            
        except Exception as e:
            print(f"❌ Units verification failed: {e}")

if __name__ == "__main__":
    async def main():
        success = await migrate_units()
        if success:
            await verify_units_migration()
            print("\n✅ Units of measurement migration completed successfully!")
        else:
            print("\n❌ Units of measurement migration failed!")
    
    asyncio.run(main())