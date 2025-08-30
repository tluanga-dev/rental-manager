#!/bin/bash

# Test script to directly test the rental pricing API
echo "🧪 Testing Rental Pricing API Directly"
echo "======================================"
echo ""

# First, let's get an item to test with
echo "1. Getting first available item..."
ITEM_RESPONSE=$(curl -s 'http://localhost:8000/api/items/')
ITEM_ID=$(echo "$ITEM_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null)

if [ -z "$ITEM_ID" ]; then
    echo "❌ No items found in database. Please create an item first."
    exit 1
fi

echo "✅ Found item ID: $ITEM_ID"
echo ""

# Now test creating a custom pricing tier
echo "2. Creating custom 10-day pricing tier..."
echo ""

PRICING_DATA='{
  "item_id": "'$ITEM_ID'",
  "tier_name": "Test 10-Day Custom",
  "period_type": "CUSTOM",
  "period_unit": "DAY",
  "period_days": 10,
  "rate_per_period": 500.00,
  "min_rental_periods": 1,
  "max_rental_periods": 5,
  "is_default": false,
  "is_active": true,
  "priority": 50
}'

echo "Sending data:"
echo "$PRICING_DATA" | python3 -m json.tool
echo ""

RESPONSE=$(curl -s -X POST \
  'http://localhost:8000/api/rental-pricing/' \
  -H 'Content-Type: application/json' \
  -d "$PRICING_DATA")

if echo "$RESPONSE" | grep -q '"id"'; then
    echo "✅ Successfully created pricing tier!"
    echo "Response:"
    echo "$RESPONSE" | python3 -m json.tool | head -20
else
    echo "❌ Failed to create pricing tier"
    echo "Response:"
    echo "$RESPONSE" | python3 -m json.tool
fi

echo ""
echo "======================================"
echo "Test completed!"
echo ""
echo "To test in the UI:"
echo "1. Go to http://localhost:3000/inventory/items"
echo "2. Click on any item"
echo "3. Click 'Manage Pricing'"
echo "4. Try creating a custom tier"