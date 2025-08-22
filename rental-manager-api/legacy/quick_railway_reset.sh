#!/bin/bash
# Quick Railway Production Reset Script
# This script helps you reset your Railway production data

set -e

echo "================================================"
echo "    RAILWAY PRODUCTION DATA RESET"
echo "    Site: https://www.omomrentals.shop"
echo "================================================"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed."
    echo ""
    echo "Please install it first:"
    echo "  npm install -g @railway/cli"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✅ Railway CLI is installed"
echo ""

# Check if logged in
echo "Checking Railway login status..."
if ! railway whoami &> /dev/null; then
    echo "Please login to Railway first:"
    echo "  railway login"
    exit 1
fi

echo "✅ Logged in to Railway"
echo ""

# Prompt for confirmation
echo "⚠️  WARNING: This will DELETE ALL DATA from production!"
echo "⚠️  Site: https://www.omomrentals.shop"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Connecting to Railway production environment..."
echo ""

# Set to production environment
railway environment production

echo "Running reset script on Railway..."
echo ""

# Execute the reset command
# This will SSH into the Railway container and run the reset
railway run bash -c "cd /app && echo 'DELETE ALL DATA' | python scripts/reset_railway_production.py --production-reset --seed-master-data"

echo ""
echo "================================================"
echo "✅ RESET COMPLETE!"
echo "================================================"
echo ""
echo "The production data has been cleared and reinitialized."
echo ""
echo "Next steps:"
echo "1. Visit https://www.omomrentals.shop"
echo "2. Click 'Demo as Administrator' to login"
echo "3. Verify the system is working with fresh data"
echo ""
echo "Admin credentials have been reset to:"
echo "  Username: admin"
echo "  Password: K8mX#9vZ\$pL2@nQ7!wR4&dF6^sA1*uE3"
echo ""