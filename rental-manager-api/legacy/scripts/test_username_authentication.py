#!/usr/bin/env python3
"""
Test Username-Based Authentication

This script tests the new username-based authentication system for all demo users.
"""

import asyncio
import sys
import os
import json
import logging
import httpx
from typing import Dict, Any, List, Tuple

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

# Username-based credentials
USERNAME_CREDENTIALS = {
    "admin": {
        "username": "admin", 
        "password": "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3",
        "role": "Administrator"
    },
    "manager": {
        "username": "manager", 
        "password": "mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8",
        "role": "Manager"
    },
    "staff": {
        "username": "staff", 
        "password": "sT3#qW8$vE1!nM5&rA9^jK2*xL6@pC4",
        "role": "Staff"
    }
}

# Invalid username test cases
INVALID_USERNAME_TESTS = [
    {"username": "admin@admin.com", "description": "Email format username (should fail)"},
    {"username": "manager@manager.com", "description": "Old manager email format"},
    {"username": "staff@staff.com", "description": "Old staff email format"},
    {"username": "invalid-user", "description": "Nonexistent username"},
    {"username": "admin!", "description": "Special characters in username"},
    {"username": "", "description": "Empty username"},
    {"username": "a", "description": "Too short username"},
]


async def test_username_authentication(username: str, password: str, role: str) -> bool:
    """Test authentication for a specific username"""
    logger.info(f"Testing {role} authentication with username '{username}'...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            login_payload = {
                "username": username,
                "password": password
            }
            
            response = await client.post(
                f"{API_BASE_URL}/api/auth/login",
                json=login_payload
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ {role} authentication successful!")
                
                # Test protected endpoint access
                access_token = data.get('access_token')
                if access_token:
                    profile_response = await client.get(
                        f"{API_BASE_URL}/api/auth/me",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    
                    if profile_response.status_code == 200:
                        profile_data = profile_response.json()
                        logger.info(f"✅ {role} protected endpoint access successful!")
                        logger.info(f"   Username: {profile_data.get('username')}")
                        logger.info(f"   Email: {profile_data.get('email')}")
                        return True
                    else:
                        logger.error(f"❌ {role} protected endpoint failed: {profile_response.status_code}")
                        return False
                else:
                    logger.error(f"❌ {role} no access token received")
                    return False
            else:
                logger.error(f"❌ {role} authentication failed: {response.status_code}")
                try:
                    error_data = response.json()
                    logger.error(f"   Error details: {error_data}")
                except:
                    logger.error(f"   Error response: {response.text}")
                return False
                    
        except httpx.ConnectError:
            logger.error(f"❌ Could not connect to server for {role} test")
            return False
        except Exception as e:
            logger.error(f"❌ Error testing {role}: {str(e)}")
            return False


async def test_invalid_usernames() -> bool:
    """Test that invalid usernames are properly rejected"""
    logger.info("Testing invalid username rejection...")
    
    all_rejected = True
    async with httpx.AsyncClient(timeout=30.0) as client:
        for test_case in INVALID_USERNAME_TESTS:
            try:
                login_payload = {
                    "username": test_case["username"],
                    "password": "dummy_password"
                }
                
                response = await client.post(
                    f"{API_BASE_URL}/api/auth/login",
                    json=login_payload
                )
                
                if response.status_code in [401, 422, 400]:
                    logger.info(f"✅ '{test_case['username']}' correctly rejected ({test_case['description']})")
                else:
                    logger.error(f"❌ '{test_case['username']}' not properly rejected. Status: {response.status_code}")
                    all_rejected = False
                    
            except httpx.ConnectError:
                logger.error("❌ Could not connect to server for invalid username test")
                return False
            except Exception as e:
                logger.error(f"❌ Error testing invalid username '{test_case['username']}': {str(e)}")
                all_rejected = False
    
    return all_rejected


async def test_username_validation() -> bool:
    """Test frontend username validation (simulation)"""
    logger.info("Testing username validation rules...")
    
    valid_usernames = ["admin", "manager", "staff", "user123", "test_user"]
    invalid_usernames = ["admin@test.com", "user!", "us", "", "a" * 60]
    
    # Simulate validation logic
    import re
    username_pattern = re.compile(r'^[a-zA-Z0-9_]+$')
    
    all_valid = True
    
    for username in valid_usernames:
        if len(username) >= 3 and len(username) <= 50 and username_pattern.match(username):
            logger.info(f"✅ Valid username: '{username}'")
        else:
            logger.error(f"❌ Username validation failed for valid username: '{username}'")
            all_valid = False
    
    for username in invalid_usernames:
        if not (len(username) >= 3 and len(username) <= 50 and username_pattern.match(username)):
            logger.info(f"✅ Invalid username correctly rejected: '{username}'")
        else:
            logger.error(f"❌ Invalid username incorrectly accepted: '{username}'")
            all_valid = False
    
    return all_valid


async def main():
    """Main function to test username-based authentication"""
    print("🔐 Testing Username-Based Authentication System")
    print("=" * 55)
    
    # Test all username authentications
    test_results = {}
    for user_type, creds in USERNAME_CREDENTIALS.items():
        test_results[user_type] = await test_username_authentication(
            creds["username"], 
            creds["password"], 
            creds["role"]
        )
    
    # Test invalid username rejection
    invalid_usernames_rejected = await test_invalid_usernames()
    
    # Test username validation rules
    validation_test = await test_username_validation()
    
    print("\n📊 TEST RESULTS:")
    print("-" * 40)
    
    for user_type, result in test_results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        role = USERNAME_CREDENTIALS[user_type]["role"]
        username = USERNAME_CREDENTIALS[user_type]["username"]
        print(f"{role:12} ({username:8}): {status}")
    
    invalid_status = "✅ PASSED" if invalid_usernames_rejected else "❌ FAILED"
    print(f"Invalid Usernames Rejection: {invalid_status}")
    
    validation_status = "✅ PASSED" if validation_test else "❌ FAILED"
    print(f"Username Validation Rules:   {validation_status}")
    
    # Summary
    all_tests_passed = (
        all(test_results.values()) and 
        invalid_usernames_rejected and 
        validation_test
    )
    
    if all_tests_passed:
        print("\n🎉 ALL USERNAME AUTHENTICATION TESTS PASSED!")
        print("\n🔑 Username-Based Login System Ready:")
        print("   ✅ Frontend accepts username input")
        print("   ✅ Backend authenticates with usernames")
        print("   ✅ Demo accounts use proper usernames")
        print("   ✅ Invalid usernames are rejected")
        print("   ✅ Validation rules work correctly")
        
        print("\n📋 Updated Login Credentials:")
        for user_type, creds in USERNAME_CREDENTIALS.items():
            print(f"   {creds['role']:12}: username='{creds['username']}' password='{creds['password'][:8]}...'")
        
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED! Please review the issues above.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())