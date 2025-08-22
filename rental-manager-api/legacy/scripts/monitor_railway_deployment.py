#!/usr/bin/env python3
"""
Monitor Railway deployment status after pushing changes
"""

import requests
import time
import sys
from datetime import datetime

def test_endpoint(url, endpoint, description):
    """Test a specific endpoint"""
    full_url = f"{url}{endpoint}"
    try:
        response = requests.get(full_url, timeout=5)
        status = response.status_code
        
        if status == 200:
            print(f"✓ {description}: {status} OK")
            return True
        else:
            print(f"✗ {description}: {status}")
            return False
    except requests.exceptions.Timeout:
        print(f"✗ {description}: Timeout")
        return False
    except requests.exceptions.ConnectionError:
        print(f"✗ {description}: Connection Error")
        return False
    except Exception as e:
        print(f"✗ {description}: {e}")
        return False

def monitor_deployment():
    """Monitor the Railway deployment"""
    backend_url = "https://rental-manager-backend-production.up.railway.app"
    
    print("=" * 50)
    print("Railway Deployment Monitor")
    print(f"Backend URL: {backend_url}")
    print(f"Started: {datetime.now()}")
    print("=" * 50)
    
    # Wait for deployment to start
    print("\nWaiting for deployment to complete...")
    print("(This usually takes 2-3 minutes)")
    
    attempts = 0
    max_attempts = 30  # 5 minutes
    
    while attempts < max_attempts:
        attempts += 1
        print(f"\nAttempt {attempts}/{max_attempts}")
        
        # Test critical endpoints
        health_ok = test_endpoint(backend_url, "/health", "Health Check")
        api_health_ok = test_endpoint(backend_url, "/api/health", "API Health")
        root_ok = test_endpoint(backend_url, "/", "Root Endpoint")
        
        if health_ok and api_health_ok and root_ok:
            print("\n✓ All basic endpoints responding!")
            
            # Test authentication endpoint
            print("\nTesting authentication endpoint...")
            auth_url = f"{backend_url}/api/auth/login"
            try:
                response = requests.post(
                    auth_url,
                    json={"username": "admin", "password": "test"},
                    timeout=5
                )
                if response.status_code in [401, 422, 400]:
                    print("✓ Auth endpoint responding (got expected error)")
                elif response.status_code == 200:
                    print("✓ Auth endpoint working (login successful)")
                else:
                    print(f"? Auth endpoint returned: {response.status_code}")
            except Exception as e:
                print(f"✗ Auth endpoint error: {e}")
            
            # Get feature status
            try:
                response = requests.get(f"{backend_url}/api/health", timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    features = data.get("features", {})
                    print("\n🚀 Deployment Successful!")
                    print("\nEnabled Features:")
                    print(f"  - Database: {features.get('database', False)}")
                    print(f"  - Redis: {features.get('redis', False)}")
                    print(f"  - Auth: {features.get('auth', False)}")
                    print(f"  - Routers: {len(features.get('routers', []))} registered")
            except:
                pass
            
            return True
        
        # Wait before next attempt
        time.sleep(10)
    
    print("\n✗ Deployment monitoring timed out")
    print("Check Railway dashboard for deployment status")
    return False

def test_frontend_connection():
    """Test if frontend can connect to backend"""
    print("\n" + "=" * 50)
    print("Testing Frontend Connection")
    print("=" * 50)
    
    frontend_url = "https://www.omomrentals.shop"
    backend_url = "https://rental-manager-backend-production.up.railway.app"
    
    # Check CORS headers
    try:
        response = requests.options(
            f"{backend_url}/api/auth/login",
            headers={
                "Origin": frontend_url,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type"
            },
            timeout=5
        )
        
        cors_headers = {
            "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
            "Access-Control-Allow-Methods": response.headers.get("Access-Control-Allow-Methods"),
            "Access-Control-Allow-Headers": response.headers.get("Access-Control-Allow-Headers"),
        }
        
        print("\nCORS Headers:")
        for header, value in cors_headers.items():
            if value:
                print(f"  {header}: {value[:50]}...")
        
        if cors_headers["Access-Control-Allow-Origin"] == "*" or frontend_url in cors_headers["Access-Control-Allow-Origin"]:
            print("\n✓ CORS configured correctly for frontend")
        else:
            print("\n✗ CORS may not be configured for frontend")
    except Exception as e:
        print(f"\n✗ Could not test CORS: {e}")

if __name__ == "__main__":
    success = monitor_deployment()
    
    if success:
        test_frontend_connection()
        print("\n✅ Deployment monitoring complete!")
        sys.exit(0)
    else:
        print("\n❌ Deployment monitoring failed")
        sys.exit(1)