#!/bin/bash

echo "🚀 Testing Category API with new leaf defaults..."

# First, login to get the access token
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@rentalmanager.com&password=admin123")

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  exit 1
fi

echo "✅ Got access token"

# Test 1: Create a parent category (is_leaf=false, which is the default)
echo ""
echo "🧪 Test 1: Creating parent category (is_leaf=false)..."
PARENT_RESPONSE=$(curl -s -X POST http://localhost:8000/api/categories \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Parent Category API",
    "parent_category_id": null,
    "display_order": 0,
    "is_leaf": false
  }')

echo "Response: $PARENT_RESPONSE"

# Check if is_leaf is false in response
if echo "$PARENT_RESPONSE" | grep -q '"is_leaf":false'; then
  echo "✅ Parent category created with is_leaf=false"
else
  echo "❌ Parent category not created correctly"
fi

# Test 2: Create a product category (is_leaf=true)
echo ""
echo "🧪 Test 2: Creating product category (is_leaf=true)..."
PRODUCT_RESPONSE=$(curl -s -X POST http://localhost:8000/api/categories \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product Category API",
    "parent_category_id": null,
    "display_order": 0,
    "is_leaf": true
  }')

echo "Response: $PRODUCT_RESPONSE"

# Check if is_leaf is true in response
if echo "$PRODUCT_RESPONSE" | grep -q '"is_leaf":true'; then
  echo "✅ Product category created with is_leaf=true"
else
  echo "❌ Product category not created correctly"
fi

# Test 3: Create a category without specifying is_leaf (should default to false)
echo ""
echo "🧪 Test 3: Creating category without is_leaf (should default to false)..."
DEFAULT_RESPONSE=$(curl -s -X POST http://localhost:8000/api/categories \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Default Category API",
    "parent_category_id": null,
    "display_order": 0
  }')

echo "Response: $DEFAULT_RESPONSE"

# Check if is_leaf defaults to false
if echo "$DEFAULT_RESPONSE" | grep -q '"is_leaf":false'; then
  echo "✅ Category created with default is_leaf=false"
else
  echo "❌ Default is_leaf value is not false"
fi

echo ""
echo "✨ API tests completed!"