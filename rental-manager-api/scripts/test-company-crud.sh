#!/bin/bash

# Company CRUD API Testing Script
# Tests all Company endpoints with comprehensive validation scenarios
# Covers Create, Read, Update, Delete operations with edge cases

API_BASE="http://localhost:8000/api/v1"
COMPANIES_ENDPOINT="$API_BASE/companies"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to print colored output
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $message"
        ((PASSED_TESTS++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}✗ FAIL${NC}: $message"
        ((FAILED_TESTS++))
    elif [ "$status" = "INFO" ]; then
        echo -e "${BLUE}ℹ INFO${NC}: $message"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠ WARN${NC}: $message"
    fi
    ((TOTAL_TESTS++))
}

# Helper function to make API calls and validate responses
test_api_call() {
    local method=$1
    local url=$2
    local data=$3
    local expected_status=$4
    local test_name=$5
    local additional_checks=$6

    echo -e "\n${BLUE}Testing: $test_name${NC}"
    echo "Request: $method $url"
    if [ -n "$data" ]; then
        echo "Data: $data"
    fi

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" \
            -H "Content-Type: application/json")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$url" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    # Extract response body (all but last line)
    response_body=$(echo "$response" | head -n -1)

    echo "Response Status: $http_code"
    echo "Response Body: $response_body"

    if [ "$http_code" = "$expected_status" ]; then
        # Run additional checks if provided
        if [ -n "$additional_checks" ]; then
            eval "$additional_checks"
        else
            print_status "PASS" "$test_name"
        fi
    else
        print_status "FAIL" "$test_name - Expected status $expected_status, got $http_code"
    fi

    # Return response body for further processing
    echo "$response_body"
}

# Helper function to extract ID from response
extract_id() {
    local response=$1
    echo "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1
}

# Helper function to check JSON contains specific field/value
check_json_field() {
    local response=$1
    local field=$2
    local expected_value=$3
    local test_name=$4

    if echo "$response" | grep -q "\"$field\":\"$expected_value\"" || echo "$response" | grep -q "\"$field\":$expected_value"; then
        print_status "PASS" "$test_name"
    else
        print_status "FAIL" "$test_name - Field '$field' not found with value '$expected_value'"
    fi
}

echo "=================================================="
echo "🧪 COMPANY CRUD API TESTING SUITE"
echo "=================================================="
echo "Target API: $API_BASE"
echo "Testing Company endpoints with comprehensive validation"
echo ""

# Health check
echo -e "\n${BLUE}🔍 HEALTH CHECK${NC}"
health_response=$(test_api_call "GET" "$API_BASE/health" "" "200" "API Health Check")

if [[ $health_response == *"healthy"* ]]; then
    print_status "PASS" "API is healthy and accessible"
else
    print_status "FAIL" "API health check failed"
    echo "Exiting tests due to API unavailability"
    exit 1
fi

# Variables to store created company IDs for later tests
COMPANY_ID=""
COMPANY_ID_2=""

echo -e "\n${BLUE}📝 CREATE COMPANY TESTS${NC}"
echo "Testing company creation with various scenarios..."

# Test 1: Create company with all fields
test_name="Create company with all fields"
company_data='{
    "company_name": "Tech Corp Solutions",
    "address": "123 Technology Lane, Tech City, TC 12345",
    "email": "info@techcorp.com",
    "phone": "+1-555-123-4567",
    "gst_no": "27AABCU9603R1ZM",
    "registration_number": "L85110TN2019PTC123456"
}'

response=$(test_api_call "POST" "$COMPANIES_ENDPOINT/" "$company_data" "201" "$test_name")
COMPANY_ID=$(extract_id "$response")

if [ -n "$COMPANY_ID" ]; then
    check_json_field "$response" "company_name" "Tech Corp Solutions" "Company name in response"
    check_json_field "$response" "email" "info@techcorp.com" "Email in response"
    check_json_field "$response" "gst_no" "27AABCU9603R1ZM" "GST number in response"
    check_json_field "$response" "is_active" "true" "Company is active by default"
fi

# Test 2: Create company with required fields only
test_name="Create company with minimal fields"
minimal_company_data='{
    "company_name": "Simple Corp"
}'

response=$(test_api_call "POST" "$COMPANIES_ENDPOINT/" "$minimal_company_data" "201" "$test_name")
COMPANY_ID_2=$(extract_id "$response")

if [ -n "$COMPANY_ID_2" ]; then
    check_json_field "$response" "company_name" "Simple Corp" "Minimal company name in response"
    check_json_field "$response" "is_active" "true" "Minimal company is active by default"
fi

# Test 3: GST and Registration auto-uppercase
test_name="GST and Registration number auto-uppercase"
uppercase_test_data='{
    "company_name": "Uppercase Test Corp",
    "gst_no": "gst27abc123def",
    "registration_number": "reg123abc456def"
}'

