#!/usr/bin/env python3
"""
Railway Admin Setup Script

This comprehensive script ensures admin user creation in Railway deployments
with detailed logging, error handling, and multiple fallback strategies.
"""

import asyncio
import sys
import os
import logging
import traceback
from typing import Optional, Dict, Any
from datetime import datetime

# Add app directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

# Configure detailed logging
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=log_format)
logger = logging.getLogger(__name__)

# Add a file handler for persistent logging
log_file = '/tmp/railway_admin_setup.log'
file_handler = logging.FileHandler(log_file)
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(logging.Formatter(log_format))
logger.addHandler(file_handler)


class RailwayAdminSetup:
    """
    Comprehensive admin setup for Railway deployments with multiple strategies
    """
    
    def __init__(self):
        self.setup_results = {
            "timestamp": datetime.utcnow().isoformat(),
            "environment_check": False,
            "database_connection": False,
            "table_creation": False,
            "admin_creation": False,
            "validation": False,
            "errors": [],
            "warnings": []
        }
    
    async def validate_environment(self) -> bool:
        """Validate all required environment variables"""
        logger.info("🔍 Validating environment configuration...")
        
        try:
            # Import and validate settings
            from app.core.config import settings, Settings
            
            # Test settings instantiation (will raise ValueError if invalid)
            test_settings = Settings()
            
            # Log environment info (masked for security)
            logger.info(f"✅ Admin Username: {settings.ADMIN_USERNAME}")
            logger.info(f"✅ Admin Email: {settings.ADMIN_EMAIL}")
            logger.info(f"✅ Admin Full Name: {settings.ADMIN_FULL_NAME}")
            logger.info(f"✅ Admin Password Length: {len(settings.ADMIN_PASSWORD)} characters")
            
            # Database URL
            db_info = settings.DATABASE_URL.split('@')[1].split('/')[0] if '@' in settings.DATABASE_URL else "localhost"
            logger.info(f"✅ Database Host: {db_info}")
            
            # Secret key
            secret_valid = settings.SECRET_KEY and settings.SECRET_KEY != "your-secret-key-here-change-in-production"
            logger.info(f"✅ Secret Key: {'Valid' if secret_valid else 'Using default (INSECURE)'}")
            
            if not secret_valid:
                self.setup_results["warnings"].append("Using default SECRET_KEY - this is insecure for production")
            
            self.setup_results["environment_check"] = True
            logger.info("✅ Environment validation passed")
            return True
            
        except ValueError as e:
            error_msg = f"Environment validation failed: {str(e)}"
            logger.error(f"❌ {error_msg}")
            self.setup_results["errors"].append(error_msg)
            return False
        except Exception as e:
            error_msg = f"Unexpected error during environment validation: {str(e)}"
            logger.error(f"❌ {error_msg}")
            self.setup_results["errors"].append(error_msg)
            return False
    
    async def test_database_connection(self) -> bool:
        """Test database connectivity with detailed diagnostics"""
        logger.info("🔗 Testing database connection...")
        
        try:
            from app.core.config import settings
            from sqlalchemy.ext.asyncio import create_async_engine
            from sqlalchemy import text
            
            # Ensure proper async URL format
            DATABASE_URL = settings.DATABASE_URL
            if DATABASE_URL.startswith('postgres://'):
                DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql+asyncpg://', 1)
            elif DATABASE_URL.startswith('postgresql://') and '+asyncpg' not in DATABASE_URL:
                DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://', 1)
            
            logger.info(f"Database URL format: {DATABASE_URL.split('@')[0]}@[HOST]/[DB]")
            
            # Create engine with connection timeout
            engine = create_async_engine(
                DATABASE_URL,
                echo=False,
                pool_pre_ping=True,
                pool_timeout=30,
                connect_args={"server_settings": {"application_name": "railway_admin_setup"}}
            )
            
            # Test basic connection
            async with engine.begin() as conn:
                result = await conn.execute(text('SELECT 1 as test, version() as pg_version'))
                row = result.fetchone()
                logger.info(f"✅ Database connection successful (test: {row[0]})")
                logger.info(f"✅ PostgreSQL version: {row[1]}")
                
                # Test transaction capability
                await conn.execute(text('SELECT NOW() as current_time'))
                logger.info("✅ Transaction capability confirmed")
            
            await engine.dispose()
            self.setup_results["database_connection"] = True
            return True
            
        except Exception as e:
            error_msg = f"Database connection failed: {str(e)}"
            logger.error(f"❌ {error_msg}")
            self.setup_results["errors"].append(error_msg)
            
            # Provide specific troubleshooting advice
            if "connection refused" in str(e).lower():
                self.setup_results["errors"].append("Troubleshooting: Database server is not accepting connections")
            elif "authentication failed" in str(e).lower():
                self.setup_results["errors"].append("Troubleshooting: Database authentication failed - check credentials")
            elif "does not exist" in str(e).lower():
                self.setup_results["errors"].append("Troubleshooting: Database does not exist")
            
            return False
    
    async def initialize_database_tables(self) -> bool:
        """Create all database tables"""
        logger.info("🏗️  Initializing database tables...")
        
        try:
            from app.core.config import settings
            from sqlalchemy.ext.asyncio import create_async_engine
            from sqlalchemy import text
            from app.db.base import Base
            
            # Import all models to ensure they're registered
            logger.info("📦 Importing all models...")
            model_imports = [
                'app.modules.auth.models',
                'app.modules.users.models',
                'app.modules.company.models',
                'app.modules.customers.models',
                'app.modules.suppliers.models',
                'app.modules.master_data.brands.models',
                'app.modules.master_data.categories.models',
                'app.modules.master_data.locations.models',
                'app.modules.master_data.units.models',
                'app.modules.master_data.item_master.models',
                'app.modules.inventory.models',
                'app.modules.transactions.base.models.transaction_headers',
                'app.modules.transactions.base.models.transaction_lines',
                'app.modules.transactions.base.models.rental_lifecycle',
                'app.modules.system.models'
            ]
            
            imported_count = 0
            for module_name in model_imports:
                try:
                    __import__(module_name)
                    imported_count += 1
                except ImportError as e:
                    logger.warning(f"⚠️  Could not import {module_name}: {e}")
            
            logger.info(f"✅ Successfully imported {imported_count}/{len(model_imports)} model modules")
            logger.info(f"✅ Found {len(Base.metadata.tables)} table definitions")
            
            # Create engine
            DATABASE_URL = settings.DATABASE_URL
            if DATABASE_URL.startswith('postgres://'):
                DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql+asyncpg://', 1)
            elif DATABASE_URL.startswith('postgresql://') and '+asyncpg' not in DATABASE_URL:
                DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://', 1)
            
            engine = create_async_engine(DATABASE_URL, echo=False)
            
            # Create all tables
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                logger.info("✅ All tables created/verified successfully")
                
                # Verify critical tables exist
                critical_tables = ['users', 'refresh_tokens', 'companies', 'items', 'inventory']
                for table_name in critical_tables:
                    result = await conn.execute(text(f"""
                        SELECT COUNT(*) FROM information_schema.tables 
                        WHERE table_name = '{table_name}' AND table_schema = 'public'
                    """))
                    if result.scalar() > 0:
                        logger.info(f"✅ Critical table '{table_name}' exists")
                    else:
                        logger.warning(f"⚠️  Critical table '{table_name}' not found")
                
                # Get total table count
                result = await conn.execute(text("""
                    SELECT COUNT(*) FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """))
                table_count = result.scalar()
                logger.info(f"✅ Database now has {table_count} tables")
            
            await engine.dispose()
            self.setup_results["table_creation"] = True
            return True
            
        except Exception as e:
            error_msg = f"Database table initialization failed: {str(e)}"
            logger.error(f"❌ {error_msg}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            self.setup_results["errors"].append(error_msg)
            return False
    
    async def create_admin_user(self) -> bool:
        """Create admin user with comprehensive error handling"""
        logger.info("👤 Creating admin user...")
        
        try:
            from app.core.config import settings
            from app.core.database import AsyncSessionLocal
            from app.modules.users.services import UserService
            from sqlalchemy import text
            
            async with AsyncSessionLocal() as session:
                # First, verify users table exists and is accessible
                try:
                    result = await session.execute(text("SELECT COUNT(*) FROM users"))
                    user_count = result.scalar()
                    logger.info(f"✅ Users table accessible (current count: {user_count})")
                except Exception as e:
                    logger.error(f"❌ Cannot access users table: {e}")
                    self.setup_results["errors"].append(f"Users table not accessible: {str(e)}")
                    return False
                
                user_service = UserService(session)
                
                # Check if admin user already exists
                existing_admin = await user_service.get_by_username(settings.ADMIN_USERNAME)
                if existing_admin:
                    logger.info(f"✅ Admin user '{settings.ADMIN_USERNAME}' already exists")
                    
                    # Verify password
                    from app.core.security import verify_password
                    if verify_password(settings.ADMIN_PASSWORD, existing_admin.password):
                        logger.info("✅ Existing admin password verification successful")
                        self.setup_results["admin_creation"] = True
                        return True
                    else:
                        logger.warning("⚠️  Existing admin password verification failed - will recreate")
                        await user_service.delete(existing_admin.id)
                        await session.commit()
                        logger.info("✅ Old admin user deleted")
                
                # Create new admin user
                admin_data = {
                    "username": settings.ADMIN_USERNAME,
                    "email": settings.ADMIN_EMAIL,
                    "password": settings.ADMIN_PASSWORD,  # UserService will hash this
                    "full_name": settings.ADMIN_FULL_NAME,
                    "is_active": True,
                    "is_superuser": True,
                    "is_verified": True
                }
                
                logger.info(f"Creating admin user with username: {settings.ADMIN_USERNAME}")
                admin_user = await user_service.create(admin_data)
                
                logger.info(f"✅ Admin user created successfully:")
                logger.info(f"   - ID: {admin_user.id}")
                logger.info(f"   - Username: {admin_user.username}")
                logger.info(f"   - Email: {admin_user.email}")
                logger.info(f"   - Full Name: {admin_user.full_name}")
                logger.info(f"   - Is Active: {admin_user.is_active}")
                logger.info(f"   - Is Superuser: {admin_user.is_superuser}")
                logger.info(f"   - Is Verified: {admin_user.is_verified}")
                
                self.setup_results["admin_creation"] = True
                return True
                
        except Exception as e:
            error_msg = f"Admin user creation failed: {str(e)}"
            logger.error(f"❌ {error_msg}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            self.setup_results["errors"].append(error_msg)
            return False
    
    async def validate_admin_setup(self) -> bool:
        """Validate that admin user is properly set up and functional"""
        logger.info("🔍 Validating admin user setup...")
        
        try:
            from app.core.config import settings
            from app.core.database import AsyncSessionLocal
            from app.modules.users.services import UserService
            from app.core.security import verify_password
            
            async with AsyncSessionLocal() as session:
                user_service = UserService(session)
                
                # Get admin user
                admin_user = await user_service.get_by_username(settings.ADMIN_USERNAME)
                if not admin_user:
                    error_msg = f"Admin user '{settings.ADMIN_USERNAME}' not found after creation"
                    logger.error(f"❌ {error_msg}")
                    self.setup_results["errors"].append(error_msg)
                    return False
                
                # Validate all properties
                validations = [
                    ("exists", admin_user is not None),
                    ("is_active", admin_user.is_active),
                    ("is_superuser", admin_user.is_superuser),
                    ("is_verified", admin_user.is_verified),
                    ("has_password", bool(admin_user.password)),
                    ("password_format", admin_user.password.startswith('$2b$') if admin_user.password else False),
                    ("password_verify", verify_password(settings.ADMIN_PASSWORD, admin_user.password) if admin_user.password else False)
                ]
                
                all_valid = True
                for validation_name, is_valid in validations:
                    if is_valid:
                        logger.info(f"✅ {validation_name}: PASS")
                    else:
                        logger.error(f"❌ {validation_name}: FAIL")
                        all_valid = False
                
                if all_valid:
                    logger.info("🎉 Admin user validation PASSED - login should work correctly")
                    logger.info(f"📋 Login credentials:")
                    logger.info(f"   Username: {settings.ADMIN_USERNAME}")
                    logger.info(f"   Password: {settings.ADMIN_PASSWORD[:8]}...")
                    self.setup_results["validation"] = True
                    return True
                else:
                    error_msg = "Admin user validation failed - some properties are incorrect"
                    logger.error(f"❌ {error_msg}")
                    self.setup_results["errors"].append(error_msg)
                    return False
                    
        except Exception as e:
            error_msg = f"Admin validation failed: {str(e)}"
            logger.error(f"❌ {error_msg}")
            self.setup_results["errors"].append(error_msg)
            return False
    
    async def run_setup(self) -> Dict[str, Any]:
        """Run the complete admin setup process"""
        logger.info("🚀 Starting Railway Admin Setup Process")
        logger.info("=" * 60)
        
        # Step 1: Environment validation
        if not await self.validate_environment():
            logger.error("❌ Environment validation failed - cannot proceed")
            return self.setup_results
        
        # Step 2: Database connection
        if not await self.test_database_connection():
            logger.error("❌ Database connection failed - cannot proceed")
            return self.setup_results
        
        # Step 3: Database table initialization
        if not await self.initialize_database_tables():
            logger.error("❌ Database table initialization failed - cannot proceed")
            return self.setup_results
        
        # Step 4: Admin user creation
        if not await self.create_admin_user():
            logger.error("❌ Admin user creation failed")
            return self.setup_results
        
        # Step 5: Validation
        if not await self.validate_admin_setup():
            logger.error("❌ Admin setup validation failed")
            return self.setup_results
        
        # Success!
        logger.info("🎉 Railway Admin Setup COMPLETED SUCCESSFULLY!")
        logger.info("=" * 60)
        return self.setup_results
    
    def print_summary(self):
        """Print a summary of the setup process"""
        results = self.setup_results
        
        print("\n" + "=" * 50)
        print("🏁 RAILWAY ADMIN SETUP SUMMARY")
        print("=" * 50)
        
        # Status overview
        steps = [
            ("Environment Check", results["environment_check"]),
            ("Database Connection", results["database_connection"]),
            ("Table Creation", results["table_creation"]),
            ("Admin Creation", results["admin_creation"]),
            ("Validation", results["validation"])
        ]
        
        for step_name, status in steps:
            icon = "✅" if status else "❌"
            print(f"{icon} {step_name}: {'PASS' if status else 'FAIL'}")
        
        # Errors
        if results["errors"]:
            print(f"\n❌ ERRORS ({len(results['errors'])}):")
            for i, error in enumerate(results["errors"], 1):
                print(f"   {i}. {error}")
        
        # Warnings
        if results["warnings"]:
            print(f"\n⚠️  WARNINGS ({len(results['warnings'])}):")
            for i, warning in enumerate(results["warnings"], 1):
                print(f"   {i}. {warning}")
        
        # Overall status
        overall_success = all([
            results["environment_check"],
            results["database_connection"],
            results["table_creation"],
            results["admin_creation"],
            results["validation"]
        ])
        
        if overall_success:
            print(f"\n🎉 SETUP SUCCESSFUL!")
            print("The admin user is ready for login.")
        else:
            print(f"\n❌ SETUP FAILED!")
            print("Check the errors above and retry.")
        
        print(f"\nLog file: {log_file}")
        print("=" * 50)


async def main():
    """Main function"""
    setup = RailwayAdminSetup()
    
    try:
        results = await setup.run_setup()
        setup.print_summary()
        
        # Exit with appropriate code
        overall_success = all([
            results["environment_check"],
            results["database_connection"],
            results["table_creation"],
            results["admin_creation"],
            results["validation"]
        ])
        
        if overall_success:
            print("\n✅ Admin setup completed successfully!")
            sys.exit(0)
        else:
            print("\n❌ Admin setup failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("Setup cancelled by user")
        print("\n⏹️  Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        print(f"\n💥 Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())