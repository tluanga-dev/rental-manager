#!/usr/bin/env python3
"""
Comprehensive Admin Creation Testing

This script tests admin user creation and authentication across different scenarios:
1. Environment variable validation
2. Database admin creation
3. API authentication
4. Edge cases and error handling
"""

import asyncio
import sys
import os
import logging
import tempfile
import subprocess
from pathlib import Path

# Add app directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AdminCreationTester:
    """Comprehensive admin creation testing"""
    
    def __init__(self):
        self.test_results = {}
        self.original_env = {}
    
    def setup_test_env(self, env_vars: dict):
        """Set up test environment variables"""
        self.original_env = {}
        for key, value in env_vars.items():
            self.original_env[key] = os.environ.get(key)
            os.environ[key] = value
    
    def restore_env(self):
        """Restore original environment variables"""
        for key, value in self.original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
    
    async def test_valid_admin_config(self) -> bool:
        """Test valid admin configuration"""
        logger.info("Testing valid admin configuration...")
        
        try:
            test_env = {
                'ADMIN_USERNAME': 'testadmin',
                'ADMIN_EMAIL': 'test@admin.com',
                'ADMIN_PASSWORD': 'Test@Admin123!',
                'ADMIN_FULL_NAME': 'Test Administrator'
            }
            
            self.setup_test_env(test_env)
            
            # Import and validate settings
            from app.core.config import Settings
            settings = Settings()
            
            assert settings.ADMIN_USERNAME == 'testadmin'
            assert settings.ADMIN_EMAIL == 'test@admin.com'
            assert settings.ADMIN_PASSWORD == 'Test@Admin123!'
            assert settings.ADMIN_FULL_NAME == 'Test Administrator'
            
            logger.info("✅ Valid admin configuration test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Valid admin configuration test failed: {e}")
            return False
        finally:
            self.restore_env()
    
    async def test_invalid_password(self) -> bool:
        """Test invalid password validation"""
        logger.info("Testing invalid password validation...")
        
        invalid_passwords = [
            ('weak', 'Too short'),
            ('WeakPassword', 'No special characters or numbers'),
            ('weak@password', 'No uppercase'),
            ('WEAK@PASSWORD', 'No lowercase'),
            ('Weak@Password', 'No numbers'),
            ('WeakPassword123', 'No special characters')
        ]
        
        passed_tests = 0
        for password, description in invalid_passwords:
            try:
                test_env = {
                    'ADMIN_USERNAME': 'testadmin',
                    'ADMIN_EMAIL': 'test@admin.com',
                    'ADMIN_PASSWORD': password,
                    'ADMIN_FULL_NAME': 'Test Administrator'
                }
                
                self.setup_test_env(test_env)
                
                from app.core.config import Settings
                # This should raise ValueError
                settings = Settings()
                
                logger.error(f"❌ Password '{password}' should have been rejected ({description})")
                
            except ValueError as e:
                logger.info(f"✅ Password '{password}' correctly rejected: {description}")
                passed_tests += 1
            except Exception as e:
                logger.error(f"❌ Unexpected error testing password '{password}': {e}")
            finally:
                self.restore_env()
        
        success = passed_tests == len(invalid_passwords)
        if success:
            logger.info("✅ Invalid password validation test passed")
        else:
            logger.error(f"❌ Invalid password validation test failed: {passed_tests}/{len(invalid_passwords)} passed")
        
        return success
    
    async def test_invalid_email(self) -> bool:
        """Test invalid email validation"""
        logger.info("Testing invalid email validation...")
        
        invalid_emails = [
            'not-an-email',
            'missing@domain',
            '@missing-local.com',
            'spaces in@email.com',
            'double@@domain.com'
        ]
        
        passed_tests = 0
        for email in invalid_emails:
            try:
                test_env = {
                    'ADMIN_USERNAME': 'testadmin',
                    'ADMIN_EMAIL': email,
                    'ADMIN_PASSWORD': 'Test@Admin123!',
                    'ADMIN_FULL_NAME': 'Test Administrator'
                }
                
                self.setup_test_env(test_env)
                
                from app.core.config import Settings
                # This should raise ValueError
                settings = Settings()
                
                logger.error(f"❌ Email '{email}' should have been rejected")
                
            except ValueError as e:
                logger.info(f"✅ Email '{email}' correctly rejected")
                passed_tests += 1
            except Exception as e:
                logger.error(f"❌ Unexpected error testing email '{email}': {e}")
            finally:
                self.restore_env()
        
        success = passed_tests == len(invalid_emails)
        if success:
            logger.info("✅ Invalid email validation test passed")
        else:
            logger.error(f"❌ Invalid email validation test failed: {passed_tests}/{len(invalid_emails)} passed")
        
        return success
    
    async def test_invalid_username(self) -> bool:
        """Test invalid username validation"""
        logger.info("Testing invalid username validation...")
        
        invalid_usernames = [
            ('ab', 'Too short'),
            ('a' * 60, 'Too long'),
            ('user-name', 'Contains dash'),
            ('user name', 'Contains space'),
            ('user@name', 'Contains special chars'),
            ('', 'Empty string')
        ]
        
        passed_tests = 0
        for username, description in invalid_usernames:
            try:
                test_env = {
                    'ADMIN_USERNAME': username,
                    'ADMIN_EMAIL': 'test@admin.com',
                    'ADMIN_PASSWORD': 'Test@Admin123!',
                    'ADMIN_FULL_NAME': 'Test Administrator'
                }
                
                self.setup_test_env(test_env)
                
                from app.core.config import Settings
                # This should raise ValueError
                settings = Settings()
                
                logger.error(f"❌ Username '{username}' should have been rejected ({description})")
                
            except ValueError as e:
                logger.info(f"✅ Username '{username}' correctly rejected: {description}")
                passed_tests += 1
            except Exception as e:
                logger.error(f"❌ Unexpected error testing username '{username}': {e}")
            finally:
                self.restore_env()
        
        success = passed_tests == len(invalid_usernames)
        if success:
            logger.info("✅ Invalid username validation test passed")
        else:
            logger.error(f"❌ Invalid username validation test failed: {passed_tests}/{len(invalid_usernames)} passed")
        
        return success
    
    async def test_database_admin_creation(self) -> bool:
        """Test admin creation in database"""
        logger.info("Testing database admin creation...")
        
        try:
            # Set up test environment
            test_env = {
                'ADMIN_USERNAME': 'dbtest_admin',
                'ADMIN_EMAIL': 'dbtest@admin.com',
                'ADMIN_PASSWORD': 'DBTest@Admin123!',
                'ADMIN_FULL_NAME': 'Database Test Administrator'
            }
            
            self.setup_test_env(test_env)
            
            from app.core.database import AsyncSessionLocal
            from app.modules.users.services import UserService
            from app.core.config import settings
            
            # First, clean up any existing test user
            async with AsyncSessionLocal() as session:
                user_service = UserService(session)
                existing_user = await user_service.get_by_username('dbtest_admin')
                if existing_user:
                    await user_service.delete(existing_user.id)
                    await session.commit()
            
            # Import and run create_admin main function
            from scripts.create_admin import main as create_admin_main
            await create_admin_main()
            
            # Verify admin was created
            async with AsyncSessionLocal() as session:
                user_service = UserService(session)
                admin_user = await user_service.get_by_username('dbtest_admin')
                
                if not admin_user:
                    logger.error("❌ Admin user not found in database")
                    return False
                
                # Verify user properties
                assert admin_user.email == 'dbtest@admin.com'
                assert admin_user.full_name == 'Database Test Administrator'
                assert admin_user.is_active == True
                assert admin_user.is_superuser == True
                assert admin_user.is_verified == True
                
                # Verify password
                from app.core.security import verify_password
                if not verify_password('DBTest@Admin123!', admin_user.password):
                    logger.error("❌ Admin password verification failed")
                    return False
                
                # Clean up test user
                await user_service.delete(admin_user.id)
                await session.commit()
            
            logger.info("✅ Database admin creation test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Database admin creation test failed: {e}")
            return False
        finally:
            self.restore_env()
    
    async def test_idempotent_creation(self) -> bool:
        """Test that admin creation is idempotent (can run multiple times)"""
        logger.info("Testing idempotent admin creation...")
        
        try:
            # Set up test environment
            test_env = {
                'ADMIN_USERNAME': 'idempotent_admin',
                'ADMIN_EMAIL': 'idempotent@admin.com',
                'ADMIN_PASSWORD': 'Idempotent@Admin123!',
                'ADMIN_FULL_NAME': 'Idempotent Test Administrator'
            }
            
            self.setup_test_env(test_env)
            
            from app.core.database import AsyncSessionLocal
            from app.modules.users.services import UserService
            
            # Clean up any existing test user
            async with AsyncSessionLocal() as session:
                user_service = UserService(session)
                existing_user = await user_service.get_by_username('idempotent_admin')
                if existing_user:
                    await user_service.delete(existing_user.id)
                    await session.commit()
            
            # Import and run create_admin main function twice
            from scripts.create_admin import main as create_admin_main
            
            # First run - should create user
            await create_admin_main()
            
            # Second run - should not fail (idempotent)
            await create_admin_main()
            
            # Verify only one admin exists
            async with AsyncSessionLocal() as session:
                user_service = UserService(session)
                admin_user = await user_service.get_by_username('idempotent_admin')
                
                if not admin_user:
                    logger.error("❌ Admin user not found after idempotent test")
                    return False
                
                # Clean up test user
                await user_service.delete(admin_user.id)
                await session.commit()
            
            logger.info("✅ Idempotent admin creation test passed")
            return True
            
        except Exception as e:
            logger.error(f"❌ Idempotent admin creation test failed: {e}")
            return False
        finally:
            self.restore_env()
    
    async def run_all_tests(self):
        """Run all admin creation tests"""
        tests = [
            ('valid_config', self.test_valid_admin_config),
            ('invalid_password', self.test_invalid_password),
            ('invalid_email', self.test_invalid_email),
            ('invalid_username', self.test_invalid_username),
            ('database_creation', self.test_database_admin_creation),
            ('idempotent_creation', self.test_idempotent_creation),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                result = await test_func()
                self.test_results[test_name] = result
                if result:
                    passed += 1
            except Exception as e:
                logger.error(f"❌ Test {test_name} failed with exception: {e}")
                self.test_results[test_name] = False
        
        return passed, total


async def main():
    """Main testing function"""
    print("🧪 Comprehensive Admin Creation Testing")
    print("=" * 45)
    
    tester = AdminCreationTester()
    
    try:
        passed, total = await tester.run_all_tests()
        
        print("\n📊 Test Results Summary:")
        print("-" * 30)
        
        for test_name, result in tester.test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"  {test_name:20}: {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("\n🎉 All admin creation tests passed!")
            print("\n✅ Admin creation system is working correctly")
            sys.exit(0)
        else:
            print(f"\n❌ {total - passed} tests failed!")
            print("\n🔧 Please review the failed tests and fix the issues")
            sys.exit(1)
    
    except Exception as e:
        logger.error(f"Testing failed with unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️  Testing cancelled by user")
        sys.exit(1)