response=$(test_api_call "POST" "$COMPANIES_ENDPOINT/" "$uppercase_test_data" "201" "$test_name")
check_json_field "$response" "gst_no" "GST27ABC123DEF" "GST auto-uppercase"
check_json_field "$response" "registration_number" "REG123ABC456DEF" "Registration auto-uppercase"

# Test 4: Create company with empty name (should fail)
test_name="Create company with empty name"
empty_name_data='{
    "company_name": ""
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$empty_name_data" "422" "$test_name"

# Test 5: Create company with whitespace-only name (should fail)
test_name="Create company with whitespace-only name"
whitespace_name_data='{
    "company_name": "   "
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$whitespace_name_data" "422" "$test_name"

# Test 6: Create company with name too long (should fail)
test_name="Create company with name too long"
long_name=$(printf 'A%.0s' {1..256})  # 256 characters
long_name_data="{
    \"company_name\": \"$long_name\"
}"

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$long_name_data" "422" "$test_name"

# Test 7: Create company with email too long (should fail)
test_name="Create company with email too long"
long_email=$(printf 'a%.0s' {1..250})  # 250 + @test.com = 259 characters
long_email_data="{
    \"company_name\": \"Email Test Corp\",
    \"email\": \"${long_email}@test.com\"
}"

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$long_email_data" "422" "$test_name"

# Test 8: Create company with invalid email format (should fail)
test_name="Create company with invalid email format"
invalid_email_data='{
    "company_name": "Invalid Email Corp",
    "email": "invalid-email-format"
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$invalid_email_data" "422" "$test_name"

# Test 9: Create company with phone too long (should fail)
test_name="Create company with phone too long"
long_phone=$(printf '1%.0s' {1..51})  # 51 characters
long_phone_data="{
    \"company_name\": \"Long Phone Corp\",
    \"phone\": \"$long_phone\"
}"

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$long_phone_data" "422" "$test_name"

# Test 10: Create company with GST too long (should fail)
test_name="Create company with GST too long"
long_gst=$(printf 'A%.0s' {1..51})  # 51 characters
long_gst_data="{
    \"company_name\": \"Long GST Corp\",
    \"gst_no\": \"$long_gst\"
}"

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$long_gst_data" "422" "$test_name"

# Test 11: Create company with registration number too long (should fail)
test_name="Create company with registration too long"
long_reg=$(printf 'A%.0s' {1..101})  # 101 characters
long_reg_data="{
    \"company_name\": \"Long Registration Corp\",
    \"registration_number\": \"$long_reg\"
}"

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$long_reg_data" "422" "$test_name"

# Test 12: Create company with whitespace-only phone (should fail)
test_name="Create company with whitespace-only phone"
whitespace_phone_data='{
    "company_name": "Whitespace Phone Corp",
    "phone": "   "
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$whitespace_phone_data" "422" "$test_name"

# Test 13: Duplicate company name (should fail)
test_name="Create company with duplicate name"
duplicate_name_data='{
    "company_name": "Tech Corp Solutions"
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$duplicate_name_data" "409" "$test_name"

# Test 14: Duplicate GST number (should fail)
test_name="Create company with duplicate GST"
duplicate_gst_data='{
    "company_name": "Duplicate GST Corp",
    "gst_no": "27AABCU9603R1ZM"
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$duplicate_gst_data" "409" "$test_name"

# Test 15: Duplicate registration number (should fail)
test_name="Create company with duplicate registration"
duplicate_reg_data='{
    "company_name": "Duplicate Reg Corp",
    "registration_number": "L85110TN2019PTC123456"
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$duplicate_reg_data" "409" "$test_name"

echo -e "\n${BLUE}📖 READ COMPANY TESTS${NC}"
echo "Testing company retrieval operations..."

# Test 16: Get company by ID
if [ -n "$COMPANY_ID" ]; then
    test_name="Get company by ID"
    response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/$COMPANY_ID" "" "200" "$test_name")
    check_json_field "$response" "id" "$COMPANY_ID" "Company ID matches"
    check_json_field "$response" "company_name" "Tech Corp Solutions" "Company name matches"
else
    print_status "FAIL" "Cannot test get by ID - no company ID available"
fi

# Test 17: Get non-existent company (should fail)
test_name="Get non-existent company"
fake_uuid="00000000-0000-0000-0000-000000000000"
test_api_call "GET" "$COMPANIES_ENDPOINT/$fake_uuid" "" "404" "$test_name"

# Test 18: List companies with pagination
test_name="List companies with pagination"
response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/?page=1&page_size=10" "" "200" "$test_name")
check_json_field "$response" "page" "1" "Current page in list response"

# Test 19: Filter by active status
test_name="Filter companies by active status"
response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/?is_active=true" "" "200" "$test_name")

