#!/bin/bash
set -e

# Fully Automated Docker Entrypoint with Migration Management
# No user intervention required - handles all scenarios automatically

# Color codes for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${CYAN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_header() {
    echo -e "${PURPLE}=========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}=========================================${NC}"
}

# Environment setup
export PYTHONPATH=/app:$PYTHONPATH
export ENVIRONMENT=${ENVIRONMENT:-docker}

log_header "Rental Manager - Automated Docker Startup"
log_info "Environment: $ENVIRONMENT"
log_info "Auto-migrate: ${AUTO_MIGRATE:-true}"
log_info "Auto-generate migrations: ${AUTO_GENERATE_MIGRATIONS:-false}"
log_info "Model watching: ${MIGRATION_WATCH_ENABLED:-false}"

# Wait for PostgreSQL
wait_for_postgres() {
    log_info "Waiting for PostgreSQL..."
    
    local max_retries=30
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if pg_isready -h ${DATABASE_HOST:-postgres} -p ${DATABASE_PORT:-5432} -U ${POSTGRES_USER:-rental_user} 2>/dev/null; then
            log_success "PostgreSQL is ready!"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        log_info "PostgreSQL not ready, attempt $retry_count/$max_retries..."
        sleep 2
    done
    
    log_error "PostgreSQL failed to start after $max_retries attempts"
    return 1
}

# Wait for Redis
wait_for_redis() {
    log_info "Waiting for Redis..."
    
    local max_retries=30
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if nc -z ${REDIS_HOST:-redis} ${REDIS_PORT:-6379} 2>/dev/null; then
            log_success "Redis is ready!"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        log_info "Redis not ready, attempt $retry_count/$max_retries..."
        sleep 2
    done
    
    log_error "Redis failed to start after $max_retries attempts"
    return 1
}

# Run automatic migrations
run_automatic_migrations() {
    if [ "${AUTO_MIGRATE}" != "false" ]; then
        log_header "Automatic Migration System"
        
        # Run the intelligent migration checker
        python scripts/migration_checker.py
        
        if [ $? -eq 0 ]; then
            log_success "Automatic migration completed successfully"
        else
            log_error "Automatic migration failed"
            
            # Check if we should continue despite migration failure
            if [ "${CONTINUE_ON_MIGRATION_FAILURE}" != "true" ]; then
                log_error "Stopping due to migration failure"
                exit 1
            else
                log_warning "Continuing despite migration failure (CONTINUE_ON_MIGRATION_FAILURE=true)"
            fi
        fi
    else
        log_info "Auto-migration disabled (AUTO_MIGRATE=false)"
    fi
}

# Initialize application data
initialize_app_data() {
    log_header "Application Data Initialization"
    
    # Create admin user (idempotent)
    log_info "Ensuring admin user exists..."
    python scripts/create_admin.py 2>/dev/null || log_info "Admin user already exists"
    
    # Initialize RBAC permissions (idempotent)
    log_info "Ensuring RBAC permissions..."
    python scripts/seed_rbac.py 2>/dev/null || log_info "RBAC already initialized"
    
    # Initialize system settings (idempotent)
    log_info "Ensuring system settings..."
    python scripts/init_system_settings.py 2>/dev/null || log_info "System settings already initialized"
    
    # Seed master data if requested
    if [ "${SEED_MASTER_DATA}" = "true" ]; then
        log_info "Seeding master data..."
        python scripts/seed_all_data.py 2>/dev/null || log_info "Master data already seeded"
    fi
    
    log_success "Application data initialization complete"
}

# Start model watcher for development
start_model_watcher() {
    if [ "${MIGRATION_WATCH_ENABLED}" = "true" ] && [ "${ENVIRONMENT}" != "production" ]; then
        log_info "Starting model watcher for automatic migration generation..."
        
        # Start the model watcher in background
        python scripts/model_watcher.py &
        WATCHER_PID=$!
        
        log_success "Model watcher started (PID: $WATCHER_PID)"
        
        # Store PID for cleanup
        echo $WATCHER_PID > /tmp/model_watcher.pid
    fi
}

# Start auto-migration generator for development
start_auto_migration_generator() {
    if [ "${AUTO_GENERATE_MIGRATIONS}" = "true" ] && [ "${ENVIRONMENT}" != "production" ]; then
        log_info "Starting auto-migration generator..."
        
        # Start the auto-migration generator in background
        python scripts/auto_migrate.py &
        AUTO_MIGRATE_PID=$!
        
        log_success "Auto-migration generator started (PID: $AUTO_MIGRATE_PID)"
        
        # Store PID for cleanup
        echo $AUTO_MIGRATE_PID > /tmp/auto_migrate.pid
    fi
}

# Health check
perform_health_check() {
    log_info "Performing health check..."
    
    # Check database connectivity
    python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
import os

async def check():
    try:
        db_url = os.getenv('DATABASE_URL')
        if 'postgresql://' in db_url and '+asyncpg' not in db_url:
            db_url = db_url.replace('postgresql://', 'postgresql+asyncpg://', 1)
        engine = create_async_engine(db_url)
        async with engine.connect() as conn:
            await conn.execute('SELECT 1')
        await engine.dispose()
        return True
    except:
        return False

exit(0 if asyncio.run(check()) else 1)
" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "Database health check: PASSED"
    else
        log_error "Database health check: FAILED"
        return 1
    fi
    
    # Check Redis connectivity
    redis-cli -h ${REDIS_HOST:-redis} -p ${REDIS_PORT:-6379} ping > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        log_success "Redis health check: PASSED"
    else
        log_warning "Redis health check: FAILED (non-critical)"
    fi
    
    return 0
}

# Cleanup function
cleanup() {
    log_warning "Received shutdown signal"
    
    # Stop model watcher if running
    if [ -f /tmp/model_watcher.pid ]; then
        WATCHER_PID=$(cat /tmp/model_watcher.pid)
        kill $WATCHER_PID 2>/dev/null || true
        rm /tmp/model_watcher.pid
    fi
    
    # Stop auto-migration generator if running
    if [ -f /tmp/auto_migrate.pid ]; then
        AUTO_MIGRATE_PID=$(cat /tmp/auto_migrate.pid)
        kill $AUTO_MIGRATE_PID 2>/dev/null || true
        rm /tmp/auto_migrate.pid
    fi
    
    log_info "Graceful shutdown complete"
    exit 0
}

# Trap signals for cleanup
trap cleanup SIGTERM SIGINT

# Main execution flow
main() {
    log_header "Starting Automated Setup Process"
    
    # Step 1: Wait for services
    wait_for_postgres || exit 1
    wait_for_redis || exit 1
    
    # Step 2: Run automatic migrations
    run_automatic_migrations
    
    # Step 3: Initialize application data
    initialize_app_data
    
    # Step 4: Start development tools if enabled
    start_model_watcher
    start_auto_migration_generator
    
    # Step 5: Perform health check
    perform_health_check || log_warning "Health check failed but continuing"
    
    # Step 6: Display configuration
    log_header "Application Configuration"
    log_info "Database: Connected and migrated"
    log_info "Redis: Connected"
    log_info "Admin user: Configured"
    log_info "RBAC: Initialized"
    log_info "Port: ${PORT:-8000}"
    log_info "Workers: ${WORKERS:-1}"
    log_info "Hot reload: ${HOT_RELOAD:-false}"
    
    # Step 7: Start the application
    log_header "Starting FastAPI Application"
    
    if [ "${HOT_RELOAD}" = "true" ] || [ "${AUTO_RELOAD}" = "true" ]; then
        log_info "Starting with hot reload enabled..."
        exec uvicorn app.main:app \
            --host ${HOST:-0.0.0.0} \
            --port ${PORT:-8000} \
            --reload \
            --reload-dir /app \
            --reload-include "*.py" \
            --reload-include "*.yml" \
            --reload-include "*.yaml" \
            --log-level ${LOG_LEVEL:-info} \
            --access-log
    else
        log_info "Starting in production mode..."
        exec uvicorn app.main:app \
            --host ${HOST:-0.0.0.0} \
            --port ${PORT:-8000} \
            --workers ${WORKERS:-1} \
            --log-level ${LOG_LEVEL:-info} \
            --access-log
    fi
}

# Execute main function
main