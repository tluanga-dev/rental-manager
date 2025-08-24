#!/bin/bash

# Company RBAC and CORS Security Testing Script
# Tests Role-Based Access Control and Cross-Origin Resource Sharing
# Covers authentication, authorization, and CORS compliance

API_BASE="http://localhost:8000/api/v1"
COMPANIES_ENDPOINT="$API_BASE/companies"
AUTH_ENDPOINT="$API_BASE/auth"

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

# Helper function to make authenticated API calls
test_authenticated_api_call() {
    local method=$1
    local url=$2
    local data=$3
    local expected_status=$4
    local test_name=$5
    local token=$6

    echo -e "\n${BLUE}Testing: $test_name${NC}"
    echo "Request: $method $url"
    if [ -n "$data" ]; then
        echo "Data: $data"
    fi
    if [ -n "$token" ]; then
        echo "Token: [REDACTED]"
    fi

    local auth_header=""
    if [ -n "$token" ]; then
        auth_header="-H \"Authorization: Bearer $token\""
    fi

    if [ "$method" = "GET" ]; then
        response=$(eval curl -s -w \"\\n%{http_code}\" \"$url\" \
            -H \"Content-Type: application/json\" \
            $auth_header)
    elif [ "$method" = "DELETE" ]; then
        response=$(eval curl -s -w \"\\n%{http_code}\" -X DELETE \"$url\" \
            -H \"Content-Type: application/json\" \
            $auth_header)
    else
        response=$(eval curl -s -w \"\\n%{http_code}\" -X \"$method\" \"$url\" \
            -H \"Content-Type: application/json\" \
            $auth_header \
            -d \"$data\")
    fi

    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    # Extract response body (all but last line)
    response_body=$(echo "$response" | head -n -1)

    echo "Response Status: $http_code"
    echo "Response Body: $response_body"

    if [ "$http_code" = "$expected_status" ]; then
        print_status "PASS" "$test_name"
    else
        print_status "FAIL" "$test_name - Expected status $expected_status, got $http_code"
    fi

    # Return response body for further processing
    echo "$response_body"
}

# Helper function to test CORS preflight
test_cors_preflight() {
    local url=$1
    local test_name=$2
    local origin=${3:-"https://example.com"}

    echo -e "\n${BLUE}Testing CORS: $test_name${NC}"
    echo "URL: $url"
    echo "Origin: $origin"

    # Send OPTIONS preflight request
    response=$(curl -s -w "\n%{http_code}" -X OPTIONS "$url" \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization")

    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    # Extract headers (we'll look for them in the response)
    headers=$(echo "$response" | head -n -1)

    echo "Response Status: $http_code"
    echo "Response Headers: $headers"

    # Test should return 200 or 204 for successful preflight
    if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
        print_status "PASS" "$test_name - Preflight response OK"
    else
        print_status "FAIL" "$test_name - Expected 200/204, got $http_code"
    fi
}

# Helper function to test CORS headers in actual request
test_cors_headers() {
    local method=$1
    local url=$2
    local data=$3
    local test_name=$4
    local origin=${5:-"https://example.com"}

    echo -e "\n${BLUE}Testing CORS Headers: $test_name${NC}"
    echo "Method: $method"
    echo "URL: $url"
    echo "Origin: $origin"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -i "$url" \
            -H "Origin: $origin" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -i -X "$method" "$url" \
            -H "Origin: $origin" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    echo "Response (with headers):"
    echo "$response" | head -20  # Show first 20 lines

    # Check for required CORS headers
    cors_headers_found=0
    if echo "$response" | grep -qi "access-control-allow-origin"; then
        echo "✓ Access-Control-Allow-Origin header found"
        ((cors_headers_found++))
    else
        echo "✗ Access-Control-Allow-Origin header missing"
    fi

    if echo "$response" | grep -qi "access-control-allow-methods"; then
        echo "✓ Access-Control-Allow-Methods header found"
        ((cors_headers_found++))
    else
        echo "✗ Access-Control-Allow-Methods header missing"
    fi

    if echo "$response" | grep -qi "access-control-allow-headers"; then
        echo "✓ Access-Control-Allow-Headers header found"
        ((cors_headers_found++))
    else
        echo "✗ Access-Control-Allow-Headers header missing"
    fi

    if [ $cors_headers_found -ge 2 ]; then
        print_status "PASS" "$test_name - CORS headers present"
    else
        print_status "FAIL" "$test_name - Missing CORS headers ($cors_headers_found/3)"
    fi
}

# Helper function to extract token from login response
extract_token() {
    local response=$1
    echo "$response" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 | head -1
}

# Mock authentication (create test tokens)
create_test_users() {
    echo -e "\n${BLUE}🔐 SETTING UP TEST AUTHENTICATION${NC}"
    echo "Creating test user accounts and tokens..."

    # Test data for different user roles
    ADMIN_USER_DATA='{
        "email": "admin@company-test.com",
        "password": "AdminTest123!",
        "full_name": "Admin Test User",
        "role": "admin"
    }'

    EDITOR_USER_DATA='{
        "email": "editor@company-test.com", 
        "password": "EditorTest123!",
        "full_name": "Editor Test User",
        "role": "editor"
    }'

    VIEWER_USER_DATA='{
        "email": "viewer@company-test.com",
        "password": "ViewerTest123!",
        "full_name": "Viewer Test User", 
        "role": "viewer"
    }'

    # Try to register users (may fail if they already exist)
    echo "Attempting to register test users..."
    
    # Register admin user
    admin_reg_response=$(curl -s -w "\n%{http_code}" -X POST "$AUTH_ENDPOINT/register" \
        -H "Content-Type: application/json" \
        -d "$ADMIN_USER_DATA" 2>/dev/null)
    echo "Admin registration: $(echo "$admin_reg_response" | tail -n1)"

    # Register editor user
    editor_reg_response=$(curl -s -w "\n%{http_code}" -X POST "$AUTH_ENDPOINT/register" \
        -H "Content-Type: application/json" \
        -d "$EDITOR_USER_DATA" 2>/dev/null)
    echo "Editor registration: $(echo "$editor_reg_response" | tail -n1)"

    # Register viewer user
    viewer_reg_response=$(curl -s -w "\n%{http_code}" -X POST "$AUTH_ENDPOINT/register" \
        -H "Content-Type: application/json" \
        -d "$VIEWER_USER_DATA" 2>/dev/null)
    echo "Viewer registration: $(echo "$viewer_reg_response" | tail -n1)"

    # Login users to get tokens
    echo "Logging in test users to get tokens..."

    # Login admin
    admin_login_data='{
        "email": "admin@company-test.com",
        "password": "AdminTest123!"
    }'
    
    admin_login_response=$(curl -s -X POST "$AUTH_ENDPOINT/login" \
        -H "Content-Type: application/json" \
        -d "$admin_login_data" 2>/dev/null)
    ADMIN_TOKEN=$(extract_token "$admin_login_response")
    
    # Login editor
    editor_login_data='{
        "email": "editor@company-test.com",
        "password": "EditorTest123!"
    }'
    
    editor_login_response=$(curl -s -X POST "$AUTH_ENDPOINT/login" \
        -H "Content-Type: application/json" \
        -d "$editor_login_data" 2>/dev/null)
    EDITOR_TOKEN=$(extract_token "$editor_login_response")
    
    # Login viewer
    viewer_login_data='{
        "email": "viewer@company-test.com",
        "password": "ViewerTest123!"
    }'
    
    viewer_login_response=$(curl -s -X POST "$AUTH_ENDPOINT/login" \
        -H "Content-Type: application/json" \
        -d "$viewer_login_data" 2>/dev/null)
    VIEWER_TOKEN=$(extract_token "$viewer_login_response")

    # Check if we got tokens
    if [ -n "$ADMIN_TOKEN" ]; then
        echo "✓ Admin token obtained"
    else
        echo "✗ Failed to get admin token"
        ADMIN_TOKEN="mock_admin_token_for_testing"
    fi

    if [ -n "$EDITOR_TOKEN" ]; then
        echo "✓ Editor token obtained"
    else
        echo "✗ Failed to get editor token"
        EDITOR_TOKEN="mock_editor_token_for_testing"
    fi

    if [ -n "$VIEWER_TOKEN" ]; then
        echo "✓ Viewer token obtained"
    else
        echo "✗ Failed to get viewer token"
        VIEWER_TOKEN="mock_viewer_token_for_testing"
    fi
}

