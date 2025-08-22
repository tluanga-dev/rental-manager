"""
Admin Management Routes for Railway Deployment Diagnostics

This module provides endpoints for diagnosing and managing admin user creation
in Railway deployments. These endpoints help troubleshoot authentication issues.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from datetime import datetime

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.modules.users.models import User
from app.modules.users.services import UserService
from app.modules.auth.dependencies import get_current_superuser

logger = logging.getLogger(__name__)

router = APIRouter()

# UNUSED BY FRONTEND - Entire admin module commented out for security
# All endpoints below are for internal diagnostics only and not used by the frontend
# These endpoints can be re-enabled if needed for debugging purposes

# @router.get("/diagnosis", summary="Comprehensive admin diagnosis")
# async def admin_diagnosis(
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_superuser)
# ) -> Dict[str, Any]:
#     """
#     Comprehensive diagnosis of admin user setup and environment.
#     This endpoint helps identify why admin login might be failing.
#     """
#     diagnosis = {
#         "timestamp": datetime.utcnow().isoformat(),
#         "environment": {
#             "configured": False,
#             "variables": {},
#             "validation_errors": []
#         },
#         "database": {
#             "connected": False,
#             "tables_exist": False,
#             "users_table_exists": False,
#             "users_count": 0
#         },
#         "admin_user": {
#             "exists": False,
#             "details": None,
#             "password_hash_valid": False,
#             "password_test_passed": False
#         },
#         "recommendations": []
#     }
#     
#     # 1. Environment Variable Check
#     try:
#         env_vars = {
#             "ADMIN_USERNAME": settings.ADMIN_USERNAME,
#             "ADMIN_EMAIL": settings.ADMIN_EMAIL,
#             "ADMIN_FULL_NAME": settings.ADMIN_FULL_NAME,
#             "ADMIN_PASSWORD_LENGTH": len(settings.ADMIN_PASSWORD),
#             "DATABASE_URL_HOST": settings.DATABASE_URL.split('@')[1].split('/')[0] if '@' in settings.DATABASE_URL else "unknown",
#             "SECRET_KEY_SET": bool(settings.SECRET_KEY and settings.SECRET_KEY != "your-secret-key-here-change-in-production")
#         }
#         diagnosis["environment"]["variables"] = env_vars
#         diagnosis["environment"]["configured"] = True
#         
#         # Validate admin credentials
#         from app.core.config import Settings
#         Settings()  # This will raise ValueError if validation fails
#         
#     except ValueError as e:
#         diagnosis["environment"]["validation_errors"].append(str(e))
#     except Exception as e:
#         diagnosis["environment"]["validation_errors"].append(f"Configuration error: {str(e)}")
#     
#     # 2. Database Connection and Structure Check
#     try:
#         # Test database connection
#         await db.execute(text("SELECT 1"))
#         diagnosis["database"]["connected"] = True
#         
#         # Check if tables exist
#         result = await db.execute(text("""
#             SELECT COUNT(*) FROM information_schema.tables 
#             WHERE table_schema = 'public'
#         """))
#         table_count = result.scalar()
#         diagnosis["database"]["tables_exist"] = table_count > 0
#         
#         # Check specifically for users table
#         result = await db.execute(text("""
#             SELECT COUNT(*) FROM information_schema.tables 
#             WHERE table_schema = 'public' AND table_name = 'users'
#         """))
#         users_table_exists = result.scalar() > 0
#         diagnosis["database"]["users_table_exists"] = users_table_exists
#         
#         if users_table_exists:
#             # Count total users
#             result = await db.execute(text("SELECT COUNT(*) FROM users"))
#             diagnosis["database"]["users_count"] = result.scalar()
#         
#     except Exception as e:
#         diagnosis["database"]["error"] = str(e)
#     
#     # 3. Admin User Check
#     if diagnosis["database"]["users_table_exists"]:
#         try:
#             user_service = UserService(db)
#             admin_user = await user_service.get_by_username(settings.ADMIN_USERNAME)
#             
#             if admin_user:
#                 diagnosis["admin_user"]["exists"] = True
#                 diagnosis["admin_user"]["details"] = {
#                     "id": admin_user.id,
#                     "username": admin_user.username,
#                     "email": admin_user.email,
#                     "full_name": admin_user.full_name,
#                     "is_active": admin_user.is_active,
#                     "is_superuser": admin_user.is_superuser,
#                     "is_verified": admin_user.is_verified,
#                     "created_at": admin_user.created_at.isoformat() if admin_user.created_at else None,
#                     "password_hash_length": len(admin_user.password) if admin_user.password else 0
#                 }
#                 
#                 # Check if password hash is valid format
#                 if admin_user.password and admin_user.password.startswith('$2b$'):
#                     diagnosis["admin_user"]["password_hash_valid"] = True
#                     
#                     # Test password verification
#                     try:
#                         password_correct = verify_password(settings.ADMIN_PASSWORD, admin_user.password)
#                         diagnosis["admin_user"]["password_test_passed"] = password_correct
#                     except Exception as e:
#                         diagnosis["admin_user"]["password_test_error"] = str(e)
#                 
#         except Exception as e:
#             diagnosis["admin_user"]["error"] = str(e)
#     
#     # 4. Generate Recommendations
#     recommendations = []
#     
#     if not diagnosis["environment"]["configured"]:
#         recommendations.append("❌ Environment configuration failed - check .env file or Railway environment variables")
#     
#     if diagnosis["environment"]["validation_errors"]:
#         for error in diagnosis["environment"]["validation_errors"]:
#             recommendations.append(f"❌ Configuration validation: {error}")
#     
#     if not diagnosis["database"]["connected"]:
#         recommendations.append("❌ Database connection failed - check DATABASE_URL")
#     
#     if not diagnosis["database"]["tables_exist"]:
#         recommendations.append("❌ No database tables found - run database initialization")
#     
#     if not diagnosis["database"]["users_table_exists"]:
#         recommendations.append("❌ Users table missing - run database migrations")
#     
#     if not diagnosis["admin_user"]["exists"]:
#         recommendations.append("❌ Admin user does not exist - run admin creation script")
#     elif not diagnosis["admin_user"]["password_test_passed"]:
#         recommendations.append("❌ Admin password verification failed - recreate admin user")
#     
#     if diagnosis["admin_user"]["exists"] and diagnosis["admin_user"]["details"]:
#         details = diagnosis["admin_user"]["details"]
#         if not details["is_active"]:
#             recommendations.append("❌ Admin user is not active")
#         if not details["is_superuser"]:
#             recommendations.append("❌ Admin user is not a superuser")
#     
#     if not recommendations:
#         recommendations.append("✅ All checks passed - admin user should be working correctly")
#     
#     diagnosis["recommendations"] = recommendations
#     
#     return diagnosis


