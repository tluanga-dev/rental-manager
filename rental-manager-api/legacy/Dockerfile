# Development Dockerfile for FastAPI Backend
# Optimized for hot reload, debugging, and Railway-like deployment simulation

ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim as base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # PostgreSQL client for database operations
    postgresql-client \
    # Build essentials for Python packages
    gcc \
    g++ \
    make \
    # Required for psycopg2
    libpq-dev \
    # Curl for health checks
    curl \
    # Git for development
    git \
    # Vim for debugging
    vim \
    # Process management
    procps \
    htop \
    # File watching tools
    inotify-tools \
    # Network debugging
    netcat-traditional \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Set Python environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100 \
    POETRY_VERSION=1.6.1 \
    POETRY_HOME=/opt/poetry \
    POETRY_VENV=/opt/poetry-venv \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt requirements-dev.txt* ./

# Install Python dependencies
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Install development dependencies if requirements-dev.txt exists
RUN if [ -f requirements-dev.txt ]; then \
        pip install -r requirements-dev.txt; \
    else \
        # Install common development tools
        pip install \
            # Debugging tools
            ipdb \
            debugpy \
            # Code formatting and linting
            black \
            isort \
            flake8 \
            mypy \
            # Testing
            pytest \
            pytest-asyncio \
            pytest-cov \
            pytest-mock \
            httpx \
            # Hot reload
            watchdog[watchmedo] \
            # Performance monitoring
            memory-profiler \
            line-profiler \
            # Database tools
            alembic \
            # Additional async tools
            aiofiles \
            aiohttp; \
    fi

# Create necessary directories
RUN mkdir -p /app/logs /app/alembic /app/scripts /app/uploads /app/backups

# Create a non-root user for security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# Copy the application code (will be overridden by volume mount in development)
COPY --chown=appuser:appuser . .

# Make scripts executable
RUN chmod +x scripts/*.sh scripts/*.py 2>/dev/null || true

# Create default development entrypoint if it doesn't exist
RUN if [ ! -f scripts/dev_entrypoint.sh ]; then \
    echo '#!/bin/bash\n\
set -e\n\
\n\
echo "========================================"\n\
echo "Starting Rental Manager Backend (Development)"\n\
echo "========================================"\n\
\n\
# Function to wait for PostgreSQL\n\
wait_for_postgres() {\n\
    echo "Waiting for PostgreSQL..."\n\
    while ! pg_isready -h ${DATABASE_HOST:-postgres} -p ${DATABASE_PORT:-5432} -U ${POSTGRES_USER:-rental_user} 2>/dev/null; do\n\
        echo "PostgreSQL is unavailable - sleeping"\n\
        sleep 2\n\
    done\n\
    echo "PostgreSQL is up!"\n\
}\n\
\n\
# Function to wait for Redis\n\
wait_for_redis() {\n\
    echo "Waiting for Redis..."\n\
    while ! nc -z ${REDIS_HOST:-redis} ${REDIS_PORT:-6379} 2>/dev/null; do\n\
        echo "Redis is unavailable - sleeping"\n\
        sleep 2\n\
    done\n\
    echo "Redis is up!"\n\
}\n\
\n\
# Wait for services\n\
wait_for_postgres\n\
wait_for_redis\n\
\n\
# Run migrations if AUTO_MIGRATE is true\n\
if [ "${AUTO_MIGRATE}" = "true" ]; then\n\
    echo "Running database migrations..."\n\
    alembic upgrade head || echo "Migrations failed or already applied"\n\
fi\n\
\n\
# Create indexes if CREATE_INDEXES is true\n\
if [ "${CREATE_INDEXES}" = "true" ] && [ -f scripts/create_indexes_async.py ]; then\n\
    echo "Creating database indexes..."\n\
    python scripts/create_indexes_async.py || echo "Index creation failed or already exists"\n\
fi\n\
\n\
# Initialize admin user\n\
if [ -f scripts/create_admin.py ]; then\n\
    echo "Creating admin user..."\n\
    python scripts/create_admin.py || echo "Admin user already exists"\n\
fi\n\
\n\
# Seed RBAC permissions\n\
if [ -f scripts/seed_rbac.py ]; then\n\
    echo "Seeding RBAC permissions..."\n\
    python scripts/seed_rbac.py || echo "RBAC already seeded"\n\
fi\n\
\n\
# Initialize system settings\n\
if [ -f scripts/init_system_settings.py ]; then\n\
    echo "Initializing system settings..."\n\
    python scripts/init_system_settings.py || echo "System settings already initialized"\n\
fi\n\
\n\
# Seed master data if requested\n\
if [ "${SEED_MASTER_DATA}" = "true" ] && [ -f scripts/seed_all_data.py ]; then\n\
    echo "Seeding master data..."\n\
    python scripts/seed_all_data.py || echo "Master data already seeded"\n\
fi\n\
\n\
# Start the application with hot reload\n\
echo "Starting FastAPI with hot reload..."\n\
\n\
if [ "${HOT_RELOAD}" = "true" ] || [ "${AUTO_RELOAD}" = "true" ]; then\n\
    # Use uvicorn with reload for development\n\
    exec uvicorn app.main:app \\\n\
        --host ${HOST:-0.0.0.0} \\\n\
        --port ${PORT:-8000} \\\n\
        --reload \\\n\
        --reload-dir /app \\\n\
        --log-level ${LOG_LEVEL:-debug} \\\n\
        --access-log\n\
else\n\
    # Use standard uvicorn without reload\n\
    exec uvicorn app.main:app \\\n\
        --host ${HOST:-0.0.0.0} \\\n\
        --port ${PORT:-8000} \\\n\
        --log-level ${LOG_LEVEL:-info}\n\
fi\n\
' > scripts/dev_entrypoint.sh && \
    chmod +x scripts/dev_entrypoint.sh; \
fi

# Switch to non-root user
USER appuser

# Expose ports
EXPOSE 8000 5678

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Default command
CMD ["./scripts/dev_entrypoint.sh"]