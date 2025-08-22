# FastAPI Project Development Prompt

You are an expert backend developer specializing in creating production-ready FastAPI applications with PostgreSQL, Redis, and Docker. Follow this EXACT structure and implementation pattern for all server projects.

## Project Requirements

Create a complete FastAPI backend application with the following specifications:
- **Framework**: FastAPI with Python 3.13+
- **Database**: PostgreSQL 17 with SQLAlchemy ORM and Alembic migrations
- **Caching**: Redis 8 for session management and caching
- **Containerization**: Full Docker setup with docker-compose for development
- **Code Quality**: Ruff (replacing Black, Flake8, isort), MyPy for type checking
- **Testing**: Pytest with async support and coverage reporting
- **Package Management**: UV for ultra-fast dependency management
- **Documentation**: Auto-generated OpenAPI/Swagger docs

## MANDATORY Project Structure

Create the following EXACT folder structure (replace "inventory" with the actual project domain):

```
[project-name]-api/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point with lifespan management
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py           # Pydantic Settings management
│   │   ├── security.py         # JWT, password hashing with passlib/joserfc
│   │   ├── database.py         # SQLAlchemy engine and session management
│   │   └── redis.py            # Redis async client wrapper
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py             # Common dependencies (get_db, get_current_user)
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── api.py          # Main API router aggregation
│   │       └── endpoints/      # Individual endpoint modules
│   │           ├── __init__.py
│   │           ├── auth.py
│   │           ├── users.py
│   │           └── [domain-specific endpoints].py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py             # SQLAlchemy Base class
│   │   ├── user.py
│   │   └── [domain models].py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py             # Pydantic models for validation
│   │   ├── auth.py
│   │   ├── common.py           # Shared schemas (pagination, responses)
│   │   └── [domain schemas].py
│   ├── crud/
│   │   ├── __init__.py
│   │   ├── base.py             # Generic CRUD base class
│   │   └── [domain crud].py
│   ├── services/
│   │   ├── __init__.py
│   │   └── [business logic].py
│   └── utils/
│       ├── __init__.py
│       ├── helpers.py
│       └── validators.py
├── alembic/
│   ├── versions/
│   ├── alembic.ini
│   ├── env.py
│   └── script.py.mako
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # Pytest fixtures
│   └── test_[endpoints].py
├── scripts/
│   ├── init_db.py
│   └── seed_data.py
├── docker/
│   ├── Dockerfile.dev
│   └── Dockerfile.prod
├── .env.example
├── .env                        # (gitignored)
├── .gitignore
├── docker-compose.yml          # Development environment
├── docker-compose.prod.yml     # Production environment
├── Makefile                    # Development automation
├── pyproject.toml              # Project dependencies and tool configs
├── uv.lock                     # UV lockfile for reproducible builds
├── README.md
└── .python-version             # Python version specification for UV
```

## Docker Configuration Requirements

### docker-compose.yml MUST include:

1. **PostgreSQL Service**:
   - Image: `postgres:17-alpine`
   - Health checks using `pg_isready`
   - Named volumes for data persistence
   - Environment variables from .env file

2. **Redis Service**:
   - Image: `redis:8-alpine`
   - Append-only persistence enabled
   - Health checks using `redis-cli ping`
   - Named volume for data

3. **PgAdmin Service** (development only):
   - Image: `dpage/pgadmin4:9.6`
   - Default credentials in environment
   - Port 5050:80 mapping

4. **Application Service**:
   - Build from `docker/Dockerfile.dev`
   - Volume mounts for hot-reload of /app, /alembic, /tests, /scripts
   - Depends on healthy postgres and redis services
   - Environment variables for DATABASE_URL and REDIS_URL
   - Port 8000:8000 mapping

5. **Networks and Volumes**:
   - Single bridge network for all services
   - Named volumes for postgres_data and redis_data

### Dockerfile.dev MUST:
- Use `python:3.13-slim-bookworm` base image
- Install system dependencies (gcc, postgresql-client)
- Install and use `uv` for package management (10-100x faster than pip)
- Create non-root user (appuser) with UID 1000
- Set WORKDIR to /code
- Use uvicorn with --reload flag

## Python Dependencies (pyproject.toml)

### Core Dependencies (Latest Versions - August 2025):
```toml
[project]
name = "[project-name]-api"
version = "1.0.0"
description = "[Project Description]"
requires-python = ">=3.13"
dependencies = [
    "fastapi==0.116.1",
    "uvicorn[standard]==0.35.0",
    "sqlalchemy==2.0.39",
    "alembic==1.16.4",
    "psycopg2-binary==2.9.10",  # Use psycopg2 (non-binary) for production
    "redis==6.4.0",
    "pydantic==2.11.7",
    "pydantic-settings==2.10.1",
    "joserfc==1.0.0",  # Modern replacement for python-jose
    "passlib[bcrypt]==1.7.4",
    "python-multipart==0.0.20",
    "email-validator==2.2.0",
    "python-dotenv==1.1.1",
    "httpx==0.28.1",
    "celery==5.5.3",
    "asyncpg==0.30.0",  # For async PostgreSQL operations
]

[project.optional-dependencies]
dev = [
    "pytest==8.4.1",
    "pytest-asyncio==1.1.0",
    "pytest-cov==6.2.1",
    "ruff==0.12.9",  # Replaces Black, Flake8, isort, and more
    "mypy==1.17.1",
    "ipython==9.4.0",
    "rich==14.0.0",
    "faker==37.5.3",
    "factory-boy==3.3.1",
    "pre-commit==4.0.1",
    "httpx==0.28.1",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
# Ruff replaces Black, Flake8, isort, pydocstyle, pyupgrade, and more
line-length = 88
target-version = "py313"
# Enable multiple rule sets
select = [
    "E",     # pycodestyle errors
    "W",     # pycodestyle warnings
    "F",     # pyflakes
    "I",     # isort
    "B",     # flake8-bugbear
    "C4",    # flake8-comprehensions
    "UP",    # pyupgrade
    "ARG",   # flake8-unused-arguments
    "SIM",   # flake8-simplify
]
ignore = ["E501", "B008"]  # Line too long, function call in argument defaults
fix = true  # Auto-fix when possible

[tool.ruff.format]
# Use Ruff's formatter (replaces Black)
quote-style = "double"
indent-style = "space"
skip-magic-trailing-comma = false
line-ending = "auto"

[tool.mypy]
python_version = "3.13"
ignore_missing_imports = true
strict_optional = true
warn_redundant_casts = true
warn_unused_ignores = true
disallow_untyped_defs = true
check_untyped_defs = true
no_implicit_reexport = true

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
addopts = "-ra -q --strict-markers --asyncio-mode=auto"

[tool.coverage.run]
source = ["app"]
omit = ["*/tests/*", "*/alembic/*"]

[tool.uv]
# UV specific configuration
dev-dependencies = [
    "pytest>=8.4.1",
    "ruff>=0.12.9",
]
```

## Core Module Implementations

### app/core/config.py MUST:
- Use `pydantic_settings.BaseSettings` with v2 syntax
- Include all configuration variables with defaults
- Support .env file loading
- Include: API settings, Security (JWT), Database URLs, Redis config, CORS origins, Environment flags, Pagination defaults, Rate limiting
- Use field validators for complex validation

### app/core/database.py MUST:
- Create SQLAlchemy engine with async support using asyncpg
- Implement async `get_db()` dependency with proper session cleanup
- Use modern SQLAlchemy 2.0 declarative syntax
- Enable connection pooling (pool_size=20, max_overflow=40)
- Enable SQL echo only in debug mode

### app/core/redis.py MUST:
- Implement async Redis client using redis.asyncio
- Include connect/disconnect methods for lifespan management
- Implement get/set/delete/flush methods with JSON serialization
- Use TTL from settings with default fallback
- Handle connection errors gracefully
- Support Redis 8.0 features

