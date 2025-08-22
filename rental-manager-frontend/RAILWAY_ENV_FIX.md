# Railway Environment Variable Fix

## Problem
The Database Management page shows "Disconnected" and API calls return 404 because the frontend is not using the correct backend API URL in production.

## Root Cause
The `NEXT_PUBLIC_API_URL` environment variable is not being set during the Railway build process, causing the frontend to use the default `http://localhost:8000/api` instead of `https://rental-manager-backend-production.up.railway.app/api`.

## Solution

### IMMEDIATE FIX REQUIRED IN RAILWAY DASHBOARD

1. Go to Railway Dashboard
2. Select the **rental-manager-frontend** service
3. Go to **Variables** tab
4. Add the following environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://rental-manager-backend-production.up.railway.app/api
   ```
5. Trigger a new deployment (or push a commit to trigger automatic deployment)

### Why This Happens
Next.js bakes environment variables starting with `NEXT_PUBLIC_` into the build at compile time. If the variable is not set during the build process on Railway, it uses the fallback value which is `http://localhost:8000/api`.

### Verification
After setting the environment variable and redeploying:
1. Visit https://www.omomrentals.shop/admin/database
2. The page should show "Connected" status
3. Tables and database information should load properly

## Alternative Fix (if Railway dashboard access is not available)

Update the `.env.production` file to hardcode the value and commit it:

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://rental-manager-backend-production.up.railway.app/api
```

Then push the change to trigger a new deployment.

## Important Notes
- This environment variable MUST be set at build time, not runtime
- The variable name MUST start with `NEXT_PUBLIC_` to be accessible in the browser
- After setting the variable, a full rebuild and redeploy is required