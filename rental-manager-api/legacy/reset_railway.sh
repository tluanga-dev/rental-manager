#!/bin/bash
# Railway Production Reset Wrapper Script
# This script provides a convenient way to reset the Railway production database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/scripts/reset_railway_production.py"

# Function to print colored output
print_color() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Function to print header
print_header() {
    echo
    print_color "$CYAN" "=========================================="
    print_color "$CYAN" "$1"
    print_color "$CYAN" "=========================================="
}

# Function to check if running in Railway environment
check_railway_env() {
    if [[ -n "$RAILWAY_ENVIRONMENT" ]]; then
        print_color "$GREEN" "✓ Railway environment detected: $RAILWAY_ENVIRONMENT"
        return 0
    else
        print_color "$YELLOW" "⚠ Not running in Railway environment"
        return 1
    fi
}

# Function to check required environment variables
check_env_vars() {
    local missing=0
    
    print_header "Checking Environment Variables"
    
    # Check database URL
    if [[ -n "$DATABASE_URL" ]]; then
        print_color "$GREEN" "✓ DATABASE_URL is set"
    else
        print_color "$RED" "✗ DATABASE_URL is not set"
        missing=1
    fi
    
    # Check Redis URL
    if [[ -n "$REDIS_URL" ]]; then
        print_color "$GREEN" "✓ REDIS_URL is set"
    else
        print_color "$YELLOW" "⚠ REDIS_URL is not set (Redis clearing will be skipped)"
    fi
    
    # Check admin credentials
    if [[ -n "$ADMIN_USERNAME" ]]; then
        print_color "$GREEN" "✓ ADMIN_USERNAME is set: $ADMIN_USERNAME"
    else
        print_color "$YELLOW" "⚠ ADMIN_USERNAME not set (will use default: admin)"
    fi
    
    if [[ -n "$ADMIN_EMAIL" ]]; then
        print_color "$GREEN" "✓ ADMIN_EMAIL is set: $ADMIN_EMAIL"
    else
        print_color "$YELLOW" "⚠ ADMIN_EMAIL not set (will use default)"
    fi
    
    if [[ -n "$ADMIN_PASSWORD" ]]; then
        print_color "$GREEN" "✓ ADMIN_PASSWORD is set"
    else
        print_color "$YELLOW" "⚠ ADMIN_PASSWORD not set (will use default)"
    fi
    
    if [[ $missing -eq 1 ]]; then
        print_color "$RED" "\n✗ Required environment variables are missing"
        return 1
    fi
    
    return 0
}

# Function to display usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --production    Execute the reset (required for actual deletion)"
    echo "  --dry-run       Show what would be deleted without deleting"
    echo "  --seed-data     Also seed master data after reset"
    echo "  --help          Show this help message"
    echo
    echo "Examples:"
    echo "  # Dry run to preview changes"
    echo "  $0 --dry-run"
    echo
    echo "  # Full production reset"
    echo "  $0 --production"
    echo
    echo "  # Reset and seed master data"
    echo "  $0 --production --seed-data"
    echo
    print_color "$RED" "WARNING: This will DELETE ALL DATA from the production database!"
}

# Main execution
main() {
    print_header "Railway Production Database Reset"
    
    # Parse arguments
    PRODUCTION_MODE=false
    DRY_RUN=false
    SEED_DATA=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --production)
                PRODUCTION_MODE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --seed-data)
                SEED_DATA=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                print_color "$RED" "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Validate arguments
    if [[ "$PRODUCTION_MODE" == false && "$DRY_RUN" == false ]]; then
        print_color "$RED" "Error: Must specify either --production or --dry-run"
        show_usage
        exit 1
    fi
    
    if [[ "$PRODUCTION_MODE" == true && "$DRY_RUN" == true ]]; then
        print_color "$RED" "Error: Cannot specify both --production and --dry-run"
        exit 1
    fi
    
    # Check environment
    if ! check_env_vars; then
        exit 1
    fi
    
    # Check if in Railway environment (warning only)
    check_railway_env
    
    # Build Python command
    PYTHON_CMD="python $PYTHON_SCRIPT"
    
    if [[ "$DRY_RUN" == true ]]; then
        PYTHON_CMD="$PYTHON_CMD --dry-run"
        print_color "$CYAN" "\n📋 Running in DRY RUN mode - no data will be deleted"
    else
        PYTHON_CMD="$PYTHON_CMD --production-reset"
        print_color "$RED" "\n⚠️  PRODUCTION RESET MODE - All data will be deleted!"
    fi
    
    if [[ "$SEED_DATA" == true ]]; then
        PYTHON_CMD="$PYTHON_CMD --seed-master-data"
        print_color "$CYAN" "📦 Master data will be seeded after reset"
    fi
    
    # Show final warning for production mode
    if [[ "$PRODUCTION_MODE" == true ]]; then
        echo
        print_color "$RED" "$BOLD" "════════════════════════════════════════"
        print_color "$RED" "$BOLD" "  FINAL WARNING: PRODUCTION DATA RESET"
        print_color "$RED" "$BOLD" "════════════════════════════════════════"
        print_color "$RED" "This action will:"
        print_color "$RED" "  • DELETE all data from PostgreSQL database"
        print_color "$RED" "  • CLEAR all Redis cache"
        print_color "$RED" "  • Re-create admin user and RBAC"
        echo
        print_color "$YELLOW" "Make sure you have a backup!"
        echo
        read -p "Type 'RESET PRODUCTION' to continue: " confirmation
        
        if [[ "$confirmation" != "RESET PRODUCTION" ]]; then
            print_color "$CYAN" "Operation cancelled."
            exit 0
        fi
    fi
    
    # Execute the Python script
    print_header "Executing Reset Script"
    
    echo "Command: $PYTHON_CMD"
    echo
    
    # Run the Python script
    if $PYTHON_CMD; then
        print_color "$GREEN" "\n✅ Reset completed successfully"
        
        # Offer to restart Railway service
        if [[ "$PRODUCTION_MODE" == true ]]; then
            echo
            print_color "$CYAN" "The database has been reset. You may need to restart the Railway service."
            
            # Check if Railway CLI is available
            if command -v railway &> /dev/null; then
                read -p "Would you like to restart the Railway service now? (y/n): " restart
                if [[ "$restart" == "y" || "$restart" == "Y" ]]; then
                    print_color "$CYAN" "Restarting Railway service..."
                    railway restart || print_color "$YELLOW" "Failed to restart. Please restart manually from Railway dashboard."
                fi
            else
                print_color "$YELLOW" "Railway CLI not found. Please restart the service from Railway dashboard."
            fi
        fi
    else
        print_color "$RED" "\n✗ Reset failed"
        exit 1
    fi
}

# Check if Python script exists
if [[ ! -f "$PYTHON_SCRIPT" ]]; then
    print_color "$RED" "Error: Python script not found at $PYTHON_SCRIPT"
    exit 1
fi

# Check if Python is available
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    print_color "$RED" "Error: Python is not installed"
    exit 1
fi

# Use python3 if available, otherwise python
if command -v python3 &> /dev/null; then
    alias python=python3
fi

# Run main function
main "$@"