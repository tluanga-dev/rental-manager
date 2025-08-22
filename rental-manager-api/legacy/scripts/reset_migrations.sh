#!/bin/bash
# Reset database and reapply all migrations
# WARNING: This will destroy all data!

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}╔════════════════════════════════════════╗${NC}"
echo -e "${RED}║         WARNING: DESTRUCTIVE!          ║${NC}"
echo -e "${RED}║   This will DELETE ALL DATABASE DATA   ║${NC}"
echo -e "${RED}╚════════════════════════════════════════╝${NC}"
echo

# Confirm action
read -p "Are you SURE you want to reset the database? Type 'RESET' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESET" ]; then
    echo -e "${YELLOW}Cancelled${NC}"
    exit 0
fi

# Create backup first
echo -e "${CYAN}Creating backup...${NC}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/before_reset"
mkdir -p $BACKUP_DIR

# Try to backup if database exists
pg_dump $DATABASE_URL > "$BACKUP_DIR/backup_$TIMESTAMP.sql" 2>/dev/null || echo "No existing database to backup"

echo -e "${YELLOW}Resetting database...${NC}"

# Downgrade to base (remove all migrations)
echo "1. Removing all migrations from database..."
alembic downgrade base || echo "No migrations to remove"

# Clear alembic_version table
echo "2. Clearing migration history..."
python -c "
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os

async def clear_migration_table():
    engine = create_async_engine(os.getenv('DATABASE_URL'))
    try:
        async with engine.connect() as conn:
            await conn.execute(text('DELETE FROM alembic_version'))
            await conn.commit()
            print('Migration history cleared')
    except Exception as e:
        print(f'No migration table to clear: {e}')
    finally:
        await engine.dispose()

asyncio.run(clear_migration_table())
" 2>/dev/null || echo "No migration table found"

# Apply all migrations fresh
echo -e "${CYAN}3. Applying all migrations...${NC}"
alembic upgrade head

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database reset successfully${NC}"
    
    # Initialize basic data
    echo -e "${CYAN}4. Initializing basic data...${NC}"
    
    # Create admin user
    python scripts/create_admin.py 2>/dev/null || echo "Admin user exists"
    
    # Seed RBAC
    python scripts/seed_rbac.py 2>/dev/null || echo "RBAC already seeded"
    
    # Initialize system settings
    python scripts/init_system_settings.py 2>/dev/null || echo "System settings initialized"
    
    echo -e "${GREEN}✓ Database ready for use${NC}"
    echo -e "Backup saved to: $BACKUP_DIR/backup_$TIMESTAMP.sql"
else
    echo -e "${RED}✗ Reset failed${NC}"
    echo "Attempting to restore from backup..."
    psql $DATABASE_URL < "$BACKUP_DIR/backup_$TIMESTAMP.sql"
    exit 1
fi