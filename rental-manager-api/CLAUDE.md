# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Rental Manager API** - a modern FastAPI backend for rental property management with production-ready features and best practices.

**Tech Stack:**
- **Framework**: FastAPI 0.116.1 with Python 3.13+
- **Database**: PostgreSQL 17 with SQLAlchemy 2.0 (async)
- **Cache**: Redis 8 for caching and session management
- **Auth**: JWT authentication using joserfc
- **Testing**: pytest with async support and 80% coverage requirement
- **Code Quality**: Ruff (linting & formatting), MyPy (type checking)
- **Package Manager**: UV (ultra-fast Python package installer)
- **Deployment**: Docker & Docker Compose, Alembic for migrations

## Key Development Commands

### Running the Application
```bash
# Start all services (Docker)
make up                    # Starts PostgreSQL, Redis, PgAdmin, and API

# Run development server locally
make dev                   # or: uv run uvicorn app.main:app --reload --port 8000

# View logs
make logs                  # All services
make db-logs              # Database only
```

### Database Operations
```bash
# Apply migrations
make migrate               # or: docker-compose exec app uv run alembic upgrade head

# Create new migration
make makemigration        # Interactive prompt for migration message
# or: docker-compose exec app uv run alembic revision --autogenerate -m "message"

# Rollback migration
make downgrade            # Rollback last migration

# Reset database completely
make db-reset             # Drops and recreates database with migrations

# Seed sample data
make seed                 # or: docker-compose exec app uv run python scripts/seed_data.py
```

### Testing
```bash
# Run tests
make test                 # or: uv run pytest

# Run tests with coverage (must meet 80% threshold)
make test-cov            # or: uv run pytest --cov=app --cov-report=html --cov-report=term

# Run specific test file
uv run pytest tests/test_specific.py

# Run tests matching pattern
uv run pytest -k "test_customer"
```

### Code Quality
```bash
# Format and fix code
make format              # Runs: uv run ruff format . && uv run ruff check --fix .

# Lint only
make lint                # or: uv run ruff check .

# Type checking
make typecheck           # or: uv run mypy app
```

### Dependency Management
```bash
# Install dependencies
make install             # or: uv sync --dev

# Add new dependency
uv add package-name      # Adds to pyproject.toml

# Remove dependency
uv remove package-name

# Update lock file
uv lock
```

## Application Architecture

### Directory Structure
```
app/
├── api/              # API layer
│   ├── deps.py       # Common dependencies (auth, DB session)
│   └── v1/
│       ├── api.py    # Main API router aggregator
│       └── endpoints/# Individual endpoint modules
├── core/             # Core functionality
│   ├── config.py     # Settings management (Pydantic Settings)
│   ├── database.py   # Database connection manager
│   ├── redis.py      # Redis connection manager
│   └── security.py   # Password hashing, JWT utilities
├── models/           # SQLAlchemy ORM models
├── schemas/          # Pydantic schemas for validation
├── crud/             # Database CRUD operations
├── services/         # Business logic layer
└── utils/           # Utility functions
```

### Key Design Patterns

1. **Layered Architecture**: 
   - Router (endpoints) → Service → CRUD → Model
   - Each layer has specific responsibilities
   
2. **Dependency Injection**: 
   - Database sessions via `get_db()` in deps.py
   - Current user via `get_current_user()` 
   
3. **Async Throughout**: 
   - All database operations use async SQLAlchemy
   - Async route handlers and service methods
   
4. **Repository Pattern**: 
   - CRUD classes encapsulate database operations
   - Services handle business logic

### API Endpoints Structure

All endpoints follow RESTful conventions under `/api/v1/`:
- Authentication: `/api/v1/auth/*`
- Users: `/api/v1/users/*`
- Customers: `/api/v1/customers/*`
- Suppliers: `/api/v1/suppliers/*`
- Companies: `/api/v1/companies/*`
- Contact Persons: `/api/v1/contact-persons/*`
- Categories: `/api/v1/categories/*`

## Database Patterns

### Models
- All models inherit from `Base` in `app/models/base.py`
- Common fields: `id`, `created_at`, `updated_at`
- Soft deletes via `is_deleted` field where applicable
- Relationships defined using SQLAlchemy 2.0 syntax

### Migrations
- Always use Alembic for schema changes
- Never modify database directly in production
- Test migrations locally before pushing

### Query Patterns
```python
# Use async session from deps
async def get_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Model).where(Model.field == value))
    return result.scalars().all()
```

## Testing Guidelines

### Test Organization
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Load tests: `tests/load/`
- Fixtures in `tests/conftest.py`

### Running Tests
```bash
# Quick test run (no slow tests)
pytest -m "not slow"

# Test with specific verbosity
pytest -vv

# Test single module
pytest tests/unit/test_customer.py::test_create_customer
```

## Environment Configuration

Key environment variables (configured in `.env`):
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `SECRET_KEY`: JWT signing key
- `ENVIRONMENT`: development/production/testing
- `DEBUG`: Enable debug mode
- `BACKEND_CORS_ORIGINS`: Allowed CORS origins

## Common Development Tasks

### Adding a New Entity/Module

1. Create model in `app/models/entity.py`
2. Create schemas in `app/schemas/entity.py`
3. Create CRUD in `app/crud/entity.py`
4. Create service in `app/services/entity.py`
5. Create endpoint in `app/api/v1/endpoints/entity.py`
6. Add router to `app/api/v1/api.py`
7. Generate migration: `make makemigration`
8. Write tests in `tests/`

### Debugging

- API docs available at `http://localhost:8000/docs` (development only)
- PgAdmin at `http://localhost:5050` (admin@rentalmanager.com / admin)
- Request tracking via X-Request-ID header
- Detailed logs in development mode

### Performance Considerations

- Use Redis caching for frequently accessed data
- Implement pagination for list endpoints
- Use select_related/joinedload for N+1 query prevention
- Background tasks for heavy operations

## Production Deployment

### Docker Production Build
```bash
make build-prod
docker-compose -f docker-compose.prod.yml up -d
```

### Health Checks
- `/health` - Basic health status
- `/ready` - Readiness with service checks

### Security Notes
- JWT tokens expire after 30 minutes (configurable)
- Passwords hashed with bcrypt (12 rounds)
- CORS configured per environment
- API docs disabled in production