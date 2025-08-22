#!/bin/bash
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

print_status "========================================"
print_status "${PURPLE}Rental Manager Backend - Development Mode${NC}"
print_status "========================================"
print_info "Environment: ${ENVIRONMENT:-development}"
print_info "Debug Mode: ${DEBUG:-true}"
print_info "Hot Reload: ${HOT_RELOAD:-true}"
print_info "Auto Migrate: ${AUTO_MIGRATE:-true}"
print_info "Auto Generate: ${AUTO_GENERATE:-false}"
print_status "========================================"

# Function to wait for PostgreSQL
wait_for_postgres() {
    print_status "Waiting for PostgreSQL..."
    
    # Extract connection details
    DB_HOST=${DATABASE_HOST:-postgres}
    DB_PORT=${DATABASE_PORT:-5432}
    DB_USER=${POSTGRES_USER:-rental_user}
    
    local counter=0
    local max_attempts=30
    
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" 2>/dev/null; do
        counter=$((counter + 1))
        if [ $counter -gt $max_attempts ]; then
            print_error "PostgreSQL failed to start after $max_attempts attempts"
            exit 1
        fi
        echo -n "."
        sleep 2
    done
    
    print_success "PostgreSQL is ready at $DB_HOST:$DB_PORT"
}

# Function to wait for Redis
wait_for_redis() {
    print_status "Waiting for Redis..."
    
    REDIS_HOST=${REDIS_HOST:-redis}
    REDIS_PORT=${REDIS_PORT:-6379}
    
    local counter=0
    local max_attempts=30
    
    until nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; do
        counter=$((counter + 1))
        if [ $counter -gt $max_attempts ]; then
            print_error "Redis failed to start after $max_attempts attempts"
            exit 1
        fi
        echo -n "."
        sleep 2
    done
    
    print_success "Redis is ready at $REDIS_HOST:$REDIS_PORT"
}

# Function to check migration status
check_migration_status() {
    print_status "Checking migration status..."
    
    python -c "
import asyncio
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def check_status():
    try:
        engine = create_async_engine('$DATABASE_URL')
        async with engine.connect() as conn:
            # Check if alembic_version table exists
            result = await conn.execute(text('''
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'alembic_version'
                );
            '''))
            has_table = result.scalar()
            
            if not has_table:
                print('NO_MIGRATION_TABLE')
                return
            
            # Get current version
            result = await conn.execute(text('SELECT version_num FROM alembic_version LIMIT 1'))
            version = result.scalar()
            
            if version:
                print(f'VERSION:{version}')
            else:
                print('EMPTY_TABLE')
        
        await engine.dispose()
    except Exception as e:
        print(f'ERROR:{e}')

asyncio.run(check_status())
" 2>/dev/null || echo "ERROR:Failed to check"
}

# Function to run database migrations
run_migrations() {
    local migration_status=$(check_migration_status)
    
    print_info "Migration status: $migration_status"
    
    case "$migration_status" in
        NO_MIGRATION_TABLE)
            print_warning "No migration table found - initializing database"
            print_status "Running initial migrations..."
            if alembic upgrade head; then
                print_success "Initial migrations completed"
            else
                print_error "Initial migration failed"
                return 1
            fi
            ;;
            
        EMPTY_TABLE)
            print_warning "Empty migration table - stamping current version"
            # Get latest revision and stamp it
            local latest_rev=$(alembic heads | head -n1 | awk '{print $1}')
            if [ -n "$latest_rev" ]; then
                print_status "Stamping database with revision: $latest_rev"
                alembic stamp "$latest_rev"
            fi
            ;;
            
        VERSION:*)
            local current_version="${migration_status#VERSION:}"
            print_info "Current database version: ${current_version:0:8}..."
            
            # Check for pending migrations
            print_status "Checking for pending migrations..."
            local pending=$(alembic history --indicate-current 2>/dev/null | grep -c "^ ")
            
            if [ "$pending" -gt 0 ]; then
                print_warning "Found $pending pending migration(s)"
                
                if [ "$AUTO_MIGRATE" = "true" ]; then
                    print_status "Auto-applying pending migrations..."
                    if alembic upgrade head; then
                        print_success "Migrations applied successfully"
                    else
                        print_error "Migration failed"
                        return 1
                    fi
                else
                    print_info "Auto-migrate disabled, skipping migrations"
                fi
            else
                print_success "Database is up to date"
            fi
            ;;
            
        ERROR:*)
            print_error "Failed to check migration status: ${migration_status#ERROR:}"
            print_warning "Attempting to run migrations anyway..."
            
            if [ "$AUTO_MIGRATE" = "true" ]; then
                alembic upgrade head || print_warning "Migration attempt failed (non-critical)"
            fi
            ;;
            
        *)
            print_warning "Unknown migration status: $migration_status"
            ;;
    esac
}

