# Railway Deployment Guide

This guide provides comprehensive instructions for deploying the Rental Manager Backend to Railway.

## Prerequisites

1. A Railway account with a project created
2. PostgreSQL and Redis services provisioned in Railway
3. Git repository connected to Railway

## Environment Variables

### Required Variables

Configure these in your Railway service settings:

```bash
# Database (auto-provided by Railway PostgreSQL)
DATABASE_URL=postgresql+asyncpg://user:password@host:port/database

# Security
SECRET_KEY=your-very-long-secure-random-string-min-32-chars

# Admin User Configuration
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=YourSecure@Password123!
ADMIN_FULL_NAME=System Administrator
```

### Optional Variables

```bash
# Redis (auto-provided by Railway Redis)
REDIS_URL=redis://default:password@host:port

# Server Configuration
PORT=8000                    # Railway auto-sets this
WORKERS=4                    # Number of Gunicorn workers
LOG_LEVEL=INFO              # Logging level

# Application Settings
DEBUG=false
ALLOWED_ORIGINS=https://yourdomain.com
USE_WHITELIST_CONFIG=true

# Performance
DATABASE_POOL_SIZE=20
DATABASE_POOL_MAX_OVERFLOW=0
CACHE_ENABLED=true
```

## Deployment Steps

### 1. Initial Setup

1. **Connect your repository to Railway:**
   ```bash
   railway link
   ```

2. **Set environment variables in Railway dashboard:**
   - Go to your service settings
   - Add all required environment variables
   - Railway automatically provides DATABASE_URL and REDIS_URL

### 2. Database Setup

The application automatically handles:
- Database migrations
- Admin user creation
- RBAC permissions setup
- System settings initialization

### 3. Deploy

Railway automatically deploys when you push to your connected branch:

```bash
git add .
git commit -m "Deploy to Railway"
git push origin main
```

### 4. Monitor Deployment

1. **Check deployment logs:**
   ```bash
   railway logs
   ```

2. **Verify health check:**
   ```bash
   curl https://your-app.railway.app/api/health
   ```

3. **Validate admin user:**
   ```bash
   curl -X POST https://your-app.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"YourPassword"}'
   ```

## Configuration Files

### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.railway"
  },
  "deploy": {
    "startCommand": "./start-production.sh",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Dockerfile.railway
- Multi-stage build for optimized image size
- Non-root user for security
- Health checks configured
- All dependencies pre-installed

## Troubleshooting

### Common Issues

1. **Health check failing:**
   - Check DATABASE_URL is properly formatted
   - Ensure migrations completed successfully
   - Verify Redis connection if CACHE_ENABLED=true

2. **Admin user not created:**
   - Check ADMIN_* environment variables are set
   - Verify password meets security requirements
   - Check logs for creation errors

3. **Application not starting:**
   - Validate all required environment variables
   - Check for migration errors in logs
   - Ensure PostgreSQL service is running

### Validation Script

Run the validation script locally to test your environment:

```bash
export DATABASE_URL=your-database-url
export SECRET_KEY=your-secret-key
# ... set other variables ...

python scripts/validate_environment.py
```

### Debug Commands

```bash
# View recent logs
railway logs --tail 100

# Check environment variables
railway variables

# Restart service
railway restart

# Run command in deployed environment
railway run python scripts/validate_admin.py
```

## Performance Optimization

1. **Adjust worker count based on dyno size:**
   - 1 vCPU: 2-3 workers
   - 2 vCPU: 4-6 workers

2. **Enable Redis caching:**
   - Provision Redis service in Railway
   - Set CACHE_ENABLED=true
   - Cache warms automatically on startup

3. **Database connection pooling:**
   - Adjust DATABASE_POOL_SIZE based on worker count
   - Formula: pool_size = 20 / worker_count

## Security Best Practices

1. **Environment Variables:**
   - Never commit secrets to repository
   - Use Railway's environment variable management
   - Rotate SECRET_KEY periodically

2. **Admin User:**
   - Change default admin password immediately
   - Use strong, unique passwords
   - Enable 2FA when available

3. **CORS Configuration:**
   - Set specific ALLOWED_ORIGINS
   - Use whitelist.json for fine-grained control
   - Avoid wildcard origins in production

## Maintenance

### Database Migrations

New migrations are automatically applied on deployment. To run manually:

```bash
railway run alembic upgrade head
```

### Backup Database

```bash
railway run pg_dump $DATABASE_URL > backup.sql
```

### Update Dependencies

1. Update requirements.txt
2. Test locally
3. Push to trigger deployment

## Support

For Railway-specific issues:
- Railway documentation: https://docs.railway.app
- Railway community: https://discord.gg/railway

For application issues:
- Check logs: `railway logs`
- Validate environment: `railway run python scripts/validate_environment.py`
- Test endpoints: Use the Swagger UI at `/docs`