### app/main.py MUST:
- Use `@asynccontextmanager` for lifespan events
- Connect/disconnect Redis on startup/shutdown
- Configure CORS middleware with settings
- Include /health and /ready endpoints
- Mount API router with versioned prefix (/api/v1)
- Configure structured logging with correlation IDs
- Use modern async patterns throughout

## Makefile Commands

The Makefile MUST include these commands with colored output:
- **Docker**: up, down, rebuild, logs, db-logs
- **Development**: install (using uv), dev, shell
- **Database**: migrate, makemigration, downgrade, db-reset, seed
- **Testing**: test, test-cov, test-watch
- **Code Quality**: format (ruff format), lint (ruff check), typecheck (mypy), clean
- **Production**: build-prod
- **UV Commands**: uv-sync, uv-lock, uv-add, uv-remove
- **Shortcuts**: m (migrate), mm (makemigration), t (test), f (format), l (lint)

### Example Makefile with UV:
```makefile
# Install dependencies using UV (10-100x faster than pip)
install:
	curl -LsSf https://astral.sh/uv/install.sh | sh
	uv sync --dev
	uv run pre-commit install

# Add a new dependency
add:
	@read -p "Package name: " pkg; uv add $$pkg

# Run development server
dev:
	uv run uvicorn app.main:app --reload --port 8000

# Format code with Ruff
format:
	uv run ruff format .
	uv run ruff check --fix .

# Lint code
lint:
	uv run ruff check .
	uv run mypy app
```

## Environment Variables (.env.example)

Must include:
```env
# Environment
ENVIRONMENT=development
DEBUG=true

# API
SECRET_KEY=your-secret-key-change-in-production
API_V1_STR=/api/v1

# Database
DATABASE_URL=postgresql+asyncpg://[project]_user:[project]_pass@localhost:5432/[project]_db
POSTGRES_USER=[project]_user
POSTGRES_PASSWORD=[project]_pass
POSTGRES_DB=[project]_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL=3600

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
ALGORITHM=HS256

# Security
BCRYPT_ROUNDS=12  # Increased from 10 for 2025 standards
```

## Updated Docker Files

### docker/Dockerfile.dev
```dockerfile
FROM python:3.13-slim-bookworm

WORKDIR /code

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install UV for ultra-fast package management
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"

# Copy dependency files
COPY pyproject.toml uv.lock* /code/

# Install dependencies using UV (10-100x faster than pip)
RUN uv sync --frozen --no-dev

# Copy application
COPY . /code/

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /code
USER appuser

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:17-alpine
    container_name: ${PROJECT_NAME}_postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-project_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-project_pass}
      POSTGRES_DB: ${POSTGRES_DB:-project_db}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app_network

  redis:
    image: redis:8-alpine
    container_name: ${PROJECT_NAME}_redis
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app_network

  pgadmin:
    image: dpage/pgadmin4:9.6
    container_name: ${PROJECT_NAME}_pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@project.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
    networks:
      - app_network

  app:
    build:
      context: .
      dockerfile: docker/Dockerfile.dev
    container_name: ${PROJECT_NAME}_api
    volumes:
      - ./app:/code/app
      - ./alembic:/code/alembic
      - ./tests:/code/tests
      - ./scripts:/code/scripts
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379/0
      - ENVIRONMENT=development
      - DEBUG=true
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app_network

volumes:
  postgres_data:
  redis_data:

networks:
  app_network:
    driver: bridge
```

## Implementation Standards (2025 Updates)

1. **Async-first architecture** - All database and Redis operations use async/await
2. **UV package manager** - Replace pip/poetry/pipenv with UV for 10-100x faster installs
3. **Pydantic V2** models with improved performance and validation
4. **SQLAlchemy 2.0** with async support via asyncpg
5. **Dependency injection** for database sessions and current user
6. **JWT authentication** using joserfc (modern replacement for python-jose)
7. **Generic CRUD base class** with async operations
8. **Service layer** for complex business logic separation
9. **Comprehensive error handling** with structured logging
10. **Health check endpoints** for Kubernetes/container orchestration

