# Rental Manager API

A modern, production-ready FastAPI backend for rental property management built with best practices and cutting-edge technologies.

## Features

- 🚀 **FastAPI** - Modern, fast web framework for building APIs
- 🐘 **PostgreSQL 17** - Robust relational database with async support
- 🔄 **Redis 8** - High-performance caching and session management
- 🔐 **JWT Authentication** - Secure token-based authentication
- 📦 **Docker** - Containerized development and deployment
- ⚡ **UV Package Manager** - 10-100x faster than pip
- 🧹 **Ruff** - Lightning-fast Python linter and formatter
- 🔍 **MyPy** - Static type checking
- 🧪 **Pytest** - Comprehensive testing framework
- 📊 **Alembic** - Database migrations with async support

## Tech Stack

- **Python 3.13+** - Latest Python features
- **FastAPI 0.116.1** - API framework
- **SQLAlchemy 2.0** - ORM with async support
- **Pydantic V2** - Data validation
- **joserfc** - Modern JWT implementation
- **Docker & Docker Compose** - Containerization
- **UV** - Ultra-fast package management

## Quick Start

### Prerequisites

Install UV (ultra-fast Python package manager):
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd rental-manager-api
```

2. **Copy environment file**
```bash
cp .env.example .env
```

3. **Install dependencies**
```bash
make install
# or
uv sync --dev
```

4. **Start services with Docker**
```bash
make up
# or
docker-compose up -d
```

5. **Run database migrations**
```bash
make migrate
# or
docker-compose exec app uv run alembic upgrade head
```

6. **Seed database (optional)**
```bash
make seed
```

7. **Check health**
```bash
curl http://localhost:8000/health
```

8. **View API documentation**
```bash
open http://localhost:8000/docs
```

9. **View database (PgAdmin)**
```bash
open http://localhost:5050
# Email: admin@rentalmanager.com
# Password: admin
```

## Development

### Running locally

```bash
# Start development server
make dev

# Or run directly
uv run uvicorn app.main:app --reload --port 8000
```

### Database Operations

```bash
# Create a new migration
make makemigration

# Apply migrations
make migrate

# Rollback last migration
make downgrade

# Reset database
make db-reset
```

### Code Quality

```bash
# Format code
make format

# Lint code
make lint

# Type check
make typecheck

# Run all quality checks
make format lint typecheck
```

### Testing

```bash
# Run tests
make test

# Run tests with coverage
make test-cov

# Run tests in watch mode
make test-watch
```

## Project Structure

```
rental-manager-api/
├── app/
│   ├── main.py                 # FastAPI app entry point
│   ├── core/
│   │   ├── config.py           # Settings management
│   │   ├── database.py         # Database configuration
│   │   ├── redis.py            # Redis configuration
│   │   └── security.py         # Security utilities
│   ├── api/
│   │   ├── deps.py             # Dependencies
│   │   └── v1/
│   │       ├── api.py          # API router
│   │       └── endpoints/      # API endpoints
│   ├── models/                 # SQLAlchemy models
│   ├── schemas/                # Pydantic schemas
│   ├── crud/                   # CRUD operations
│   ├── services/               # Business logic
│   └── utils/                  # Utilities
├── alembic/                    # Database migrations
├── tests/                      # Test files
├── docker/                     # Docker configurations
├── scripts/                    # Utility scripts
├── docker-compose.yml          # Development environment
├── Makefile                    # Development commands
└── pyproject.toml              # Project dependencies
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/password-reset` - Request password reset

### Users
- `GET /api/v1/users` - List users
- `GET /api/v1/users/me` - Get current user
- `PUT /api/v1/users/me` - Update current user
- `GET /api/v1/users/{id}` - Get user by ID
- `PUT /api/v1/users/{id}` - Update user (admin)
- `DELETE /api/v1/users/{id}` - Delete user (admin)

### Properties
- `GET /api/v1/properties` - List properties
- `POST /api/v1/properties` - Create property
- `GET /api/v1/properties/{id}` - Get property
- `PUT /api/v1/properties/{id}` - Update property
- `DELETE /api/v1/properties/{id}` - Delete property

### Tenants
- `GET /api/v1/tenants` - List tenants
- `POST /api/v1/tenants` - Create tenant
- `GET /api/v1/tenants/{id}` - Get tenant
- `PUT /api/v1/tenants/{id}` - Update tenant
- `DELETE /api/v1/tenants/{id}` - Delete tenant

### Leases
- `GET /api/v1/leases` - List leases
- `POST /api/v1/leases` - Create lease
- `GET /api/v1/leases/{id}` - Get lease
- `PUT /api/v1/leases/{id}` - Update lease
- `DELETE /api/v1/leases/{id}` - Delete lease

### Payments
- `GET /api/v1/payments` - List payments
- `POST /api/v1/payments` - Record payment
- `GET /api/v1/payments/{id}` - Get payment
- `PUT /api/v1/payments/{id}` - Update payment

### Maintenance
- `GET /api/v1/maintenance` - List maintenance requests
- `POST /api/v1/maintenance` - Create request
- `GET /api/v1/maintenance/{id}` - Get request
- `PUT /api/v1/maintenance/{id}` - Update request

## Environment Variables

Key environment variables (see `.env.example` for full list):

```env
# Environment
ENVIRONMENT=development
DEBUG=true

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/db
POSTGRES_USER=rental_user
POSTGRES_PASSWORD=rental_pass
POSTGRES_DB=rental_db

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-secret-key-change-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:3000"]
```

## Docker Services

The application includes the following services:

- **app** - FastAPI application (port 8000)
- **postgres** - PostgreSQL 17 database (port 5432)
- **redis** - Redis 8 cache (port 6379)
- **pgadmin** - Database management UI (port 5050)

## Security Features

- 🔐 JWT-based authentication with refresh tokens
- 🔑 Bcrypt password hashing with 12 rounds
- 🛡️ Role-based access control (RBAC)
- 🚦 Rate limiting with Redis
- 📝 Request ID tracking for debugging
- 🔍 Input validation with Pydantic V2
- 🚪 CORS configuration

## Performance Features

- ⚡ Async/await throughout the application
- 🔄 Connection pooling for database
- 💾 Redis caching for frequently accessed data
- 📦 UV package manager (10-100x faster than pip)
- 🚀 Production-ready with Uvicorn workers

## Deployment

### Production with Docker

```bash
# Build production image
make build-prod

# Run with production compose file
docker-compose -f docker-compose.prod.yml up -d
```

### Environment-specific settings

The application automatically adjusts behavior based on `ENVIRONMENT`:
- `development` - Debug mode, auto-reload, visible docs
- `production` - Optimized, no debug, hidden docs
- `testing` - Test configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and quality checks
5. Submit a pull request

## Makefile Commands

Run `make help` to see all available commands:

```
Docker:         up, down, rebuild, logs, db-logs
Development:    install, dev, shell
Database:       migrate, makemigration, downgrade, db-reset, seed
Testing:        test, test-cov, test-watch
Code Quality:   format, lint, typecheck, clean
Production:     build-prod
UV:             uv-sync, uv-lock, uv-add, uv-remove
Shortcuts:      m (migrate), mm (makemigration), t (test), f (format), l (lint)
```

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.