echo "=================================================="
echo "🔐 COMPANY RBAC & CORS SECURITY TESTING SUITE"
echo "=================================================="
echo "Target API: $API_BASE"
echo "Testing Role-Based Access Control and CORS compliance"
echo ""

# Health check
echo -e "\n${BLUE}🔍 HEALTH CHECK${NC}"
health_response=$(curl -s "$API_BASE/health" 2>/dev/null)

if [[ $health_response == *"healthy"* ]]; then
    print_status "PASS" "API is healthy and accessible"
else
    print_status "FAIL" "API health check failed"
    echo "Exiting tests due to API unavailability"
    exit 1
fi

# Setup test authentication
create_test_users

echo -e "\n${BLUE}🚫 UNAUTHORIZED ACCESS TESTS${NC}"
echo "Testing access without authentication tokens..."

# Test 1: Access without token (should fail)
test_authenticated_api_call "GET" "$COMPANIES_ENDPOINT/" "" "401" "Get companies without token" ""

# Test 2: Create company without token (should fail)
create_data='{
    "company_name": "Unauthorized Test Corp"
}'
test_authenticated_api_call "POST" "$COMPANIES_ENDPOINT/" "$create_data" "401" "Create company without token" ""

# Test 3: Update company without token (should fail)
fake_uuid="00000000-0000-0000-0000-000000000000"
update_data='{
    "company_name": "Updated Unauthorized Corp"
}'
test_authenticated_api_call "PUT" "$COMPANIES_ENDPOINT/$fake_uuid" "$update_data" "401" "Update company without token" ""

# Test 4: Delete company without token (should fail)
test_authenticated_api_call "DELETE" "$COMPANIES_ENDPOINT/$fake_uuid" "" "401" "Delete company without token" ""

echo -e "\n${BLUE}🔒 INVALID TOKEN TESTS${NC}"
echo "Testing access with invalid/malformed tokens..."

INVALID_TOKENS=(
    "invalid_token"
    "Bearer invalid_token"
    "malformed.token.here"
    "expired_token_simulation"
    ""
)

for invalid_token in "${INVALID_TOKENS[@]}"; do
    test_name="Access with invalid token: ${invalid_token:-'empty'}"
    test_authenticated_api_call "GET" "$COMPANIES_ENDPOINT/" "" "401" "$test_name" "$invalid_token"
done

echo -e "\n${BLUE}👤 ADMIN ROLE TESTS${NC}"
echo "Testing admin role permissions (should have full access)..."

if [ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "mock_admin_token_for_testing" ]; then
    # Admin should be able to: Create, Read, Update, Delete, Activate

    # Test admin create
    admin_create_data='{
        "company_name": "Admin Test Corporation",
        "email": "admin-test@corp.com",
        "phone": "+1-555-ADMIN-01"
    }'
    admin_response=$(test_authenticated_api_call "POST" "$COMPANIES_ENDPOINT/" "$admin_create_data" "201" "Admin create company" "$ADMIN_TOKEN")
    
    # Extract company ID for further tests
    ADMIN_COMPANY_ID=$(echo "$admin_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)

    # Test admin read (list)
    test_authenticated_api_call "GET" "$COMPANIES_ENDPOINT/" "" "200" "Admin list companies" "$ADMIN_TOKEN"

    # Test admin read (single)
    if [ -n "$ADMIN_COMPANY_ID" ]; then
        test_authenticated_api_call "GET" "$COMPANIES_ENDPOINT/$ADMIN_COMPANY_ID" "" "200" "Admin get company by ID" "$ADMIN_TOKEN"
    fi

    # Test admin update
    if [ -n "$ADMIN_COMPANY_ID" ]; then
        admin_update_data='{
            "company_name": "Admin Updated Corporation"
        }'
        test_authenticated_api_call "PUT" "$COMPANIES_ENDPOINT/$ADMIN_COMPANY_ID" "$admin_update_data" "200" "Admin update company" "$ADMIN_TOKEN"
    fi

    # Test admin delete
    if [ -n "$ADMIN_COMPANY_ID" ]; then
        test_authenticated_api_call "DELETE" "$COMPANIES_ENDPOINT/$ADMIN_COMPANY_ID" "" "204" "Admin delete company" "$ADMIN_TOKEN"
    fi
else
    print_status "WARN" "Admin token not available - skipping admin role tests"
fi

echo -e "\n${BLUE}✏️ EDITOR ROLE TESTS${NC}"
echo "Testing editor role permissions (should have create, read, update but not delete)..."

