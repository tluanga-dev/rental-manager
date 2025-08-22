.PHONY: help
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Docker commands
.PHONY: up
up: ## Start all services with Docker Compose
	docker-compose up -d
	@echo "\033[32m✓ Services started\033[0m"
	@echo "API: http://localhost:8000"
	@echo "Docs: http://localhost:8000/docs"
	@echo "PgAdmin: http://localhost:5050"

.PHONY: down
down: ## Stop all services
	docker-compose down
	@echo "\033[32m✓ Services stopped\033[0m"

.PHONY: rebuild
rebuild: ## Rebuild and restart all services
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d
	@echo "\033[32m✓ Services rebuilt and started\033[0m"

.PHONY: logs
logs: ## Show logs from all services
	docker-compose logs -f

.PHONY: db-logs
db-logs: ## Show database logs
	docker-compose logs -f postgres

# Development commands
.PHONY: install
install: ## Install dependencies with UV
	@command -v uv >/dev/null 2>&1 || { echo "Installing UV..."; curl -LsSf https://astral.sh/uv/install.sh | sh; }
	uv sync --dev
	@echo "\033[32m✓ Dependencies installed\033[0m"

.PHONY: dev
dev: ## Run development server locally
	uv run uvicorn app.main:app --reload --port 8000

.PHONY: shell
shell: ## Open Python shell with app context
	uv run ipython

# Database commands
.PHONY: migrate
migrate: ## Run database migrations
	docker-compose exec app uv run alembic upgrade head
	@echo "\033[32m✓ Migrations applied\033[0m"

.PHONY: makemigration
makemigration: ## Create a new migration
	@read -p "Migration message: " msg; \
	docker-compose exec app uv run alembic revision --autogenerate -m "$$msg"
	@echo "\033[32m✓ Migration created\033[0m"

.PHONY: downgrade
downgrade: ## Rollback last migration
	docker-compose exec app uv run alembic downgrade -1
	@echo "\033[32m✓ Migration rolled back\033[0m"

.PHONY: db-reset
db-reset: ## Reset database (drop and recreate)
	docker-compose down -v
	docker-compose up -d postgres redis
	@echo "Waiting for database to be ready..."
	@sleep 5
	docker-compose up -d app
	@sleep 2
	$(MAKE) migrate
	@echo "\033[32m✓ Database reset complete\033[0m"

.PHONY: seed
seed: ## Seed database with sample data
	docker-compose exec app uv run python scripts/seed_data.py
	@echo "\033[32m✓ Database seeded\033[0m"

# Testing commands
.PHONY: test
test: ## Run tests
	uv run pytest

.PHONY: test-cov
test-cov: ## Run tests with coverage
	uv run pytest --cov=app --cov-report=html --cov-report=term

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	uv run pytest-watch

# Code quality commands
.PHONY: format
format: ## Format code with Ruff
	uv run ruff format .
	uv run ruff check --fix .
	@echo "\033[32m✓ Code formatted\033[0m"

.PHONY: lint
lint: ## Lint code with Ruff
	uv run ruff check .
	@echo "\033[32m✓ Linting complete\033[0m"

.PHONY: typecheck
typecheck: ## Type check with MyPy
	uv run mypy app
	@echo "\033[32m✓ Type checking complete\033[0m"

.PHONY: clean
clean: ## Clean up generated files
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	find . -type f -name ".coverage" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	@echo "\033[32m✓ Cleanup complete\033[0m"

# Production commands
.PHONY: build-prod
build-prod: ## Build production Docker image
	docker build -f docker/Dockerfile.prod -t rental-manager-api:latest .
	@echo "\033[32m✓ Production image built\033[0m"

# UV specific commands
.PHONY: uv-sync
uv-sync: ## Sync dependencies with UV
	uv sync
	@echo "\033[32m✓ Dependencies synced\033[0m"

.PHONY: uv-lock
uv-lock: ## Update UV lock file
	uv lock
	@echo "\033[32m✓ Lock file updated\033[0m"

.PHONY: uv-add
uv-add: ## Add a new dependency
	@read -p "Package name: " pkg; \
	uv add $$pkg
	@echo "\033[32m✓ Package added\033[0m"

.PHONY: uv-remove
uv-remove: ## Remove a dependency
	@read -p "Package name: " pkg; \
	uv remove $$pkg
	@echo "\033[32m✓ Package removed\033[0m"

# Shortcuts
.PHONY: m
m: migrate ## Shortcut for migrate

.PHONY: mm
mm: makemigration ## Shortcut for makemigration

.PHONY: t
t: test ## Shortcut for test

.PHONY: f
f: format ## Shortcut for format

.PHONY: l
l: lint ## Shortcut for lint

# Default target
.DEFAULT_GOAL := help