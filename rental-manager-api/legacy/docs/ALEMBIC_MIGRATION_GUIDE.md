# Alembic Migration Guide

## 📚 Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Migration Commands](#migration-commands)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

This project uses Alembic for database schema versioning and migrations. The system is designed to work seamlessly in both Docker (local development) and Railway (production) environments, with automatic migration detection and application capabilities.

### Key Features
- **Automatic Migration Detection**: Watches for model changes and generates migrations
- **Auto-Apply Migrations**: Applies migrations automatically in development
- **Backup & Rollback**: Creates backups before migrations with rollback capability
- **Production Safety**: Comprehensive checks and validations for production deployments
- **CLI Management**: Powerful command-line interface for migration management

## Quick Start

### Local Development (Docker)

1. **Start the development environment:**
```bash
docker-compose up -d
```

2. **Check migration status:**
```bash
docker-compose exec backend python manage.py migrate status
```

3. **Generate a new migration:**
```bash
docker-compose exec backend python manage.py migrate generate "Add new field to User model"
```

4. **Apply migrations:**
```bash
docker-compose exec backend python manage.py migrate upgrade
```

### Local Development (Without Docker)

1. **Check migration status:**
```bash
python manage.py migrate status
```

2. **Quick migration for model changes:**
```bash
./scripts/quick_migrate.sh "Description of changes"
```

3. **Apply pending migrations:**
```bash
alembic upgrade head
```

## Development Workflow

### Automatic Migration Watcher

Enable the migration watcher to automatically detect model changes and generate/apply migrations:

**Docker Compose Configuration:**
```yaml
# docker-compose.dev.yml
environment:
  MIGRATION_WATCHER: true       # Enable watcher
  AUTO_GENERATE: true           # Auto-generate on model changes
  AUTO_APPLY: true             # Auto-apply generated migrations
  BACKUP_BEFORE_MIGRATE: true  # Create backups
```

**Manual Activation:**
```bash
# Start migration watcher in background
python scripts/migration_watcher.py &
```

### Standard Development Flow

1. **Modify your models** in `app/modules/*/models.py`

2. **Generate migration automatically:**
```bash
# Using manage.py CLI
python manage.py migrate generate "Description of changes"

# Using quick script
./scripts/quick_migrate.sh "Description of changes"

# Using Alembic directly
alembic revision --autogenerate -m "Description of changes"
```

3. **Review the generated migration:**
```bash
# Latest migration will be in alembic/versions/
ls -la alembic/versions/
```

4. **Apply the migration:**
```bash
# Using manage.py
python manage.py migrate upgrade

# Using Alembic
alembic upgrade head
```

5. **Verify migration status:**
```bash
python manage.py migrate status
```

### Rollback Migrations

If something goes wrong, you can rollback migrations:

```bash
# Rollback last migration
python manage.py migrate downgrade --steps 1

# Rollback to specific revision
alembic downgrade <revision_id>

# Rollback all migrations (DANGEROUS!)
alembic downgrade base
```

## Production Deployment

### Railway Configuration

Railway automatically runs migrations on deployment using the enhanced startup script.

**Environment Variables for Railway:**
```env
# Enable automatic migrations
AUTO_MIGRATE=true

# Create backup before migrations
BACKUP_BEFORE_MIGRATE=true

# Database URL (automatically set by Railway)
DATABASE_URL=postgresql://...

# Optional: Seed initial data
SEED_MASTER_DATA=false
```

### Production Deployment Flow

1. **Push code to main branch:**
```bash
git add -A
git commit -m "feat: Add new feature with schema changes"
git push origin main
```

2. **Railway automatically:**
   - Detects the deployment
   - Checks for pending migrations
   - Creates database backup
   - Applies migrations
   - Runs health checks
   - Starts the application

3. **Monitor deployment:**
   - Check Railway logs for migration status
   - Verify application health endpoint

### Manual Production Migration

If you need to manually run migrations in production:

```bash
# SSH into Railway (if available) or use Railway CLI
railway run python manage.py migrate status
railway run python manage.py migrate upgrade
```

## Migration Commands

### Using manage.py CLI

```bash
# Check migration status
python manage.py migrate status

# Generate new migration
python manage.py migrate generate "Description"
python manage.py migrate generate "Description" --auto  # Auto-detect changes
python manage.py migrate generate "Description" --apply # Generate and apply

# Apply migrations
python manage.py migrate upgrade
python manage.py migrate upgrade --dry-run  # Show SQL without applying

# Rollback migrations
python manage.py migrate downgrade --steps 1
python manage.py migrate downgrade --steps 2 --no-backup

# View migration history
python manage.py migrate history

# Validate migrations
python manage.py migrate validate
python manage.py migrate validate --revision abc123

# Repair migration state
python manage.py migrate repair

# Database operations
python manage.py db backup
python manage.py db restore backups/backup_20240101.sql
python manage.py db reset  # DANGEROUS: Resets entire database
```

### Using Alembic Directly

```bash
# Check current version
alembic current

# Show migration history
alembic history
alembic history --verbose

# Generate migration
alembic revision --autogenerate -m "Description"
alembic revision -m "Manual migration"  # Empty migration

# Apply migrations
alembic upgrade head        # Latest version
alembic upgrade +1          # Next migration
alembic upgrade <revision>  # Specific revision

# Rollback migrations
alembic downgrade -1        # Previous migration
alembic downgrade <revision> # Specific revision
alembic downgrade base      # Remove all migrations

# Show migration SQL
alembic upgrade head --sql  # Show SQL without applying
```

