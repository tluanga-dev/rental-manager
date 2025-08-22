#!/usr/bin/env python3
"""
Test direct API access
"""
import requests

BASE_URL = "https://rental-manager-backend-production.up.railway.app/api"

# Test health
print("Testing backend health...")
response = requests.get(f"{BASE_URL}/health")
print(f"Health check: {response.status_code}")

# Test auth endpoint
print("\nTesting auth endpoint...")
response = requests.post(
    f"{BASE_URL}/auth/login",
    json={"username": "admin", "password": "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"}
)
print(f"Auth status: {response.status_code}")
if response.status_code == 200:
    token = response.json()["access_token"]
    print(f"Token received: {token[:20]}...{token[-20:]}")
    
    # Test auth/me endpoint
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print(f"\nUser info status: {response.status_code}")
    if response.status_code == 200:
        user = response.json()
        print(f"User data: {user}")
    
    # Test a simple endpoint without permissions
    response = requests.get(f"{BASE_URL}/system-settings/currency", headers=headers)
    print(f"\nCurrency endpoint: {response.status_code}")
    if response.status_code == 200:
        print(f"Currency data: {response.json()}")
else:
    print(f"Auth failed: {response.text}")