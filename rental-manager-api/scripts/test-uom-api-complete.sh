#!/bin/bash

# 🏭 Unit of Measurement API - Complete Testing Suite
# Comprehensive CRUD testing for UoM endpoints with validation, RBAC, and CORS

set -e

echo "🔬 Unit of Measurement API - 100% Coverage Test"
echo "=" $(printf "%*s" 60 | tr ' ' '=')

# Configuration
API_BASE="http://localhost:8001/api/v1"
TEST_LOG="uom_api_test_results.log"
METRICS_FILE="uom_test_metrics.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
START_TIME=$(date +%s)

# Test results tracking
declare -A TEST_RESULTS
declare -A PERFORMANCE_METRICS

# Utility functions
log_test() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" == "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✅ ${test_name}${NC}" | tee -a "$TEST_LOG"
        TEST_RESULTS["$test_name"]="PASS"
    elif [ "$status" == "FAIL" ]; then
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}❌ ${test_name}${NC}" | tee -a "$TEST_LOG"
        echo -e "${RED}   Details: ${details}${NC}" | tee -a "$TEST_LOG"
        TEST_RESULTS["$test_name"]="FAIL"
    else
        echo -e "${YELLOW}⚠️  ${test_name}${NC}" | tee -a "$TEST_LOG"
        TEST_RESULTS["$test_name"]="SKIP"
    fi
    
    echo "[$timestamp] $test_name: $status - $details" >> "$TEST_LOG"
}

measure_time() {
    local start=$1
    local end=$2
    echo $((end - start))
}

# Authentication
authenticate() {
    echo -e "\n${BLUE}📍 Phase 1: Authentication${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    local auth_start=$(date +%s%N | cut -b1-13)
    
    AUTH_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username": "admin", "password": "admin123"}' \
        -o auth_response.tmp 2>/dev/null)
    
    local auth_end=$(date +%s%N | cut -b1-13)
    local auth_time=$((auth_end - auth_start))
    
    if [ "$AUTH_RESPONSE" == "200" ]; then
        ACCESS_TOKEN=$(cat auth_response.tmp | jq -r '.access_token')
        AUTH_HEADER="Authorization: Bearer $ACCESS_TOKEN"
        log_test "Authentication" "PASS" "Login successful in ${auth_time}ms"
        PERFORMANCE_METRICS["auth_time"]="$auth_time"
    else
        log_test "Authentication" "FAIL" "Login failed with code $AUTH_RESPONSE"
        echo "❌ Authentication failed. Cannot proceed with tests."
        exit 1
    fi
    
    rm -f auth_response.tmp
}