### Using Quick Scripts

```bash
# Quick migration generation and application
./scripts/quick_migrate.sh "Add user preferences table"

# Reset database and reapply all migrations
./scripts/reset_migrations.sh
```

## Troubleshooting

### Common Issues

#### 1. Migration Conflicts

**Problem:** Multiple developers created migrations with the same parent
```bash
ERROR: Multiple head revisions detected
```

**Solution:**
```bash
# Merge migrations
alembic merge -m "Merge migrations" <revision1> <revision2>
```

#### 2. Migration Table Missing

**Problem:** Database exists but no alembic_version table
```bash
ERROR: Table 'alembic_version' doesn't exist
```

**Solution:**
```bash
# Stamp database with current version
alembic stamp head

# Or repair migration state
python manage.py migrate repair
```

#### 3. Models Out of Sync

**Problem:** Database schema doesn't match model definitions

**Solution:**
```bash
# Generate migration to sync
alembic revision --autogenerate -m "Sync database with models"
alembic upgrade head
```

#### 4. Failed Migration

**Problem:** Migration fails partway through

**Solution:**
```bash
# Check current state
python manage.py migrate status

# Restore from backup
python manage.py db restore backups/latest_backup.sql

# Or manually fix and retry
alembic upgrade head
```

#### 5. Production Migration Fails

**Problem:** Migration fails in Railway deployment

**Solution:**
1. Check Railway logs for specific error
2. Restore from automatic backup if created
3. Fix issue locally and test
4. Redeploy with fixed migration

### Debugging Commands

```bash
# Check database connection
python -c "from app.core.database import engine; print('Connected')"

# Verify alembic configuration
alembic check

# Show current database schema
python -c "
from app.db.base import Base
for table in Base.metadata.tables:
    print(table)
"

# Test migration without applying
alembic upgrade head --sql > migration_test.sql
```

## Best Practices

### 1. Always Test Migrations Locally

Before pushing to production:
```bash
# Reset local database
./scripts/reset_migrations.sh

# Apply all migrations fresh
alembic upgrade head

# Run tests
pytest
```

### 2. Use Descriptive Migration Messages

```bash
# Good
alembic revision --autogenerate -m "Add email_verified column to users table"

# Bad
alembic revision --autogenerate -m "Fix stuff"
```

### 3. Review Generated Migrations

Always review auto-generated migrations before applying:
- Check for unintended changes
- Verify foreign key constraints
- Ensure indexes are created properly
- Add custom SQL if needed

### 4. Handle Data Migrations Carefully

For migrations that modify data:
```python
# In migration file
def upgrade():
    # Schema changes first
    op.add_column('users', sa.Column('new_field', sa.String()))
    
    # Data migration
    connection = op.get_bind()
    result = connection.execute('SELECT id FROM users')
    for row in result:
        connection.execute(
            f"UPDATE users SET new_field = 'default' WHERE id = {row.id}"
        )

def downgrade():
    # Reverse data changes if possible
    op.drop_column('users', 'new_field')
```

### 5. Keep Migrations Small

- One logical change per migration
- Easier to debug and rollback
- Clearer history

### 6. Test Rollbacks

```bash
# Apply migration
alembic upgrade head

# Test rollback
alembic downgrade -1

# Reapply
alembic upgrade head
```

### 7. Use Migration Watcher in Development

Enable automatic migration generation and application:
```yaml
# docker-compose.override.yml
services:
  backend:
    environment:
      MIGRATION_WATCHER: true
      AUTO_GENERATE: true
      AUTO_APPLY: true
```

### 8. Backup Before Major Changes

```bash
# Manual backup
python manage.py db backup

# Automatic backup (enabled by default)
BACKUP_BEFORE_MIGRATE=true python manage.py migrate upgrade
```

### 9. Document Breaking Changes

If a migration includes breaking changes:
1. Add comments in the migration file
2. Update this documentation
3. Notify team members
4. Consider a phased rollout

### 10. Monitor Production Migrations

- Check Railway deployment logs
- Verify application starts successfully
- Test critical endpoints after deployment
- Keep backup ready for quick restore

## Migration File Structure

```
alembic/
├── versions/
│   ├── 202508190531_initial_database_schema.py
│   ├── 202508201045_add_user_preferences.py
│   └── ...
├── alembic.ini         # Alembic configuration
├── env.py             # Migration environment setup
└── script.py.mako     # Migration template
```

## Environment Variables

### Development
```env
# Enable automatic migrations
AUTO_MIGRATE=true

# Migration watcher settings
MIGRATION_WATCHER=true
AUTO_GENERATE=true
AUTO_APPLY=true
BACKUP_BEFORE_MIGRATE=true
WATCH_INTERVAL=5

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/db
```

### Production (Railway)
```env
# Automatic migration on deployment
AUTO_MIGRATE=true

# Safety features
BACKUP_BEFORE_MIGRATE=true
ALEMBIC_ROLLBACK_ON_FAIL=true

# Database (set by Railway)
DATABASE_URL=postgresql://...
```

## Additional Resources

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Railway Documentation](https://docs.railway.app/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review migration logs in `/app/logs/migration_watcher.log`
3. Check Railway deployment logs
4. Contact the development team

---

**Remember:** Always backup before major migrations and test thoroughly in development before deploying to production!