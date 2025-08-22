#!/bin/bash

# Production Health Check Script for Rental Module
# Performs comprehensive health checks on all rental submodules

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PRODUCTION_URL="${PRODUCTION_URL:-https://api.production.com}"
STAGING_URL="${STAGING_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-}"
TEST_MODE="${TEST_MODE:-staging}"

# Use appropriate URL based on mode
if [ "$TEST_MODE" = "production" ]; then
    BASE_URL="$PRODUCTION_URL"
    echo -e "${RED}⚠️  Running in PRODUCTION mode${NC}"
else
    BASE_URL="$STAGING_URL"
    echo -e "${YELLOW}Running in STAGING mode${NC}"
fi

# Function to print headers
print_header() {
    echo -e "\n${BLUE}============================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================${NC}"
}

# Function to check endpoint
check_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        "$BASE_URL$endpoint")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "  ${GREEN}✓${NC} $description (Status: $response)"
        return 0
    else
        echo -e "  ${RED}✗${NC} $description (Expected: $expected_status, Got: $response)"
        return 1
    fi
}

# Function to check response time
check_response_time() {
    local endpoint=$1
    local max_time=$2
    local description=$3
    
    response_time=$(curl -s -o /dev/null -w "%{time_total}" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        "$BASE_URL$endpoint")
    
    # Convert to milliseconds for comparison (using awk for compatibility)
    response_ms=$(echo "$response_time" | awk '{printf "%.0f", $1 * 1000}')
    max_ms=$(echo "$max_time" | awk '{printf "%.0f", $1 * 1000}')
    
    if [ "$response_ms" -lt "$max_ms" ]; then
        echo -e "  ${GREEN}✓${NC} $description (${response_time}s)"
        return 0
    else
        echo -e "  ${RED}✗${NC} $description (${response_time}s > ${max_time}s limit)"
        return 1
    fi
}

# Initialize counters
total_checks=0
passed_checks=0
failed_checks=0

# Start health check
print_header "RENTAL MODULE HEALTH CHECK - $(date)"
echo "Environment: $TEST_MODE"
echo "URL: $BASE_URL"

# Check API connectivity
print_header "1. API Connectivity"

if check_endpoint "/api/health" "200" "API Health Endpoint"; then
    ((passed_checks++))
else
    ((failed_checks++))
fi
((total_checks++))

if check_endpoint "/api/health/detailed" "200" "Detailed Health Endpoint"; then
    ((passed_checks++))
else
    ((failed_checks++))
fi
((total_checks++))

# Check rental_core endpoints
print_header "2. Rental Core Module"

endpoints=(
    "/api/transactions/rentals/|200|List Rentals"
    "/api/transactions/rentals/active|200|Active Rentals"
    "/api/transactions/rentals/overdue|200|Overdue Rentals"
)

for endpoint_data in "${endpoints[@]}"; do
    IFS='|' read -r endpoint status description <<< "$endpoint_data"
    if check_endpoint "$endpoint" "$status" "$description"; then
        ((passed_checks++))
    else
        ((failed_checks++))
    fi
    ((total_checks++))
done

# Check rental_booking endpoints
print_header "3. Rental Booking Module"

if check_endpoint "/api/transactions/rentals/booking/" "200" "List Bookings"; then
    ((passed_checks++))
else
    ((failed_checks++))
fi
((total_checks++))

# Performance checks
print_header "4. Performance Checks"

perf_endpoints=(
    "/api/transactions/rentals/?limit=10|0.5|List 10 Rentals"
    "/api/transactions/rentals/active|1.0|Active Rentals"
    "/api/transactions/rentals/overdue|1.0|Overdue Rentals"
)

for endpoint_data in "${perf_endpoints[@]}"; do
    IFS='|' read -r endpoint max_time description <<< "$endpoint_data"
    if check_response_time "$endpoint" "$max_time" "$description"; then
        ((passed_checks++))
    else
        ((failed_checks++))
    fi
    ((total_checks++))
done

# Database connectivity check
print_header "5. Database Connectivity"

# Create a test query through the API
test_payload='{"limit": 1}'
response=$(curl -s -X GET \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    "$BASE_URL/api/transactions/rentals/?limit=1")

if echo "$response" | grep -q "data"; then
    echo -e "  ${GREEN}✓${NC} Database query successful"
    ((passed_checks++))
else
    echo -e "  ${RED}✗${NC} Database query failed"
    ((failed_checks++))
fi
((total_checks++))

# Check error handling
print_header "6. Error Handling"

# Test 404 response
response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $API_KEY" \
    "$BASE_URL/api/transactions/rentals/00000000-0000-0000-0000-000000000000")

if [ "$response" = "404" ]; then
    echo -e "  ${GREEN}✓${NC} 404 Error handling works"
    ((passed_checks++))
else
    echo -e "  ${RED}✗${NC} 404 Error handling failed (Got: $response)"
    ((failed_checks++))
fi
((total_checks++))

# Summary
print_header "HEALTH CHECK SUMMARY"

echo "Total Checks: $total_checks"
echo -e "${GREEN}Passed: $passed_checks${NC}"
echo -e "${RED}Failed: $failed_checks${NC}"

# Calculate health percentage
if [ $total_checks -gt 0 ]; then
    health_percentage=$((passed_checks * 100 / total_checks))
    echo "Health Score: ${health_percentage}%"
    
    if [ $health_percentage -eq 100 ]; then
        echo -e "\n${GREEN}✅ SYSTEM IS HEALTHY${NC}"
        exit 0
    elif [ $health_percentage -ge 90 ]; then
        echo -e "\n${YELLOW}⚠️  SYSTEM IS MOSTLY HEALTHY (${health_percentage}%)${NC}"
        exit 0
    elif [ $health_percentage -ge 70 ]; then
        echo -e "\n${YELLOW}⚠️  SYSTEM HAS ISSUES (${health_percentage}%)${NC}"
        exit 1
    else
        echo -e "\n${RED}❌ SYSTEM IS UNHEALTHY (${health_percentage}%)${NC}"
        exit 2
    fi
fi

# Write results to log file
LOG_DIR="./logs/health_checks"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/health_check_$(date +%Y%m%d_%H%M%S).log"

{
    echo "Health Check Report - $(date)"
    echo "Environment: $TEST_MODE"
    echo "URL: $BASE_URL"
    echo "Total Checks: $total_checks"
    echo "Passed: $passed_checks"
    echo "Failed: $failed_checks"
    echo "Health Score: ${health_percentage}%"
} > "$LOG_FILE"

echo -e "\nResults saved to: $LOG_FILE"