# @router.get("/status", summary="Quick admin status check")
# async def admin_status(
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_superuser)
# ) -> Dict[str, Any]:
#     """
#     Quick status check for admin user availability.
#     """
#     try:
#         user_service = UserService(db)
#         admin_user = await user_service.get_by_username(settings.ADMIN_USERNAME)
#         
#         if not admin_user:
#             return {
#                 "status": "not_found", 
#                 "message": f"Admin user '{settings.ADMIN_USERNAME}' does not exist",
#                 "exists": False
#             }
#         
#         # Test password
#         password_valid = verify_password(settings.ADMIN_PASSWORD, admin_user.password)
#         
#         return {
#             "status": "found" if password_valid else "password_mismatch",
#             "message": "Admin user found and password verified" if password_valid else "Admin user found but password verification failed",
#             "exists": True,
#             "username": admin_user.username,
#             "email": admin_user.email,
#             "is_active": admin_user.is_active,
#             "is_superuser": admin_user.is_superuser,
#             "password_valid": password_valid
#         }
#         
#     except Exception as e:
#         return {
#             "status": "error",
#             "message": f"Error checking admin status: {str(e)}",
#             "exists": False
#         }


# @router.post("/create", summary="Create admin user")
# async def create_admin_user(
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_superuser)
# ) -> Dict[str, Any]:
#     """
#     Create admin user with current environment settings.
#     This endpoint can be used as a fallback when startup scripts fail.
#     """
#     try:
#         user_service = UserService(db)
#         
#         # Check if admin user already exists
#         existing_admin = await user_service.get_by_username(settings.ADMIN_USERNAME)
#         if existing_admin:
#             return {
#                 "status": "exists",
#                 "message": f"Admin user '{settings.ADMIN_USERNAME}' already exists",
#                 "created": False
#             }
#         
#         # Create admin user
#         admin_data = {
#             "username": settings.ADMIN_USERNAME,
#             "email": settings.ADMIN_EMAIL,
#             "password": settings.ADMIN_PASSWORD,  # UserService will hash this
#             "full_name": settings.ADMIN_FULL_NAME,
#             "is_active": True,
#             "is_superuser": True,
#             "is_verified": True
#         }
#         
#         admin_user = await user_service.create(admin_data)
#         
#         return {
#             "status": "created",
#             "message": f"Admin user '{settings.ADMIN_USERNAME}' created successfully",
#             "created": True,
#             "user_id": admin_user.id,
#             "username": admin_user.username,
#             "email": admin_user.email
#         }
#         
#     except Exception as e:
#         logger.error(f"Failed to create admin user: {e}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to create admin user: {str(e)}"
#         )


