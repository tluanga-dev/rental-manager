#!/usr/bin/env python
"""
Initialize timezone settings in the system.

This script ensures that the system has the correct timezone settings
with Indian Standard Time (IST) as the default.
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the app directory to the Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import get_db
from app.modules.system.service import SystemService
from app.modules.system.models import SettingType, SettingCategory
from app.core.timezone import TimezoneManager, validate_timezone_name


async def initialize_timezone_settings():
    """Initialize timezone settings in the database."""
    print("🕒 Initializing timezone settings...")
    
    async for session in get_db():
        try:
            system_service = SystemService(session)
            
            # Check if system_timezone setting exists
            existing_setting = await system_service.get_setting('system_timezone')
            
            if existing_setting:
                print(f"✅ System timezone setting already exists: {existing_setting.setting_value}")
                
                # Validate the existing timezone
                if not validate_timezone_name(existing_setting.setting_value):
                    print(f"⚠️  Invalid timezone '{existing_setting.setting_value}', updating to Asia/Kolkata")
                    await system_service.update_setting('system_timezone', 'Asia/Kolkata')
                    print("✅ Updated to Asia/Kolkata")
                else:
                    print(f"✅ Current timezone '{existing_setting.setting_value}' is valid")
            else:
                print("📝 Creating system_timezone setting...")
                await system_service.create_setting(
                    setting_key='system_timezone',
                    setting_name='System Timezone',
                    setting_type=SettingType.STRING,
                    setting_category=SettingCategory.GENERAL,
                    setting_value='Asia/Kolkata',
                    default_value='Asia/Kolkata',
                    description='System timezone for API input/output (Indian Standard Time by default)',
                    validation_rules={
                        'type': 'timezone',
                        'choices': [
                            'Asia/Kolkata', 'UTC', 'US/Eastern', 'US/Central', 
                            'US/Mountain', 'US/Pacific', 'Europe/London', 'Europe/Paris',
                            'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 
                            'Asia/Dubai', 'Asia/Singapore'
                        ]
                    },
                    display_order='4'
                )
                print("✅ Created system_timezone setting")
            
            # Check task scheduler timezone
            scheduler_setting = await system_service.get_setting('task_scheduler_timezone')
            
            if scheduler_setting:
                print(f"✅ Task scheduler timezone setting exists: {scheduler_setting.setting_value}")
                
                # Validate the existing timezone
                if not validate_timezone_name(scheduler_setting.setting_value):
                    print(f"⚠️  Invalid scheduler timezone '{scheduler_setting.setting_value}', updating to Asia/Kolkata")
                    await system_service.update_setting('task_scheduler_timezone', 'Asia/Kolkata')
                    print("✅ Updated scheduler timezone to Asia/Kolkata")
                else:
                    print(f"✅ Current scheduler timezone '{scheduler_setting.setting_value}' is valid")
            else:
                print("📝 Creating task_scheduler_timezone setting...")
                await system_service.create_setting(
                    setting_key='task_scheduler_timezone',
                    setting_name='Task Scheduler Timezone',
                    setting_type=SettingType.STRING,
                    setting_category=SettingCategory.SYSTEM,
                    setting_value='Asia/Kolkata',
                    default_value='Asia/Kolkata',
                    description='Timezone for scheduled tasks (IST by default)',
                    is_system=True,
                    validation_rules={
                        'type': 'timezone',
                        'choices': [
                            'Asia/Kolkata', 'UTC', 'US/Eastern', 'US/Central',
                            'US/Mountain', 'US/Pacific', 'Europe/London', 'Europe/Paris',
                            'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
                            'Asia/Dubai', 'Asia/Singapore'
                        ]
                    },
                    display_order='7'
                )
                print("✅ Created task_scheduler_timezone setting")
            
            # Clear timezone cache to ensure new settings are picked up
            TimezoneManager.invalidate_cache()
            print("🔄 Cleared timezone cache")
            
            # Test the timezone functionality
            print("\n🧪 Testing timezone functionality...")
            
            # Get the system timezone
            system_tz = TimezoneManager.get_system_timezone_sync()
            print(f"📍 System timezone: {system_tz.zone}")
            
            # Test current time in different formats
            from app.core.timezone import utc_now, system_now, format_datetime_output
            
            utc_time = utc_now()
            system_time = system_now()
            
            print(f"🕐 UTC time: {utc_time}")
            print(f"🕕 System time: {system_time}")
            print(f"🕘 Formatted for API: {format_datetime_output(utc_time)}")
            
            print("\n✨ Timezone settings initialized successfully!")
            
        except Exception as e:
            print(f"❌ Error initializing timezone settings: {e}")
            raise
        finally:
            await session.close()


async def verify_timezone_settings():
    """Verify that timezone settings are working correctly."""
    print("\n🔍 Verifying timezone settings...")
    
    async for session in get_db():
        try:
            system_service = SystemService(session)
            
            # Get system timezone setting
            system_tz_value = await system_service.get_setting_value('system_timezone', 'UTC')
            scheduler_tz_value = await system_service.get_setting_value('task_scheduler_timezone', 'UTC')
            
            print(f"📋 System timezone setting: {system_tz_value}")
            print(f"📋 Scheduler timezone setting: {scheduler_tz_value}")
            
            # Validate timezones
            if validate_timezone_name(system_tz_value):
                print(f"✅ System timezone '{system_tz_value}' is valid")
            else:
                print(f"❌ System timezone '{system_tz_value}' is invalid")
                return False
                
            if validate_timezone_name(scheduler_tz_value):
                print(f"✅ Scheduler timezone '{scheduler_tz_value}' is valid")
            else:
                print(f"❌ Scheduler timezone '{scheduler_tz_value}' is invalid")
                return False
            
            # Test timezone conversion
            from app.core.timezone import parse_datetime_input, format_datetime_output
            from datetime import datetime
            
            # Test with IST input
            test_input = "2024-01-29T15:30:00+05:30"
            parsed_utc = parse_datetime_input(test_input)
            formatted_output = format_datetime_output(parsed_utc)
            
            print(f"🔄 Test conversion:")
            print(f"   Input (IST): {test_input}")
            print(f"   Parsed (UTC): {parsed_utc}")
            print(f"   Output (System TZ): {formatted_output}")
            
            # Verify the conversion is correct
            expected_utc_hour = 10  # 15:30 IST = 10:00 UTC
            if parsed_utc.hour == expected_utc_hour:
                print("✅ Timezone conversion working correctly")
            else:
                print(f"❌ Timezone conversion error: expected UTC hour {expected_utc_hour}, got {parsed_utc.hour}")
                return False
            
            print("✅ All timezone settings verified successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Error verifying timezone settings: {e}")
            return False
        finally:
            await session.close()


async def main():
    """Main function to initialize and verify timezone settings."""
    print("🚀 Starting timezone settings initialization...")
    print("=" * 60)
    
    try:
        # Initialize timezone settings
        await initialize_timezone_settings()
        
        # Verify settings
        success = await verify_timezone_settings()
        
        print("\n" + "=" * 60)
        if success:
            print("🎉 Timezone settings initialization completed successfully!")
            print("\n📝 Summary:")
            print("   • System timezone: Asia/Kolkata (IST)")
            print("   • Scheduler timezone: Asia/Kolkata (IST)")
            print("   • API input: Accepts any timezone, converts to UTC for storage")
            print("   • API output: Converts UTC to system timezone (IST)")
            print("   • Database: All datetimes stored in UTC")
        else:
            print("❌ Timezone settings initialization failed!")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n❌ Fatal error during initialization: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())