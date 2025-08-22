# Railway Production Database Reset Guide

## Overview

This guide documents the Railway production database and Redis cache reset functionality. The reset scripts provide a controlled way to completely clear and reinitialize your Railway production database.

## ⚠️ WARNING

**These scripts will DELETE ALL DATA from your production database and Redis cache!**

Always ensure you have a complete backup before running these scripts in production.

## Scripts

### 1. `scripts/reset_railway_production.py`
The main Python script that handles the database and Redis reset operations.

### 2. `reset_railway.sh`
A convenient wrapper script that provides an easier interface for the reset operation.

## Usage

### Quick Start

```bash
# Navigate to backend directory
cd rental-manager-backend

# Dry run - preview what will be deleted
./reset_railway.sh --dry-run

# Full production reset (requires confirmation)
./reset_railway.sh --production

# Reset and seed with master data
./reset_railway.sh --production --seed-data
```

### Python Script Direct Usage

```bash
# Dry run mode
python scripts/reset_railway_production.py --dry-run

# Production reset with confirmation
python scripts/reset_railway_production.py --production-reset

# Reset with master data seeding
python scripts/reset_railway_production.py --production-reset --seed-master-data
```

## What Gets Reset

### Database Tables Cleared (in order):
1. **Analytics & Monitoring**: system_alerts, business_metrics, analytics_reports
2. **System Module**: audit_logs, system_backups, system_settings
3. **Rentals Module**: inspection_reports, rental_returns, rental_lifecycle
4. **Transactions**: All transaction headers, lines, events, metadata
5. **Inventory**: stock_movements, stock_levels, inventory_units
6. **Master Data**: items, locations, units, brands, categories
7. **Business Partners**: suppliers, customers
8. **Company**: companies
9. **Authentication**: users, roles, permissions (will be recreated)

### Redis Cache
- All keys are flushed from Redis
- Cache is completely cleared

## What Gets Recreated

After clearing, the following are automatically recreated:

1. **Admin User**
   - Created from environment variables (ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD)
   - Full superuser permissions

2. **RBAC System**
   - Default roles: admin, manager, operator, viewer
   - All resource permissions
   - Role-permission mappings

3. **System Settings**
   - Timezone, currency, date/time formats
   - Rental configuration (grace periods, fees)
   - Default business rules

4. **Company**
   - Default company record

5. **Master Data** (optional with --seed-data flag)
   - Brands, categories, units of measurement
   - Locations
   - Sample items

## Environment Variables Required

```bash
# Database connection (required)
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# Redis connection (optional but recommended)
REDIS_URL=redis://host:6379

# Admin user configuration
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@company.com
ADMIN_PASSWORD=SecurePassword123!
ADMIN_FULL_NAME="System Administrator"

# Company configuration
COMPANY_NAME="Your Company Name"
```

## Safety Features

### Multiple Confirmations
1. First confirmation: Type "DELETE ALL DATA"
2. Second confirmation: 5-second countdown with Ctrl+C to cancel
3. Environment check: Warns if not in Railway environment

### Dry Run Mode
- Preview all operations without making changes
- Shows record counts for all tables
- Simulates the entire process

### Transaction Safety
- All database operations are wrapped in transactions
- Automatic rollback on any error
- Foreign key constraints temporarily disabled during clearing

### Detailed Logging
- Color-coded output for clarity
- Progress indicators for large operations
- Summary report with statistics
- Verification of operations

## Railway Deployment Integration

### Automatic Service Restart
The script can trigger a Railway service restart if the Railway CLI is installed:

```bash
# Install Railway CLI (if not already installed)
npm install -g @railway/cli

# Login to Railway
railway login

# The reset script will offer to restart the service after completion
```

### Manual Restart
If automatic restart is not available, restart manually from Railway dashboard:
1. Go to your Railway project
2. Navigate to the backend service
3. Click "Restart" or trigger a new deployment

## Recovery Procedures

### If Reset Fails

1. **Check Logs**: Review the error messages in the terminal output
2. **Database Connection**: Verify DATABASE_URL is correct
3. **Permissions**: Ensure database user has TRUNCATE permissions
4. **Rollback**: The script uses transactions, so partial changes are rolled back

### Manual Recovery Steps

If automated recovery fails:

```bash
# 1. Connect to database manually
psql $DATABASE_URL

# 2. Check table states
\dt

# 3. Manually run initialization scripts
python scripts/init_production.py
python scripts/seed_rbac.py
python scripts/init_system_settings.py
```

## Best Practices

### Before Running Reset

1. **Create Backup**
   ```bash
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Notify Team**
   - Inform all stakeholders
   - Schedule during maintenance window

3. **Test in Staging**
   - Run dry-run first
   - Test in staging environment if available

### After Reset

1. **Verify Admin Access**
   ```bash
   # Test admin login
   curl -X POST https://your-api.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"your-password"}'
   ```

2. **Check Critical Tables**
   - Verify users table has admin user
   - Confirm roles and permissions exist
   - Check system_settings populated

3. **Monitor Application**
   - Watch application logs
   - Test critical functionality
   - Monitor error rates

## Troubleshooting

### Common Issues

**Issue**: "DATABASE_URL not set"
- **Solution**: Export the environment variable or add to .env file

**Issue**: "Permission denied for TRUNCATE"
- **Solution**: Ensure database user has sufficient privileges

**Issue**: "Redis connection failed"
- **Solution**: Redis is optional; the script will continue without it

**Issue**: "Admin user creation failed"
- **Solution**: Check ADMIN_* environment variables are set correctly

**Issue**: "Railway CLI not found"
- **Solution**: Install with `npm install -g @railway/cli` or restart manually

## Security Considerations

1. **Never commit credentials**: Keep environment variables secure
2. **Restrict access**: Only authorized personnel should have reset capability
3. **Audit trail**: All resets are logged with timestamps
4. **Backup verification**: Always verify backup integrity before reset

## Support

For issues or questions:
1. Check the error messages and logs
2. Review this documentation
3. Consult the main project README
4. Contact the development team

## Version History

- **v1.0.0** (2024-01): Initial reset functionality
- Comprehensive database and Redis clearing
- Automatic reinitialization
- Safety features and confirmations