# @router.post("/recreate", summary="Recreate admin user")
# async def recreate_admin_user(
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_superuser)
# ) -> Dict[str, Any]:
#     """
#     Delete and recreate admin user with current environment settings.
#     Use this when password verification is failing.
#     """
#     try:
#         user_service = UserService(db)
#         
#         # Delete existing admin user if exists
#         existing_admin = await user_service.get_by_username(settings.ADMIN_USERNAME)
#         if existing_admin:
#             await user_service.delete(existing_admin.id)
#             await db.commit()
#         
#         # Create new admin user
#         admin_data = {
#             "username": settings.ADMIN_USERNAME,
#             "email": settings.ADMIN_EMAIL,
#             "password": settings.ADMIN_PASSWORD,  # UserService will hash this
#             "full_name": settings.ADMIN_FULL_NAME,
#             "is_active": True,
#             "is_superuser": True,
#             "is_verified": True
#         }
#         
#         admin_user = await user_service.create(admin_data)
#         
#         return {
#             "status": "recreated",
#             "message": f"Admin user '{settings.ADMIN_USERNAME}' recreated successfully",
#             "recreated": True,
#             "user_id": admin_user.id,
#             "username": admin_user.username,
#             "email": admin_user.email
#         }
#         
#     except Exception as e:
#         logger.error(f"Failed to recreate admin user: {e}")
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to recreate admin user: {str(e)}"
#         )


# @router.get("/test-login", summary="Test admin login credentials")
# async def test_admin_login(
#     db: AsyncSession = Depends(get_db),
#     current_user: User = Depends(get_current_superuser)
# ) -> Dict[str, Any]:
#     """
#     Test admin login without actually creating a session.
#     This helps verify if the credentials would work for authentication.
#     """
#     try:
#         user_service = UserService(db)
#         admin_user = await user_service.get_by_username(settings.ADMIN_USERNAME)
#         
#         if not admin_user:
#             return {
#                 "status": "user_not_found",
#                 "message": f"Admin user '{settings.ADMIN_USERNAME}' does not exist",
#                 "login_would_succeed": False
#             }
#         
#         if not admin_user.is_active:
#             return {
#                 "status": "user_inactive",
#                 "message": "Admin user exists but is not active",
#                 "login_would_succeed": False
#             }
#         
#         password_valid = verify_password(settings.ADMIN_PASSWORD, admin_user.password)
#         
#         return {
#             "status": "success" if password_valid else "password_invalid",
#             "message": "Login test passed" if password_valid else "Password verification failed",
#             "login_would_succeed": password_valid,
#             "user_details": {
#                 "username": admin_user.username,
#                 "email": admin_user.email,
#                 "is_active": admin_user.is_active,
#                 "is_superuser": admin_user.is_superuser,
#                 "is_verified": admin_user.is_verified
#             }
#         }
#         
#     except Exception as e:
#         return {
#             "status": "error",
#             "message": f"Login test failed: {str(e)}",
#             "login_would_succeed": False
#         }