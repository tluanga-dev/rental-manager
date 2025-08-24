#!/bin/bash

# 🔒 Unit of Measurement Security Testing Suite
# RBAC (Role-Based Access Control), CORS, Authentication, and Security validation tests

set -e

echo "🔒 Unit of Measurement Security Testing Suite"
echo "=" $(printf "%*s" 60 | tr ' ' '=')

# Configuration
API_BASE="http://localhost:8001/api/v1"
FRONTEND_URL="http://localhost:3001"
TEST_LOG="uom_security_test_results.log"
SECURITY_REPORT="uom_security_report.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SECURITY_ISSUES=0

# Test results
declare -A TEST_RESULTS
declare -A SECURITY_FINDINGS

log_test() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    local security_level="$4"
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
        
        if [ "$security_level" == "HIGH" ] || [ "$security_level" == "CRITICAL" ]; then
            SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
            SECURITY_FINDINGS["$test_name"]="$security_level: $details"
        fi
    else
        echo -e "${YELLOW}⚠️  ${test_name}${NC}" | tee -a "$TEST_LOG"
        TEST_RESULTS["$test_name"]="SKIP"
    fi
    
    echo "[$timestamp] SECURITY: $test_name: $status - $details" >> "$TEST_LOG"
}

# Authentication helper
authenticate_user() {
    local username="$1"
    local password="$2"
    local role="$3"
    
    local auth_response=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"$username\", \"password\": \"$password\"}" \
        -o "auth_${role}.tmp" 2>/dev/null)
    
    if [ "$auth_response" == "200" ]; then
        local token=$(cat "auth_${role}.tmp" | jq -r '.access_token')
        echo "$token"
    else
        echo ""
    fi
}

# Phase 1: Authentication Security Testing
test_authentication_security() {
    echo -e "\n${BLUE}🔐 Phase 1: Authentication Security Testing${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    # Test 1: Invalid credentials
    echo "🔍 Testing invalid credentials..."
    
    INVALID_AUTH_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username": "invalid", "password": "wrong"}' \
        -o invalid_auth.tmp 2>/dev/null)
    
    if [ "$INVALID_AUTH_RESPONSE" == "401" ] || [ "$INVALID_AUTH_RESPONSE" == "403" ]; then
        log_test "Invalid credentials rejection" "PASS" "Properly rejected invalid credentials"
    else
        log_test "Invalid credentials rejection" "FAIL" "HTTP $INVALID_AUTH_RESPONSE - Should reject invalid credentials" "HIGH"
    fi
    
    # Test 2: SQL injection attempt in login
    echo "🔍 Testing SQL injection protection..."
    
    SQL_INJECTION_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username": "admin'\''; DROP TABLE users; --", "password": "password"}' \
        -o sql_injection.tmp 2>/dev/null)
    
    if [ "$SQL_INJECTION_RESPONSE" == "401" ] || [ "$SQL_INJECTION_RESPONSE" == "422" ]; then
        log_test "SQL injection protection" "PASS" "Properly handled SQL injection attempt"
    else
        log_test "SQL injection protection" "FAIL" "HTTP $SQL_INJECTION_RESPONSE - Possible SQL injection vulnerability" "CRITICAL"
    fi
    
    # Test 3: XSS attempt in login
    echo "🔍 Testing XSS protection..."
    
    XSS_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username": "<script>alert(\"xss\")</script>", "password": "password"}' \
        -o xss_test.tmp 2>/dev/null)
    
    if [ "$XSS_RESPONSE" == "401" ] || [ "$XSS_RESPONSE" == "422" ]; then
        log_test "XSS protection" "PASS" "Properly handled XSS attempt"
    else
        log_test "XSS protection" "FAIL" "HTTP $XSS_RESPONSE - Possible XSS vulnerability" "HIGH"
    fi
    
    # Test 4: Password brute force protection
    echo "🔍 Testing brute force protection..."
    
    # Attempt multiple failed logins
    for i in {1..10}; do
        curl -s -X POST "$API_BASE/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"username": "admin", "password": "wrong'$i'"}' \
            >/dev/null 2>&1
    done
    
    # Try one more time and check if blocked/delayed
    BRUTE_FORCE_START=$(date +%s%N | cut -b1-13)
    BRUTE_FORCE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username": "admin", "password": "wrongfinal"}' \
        -o brute_force.tmp 2>/dev/null)
    BRUTE_FORCE_END=$(date +%s%N | cut -b1-13)
    BRUTE_FORCE_TIME=$((BRUTE_FORCE_END - BRUTE_FORCE_START))
    
    # Check if there's a delay (rate limiting) or blocking
    if [ "$BRUTE_FORCE_TIME" -gt 1000 ] || [ "$BRUTE_FORCE_RESPONSE" == "429" ]; then
        log_test "Brute force protection" "PASS" "Rate limiting or blocking detected"
    else
        log_test "Brute force protection" "FAIL" "No brute force protection detected" "HIGH"
    fi
    
    rm -f *.tmp
}

