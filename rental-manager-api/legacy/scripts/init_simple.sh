#!/bin/bash

# Simple initialization script
echo "Starting simple initialization..."

# Create required directories
mkdir -p /app/logs/transactions /app/logs/errors /app/logs/performance /app/uploads
chmod -R 777 /app/logs /app/uploads

# Wait for database
echo "Waiting for database..."
until pg_isready -h postgres -p 5432 -U rental_user; do
  sleep 2
done

echo "Database is ready!"

# Initialize database without Alembic
echo "Initializing database..."
python -c "
import asyncio
import sys
sys.path.insert(0, '/app')

from app.core.database import engine, Base
from app.db.base import Base as BaseWithModels

async def init_db():
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(BaseWithModels.metadata.create_all)
    print('Database initialized successfully')

asyncio.run(init_db())
"

# Create admin user
echo "Creating admin user..."
python /app/scripts/create_admin.py || echo "Admin user may already exist"

# Seed RBAC
echo "Seeding RBAC..."
python /app/scripts/seed_rbac.py || echo "RBAC may already be seeded"

# Start the application
echo "Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload