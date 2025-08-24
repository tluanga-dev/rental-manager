#!/bin/bash

# 🧪 Brand CRUD API Testing Suite
# Tests all Create, Read, Update, Delete operations for Brand feature
# Covers validation, error handling, edge cases, and success scenarios

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Configuration
API_BASE="http://localhost:8000/api/v1"
CONTENT_TYPE="Content-Type: application/json"

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Get authentication token
echo -e "${BLUE}🔑 Getting authentication token...${NC}"
TOKEN=$(bash "$(dirname "$0")/get-test-token.sh")

if [ "$TOKEN" = "dummy_token" ]; then
    echo -e "${YELLOW}⚠️  Using dummy token - some tests may fail if auth is required${NC}"
fi

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" \
            "$API_BASE$endpoint" \
            -H "$CONTENT_TYPE" \
            -H "Authorization: Bearer $TOKEN" \
            -d "$data")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" \
            "$API_BASE$endpoint" \
            -H "Authorization: Bearer $TOKEN")
    fi
    
    # Extract HTTP status and body
    HTTP_STATUS=$(echo $response | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    HTTP_BODY=$(echo $response | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    echo "Status: $HTTP_STATUS"
    echo "Response: $HTTP_BODY"
    
    return 0
}

# Test result logging
log_test() {
    local test_name=$1
    local result=$2
    local details=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        if [ -n "$details" ]; then
            echo -e "${RED}   Details: $details${NC}"
        fi
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Test case wrapper
test_case() {
    local test_name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    local validation_func=$6
    
    echo -e "\n${BLUE}🧪 Testing: $test_name${NC}"
    
    api_call "$method" "$endpoint" "$data" "$expected_status"
    
    # Check HTTP status
    if [ "$HTTP_STATUS" = "$expected_status" ]; then
        if [ -n "$validation_func" ] && type "$validation_func" > /dev/null 2>&1; then
            $validation_func "$HTTP_BODY"
        else
            log_test "$test_name" "PASS" "Status $HTTP_STATUS as expected"
        fi
    else
        log_test "$test_name" "FAIL" "Expected status $expected_status, got $HTTP_STATUS"
    fi
}

# Validation functions
validate_brand_created() {
    local body=$1
    if echo "$body" | jq -e '.id' > /dev/null 2>&1 && \
       echo "$body" | jq -e '.name' > /dev/null 2>&1; then
        BRAND_ID=$(echo "$body" | jq -r '.id')
        log_test "Valid brand creation" "PASS" "Brand created with ID: $BRAND_ID"
    else
        log_test "Valid brand creation" "FAIL" "Missing required fields in response"
    fi
}

validate_brand_with_code() {
    local body=$1
    if echo "$body" | jq -e '.id' > /dev/null 2>&1 && \
       echo "$body" | jq -e '.code' > /dev/null 2>&1; then
        local code=$(echo "$body" | jq -r '.code')
        if [ "$code" = "NIKE-01" ]; then
            log_test "Brand creation with code" "PASS" "Code correctly set: $code"
        else
            log_test "Brand creation with code" "FAIL" "Expected NIKE-01, got: $code"
        fi
    else
        log_test "Brand creation with code" "FAIL" "Missing code in response"
    fi
}

validate_uppercase_code() {
    local body=$1
    if echo "$body" | jq -e '.code' > /dev/null 2>&1; then
        local code=$(echo "$body" | jq -r '.code')
        if [ "$code" = "ABC-123" ]; then
            log_test "Code auto-uppercase conversion" "PASS" "Code converted to uppercase: $code"
        else
            log_test "Code auto-uppercase conversion" "FAIL" "Expected ABC-123, got: $code"
        fi
    else
        log_test "Code auto-uppercase conversion" "FAIL" "Code missing in response"
    fi
}

validate_validation_error() {
    local body=$1
    local field=$2
    if echo "$body" | jq -e '.detail' > /dev/null 2>&1 || \
       echo "$body" | jq -e '.errors' > /dev/null 2>&1; then
        log_test "$field validation error" "PASS" "Validation error returned as expected"
    else
        log_test "$field validation error" "FAIL" "Expected validation error, got: $body"
    fi
}

validate_conflict_error() {
    local body=$1
    local field=$2
    if echo "$body" | jq -e '.detail' > /dev/null 2>&1; then
        log_test "$field uniqueness constraint" "PASS" "Conflict error returned as expected"
    else
        log_test "$field uniqueness constraint" "FAIL" "Expected conflict error, got: $body"
    fi
}

validate_brand_list() {
    local body=$1
    if echo "$body" | jq -e '.items' > /dev/null 2>&1; then
        local count=$(echo "$body" | jq '.items | length')
        log_test "Brand list retrieval" "PASS" "Retrieved $count brands"
    else
        log_test "Brand list retrieval" "FAIL" "Expected items array in response"
    fi
}

validate_not_found() {
    local body=$1
    if echo "$body" | jq -e '.detail' > /dev/null 2>&1; then
        log_test "Non-existent brand 404" "PASS" "Not found error returned"
    else
        log_test "Non-existent brand 404" "FAIL" "Expected 404 error, got: $body"
    fi
}

validate_brand_updated() {
    local body=$1
    if echo "$body" | jq -e '.name' > /dev/null 2>&1; then
        local name=$(echo "$body" | jq -r '.name')
        if [ "$name" = "Nike Updated" ]; then
            log_test "Brand update" "PASS" "Brand name updated successfully"
        else
            log_test "Brand update" "FAIL" "Expected 'Nike Updated', got: $name"
        fi
    else
        log_test "Brand update" "FAIL" "Name missing in update response"
    fi
}

validate_delete_success() {
    local body=$1
    log_test "Brand deletion" "PASS" "Brand deleted successfully"
}

# Start tests
echo -e "${BLUE}🧪 Brand CRUD API Testing Suite${NC}"
echo "========================================"

# CREATE TESTS
echo -e "\n${YELLOW}📝 Testing Brand Creation...${NC}"

# Valid brand creation (name only)
test_case "Create brand with name only" \
    "POST" "/brands/" \
    '{"name": "Nike"}' \
    "201" \
    "validate_brand_created"

# Valid brand creation (name + code)
test_case "Create brand with name and code" \
    "POST" "/brands" \
    '{"name": "Adidas", "code": "NIKE-01"}' \
    "201" \
    "validate_brand_with_code"

# Valid brand creation (name + code + description)
test_case "Create brand with all fields" \
    "POST" "/brands" \
    '{"name": "Puma", "code": "PUMA-01", "description": "German athletic wear brand"}' \
    "201" \
    "validate_brand_created"

# Test code auto-uppercase
test_case "Code auto-uppercase conversion" \
    "POST" "/brands" \
    '{"name": "Test Brand", "code": "abc-123"}' \
    "201" \
    "validate_uppercase_code"

# Validation error tests
echo -e "\n${YELLOW}❌ Testing Validation Errors...${NC}"

# Empty name
test_case "Empty name validation" \
    "POST" "/brands" \
    '{"name": ""}' \
    "422" \
    "validate_validation_error"

# Name too long
test_case "Name too long validation" \
    "POST" "/brands" \
    '{"name": "' $(printf 'A%.0s' {1..101}) '"}' \
    "422" \
    "validate_validation_error"

# Code too long
test_case "Code too long validation" \
    "POST" "/brands" \
    '{"name": "Test Brand", "code": "' $(printf 'A%.0s' {1..21}) '"}' \
    "422" \
    "validate_validation_error"

# Invalid code characters
test_case "Invalid code characters validation" \
    "POST" "/brands" \
    '{"name": "Test Brand", "code": "brand#1"}' \
    "422" \
    "validate_validation_error"

# Description too long
test_case "Description too long validation" \
    "POST" "/brands" \
    '{"name": "Test Brand", "description": "' $(printf 'A%.0s' {1..1001}) '"}' \
    "422" \
    "validate_validation_error"

# Duplicate name
test_case "Duplicate name constraint" \
    "POST" "/brands" \
    '{"name": "Nike"}' \
    "409" \
    "validate_conflict_error"

# Duplicate code
test_case "Duplicate code constraint" \
    "POST" "/brands" \
    '{"name": "Different Brand", "code": "NIKE-01"}' \
    "409" \
    "validate_conflict_error"

# READ TESTS
echo -e "\n${YELLOW}📖 Testing Brand Reading...${NC}"

# List brands
test_case "List all brands" \
    "GET" "/brands" \
    "" \
    "200" \
    "validate_brand_list"

# Get brand by ID (using created brand)
if [ -n "$BRAND_ID" ]; then
    test_case "Get brand by ID" \
        "GET" "/brands/$BRAND_ID" \
        "" \
        "200" \
        "validate_brand_created"
fi

# Get non-existent brand
test_case "Get non-existent brand" \
    "GET" "/brands/00000000-0000-0000-0000-000000000000" \
    "" \
    "404" \
    "validate_not_found"

# Search brands
test_case "Search brands by name" \
    "GET" "/brands?search=Nike" \
    "" \
    "200" \
    "validate_brand_list"

# Pagination
test_case "Brand list pagination" \
    "GET" "/brands?page=1&size=5" \
    "" \
    "200" \
    "validate_brand_list"

# UPDATE TESTS
echo -e "\n${YELLOW}✏️ Testing Brand Updates...${NC}"

if [ -n "$BRAND_ID" ]; then
    # Update brand name
    test_case "Update brand name" \
        "PUT" "/brands/$BRAND_ID" \
        '{"name": "Nike Updated"}' \
        "200" \
        "validate_brand_updated"

    # Update brand code
    test_case "Update brand code" \
        "PUT" "/brands/$BRAND_ID" \
        '{"name": "Nike Updated", "code": "NIKE-02"}' \
        "200" \
        "validate_brand_created"

    # Update with invalid data
    test_case "Update with invalid name" \
        "PUT" "/brands/$BRAND_ID" \
        '{"name": ""}' \
        "422" \
        "validate_validation_error"

    # Update to duplicate name
    test_case "Update to duplicate name" \
        "PUT" "/brands/$BRAND_ID" \
        '{"name": "Adidas"}' \
        "409" \
        "validate_conflict_error"
fi

# Update non-existent brand
test_case "Update non-existent brand" \
    "PUT" "/brands/00000000-0000-0000-0000-000000000000" \
    '{"name": "Updated Brand"}' \
    "404" \
    "validate_not_found"

# DELETE TESTS
echo -e "\n${YELLOW}🗑️ Testing Brand Deletion...${NC}"

# Create a brand specifically for deletion
echo -e "\n${BLUE}🧪 Creating brand for deletion test...${NC}"
api_call "POST" "/brands" '{"name": "Delete Me Brand"}' "201"
if [ "$HTTP_STATUS" = "201" ]; then
    DELETE_BRAND_ID=$(echo "$HTTP_BODY" | jq -r '.id')
fi

if [ -n "$DELETE_BRAND_ID" ]; then
    # Delete brand (should succeed as it has no items)
    test_case "Delete brand without items" \
        "DELETE" "/brands/$DELETE_BRAND_ID" \
        "" \
        "200" \
        "validate_delete_success"
fi

# Delete non-existent brand
test_case "Delete non-existent brand" \
    "DELETE" "/brands/00000000-0000-0000-0000-000000000000" \
    "" \
    "404" \
    "validate_not_found"

# ADVANCED TESTS
echo -e "\n${YELLOW}🔍 Testing Advanced Features...${NC}"

# Brand statistics
test_case "Get brand statistics" \
    "GET" "/brands/stats" \
    "" \
    "200"

# Bulk operations
test_case "Bulk activate brands" \
    "POST" "/brands/bulk/activate" \
    '{"brand_ids": ["' $BRAND_ID '"]}' \
    "200"

# Search with filters
test_case "Search with filters" \
    "GET" "/brands?search=Nike&is_active=true" \
    "" \
    "200" \
    "validate_brand_list"

# Export brands
test_case "Export brands" \
    "GET" "/brands/export" \
    "" \
    "200"

# PERFORMANCE TESTS
echo -e "\n${YELLOW}⚡ Testing Performance Edge Cases...${NC}"

# Large pagination
test_case "Large page size request" \
    "GET" "/brands?page=1&size=1000" \
    "" \
    "200" \
    "validate_brand_list"

# Complex search
test_case "Complex search query" \
    "GET" "/brands?search=test&sort_by=name&sort_order=desc&is_active=true" \
    "" \
    "200" \
    "validate_brand_list"

# TEST RESULTS SUMMARY
echo -e "\n${BLUE}📊 Brand CRUD API Test Results Summary${NC}"
echo "======================================="
echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "Success Rate: ${BLUE}$SUCCESS_RATE%${NC}"
else
    echo -e "Success Rate: ${RED}0%${NC}"
fi

# Final status
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All Brand CRUD API tests passed successfully!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some Brand CRUD API tests failed.${NC}"
    exit 1
fi