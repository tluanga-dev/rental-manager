# Admin Setup Guide

This guide covers setting up admin user credentials for different deployment scenarios in the Rental Manager system.

## Overview

The admin user is automatically created from environment variables during application startup. This ensures:
- Secure credential management
- Consistent setup across environments
- No hardcoded passwords in source code
- Automated initialization

## Environment Variables

### Required Admin Settings

```bash
ADMIN_USERNAME=admin                    # Admin login username
ADMIN_EMAIL=admin@admin.com            # Admin email address
ADMIN_PASSWORD=your-secure-password     # Admin password
ADMIN_FULL_NAME=System Administrator   # Display name
```

### Password Requirements

The admin password must meet these security requirements:
- **Minimum 8 characters** (recommended: 32+ characters)
- **Uppercase letters** (A-Z)
- **Lowercase letters** (a-z)
- **Numbers** (0-9)  
- **Special characters** (!@#$%^&*()-_=+[]{}|;:,.<>?)

### Username Requirements

The admin username must meet these requirements:
- **3-50 characters** in length
- **Letters, numbers, and underscores only** (a-zA-Z0-9_)
- No spaces or special characters

### Email Requirements

The admin email must be a valid email format:
- **Valid email format** (user@domain.com)

## Deployment Scenarios

### 1. Local Development (No Docker)

#### Initial Setup

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env file with your admin credentials
nano .env  # or your preferred editor

# 3. Update admin settings in .env:
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourSecure@Password123!
ADMIN_FULL_NAME=System Administrator

# 4. Run initialization script
python scripts/init_local_dev.py

# 5. Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Daily Development

```bash
# Start the server (admin user already exists)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Validation

```bash
# Test admin user setup
python scripts/validate_admin.py
```

### 2. Railway Production Deployment

#### Environment Variables Setup

1. **In Railway Dashboard:**
   - Go to your project
   - Navigate to Variables tab
   - Add the following environment variables:

```bash
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=YourSecure@ProductionPassword123!
ADMIN_FULL_NAME=System Administrator
```

2. **Deploy:**
   - Railway automatically deploys when you push to your connected Git repository
   - The `start-production.sh` script automatically creates the admin user from environment variables

#### Railway Deployment Validation

The startup logs will show:
```
Creating admin user from environment variables
Admin Username: admin
Admin Email: admin@yourcompany.com
Admin Full Name: System Administrator
✓ Admin user creation completed successfully
✓ Admin user validation passed
```

## Security Best Practices

### Password Generation

Generate secure passwords using:

```bash
# Option 1: OpenSSL (32 characters)
openssl rand -base64 32

# Option 2: Python
python -c "import secrets, string; chars=string.ascii_letters+string.digits+'!@#$%^&*()-_=+[]{}|;:,.<>?'; print(''.join(secrets.choice(chars) for _ in range(32)))"

# Option 3: Use existing secure password
# Use the current secure password: K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3
```

### Environment Variable Security

#### Local Development
- Keep `.env` file in `.gitignore`
- Never commit `.env` files to version control
- Use different passwords for development and production

#### Production (Railway)
- Store credentials in Railway dashboard environment variables
- Use unique, strong passwords for production
- Regularly rotate passwords (every 90 days recommended)

## Troubleshooting

### Common Issues

#### 1. Configuration Validation Errors

**Error:** `Admin password must contain uppercase, lowercase, number, and special character`

**Solution:** Update your password to meet all requirements:
```bash
# Example of valid password
ADMIN_PASSWORD=MySecure@Password123!
```

#### 2. Database Connection Failed

**Error:** `Database connection failed`

**Solution:** 
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in your `.env` file
- Verify database credentials

#### 3. Admin User Already Exists

**Message:** `Admin user with username 'admin' already exists. Skipping creation.`

**This is normal** - the system is designed to be idempotent. The admin user was already created.

#### 4. Admin User Not Found

**Error:** `Admin user 'admin' not found in database`

**Solutions:**
```bash
# Recreate admin user
python scripts/create_admin.py

# Or run full initialization
python scripts/init_local_dev.py
```

### Validation Commands

#### Check Admin Configuration
```bash
python scripts/validate_admin.py
```

#### Test Admin Creation
```bash
python scripts/test_admin_creation.py
```

#### Manual Admin Creation
```bash
python scripts/create_admin.py
```

### Logs and Debugging

#### Check Application Logs
```bash
# Local development
tail -f logs/app.log

# Railway production
railway logs --tail
```

#### Verify Admin in Database
```bash
# Connect to database and check
psql $DATABASE_URL -c "SELECT username, email, full_name, is_active, is_superuser FROM users WHERE username='admin';"
```

## API Usage

### Login with Admin Credentials

```bash
# Test admin login via API
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-admin-password"
  }'
```

### Access Protected Endpoints

```bash
# Get access token first
TOKEN=$(curl -s -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | \
  jq -r '.access_token')

# Use token for protected endpoints
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/auth/me"
```

## Frontend Integration

The admin credentials work with the frontend demo login buttons:

```typescript
// Frontend demo credentials (from login form)
const credentials = {
  admin: { 
    username: 'admin', 
    password: 'your-admin-password' 
  }
};
```

## Migration from Old System

If migrating from email-based to username-based authentication:

1. **Update Environment Variables:**
   ```bash
   # Change from
   ADMIN_EMAIL=admin@admin.com
   
   # To include both
   ADMIN_USERNAME=admin
   ADMIN_EMAIL=admin@admin.com
   ```

2. **Update Frontend:**
   - Login forms should use `username` instead of `email`
   - Update validation schemas

3. **Test Migration:**
   ```bash
   python scripts/validate_admin.py
   ```

## Multiple Environments

### Development
```bash
ADMIN_USERNAME=dev_admin
ADMIN_EMAIL=dev.admin@company.com
ADMIN_PASSWORD=Dev@Password123!
ADMIN_FULL_NAME=Development Administrator
```

### Staging
```bash
ADMIN_USERNAME=staging_admin
ADMIN_EMAIL=staging.admin@company.com
ADMIN_PASSWORD=Staging@Password123!
ADMIN_FULL_NAME=Staging Administrator
```

### Production
```bash
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@company.com
ADMIN_PASSWORD=Production@SecurePassword123!
ADMIN_FULL_NAME=System Administrator
```

## Support

If you encounter issues:

1. **Check logs** for specific error messages
2. **Run validation scripts** to identify problems
3. **Verify environment variables** are set correctly
4. **Ensure database connectivity**
5. **Test with simple credentials** first

For additional support, check the main [CLAUDE.md](../CLAUDE.md) documentation.