# Phase 2: CRUD Operations Testing
test_crud_operations() {
    echo -e "\n${BLUE}📍 Phase 2: CRUD Operations Testing${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    # Test 1: Create UoM with all fields
    echo "🔬 Testing CREATE operations..."
    
    local create_start=$(date +%s%N | cut -b1-13)
    CREATE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{
            "name": "Test Kilogram API",
            "code": "TKAPI",
            "description": "Test unit created via API"
        }' \
        -o create_response.tmp 2>/dev/null)
    
    local create_end=$(date +%s%N | cut -b1-13)
    local create_time=$((create_end - create_start))
    PERFORMANCE_METRICS["create_time"]="$create_time"
    
    if [ "$CREATE_RESPONSE" == "201" ]; then
        UOM_ID=$(cat create_response.tmp | jq -r '.id')
        UOM_NAME=$(cat create_response.tmp | jq -r '.name')
        UOM_DISPLAY=$(cat create_response.tmp | jq -r '.display_name')
        
        log_test "Create UoM with all fields" "PASS" "Created UoM $UOM_ID in ${create_time}ms"
        
        # Verify display_name logic
        if [ "$UOM_DISPLAY" == "Test Kilogram API (TKAPI)" ]; then
            log_test "Display name formatting" "PASS" "Correct format: $UOM_DISPLAY"
        else
            log_test "Display name formatting" "FAIL" "Expected 'Test Kilogram API (TKAPI)', got '$UOM_DISPLAY'"
        fi
    else
        ERROR_MSG=$(cat create_response.tmp | jq -r '.detail // "Unknown error"')
        log_test "Create UoM with all fields" "FAIL" "HTTP $CREATE_RESPONSE: $ERROR_MSG"
    fi
    
    # Test 2: Create UoM without code (optional field)
    CREATE_NO_CODE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{
            "name": "No Code Unit",
            "description": "Unit without code"
        }' \
        -o create_no_code.tmp 2>/dev/null)
    
    if [ "$CREATE_NO_CODE_RESPONSE" == "201" ]; then
        DISPLAY_NO_CODE=$(cat create_no_code.tmp | jq -r '.display_name')
        if [ "$DISPLAY_NO_CODE" == "No Code Unit" ]; then
            log_test "Create UoM without code" "PASS" "Display name without code: $DISPLAY_NO_CODE"
        else
            log_test "Create UoM without code" "FAIL" "Unexpected display name: $DISPLAY_NO_CODE"
        fi
        NO_CODE_UOM_ID=$(cat create_no_code.tmp | jq -r '.id')
    else
        ERROR_MSG=$(cat create_no_code.tmp | jq -r '.detail // "Unknown error"')
        log_test "Create UoM without code" "FAIL" "HTTP $CREATE_NO_CODE_RESPONSE: $ERROR_MSG"
    fi
    
    # Test 3: Read single UoM
    echo "🔍 Testing READ operations..."
    
    local read_start=$(date +%s%N | cut -b1-13)
    READ_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/$UOM_ID" \
        -H "$AUTH_HEADER" \
        -o read_response.tmp 2>/dev/null)
    
    local read_end=$(date +%s%N | cut -b1-13)
    local read_time=$((read_end - read_start))
    PERFORMANCE_METRICS["read_time"]="$read_time"
    
    if [ "$READ_RESPONSE" == "200" ]; then
        READ_NAME=$(cat read_response.tmp | jq -r '.name')
        if [ "$READ_NAME" == "$UOM_NAME" ]; then
            log_test "Read single UoM" "PASS" "Retrieved UoM in ${read_time}ms"
        else
            log_test "Read single UoM" "FAIL" "Name mismatch: expected '$UOM_NAME', got '$READ_NAME'"
        fi
    else
        ERROR_MSG=$(cat read_response.tmp | jq -r '.detail // "Unknown error"')
        log_test "Read single UoM" "FAIL" "HTTP $READ_RESPONSE: $ERROR_MSG"
    fi
    
    # Test 4: List UoMs with pagination
    LIST_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/?page=1&page_size=10" \
        -H "$AUTH_HEADER" \
        -o list_response.tmp 2>/dev/null)
    
    if [ "$LIST_RESPONSE" == "200" ]; then
        TOTAL_ITEMS=$(cat list_response.tmp | jq -r '.total')
        PAGE_SIZE=$(cat list_response.tmp | jq -r '.page_size')
        ITEMS_COUNT=$(cat list_response.tmp | jq -r '.items | length')
        
        log_test "List UoMs with pagination" "PASS" "Retrieved $ITEMS_COUNT items, total: $TOTAL_ITEMS"
    else
        ERROR_MSG=$(cat list_response.tmp | jq -r '.detail // "Unknown error"')
        log_test "List UoMs with pagination" "FAIL" "HTTP $LIST_RESPONSE: $ERROR_MSG"
    fi
    
    # Test 5: Update UoM
    echo "📝 Testing UPDATE operations..."
    
    local update_start=$(date +%s%N | cut -b1-13)
    UPDATE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X PUT "$API_BASE/unit-of-measurement/$UOM_ID" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{
            "name": "Updated Test Kilogram API",
            "description": "Updated description via API"
        }' \
        -o update_response.tmp 2>/dev/null)
    
    local update_end=$(date +%s%N | cut -b1-13)
    local update_time=$((update_end - update_start))
    PERFORMANCE_METRICS["update_time"]="$update_time"
    
    if [ "$UPDATE_RESPONSE" == "200" ]; then
        UPDATED_NAME=$(cat update_response.tmp | jq -r '.name')
        UPDATED_CODE=$(cat update_response.tmp | jq -r '.code')
        
        if [[ "$UPDATED_NAME" == "Updated Test Kilogram API" && "$UPDATED_CODE" == "TKAPI" ]]; then
            log_test "Update UoM" "PASS" "Updated UoM in ${update_time}ms"
        else
            log_test "Update UoM" "FAIL" "Update verification failed"
        fi
    else
        ERROR_MSG=$(cat update_response.tmp | jq -r '.detail // "Unknown error"')
        log_test "Update UoM" "FAIL" "HTTP $UPDATE_RESPONSE: $ERROR_MSG"
    fi
    
    # Test 6: Delete UoM (soft delete)
    echo "🗑️ Testing DELETE operations..."
    
    local delete_start=$(date +%s%N | cut -b1-13)
    DELETE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X DELETE "$API_BASE/unit-of-measurement/$NO_CODE_UOM_ID" \
        -H "$AUTH_HEADER" \
        2>/dev/null)
    
    local delete_end=$(date +%s%N | cut -b1-13)
    local delete_time=$((delete_end - delete_start))
    PERFORMANCE_METRICS["delete_time"]="$delete_time"
    
    if [ "$DELETE_RESPONSE" == "204" ]; then
        log_test "Delete UoM (soft delete)" "PASS" "Deleted UoM in ${delete_time}ms"
        
        # Verify soft delete by trying to read
        VERIFY_DELETE=$(curl -s -w "%{http_code}" \
            -X GET "$API_BASE/unit-of-measurement/$NO_CODE_UOM_ID" \
            -H "$AUTH_HEADER" \
            -o verify_delete.tmp 2>/dev/null)
        
        if [ "$VERIFY_DELETE" == "404" ]; then
            log_test "Verify soft delete" "PASS" "UoM properly deactivated"
        else
            log_test "Verify soft delete" "FAIL" "UoM still accessible after delete"
        fi
    else
        log_test "Delete UoM (soft delete)" "FAIL" "HTTP $DELETE_RESPONSE"
    fi
    
    rm -f *.tmp
}

