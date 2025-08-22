#!/usr/bin/env python3
"""
Migrate locations from JSON to database
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

async def migrate_locations():
    """Migrate locations from JSON file to database"""
    print("🚀 Starting locations migration...")
    
    # Load locations data
    try:
        with open('dummy_data/locations.json', 'r', encoding='utf-8') as f:
            locations_data = json.load(f)
        print(f"📄 Loaded {len(locations_data)} locations from JSON")
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return False
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if locations table exists
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'locations'
                );
            """))
            table_exists = result.scalar()
            
            if not table_exists:
                print("❌ Locations table does not exist. Please run migrations first:")
                print("   alembic upgrade head")
                return False
            
            # Check existing data
            result = await session.execute(text("SELECT COUNT(*) FROM locations"))
            existing_count = result.scalar()
            
            # Clear existing locations
            if existing_count > 0:
                print(f"🧹 Clearing {existing_count} existing locations...")
                await session.execute(text("DELETE FROM locations"))
                print("✅ Existing locations cleared")
            else:
                print("ℹ️  No existing locations to clear")
            
            # Insert locations one by one
            created_count = 0
            for location_data in locations_data:
                # Create a savepoint for each location
                savepoint = await session.begin_nested()
                try:
                    # Generate UUID for the location
                    location_id = uuid.uuid4()
                    
                    # Insert location with proper data types
                    insert_query = text("""
                        INSERT INTO locations (
                            id, location_code, location_name, location_type, 
                            address, city, state, postal_code, country,
                            contact_number, email, manager_user_id, is_active
                        ) VALUES (
                            :id, :location_code, :location_name, :location_type,
                            :address, :city, :state, :postal_code, :country,
                            :contact_number, :email, :manager_user_id, :is_active
                        )
                    """)
                    
                    await session.execute(insert_query, {
                        'id': location_id,
                        'location_code': location_data['location_code'],
                        'location_name': location_data['location_name'],
                        'location_type': location_data['location_type'],
                        'address': location_data.get('address'),
                        'city': location_data.get('city'),
                        'state': location_data.get('state'),
                        'postal_code': location_data.get('postal_code'),
                        'country': location_data.get('country'),
                        'contact_number': location_data.get('contact_number'),
                        'email': location_data.get('email'),
                        'manager_user_id': location_data.get('manager_user_id'),
                        'is_active': True
                    })
                    
                    await savepoint.commit()
                    created_count += 1
                    
                    # Create display info
                    display_name = f"{location_data['location_name']} ({location_data['location_code']})"
                    print(f"✅ Created location: {display_name}")
                    
                except Exception as e:
                    await savepoint.rollback()
                    print(f"❌ Error creating location {location_data.get('location_name', 'Unknown')}: {e}")
                    continue
            
            # Commit all changes
            await session.commit()
            print(f"\n🎉 Successfully migrated {created_count} locations to database!")
            
            # Show summary statistics
            print(f"\n📊 Migration Summary:")
            print(f"   • Total locations processed: {len(locations_data)}")
            print(f"   • Successfully created: {created_count}")
            print(f"   • Failed: {len(locations_data) - created_count}")
            
            return True
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Migration failed: {e}")
            return False

async def verify_locations_migration():
    """Verify the locations migration was successful"""
    print("\n🔍 Verifying locations migration...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Count total locations
            result = await session.execute(text("SELECT COUNT(*) FROM locations WHERE is_active = true"))
            total_count = result.scalar()
            print(f"✅ Total active locations in database: {total_count}")
            
            # Group locations by type
            result = await session.execute(text("""
                SELECT location_type, COUNT(*) as count
                FROM locations 
                WHERE is_active = true 
                GROUP BY location_type
                ORDER BY count DESC
            """))
            
            print(f"\n📊 Locations by Type:")
            for row in result:
                print(f"   • {row.location_type}: {row.count} locations")
            
            # Group locations by state/region
            result = await session.execute(text("""
                SELECT state, COUNT(*) as count
                FROM locations 
                WHERE is_active = true AND state IS NOT NULL
                GROUP BY state
                ORDER BY count DESC
                LIMIT 10
            """))
            
            print(f"\n🗺️  Locations by State/Region:")
            for row in result:
                print(f"   • {row.state}: {row.count} locations")
            
            # Show sample locations from each type
            location_types = ['WAREHOUSE', 'STORE', 'OFFICE', 'YARD']
            for loc_type in location_types:
                result = await session.execute(text("""
                    SELECT location_name, location_code, city, state 
                    FROM locations 
                    WHERE is_active = true 
                    AND location_type = :location_type
                    ORDER BY location_name
                    LIMIT 3
                """), {'location_type': loc_type})
                
                locations = result.fetchall()
                if locations:
                    print(f"\n🏢 Sample {loc_type} Locations:")
                    for location in locations:
                        city_state = f"{location.city}, {location.state}" if location.city and location.state else "N/A"
                        print(f"   • {location.location_name} ({location.location_code}) - {city_state}")
            
            # Show locations with contact information
            result = await session.execute(text("""
                SELECT location_name, location_code, contact_number, email 
                FROM locations 
                WHERE is_active = true 
                AND (contact_number IS NOT NULL OR email IS NOT NULL)
                ORDER BY location_name
                LIMIT 5
            """))
            
            print(f"\n📞 Locations with Contact Info:")
            for row in result:
                contact_info = []
                if row.contact_number:
                    contact_info.append(f"📞 {row.contact_number}")
                if row.email:
                    contact_info.append(f"📧 {row.email}")
                contact_str = " | ".join(contact_info) if contact_info else "No contact info"
                print(f"   • {row.location_name} ({row.location_code}) - {contact_str}")
            
        except Exception as e:
            print(f"❌ Locations verification failed: {e}")

if __name__ == "__main__":
    async def main():
        success = await migrate_locations()
        if success:
            await verify_locations_migration()
            print("\n✅ Locations migration completed successfully!")
        else:
            print("\n❌ Locations migration failed!")
    
    asyncio.run(main())