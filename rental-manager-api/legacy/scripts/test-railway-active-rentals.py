#!/usr/bin/env python3
"""
Test script to verify active rentals API fix in Railway production
Tests that overdue count is correctly shown in aggregated_stats
"""

import requests
import json
from datetime import datetime

# Railway production URL
BASE_URL = "https://rental-manager-backend-production.up.railway.app/api"

# Test credentials - use demo account
CREDENTIALS = {
    "username": "demo",  
    "password": "demo"
}

def login():
    """Login and get access token"""
    print("\n1. Logging in...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json=CREDENTIALS
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return None
    
    data = response.json()
    access_token = data["access_token"]
    print(f"✅ Login successful")
    return access_token

def test_active_rentals(token):
    """Test the active rentals endpoint"""
    print("\n2. Testing active rentals endpoint...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(
        f"{BASE_URL}/transactions/rentals/active",
        headers=headers
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to get active rentals: {response.status_code}")
        print(response.text)
        return
    
    data = response.json()
    
    # Check response structure
    print("\n✅ Active rentals endpoint working")
    print(f"   Total rentals: {len(data.get('data', []))}")
    
    # Check summary statistics
    if 'summary' in data:
        summary = data['summary']
        print("\n📊 Summary Statistics:")
        print(f"   Total rentals: {summary.get('total_rentals', 0)}")
        print(f"   Total value: ₹{summary.get('total_value', 0):,.2f}")
        print(f"   Overdue count: {summary.get('overdue_count', 0)}")
        
        # Check status breakdown
        if 'status_breakdown' in summary:
            print("\n📈 Status Breakdown:")
            for status, count in summary['status_breakdown'].items():
                print(f"   {status}: {count}")
        
        # Check aggregated_stats (new field)
        if 'aggregated_stats' in summary:
            print("\n🎯 Aggregated Statistics (Dashboard Cards):")
            stats = summary['aggregated_stats']
            print(f"   In Progress: {stats.get('in_progress', 0)}")
            print(f"   Overdue: {stats.get('overdue', 0)} ← This should now show correct count")
            print(f"   Extended: {stats.get('extended', 0)}")
            print(f"   Partial Return: {stats.get('partial_return', 0)}")
            
            # Verify overdue consistency
            overdue_from_aggregated = stats.get('overdue', 0)
            overdue_from_summary = summary.get('overdue_count', 0)
            
            if overdue_from_aggregated == overdue_from_summary:
                print(f"\n✅ Overdue counts are consistent: {overdue_from_aggregated}")
            else:
                print(f"\n⚠️ Overdue count mismatch:")
                print(f"   aggregated_stats.overdue: {overdue_from_aggregated}")
                print(f"   summary.overdue_count: {overdue_from_summary}")
        else:
            print("\n⚠️ aggregated_stats field not found in response (old API version?)")
    
    # Check individual rentals for overdue status
    rentals = data.get('data', [])
    actual_overdue = sum(1 for r in rentals if r.get('is_overdue', False))
    print(f"\n📝 Actual overdue rentals (counted from data): {actual_overdue}")
    
    # List overdue rentals
    if actual_overdue > 0:
        print("\n🔍 Overdue Rentals Details:")
        for rental in rentals:
            if rental.get('is_overdue', False):
                print(f"   - {rental.get('transaction_number', 'N/A')}: "
                      f"{rental.get('customer_name', 'Unknown')} "
                      f"({rental.get('days_overdue', 0)} days overdue)")
    
    return data

def main():
    print("=" * 60)
    print("Testing Active Rentals API Fix in Railway Production")
    print("=" * 60)
    print(f"API URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().isoformat()}")
    
    # Login
    token = login()
    if not token:
        print("\n❌ Cannot continue without authentication")
        return
    
    # Test active rentals
    test_active_rentals(token)
    
    print("\n" + "=" * 60)
    print("Test Complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()