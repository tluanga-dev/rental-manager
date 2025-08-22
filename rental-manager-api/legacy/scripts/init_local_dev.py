#!/usr/bin/env python3
"""
Local Development Initialization Script

This script sets up the local development environment:
1. Checks database connection
2. Runs database migrations
3. Creates admin user from environment variables
4. Seeds initial RBAC permissions
5. Initializes system settings
6. Optionally seeds master data
"""

import asyncio
import sys
import os
import logging
import subprocess
from pathlib import Path

# Add app directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def check_database_connection() -> bool:
    """Check if database is accessible"""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            logger.info("✅ Database connection successful")
            return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False


def run_alembic_migrations() -> bool:
    """Run database migrations using Alembic"""
    try:
        logger.info("Running database migrations...")
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=parent_dir,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            logger.info("✅ Database migrations completed successfully")
            if result.stdout:
                logger.info(f"Migration output: {result.stdout}")
            return True
        else:
            logger.error(f"❌ Database migrations failed: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error running migrations: {e}")
        return False


async def run_python_script(script_name: str, description: str) -> bool:
    """Run a Python script and return success status"""
    try:
        logger.info(f"Running: {description}")
        
        # Import and run the script's main function
        if script_name == "create_admin.py":
            from scripts.create_admin import main as admin_main
            await admin_main()
        elif script_name == "seed_rbac.py":
            from scripts.seed_rbac import main as rbac_main
            await rbac_main()
        elif script_name == "init_system_settings.py":
            from scripts.init_system_settings import main as settings_main
            await settings_main()
        else:
            logger.warning(f"Unknown script: {script_name}")
            return False
        
        logger.info(f"✅ {description} completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ {description} failed: {e}")
        return False


async def check_admin_user() -> bool:
    """Verify admin user exists and can be authenticated"""
    try:
        async with AsyncSessionLocal() as session:
            from app.modules.users.services import UserService
            user_service = UserService(session)
            
            admin_user = await user_service.get_by_username(settings.ADMIN_USERNAME)
            if admin_user:
                logger.info(f"✅ Admin user '{settings.ADMIN_USERNAME}' exists")
                return True
            else:
                logger.error(f"❌ Admin user '{settings.ADMIN_USERNAME}' not found")
                return False
                
    except Exception as e:
        logger.error(f"❌ Error checking admin user: {e}")
        return False


def check_env_file() -> bool:
    """Check if .env file exists"""
    env_file = Path(parent_dir) / ".env"
    if env_file.exists():
        logger.info("✅ .env file found")
        return True
    else:
        logger.warning("⚠️  .env file not found")
        logger.info("Please copy .env.example to .env and configure your settings:")
        logger.info("  cp .env.example .env")
        return False


async def main():
    """Main initialization function"""
    print("🚀 Local Development Environment Initialization")
    print("=" * 60)
    
    # Check environment file
    if not check_env_file():
        logger.info("You can continue without .env file using defaults, but it's recommended to create one.")
        proceed = input("Continue anyway? (y/N): ").lower().strip()
        if proceed != 'y':
            sys.exit(1)
    
    # Display configuration
    print("\n📋 Configuration Summary:")
    print(f"  Database URL: {settings.DATABASE_URL}")
    print(f"  Redis URL: {settings.REDIS_URL}")
    print(f"  Admin Username: {settings.ADMIN_USERNAME}")
    print(f"  Admin Email: {settings.ADMIN_EMAIL}")
    print(f"  Debug Mode: {settings.DEBUG}")
    
    # Check database connection
    if not await check_database_connection():
        logger.error("Cannot proceed without database connection.")
        logger.info("Please ensure PostgreSQL is running and DATABASE_URL is correct.")
        sys.exit(1)
    
    # Run database migrations
    if not run_alembic_migrations():
        logger.error("Database migrations failed. Cannot proceed.")
        sys.exit(1)
    
    # Initialize components
    print("\n🔧 Initializing System Components:")
    print("-" * 40)
    
    initialization_steps = [
        ("create_admin.py", "Creating admin user"),
        ("seed_rbac.py", "Seeding RBAC permissions"),
        ("init_system_settings.py", "Initializing system settings"),
    ]
    
    success_count = 0
    for script, description in initialization_steps:
        if await run_python_script(script, description):
            success_count += 1
        else:
            logger.warning(f"⚠️  {description} had issues but continuing...")
    
    # Final verification
    print("\n🔍 Verification:")
    print("-" * 20)
    
    admin_exists = await check_admin_user()
    
    # Summary
    print("\n📊 Initialization Summary:")
    print("-" * 30)
    print(f"  Steps completed: {success_count}/{len(initialization_steps)}")
    print(f"  Admin user: {'✅ Ready' if admin_exists else '❌ Failed'}")
    
    if success_count == len(initialization_steps) and admin_exists:
        print("\n🎉 Local development environment is ready!")
        print("\n🚀 To start the development server:")
        print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        print("\n🔐 Admin Login Credentials:")
        print(f"  Username: {settings.ADMIN_USERNAME}")
        print(f"  Password: {settings.ADMIN_PASSWORD[:8]}...")
        print("\n📱 Frontend should be accessible at: http://localhost:3000")
        print("📡 Backend API docs at: http://localhost:8000/docs")
    else:
        print("\n⚠️  Some initialization steps failed.")
        print("Review the errors above and retry or run individual scripts manually.")
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️  Initialization cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)