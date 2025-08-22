# Vercel Deployment Configuration

## Required Environment Variables

**IMPORTANT**: These environment variables MUST be set in the Vercel Dashboard for the application to work correctly.

### 1. Backend API URL (REQUIRED)

In your Vercel project dashboard:
1. Go to **Settings** → **Environment Variables**
2. Add the following:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://rental-manager-backend-production.up.railway.app/api` | Production, Preview, Development |

### 2. After Setting Variables

After adding the environment variable:
1. Go to the **Deployments** tab
2. Redeploy the latest deployment
3. Wait for the deployment to complete

## Verification

After deployment, verify the configuration:
1. Open your deployed application
2. Open browser DevTools (F12)
3. Check the Console - you should NOT see any `localhost:8000` errors
4. The app should connect to the Railway backend

## Troubleshooting

If you still see localhost errors after setting the environment variable:

1. **Clear browser cache** and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check deployment logs** in Vercel to ensure the variable is being picked up
3. **Verify the Railway backend is running** at https://rental-manager-backend-production.up.railway.app/docs
4. **Check CORS settings** - ensure your Vercel domain is allowed in the Railway backend

## Local Development

For local development, the app will use the `.env.local` file which should contain:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Production Build Test

To test the production build locally:
```bash
npm run build:prod
npm run start:prod
```

This will use the `.env.production` file settings.

## Important Notes

- Environment variables starting with `NEXT_PUBLIC_` are exposed to the browser
- Changes to environment variables require a **redeploy** to take effect
- Vercel does NOT automatically read `.env.production` files - you must set variables in the dashboard