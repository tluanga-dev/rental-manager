#!/usr/bin/env python3
"""
Test customer access for admin user
"""
import requests
import json

BASE_URL = "https://rental-manager-backend-production.up.railway.app/api"

# Authenticate
print("🔐 Authenticating...")
response = requests.post(
    f"{BASE_URL}/auth/login",
    json={"username": "admin", "password": "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"}
)

if response.status_code != 200:
    print(f"❌ Authentication failed: {response.status_code}")
    exit(1)

token = response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("✅ Authenticated")

# Get user info
print("\n📊 Getting user info...")
response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
if response.status_code == 200:
    user = response.json()
    print(f"✅ User: {user.get('username')}")
    print(f"   Email: {user.get('email')}")
    print(f"   Superuser: {user.get('is_superuser')}")
    print(f"   Active: {user.get('is_active')}")
else:
    print(f"❌ Failed to get user info: {response.status_code}")

# Test customer access
print("\n🧪 Testing customer access...")
response = requests.get(f"{BASE_URL}/customers/customers/", headers=headers)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    print("✅ Customer access GRANTED")
    customers = response.json()
    print(f"   Found {len(customers)} customers")
elif response.status_code == 403:
    print("❌ Customer access DENIED (403 Forbidden)")
    print(f"   Response: {response.text}")
else:
    print(f"⚠️  Unexpected status: {response.status_code}")
    print(f"   Response: {response.text[:200]}")

# Test creating a customer
print("\n🧪 Testing customer creation...")
customer_data = {
    "name": "Test Customer RBAC",
    "phone": "1234567890",
    "email": "test.rbac@example.com",
    "address": "123 Test Street"
}
response = requests.post(f"{BASE_URL}/customers/customers/", json=customer_data, headers=headers)
print(f"   Status: {response.status_code}")
if response.status_code == 201:
    print("✅ Customer creation GRANTED")
    customer = response.json()
    print(f"   Created customer ID: {customer.get('id')}")
    
    # Clean up - delete the test customer
    if customer.get('id'):
        requests.delete(f"{BASE_URL}/customers/customers/{customer['id']}", headers=headers)
        print("   Test customer deleted")
elif response.status_code == 403:
    print("❌ Customer creation DENIED (403 Forbidden)")
else:
    print(f"⚠️  Unexpected status: {response.status_code}")
    print(f"   Response: {response.text[:200]}")