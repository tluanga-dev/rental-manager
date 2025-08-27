# Development Authentication Bypass Setup

## Overview

This system allows you to disable authentication and RBAC in development environments while maintaining full security in production. When enabled, all requests are treated as authenticated superuser requests with full permissions.

## Configuration

### Backend Configuration

**Environment Variables (.env)**:
```bash
# Development Settings
ENVIRONMENT=development
DEBUG=true
DISABLE_AUTH_IN_DEV=true
DEV_MOCK_USER_ID=dev-user-1
DEV_MOCK_USER_EMAIL=dev@example.com
DEV_MOCK_USER_ROLE=ADMIN

# Production Settings (when ENVIRONMENT=production)
ENVIRONMENT=production
DEBUG=false
DISABLE_AUTH_IN_DEV=false  # Ignored in production
```

### Frontend Configuration

**Environment Variables (.env.development)**:
```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Development-specific settings
NEXT_PUBLIC_DEBUG_MODE=true

# Authentication Bypass for Development
NEXT_PUBLIC_DISABLE_AUTH=true
NEXT_PUBLIC_MOCK_USER_ROLE=ADMIN
NEXT_PUBLIC_DEV_MODE=true
NEXT_PUBLIC_BYPASS_RBAC=true
```

## How It Works

### Backend

1. **Configuration Check**: The system checks if `ENVIRONMENT=development`, `DEBUG=true`, and `DISABLE_AUTH_IN_DEV=true`
2. **Dependency Bypass**: Authentication dependencies return a mock user instead of validating JWT tokens
3. **Mock User**: All requests are treated as coming from a superuser with full permissions
4. **Development Endpoints**: Special endpoints like `/dev-login` and `/dev-status` are available

### Frontend

1. **Environment Detection**: Checks `NODE_ENV=development` and `NEXT_PUBLIC_DISABLE_AUTH=true`
2. **Auth Store Bypass**: Automatically creates a mock authenticated user on app initialization
3. **API Client Bypass**: Sends mock authorization headers and bypasses 401 errors
4. **Full Permissions**: Mock user has all possible permissions for unrestricted access

## Security Features

### Development Safety
- Multiple environment checks before enabling bypass
- Clear console warnings when authentication is disabled
- Mock tokens that don't work in production
- Request validation ensures bypass only works in development

### Production Protection
- Environment validation with fail-safe mechanisms
- Configuration validation ensures production configs are secure
- Automatic disabling when `ENVIRONMENT` is not `development`
- Production deployment checks validate security settings

## Usage Instructions

### Enable Development Mode

1. **Backend Setup**:
   ```bash
   cd rental-manager-api
   
   # Create or update .env file
   echo "ENVIRONMENT=development" >> .env
   echo "DEBUG=true" >> .env
   echo "DISABLE_AUTH_IN_DEV=true" >> .env
   
   # Start backend
   make up
   ```

2. **Frontend Setup**:
   ```bash
   cd rental-manager-frontend
   
   # Environment variables are already set in .env.development
   
   # Start frontend
   npm run dev
   ```

3. **Verify Setup**:
   - Backend: Visit `http://localhost:8000/api/v1/auth/dev-status`
   - Frontend: Check browser console for development mode messages
   - Both should show authentication bypass is enabled

### Disable Development Mode

1. **Backend**:
   ```bash
   # Update .env file
   ENVIRONMENT=production  # or remove DISABLE_AUTH_IN_DEV=true
   DEBUG=false
   DISABLE_AUTH_IN_DEV=false
   ```

2. **Frontend**:
   ```bash
   # Create .env.production.local or update .env.development
   NEXT_PUBLIC_DISABLE_AUTH=false
   ```

## Testing the Setup

### Development Mode Tests

1. **Backend Authentication Bypass**:
   ```bash
   # Test dev status endpoint
   curl http://localhost:8000/api/v1/auth/dev-status
   
   # Test dev login endpoint
   curl -X POST http://localhost:8000/api/v1/auth/dev-login
   
   # Test protected endpoint without auth
   curl http://localhost:8000/api/v1/customers
   ```

