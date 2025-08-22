#!/usr/bin/env python3
"""
Migrate categories from JSON to database
"""
import asyncio
import json
import uuid
import sys
import os
from typing import Dict, Optional
from pathlib import Path
from sqlalchemy import text

# Add the project root directory to the path so we can import the app modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Change to project root directory for relative paths to work
if not os.getcwd().endswith('rental-manager-backend'):
    os.chdir(project_root)

from app.core.database import AsyncSessionLocal

async def migrate_categories():
    """Migrate categories from JSON file to database with proper hierarchy handling"""
    print("🚀 Starting category migration...")
    
    # Load categories data
    try:
        with open('dummy_data/categories.json', 'r', encoding='utf-8') as f:
            categories_data = json.load(f)
        print(f"📄 Loaded {len(categories_data)} categories from JSON")
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return False
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if categories table exists
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'categories'
                );
            """))
            table_exists = result.scalar()
            
            if not table_exists:
                print("❌ Categories table does not exist. Please run migrations first:")
                print("   alembic upgrade head")
                return False
            
            # Check existing data
            result = await session.execute(text("SELECT COUNT(*) FROM categories"))
            existing_count = result.scalar()
            
            # Clear existing categories
            if existing_count > 0:
                print(f"🧹 Clearing {existing_count} existing categories...")
                await session.execute(text("DELETE FROM categories"))
                print("✅ Existing categories cleared")
            else:
                print("ℹ️  No existing categories to clear")
            
            # Sort categories by level to ensure parents are created before children
            categories_data.sort(key=lambda x: x['category_level'])
            
            # Track category code to UUID mapping for parent relationships
            category_mapping: Dict[str, uuid.UUID] = {}
            created_count = 0
            
            # Insert categories in order
            for category_data in categories_data:
                # Create a savepoint for each category
                savepoint = await session.begin_nested()
                try:
                    # Generate UUID for the category
                    category_id = uuid.uuid4()
                    category_mapping[category_data['category_code']] = category_id
                    
                    # Resolve parent_category_id from parent_category_code
                    parent_category_id = None
                    if category_data.get('parent_category_id'):
                        parent_code = category_data['parent_category_id']
                        if parent_code in category_mapping:
                            parent_category_id = category_mapping[parent_code]
                        else:
                            print(f"⚠️  Parent category '{parent_code}' not found for '{category_data['category_code']}'")
                    
                    # Insert category with proper data types
                    insert_query = text("""
                        INSERT INTO categories (
                            id, name, category_code, parent_category_id, category_path,
                            category_level, display_order, is_leaf, is_active
                        ) VALUES (
                            :id, :name, :category_code, :parent_category_id, :category_path,
                            :category_level, :display_order, :is_leaf, :is_active
                        )
                    """)
                    
                    await session.execute(insert_query, {
                        'id': category_id,
                        'name': category_data['name'],
                        'category_code': category_data['category_code'],
                        'parent_category_id': parent_category_id,
                        'category_path': category_data['category_path'],
                        'category_level': category_data['category_level'],
                        'display_order': category_data['display_order'],
                        'is_leaf': category_data['is_leaf'],
                        'is_active': True
                    })
                    
                    await savepoint.commit()
                    created_count += 1
                    
                    # Create display info
                    level_indent = "  " * (category_data['category_level'] - 1)
                    leaf_indicator = "🍃" if category_data['is_leaf'] else "📁"
                    print(f"✅ {level_indent}{leaf_indicator} {category_data['name']} ({category_data['category_code']})")
                    
                except Exception as e:
                    await savepoint.rollback()
                    print(f"❌ Error creating category {category_data.get('category_code', 'Unknown')}: {e}")
                    continue
            
            # Commit all changes
            await session.commit()
            print(f"\n🎉 Successfully migrated {created_count} categories to database!")
            
            # Show summary statistics
            print(f"\n📊 Migration Summary:")
            print(f"   • Total categories processed: {len(categories_data)}")
            print(f"   • Successfully created: {created_count}")
            print(f"   • Failed: {len(categories_data) - created_count}")
            
            return True
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Migration failed: {e}")
            return False

async def verify_categories_migration():
    """Verify the categories migration was successful"""
    print("\n🔍 Verifying categories migration...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Count total categories
            result = await session.execute(text("SELECT COUNT(*) FROM categories WHERE is_active = true"))
            total_count = result.scalar()
            print(f"✅ Total active categories in database: {total_count}")
            
            # Check categories by level
            result = await session.execute(text("""
                SELECT category_level, COUNT(*) as count 
                FROM categories 
                WHERE is_active = true 
                GROUP BY category_level 
                ORDER BY category_level
            """))
            
            print(f"\n📊 Categories by Level:")
            for row in result:
                print(f"   • Level {row.category_level}: {row.count} categories")
            
            # Check leaf vs parent categories
            result = await session.execute(text("""
                SELECT is_leaf, COUNT(*) as count 
                FROM categories 
                WHERE is_active = true 
                GROUP BY is_leaf 
                ORDER BY is_leaf
            """))
            
            print(f"\n🌳 Category Types:")
            for row in result:
                category_type = "Leaf (can have items)" if row.is_leaf else "Parent (has children)"
                print(f"   • {category_type}: {row.count}")
            
            # Show root categories
            result = await session.execute(text("""
                SELECT name, category_code, category_path 
                FROM categories 
                WHERE is_active = true AND category_level = 1 
                ORDER BY display_order
            """))
            
            print(f"\n🌲 Root Categories:")
            for row in result:
                print(f"   • {row.name} ({row.category_code})")
            
            # Show hierarchy sample
            result = await session.execute(text("""
                SELECT name, category_code, category_path, category_level, is_leaf
                FROM categories 
                WHERE is_active = true 
                ORDER BY category_path, display_order
                LIMIT 10
            """))
            
            print(f"\n📋 Category Hierarchy Sample:")
            for row in result:
                level_indent = "  " * (row.category_level - 1)
                leaf_indicator = "🍃" if row.is_leaf else "📁"
                print(f"   {level_indent}{leaf_indicator} {row.name} ({row.category_code})")
            
        except Exception as e:
            print(f"❌ Categories verification failed: {e}")

if __name__ == "__main__":
    async def main():
        success = await migrate_categories()
        if success:
            await verify_categories_migration()
            print("\n✅ Categories migration completed successfully!")
        else:
            print("\n❌ Categories migration failed!")
    
    asyncio.run(main())