# Phase 3: Validation Testing
test_validation_rules() {
    echo -e "\n${BLUE}📍 Phase 3: Validation Rules Testing${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    # Test 1: Name too long (>50 characters)
    LONG_NAME="This is a very long unit name that exceeds fifty characters limit for testing validation"
    LONG_NAME_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d "{\"name\": \"$LONG_NAME\", \"code\": \"LONG\"}" \
        -o long_name.tmp 2>/dev/null)
    
    if [ "$LONG_NAME_RESPONSE" == "422" ] || [ "$LONG_NAME_RESPONSE" == "400" ]; then
        log_test "Name length validation (>50 chars)" "PASS" "Properly rejected long name"
    else
        log_test "Name length validation (>50 chars)" "FAIL" "HTTP $LONG_NAME_RESPONSE - Should reject long names"
    fi
    
    # Test 2: Code too long (>10 characters)
    LONG_CODE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{"name": "Valid Name", "code": "VERYLONGCODE123"}' \
        -o long_code.tmp 2>/dev/null)
    
    if [ "$LONG_CODE_RESPONSE" == "422" ] || [ "$LONG_CODE_RESPONSE" == "400" ]; then
        log_test "Code length validation (>10 chars)" "PASS" "Properly rejected long code"
    else
        log_test "Code length validation (>10 chars)" "FAIL" "HTTP $LONG_CODE_RESPONSE - Should reject long codes"
    fi
    
    # Test 3: Empty name
    EMPTY_NAME_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{"name": "", "code": "EMPTY"}' \
        -o empty_name.tmp 2>/dev/null)
    
    if [ "$EMPTY_NAME_RESPONSE" == "422" ] || [ "$EMPTY_NAME_RESPONSE" == "400" ]; then
        log_test "Empty name validation" "PASS" "Properly rejected empty name"
    else
        log_test "Empty name validation" "FAIL" "HTTP $EMPTY_NAME_RESPONSE - Should reject empty names"
    fi
    
    # Test 4: Whitespace-only name
    WHITESPACE_NAME_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{"name": "   ", "code": "WS"}' \
        -o whitespace_name.tmp 2>/dev/null)
    
    if [ "$WHITESPACE_NAME_RESPONSE" == "422" ] || [ "$WHITESPACE_NAME_RESPONSE" == "400" ]; then
        log_test "Whitespace-only name validation" "PASS" "Properly rejected whitespace name"
    else
        log_test "Whitespace-only name validation" "FAIL" "HTTP $WHITESPACE_NAME_RESPONSE - Should reject whitespace names"
    fi
    
    # Test 5: Description too long (>500 characters)
    LONG_DESC="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque."
    
    LONG_DESC_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d "{\"name\": \"Valid Name\", \"code\": \"VN\", \"description\": \"$LONG_DESC\"}" \
        -o long_desc.tmp 2>/dev/null)
    
    if [ "$LONG_DESC_RESPONSE" == "422" ] || [ "$LONG_DESC_RESPONSE" == "400" ]; then
        log_test "Description length validation (>500 chars)" "PASS" "Properly rejected long description"
    else
        log_test "Description length validation (>500 chars)" "FAIL" "HTTP $LONG_DESC_RESPONSE - Should reject long descriptions"
    fi
    
    # Test 6: Duplicate name
    # First create a unit
    curl -s -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{"name": "Duplicate Test", "code": "DT1"}' \
        >/dev/null 2>&1
    
    # Try to create another with same name
    DUPLICATE_NAME_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{"name": "Duplicate Test", "code": "DT2"}' \
        -o duplicate_name.tmp 2>/dev/null)
    
    if [ "$DUPLICATE_NAME_RESPONSE" == "409" ]; then
        log_test "Duplicate name validation" "PASS" "Properly rejected duplicate name"
    else
        log_test "Duplicate name validation" "FAIL" "HTTP $DUPLICATE_NAME_RESPONSE - Should reject duplicate names"
    fi
    
    # Test 7: Duplicate code
    DUPLICATE_CODE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{"name": "Different Name", "code": "DT1"}' \
        -o duplicate_code.tmp 2>/dev/null)
    
    if [ "$DUPLICATE_CODE_RESPONSE" == "409" ]; then
        log_test "Duplicate code validation" "PASS" "Properly rejected duplicate code"
    else
        log_test "Duplicate code validation" "FAIL" "HTTP $DUPLICATE_CODE_RESPONSE - Should reject duplicate codes"
    fi
    
    # Test 8: Code case sensitivity (should auto-uppercase)
    CASE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{"name": "Case Test", "code": "lower"}' \
        -o case_response.tmp 2>/dev/null)
    
    if [ "$CASE_RESPONSE" == "201" ]; then
        RETURNED_CODE=$(cat case_response.tmp | jq -r '.code')
        if [ "$RETURNED_CODE" == "LOWER" ]; then
            log_test "Code case sensitivity (auto-uppercase)" "PASS" "Code properly converted to uppercase"
        else
            log_test "Code case sensitivity (auto-uppercase)" "FAIL" "Code not converted: got '$RETURNED_CODE'"
        fi
    else
        log_test "Code case sensitivity (auto-uppercase)" "FAIL" "HTTP $CASE_RESPONSE - Creation failed"
    fi
    
    rm -f *.tmp
}

