# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Unified Rental Manager** - a full-stack rental property management system combining a FastAPI backend and Next.js frontend in a single repository for streamlined development and deployment.

**Architecture:**
- **Backend**: FastAPI 0.116.1 with Python 3.13+, PostgreSQL 17, Redis 8
- **Frontend**: Next.js with React 19, TypeScript, and Tailwind CSS
- **Unified Docker**: Single docker-compose.yml for both backend and frontend
- **Database**: PostgreSQL with async SQLAlchemy 2.0 and Alembic migrations
- **Authentication**: JWT tokens with automatic refresh across full-stack

## Repository Structure

```
rental-manager/                    # Root of unified repository
├── docker-compose.yml            # Unified development environment
├── rental-manager-api/           # FastAPI backend
│   ├── app/                      # Python application code
│   │   ├── api/v1/endpoints/     # REST API endpoints
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic validation schemas
│   │   ├── crud/                 # Database operations
│   │   ├── services/             # Business logic layer
│   │   └── core/                 # Configuration, security, database
│   ├── alembic/                  # Database migrations
│   ├── tests/                    # Backend test suite
│   └── Makefile                  # Backend development commands
└── rental-manager-frontend/       # Next.js frontend
    ├── src/
    │   ├── app/                  # Next.js App Router
    │   ├── components/           # React components by domain
    │   ├── hooks/                # Custom React hooks
    │   ├── stores/               # Zustand state management
    │   ├── lib/                  # Utilities and configurations
    │   └── types/                # TypeScript type definitions
    ├── tests/                    # Frontend test suite
    └── package.json              # Frontend dependencies and scripts
```

## Essential Development Commands

### Unified Environment (Recommended)
```bash
# Start entire application stack
docker-compose up -d
# Backend: http://localhost:8000/api  
# Frontend: http://localhost:3000
# Database: localhost:5432
# Redis: localhost:6379
# PgAdmin: http://localhost:5050

# View all service logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Backend Development (rental-manager-api/)
```bash
cd rental-manager-api

# Development server
make dev                          # Start FastAPI server (port 8000)
make up                          # Start with Docker (recommended)

# Database operations
make migrate                     # Apply migrations
make makemigration              # Create new migration
make db-reset                   # Reset database completely
make seed                       # Seed sample data

# Testing and quality
make test                       # Run pytest
make test-cov                   # Run tests with coverage
make format                     # Format and lint with Ruff
make typecheck                  # MyPy type checking

# Dependencies
make install                    # Install with UV
uv add package-name            # Add dependency
```

### Frontend Development (rental-manager-frontend/)
```bash
cd rental-manager-frontend

# Development server
npm run dev                     # Start Next.js server (port 3000)

# Testing
npm test                        # Jest unit tests
npm run test:api               # API integration tests
npm run test:dropdowns         # Dropdown component tests

# Build and deploy
npm run build                  # Production build
npm run lint                   # ESLint
```

## Critical Architecture Patterns

### Backend: Layered FastAPI Architecture
The backend follows strict layered architecture:

```python
# API Layer (app/api/v1/endpoints/)
@router.post("/customers")
async def create_customer(
    customer: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await customer_service.create(db, customer, current_user.id)

# Service Layer (app/services/)
class CustomerService:
    async def create(self, db: AsyncSession, customer_data: CustomerCreate, user_id: int):
        # Business logic here
        return await customer_crud.create(db, customer_data)

# CRUD Layer (app/crud/)
class CustomerCRUD(CRUDBase[Customer, CustomerCreate, CustomerUpdate]):
    async def create(self, db: AsyncSession, *, obj_in: CustomerCreate):
        # Database operations only
        pass

# Model Layer (app/models/)
class Customer(Base):
    __tablename__ = "customers"
    # SQLAlchemy model definition
```

**Never skip layers** - each layer has specific responsibilities:
- **API**: Request/response handling, authentication, validation
- **Service**: Business logic, cross-entity operations, complex workflows
- **CRUD**: Database operations, simple queries
- **Model**: Data structure, relationships, constraints

### Frontend: Domain-Driven Components
Components are organized by business domain, not technical concerns:

```typescript
// Domain-based organization
src/components/
├── customers/                   # Customer management
│   ├── CustomerForm.tsx
│   ├── CustomerList.tsx
│   └── hooks/useCustomers.ts
├── inventory/                   # Inventory management
│   ├── InventoryTable.tsx
│   └── hooks/useInventory.ts
└── rentals/                     # Rental operations
    ├── RentalForm.tsx
    └── hooks/useRentals.ts
```

### Virtualized Dropdowns Pattern
For large datasets (10,000+ items), use the established virtualization pattern:

```typescript
// Structure for new dropdown components
{Domain}Dropdown/
├── {Domain}Dropdown.tsx          # Main component with search
├── {Domain}Dropdown.types.ts     # TypeScript interfaces
├── Virtual{Domain}List.tsx       # react-window virtualization
└── index.tsx                     # Barrel export

// Implementation pattern
const CustomerDropdown = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  const { data } = useQuery({
    queryKey: ['customers', debouncedSearch],
    queryFn: () => customersApi.search(debouncedSearch)
  });

  return (
    <VirtualCustomerList 
      items={data} 
      onSelect={onSelect}
      searchTerm={searchTerm}
    />
  );
};
```

## Database and Migration Patterns

### Adding New Entities
Follow this exact sequence when adding new business entities:

```bash
# 1. Create model (app/models/entity.py)
class Entity(Base):
    __tablename__ = "entities"
    # Define fields, relationships