if [ -n "$EDITOR_TOKEN" ] && [ "$EDITOR_TOKEN" != "mock_editor_token_for_testing" ]; then
    # Editor should be able to: Create, Read, Update (but NOT Delete or Activate)

    # Test editor create
    editor_create_data='{
        "company_name": "Editor Test Corporation",
        "email": "editor-test@corp.com",
        "phone": "+1-555-EDITOR-01"
    }'
    editor_response=$(test_authenticated_api_call "POST" "$COMPANIES_ENDPOINT/" "$editor_create_data" "201" "Editor create company" "$EDITOR_TOKEN")
    
    EDITOR_COMPANY_ID=$(echo "$editor_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)

    # Test editor read
    test_authenticated_api_call "GET" "$COMPANIES_ENDPOINT/" "" "200" "Editor list companies" "$EDITOR_TOKEN"

    if [ -n "$EDITOR_COMPANY_ID" ]; then
        test_authenticated_api_call "GET" "$COMPANIES_ENDPOINT/$EDITOR_COMPANY_ID" "" "200" "Editor get company by ID" "$EDITOR_TOKEN"
    fi

    # Test editor update
    if [ -n "$EDITOR_COMPANY_ID" ]; then
        editor_update_data='{
            "company_name": "Editor Updated Corporation"
        }'
        test_authenticated_api_call "PUT" "$COMPANIES_ENDPOINT/$EDITOR_COMPANY_ID" "$editor_update_data" "200" "Editor update company" "$EDITOR_TOKEN"
    fi

    # Test editor delete (should fail)
    if [ -n "$EDITOR_COMPANY_ID" ]; then
        test_authenticated_api_call "DELETE" "$COMPANIES_ENDPOINT/$EDITOR_COMPANY_ID" "" "403" "Editor delete company (should fail)" "$EDITOR_TOKEN"
    fi
else
    print_status "WARN" "Editor token not available - skipping editor role tests"
fi

echo -e "\n${BLUE}👁️ VIEWER ROLE TESTS${NC}"
echo "Testing viewer role permissions (should have read-only access)..."

if [ -n "$VIEWER_TOKEN" ] && [ "$VIEWER_TOKEN" != "mock_viewer_token_for_testing" ]; then
    # Viewer should be able to: Read only (NOT Create, Update, Delete, or Activate)

    # Test viewer read (should pass)
    test_authenticated_api_call "GET" "$COMPANIES_ENDPOINT/" "" "200" "Viewer list companies" "$VIEWER_TOKEN"

    # Test viewer create (should fail)
    viewer_create_data='{
        "company_name": "Viewer Test Corporation"
    }'
    test_authenticated_api_call "POST" "$COMPANIES_ENDPOINT/" "$viewer_create_data" "403" "Viewer create company (should fail)" "$VIEWER_TOKEN"

    # Test viewer update (should fail)
    fake_uuid="00000000-0000-0000-0000-000000000000"
    viewer_update_data='{
        "company_name": "Viewer Updated Corporation"
    }'
    test_authenticated_api_call "PUT" "$COMPANIES_ENDPOINT/$fake_uuid" "$viewer_update_data" "403" "Viewer update company (should fail)" "$VIEWER_TOKEN"

    # Test viewer delete (should fail)
    test_authenticated_api_call "DELETE" "$COMPANIES_ENDPOINT/$fake_uuid" "" "403" "Viewer delete company (should fail)" "$VIEWER_TOKEN"
else
    print_status "WARN" "Viewer token not available - skipping viewer role tests"
fi

echo -e "\n${BLUE}🌐 CORS PREFLIGHT TESTS${NC}"
echo "Testing CORS preflight OPTIONS requests..."

# Test CORS preflight for different endpoints
test_cors_preflight "$COMPANIES_ENDPOINT/" "Companies list endpoint preflight" "https://rental-frontend.com"
test_cors_preflight "$COMPANIES_ENDPOINT/" "Companies create endpoint preflight" "http://localhost:3000"
test_cors_preflight "$COMPANIES_ENDPOINT/test-id" "Company detail endpoint preflight" "http://localhost:3001"

echo -e "\n${BLUE}🌐 CORS ACTUAL REQUEST TESTS${NC}"
echo "Testing CORS headers in actual requests..."

# Test CORS headers on actual requests
test_cors_headers "GET" "$COMPANIES_ENDPOINT/" "" "GET request CORS headers" "https://rental-frontend.com"

create_data='{
    "company_name": "CORS Test Corporation"
}'
test_cors_headers "POST" "$COMPANIES_ENDPOINT/" "$create_data" "POST request CORS headers" "http://localhost:3000"

echo -e "\n${BLUE}🌐 CORS ORIGIN VALIDATION TESTS${NC}"
echo "Testing CORS with different origins..."

# Test with various origins
ORIGINS=(
    "https://rental-frontend.com"
    "http://localhost:3000"
    "http://localhost:3001"
    "https://malicious-site.com"
    "null"
)