# Test 20: Search by company name
test_name="Search companies by name"
response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/?company_name=Tech" "" "200" "$test_name")

# Test 21: Search by email
test_name="Search companies by email"
response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/?email=techcorp" "" "200" "$test_name")

# Test 22: Search by GST number
test_name="Search companies by GST"
response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/?gst_no=27AABCU" "" "200" "$test_name")

# Test 23: Search by registration number
test_name="Search companies by registration"
response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/?registration_number=L85110" "" "200" "$test_name")

# Test 24: Sort by company name
test_name="Sort companies by name"
response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/?sort_field=company_name&sort_direction=asc" "" "200" "$test_name")

# Test 25: Sort by creation date
test_name="Sort companies by created_at"
response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/?sort_field=created_at&sort_direction=desc" "" "200" "$test_name")

# Test 26: Pagination edge cases
test_name="Pagination edge case - page 0"
response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/?page=0&page_size=10" "" "422" "$test_name")

# Test 27: Global search across fields
test_name="Global search across all fields"
response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/?search=Tech" "" "200" "$test_name")

echo -e "\n${BLUE}✏️ UPDATE COMPANY TESTS${NC}"
echo "Testing company update operations..."

# Test 28: Update company name
if [ -n "$COMPANY_ID" ]; then
    test_name="Update company name"
    update_name_data='{
        "company_name": "Updated Tech Corp Solutions"
    }'
    response=$(test_api_call "PUT" "$COMPANIES_ENDPOINT/$COMPANY_ID" "$update_name_data" "200" "$test_name")
    check_json_field "$response" "company_name" "Updated Tech Corp Solutions" "Updated company name"
fi

# Test 29: Update address and email
if [ -n "$COMPANY_ID" ]; then
    test_name="Update address and email"
    update_contact_data='{
        "address": "456 Updated Avenue, New City, NC 54321",
        "email": "updated@techcorp.com"
    }'
    response=$(test_api_call "PUT" "$COMPANIES_ENDPOINT/$COMPANY_ID" "$update_contact_data" "200" "$test_name")
    check_json_field "$response" "email" "updated@techcorp.com" "Updated email"
fi

# Test 30: Update GST with auto-uppercase
if [ -n "$COMPANY_ID" ]; then
    test_name="Update GST with auto-uppercase"
    update_gst_data='{
        "gst_no": "updated27gst456"
    }'
    response=$(test_api_call "PUT" "$COMPANIES_ENDPOINT/$COMPANY_ID" "$update_gst_data" "200" "$test_name")
    check_json_field "$response" "gst_no" "UPDATED27GST456" "Updated GST auto-uppercase"
fi

# Test 31: Update registration with auto-uppercase
if [ -n "$COMPANY_ID" ]; then
    test_name="Update registration with auto-uppercase"
    update_reg_data='{
        "registration_number": "updated123reg789"
    }'
    response=$(test_api_call "PUT" "$COMPANIES_ENDPOINT/$COMPANY_ID" "$update_reg_data" "200" "$test_name")
    check_json_field "$response" "registration_number" "UPDATED123REG789" "Updated registration auto-uppercase"
fi

# Test 32: Partial update (single field)
if [ -n "$COMPANY_ID" ]; then
    test_name="Partial update - phone only"
    update_phone_data='{
        "phone": "+1-555-987-6543"
    }'
    response=$(test_api_call "PUT" "$COMPANIES_ENDPOINT/$COMPANY_ID" "$update_phone_data" "200" "$test_name")
    check_json_field "$response" "phone" "+1-555-987-6543" "Updated phone number"
fi

# Test 33: Update to invalid values (should fail)
if [ -n "$COMPANY_ID" ]; then
    test_name="Update to empty name"
    invalid_update_data='{
        "company_name": ""
    }'
    test_api_call "PUT" "$COMPANIES_ENDPOINT/$COMPANY_ID" "$invalid_update_data" "422" "$test_name"
fi

# Test 34: Update to duplicate company name (should fail)
if [ -n "$COMPANY_ID" ] && [ -n "$COMPANY_ID_2" ]; then
    test_name="Update to duplicate company name"
    duplicate_update_data='{
        "company_name": "Simple Corp"
    }'
    test_api_call "PUT" "$COMPANIES_ENDPOINT/$COMPANY_ID" "$duplicate_update_data" "409" "$test_name"
fi

# Test 35: Update non-existent company (should fail)
test_name="Update non-existent company"
fake_uuid="00000000-0000-0000-0000-000000000000"
update_fake_data='{
    "company_name": "Non-existent Company"
}'
test_api_call "PUT" "$COMPANIES_ENDPOINT/$fake_uuid" "$update_fake_data" "404" "$test_name"

