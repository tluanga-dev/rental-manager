# Railway Production Data Reset Instructions

## ⚠️ PRODUCTION RESET FOR https://www.omomrentals.shop

This guide explains how to reset all data in your Railway production deployment.

## Option 1: Using Railway CLI (Recommended)

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login to Railway
```bash
railway login
```

### Step 3: Link to your project
```bash
railway link
# Select your project when prompted
```

### Step 4: Run the reset script in production
```bash
# Set production environment
railway environment production

# Execute the reset script
railway run python scripts/reset_railway_production.py --production-reset --seed-master-data
```

When prompted, type `DELETE ALL DATA` to confirm.

## Option 2: Using Railway Dashboard Console

1. Go to your Railway dashboard: https://railway.app
2. Navigate to your backend service
3. Click on the "Settings" tab
4. Find "Deploy" section
5. Click "Connect" to open a shell
6. Run these commands:

```bash
# Navigate to the app directory
cd /app

# Run the reset script
python scripts/reset_railway_production.py --production-reset --seed-master-data
```

## Option 3: Create a One-Time Reset Endpoint (Quick Solution)

### Step 1: Create a temporary reset endpoint
Create a new file `app/modules/admin/reset_route.py`:

```python
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import subprocess
from app.core.config import settings

router = APIRouter()
security = HTTPBearer()

@router.post("/reset-production-data")
async def reset_production_data(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Reset production data - DANGEROUS!
    Requires a special reset token.
    """
    # Check for special reset token
    RESET_TOKEN = os.getenv("RESET_TOKEN", "your-secret-reset-token-here")
    
    if credentials.credentials != RESET_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid reset token")
    
    try:
        # Run the reset script
        result = subprocess.run(
            ["python", "scripts/reset_railway_production.py", "--production-reset", "--seed-master-data"],
            input="DELETE ALL DATA\n",
            text=True,
            capture_output=True,
            timeout=60
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "Production data reset successfully",
                "output": result.stdout[-1000:]  # Last 1000 chars of output
            }
        else:
            return {
                "success": False,
                "message": "Reset failed",
                "error": result.stderr[-1000:]
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Step 2: Add the route to your main app
In `app/main.py`, add:

```python
from app.modules.admin import reset_route
app.include_router(reset_route.router, prefix="/api/admin", tags=["admin"])
```

### Step 3: Deploy and call the endpoint
```bash
# Set a reset token in Railway environment variables
RESET_TOKEN=your-very-secret-token-12345

# After deployment, call the endpoint
curl -X POST https://www.omomrentals.shop/api/admin/reset-production-data \
  -H "Authorization: Bearer your-very-secret-token-12345"
```

### Step 4: Remove the endpoint after use
**IMPORTANT**: Remove this endpoint after resetting to prevent accidental data loss.

## Option 4: Direct Database Commands (Most Direct)

### Using Railway Database Plugin

1. Go to Railway Dashboard
2. Click on your PostgreSQL database
3. Go to "Connect" tab
4. Copy the connection string
5. Use a PostgreSQL client (pgAdmin, TablePlus, psql) to connect
6. Run these SQL commands:

```sql
-- WARNING: This will DELETE ALL DATA!

-- Disable foreign key checks
SET session_replication_role = 'replica';

-- Clear all tables (in order)
TRUNCATE TABLE rental_lifecycle CASCADE;
TRUNCATE TABLE transaction_metadata CASCADE;
TRUNCATE TABLE transaction_events CASCADE;
TRUNCATE TABLE transaction_lines CASCADE;
TRUNCATE TABLE transaction_headers CASCADE;
TRUNCATE TABLE stock_movements CASCADE;
TRUNCATE TABLE stock_levels CASCADE;
TRUNCATE TABLE inventory_units CASCADE;
TRUNCATE TABLE items CASCADE;
TRUNCATE TABLE categories CASCADE;
TRUNCATE TABLE brands CASCADE;
TRUNCATE TABLE units_of_measurement CASCADE;
TRUNCATE TABLE locations CASCADE;
TRUNCATE TABLE suppliers CASCADE;
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE companies CASCADE;
TRUNCATE TABLE system_settings CASCADE;
TRUNCATE TABLE audit_logs CASCADE;

-- Clear auth tables if needed
TRUNCATE TABLE user_permissions CASCADE;
TRUNCATE TABLE role_permissions CASCADE;
TRUNCATE TABLE user_roles CASCADE;
TRUNCATE TABLE permissions CASCADE;
TRUNCATE TABLE roles CASCADE;
TRUNCATE TABLE users CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Verify all tables are empty
SELECT table_name, 
       (xpath('/row/cnt/text()', 
       xml_count))[1]::text::int as row_count
FROM (
  SELECT table_name, 
         query_to_xml(format('select count(*) as cnt from %I.%I', 
         table_schema, table_name), 
         false, true, '') as xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
) t
ORDER BY row_count DESC;
```

After clearing, the application will reinitialize with admin user on next restart.

## Option 5: Trigger Automatic Reinitialization

### Force Railway to Reinitialize

1. In Railway Dashboard, go to your backend service
2. Go to Variables tab
3. Add/Update these environment variables:
```
FORCE_RESET=true
SEED_MASTER_DATA=true
```

4. Modify your `start-production.sh` to check for reset flag:
```bash
if [[ "${FORCE_RESET}" == "true" ]]; then
    echo "Force reset requested..."
    echo "DELETE ALL DATA" | python scripts/reset_railway_production.py --production-reset --seed-master-data
    # Remove the flag after reset
    unset FORCE_RESET
fi
```

5. Trigger a new deployment by pushing any small change to git

## After Reset

Once the data is cleared, the system will automatically:
1. Create admin user with credentials from environment variables
2. Set up RBAC roles and permissions
3. Initialize system settings
4. Create default company
5. Seed master data (if requested)

### Default Admin Credentials
Make sure these are set in Railway environment variables:
```
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@omomrentals.shop
ADMIN_PASSWORD=K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3
ADMIN_FULL_NAME=System Administrator
```

## Verification

After reset, verify at https://www.omomrentals.shop:
1. All old data is gone
2. Can login with admin credentials
3. Demo buttons work
4. System is initialized with basic data

## Safety Notes

⚠️ **WARNING**: These operations will DELETE ALL PRODUCTION DATA!
- Always backup your database before resetting
- Consider exporting important data first
- Test in staging environment if available
- Remove any temporary reset endpoints after use