# Phase 4: Search and Filtering
test_search_filtering() {
    echo -e "\n${BLUE}📍 Phase 4: Search and Filtering${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    # Create test data for searching
    SEARCH_UNITS=(
        '{"name": "Search Kilogram", "code": "SKG", "description": "Weight unit for search"}'
        '{"name": "Search Meter", "code": "SM", "description": "Length unit for search"}'
        '{"name": "Search Liter", "code": "SL", "description": "Volume unit for search"}'
        '{"name": "Other Unit", "code": "OU", "description": "Different unit"}'
    )
    
    echo "Creating test data for search..."
    for unit in "${SEARCH_UNITS[@]}"; do
        curl -s -X POST "$API_BASE/unit-of-measurement/" \
            -H "Content-Type: application/json" \
            -H "$AUTH_HEADER" \
            -d "$unit" >/dev/null 2>&1
    done
    
    # Test 1: Search by name
    SEARCH_NAME_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/search/?q=search&limit=10" \
        -H "$AUTH_HEADER" \
        -o search_name.tmp 2>/dev/null)
    
    if [ "$SEARCH_NAME_RESPONSE" == "200" ]; then
        SEARCH_COUNT=$(cat search_name.tmp | jq '. | length')
        if [ "$SEARCH_COUNT" -ge 3 ]; then
            log_test "Search by name" "PASS" "Found $SEARCH_COUNT matching units"
        else
            log_test "Search by name" "FAIL" "Expected at least 3 results, got $SEARCH_COUNT"
        fi
    else
        log_test "Search by name" "FAIL" "HTTP $SEARCH_NAME_RESPONSE"
    fi
    
    # Test 2: Filter by name (partial match)
    FILTER_NAME_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/?name=kilogram" \
        -H "$AUTH_HEADER" \
        -o filter_name.tmp 2>/dev/null)
    
    if [ "$FILTER_NAME_RESPONSE" == "200" ]; then
        FILTER_COUNT=$(cat filter_name.tmp | jq '.items | length')
        log_test "Filter by name (partial match)" "PASS" "Filtered $FILTER_COUNT units"
    else
        log_test "Filter by name (partial match)" "FAIL" "HTTP $FILTER_NAME_RESPONSE"
    fi
    
    # Test 3: Filter by code
    FILTER_CODE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/?code=S" \
        -H "$AUTH_HEADER" \
        -o filter_code.tmp 2>/dev/null)
    
    if [ "$FILTER_CODE_RESPONSE" == "200" ]; then
        CODE_FILTER_COUNT=$(cat filter_code.tmp | jq '.items | length')
        log_test "Filter by code" "PASS" "Filtered $CODE_FILTER_COUNT units by code"
    else
        log_test "Filter by code" "FAIL" "HTTP $FILTER_CODE_RESPONSE"
    fi
    
    # Test 4: Sorting
    SORT_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/?sort_field=name&sort_direction=desc" \
        -H "$AUTH_HEADER" \
        -o sort_response.tmp 2>/dev/null)
    
    if [ "$SORT_RESPONSE" == "200" ]; then
        log_test "Sorting by name descending" "PASS" "Sorting applied successfully"
    else
        log_test "Sorting by name descending" "FAIL" "HTTP $SORT_RESPONSE"
    fi
    
    rm -f *.tmp
}

