#!/usr/bin/env python3
"""
Test New Admin Password

This script tests authentication with the new secure admin password.
"""

import asyncio
import sys
import os
import json
import logging
import httpx
from typing import Dict, Any

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

# Configuration
API_BASE_URL = "http://localhost:8000"
NEW_ADMIN_PASSWORD = "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"
ADMIN_USERNAME = "admin"


async def test_authentication():
    """Test authentication with the new password."""
    logger.info("Testing authentication with new admin password...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Test login with new password
            login_payload = {
                "username": ADMIN_USERNAME,
                "password": NEW_ADMIN_PASSWORD
            }
            
            logger.info(f"Sending login request to: {API_BASE_URL}/api/auth/login")
            
            response = await client.post(
                f"{API_BASE_URL}/api/auth/login",
                json=login_payload
            )
            
            logger.info(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info("✅ Authentication successful!")
                logger.info(f"Access token length: {len(data.get('access_token', ''))}")
                logger.info(f"Refresh token length: {len(data.get('refresh_token', ''))}")
                
                # Test accessing protected endpoint
                access_token = data.get('access_token')
                if access_token:
                    logger.info("Testing protected endpoint access...")
                    
                    profile_response = await client.get(
                        f"{API_BASE_URL}/api/auth/me",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    
                    if profile_response.status_code == 200:
                        profile_data = profile_response.json()
                        logger.info("✅ Protected endpoint access successful!")
                        logger.info(f"User: {profile_data.get('username')} ({profile_data.get('email')})")
                        return True
                    else:
                        logger.error(f"❌ Protected endpoint failed: {profile_response.status_code}")
                        logger.error(f"Response: {profile_response.text}")
                        return False
                else:
                    logger.error("❌ No access token received")
                    return False
                    
            else:
                logger.error(f"❌ Authentication failed: {response.status_code}")
                try:
                    error_data = response.json()
                    logger.error(f"Error details: {json.dumps(error_data, indent=2)}")
                except:
                    logger.error(f"Error response: {response.text}")
                return False
                
        except httpx.ConnectError:
            logger.error("❌ Could not connect to server. Is it running?")
            logger.error(f"Please ensure the backend server is running at {API_BASE_URL}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error: {str(e)}")
            return False


async def test_old_password_rejection():
    """Test that old password is rejected."""
    logger.info("Testing that old password is rejected...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Test with old password
            old_login_payload = {
                "username": ADMIN_USERNAME,
                "password": "Admin@123"  # Old password
            }
            
            response = await client.post(
                f"{API_BASE_URL}/api/auth/login",
                json=old_login_payload
            )
            
            if response.status_code == 401 or response.status_code == 422:
                logger.info("✅ Old password correctly rejected!")
                return True
            else:
                logger.error(f"❌ Old password not properly rejected. Status: {response.status_code}")
                return False
                
        except httpx.ConnectError:
            logger.error("❌ Could not connect to server for old password test")
            return False
        except Exception as e:
            logger.error(f"❌ Error testing old password: {str(e)}")
            return False


async def main():
    """Main function to run password validation tests."""
    print("🔐 Testing New Admin Password Authentication")
    print("=" * 50)
    
    # Test new password authentication
    new_password_success = await test_authentication()
    
    # Test old password rejection
    old_password_rejected = await test_old_password_rejection()
    
    print("\n📊 TEST RESULTS:")
    print(f"✅ New Password Authentication: {'PASSED' if new_password_success else '❌ FAILED'}")
    print(f"✅ Old Password Rejection: {'PASSED' if old_password_rejected else '❌ FAILED'}")
    
    if new_password_success and old_password_rejected:
        print("\n🎉 ALL TESTS PASSED! Password security update successful.")
        print(f"\n🔑 New Admin Credentials:")
        print(f"   Username: {ADMIN_USERNAME}")
        print(f"   Password: {NEW_ADMIN_PASSWORD}")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED! Please review the issues above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())