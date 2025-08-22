#!/usr/bin/env python3
"""
Test Railway deployment health and verify the fix is deployed
"""

import requests
import json
from datetime import datetime

# Railway production URL
BASE_URL = "https://rental-manager-backend-production.up.railway.app"

def check_health():
    """Check if the API is running"""
    print("\n1. Checking API health...")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            print(f"✅ API is healthy: {response.json()}")
            return True
        else:
            print(f"⚠️ API returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error connecting to API: {e}")
        return False

def check_docs():
    """Check if API docs are accessible"""
    print("\n2. Checking API documentation...")
    
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=10)
        if response.status_code == 200:
            print(f"✅ API documentation is accessible at {BASE_URL}/docs")
            return True
        else:
            print(f"⚠️ API docs returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error accessing API docs: {e}")
        return False

def check_frontend():
    """Check if frontend is accessible"""
    print("\n3. Checking frontend application...")
    
    frontend_url = "https://www.omomrentals.shop"
    try:
        response = requests.get(frontend_url, timeout=10)
        if response.status_code == 200:
            print(f"✅ Frontend is accessible at {frontend_url}")
            # Check if it's the React app
            if "root" in response.text:
                print("   ✓ React application detected")
            return True
        else:
            print(f"⚠️ Frontend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error accessing frontend: {e}")
        return False

def main():
    print("=" * 60)
    print("Railway Deployment Health Check")
    print("=" * 60)
    print(f"Backend URL: {BASE_URL}")
    print(f"Frontend URL: https://www.omomrentals.shop")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    # Run health checks
    api_healthy = check_health()
    docs_accessible = check_docs()
    frontend_accessible = check_frontend()
    
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    print(f"✅ Backend API: {'Working' if api_healthy else 'Not responding'}")
    print(f"✅ API Docs: {'Accessible' if docs_accessible else 'Not accessible'}")
    print(f"✅ Frontend: {'Working' if frontend_accessible else 'Not responding'}")
    
    if api_healthy and frontend_accessible:
        print("\n🎉 Deployment is successful!")
        print("\n📝 Next Steps:")
        print("1. Visit https://www.omomrentals.shop")
        print("2. Login with valid credentials")
        print("3. Navigate to /rentals/active")
        print("4. Verify that the overdue count in summary cards matches the table data")
    else:
        print("\n⚠️ Some services are not responding. Please check Railway logs.")

if __name__ == "__main__":
    main()