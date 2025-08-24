#!/bin/bash

# 🐳 Unit of Measurement Testing Suite - Docker Integration Runner
# Complete testing pipeline with Docker environment setup, data seeding, and comprehensive test execution

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
API_DIR="$PROJECT_ROOT/rental-manager-api"
FRONTEND_DIR="$PROJECT_ROOT/rental-manager-frontend"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"
LOG_DIR="$PROJECT_ROOT/test-logs"

# Test configuration
RUN_SEED_DATA=true
SEED_COUNT=10000
CLEANUP_AFTER_TESTS=true
PARALLEL_TESTS=true
GENERATE_REPORTS=true
CI_MODE=${CI:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Test results tracking
declare -A TEST_RESULTS
TOTAL_TEST_SUITES=0
PASSED_TEST_SUITES=0
FAILED_TEST_SUITES=0
START_TIME=$(date +%s)

# Logging functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")  echo -e "${BLUE}[${timestamp}] ℹ️  INFO:${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[${timestamp}] ✅ SUCCESS:${NC} $message" ;;
        "WARNING") echo -e "${YELLOW}[${timestamp}] ⚠️  WARNING:${NC} $message" ;;
        "ERROR")   echo -e "${RED}[${timestamp}] ❌ ERROR:${NC} $message" ;;
        "HEADER")  echo -e "${WHITE}[${timestamp}] 🎯 ${NC}$message" ;;
        "STEP")    echo -e "${CYAN}[${timestamp}] 📍 STEP:${NC} $message" ;;
    esac
    
    # Log to file
    echo "[${timestamp}] $level: $message" >> "$LOG_DIR/docker_runner.log"
}

track_test_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    TOTAL_TEST_SUITES=$((TOTAL_TEST_SUITES + 1))
    
    if [ "$result" == "PASS" ]; then
        PASSED_TEST_SUITES=$((PASSED_TEST_SUITES + 1))
        log "SUCCESS" "$test_name - $details"
        TEST_RESULTS["$test_name"]="PASS"
    else
        FAILED_TEST_SUITES=$((FAILED_TEST_SUITES + 1))
        log "ERROR" "$test_name - $details"
        TEST_RESULTS["$test_name"]="FAIL"
    fi
}

# Check dependencies
check_dependencies() {
    log "STEP" "Checking dependencies"
    
    local deps=("docker" "docker-compose" "jq" "curl" "node" "npm")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log "ERROR" "Missing dependencies: ${missing_deps[*]}"
        log "INFO" "Please install missing dependencies and try again"
        exit 1
    fi
    
    log "SUCCESS" "All dependencies are available"
}