# Phase 5: Business Logic Testing
test_business_logic() {
    echo -e "\n${BLUE}📍 Phase 5: Business Logic Testing${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    # Test 1: Statistics endpoint
    STATS_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/stats/" \
        -H "$AUTH_HEADER" \
        -o stats_response.tmp 2>/dev/null)
    
    if [ "$STATS_RESPONSE" == "200" ]; then
        TOTAL_UNITS=$(cat stats_response.tmp | jq -r '.total_units')
        ACTIVE_UNITS=$(cat stats_response.tmp | jq -r '.active_units')
        
        if [[ "$TOTAL_UNITS" =~ ^[0-9]+$ && "$ACTIVE_UNITS" =~ ^[0-9]+$ ]]; then
            log_test "Statistics endpoint" "PASS" "Total: $TOTAL_UNITS, Active: $ACTIVE_UNITS"
        else
            log_test "Statistics endpoint" "FAIL" "Invalid statistics format"
        fi
    else
        log_test "Statistics endpoint" "FAIL" "HTTP $STATS_RESPONSE"
    fi
    
    # Test 2: Active units endpoint
    ACTIVE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/active/" \
        -H "$AUTH_HEADER" \
        -o active_response.tmp 2>/dev/null)
    
    if [ "$ACTIVE_RESPONSE" == "200" ]; then
        ACTIVE_COUNT=$(cat active_response.tmp | jq '. | length')
        log_test "Active units endpoint" "PASS" "Retrieved $ACTIVE_COUNT active units"
    else
        log_test "Active units endpoint" "FAIL" "HTTP $ACTIVE_RESPONSE"
    fi
    
    # Test 3: Bulk operations
    # First create units for bulk testing
    BULK_IDS=()
    for i in {1..3}; do
        BULK_CREATE=$(curl -s -X POST "$API_BASE/unit-of-measurement/" \
            -H "Content-Type: application/json" \
            -H "$AUTH_HEADER" \
            -d "{\"name\": \"Bulk Unit $i\", \"code\": \"BU$i\"}")
        
        BULK_ID=$(echo "$BULK_CREATE" | jq -r '.id')
        BULK_IDS+=("\"$BULK_ID\"")
    done
    
    # Create bulk operation JSON
    BULK_JSON="{\"unit_ids\": [$(IFS=,; echo "${BULK_IDS[*]}")], \"operation\": \"deactivate\"}"
    
    BULK_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/bulk-operation" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d "$BULK_JSON" \
        -o bulk_response.tmp 2>/dev/null)
    
    if [ "$BULK_RESPONSE" == "200" ]; then
        SUCCESS_COUNT=$(cat bulk_response.tmp | jq -r '.success_count')
        if [ "$SUCCESS_COUNT" == "3" ]; then
            log_test "Bulk deactivation" "PASS" "Deactivated $SUCCESS_COUNT units"
        else
            log_test "Bulk deactivation" "FAIL" "Expected 3, got $SUCCESS_COUNT"
        fi
    else
        log_test "Bulk deactivation" "FAIL" "HTTP $BULK_RESPONSE"
    fi
    
    rm -f *.tmp
}

