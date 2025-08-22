#!/bin/bash
set -e

echo "🚀 Starting Rental Manager Backend Production Server"
echo "=================================================="

# Check environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

echo "✅ Environment variables verified"

# Run database migrations
echo "📦 Running database migrations..."
alembic upgrade head || {
    echo "⚠️ Migration failed, but continuing (database might already be up to date)"
}

# Initialize admin user if needed
if [ ! -z "$ADMIN_USERNAME" ] && [ ! -z "$ADMIN_PASSWORD" ] && [ ! -z "$ADMIN_EMAIL" ]; then
    echo "👤 Checking admin user..."
    python scripts/create_admin.py || {
        echo "ℹ️ Admin user creation skipped (might already exist)"
    }
fi

# Seed RBAC permissions
echo "🔐 Seeding RBAC permissions..."
python scripts/seed_rbac.py || {
    echo "ℹ️ RBAC seeding skipped (might already be seeded)"
}

# Initialize system settings
echo "⚙️ Initializing system settings..."
python scripts/init_system_settings.py || {
    echo "ℹ️ System settings initialization skipped (might already be initialized)"
}

# Health check
echo "🏥 Performing health check..."
python -c "
import asyncio
from app.core.database import engine
from sqlalchemy import text

async def check_db():
    try:
        async with engine.begin() as conn:
            await conn.execute(text('SELECT 1'))
        print('✅ Database connection successful')
        return True
    except Exception as e:
        print(f'❌ Database connection failed: {e}')
        return False

asyncio.run(check_db())
"

# Start the application
echo "🎯 Starting Uvicorn server..."
echo "=================================================="

# Use PORT from Railway, default to 8000
PORT=${PORT:-8000}
HOST=${HOST:-0.0.0.0}

exec uvicorn app.main:app \
    --host $HOST \
    --port $PORT \
    --log-level info \
    --access-log \
    --use-colors