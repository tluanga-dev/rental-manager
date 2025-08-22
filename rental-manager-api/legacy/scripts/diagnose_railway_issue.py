#!/usr/bin/env python3
"""
Diagnose Railway deployment issues
"""

import requests
import json
from datetime import datetime

def check_backend_health():
    """Check if the backend is accessible"""
    
    backend_url = "https://rental-manager-backend-production.up.railway.app"
    endpoints = [
        "/health",
        "/api/health",
        "/docs",
        "/"
    ]
    
    print("=" * 60)
    print("RAILWAY BACKEND DIAGNOSTIC")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Backend URL: {backend_url}")
    print()
    
    for endpoint in endpoints:
        url = f"{backend_url}{endpoint}"
        print(f"Testing: {url}")
        
        try:
            # Try without headers first
            response = requests.get(url, timeout=10)
            print(f"  Status: {response.status_code}")
            
            # Check headers
            if 'Access-Control-Allow-Origin' in response.headers:
                print(f"  CORS: {response.headers['Access-Control-Allow-Origin']}")
            else:
                print("  CORS: No Access-Control-Allow-Origin header")
            
            # Show response for health endpoints
            if 'health' in endpoint:
                try:
                    data = response.json()
                    print(f"  Response: {json.dumps(data, indent=2)}")
                except:
                    print(f"  Response: {response.text[:100]}")
                    
        except requests.exceptions.Timeout:
            print("  ❌ Timeout - Service not responding")
        except requests.exceptions.ConnectionError as e:
            print(f"  ❌ Connection Error: {str(e)[:100]}")
        except Exception as e:
            print(f"  ❌ Error: {str(e)[:100]}")
        
        print()
    
    # Test with Origin header (simulate browser request)
    print("Testing with Origin header (simulating browser):")
    headers = {
        'Origin': 'https://www.omomrentals.shop',
        'User-Agent': 'Mozilla/5.0 (like browser)'
    }
    
    test_url = f"{backend_url}/api/health"
    print(f"Testing: {test_url}")
    print(f"Headers: {headers}")
    
    try:
        response = requests.get(test_url, headers=headers, timeout=10)
        print(f"  Status: {response.status_code}")
        
        # Check CORS headers
        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin', 'NOT SET'),
            'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials', 'NOT SET'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods', 'NOT SET')
        }
        
        print("  CORS Headers:")
        for header, value in cors_headers.items():
            print(f"    {header}: {value}")
            
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
    
    print("\n" + "=" * 60)
    print("DIAGNOSIS COMPLETE")
    print("=" * 60)
    
    print("\nPossible Issues:")
    print("1. If getting 502 Bad Gateway:")
    print("   - Backend service crashed or not running")
    print("   - Check Railway logs for startup errors")
    print("   - Database connection might be failing")
    print("   - Migration errors during startup")
    print("\n2. If getting CORS errors:")
    print("   - EnhancedCORSMiddleware not being applied")
    print("   - Middleware order issue")
    print("   - Production environment variables not set")
    print("\n3. Recommended Actions:")
    print("   - Check Railway deployment logs")
    print("   - Verify environment variables are set")
    print("   - Ensure DATABASE_URL is correct")
    print("   - Check if migrations are running successfully")

if __name__ == "__main__":
    check_backend_health()