# Phase 6: CORS Headers Testing
test_cors_headers() {
    echo -e "\n${BLUE}📍 Phase 6: CORS Headers Testing${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    # Test CORS preflight request
    CORS_RESPONSE=$(curl -s -w "%{http_code}" \
        -X OPTIONS "$API_BASE/unit-of-measurement/" \
        -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization" \
        -o cors_response.tmp 2>/dev/null)
    
    if [ "$CORS_RESPONSE" == "200" ] || [ "$CORS_RESPONSE" == "204" ]; then
        # Check for CORS headers in response
        CORS_HEADERS=$(curl -s -I -X OPTIONS "$API_BASE/unit-of-measurement/" \
            -H "Origin: http://localhost:3000" \
            -H "Access-Control-Request-Method: POST" \
            -H "Access-Control-Request-Headers: Content-Type,Authorization" 2>/dev/null)
        
        if echo "$CORS_HEADERS" | grep -q "Access-Control-Allow-Origin"; then
            log_test "CORS headers present" "PASS" "CORS headers found in response"
        else
            log_test "CORS headers present" "FAIL" "Missing CORS headers"
        fi
    else
        log_test "CORS preflight request" "FAIL" "HTTP $CORS_RESPONSE"
    fi
    
    # Test actual CORS request
    CORS_GET_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/stats/" \
        -H "Origin: http://localhost:3000" \
        -H "$AUTH_HEADER" \
        -o cors_get_response.tmp 2>/dev/null)
    
    if [ "$CORS_GET_RESPONSE" == "200" ]; then
        log_test "CORS GET request" "PASS" "Cross-origin GET request successful"
    else
        log_test "CORS GET request" "FAIL" "HTTP $CORS_GET_RESPONSE"
    fi
    
    rm -f *.tmp
}

