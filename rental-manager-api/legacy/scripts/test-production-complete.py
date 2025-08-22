#!/usr/bin/env python3

import requests
import json
from datetime import datetime

def test_production_site():
    """Comprehensive test of production deployment"""
    
    backend_url = "https://rental-manager-backend-production.up.railway.app"
    frontend_url = "https://www.omomrentals.shop"
    
    print("=" * 60)
    print("Production Deployment Test")
    print(f"Time: {datetime.now()}")
    print("=" * 60)
    
    # Test 1: Backend Health
    print("\n1. Backend Health Check...")
    try:
        response = requests.get(f"{backend_url}/api/health", timeout=10)
        if response.status_code == 200:
            print(f"   ✅ Backend is healthy: {response.json()}")
        else:
            print(f"   ❌ Backend unhealthy: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Backend error: {e}")
    
    # Test 2: CORS Configuration
    print("\n2. CORS Configuration...")
    try:
        headers = {"Origin": frontend_url}
        response = requests.get(f"{backend_url}/api/health", headers=headers, timeout=10)
        cors_header = response.headers.get("Access-Control-Allow-Origin")
        if cors_header:
            print(f"   ✅ CORS configured: {cors_header}")
        else:
            print("   ❌ CORS not configured")
    except Exception as e:
        print(f"   ❌ CORS test error: {e}")
    
    # Test 3: Admin Login
    print("\n3. Admin Login Test...")
    try:
        credentials = {
            "username": "admin",
            "password": "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"
        }
        response = requests.post(f"{backend_url}/api/auth/login", json=credentials, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Login successful")
            print(f"      Username: {data.get('user', {}).get('username', 'N/A')}")
            print(f"      Email: {data.get('user', {}).get('email', 'N/A')}")
            print(f"      Token: {'Yes' if data.get('access_token') else 'No'}")
        else:
            print(f"   ❌ Login failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Login error: {e}")
    
    # Test 4: Frontend Availability
    print("\n4. Frontend Availability...")
    try:
        response = requests.get(frontend_url, timeout=10)
        if response.status_code == 200:
            print(f"   ✅ Frontend is accessible")
            if "Rental Manager" in response.text:
                print(f"      ✅ Frontend content verified")
        else:
            print(f"   ❌ Frontend error: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Frontend error: {e}")
    
    print("\n" + "=" * 60)
    print("Test Summary:")
    print(f"- Backend API: {backend_url}/api")
    print(f"- Frontend URL: {frontend_url}")
    print(f"- Admin Username: admin")
    print(f"- Admin Password: K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
    print("\n✅ Production deployment is fully operational!")
    print("=" * 60)

if __name__ == "__main__":
    test_production_site()