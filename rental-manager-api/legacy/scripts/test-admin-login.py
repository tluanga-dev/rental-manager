#!/usr/bin/env python3

import requests
import json

def test_admin_login():
    """Test admin login with production credentials"""
    
    url = "https://rental-manager-backend-production.up.railway.app/api/auth/login"
    
    # The actual password with special characters
    credentials = {
        "username": "admin",
        "password": "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"
    }
    
    print("Testing admin login...")
    print(f"URL: {url}")
    print(f"Username: {credentials['username']}")
    print(f"Password: {'*' * len(credentials['password'])}")
    
    try:
        response = requests.post(url, json=credentials, timeout=10)
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Login successful!")
            print(f"User: {data.get('user', {}).get('username', 'N/A')}")
            print(f"Role: {data.get('user', {}).get('role', {}).get('name', 'N/A')}")
            print("Access token received: Yes" if data.get('access_token') else "Access token received: No")
        else:
            print(f"❌ Login failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_admin_login()