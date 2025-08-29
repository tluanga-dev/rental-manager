# Development Mode with Authentication Bypass - Now Default!

## Overview
Development mode with authentication bypass is now the **DEFAULT CONFIGURATION** for the Rental Manager application. This means developers can start working immediately without dealing with authentication during development.

## 🚀 Quick Start

### Using Docker Compose (Recommended)
```bash
# Just run - auth bypass is already configured!
docker-compose up -d
```

### Manual Development
```bash
# Backend (auth bypass enabled by default)
cd rental-manager-api
make dev

# Frontend (auth bypass enabled by default)
cd rental-manager-frontend
npm run dev
```

**That's it!** Visit http://localhost:3000 and you'll bypass authentication automatically.

## 📋 Default Configuration

### Backend Defaults (.env)
```env
ENVIRONMENT=development       # Default
DEBUG=true                   # Default
DISABLE_AUTH_IN_DEV=true     # Default - Auth bypass ENABLED
DEV_MOCK_USER_ID=dev-user-1
DEV_MOCK_USER_EMAIL=dev@example.com
DEV_MOCK_USER_ROLE=ADMIN
```

### Frontend Defaults (.env.development)
```env
NEXT_PUBLIC_DISABLE_AUTH=true     # Default - Auth bypass ENABLED
NEXT_PUBLIC_MOCK_USER_ROLE=ADMIN  
NEXT_PUBLIC_DEV_MODE=true        
NEXT_PUBLIC_BYPASS_RBAC=true     
NEXT_PUBLIC_DEBUG_MODE=true      
```

### Docker Compose Defaults
Both services in `docker-compose.yml` now include these environment variables by default, ensuring auth bypass works out of the box.

## 🔒 Requiring Authentication in Development

If you need to test with real authentication in development:

### Option 1: Environment Variables
```bash
# Backend - Set in .env
DISABLE_AUTH_IN_DEV=false

# Frontend - Set in .env.development
NEXT_PUBLIC_DISABLE_AUTH=false
```

### Option 2: Docker Compose Override
Create a `docker-compose.override.yml`:
```yaml
version: '3.9'
services:
  rental-manager-api:
    environment:
      - DISABLE_AUTH_IN_DEV=false
  
  rental-manager-frontend:
    environment:
      - NEXT_PUBLIC_DISABLE_AUTH=false
```

## 🚢 Production Deployment

### Automatic Production Safety
The application automatically disables auth bypass in production through multiple safeguards:

1. **Environment Detection**: When `ENVIRONMENT=production`, auth bypass is disabled
2. **Production Config Files**: `.env.production` explicitly sets auth requirements
3. **Docker Production**: `docker-compose.prod.yml` enforces authentication

### Production Deployment Commands
```bash
# Using production docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Or with production environment files
cp .env.production .env
docker-compose up -d
```

### Production Environment Files

#### Backend (.env.production)
```env
ENVIRONMENT=production
DEBUG=false
DISABLE_AUTH_IN_DEV=false  # Enforced
```

#### Frontend (.env.production)
```env
NEXT_PUBLIC_DISABLE_AUTH=false  # Enforced
NEXT_PUBLIC_DEV_MODE=false
NEXT_PUBLIC_BYPASS_RBAC=false
```

## 🎯 Development Workflow

### Default Development Experience
1. Clone the repository
2. Run `docker-compose up -d`
3. Visit http://localhost:3000
4. You're logged in as admin - start developing!

### What You Get
- ✅ No login screens
- ✅ All permissions granted
- ✅ No RBAC restrictions
- ✅ Visual development mode banner
- ✅ Mock user: admin@example.com (SUPERADMIN)

### Visual Indicators
When auth bypass is active, you'll see:
- Yellow/orange banner at the top: "🚨 DEVELOPMENT MODE - AUTHENTICATION BYPASSED"
- User info showing: "Development User (ADMIN)"
- Badge showing "DEV" mode

## 📊 Configuration Matrix

| Environment | Auth Required | Config File | Docker Compose |
|------------|--------------|-------------|----------------|
| Development | ❌ No (Default) | .env | docker-compose.yml |
| Development (Testing Auth) | ✅ Yes | .env with `DISABLE_AUTH_IN_DEV=false` | docker-compose.override.yml |
| Production | ✅ Always | .env.production | docker-compose.prod.yml |

## 🛠️ Troubleshooting

### Auth Bypass Not Working?

1. **Check Environment Variables**
   ```bash
   # Backend
   curl http://localhost:8000/api/v1/auth/dev-status
   
   # Should return:
   {
     "environment": "development",
     "debug": true,
     "auth_disabled": true,  # Must be true
     "development_mode": true
   }
   ```

2. **Check Frontend Console**
   - Open browser DevTools
   - Look for: "🔓 Development mode detected - bypassing authentication"
   - If you see "⚠️ Development mode detected but authentication bypass is not enabled", check env vars

3. **Restart Services**
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### Want Real Authentication in Dev?
```bash
# Quick toggle
export DISABLE_AUTH_IN_DEV=false
export NEXT_PUBLIC_DISABLE_AUTH=false
docker-compose up -d
```

## 🔐 Security Notes

### Multiple Safeguards
1. **Environment Check**: Only works when `ENVIRONMENT=development`
2. **Debug Check**: Requires `DEBUG=true`
3. **Explicit Flag**: Needs `DISABLE_AUTH_IN_DEV=true`
4. **Visual Warnings**: Clear banners when bypass is active
5. **Production Override**: Production configs explicitly disable bypass

### Best Practices
- ✅ Use auth bypass for feature development
- ✅ Test with real auth before deploying
- ✅ Never set production `ENVIRONMENT=development`
- ✅ Always use `.env.production` for production deployments
- ✅ Review environment variables before deployment

## 📚 Additional Resources

- [Full Implementation Details](./DEV_AUTH_BYPASS_IMPLEMENTATION.md)
- [Backend API Docs](http://localhost:8000/docs) 
- [Frontend Dev Tools](http://localhost:3000) - Look for Dev Tools panel

## Summary

Development mode with authentication bypass is now the default, making development faster and more enjoyable. The system is designed to be:

- **Zero-friction** in development (default bypass)
- **Flexible** when you need real auth (easy toggle)
- **Secure** in production (automatic enforcement)
- **Visible** about its state (clear indicators)

Just run `docker-compose up -d` and start coding!