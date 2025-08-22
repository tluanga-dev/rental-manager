#!/bin/bash

# Admin User Initialization Script for Docker
# This script runs during container startup to ensure an admin user exists

set -e  # Exit on any error

echo "Starting FastAPI application initialization..."

# Wait for database to be ready
echo "Waiting for database to be ready..."
until python -c "
import asyncio
import sys
sys.path.insert(0, '/app')
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def check_db():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text('SELECT 1'))
        return True
    except Exception as e:
        print(f'Database not ready: {e}')
        return False

result = asyncio.run(check_db())
exit(0 if result else 1)
"; do
    echo "Database is not ready yet. Waiting 2 seconds..."
    sleep 2
done

echo "Database is ready!"

# Run database migrations
echo "Running database migrations..."
cd /app && alembic upgrade head || {
    echo "Migration failed, trying to initialize fresh database..."
    # If migrations fail, drop and recreate all tables
    python -c "
import asyncio
import sys
sys.path.insert(0, '/app')
from app.core.database import engine, Base
from app.db.base import Base as BaseWithModels

async def recreate_db():
    async with engine.begin() as conn:
        await conn.run_sync(BaseWithModels.metadata.drop_all)
        await conn.run_sync(BaseWithModels.metadata.create_all)
    print('Database recreated successfully')

asyncio.run(recreate_db())
"
    # Mark migrations as applied
    cd /app && alembic stamp head
}

# Create admin user
echo "Creating admin user..."
python /app/scripts/create_admin.py || echo "Admin user creation failed or already exists"

# Seed RBAC permissions
echo "Seeding RBAC permissions..."
python /app/scripts/seed_rbac.py || echo "RBAC seeding failed or already done"

# Initialize system settings
echo "Initializing system settings..."
python /app/scripts/init_system_settings.py || echo "System settings initialization failed or already done"

# Start the FastAPI application
echo "Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload