#!/bin/bash

# Simple startup script without migrations
echo "Starting backend without migrations..."

# Start uvicorn directly
exec uvicorn app.main:app --host 0.0.0.0 --port 8000