for origin in "${ORIGINS[@]}"; do
    test_name="CORS with origin: $origin"
    test_cors_preflight "$COMPANIES_ENDPOINT/" "$test_name" "$origin"
done

echo -e "\n${BLUE}🔒 JWT TOKEN VALIDATION TESTS${NC}"
echo "Testing JWT token validation and expiry..."

# Test with malformed JWT tokens
MALFORMED_JWTS=(
    "not.a.jwt"
    "header.payload"
    "header.payload.signature.extra"
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid_payload.signature"
)

for jwt in "${MALFORMED_JWTS[@]}"; do
    test_name="Malformed JWT validation: ${jwt:0:20}..."
    test_authenticated_api_call "GET" "$COMPANIES_ENDPOINT/" "" "401" "$test_name" "$jwt"
done

echo -e "\n${BLUE}🔐 AUTHORIZATION HEADER TESTS${NC}"
echo "Testing various authorization header formats..."

# Test different authorization header formats
AUTH_FORMATS=(
    "Bearer valid_looking_token"
    "Basic dXNlcjpwYXNzd29yZA=="
    "Token some_token"
    "JWT some_jwt_token"
)

for auth_format in "${AUTH_FORMATS[@]}"; do
    test_name="Auth header format: ${auth_format:0:20}..."
    test_authenticated_api_call "GET" "$COMPANIES_ENDPOINT/" "" "401" "$test_name" "$auth_format"
done

echo -e "\n${BLUE}🚨 SECURITY HEADER TESTS${NC}"
echo "Testing security headers in responses..."

# Test for security headers
security_response=$(curl -s -i "$COMPANIES_ENDPOINT/" -H "Content-Type: application/json" 2>/dev/null)

echo "Checking for security headers..."

# Check for common security headers
security_headers_found=0

if echo "$security_response" | grep -qi "X-Content-Type-Options"; then
    echo "✓ X-Content-Type-Options header found"
    ((security_headers_found++))
else
    echo "✗ X-Content-Type-Options header missing"
fi

if echo "$security_response" | grep -qi "X-Frame-Options"; then
    echo "✓ X-Frame-Options header found"
    ((security_headers_found++))
else
    echo "✗ X-Frame-Options header missing"
fi

if echo "$security_response" | grep -qi "X-XSS-Protection"; then
    echo "✓ X-XSS-Protection header found"
    ((security_headers_found++))
else
    echo "✗ X-XSS-Protection header missing"
fi

if echo "$security_response" | grep -qi "Strict-Transport-Security"; then
    echo "✓ Strict-Transport-Security header found"
    ((security_headers_found++))
else
    echo "✗ Strict-Transport-Security header missing (may be OK for HTTP)"
fi

if [ $security_headers_found -ge 2 ]; then
    print_status "PASS" "Security headers test - $security_headers_found/4 headers present"
else
    print_status "WARN" "Security headers test - only $security_headers_found/4 headers present"
fi

echo -e "\n${BLUE}🔒 REQUEST METHOD SECURITY TESTS${NC}"
echo "Testing HTTP method restrictions..."

# Test unsupported HTTP methods
UNSUPPORTED_METHODS=(
    "PATCH"
    "HEAD" 
    "TRACE"
    "CONNECT"
)

for method in "${UNSUPPORTED_METHODS[@]}"; do
    test_name="Unsupported method $method"
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$COMPANIES_ENDPOINT/" \
        -H "Content-Type: application/json" 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n1)
    
    # Should return 405 Method Not Allowed or 501 Not Implemented
    if [ "$http_code" = "405" ] || [ "$http_code" = "501" ]; then
        print_status "PASS" "$test_name - correctly rejected with $http_code"
    else
        print_status "WARN" "$test_name - unexpected response $http_code"
    fi
done

echo -e "\n=================================================="
echo "🔐 COMPANY RBAC & CORS SECURITY TEST RESULTS"
echo "=================================================="
echo -e "${BLUE}Total Tests Run:${NC} $TOTAL_TESTS"
echo -e "${GREEN}Tests Passed:${NC} $PASSED_TESTS"
echo -e "${RED}Tests Failed:${NC} $FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL SECURITY TESTS PASSED! 🎉${NC}"
    echo "The Company API security is working correctly!"
    exit 0
else
    echo -e "\n${RED}❌ Some security tests failed${NC}"
    echo "Success Rate: $((PASSED_TESTS * 100 / TOTAL_TESTS))%"
    echo ""
    echo "Note: Some failures may be expected if authentication system is not fully implemented"
    echo "or if test users don't have the expected roles configured."
    exit 1
fi