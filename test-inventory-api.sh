#!/bin/bash

# Test script for Inventory Item Detail API
# This script verifies that the backend API is returning inventory units correctly

# Configuration
API_BASE_URL="http://localhost:8000/api/v1"
ITEM_ID="6fb55465-8030-435c-82ea-090224a32a53"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Testing Inventory Item Detail API ===${NC}"
echo -e "${BLUE}Item ID: $ITEM_ID${NC}"
echo ""

# Function to pretty print JSON
pretty_json() {
    echo "$1" | python3 -m json.tool 2>/dev/null || echo "$1"
}

# First, get auth token (if needed)
echo -e "${YELLOW}1. Getting authentication token...${NC}"
AUTH_RESPONSE=$(curl -s -X POST "$API_BASE_URL/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=admin@rentalmanager.com&password=admin123")

TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import json, sys; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}Warning: Could not get auth token. Proceeding without authentication.${NC}"
    AUTH_HEADER=""
else
    echo -e "${GREEN}✓ Authentication successful${NC}"
    AUTH_HEADER="Authorization: Bearer $TOKEN"
fi

echo ""

# Test 1: Get full item detail
echo -e "${YELLOW}2. Testing GET /inventory/items/{item_id}${NC}"
echo -e "   Endpoint: $API_BASE_URL/inventory/items/$ITEM_ID"
echo ""

RESPONSE=$(curl -s -X GET "$API_BASE_URL/inventory/items/$ITEM_ID" \
    -H "Accept: application/json" \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"})

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Request successful${NC}"
    
    # Check if response contains inventory_units
    HAS_UNITS=$(echo "$RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'data' in data and 'inventory_units' in data['data']:
        print('true')
    else:
        print('false')
except:
    print('false')
" 2>/dev/null)

    if [ "$HAS_UNITS" = "true" ]; then
        echo -e "${GREEN}✓ Response contains inventory_units field${NC}"
        
        # Count inventory units
        UNIT_COUNT=$(echo "$RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    units = data.get('data', {}).get('inventory_units', [])
    print(len(units))
except:
    print(0)
" 2>/dev/null)
        
        echo -e "${GREEN}✓ Number of inventory units: $UNIT_COUNT${NC}"
        
        # Show sample unit if available
        if [ "$UNIT_COUNT" -gt 0 ]; then
            echo -e "${BLUE}Sample inventory unit:${NC}"
            echo "$RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
units = data.get('data', {}).get('inventory_units', [])
if units:
    print(json.dumps(units[0], indent=2))
"
        fi
    else
        echo -e "${RED}✗ Response does not contain inventory_units field${NC}"
        echo -e "${BLUE}Response structure:${NC}"
        echo "$RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if 'data' in data:
    print('Keys in data:', list(data['data'].keys()))
print('Full response sample (first 500 chars):')
print(json.dumps(data, indent=2)[:500])
"
    fi
else
    echo -e "${RED}✗ Request failed${NC}"
fi

echo ""
echo -e "${YELLOW}3. Testing GET /inventory/items/{item_id}/units${NC}"
echo -e "   Endpoint: $API_BASE_URL/inventory/items/$ITEM_ID/units"
echo ""

UNITS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/inventory/items/$ITEM_ID/units" \
    -H "Accept: application/json" \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"})

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Request successful${NC}"
    
    # Check response structure
    HAS_UNITS_DATA=$(echo "$UNITS_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'data' in data and 'inventory_units' in data.get('data', {}):
        print('true')
    else:
        print('false')
except:
    print('false')
" 2>/dev/null)

    if [ "$HAS_UNITS_DATA" = "true" ]; then
        echo -e "${GREEN}✓ Response contains inventory_units data${NC}"
        
        # Count and display units
        UNIT_COUNT=$(echo "$UNITS_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
units = data.get('data', {}).get('inventory_units', [])
print(len(units))
" 2>/dev/null)
        
        echo -e "${GREEN}✓ Number of units returned: $UNIT_COUNT${NC}"
        
        # Show item info
        echo "$UNITS_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin).get('data', {})
print(f\"Item: {data.get('item_name', 'N/A')} (SKU: {data.get('sku', 'N/A')})\")
print(f\"Total units: {data.get('total_units', 0)}\")
"
    else
        echo -e "${RED}✗ Response structure issue${NC}"
        echo -e "${BLUE}Response preview:${NC}"
        echo "$UNITS_RESPONSE" | head -c 500
    fi
else
    echo -e "${RED}✗ Request failed${NC}"
fi

echo ""
echo -e "${YELLOW}4. Testing GET /inventory/items/{item_id}/stock-levels${NC}"
echo -e "   Endpoint: $API_BASE_URL/inventory/items/$ITEM_ID/stock-levels"
echo ""

STOCK_RESPONSE=$(curl -s -X GET "$API_BASE_URL/inventory/items/$ITEM_ID/stock-levels" \
    -H "Accept: application/json" \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"})

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Request successful${NC}"
    
    # Parse stock summary
    echo "$STOCK_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'data' in data:
        stock_data = data['data']
        summary = stock_data.get('stock_summary', {})
        levels = stock_data.get('stock_levels', [])
        
        print(f\"Stock Locations: {len(levels)}\")
        print(f\"Total Units: {summary.get('total_units', 0)}\")
        print(f\"Total On Hand: {summary.get('total_on_hand', 0)}\")
        print(f\"Total Available: {summary.get('total_available', 0)}\")
        print(f\"Total On Rent: {summary.get('total_on_rent', 0)}\")
except Exception as e:
    print(f\"Error parsing response: {e}\")
" 2>/dev/null
fi

echo ""
echo -e "${YELLOW}5. Summary${NC}"
echo -e "===================="
echo -e "API Base URL: $API_BASE_URL"
echo -e "Item ID: $ITEM_ID"
echo -e "Authentication: ${TOKEN:+Enabled}"
echo ""
echo -e "${BLUE}To manually test in browser:${NC}"
echo -e "  Open: http://localhost:3000/inventory/items/$ITEM_ID"
echo ""
echo -e "${BLUE}To view API docs:${NC}"
echo -e "  Open: http://localhost:8000/docs#/inventory-items"
echo ""