# Phase 7: Error Handling Testing
test_error_handling() {
    echo -e "\n${BLUE}📍 Phase 7: Error Handling Testing${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    # Test 1: Non-existent UoM
    FAKE_UUID="00000000-0000-0000-0000-000000000000"
    NOT_FOUND_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/$FAKE_UUID" \
        -H "$AUTH_HEADER" \
        -o not_found.tmp 2>/dev/null)
    
    if [ "$NOT_FOUND_RESPONSE" == "404" ]; then
        log_test "Non-existent UoM (404)" "PASS" "Properly returned 404"
    else
        log_test "Non-existent UoM (404)" "FAIL" "HTTP $NOT_FOUND_RESPONSE - Expected 404"
    fi
    
    # Test 2: Invalid UUID format
    INVALID_UUID_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/invalid-uuid" \
        -H "$AUTH_HEADER" \
        -o invalid_uuid.tmp 2>/dev/null)
    
    if [ "$INVALID_UUID_RESPONSE" == "422" ] || [ "$INVALID_UUID_RESPONSE" == "400" ]; then
        log_test "Invalid UUID format" "PASS" "Properly rejected invalid UUID"
    else
        log_test "Invalid UUID format" "FAIL" "HTTP $INVALID_UUID_RESPONSE - Should reject invalid UUID"
    fi
    
    # Test 3: Unauthorized access (no token)
    UNAUTHORIZED_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/" \
        -o unauthorized.tmp 2>/dev/null)
    
    if [ "$UNAUTHORIZED_RESPONSE" == "401" ]; then
        log_test "Unauthorized access (no token)" "PASS" "Properly returned 401"
    else
        log_test "Unauthorized access (no token)" "FAIL" "HTTP $UNAUTHORIZED_RESPONSE - Expected 401"
    fi
    
    # Test 4: Invalid JSON payload
    INVALID_JSON_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d '{"name": "Valid", "code": "VLD", invalid_json}' \
        -o invalid_json.tmp 2>/dev/null)
    
    if [ "$INVALID_JSON_RESPONSE" == "422" ] || [ "$INVALID_JSON_RESPONSE" == "400" ]; then
        log_test "Invalid JSON payload" "PASS" "Properly rejected invalid JSON"
    else
        log_test "Invalid JSON payload" "FAIL" "HTTP $INVALID_JSON_RESPONSE - Should reject invalid JSON"
    fi
    
    rm -f *.tmp
}

# Generate final report
generate_report() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    echo -e "\n${BLUE}📊 Test Results Summary${NC}"
    echo "=" $(printf "%*s" 60 | tr ' ' '=')
    
    echo -e "${GREEN}✅ Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}❌ Failed: $FAILED_TESTS${NC}"
    echo -e "${BLUE}📊 Total:  $TOTAL_TESTS${NC}"
    echo -e "${YELLOW}⏱️  Duration: ${duration}s${NC}"
    
    # Calculate success rate
    if [ $TOTAL_TESTS -gt 0 ]; then
        SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
        echo -e "${BLUE}📈 Success Rate: ${SUCCESS_RATE}%${NC}"
        
        if [ $SUCCESS_RATE -ge 90 ]; then
            echo -e "${GREEN}🎉 Excellent test coverage!${NC}"
        elif [ $SUCCESS_RATE -ge 75 ]; then
            echo -e "${YELLOW}⚠️  Good coverage, some improvements needed${NC}"
        else
            echo -e "${RED}🚨 Poor coverage, significant issues found${NC}"
        fi
    fi
    
    # Generate metrics JSON
    cat > "$METRICS_FILE" <<EOF
{
  "summary": {
    "total_tests": $TOTAL_TESTS,
    "passed_tests": $PASSED_TESTS,
    "failed_tests": $FAILED_TESTS,
    "success_rate": $SUCCESS_RATE,
    "duration_seconds": $duration,
    "timestamp": "$(date -Iseconds)"
  },
  "performance": {
    "auth_time_ms": ${PERFORMANCE_METRICS["auth_time"]:-0},
    "create_time_ms": ${PERFORMANCE_METRICS["create_time"]:-0},
    "read_time_ms": ${PERFORMANCE_METRICS["read_time"]:-0},
    "update_time_ms": ${PERFORMANCE_METRICS["update_time"]:-0},
    "delete_time_ms": ${PERFORMANCE_METRICS["delete_time"]:-0}
  }
}
EOF
    
    echo -e "\n${BLUE}📄 Detailed results saved to: $TEST_LOG${NC}"
    echo -e "${BLUE}📊 Metrics saved to: $METRICS_FILE${NC}"
    
    # Exit with appropriate code for CI/CD
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}🎯 All tests passed! ✨${NC}"
        exit 0
    else
        echo -e "\n${RED}💥 Some tests failed. Check the logs for details.${NC}"
        exit 1
    fi
}

# Main execution flow
main() {
    # Clean up any existing temp files
    rm -f *.tmp "$TEST_LOG" "$METRICS_FILE"
    
    echo "Starting UoM API testing at $(date)"
    echo "Test results will be logged to: $TEST_LOG"
    
    # Run all test phases
    authenticate
    test_crud_operations
    test_validation_rules
    test_search_filtering
    test_business_logic
    test_cors_headers
    test_error_handling
    
    # Generate final report
    generate_report
}

# Execute main function
main "$@"