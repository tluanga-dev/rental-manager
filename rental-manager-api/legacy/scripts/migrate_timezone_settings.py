#!/usr/bin/env python
"""
Database migration script for timezone settings.

This script adds timezone settings to the system_settings table
if they don't already exist.
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the app directory to the Python path  
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import get_db
from app.modules.system.models import SettingType, SettingCategory
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def check_system_settings_table_exists(session: AsyncSession) -> bool:
    """Check if system_settings table exists."""
    try:
        result = await session.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings')"
        ))
        return result.scalar()
    except Exception as e:
        print(f"Error checking table existence: {e}")
        return False


async def insert_timezone_settings(session: AsyncSession):
    """Insert timezone settings directly into the database."""
    
    timezone_settings = [
        {
            'setting_key': 'system_timezone',
            'setting_name': 'System Timezone',
            'setting_type': SettingType.STRING.value,
            'setting_category': SettingCategory.GENERAL.value,
            'setting_value': 'Asia/Kolkata',
            'default_value': 'Asia/Kolkata',
            'description': 'System timezone for API input/output (Indian Standard Time by default)',
            'is_system': False,
            'is_sensitive': False,
            'validation_rules': '{"type": "timezone", "choices": ["Asia/Kolkata", "UTC", "US/Eastern", "US/Central", "US/Mountain", "US/Pacific", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney", "Asia/Dubai", "Asia/Singapore"]}',
            'display_order': '4',
            'is_active': True
        },
        {
            'setting_key': 'task_scheduler_timezone',
            'setting_name': 'Task Scheduler Timezone',
            'setting_type': SettingType.STRING.value,
            'setting_category': SettingCategory.SYSTEM.value,
            'setting_value': 'Asia/Kolkata',
            'default_value': 'Asia/Kolkata',
            'description': 'Timezone for scheduled tasks (IST by default)',
            'is_system': True,
            'is_sensitive': False,
            'validation_rules': '{"type": "timezone", "choices": ["Asia/Kolkata", "UTC", "US/Eastern", "US/Central", "US/Mountain", "US/Pacific", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney", "Asia/Dubai", "Asia/Singapore"]}',
            'display_order': '7',
            'is_active': True
        }
    ]
    
    for setting in timezone_settings:
        # Check if setting already exists
        check_query = text(
            "SELECT COUNT(*) FROM system_settings WHERE setting_key = :setting_key"
        )
        result = await session.execute(check_query, {'setting_key': setting['setting_key']})
        count = result.scalar()
        
        if count == 0:
            # Insert new setting
            insert_query = text("""
                INSERT INTO system_settings (
                    id, setting_key, setting_name, setting_type, setting_category,
                    setting_value, default_value, description, is_system, is_sensitive,
                    validation_rules, display_order, is_active, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), :setting_key, :setting_name, :setting_type, :setting_category,
                    :setting_value, :default_value, :description, :is_system, :is_sensitive,
                    :validation_rules::json, :display_order, :is_active, NOW(), NOW()
                )
            """)
            
            await session.execute(insert_query, setting)
            print(f"✅ Inserted timezone setting: {setting['setting_key']}")
        else:
            print(f"⏭️  Timezone setting already exists: {setting['setting_key']}")


async def update_existing_timezone_setting(session: AsyncSession):
    """Update existing 'timezone' setting to 'system_timezone' if it exists."""
    
    # Check if old 'timezone' setting exists
    check_query = text(
        "SELECT COUNT(*) FROM system_settings WHERE setting_key = 'timezone' AND is_active = true"
    )
    result = await session.execute(check_query)
    count = result.scalar()
    
    if count > 0:
        print("📝 Found old 'timezone' setting, updating to 'system_timezone'...")
        
        # Update the setting key and other properties
        update_query = text("""
            UPDATE system_settings 
            SET 
                setting_key = 'system_timezone',
                setting_name = 'System Timezone',
                description = 'System timezone for API input/output (Indian Standard Time by default)',
                setting_value = COALESCE(setting_value, 'Asia/Kolkata'),
                default_value = COALESCE(default_value, 'Asia/Kolkata'),
                validation_rules = '{"type": "timezone", "choices": ["Asia/Kolkata", "UTC", "US/Eastern", "US/Central", "US/Mountain", "US/Pacific", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney", "Asia/Dubai", "Asia/Singapore"]}'::json,
                updated_at = NOW()
            WHERE setting_key = 'timezone' AND is_active = true
        """)
        
        await session.execute(update_query)
        print("✅ Updated old timezone setting to new format")
    else:
        print("ℹ️  No old 'timezone' setting found to update")


async def verify_timezone_settings(session: AsyncSession):
    """Verify that timezone settings were created correctly."""
    
    query = text("""
        SELECT setting_key, setting_name, setting_value, default_value, is_active
        FROM system_settings 
        WHERE setting_key IN ('system_timezone', 'task_scheduler_timezone')
        ORDER BY setting_key
    """)
    
    result = await session.execute(query)
    settings = result.fetchall()
    
    print("\n📋 Current timezone settings:")
    print("-" * 80)
    
    if not settings:
        print("❌ No timezone settings found!")
        return False
    
    for setting in settings:
        print(f"Key: {setting.setting_key}")
        print(f"Name: {setting.setting_name}")
        print(f"Value: {setting.setting_value}")
        print(f"Default: {setting.default_value}")
        print(f"Active: {setting.is_active}")
        print("-" * 40)
    
    return len(settings) == 2


async def main():
    """Main migration function."""
    print("🚀 TIMEZONE SETTINGS DATABASE MIGRATION")
    print("=" * 60)
    
    try:
        async for session in get_db():
            try:
                # Check if system_settings table exists
                table_exists = await check_system_settings_table_exists(session)
                
                if not table_exists:
                    print("❌ system_settings table does not exist!")
                    print("Please run the main database migrations first:")
                    print("alembic upgrade head")
                    return False
                
                print("✅ system_settings table exists")
                
                # Update existing timezone setting if it exists
                await update_existing_timezone_setting(session)
                
                # Insert timezone settings
                print("\n📝 Inserting timezone settings...")
                await insert_timezone_settings(session)
                
                # Commit changes
                await session.commit()
                print("\n💾 Changes committed to database")
                
                # Verify settings
                success = await verify_timezone_settings(session)
                
                if success:
                    print("\n🎉 TIMEZONE SETTINGS MIGRATION COMPLETED SUCCESSFULLY!")
                    print("\n📝 Summary:")
                    print("• Added 'system_timezone' setting (default: Asia/Kolkata)")
                    print("• Added 'task_scheduler_timezone' setting (default: Asia/Kolkata)")
                    print("• Updated any existing 'timezone' setting to new format")
                    print("• Timezone validation rules configured")
                    print("\nNext steps:")
                    print("1. Restart your application to pick up the new settings")
                    print("2. Use the timezone management API endpoints to configure timezones")
                    print("3. Update your API schemas to use timezone-aware models")
                    
                    return True
                else:
                    print("\n❌ Migration verification failed!")
                    return False
                    
            except Exception as e:
                await session.rollback()
                print(f"\n❌ Migration failed: {e}")
                import traceback
                traceback.print_exc()
                return False
            finally:
                await session.close()
                
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)