## Code Style Requirements (2025)

1. **Type hints** on all functions (enforced by mypy strict mode)
2. **Docstrings** for all public functions
3. **Ruff** for all formatting and linting (replaces Black, Flake8, isort)
4. **MyPy** with strict mode enabled
5. **Pre-commit hooks** using Ruff and mypy
6. **Python 3.13+** features (pattern matching, better error messages)

## Testing Requirements

1. **Pytest fixtures** with async support
2. **pytest-asyncio** with auto mode
3. **Test database** using testcontainers or Docker
4. **Factory pattern** with factory-boy
5. **Coverage** minimum 80% with branch coverage
6. **Parametrized tests** for comprehensive coverage

## Security Best Practices (2025)

1. **Never commit .env files** - use .env.example
2. **Use secrets.token_urlsafe(32)** for secret keys
3. **Bcrypt with 12 rounds** (increased from 10)
4. **JWT with short-lived access tokens** (30 min) and refresh tokens
5. **CORS** with explicit origin allowlist
6. **Rate limiting** using Redis
7. **SQL injection prevention** via SQLAlchemy ORM
8. **Input validation** with Pydantic V2
9. **Container security** - non-root users, minimal base images
10. **Dependency scanning** in CI/CD pipeline

## Deployment Readiness

1. **Multi-stage Docker builds** for minimal production images
2. **Health and readiness endpoints** with actual service checks
3. **Graceful shutdown** in lifespan handlers
4. **12-factor app** principles
5. **Database migrations** with Alembic async support
6. **Structured JSON logging** with correlation IDs
7. **OpenTelemetry** integration ready
8. **Metrics endpoints** for Prometheus

## Documentation Requirements

1. **OpenAPI 3.1** auto-generated at /docs
2. **ReDoc** at /redoc
3. **README.md** with badges and clear setup
4. **API versioning** in URL path
5. **Changelog** maintenance
6. **Architecture Decision Records** (ADRs)

## Quick Start Section in README

Always include:
```bash
# Prerequisites: Install UV (ultra-fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 1. Clone and setup
git clone <repo>
cd [project]-api

# 2. Copy environment file
cp .env.example .env

# 3. Install dependencies with UV (10-100x faster than pip)
uv sync --dev

# 4. Start services with Docker
make up

# 5. Run migrations
make migrate

# 6. Seed database (optional)
make seed

# 7. Check health
curl http://localhost:8000/health

# 8. View API docs
open http://localhost:8000/docs

# 9. View database (PgAdmin)
open http://localhost:5050

# 10. Run tests
uv run pytest

# 11. Format and lint code
uv run ruff format .
uv run ruff check --fix .
```

## Critical Implementation Notes

- **ALWAYS** use UV instead of pip for 10-100x faster package management
- **ALWAYS** use Ruff for formatting and linting (replaces multiple tools)
- **ALWAYS** use async/await patterns throughout the application
- **ALWAYS** implement comprehensive health checks
- **ALWAYS** use structured logging with correlation IDs
- **ALWAYS** follow 12-factor app principles
- **ALWAYS** use non-root users in containers
- **ALWAYS** implement rate limiting and request validation
- **NEVER** use synchronous database operations in async context
- **NEVER** hardcode configuration values
- **NEVER** skip tests or documentation

## Modern Python Features to Use (2025)

1. **Pattern matching** (match/case statements)
2. **Union types** with | operator
3. **Type hints** with generics and protocols
4. **Async context managers** and comprehensions
5. **Structural pattern matching** for complex data
6. **Better error messages** in Python 3.13
7. **TaskGroups** for concurrent async operations
8. **ExceptionGroups** for handling multiple errors

When implementing a new project, replace all instances of "[project]" or "inventory" with the actual domain name, but maintain the exact structure, patterns, and configurations shown here. This template represents the current best practices as of August 2025.