# Phase 2: RBAC Testing
test_rbac() {
    echo -e "\n${BLUE}👥 Phase 2: Role-Based Access Control Testing${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    # Get tokens for different roles
    echo "🔑 Authenticating test users..."
    
    ADMIN_TOKEN=$(authenticate_user "admin" "admin123" "admin")
    
    if [ -z "$ADMIN_TOKEN" ]; then
        log_test "Admin authentication" "FAIL" "Could not authenticate admin user" "HIGH"
        echo "❌ Cannot proceed with RBAC tests without admin authentication"
        return 1
    else
        log_test "Admin authentication" "PASS" "Admin user authenticated successfully"
    fi
    
    # Test 1: Admin access to UoM operations
    echo "🔍 Testing admin access..."
    
    ADMIN_CREATE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d '{"name": "RBAC Test Admin", "code": "RTA", "description": "Admin access test"}' \
        -o admin_create.tmp 2>/dev/null)
    
    if [ "$ADMIN_CREATE_RESPONSE" == "201" ]; then
        ADMIN_UOM_ID=$(cat admin_create.tmp | jq -r '.id')
        log_test "Admin create access" "PASS" "Admin can create UoM"
    else
        log_test "Admin create access" "FAIL" "HTTP $ADMIN_CREATE_RESPONSE - Admin should be able to create UoM" "MEDIUM"
    fi
    
    # Test 2: No token access
    echo "🔍 Testing unauthorized access..."
    
    NO_TOKEN_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/" \
        -o no_token.tmp 2>/dev/null)
    
    if [ "$NO_TOKEN_RESPONSE" == "401" ]; then
        log_test "No token rejection" "PASS" "Properly rejected request without token"
    else
        log_test "No token rejection" "FAIL" "HTTP $NO_TOKEN_RESPONSE - Should reject requests without auth token" "HIGH"
    fi
    
    # Test 3: Invalid token access
    echo "🔍 Testing invalid token access..."
    
    INVALID_TOKEN_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/" \
        -H "Authorization: Bearer invalid.jwt.token" \
        -o invalid_token.tmp 2>/dev/null)
    
    if [ "$INVALID_TOKEN_RESPONSE" == "401" ] || [ "$INVALID_TOKEN_RESPONSE" == "403" ]; then
        log_test "Invalid token rejection" "PASS" "Properly rejected invalid token"
    else
        log_test "Invalid token rejection" "FAIL" "HTTP $INVALID_TOKEN_RESPONSE - Should reject invalid tokens" "HIGH"
    fi
    
    # Test 4: Expired token (simulate)
    echo "🔍 Testing expired token handling..."
    
    # Use a JWT with expired timestamp (this is a mock test)
    EXPIRED_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTU3NzgzNjgwMCwiZXhwIjoxNTc3ODM2ODAwfQ.invalid"
    
    EXPIRED_TOKEN_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/" \
        -H "Authorization: Bearer $EXPIRED_TOKEN" \
        -o expired_token.tmp 2>/dev/null)
    
    if [ "$EXPIRED_TOKEN_RESPONSE" == "401" ] || [ "$EXPIRED_TOKEN_RESPONSE" == "403" ]; then
        log_test "Expired token rejection" "PASS" "Properly rejected expired token"
    else
        log_test "Expired token rejection" "FAIL" "HTTP $EXPIRED_TOKEN_RESPONSE - Should reject expired tokens" "HIGH"
    fi
    
    # Test 5: Token manipulation detection
    echo "🔍 Testing token manipulation..."
    
    # Modify the admin token slightly
    MANIPULATED_TOKEN="${ADMIN_TOKEN:0:-5}AAAAA"
    
    MANIPULATED_TOKEN_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/" \
        -H "Authorization: Bearer $MANIPULATED_TOKEN" \
        -o manipulated_token.tmp 2>/dev/null)
    
    if [ "$MANIPULATED_TOKEN_RESPONSE" == "401" ] || [ "$MANIPULATED_TOKEN_RESPONSE" == "403" ]; then
        log_test "Token manipulation detection" "PASS" "Detected manipulated token"
    else
        log_test "Token manipulation detection" "FAIL" "HTTP $MANIPULATED_TOKEN_RESPONSE - Should detect token manipulation" "CRITICAL"
    fi
    
    rm -f *.tmp
}