2. **Frontend Authentication Bypass**:
   - Open `http://localhost:3000`
   - Should automatically be logged in as "Development User"
   - Check browser console for development mode messages
   - Try accessing admin features - should work without authentication

3. **Full System Integration**:
   - Create, read, update, delete operations should work without login
   - All API endpoints should be accessible
   - No authentication prompts should appear

### Production Mode Tests

1. **Ensure Authentication Required**:
   - Set `ENVIRONMENT=production` in backend
   - Set `NEXT_PUBLIC_DISABLE_AUTH=false` in frontend
   - Restart both services
   - Verify authentication is required for all endpoints

## Development Endpoints

When authentication bypass is enabled, additional endpoints are available:

- **GET `/api/v1/auth/dev-status`**: Shows development configuration status
- **POST `/api/v1/auth/dev-login`**: Returns mock authentication tokens
- These endpoints return 404 when bypass is disabled

## Console Messages

### Development Mode Enabled
```
🚨 DEVELOPMENT MODE WARNING 🚨
Authentication and RBAC are DISABLED!
All requests will be treated as authenticated superuser.
This should NEVER happen in production!
Environment: development
Debug: true
Auth Disabled: true
```

### Frontend Development Mode
```
🚨 Development Mode: Authentication bypass enabled
🚨 Development Mode: Mock user authenticated with full permissions
🚨 Development Mode: Bypassing 401 authentication error
```

## Troubleshooting

### Common Issues

1. **Authentication still required in development**:
   - Check environment variables are set correctly
   - Verify `ENVIRONMENT=development` and `DEBUG=true` in backend
   - Verify `NEXT_PUBLIC_DISABLE_AUTH=true` in frontend
   - Restart both services after changing environment variables

2. **Console warnings about production mode**:
   - This is normal - the system is warning you that auth is disabled
   - These warnings ensure you're aware of the security implications

3. **Endpoints still return 401 errors**:
   - Check that backend bypass is working: `curl http://localhost:8000/api/v1/auth/dev-status`
   - Verify frontend API client is sending mock auth headers
   - Check browser network tab for request headers

4. **Production accidentally has auth disabled**:
   - The system has multiple safeguards against this
   - Check environment variables: `ENVIRONMENT` should be `production`
   - If `ENVIRONMENT` is not `development`, auth bypass is automatically disabled

## Production Deployment Checklist

Before deploying to production, ensure:

- [ ] `ENVIRONMENT=production` in backend environment
- [ ] `DEBUG=false` in backend environment
- [ ] `DISABLE_AUTH_IN_DEV=false` or remove this variable
- [ ] `NEXT_PUBLIC_DISABLE_AUTH=false` or remove this variable in frontend
- [ ] No development environment files (`.env.development`) are used in production
- [ ] Test authentication is working by accessing protected endpoints
- [ ] Development endpoints return 404 errors

## Architecture Details

### Files Modified

**Backend**:
- `app/core/config.py` - Added development configuration options
- `app/core/dev_auth_bypass.py` - Development authentication bypass module
- `app/api/deps.py` - Updated dependencies for auth bypass
- `app/api/v1/endpoints/auth.py` - Added development endpoints

**Frontend**:
- `.env.development` - Added development environment variables
- `src/stores/auth-store.ts` - Added development mode authentication bypass
- `src/lib/axios.ts` - Updated API client for development mode bypass
- `src/hooks/use-auth-init.ts` - Initialize development mode on app start

### Security Architecture

The bypass system uses multiple layers of protection:

1. **Environment Validation**: Multiple checks ensure we're in development
2. **Configuration Validation**: Settings are validated before enabling bypass
3. **Request Validation**: Each request is checked for bypass eligibility
4. **Production Safeguards**: Fail-safe mechanisms prevent accidental production bypass
5. **Logging and Warnings**: Clear indicators when bypass is active

This comprehensive system provides a safe way to disable authentication during development while maintaining security in production environments.