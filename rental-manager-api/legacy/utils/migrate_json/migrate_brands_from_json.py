#!/usr/bin/env python3
"""
Migrate brands from JSON to database
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

async def migrate_brands():
    """Migrate brands from JSON file to database"""
    print("🚀 Starting brands migration...")
    
    # Load brands data
    try:
        with open('dummy_data/brands.json', 'r', encoding='utf-8') as f:
            brands_data = json.load(f)
        print(f"📄 Loaded {len(brands_data)} brands from JSON")
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return False
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if brands table exists
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'brands'
                );
            """))
            table_exists = result.scalar()
            
            if not table_exists:
                print("❌ Brands table does not exist. Please run migrations first:")
                print("   alembic upgrade head")
                return False
            
            # Check existing data
            result = await session.execute(text("SELECT COUNT(*) FROM brands"))
            existing_count = result.scalar()
            
            # Clear existing brands
            if existing_count > 0:
                print(f"🧹 Clearing {existing_count} existing brands...")
                await session.execute(text("DELETE FROM brands"))
                print("✅ Existing brands cleared")
            else:
                print("ℹ️  No existing brands to clear")
            
            # Insert brands one by one
            created_count = 0
            for brand_data in brands_data:
                # Create a savepoint for each brand
                savepoint = await session.begin_nested()
                try:
                    # Generate UUID for the brand
                    brand_id = uuid.uuid4()
                    
                    # Insert brand with proper data types
                    insert_query = text("""
                        INSERT INTO brands (
                            id, name, code, description, is_active
                        ) VALUES (
                            :id, :name, :code, :description, :is_active
                        )
                    """)
                    
                    await session.execute(insert_query, {
                        'id': brand_id,
                        'name': brand_data['name'],
                        'code': brand_data['code'],
                        'description': brand_data.get('description'),
                        'is_active': True
                    })
                    
                    await savepoint.commit()
                    created_count += 1
                    
                    # Create display info
                    display_name = f"{brand_data['name']} ({brand_data['code']})"
                    print(f"✅ Created brand: {display_name}")
                    
                except Exception as e:
                    await savepoint.rollback()
                    print(f"❌ Error creating brand {brand_data.get('name', 'Unknown')}: {e}")
                    continue
            
            # Commit all changes
            await session.commit()
            print(f"\n🎉 Successfully migrated {created_count} brands to database!")
            
            # Show summary statistics
            print(f"\n📊 Migration Summary:")
            print(f"   • Total brands processed: {len(brands_data)}")
            print(f"   • Successfully created: {created_count}")
            print(f"   • Failed: {len(brands_data) - created_count}")
            
            return True
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Migration failed: {e}")
            return False

async def verify_brands_migration():
    """Verify the brands migration was successful"""
    print("\n🔍 Verifying brands migration...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Count total brands
            result = await session.execute(text("SELECT COUNT(*) FROM brands WHERE is_active = true"))
            total_count = result.scalar()
            print(f"✅ Total active brands in database: {total_count}")
            
            # Group brands by equipment type based on description patterns
            result = await session.execute(text("""
                SELECT 
                    CASE 
                        WHEN description LIKE '%construction%' OR description LIKE '%excavator%' OR description LIKE '%heavy equipment%' THEN 'Heavy Construction'
                        WHEN description LIKE '%compact%' OR description LIKE '%mini%' THEN 'Compact Equipment'
                        WHEN description LIKE '%power tool%' OR description LIKE '%tool%' THEN 'Power Tools'
                        WHEN description LIKE '%agricultural%' OR description LIKE '%farm%' THEN 'Agricultural'
                        WHEN description LIKE '%Japanese%' OR description LIKE '%German%' OR description LIKE '%Korean%' OR description LIKE '%Swedish%' OR description LIKE '%British%' OR description LIKE '%American%' THEN 'International'
                        ELSE 'Other'
                    END as brand_category,
                    COUNT(*) as count
                FROM brands 
                WHERE is_active = true 
                GROUP BY brand_category
                ORDER BY count DESC
            """))
            
            print(f"\n📊 Brands by Category:")
            for row in result:
                print(f"   • {row.brand_category}: {row.count} brands")
            
            # Show brands by origin/nationality
            result = await session.execute(text("""
                SELECT 
                    CASE 
                        WHEN description LIKE '%Japanese%' THEN 'Japanese'
                        WHEN description LIKE '%German%' THEN 'German'
                        WHEN description LIKE '%Korean%' THEN 'Korean'
                        WHEN description LIKE '%Swedish%' THEN 'Swedish'
                        WHEN description LIKE '%British%' THEN 'British'
                        WHEN description LIKE '%American%' THEN 'American'
                        ELSE 'Other/Unknown'
                    END as origin,
                    COUNT(*) as count
                FROM brands 
                WHERE is_active = true 
                GROUP BY origin
                ORDER BY count DESC
            """))
            
            print(f"\n🌍 Brands by Origin:")
            for row in result:
                print(f"   • {row.origin}: {row.count} brands")
            
            # Show sample brands from each major category
            categories = ['construction', 'tool', 'compact', 'agricultural']
            for category in categories:
                result = await session.execute(text("""
                    SELECT name, code, description 
                    FROM brands 
                    WHERE is_active = true 
                    AND description ILIKE :pattern
                    ORDER BY name
                    LIMIT 5
                """), {'pattern': f'%{category}%'})
                
                brands = result.fetchall()
                if brands:
                    print(f"\n🏭 Sample {category.title()} Brands:")
                    for brand in brands:
                        print(f"   • {brand.name} ({brand.code}) - {brand.description}")
            
            # Show brands with shortest and longest codes
            result = await session.execute(text("""
                SELECT name, code, description 
                FROM brands 
                WHERE is_active = true 
                ORDER BY LENGTH(code), name
                LIMIT 5
            """))
            
            print(f"\n🔤 Brands with Shortest Codes:")
            for row in result:
                print(f"   • {row.name} ({row.code})")
            
            result = await session.execute(text("""
                SELECT name, code, description 
                FROM brands 
                WHERE is_active = true 
                ORDER BY LENGTH(code) DESC, name
                LIMIT 5
            """))
            
            print(f"\n📝 Brands with Longest Codes:")
            for row in result:
                print(f"   • {row.name} ({row.code})")
            
            # Show top brands alphabetically
            result = await session.execute(text("""
                SELECT name, code, description 
                FROM brands 
                WHERE is_active = true 
                ORDER BY name
                LIMIT 10
            """))
            
            print(f"\n🔤 Top Brands (Alphabetical):")
            for row in result:
                print(f"   • {row.name} ({row.code}) - {row.description}")
            
        except Exception as e:
            print(f"❌ Brands verification failed: {e}")

if __name__ == "__main__":
    async def main():
        success = await migrate_brands()
        if success:
            await verify_brands_migration()
            print("\n✅ Brands migration completed successfully!")
        else:
            print("\n❌ Brands migration failed!")
    
    asyncio.run(main())