# Setup test environment
setup_test_environment() {
    log "STEP" "Setting up test environment"
    
    # Create directories
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$LOG_DIR"
    
    # Clean up previous test results
    if [ "$CLEANUP_AFTER_TESTS" == "true" ]; then
        log "INFO" "Cleaning up previous test results"
        rm -f "$TEST_RESULTS_DIR"/*.json
        rm -f "$TEST_RESULTS_DIR"/*.log
        rm -f "$LOG_DIR"/*.log
    fi
    
    log "SUCCESS" "Test environment setup complete"
}

# Docker operations
start_docker_services() {
    log "STEP" "Starting Docker services"
    
    cd "$PROJECT_ROOT"
    
    # Check if docker-compose.yml exists
    if [ ! -f "docker-compose.yml" ]; then
        log "ERROR" "docker-compose.yml not found in project root"
        return 1
    fi
    
    # Stop any existing services
    log "INFO" "Stopping existing Docker services"
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Start services
    log "INFO" "Starting Docker services in background"
    docker-compose up -d --build
    
    # Wait for services to be ready
    wait_for_services
    
    log "SUCCESS" "Docker services are ready"
}

wait_for_services() {
    log "INFO" "Waiting for services to be ready"
    
    local api_url="http://localhost:8001"
    local frontend_url="http://localhost:3001"
    local max_attempts=60
    local attempt=0
    
    # Wait for API
    log "INFO" "Waiting for API service ($api_url)"
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$api_url/health" >/dev/null 2>&1; then
            log "SUCCESS" "API service is ready"
            break
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -eq $max_attempts ]; then
            log "ERROR" "API service failed to start within timeout"
            return 1
        fi
        
        sleep 2
    done
    
    # Wait for Frontend (if exists)
    log "INFO" "Waiting for Frontend service ($frontend_url)"
    attempt=0
    while [ $attempt -lt 30 ]; do  # Shorter timeout for frontend
        if curl -s -f "$frontend_url" >/dev/null 2>&1; then
            log "SUCCESS" "Frontend service is ready"
            break
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -eq 30 ]; then
            log "WARNING" "Frontend service not accessible, tests will run API-only"
            break
        fi
        
        sleep 2
    done
    
    # Wait for database
    log "INFO" "Waiting for database to be ready"
    sleep 5  # Give database extra time to initialize
    
    # Verify database connectivity through API
    local db_ready=false
    for i in {1..10}; do
        if curl -s -f "$api_url/health" | jq -r '.database' | grep -q "ok\|healthy\|connected" 2>/dev/null; then
            log "SUCCESS" "Database is ready"
            db_ready=true
            break
        fi
        sleep 3
    done
    
    if [ "$db_ready" == "false" ]; then
        log "WARNING" "Database readiness could not be confirmed"
    fi
}

# Database migrations
run_migrations() {
    log "STEP" "Running database migrations"
    
    cd "$API_DIR"
    
    # Run migrations in the API container
    if docker-compose -f ../docker-compose.yml exec -T api alembic upgrade head; then
        log "SUCCESS" "Database migrations completed"
    else
        log "ERROR" "Database migrations failed"
        return 1
    fi
}

# Seed test data
seed_test_data() {
    if [ "$RUN_SEED_DATA" != "true" ]; then
        log "INFO" "Skipping test data seeding (disabled)"
        return 0
    fi
    
    log "STEP" "Seeding test data ($SEED_COUNT units)"
    
    cd "$API_DIR"
    
    # Run seeding script
    if [ -f "scripts/seed_uom_10k.py" ]; then
        log "INFO" "Running UoM seeding script"
        
        if docker-compose -f ../docker-compose.yml exec -T api python scripts/seed_uom_10k.py --count "$SEED_COUNT"; then
            log "SUCCESS" "Test data seeded successfully"
        else
            log "WARNING" "Test data seeding failed, continuing with existing data"
        fi
    else
        log "WARNING" "Seeding script not found, skipping data generation"
    fi
}

# Test execution functions
run_api_tests() {
    log "STEP" "Running API tests with curl"
    
    cd "$API_DIR"
    
    if [ -f "scripts/test-uom-api-complete.sh" ]; then
        log "INFO" "Executing comprehensive API test suite"
        
        # Run the test script and capture exit code
        local exit_code=0
        ./scripts/test-uom-api-complete.sh > "$TEST_RESULTS_DIR/api_test_output.log" 2>&1 || exit_code=$?
        
        # Copy results files
        if [ -f "uom_api_test_results.log" ]; then
            cp "uom_api_test_results.log" "$TEST_RESULTS_DIR/"
        fi
        if [ -f "uom_test_metrics.json" ]; then
            cp "uom_test_metrics.json" "$TEST_RESULTS_DIR/"
        fi
        
        if [ $exit_code -eq 0 ]; then
            track_test_result "API Tests" "PASS" "All API tests passed"
        else
            track_test_result "API Tests" "FAIL" "Some API tests failed (exit code: $exit_code)"
        fi
    else
        log "ERROR" "API test script not found"
        track_test_result "API Tests" "FAIL" "Test script not found"
    fi
}

run_security_tests() {
    log "STEP" "Running security tests"
    
    cd "$API_DIR"
    
    if [ -f "scripts/test-uom-security.sh" ]; then
        log "INFO" "Executing security test suite"
        
        # Run security tests
        local exit_code=0
        ./scripts/test-uom-security.sh > "$TEST_RESULTS_DIR/security_test_output.log" 2>&1 || exit_code=$?
        
        # Copy results
        if [ -f "uom_security_test_results.log" ]; then
            cp "uom_security_test_results.log" "$TEST_RESULTS_DIR/"
        fi
        if [ -f "uom_security_report.json" ]; then
            cp "uom_security_report.json" "$TEST_RESULTS_DIR/"
        fi
        
        # Security tests use different exit codes
        if [ $exit_code -le 1 ]; then  # 0 = excellent, 1 = good
            track_test_result "Security Tests" "PASS" "Security tests passed (score acceptable)"
        else
            track_test_result "Security Tests" "FAIL" "Critical security issues found"
        fi
    else
        log "ERROR" "Security test script not found"
        track_test_result "Security Tests" "FAIL" "Test script not found"
    fi
}

run_performance_tests() {
    log "STEP" "Running performance tests"
    
    cd "$FRONTEND_DIR"
    
    if [ -f "test-uom-performance.js" ]; then
        log "INFO" "Executing performance test suite"
        
        # Install Node.js dependencies if needed
        if [ ! -d "node_modules" ]; then
            log "INFO" "Installing Node.js dependencies"
            npm install > /dev/null 2>&1
        fi
        
        # Run performance tests
        local exit_code=0
        node test-uom-performance.js > "$TEST_RESULTS_DIR/performance_test_output.log" 2>&1 || exit_code=$?
        
        # Copy results
        if [ -f "uom_performance_report.json" ]; then
            cp "uom_performance_report.json" "$TEST_RESULTS_DIR/"
        fi
        
        if [ $exit_code -eq 0 ]; then
            track_test_result "Performance Tests" "PASS" "Performance tests passed"
        else
            track_test_result "Performance Tests" "FAIL" "Performance issues detected"
        fi
    else
        log "ERROR" "Performance test script not found"
        track_test_result "Performance Tests" "FAIL" "Test script not found"
    fi
}

run_edge_case_tests() {
    log "STEP" "Running edge case tests"
    
    cd "$FRONTEND_DIR"
    
    if [ -f "test-uom-edge-cases.js" ]; then
        log "INFO" "Executing edge case test suite"
        
        # Run edge case tests
        local exit_code=0
        node test-uom-edge-cases.js > "$TEST_RESULTS_DIR/edge_case_test_output.log" 2>&1 || exit_code=$?
        
        # Copy results
        if [ -f "uom_edge_cases_report.json" ]; then
            cp "uom_edge_cases_report.json" "$TEST_RESULTS_DIR/"
        fi
        
        if [ $exit_code -eq 0 ]; then
            track_test_result "Edge Case Tests" "PASS" "Edge case tests passed"
        else
            track_test_result "Edge Case Tests" "FAIL" "Edge case issues detected"
        fi
    else
        log "ERROR" "Edge case test script not found"
        track_test_result "Edge Case Tests" "FAIL" "Test script not found"
    fi
}

run_frontend_tests() {
    log "STEP" "Running frontend E2E tests"
    
    cd "$FRONTEND_DIR"
    
    if [ -f "test-uom-puppeteer-complete.js" ]; then
        log "INFO" "Executing frontend E2E test suite"
        
        # Install puppeteer if not available
        if [ ! -d "node_modules/puppeteer" ]; then
            log "INFO" "Installing Puppeteer for E2E tests"
            npm install puppeteer > /dev/null 2>&1
        fi
        
        # Set environment variables for headless mode in CI
        export HEADLESS=${HEADLESS:-$CI_MODE}
        export DEVTOOLS=false
        export SLOW_MO=0
        
        # Run frontend tests
        local exit_code=0
        node test-uom-puppeteer-complete.js > "$TEST_RESULTS_DIR/frontend_test_output.log" 2>&1 || exit_code=$?
        
        # Copy results
        if [ -f "uom_puppeteer_results.json" ]; then
            cp "uom_puppeteer_results.json" "$TEST_RESULTS_DIR/"
        fi
        
        # Copy screenshots if they exist
        if [ -d "screenshots" ]; then
            cp -r screenshots "$TEST_RESULTS_DIR/puppeteer_screenshots" 2>/dev/null || true
        fi
        
        if [ $exit_code -eq 0 ]; then
            track_test_result "Frontend E2E Tests" "PASS" "Frontend tests passed"
        else
            track_test_result "Frontend E2E Tests" "FAIL" "Frontend test issues detected"
        fi
    else
        log "ERROR" "Frontend test script not found"
        track_test_result "Frontend E2E Tests" "FAIL" "Test script not found"
    fi
}

# Run all tests
run_all_tests() {
    log "HEADER" "Starting comprehensive UoM test execution"
    
    if [ "$PARALLEL_TESTS" == "true" ] && [ "$CI_MODE" != "true" ]; then
        log "INFO" "Running tests in parallel mode"
        
        # Run independent tests in parallel
        (run_api_tests) &
        (run_security_tests) &
        (run_performance_tests) &
        (run_edge_case_tests) &
        
        # Wait for all parallel tests to complete
        wait
        
        # Run frontend tests separately (may conflict with API tests)
        run_frontend_tests
        
    else
        log "INFO" "Running tests in sequential mode"
        
        # Run tests sequentially
        run_api_tests
        run_security_tests
        run_performance_tests
        run_edge_case_tests
        run_frontend_tests
    fi
}

# Generate consolidated report
generate_consolidated_report() {
    log "STEP" "Generating consolidated test report"
    
    local timestamp=$(date -Iseconds)
    local duration=$(($(date +%s) - START_TIME))
    local success_rate=0
    
    if [ $TOTAL_TEST_SUITES -gt 0 ]; then
        success_rate=$(( (PASSED_TEST_SUITES * 100) / TOTAL_TEST_SUITES ))
    fi
    
    # Create consolidated JSON report
    cat > "$TEST_RESULTS_DIR/consolidated_test_report.json" <<EOF
{
  "test_execution": {
    "timestamp": "$timestamp",
    "duration_seconds": $duration,
    "environment": "docker",
    "ci_mode": $CI_MODE,
    "parallel_execution": $PARALLEL_TESTS
  },
  "summary": {
    "total_test_suites": $TOTAL_TEST_SUITES,
    "passed_test_suites": $PASSED_TEST_SUITES,
    "failed_test_suites": $FAILED_TEST_SUITES,
    "success_rate_percentage": $success_rate
  },
  "test_suite_results": {
EOF
    
    # Add test results
    local first_result=true
    for test_name in "${!TEST_RESULTS[@]}"; do
        if [ "$first_result" = true ]; then
            first_result=false
        else
            echo "," >> "$TEST_RESULTS_DIR/consolidated_test_report.json"
        fi
        echo "    \"$test_name\": \"${TEST_RESULTS[$test_name]}\"" >> "$TEST_RESULTS_DIR/consolidated_test_report.json"
    done
    
    cat >> "$TEST_RESULTS_DIR/consolidated_test_report.json" <<EOF
  },
  "configuration": {
    "seed_data_enabled": $RUN_SEED_DATA,
    "seed_count": $SEED_COUNT,
    "cleanup_enabled": $CLEANUP_AFTER_TESTS,
    "report_generation": $GENERATE_REPORTS
  }
}
EOF
    
    # Generate human-readable summary
    cat > "$TEST_RESULTS_DIR/test_summary.txt" <<EOF
🐳 UoM Testing Suite - Docker Integration Results
=====================================================

Execution Details:
  Started: $(date -d @$START_TIME '+%Y-%m-%d %H:%M:%S')
  Completed: $(date '+%Y-%m-%d %H:%M:%S')
  Duration: ${duration} seconds
  Environment: Docker Compose
  
Test Suite Summary:
  Total Test Suites: $TOTAL_TEST_SUITES
  Passed: $PASSED_TEST_SUITES
  Failed: $FAILED_TEST_SUITES
  Success Rate: ${success_rate}%

Individual Test Results:
EOF
    
    for test_name in "${!TEST_RESULTS[@]}"; do
        local status_icon="❌"
        if [ "${TEST_RESULTS[$test_name]}" == "PASS" ]; then
            status_icon="✅"
        fi
        echo "  $status_icon $test_name: ${TEST_RESULTS[$test_name]}" >> "$TEST_RESULTS_DIR/test_summary.txt"
    done
    
    cat >> "$TEST_RESULTS_DIR/test_summary.txt" <<EOF

Available Reports:
  - consolidated_test_report.json: Complete test execution data
  - uom_api_test_results.log: API test details
  - uom_security_report.json: Security test findings
  - uom_performance_report.json: Performance metrics
  - uom_edge_cases_report.json: Edge case test results
  - uom_puppeteer_results.json: Frontend E2E test results

EOF
    
    log "SUCCESS" "Consolidated report generated"
}

# Display final results
display_final_results() {
    local duration=$(($(date +%s) - START_TIME))
    local success_rate=0
    
    if [ $TOTAL_TEST_SUITES -gt 0 ]; then
        success_rate=$(( (PASSED_TEST_SUITES * 100) / TOTAL_TEST_SUITES ))
    fi
    
    echo ""
    echo "🎯 FINAL TEST RESULTS"
    echo "===================="
    
    echo -e "${WHITE}Execution Time:${NC} ${duration}s"
    echo -e "${BLUE}Total Test Suites:${NC} $TOTAL_TEST_SUITES"
    echo -e "${GREEN}Passed:${NC} $PASSED_TEST_SUITES"
    echo -e "${RED}Failed:${NC} $FAILED_TEST_SUITES"
    echo -e "${PURPLE}Success Rate:${NC} ${success_rate}%"
    
    echo ""
    echo "📊 Test Suite Breakdown:"
    for test_name in "${!TEST_RESULTS[@]}"; do
        local status="${TEST_RESULTS[$test_name]}"
        local icon="❌"
        local color="$RED"
        
        if [ "$status" == "PASS" ]; then
            icon="✅"
            color="$GREEN"
        fi
        
        echo -e "  $icon ${color}$test_name${NC}: $status"
    done
    
    echo ""
    if [ $success_rate -eq 100 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED! The UoM system is functioning perfectly.${NC}"
    elif [ $success_rate -ge 80 ]; then
        echo -e "${YELLOW}⚠️  Most tests passed, but some issues were detected.${NC}"
        echo -e "${YELLOW}   Review the failed tests and address the issues.${NC}"
    else
        echo -e "${RED}🚨 CRITICAL: Multiple test failures detected!${NC}"
        echo -e "${RED}   Immediate investigation and fixes required.${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}📄 View detailed results in:${NC} $TEST_RESULTS_DIR/"
    echo -e "${CYAN}📋 Quick summary:${NC} $TEST_RESULTS_DIR/test_summary.txt"
}

# Cleanup function
cleanup() {
    log "STEP" "Performing cleanup"
    
    if [ "$CLEANUP_AFTER_TESTS" == "true" ]; then
        log "INFO" "Stopping Docker services"
        cd "$PROJECT_ROOT"
        docker-compose down --remove-orphans 2>/dev/null || true
        
        log "INFO" "Removing temporary test files"
        find "$API_DIR" -name "*.tmp" -delete 2>/dev/null || true
        find "$FRONTEND_DIR" -name "*.tmp" -delete 2>/dev/null || true
    else
        log "INFO" "Cleanup disabled, leaving environment running"
    fi
}

# Signal handlers
trap cleanup EXIT
trap 'log "ERROR" "Script interrupted"; exit 1' INT TERM

# Usage information
show_usage() {
    echo "🐳 UoM Testing Suite - Docker Integration Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --no-seed           Skip test data seeding"
    echo "  --seed-count N      Number of test units to seed (default: 10000)"
    echo "  --no-cleanup        Keep Docker services running after tests"
    echo "  --sequential        Run tests sequentially (default: parallel)"
    echo "  --ci                CI mode (headless, sequential, no cleanup)"
    echo "  --help              Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  CI=true             Enable CI mode"
    echo "  HEADLESS=true       Run browser tests headlessly"
    echo "  PARALLEL_TESTS=true Run tests in parallel"
    echo ""
    echo "Examples:"
    echo "  $0                          # Run with defaults"
    echo "  $0 --no-seed --sequential   # Skip seeding, run sequentially"
    echo "  $0 --ci                     # CI mode"
    echo "  CI=true $0                  # CI mode via environment"
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-seed)
                RUN_SEED_DATA=false
                shift
                ;;
            --seed-count)
                SEED_COUNT="$2"
                shift 2
                ;;
            --no-cleanup)
                CLEANUP_AFTER_TESTS=false
                shift
                ;;
            --sequential)
                PARALLEL_TESTS=false
                shift
                ;;
            --ci)
                CI_MODE=true
                PARALLEL_TESTS=false
                CLEANUP_AFTER_TESTS=false
                export HEADLESS=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Main execution function
main() {
    local start_msg="🐳 UoM Testing Suite - Docker Integration Runner"
    echo "==================================================================================="
    echo "$start_msg"
    echo "==================================================================================="
    echo ""
    
    log "HEADER" "Starting UoM comprehensive testing pipeline"
    log "INFO" "Configuration: Seed=$RUN_SEED_DATA, Parallel=$PARALLEL_TESTS, Cleanup=$CLEANUP_AFTER_TESTS, CI=$CI_MODE"
    
    # Execute testing pipeline
    check_dependencies
    setup_test_environment
    start_docker_services
    run_migrations
    seed_test_data
    run_all_tests
    
    if [ "$GENERATE_REPORTS" == "true" ]; then
        generate_consolidated_report
    fi
    
    display_final_results
    
    # Return appropriate exit code
    if [ $FAILED_TEST_SUITES -eq 0 ]; then
        log "SUCCESS" "All test suites passed successfully"
        return 0
    else
        log "ERROR" "$FAILED_TEST_SUITES out of $TOTAL_TEST_SUITES test suites failed"
        return 1
    fi
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    parse_arguments "$@"
    main
fi