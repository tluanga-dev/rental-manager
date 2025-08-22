# Database Migration Guide

## Overview

This guide documents the database migration system for the Rental Manager Backend, which uses Alembic for schema version control and migration management.

## Migration System Architecture

### Components

1. **Alembic** - Database migration tool for SQLAlchemy
2. **Migration Files** - Located in `alembic/versions/`
3. **Production Startup Script** - `start-production.sh` handles automatic migrations
4. **Railway Deployment** - Nixpacks-based deployment with automatic migration execution

## Current State

- **Baseline Migration**: `202508190531_initial_database_schema.py`
- **Tables**: 53 production tables
- **Tracking**: Alembic version tracking established
- **Deployment**: Automatic migration on Railway deployment

## Common Migration Tasks

### 1. Creating a New Migration

#### Automatic Generation (Recommended)
```bash
# Generate migration from model changes
alembic revision --autogenerate -m "Add new field to items table"

# Review the generated migration
cat alembic/versions/*_add_new_field_to_items_table.py

# Test locally
alembic upgrade head

# Commit and push
git add alembic/versions/*.py
git commit -m "feat: add new field to items table"
git push origin main
```

#### Manual Migration
```bash
# Create empty migration
alembic revision -m "Custom migration description"

# Edit the migration file
vim alembic/versions/*_custom_migration_description.py

# Add upgrade() and downgrade() logic
```

### 2. Applying Migrations

#### Local Development
```bash
# Apply all pending migrations
alembic upgrade head

# Apply specific migration
alembic upgrade <revision>

# Show current version
alembic current

# Show migration history
alembic history
```

#### Production (Railway)
Migrations are automatically applied during deployment via `start-production.sh`:
1. Checks for alembic_version table
2. Applies pending migrations
3. Handles both fresh and existing databases

### 3. Rolling Back Migrations

```bash
# Rollback one migration
alembic downgrade -1

# Rollback to specific revision
alembic downgrade <revision>

# Rollback all (DANGEROUS!)
alembic downgrade base
```

### 4. Migration Status and History

```bash
# Show current database version
alembic current

# Show all migrations
alembic history

# Show pending migrations
alembic history -r current:head

# Show migration details
alembic show <revision>
```

## Production Migration Workflow

### Step 1: Make Model Changes
```python
# app/modules/items/models.py
class Item(Base):
    # ... existing fields ...
    new_field = Column(String(100), nullable=True)  # New field
```

### Step 2: Generate Migration
```bash
# Ensure you're in the backend directory
cd rental-manager-backend

# Generate migration
alembic revision --autogenerate -m "Add new_field to items"

# Review the generated file
cat alembic/versions/*_add_new_field_to_items.py
```

### Step 3: Test Locally
```bash
# Apply migration to local database
alembic upgrade head

# Test the changes
python3 -c "
from app.modules.items.models import Item
print('Migration successful!' if hasattr(Item, 'new_field') else 'Migration failed!')
"

# Run CRUD tests
python scripts/test_all_crud_operations.py
```

### Step 4: Deploy to Production
```bash
# Commit the migration
git add alembic/versions/*.py app/modules/items/models.py
git commit -m "feat: add new_field to items table"
git push origin main

# Railway automatically:
# 1. Detects the push
# 2. Builds with Nixpacks
# 3. Runs start-production.sh
# 4. Applies migrations
# 5. Starts the application
```

## Migration Best Practices

### DO's
✅ Always test migrations locally first
✅ Review auto-generated migrations carefully
✅ Include both upgrade and downgrade logic
✅ Use descriptive migration messages
✅ Backup production database before major migrations
✅ Test rollback procedures locally
✅ Keep migrations small and focused
✅ Use transactions for data migrations

### DON'Ts
❌ Never edit migration files after deployment
❌ Don't delete migration files from version control
❌ Avoid manual database changes in production
❌ Don't skip migrations (always apply in order)
❌ Never use DROP TABLE in production migrations without confirmation
❌ Don't mix schema and data migrations in the same file

## Troubleshooting

### Common Issues and Solutions

#### 1. Migration Conflicts
**Problem**: "Can't locate revision identified by..."
```bash
# Solution: Check current version
alembic current

# Stamp to specific version if needed
alembic stamp <revision>
```

#### 2. Failed Migration
**Problem**: Migration fails during execution
```bash
# Rollback the failed migration
alembic downgrade -1

# Fix the migration file
vim alembic/versions/<migration_file>.py

# Retry
alembic upgrade head
```

#### 3. Out of Sync Database
**Problem**: Database schema doesn't match migrations
```bash
# Generate a new migration to capture differences
alembic revision --autogenerate -m "Sync database schema"

# Review and apply
alembic upgrade head
```

#### 4. Missing alembic_version Table
**Problem**: "relation 'alembic_version' does not exist"
```bash
# Create the table and stamp with current version
alembic stamp head
```

## Emergency Procedures

### Production Database Reset
**⚠️ WARNING: This will DELETE ALL DATA!**

```bash
# Only use in extreme cases
python scripts/reset_and_migrate_production.py --production-reset --seed-master-data

# This will:
# 1. Drop all tables
# 2. Create fresh schema
# 3. Initialize admin user
# 4. Seed master data
```

### Manual Migration Fix
If automatic migration fails in production:

1. SSH into Railway container (if possible)
2. Or use Railway CLI:
```bash
railway run python scripts/production_migration_setup.py
```

## Migration Scripts

### Available Scripts

1. **production_migration_setup.py**
   - Creates baseline migration from existing schema
   - Stamps database with current version
   - Used for initial setup

2. **reset_and_migrate_production.py**
   - Complete database reset
   - Recreates all tables
   - Initializes data
   - **DESTRUCTIVE - Use with caution!**

3. **create_initial_migration.py**
   - Generates initial migration
   - Cleans old migrations
   - Verifies migration content

4. **test_all_crud_operations.py**
   - Tests database operations
   - Verifies migration success
   - Checks all models

## Environment Variables

Required for production migrations:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# Admin User (created if missing)
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@company.com
ADMIN_PASSWORD=SecurePassword123!
ADMIN_FULL_NAME=System Administrator

# Optional
SEED_MASTER_DATA=true  # Seeds initial data
```

## Monitoring Migrations

### Check Migration Status in Logs
Railway deployment logs will show:
```
========================================
Handling Database Migrations
========================================
Migration status: VERSION:202508190531
Database has migration version: 202508190531
Checking for pending migrations...
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
Migration handling complete
```

### Verify in Application
```python
# Check via API endpoint (if implemented)
GET /api/system/migration-status

# Or check directly in database
SELECT * FROM alembic_version;
```

## Migration Checklist

Before creating a migration:
- [ ] Models updated and tested locally
- [ ] Backup production database
- [ ] Review model changes with team
- [ ] Consider backward compatibility

Before deploying a migration:
- [ ] Migration tested locally
- [ ] Rollback tested locally
- [ ] CRUD operations verified
- [ ] Documentation updated
- [ ] Team notified of schema changes

After deployment:
- [ ] Verify migration applied (check logs)
- [ ] Test affected endpoints
- [ ] Monitor error rates
- [ ] Document any issues

## Support and Resources

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Railway Documentation](https://docs.railway.app/)
- Internal: See `CLAUDE.md` for project-specific guidance