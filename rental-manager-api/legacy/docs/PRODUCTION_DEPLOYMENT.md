# Production Deployment Guide - Railway

## Overview

This guide covers the production deployment process for the Rental Manager Backend on Railway using Nixpacks.

## Deployment Architecture

### Railway Configuration
- **Builder**: Nixpacks (automatic Python detection)
- **Start Command**: `bash start-production.sh`
- **Restart Policy**: ON_FAILURE with 5 retries
- **Deployment Trigger**: Push to `main` branch

### Deployment Flow
```
Git Push → Railway Detection → Nixpacks Build → Start Script → Application Running
```

## Environment Variables

### Required Variables
```bash
# Database (Railway provides automatically)
DATABASE_URL=postgresql://user:pass@host:port/railway

# Redis (Railway provides if Redis service added)
REDIS_URL=redis://default:pass@host:port

# Security
SECRET_KEY=your-secret-key-here-change-in-production
JWT_ALGORITHM=HS256

# Admin User
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=YourSecure@Password123!
ADMIN_FULL_NAME=System Administrator

# Server
PORT=8000  # Railway sets this automatically
```

### Optional Variables
```bash
# Master Data
SEED_MASTER_DATA=true  # Set to seed initial data

# Debugging
DATABASE_ECHO=false     # Set to true for SQL logging
DEBUG=false            # Production should be false

# Performance
WORKERS=1              # Number of workers
DEFAULT_PAGE_SIZE=20   # Pagination default
MAX_PAGE_SIZE=100      # Maximum page size
```

## Startup Process

The `start-production.sh` script performs these steps:

### 1. Database Connection
```bash
# Waits up to 60 seconds for database
# Converts DATABASE_URL to asyncpg format
# Tests connection before proceeding
```

### 2. Migration Handling
```bash
# Checks alembic_version table status
# Three scenarios handled:
1. NO_ALEMBIC_TABLE → Creates and runs all migrations
2. EMPTY_ALEMBIC_TABLE → Stamps with latest revision
3. VERSION:xxx → Applies pending migrations
```

### 3. Data Initialization
```bash
# Creates admin user if missing
# Synchronizes admin password with environment
# Seeds RBAC permissions
# Initializes system settings
# Optionally seeds master data
```

### 4. Application Start
```bash
# Starts Uvicorn server
# Binds to 0.0.0.0:$PORT
# Enables access logging
# Info-level logging
```

## Deployment Commands

### Deploy from Local
```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Make changes
# ... edit files ...

# Generate migration if needed
alembic revision --autogenerate -m "Change description"

# Test locally
alembic upgrade head
pytest

# Deploy to production
git add -A
git commit -m "feat: description of changes"
git push origin main

# Railway automatically deploys
```

### Monitor Deployment
```bash
# Using Railway CLI
railway logs

# Via Railway Dashboard
# Go to: https://railway.app/project/[project-id]/service/[service-id]
```

### Rollback Deployment
```bash
# Via Railway Dashboard
# 1. Go to Deployments tab
# 2. Find previous successful deployment
# 3. Click "Redeploy"

# Via Git
git revert HEAD
git push origin main
```

## Health Checks

### Application Health
```bash
# Check if application is running
curl https://your-app.railway.app/health

# Check API documentation
curl https://your-app.railway.app/docs
```

### Database Health
```python
# Check via Railway CLI
railway run python -c "
from app.core.database import AsyncSessionLocal
import asyncio

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute('SELECT 1')
        print('Database: OK')

asyncio.run(check())
"
```

### Migration Status
```python
# Check current migration version
railway run alembic current

# Check pending migrations
railway run alembic history -r current:head
```

## Troubleshooting

### Common Issues

#### 1. Build Failures
**Symptom**: Deployment fails during build
```bash
# Check build logs in Railway dashboard
# Common causes:
- Missing dependencies in requirements.txt
- Python version mismatch
- Syntax errors in code
```

#### 2. Migration Failures
**Symptom**: Application starts but migrations fail
```bash
# Check logs for migration errors
railway logs | grep -i alembic

# Manual migration if needed
railway run alembic upgrade head
```

#### 3. Admin User Issues
**Symptom**: Can't login with admin credentials
```bash
# Verify environment variables set correctly
railway variables

# Reset admin password
railway run python scripts/create_admin.py
```

#### 4. Database Connection Issues
**Symptom**: "Database not ready" errors
```bash
# Check DATABASE_URL format
# Should be: postgresql://user:pass@host:port/dbname

# Test connection
railway run python -c "
from sqlalchemy import create_engine
engine = create_engine('$DATABASE_URL')
engine.connect()
print('Connected!')
"
```

## Performance Optimization

### Database
- Ensure proper indexes exist
- Use connection pooling (configured by default)
- Monitor slow queries

### Redis Caching
- Add Redis service in Railway
- Set REDIS_URL environment variable
- Cache warms on startup

### Application
- Set appropriate WORKERS count
- Enable DATABASE_ECHO=false in production
- Use production log levels

## Security Checklist

- [ ] Strong SECRET_KEY set
- [ ] Admin password changed from default
- [ ] CORS properly configured
- [ ] Environment variables secured
- [ ] Database backups enabled
- [ ] SSL/TLS enabled (Railway provides)
- [ ] Rate limiting configured
- [ ] Audit logging enabled

## Backup and Recovery

### Database Backup
```bash
# Manual backup via Railway CLI
railway run pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
railway run psql $DATABASE_URL < backup_20250819.sql
```

### Migration Rollback
```bash
# Rollback last migration
railway run alembic downgrade -1

# Rollback to specific version
railway run alembic downgrade <revision>
```

## Monitoring

### Logs
- Real-time logs in Railway dashboard
- Download logs for analysis
- Set up log aggregation service

### Metrics
- CPU and memory usage in Railway dashboard
- Response time monitoring
- Error rate tracking

### Alerts
- Configure alerts in Railway
- Set up external monitoring (e.g., UptimeRobot)
- Database monitoring alerts

## Maintenance

### Regular Tasks
1. **Weekly**: Review logs for errors
2. **Monthly**: Database optimization
3. **Quarterly**: Security audit
4. **As needed**: Dependency updates

### Update Process
```bash
# Update dependencies
pip list --outdated
pip install --upgrade package_name

# Update requirements.txt
pip freeze > requirements.txt

# Test locally
pytest

# Deploy
git add requirements.txt
git commit -m "chore: update dependencies"
git push origin main
```

## Emergency Procedures

### Complete Reset
**⚠️ WARNING: Destroys all data!**
```bash
railway run python scripts/reset_and_migrate_production.py --production-reset
```

### Emergency Access
```bash
# Railway CLI shell access
railway shell

# Run commands directly
railway run [command]
```

### Disaster Recovery
1. Stop service in Railway dashboard
2. Restore database from backup
3. Reset migrations if needed
4. Redeploy last known good version
5. Verify functionality

## Support

### Railway Support
- Documentation: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

### Application Support
- Check `docs/` directory
- Review `CLAUDE.md` for development guidance
- Database migrations: `docs/DATABASE_MIGRATION_GUIDE.md`