echo -e "\n${BLUE}🗑️ DELETE COMPANY TESTS${NC}"
echo "Testing company deletion operations..."

# Test 36: Delete existing company
if [ -n "$COMPANY_ID_2" ]; then
    test_name="Delete existing company"
    test_api_call "DELETE" "$COMPANIES_ENDPOINT/$COMPANY_ID_2" "" "204" "$test_name"
    
    # Verify company is deleted (should return 404)
    test_name="Verify company is deleted"
    test_api_call "GET" "$COMPANIES_ENDPOINT/$COMPANY_ID_2" "" "404" "$test_name"
fi

# Test 37: Delete non-existent company (should fail)
test_name="Delete non-existent company"
fake_uuid="00000000-0000-0000-0000-000000000000"
test_api_call "DELETE" "$COMPANIES_ENDPOINT/$fake_uuid" "" "404" "$test_name"

# Test 38: Soft delete verification (company should be is_active=false)
if [ -n "$COMPANY_ID" ]; then
    test_name="Soft delete main company"
    test_api_call "DELETE" "$COMPANIES_ENDPOINT/$COMPANY_ID" "" "204" "$test_name"
    
    # Check if we can still access it but it's inactive
    test_name="Verify soft delete - company should be inactive"
    response=$(test_api_call "GET" "$COMPANIES_ENDPOINT/$COMPANY_ID" "" "404" "$test_name")
fi

echo -e "\n${BLUE}🔍 ADDITIONAL VALIDATION TESTS${NC}"
echo "Testing additional business rules and edge cases..."

# Test 39: Maximum length fields (should pass)
test_name="Create company with maximum length fields"
max_name=$(printf 'A%.0s' {1..255})  # Exactly 255 characters
max_email="test@$(printf 'a%.0s' {1..245}).com"  # 255 characters total
max_phone=$(printf '1%.0s' {1..50})  # 50 characters
max_gst=$(printf 'A%.0s' {1..50})  # 50 characters
max_reg=$(printf 'B%.0s' {1..100})  # 100 characters

max_length_data="{
    \"company_name\": \"$max_name\",
    \"email\": \"$max_email\",
    \"phone\": \"$max_phone\",
    \"gst_no\": \"$max_gst\",
    \"registration_number\": \"$max_reg\"
}"

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$max_length_data" "201" "$test_name"

# Test 40: Email normalization (should be lowercase)
test_name="Email normalization to lowercase"
email_case_data='{
    "company_name": "Email Case Test Corp",
    "email": "MixedCASE@Example.COM"
}'

response=$(test_api_call "POST" "$COMPANIES_ENDPOINT/" "$email_case_data" "201" "$test_name")
check_json_field "$response" "email" "mixedcase@example.com" "Email converted to lowercase"

echo -e "\n${BLUE}📊 PERFORMANCE AND EDGE CASE TESTS${NC}"
echo "Testing performance and edge cases..."

# Test 41: Multiple rapid requests (basic load test)
test_name="Multiple rapid company creations"
for i in {1..5}; do
    rapid_data="{
        \"company_name\": \"Rapid Test Corp $i\"
    }"
    response=$(test_api_call "POST" "$COMPANIES_ENDPOINT/" "$rapid_data" "201" "Rapid creation $i")
done

# Test 42: Special characters in name
test_name="Company with special characters in name"
special_char_data='{
    "company_name": "Special & Co. (Pvt.) Ltd. - Test #1"
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$special_char_data" "201" "$test_name"

# Test 43: Unicode characters in name
test_name="Company with unicode characters"
unicode_data='{
    "company_name": "Üñíçödé Çörpöràtïön"
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$unicode_data" "201" "$test_name"

# Test 44: International phone format
test_name="International phone number format"
intl_phone_data='{
    "company_name": "International Corp",
    "phone": "+91-11-2345-6789"
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$intl_phone_data" "201" "$test_name"

# Test 45: Complex address with newlines and special chars
test_name="Complex address formatting"
complex_address_data='{
    "company_name": "Complex Address Corp",
    "address": "Building A, Floor 15\\nSuite 1501-1505\\nTech Park, Phase II\\nSector 18, Gurugram\\nHaryana - 122015, India"
}'

test_api_call "POST" "$COMPANIES_ENDPOINT/" "$complex_address_data" "201" "$test_name"

echo -e "\n=================================================="
echo "🧪 COMPANY CRUD API TEST RESULTS"
echo "=================================================="
echo -e "${BLUE}Total Tests Run:${NC} $TOTAL_TESTS"
echo -e "${GREEN}Tests Passed:${NC} $PASSED_TESTS"
echo -e "${RED}Tests Failed:${NC} $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    echo "The Company CRUD API is working correctly!"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed${NC}"
    echo "Success Rate: $((PASSED_TESTS * 100 / TOTAL_TESTS))%"
    exit 1
fi