# Phase 3: CORS Testing
test_cors() {
    echo -e "\n${BLUE}🌐 Phase 3: CORS (Cross-Origin Resource Sharing) Testing${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    # Get admin token
    ADMIN_TOKEN=$(authenticate_user "admin" "admin123" "admin")
    
    # Test 1: Preflight OPTIONS request
    echo "🔍 Testing CORS preflight request..."
    
    PREFLIGHT_RESPONSE=$(curl -s -w "%{http_code}" \
        -X OPTIONS "$API_BASE/unit-of-measurement/" \
        -H "Origin: $FRONTEND_URL" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization" \
        -o preflight.tmp 2>/dev/null)
    
    if [ "$PREFLIGHT_RESPONSE" == "200" ] || [ "$PREFLIGHT_RESPONSE" == "204" ]; then
        log_test "CORS preflight request" "PASS" "Preflight request accepted"
        
        # Check for required CORS headers
        CORS_HEADERS=$(curl -s -I -X OPTIONS "$API_BASE/unit-of-measurement/" \
            -H "Origin: $FRONTEND_URL" \
            -H "Access-Control-Request-Method: POST" \
            -H "Access-Control-Request-Headers: Content-Type,Authorization" 2>/dev/null)
        
        if echo "$CORS_HEADERS" | grep -q "Access-Control-Allow-Origin"; then
            log_test "CORS Allow-Origin header" "PASS" "Access-Control-Allow-Origin header present"
        else
            log_test "CORS Allow-Origin header" "FAIL" "Missing Access-Control-Allow-Origin header" "MEDIUM"
        fi
        
        if echo "$CORS_HEADERS" | grep -q "Access-Control-Allow-Methods"; then
            log_test "CORS Allow-Methods header" "PASS" "Access-Control-Allow-Methods header present"
        else
            log_test "CORS Allow-Methods header" "FAIL" "Missing Access-Control-Allow-Methods header" "MEDIUM"
        fi
        
        if echo "$CORS_HEADERS" | grep -q "Access-Control-Allow-Headers"; then
            log_test "CORS Allow-Headers header" "PASS" "Access-Control-Allow-Headers header present"
        else
            log_test "CORS Allow-Headers header" "FAIL" "Missing Access-Control-Allow-Headers header" "MEDIUM"
        fi
    else
        log_test "CORS preflight request" "FAIL" "HTTP $PREFLIGHT_RESPONSE - Preflight request failed" "HIGH"
    fi
    
    # Test 2: Cross-origin GET request
    echo "🔍 Testing cross-origin GET request..."
    
    CORS_GET_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/stats/" \
        -H "Origin: $FRONTEND_URL" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -o cors_get.tmp 2>/dev/null)
    
    if [ "$CORS_GET_RESPONSE" == "200" ]; then
        log_test "CORS GET request" "PASS" "Cross-origin GET request successful"
    else
        log_test "CORS GET request" "FAIL" "HTTP $CORS_GET_RESPONSE - Cross-origin GET failed" "MEDIUM"
    fi
    
    # Test 3: Cross-origin POST request
    echo "🔍 Testing cross-origin POST request..."
    
    CORS_POST_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Origin: $FRONTEND_URL" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d '{"name": "CORS Test Unit", "code": "CTU", "description": "Cross-origin test"}' \
        -o cors_post.tmp 2>/dev/null)
    
    if [ "$CORS_POST_RESPONSE" == "201" ]; then
        log_test "CORS POST request" "PASS" "Cross-origin POST request successful"
        CORS_UOM_ID=$(cat cors_post.tmp | jq -r '.id')
    else
        log_test "CORS POST request" "FAIL" "HTTP $CORS_POST_RESPONSE - Cross-origin POST failed" "MEDIUM"
    fi
    
    # Test 4: Unauthorized origin request
    echo "🔍 Testing unauthorized origin..."
    
    UNAUTHORIZED_ORIGIN_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/stats/" \
        -H "Origin: http://malicious-site.com" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -o unauthorized_origin.tmp 2>/dev/null)
    
    # Check response and headers
    UNAUTHORIZED_CORS_HEADERS=$(curl -s -I -X GET "$API_BASE/unit-of-measurement/stats/" \
        -H "Origin: http://malicious-site.com" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
    
    # Should either reject or not include CORS headers for unauthorized origin
    if ! echo "$UNAUTHORIZED_CORS_HEADERS" | grep -q "Access-Control-Allow-Origin: http://malicious-site.com"; then
        log_test "Unauthorized origin protection" "PASS" "Properly rejected unauthorized origin"
    else
        log_test "Unauthorized origin protection" "FAIL" "Accepts requests from unauthorized origins" "HIGH"
    fi
    
    rm -f *.tmp
}

# Phase 4: Input Validation Security
test_input_validation() {
    echo -e "\n${BLUE}🛡️  Phase 4: Input Validation Security Testing${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    ADMIN_TOKEN=$(authenticate_user "admin" "admin123" "admin")
    
    # Test 1: XSS in UoM name
    echo "🔍 Testing XSS injection in name field..."
    
    XSS_NAME_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d '{"name": "<script>alert(\"XSS\")</script>", "code": "XSS"}' \
        -o xss_name.tmp 2>/dev/null)
    
    if [ "$XSS_NAME_RESPONSE" == "422" ] || [ "$XSS_NAME_RESPONSE" == "400" ]; then
        log_test "XSS injection protection in name" "PASS" "Properly rejected XSS in name field"
    else
        # Check if script tags were sanitized
        if [ "$XSS_NAME_RESPONSE" == "201" ]; then
            XSS_NAME_VALUE=$(cat xss_name.tmp | jq -r '.name')
            if [[ "$XSS_NAME_VALUE" != *"<script>"* ]]; then
                log_test "XSS injection protection in name" "PASS" "XSS tags sanitized in name field"
            else
                log_test "XSS injection protection in name" "FAIL" "XSS not properly sanitized" "HIGH"
            fi
        else
            log_test "XSS injection protection in name" "FAIL" "HTTP $XSS_NAME_RESPONSE - Unexpected response to XSS" "MEDIUM"
        fi
    fi
    
    # Test 2: SQL injection in search
    echo "🔍 Testing SQL injection in search..."
    
    SQL_SEARCH_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/search/?q=test'%20OR%20'1'='1" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -o sql_search.tmp 2>/dev/null)
    
    if [ "$SQL_SEARCH_RESPONSE" == "200" ]; then
        # Check if results look suspicious (too many results might indicate successful injection)
        SEARCH_COUNT=$(cat sql_search.tmp | jq '. | length' 2>/dev/null || echo "0")
        if [ "$SEARCH_COUNT" -lt 1000 ]; then  # Reasonable number of results
            log_test "SQL injection protection in search" "PASS" "Search properly handled SQL injection attempt"
        else
            log_test "SQL injection protection in search" "FAIL" "Possible SQL injection vulnerability in search" "CRITICAL"
        fi
    else
        log_test "SQL injection protection in search" "PASS" "Search rejected potentially malicious query"
    fi
    
    # Test 3: Path traversal attempt
    echo "🔍 Testing path traversal protection..."
    
    PATH_TRAVERSAL_RESPONSE=$(curl -s -w "%{http_code}" \
        -X GET "$API_BASE/unit-of-measurement/../../../etc/passwd" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -o path_traversal.tmp 2>/dev/null)
    
    if [ "$PATH_TRAVERSAL_RESPONSE" == "404" ] || [ "$PATH_TRAVERSAL_RESPONSE" == "400" ]; then
        log_test "Path traversal protection" "PASS" "Properly rejected path traversal attempt"
    else
        # Check if sensitive file content was returned
        if grep -q "root:" path_traversal.tmp 2>/dev/null; then
            log_test "Path traversal protection" "FAIL" "Path traversal vulnerability detected" "CRITICAL"
        else
            log_test "Path traversal protection" "PASS" "Path traversal blocked"
        fi
    fi
    
    # Test 4: Large payload attack
    echo "🔍 Testing large payload protection..."
    
    # Create a large description (attempt DoS)
    LARGE_PAYLOAD=$(printf 'A%.0s' {1..10000})
    
    LARGE_PAYLOAD_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d "{\"name\": \"Large Test\", \"code\": \"LT\", \"description\": \"$LARGE_PAYLOAD\"}" \
        -o large_payload.tmp 2>/dev/null)
    
    if [ "$LARGE_PAYLOAD_RESPONSE" == "422" ] || [ "$LARGE_PAYLOAD_RESPONSE" == "413" ]; then
        log_test "Large payload protection" "PASS" "Properly rejected oversized payload"
    else
        log_test "Large payload protection" "FAIL" "HTTP $LARGE_PAYLOAD_RESPONSE - Should reject large payloads" "MEDIUM"
    fi
    
    # Test 5: Null byte injection
    echo "🔍 Testing null byte injection..."
    
    NULL_BYTE_RESPONSE=$(curl -s -w "%{http_code}" \
        -X POST "$API_BASE/unit-of-measurement/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d '{"name": "Test\u0000Unit", "code": "T\u0000U"}' \
        -o null_byte.tmp 2>/dev/null)
    
    if [ "$NULL_BYTE_RESPONSE" == "422" ] || [ "$NULL_BYTE_RESPONSE" == "400" ]; then
        log_test "Null byte injection protection" "PASS" "Properly rejected null bytes"
    else
        if [ "$NULL_BYTE_RESPONSE" == "201" ]; then
            NULL_NAME=$(cat null_byte.tmp | jq -r '.name')
            if [[ "$NULL_NAME" != *$'\0'* ]]; then
                log_test "Null byte injection protection" "PASS" "Null bytes filtered from input"
            else
                log_test "Null byte injection protection" "FAIL" "Null bytes not properly handled" "MEDIUM"
            fi
        else
            log_test "Null byte injection protection" "FAIL" "HTTP $NULL_BYTE_RESPONSE - Unexpected response to null bytes" "MEDIUM"
        fi
    fi
    
    rm -f *.tmp
}

# Phase 5: Rate Limiting and DoS Protection
test_rate_limiting() {
    echo -e "\n${BLUE}🚦 Phase 5: Rate Limiting and DoS Protection${NC}"
    echo "─" $(printf "%*s" 50 | tr ' ' '─')
    
    ADMIN_TOKEN=$(authenticate_user "admin" "admin123" "admin")
    
    # Test 1: API rate limiting
    echo "🔍 Testing API rate limiting..."
    
    # Make rapid requests
    RATE_LIMIT_RESPONSES=()
    for i in {1..20}; do
        RESPONSE=$(curl -s -w "%{http_code}" \
            -X GET "$API_BASE/unit-of-measurement/stats/" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -o "rate_test_$i.tmp" 2>/dev/null)
        RATE_LIMIT_RESPONSES+=($RESPONSE)
    done
    
    # Check if any requests were rate limited (429 status)
    RATE_LIMITED_COUNT=0
    for response in "${RATE_LIMIT_RESPONSES[@]}"; do
        if [ "$response" == "429" ]; then
            RATE_LIMITED_COUNT=$((RATE_LIMITED_COUNT + 1))
        fi
    done
    
    if [ "$RATE_LIMITED_COUNT" -gt 0 ]; then
        log_test "API rate limiting" "PASS" "$RATE_LIMITED_COUNT requests were rate limited"
    else
        log_test "API rate limiting" "FAIL" "No rate limiting detected - potential DoS vulnerability" "MEDIUM"
    fi
    
    # Test 2: Concurrent request handling
    echo "🔍 Testing concurrent request handling..."
    
    # Launch multiple requests in background
    for i in {1..10}; do
        curl -s -X GET "$API_BASE/unit-of-measurement/stats/" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -o "concurrent_$i.tmp" &
    done
    
    # Wait for all to complete
    wait
    
    # Check if all completed successfully
    CONCURRENT_SUCCESS=0
    for i in {1..10}; do
        if [ -f "concurrent_$i.tmp" ] && [ -s "concurrent_$i.tmp" ]; then
            CONCURRENT_SUCCESS=$((CONCURRENT_SUCCESS + 1))
        fi
    done
    
    if [ "$CONCURRENT_SUCCESS" -ge 8 ]; then  # Allow some failures
        log_test "Concurrent request handling" "PASS" "$CONCURRENT_SUCCESS/10 concurrent requests succeeded"
    else
        log_test "Concurrent request handling" "FAIL" "Only $CONCURRENT_SUCCESS/10 concurrent requests succeeded" "MEDIUM"
    fi
    
    rm -f *.tmp
}

# Generate security report
generate_security_report() {
    local timestamp=$(date -Iseconds)
    local duration=$(($(date +%s) - START_TIME))
    
    echo -e "\n${BLUE}📊 Security Test Results Summary${NC}"
    echo "=" $(printf "%*s" 60 | tr ' ' '=')
    
    echo -e "${GREEN}✅ Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}❌ Failed: $FAILED_TESTS${NC}"
    echo -e "${BLUE}📊 Total:  $TOTAL_TESTS${NC}"
    echo -e "${PURPLE}🚨 Security Issues: $SECURITY_ISSUES${NC}"
    echo -e "${YELLOW}⏱️  Duration: ${duration}s${NC}"
    
    # Calculate security score
    local security_score=100
    if [ $SECURITY_ISSUES -gt 0 ]; then
        security_score=$((100 - (SECURITY_ISSUES * 10)))
        if [ $security_score -lt 0 ]; then
            security_score=0
        fi
    fi
    
    echo -e "${BLUE}🔒 Security Score: ${security_score}%${NC}"
    
    # Generate JSON report
    cat > "$SECURITY_REPORT" <<EOF
{
  "summary": {
    "timestamp": "$timestamp",
    "duration_seconds": $duration,
    "total_tests": $TOTAL_TESTS,
    "passed_tests": $PASSED_TESTS,
    "failed_tests": $FAILED_TESTS,
    "security_issues": $SECURITY_ISSUES,
    "security_score": $security_score
  },
  "security_findings": $(printf '%s\n' "${SECURITY_FINDINGS[@]}" | jq -R . | jq -s .),
  "test_results": $(printf '%s\n' "${!TEST_RESULTS[@]}" | while read key; do echo "\"$key\": \"${TEST_RESULTS[$key]}\""; done | sed 's/$/,/' | sed '$s/,$//' | tr '\n' ' ' | sed 's/^/{/' | sed 's/$/ }/')
}
EOF
    
    echo -e "\n${BLUE}📄 Security report saved to: $SECURITY_REPORT${NC}"
    
    if [ $SECURITY_ISSUES -gt 0 ]; then
        echo -e "\n${RED}🚨 SECURITY ISSUES DETECTED:${NC}"
        for finding in "${!SECURITY_FINDINGS[@]}"; do
            echo -e "${RED}  • $finding: ${SECURITY_FINDINGS[$finding]}${NC}"
        done
        echo -e "\n${RED}⚠️  Please address these security vulnerabilities before deployment!${NC}"
    fi
    
    if [ $security_score -ge 90 ]; then
        echo -e "\n${GREEN}🎯 Excellent security posture! ✨${NC}"
        return 0
    elif [ $security_score -ge 70 ]; then
        echo -e "\n${YELLOW}⚠️  Good security, but improvements recommended${NC}"
        return 1
    else
        echo -e "\n${RED}💥 Critical security issues found. Immediate action required!${NC}"
        return 2
    fi
}

# Main execution
main() {
    START_TIME=$(date +%s)
    
    # Clean up temp files
    rm -f *.tmp "$TEST_LOG" "$SECURITY_REPORT"
    
    echo "Starting UoM Security Testing at $(date)"
    echo "Security results will be logged to: $TEST_LOG"
    
    # Run all security test phases
    test_authentication_security
    test_rbac
    test_cors
    test_input_validation
    test_rate_limiting
    
    # Generate security report
    generate_security_report
    
    local exit_code=$?
    
    # Clean up temp files
    rm -f *.tmp
    
    exit $exit_code
}

# Execute main function
main "$@"