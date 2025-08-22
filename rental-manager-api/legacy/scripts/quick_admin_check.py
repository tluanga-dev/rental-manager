#!/usr/bin/env python3
"""
Quick Admin Check Script

Simple script to quickly verify admin user status in Railway deployment.
Can be run remotely or in Railway console.
"""

import asyncio
import sys
import os
import json
from datetime import datetime

# Add app directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)


async def quick_admin_check():
    """Quick check of admin user status"""
    result = {
        "timestamp": datetime.utcnow().isoformat(),
        "status": "unknown",
        "admin_exists": False,
        "admin_valid": False,
        "environment_ok": False,
        "database_ok": False,
        "message": "",
        "details": {}
    }
    
    try:
        # 1. Check environment
        print("🔍 Checking environment...")
        from app.core.config import settings
        result["environment_ok"] = True
        result["details"]["admin_username"] = settings.ADMIN_USERNAME
        result["details"]["admin_email"] = settings.ADMIN_EMAIL
        print(f"✅ Environment OK - Admin: {settings.ADMIN_USERNAME}")
        
        # 2. Check database
        print("🔗 Checking database...")
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import text
        
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            result["database_ok"] = True
            print("✅ Database connection OK")
        
        # 3. Check admin user
        print("👤 Checking admin user...")
        from app.modules.users.services import UserService
        from app.core.security import verify_password
        
        async with AsyncSessionLocal() as session:
            user_service = UserService(session)
            admin_user = await user_service.get_by_username(settings.ADMIN_USERNAME)
            
            if admin_user:
                result["admin_exists"] = True
                result["details"]["admin_id"] = admin_user.id
                result["details"]["is_active"] = admin_user.is_active
                result["details"]["is_superuser"] = admin_user.is_superuser
                result["details"]["is_verified"] = admin_user.is_verified
                
                # Test password
                password_valid = verify_password(settings.ADMIN_PASSWORD, admin_user.password)
                result["admin_valid"] = password_valid
                result["details"]["password_valid"] = password_valid
                
                if password_valid and admin_user.is_active and admin_user.is_superuser:
                    result["status"] = "success"
                    result["message"] = "Admin user is ready for login"
                    print("✅ Admin user is valid and ready for login")
                else:
                    result["status"] = "invalid"
                    result["message"] = "Admin user exists but has issues"
                    print("⚠️  Admin user exists but has validation issues")
            else:
                result["status"] = "not_found"
                result["message"] = "Admin user does not exist"
                print("❌ Admin user not found")
        
    except Exception as e:
        result["status"] = "error"
        result["message"] = f"Error during check: {str(e)}"
        print(f"❌ Error: {e}")
    
    return result


async def main():
    print("=" * 50)
    print("🚀 Quick Admin Check")
    print("=" * 50)
    
    result = await quick_admin_check()
    
    print("\n📊 SUMMARY:")
    print("-" * 30)
    print(f"Status: {result['status'].upper()}")
    print(f"Environment: {'✅ OK' if result['environment_ok'] else '❌ FAIL'}")
    print(f"Database: {'✅ OK' if result['database_ok'] else '❌ FAIL'}")
    print(f"Admin Exists: {'✅ YES' if result['admin_exists'] else '❌ NO'}")
    print(f"Admin Valid: {'✅ YES' if result['admin_valid'] else '❌ NO'}")
    print(f"Message: {result['message']}")
    
    if result['details']:
        print(f"\n📋 Details:")
        for key, value in result['details'].items():
            print(f"  {key}: {value}")
    
    # Output JSON for automated processing
    print(f"\n📄 JSON Result:")
    print(json.dumps(result, indent=2))
    
    # Exit code based on status
    if result['status'] == 'success':
        print("\n🎉 Admin check PASSED!")
        sys.exit(0)
    else:
        print("\n❌ Admin check FAILED!")
        print("\n💡 Try these solutions:")
        if not result['environment_ok']:
            print("  - Check environment variables")
        if not result['database_ok']:
            print("  - Check database connection")
        if not result['admin_exists']:
            print("  - Run: python scripts/railway_admin_setup.py")
            print("  - Or use API: POST /api/admin/create")
        if result['admin_exists'] and not result['admin_valid']:
            print("  - Run: python scripts/railway_admin_setup.py")
            print("  - Or use API: POST /api/admin/recreate")
        
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())