# Function to run Python script with error handling
run_python_script() {
    local script=$1
    local description=$2
    local required=${3:-false}
    
    if [ -f "$script" ]; then
        print_status "$description"
        if python "$script"; then
            print_success "$description completed"
        else
            if [ "$required" = "true" ]; then
                print_error "$description failed (required)"
                exit 1
            else
                print_warning "$description failed or already completed (continuing...)"
            fi
        fi
    else
        if [ "$required" = "true" ]; then
            print_error "Required script not found: $script"
            exit 1
        else
            print_info "Script not found: $script (skipping)"
        fi
    fi
}

# Function to create database indexes
create_indexes() {
    if [ "$CREATE_INDEXES" = "true" ] && [ -f "scripts/create_indexes_async.py" ]; then
        print_status "Creating database indexes..."
        python scripts/create_indexes_async.py 2>/dev/null || print_info "Indexes already exist or creation skipped"
    fi
}

# Function to initialize development data
init_dev_data() {
    # Create admin user
    run_python_script "scripts/create_admin.py" "Creating admin user"
    
    # Seed RBAC permissions
    run_python_script "scripts/seed_rbac.py" "Seeding RBAC permissions"
    
    # Initialize system settings
    run_python_script "scripts/init_system_settings.py" "Initializing system settings"
    
    # Seed master data if requested
    if [ "$SEED_MASTER_DATA" = "true" ]; then
        run_python_script "scripts/seed_all_data.py" "Seeding master data"
    fi
}

# Function to start migration watcher in background
start_migration_watcher() {
    if [ "$MIGRATION_WATCHER" = "true" ] || [ "$AUTO_GENERATE" = "true" ]; then
        if [ -f "scripts/migration_watcher.py" ]; then
            print_status "Starting migration watcher in background..."
            python scripts/migration_watcher.py > /app/logs/migration_watcher.log 2>&1 &
            local watcher_pid=$!
            echo $watcher_pid > /tmp/migration_watcher.pid
            print_success "Migration watcher started (PID: $watcher_pid)"
        else
            print_warning "Migration watcher script not found"
        fi
    fi
}

# Main execution flow
main() {
    # Create necessary directories
    mkdir -p /app/logs /app/backups /app/uploads
    
    # Wait for dependent services
    wait_for_postgres
    wait_for_redis
    
    # Additional wait for database to be fully ready
    print_status "Waiting for database to be fully initialized..."
    sleep 3
    
    # Run database migrations
    if [ "$AUTO_MIGRATE" != "false" ]; then
        run_migrations
    else
        print_info "Auto-migration disabled"
    fi
    
    # Create indexes
    create_indexes
    
    # Initialize development data
    init_dev_data
    
    # Start migration watcher if enabled
    start_migration_watcher
    
    # Display final status
    print_status "========================================"
    print_success "${GREEN}Development environment ready!${NC}"
    print_status "========================================"
    print_info "API Documentation: http://localhost:8000/docs"
    print_info "Admin credentials: admin / ${ADMIN_PASSWORD:-Admin@Dev123!}"
    
    if [ "$MIGRATION_WATCHER" = "true" ]; then
        print_info "Migration watcher: ACTIVE (watching for changes)"
    fi
    
    print_status "========================================"
    
    # Start the application
    print_status "Starting FastAPI application..."
    
    if [ "$HOT_RELOAD" = "true" ] || [ "$AUTO_RELOAD" = "true" ]; then
        print_info "Hot reload enabled - application will restart on code changes"
        exec uvicorn app.main:app \
            --host ${HOST:-0.0.0.0} \
            --port ${PORT:-8000} \
            --reload \
            --reload-dir /app \
            --reload-include "*.py" \
            --reload-include "*.yml" \
            --reload-include "*.yaml" \
            --reload-include "*.json" \
            --log-level ${LOG_LEVEL:-debug} \
            --access-log
    else
        print_info "Hot reload disabled"
        exec uvicorn app.main:app \
            --host ${HOST:-0.0.0.0} \
            --port ${PORT:-8000} \
            --log-level ${LOG_LEVEL:-info} \
            --access-log
    fi
}

# Trap signals for graceful shutdown
cleanup() {
    print_warning "Shutting down..."
    
    # Stop migration watcher if running
    if [ -f /tmp/migration_watcher.pid ]; then
        local watcher_pid=$(cat /tmp/migration_watcher.pid)
        if kill -0 $watcher_pid 2>/dev/null; then
            print_info "Stopping migration watcher..."
            kill $watcher_pid
        fi
        rm -f /tmp/migration_watcher.pid
    fi
    
    exit 0
}

trap cleanup SIGTERM SIGINT

# Run main function
main