# 2. Create schemas (app/schemas/entity.py)  
class EntityBase(BaseModel):
    # Common fields
class EntityCreate(EntityBase):
    # Creation fields
class EntityUpdate(EntityBase):
    # Update fields (optional fields)
class EntityInDB(EntityBase):
    # Database response fields

# 3. Create CRUD (app/crud/entity.py)
class EntityCRUD(CRUDBase[Entity, EntityCreate, EntityUpdate]):
    # Custom database operations

# 4. Create service (app/services/entity.py)
class EntityService:
    # Business logic methods

# 5. Create endpoints (app/api/v1/endpoints/entity.py)
router = APIRouter()
# Define REST endpoints

# 6. Register router (app/api/v1/api.py)
api_router.include_router(entity.router, prefix="/entities", tags=["entities"])

# 7. Generate migration
cd rental-manager-api
make makemigration

# 8. Create frontend types (rental-manager-frontend/src/types/entity.ts)
export interface Entity {
  // TypeScript definitions
}

# 9. Create API service (rental-manager-frontend/src/services/api/entity.ts)
export const entityApi = {
  getAll: () => apiClient.get('/entities'),
  // CRUD operations
};

# 10. Write tests for both backend and frontend
```

### Database Migration Guidelines
- **Always review migrations** before applying in production
- **Test migrations** on development data first
- **Use descriptive names**: `add_customer_billing_address_table` not `add_table`
- **Separate schema and data** migrations when possible

## Testing Architecture

### Backend Testing (pytest)
```bash
# Test organization
tests/
├── unit/                        # Fast, isolated tests
├── integration/                 # Database integration tests  
└── load/                        # Performance tests with Locust

# Run specific test types
pytest tests/unit/              # Unit tests only
pytest tests/integration/      # Integration tests only
pytest -k "customer"           # Tests matching pattern
pytest --cov=app               # With coverage
```

### Frontend Testing (Jest + Puppeteer)
```bash
# Test types
npm test                        # Jest unit tests
npm run test:api               # Backend API integration
npm run test:dropdowns         # Specialized dropdown tests

# Puppeteer E2E tests
node test-category-creation.js # Specific workflow tests
npm run test:performance       # Performance benchmarks
```

## API Integration Patterns

### Request/Response Format
Backend uses standardized response format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

// Frontend API client usage
const { data } = await apiClient.get('/customers');
// data.success = true/false
// data.data = actual customer data
// data.errors = validation errors if any
```

### Authentication Flow
JWT tokens managed automatically across frontend/backend:

```typescript
// Frontend auth store (Zustand)
interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

// Automatic token refresh in axios interceptors
apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await authStore.refreshToken();
      // Retry original request
    }
    return Promise.reject(error);
  }
);
```

## Environment Configuration

### Backend Environment Variables
```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/rental_db
REDIS_URL=redis://localhost:6379/0

# Security  
SECRET_KEY=your-secret-key-here
BACKEND_CORS_ORIGINS=["http://localhost:3000"]

# Application
ENVIRONMENT=development
DEBUG=true
```

### Frontend Environment Variables
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Development
NODE_ENV=development
```

## Performance and Optimization

### Backend Performance
- **Database**: Use async SQLAlchemy with proper indexing
- **Caching**: Redis for frequent queries (brands, categories, locations)
- **Pagination**: Implement for all list endpoints
- **Query optimization**: Use `joinedload` for relationships to avoid N+1 queries

### Frontend Performance
- **Virtualization**: React Window for lists >1000 items
- **Debouncing**: 300ms delay for search inputs
- **Query caching**: TanStack Query with appropriate stale times
- **Code splitting**: Dynamic imports for heavy components

## Common Development Workflows

### Adding a New Feature
1. **Plan the data model** - design database schema
2. **Backend implementation** - follow the 7-step entity creation process
3. **Frontend integration** - create components, hooks, and types
4. **Testing** - write unit and integration tests
5. **Documentation** - update API docs and component storybook

### Debugging API Issues
```bash
# Backend API docs
http://localhost:8000/docs       # Swagger UI for testing endpoints

# Frontend network debugging  
# Check browser DevTools Network tab
# Enable detailed axios logging in development

# Database debugging
docker-compose exec postgres psql -U rental_user -d rental_db
# Or use PgAdmin at http://localhost:5050
```

### Production Deployment
```bash
# Backend production build
cd rental-manager-api
docker build -f docker/Dockerfile.prod -t rental-api:prod .

# Frontend production build  
cd rental-manager-frontend
npm run build
npm start

# Full stack with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

## Git Workflow for Unified Repository

### Branch Strategy
- **main**: Production-ready code
- **develop**: Integration branch for testing
- **feature/***: Individual feature development

### Commit Conventions
```bash
# Backend changes
feat(api): add customer billing address endpoint
fix(db): resolve migration rollback issue

# Frontend changes  
feat(ui): implement customer billing form
fix(dropdown): resolve virtualization scroll issue

# Full-stack changes
feat(customer): implement complete billing address feature
```

### Testing Before Commits
```bash
# Always test both backend and frontend
cd rental-manager-api && make test
cd rental-manager-frontend && npm test

# Verify integration works
docker-compose up -d
# Test critical workflows manually
```

This unified repository structure enables efficient full-stack development while maintaining clear separation of concerns between backend and frontend code.