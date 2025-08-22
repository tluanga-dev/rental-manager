# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Development Guidelines

### Git Workflow and Branch Strategy
**CRITICAL**: Follow this development pipeline for all work:

1. **Development Branch**: All new features and bug fixes are developed on the `main` branch
2. **Local Testing**: All code MUST be tested locally before committing
3. **Database Migrations**: Generate and test migrations for any schema changes
4. **Commit and Push**: Push changes to `main` branch after local testing
5. **Railway Deployment**: Production automatically deploys from `main` branch
6. **Migration Handling**: Railway automatically applies pending migrations on deployment

**Development Flow**:
```bash
# 1. Ensure you're on main branch
git checkout main
git pull origin main

# 2. Make changes and test locally
uvicorn app.main:app --reload
pytest
pytest -m "not slow"  # Quick test suite

# 3. Generate migration if schema changed
alembic revision --autogenerate -m "Description of changes"
alembic upgrade head  # Test migration locally

# 4. Commit and push to main
git add -A
git commit -m "type: description"
git push origin main

# Railway automatically deploys and runs migrations
```

**Database Migration Workflow**:
```bash
# For schema changes:
1. Modify models in app/modules/*/models.py
2. Generate migration: alembic revision --autogenerate -m "Add new field"
3. Review migration: cat alembic/versions/*_add_new_field.py
4. Test locally: alembic upgrade head
5. Commit both model and migration files
6. Push to main - Railway handles the rest
```

**Branch Strategy**:
- `main` - Primary development and production branch (Railway deploys from here)
- Feature branches - Optional for large features or experiments

**Testing Requirements Before PR**:
1. Run full test suite: `pytest`
2. Check code quality: `black .` and `flake8 .`
3. Verify type hints: `mypy .`
4. Test critical endpoints manually
5. Ensure no breaking changes

**Commit Message Format**:
- `fix:` - Bug fixes
- `feat:` - New features
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Maintenance tasks

## Project Overview

This is a **full-stack Rental Management System** with FastAPI backend and Next.js frontend designed to manage rental operations, inventory, customers, suppliers, and transactions.

**Tech Stack:**
- **Backend**: FastAPI (Python 3.11) with PostgreSQL, async SQLAlchemy, and JWT authentication
- **Frontend**: Next.js 15.3.4 with React 19, TypeScript, and Tailwind CSS
- **Database**: PostgreSQL with asyncpg driver (no SQLite support)
- **Caching**: Redis for performance optimization
- **Testing**: pytest (backend) + Jest/Puppeteer (frontend) with comprehensive test coverage

## Database Migration Management

### Overview
The backend uses Alembic for database schema version control. All schema changes must go through migrations.

### Key Migration Commands
```bash
# Generate migration from model changes
alembic revision --autogenerate -m "Description of change"

# Apply migrations
alembic upgrade head          # Apply all pending migrations
alembic upgrade +1            # Apply next migration
alembic upgrade <revision>    # Apply to specific revision

# Rollback migrations
alembic downgrade -1          # Rollback one migration
alembic downgrade <revision>  # Rollback to specific revision

# Check migration status
alembic current              # Show current revision
alembic history              # Show all migrations
alembic show <revision>      # Show specific migration details
```

### Production Migration Process
1. **Automatic on Deploy**: Railway runs `start-production.sh` which automatically:
   - Detects migration status
   - Applies pending migrations
   - Handles both fresh and existing databases

2. **Migration Files**: Located in `alembic/versions/`
   - Baseline: `202508190531_initial_database_schema.py`
   - Future migrations added sequentially

3. **Important Scripts**:
   - `scripts/production_migration_setup.py` - Initial migration setup
   - `scripts/reset_and_migrate_production.py` - Complete reset (DESTRUCTIVE!)
   - `scripts/test_all_crud_operations.py` - Verify database operations

### Migration Best Practices
- **Always test locally** before pushing
- **Never edit** migration files after deployment
- **Include rollback logic** in migrations
- **Keep migrations small** and focused
- **Document breaking changes** in commit messages

For detailed migration guide, see: `docs/DATABASE_MIGRATION_GUIDE.md`

## Common Development Commands

### Frontend Commands (run from rental-manager-frontend/)

```bash
# Development server
npm run dev                    # Start development server (http://localhost:3000)
npm run build                  # Build for production
npm run start                  # Start production server
npm run lint                   # Run ESLint
npm run type-check             # TypeScript type checking

# Testing
npm test                       # Run Jest unit tests
npm run test:api              # Run API integration tests
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Run tests with coverage report

# E2E Testing (Puppeteer)
node test-submit-cancel-buttons.js     # Test sidebar button functionality
node test-category-creation.js         # Test category creation workflow
node test-all-urls.js                 # Full application URL testing
node test-login-ui.js                 # Login page visual testing
node test-sidebar-layout.js           # Sidebar navigation testing

# Specialized Testing Scripts
npm run test:dropdowns:full           # Comprehensive dropdown testing
npm run test:dropdowns:simple         # Simple dropdown validation
node test-item-dropdowns.js          # Item-specific dropdown testing
node test-category-simple.js         # Category dropdown validation
```

### Backend Commands (run from rental-manager-backend/)

```bash
# Change to backend directory first
cd rental-manager-backend

# Development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Docker development (recommended)
docker-compose up -d                    # Start PostgreSQL and Redis
docker-compose --profile dev up         # Full dev environment with auto-reload
docker-compose logs -f app-dev          # Follow application logs

# Database migrations
alembic revision --autogenerate -m "Description"
alembic upgrade head
alembic downgrade -1

# Testing (with comprehensive markers)
pytest                                  # Run all tests
pytest --cov=app --cov-report=html     # With HTML coverage report
pytest -m "unit"                       # Unit tests only
pytest -m "integration"                # Integration tests only  
pytest -m "auth"                       # Authentication tests
pytest -m "crud"                       # CRUD operation tests
pytest -m "not slow"                   # Skip slow tests (>30 seconds)

# Code quality
black .                                 # Format code (100-char line length)
isort .                                 # Sort imports
flake8 .                               # Lint
mypy .                                 # Type checking

# Admin and data management
python scripts/create_admin.py          # Create admin user
python scripts/seed_all_data.py         # Seed master data
python load_dummy_data.py               # Load brands, units, locations, suppliers, categories, items from JSON
python scripts/clear_all_data_except_auth.py  # Clear non-auth data
python scripts/migrate_test_db.py       # Migrate test database
python scripts/seed_rbac.py             # Seed RBAC permissions
python scripts/init_system_settings.py  # Initialize system settings
python scripts/validate_master_data.py  # Validate master data integrity

# Data utilities
bash RUN_CLEAR_DATA_NOW.sh             # Quick data cleanup script
python clear_transaction_inventory_data.py  # Clear transaction/inventory data only
python clear_all_transaction_inventory_data.py  # Clear all transaction and inventory data
python clear_rental_transactions_only.py  # Clear rental transactions only

# Environment setup
cp .env.example .env                    # Copy environment template
```

## Environment Variables

Key environment variables for configuration:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/database
DATABASE_ECHO=false                    # Enable SQL query logging

# Redis Cache
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-secret-key-here-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
PASSWORD_MIN_LENGTH=8
PASSWORD_BCRYPT_ROUNDS=12

# CORS and Whitelist
USE_WHITELIST_CONFIG=true              # Use config/whitelist.json for CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,http://localhost:3002  # Fallback origins

# Server
HOST=0.0.0.0
PORT=8000
DEBUG=false

# Admin User (for Docker initialization)
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@admin.com
ADMIN_PASSWORD=K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3
ADMIN_FULL_NAME=System Administrator

# Pagination and File Uploads
DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100
MAX_UPLOAD_SIZE=10485760
UPLOAD_DIRECTORY=uploads

# Testing
TEST_DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/test_database
```

## Architecture Overview

The backend follows Domain-Driven Design with a strict modular structure:

```
app/
├── core/               # Core configuration and utilities
│   ├── config.py      # Pydantic settings with environment validation
│   ├── database.py    # Async PostgreSQL connection management
│   ├── security.py    # JWT auth and password hashing
│   ├── cache.py       # Redis caching with cache warming
│   ├── logging_config.py  # Structured logging with transaction audit
│   ├── middleware.py  # CORS whitelist and endpoint access control
│   ├── scheduler.py   # APScheduler for background tasks
│   └── permissions.py # RBAC permission system
├── modules/            # Business domain modules
│   ├── auth/          # JWT authentication and token management
│   ├── users/         # User management with role assignments
│   ├── master_data/   # Master data (brands, categories, locations, units, items)
│   │   ├── brands/
│   │   ├── categories/
│   │   ├── locations/
│   │   ├── units/
│   │   └── item_master/  # Main item catalog
│   ├── customers/     # Customer relationship management
│   ├── suppliers/     # Supplier management
│   ├── inventory/     # Stock management with multi-location support
│   ├── transactions/  # Complex transaction system
│   │   ├── base/      # Shared transaction models and repositories
│   │   ├── purchase/  # Purchase transactions with inventory updates
│   │   ├── rentals/   # Complete rental lifecycle management
│   │   └── purchase_returns/  # Purchase return processing
│   ├── company/       # Company configuration and settings
│   ├── system/        # System administration and audit logs
│   └── monitoring/    # Performance monitoring and metrics
├── shared/            # Shared utilities and base classes
│   ├── models.py      # Base SQLAlchemy models with audit fields
│   ├── repository.py  # Generic repository pattern
│   ├── pagination.py  # Consistent pagination handling
│   ├── filters.py     # Dynamic query filtering
│   ├── exceptions.py  # Custom exception hierarchy
│   └── utils/         # Business logic utilities (SKU generation, calculations)
└── db/                # Database configuration
    ├── base.py        # Import all models for Alembic
    └── session.py     # Session management
```

### Core Architecture Patterns

**Module Structure (consistent across all domains):**
- `models.py`: SQLAlchemy async ORM models with audit fields
- `schemas.py`: Pydantic request/response validation models
- `repository.py`: Data access layer with async methods
- `service.py`: Business logic and orchestration
- `routes.py`: FastAPI endpoints with dependency injection

**Key Technical Patterns:**
- **Full async/await**: All database operations use asyncpg and async SQLAlchemy 2.0
- **Repository pattern**: Service → Repository → Model for data access
- **Dependency injection**: FastAPI's dependency system for session management
- **RBAC system**: Role-based access control with granular permissions
- **Transaction management**: Complex business transactions with automatic rollback
- **Audit logging**: Comprehensive transaction and change logging
- **Cache warming**: Redis cache preloaded with frequently accessed data on startup

## Database Design

**Key Database Features:**
- **PostgreSQL only**: No SQLite support, requires PostgreSQL with asyncpg
- **Alembic migrations**: All schema changes tracked in `alembic/versions/`
- **Audit trails**: Created/updated timestamps and user tracking on all models
- **Foreign key constraints**: Comprehensive referential integrity
- **Indexes**: Performance-optimized queries for large datasets
- **Transaction isolation**: ACID compliance for business transactions

**Core Tables:**
- `users` - User accounts with RBAC roles
- `companies` - Multi-tenant company support
- `items` - Master item catalog with SKU generation
- `inventory` - Stock levels by location and item
- `transaction_headers` - All business transactions (purchases, rentals, sales)
- `transaction_lines` - Line items for all transactions
- `rental_lifecycle` - Rental status tracking and history

## Testing Strategy

**Test Markers and Categories:**
```bash
# Available pytest markers (defined in pytest.ini)
pytest -m "unit"         # Unit tests - isolated component testing
pytest -m "integration"  # Integration tests - multi-component testing
pytest -m "auth"         # Authentication and authorization tests
pytest -m "crud"         # CRUD operation tests
pytest -m "validation"   # Input validation and schema tests
pytest -m "error"        # Error handling and edge case tests
pytest -m "admin"        # Admin/privileged operation tests
pytest -m "slow"         # Tests that take >30 seconds
pytest -m "not slow"     # Skip slow tests for faster feedback
```

**Test Configuration:**
- Coverage target: 70% minimum (configured in pytest.ini)
- HTML coverage reports generated in `htmlcov/`
- Test timeout: 300 seconds max per test
- Async test support with `asyncio_mode = auto`

## API Design

**Endpoint Structure:**
- All APIs prefixed with `/api`
- OpenAPI/Swagger documentation at http://localhost:8000/docs
- Consistent error response format with custom exception types
- CORS managed via `config/whitelist.json` for production security

**Transaction System:**
- Complex multi-table transactions with automatic rollback
- Inventory updates automatically triggered by purchase transactions
- Rental lifecycle management with status tracking
- Comprehensive audit logging for all business operations

**Performance Optimizations:**
- Redis caching with cache warming on startup
- Connection pooling for database operations
- Structured logging with performance monitoring
- APScheduler for background task processing

## Development Workflow

**Initial Setup (Local Development - No Docker):**
1. Navigate to backend: `cd rental-manager-backend`
2. Set up environment: `cp .env.example .env`
3. **Configure admin credentials in .env:**
   ```bash
   ADMIN_USERNAME=admin
   ADMIN_EMAIL=admin@yourdomain.com
   ADMIN_PASSWORD=YourSecure@Password123!
   ADMIN_FULL_NAME=System Administrator
   ```
4. Ensure PostgreSQL and Redis are running locally
5. **Run automated initialization:** `python scripts/init_local_dev.py`
   - Runs database migrations
   - Creates admin user from environment variables
   - Seeds RBAC permissions and system settings
6. Start dev server: `uvicorn app.main:app --reload`

**Manual Setup (Alternative):**
If you prefer manual steps:
1. Run migrations: `alembic upgrade head`
2. Create admin user: `python scripts/create_admin.py`
3. Seed RBAC permissions: `python scripts/seed_rbac.py`
4. Seed master data: `python scripts/seed_all_data.py`
5. Initialize system settings: `python scripts/init_system_settings.py`

**Admin Validation:**
- Test admin setup: `python scripts/validate_admin.py`
- Comprehensive testing: `python scripts/test_admin_creation.py`

**Frontend Setup:**
1. Navigate to frontend: `cd rental-manager-frontend`
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Access application at http://localhost:3000

**Key Configuration Files:**
- `app/core/config.py` - Pydantic settings with environment validation
- `config/whitelist.json` - CORS origins and endpoint access control
- `alembic.ini` - Database migration configuration
- `pytest.ini` - Test configuration with comprehensive markers
- `Dockerfile.railway` - Railway production deployment container
- `start-production.sh` - Railway startup script with automated admin creation

**Railway Production Deployment:**
1. **Set Environment Variables in Railway Dashboard:**
   ```bash
   ADMIN_USERNAME=admin
   ADMIN_EMAIL=admin@yourcompany.com
   ADMIN_PASSWORD=YourSecure@ProductionPassword123!
   ADMIN_FULL_NAME=System Administrator
   DATABASE_URL=<railway-postgres-url>
   REDIS_URL=<railway-redis-url>
   SECRET_KEY=<your-secret-key>
   ```
2. **Deploy:** Railway automatically deploys on git push
3. **Verify:** Check deployment logs for admin creation confirmation:
   ```
   ✓ Admin user creation completed successfully
   ✓ Admin user validation passed
   ```

**Admin User Management:**
- **Password Requirements:** 8+ chars, uppercase, lowercase, numbers, special chars
- **Username Requirements:** 3-50 chars, letters/numbers/underscores only
- **Environment-Driven:** All admin settings from environment variables
- **Idempotent Creation:** Safe to run multiple times
- **Validation Tools:** Use `python scripts/validate_admin.py` to test
- **Detailed Guide:** See [docs/ADMIN_SETUP_GUIDE.md](rental-manager-backend/docs/ADMIN_SETUP_GUIDE.md)

**Business Logic Key Points:**
- SKU generation follows category-based format (5-digit numeric)
- Inventory automatically updated on purchase transactions
- RBAC system with granular permissions
- Multi-location inventory tracking
- Comprehensive rental lifecycle with status management

## Frontend Architecture (rental-manager-frontend/)

### Component Structure

The frontend follows a domain-driven component architecture with TypeScript and modern React patterns:

```
src/
├── components/                 # Reusable UI components
│   ├── layout/                # Layout components (MainLayout, Sidebar, etc.)
│   ├── dialogs/               # Modal dialogs and overlays
│   ├── tabs/                  # Tab-based navigation components
│   ├── rentals/               # Rental-specific components
│   ├── customers/             # Customer management components
│   ├── suppliers/             # Supplier management components
│   ├── inventory/             # Inventory management components
│   └── shared/                # Shared/common components
├── hooks/                     # Custom React hooks
├── services/                  # API service layers
├── stores/                    # Zustand state management
├── types/                     # TypeScript type definitions
├── utils/                     # Utility functions
└── app/                       # Next.js App Router pages
```

### Key Frontend Patterns

**Component Architecture:**
- **Functional Components**: All components use React hooks (no class components)
- **TypeScript Interfaces**: Strict typing for all props, state, and API responses
- **Custom Hooks**: Business logic extracted into reusable hooks
- **Barrel Exports**: Clean imports using index.ts files

**State Management:**
- **Zustand**: Lightweight state management for global app state
- **React Query/TanStack Query**: Server state management with caching
- **Local State**: useState/useReducer for component-specific state

**Styling Approach:**
- **Tailwind CSS**: Utility-first CSS framework
- **Responsive Design**: Mobile-first approach with responsive utilities
- **Design System**: Consistent colors, spacing, and component patterns

## Rental Return System Implementation

### Overview

The rental return system is a comprehensive, multi-tab interface for processing item returns with advanced functionality including search, filtering, status tracking, and conditional business logic.

### Key Features

#### **1. Sidebar Navigation Architecture**
- **Location**: `/rentals/[id]/return`
- **Layout**: Fixed sidebar with main content area (no main navigation bar)
- **Components**:
  - `RentalReturnSidebar.tsx` - Main navigation sidebar
  - `RentalReturnPage.tsx` - Main page orchestrator
  - `MainLayout.tsx` - Modified to hide main nav on return pages

**Navigation Tabs:**
```typescript
// Tab structure in RentalReturnSidebar
const tabs = [
  { id: 'items', label: 'Rental Items', icon: PackageIcon },
  { id: 'financial', label: 'Financial', icon: DollarSignIcon },
  { id: 'notes', label: 'Return Notes', icon: FileTextIcon }
];
```

#### **2. Return Items Tab (`RentalItemsTab.tsx`)**

**Key Components:**
- **Search Functionality**: Real-time search by item name with clear button
- **Status Cards**: 4-column grid showing rental status counts
- **Help Dialog**: Question mark button opens instructions modal
- **Items Table**: Comprehensive table with conditional logic

**Status Tracking Cards:**
```typescript
// Status categories displayed in cards
const statusCards = [
  { type: 'Late Items', statuses: ['RENTAL_LATE', 'RENTAL_LATE_PARTIAL_RETURN'] },
  { type: 'On Time', statuses: ['RENTAL_INPROGRESS', 'RENTAL_EXTENDED'] },
  { type: 'Returned', statuses: ['RENTAL_COMPLETED'] },
  { type: 'Partial Return', statuses: ['RENTAL_PARTIAL_RETURN', 'RENTAL_LATE_PARTIAL_RETURN'] }
];
```

**Search Implementation:**
```typescript
// Search logic with useMemo for performance
const filteredItems = useMemo(() => {
  if (!searchTerm.trim()) return returnItems;
  return returnItems.filter(item =>
    item.item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [returnItems, searchTerm]);
```

#### **3. Return Items Table (`ReturnItemsTable.tsx`)**

**Advanced Business Logic:**
- **Conditional Partial Return**: "Partial Return" option only appears when `item.quantity >= 2`
- **Dynamic Dropdowns**: Return action dropdowns adapt based on item quantities
- **Status-Based Styling**: Different colors and icons based on rental status
- **Bulk Operations**: "Set action for all" with intelligent filtering

**Partial Return Logic:**
```typescript
// Individual item dropdown
{itemState.item.quantity >= 2 && (
  <option value="PARTIAL_RETURN">Partial Return</option>
)}

// Bulk action dropdown
{returnItems.some(item => item.selected && item.item.quantity >= 2) && (
  <option value="PARTIAL_RETURN">Partial Return</option>
)}
```

**Table Features:**
- **Checkbox Selection**: Individual and bulk selection with indeterminate state
- **Return Actions**: COMPLETE_RETURN, PARTIAL_RETURN, MARK_LATE, MARK_DAMAGED
- **Quantity Input**: Numeric input with validation and max limits
- **Conditional Fields**: Damage notes and penalty fields appear for damaged items
- **Status Display**: Color-coded badges for different rental statuses

#### **4. Financial Tab (`FinancialTab.tsx`)**
- **Financial Preview**: Real-time calculation of refunds, late fees, and penalties
- **Deposit Tracking**: Original deposit vs. refund amounts
- **Impact Summary**: Visual breakdown of financial implications

#### **5. Return Notes Tab (`ReturnNotesTab.tsx`)**
- **Notes Interface**: Large textarea for return processing notes
- **Process Instructions**: Guidance for completing returns
- **Action Buttons**: Submit and Cancel buttons relocated to sidebar (see below)

#### **6. Sidebar Action Buttons**

**Location**: Bottom of `RentalReturnSidebar.tsx`
**Design**: Stacked vertical buttons with gradient styling

```typescript
// Button implementation in sidebar footer
<div className="p-4 border-t border-gray-200 bg-white">
  <div className="space-y-3">
    {/* Submit Button - Green gradient */}
    <button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
      Submit Return {selectedItemsCount > 0 ? `(${selectedItemsCount})` : ''}
    </button>
    
    {/* Cancel Button - Red gradient with X icon */}
    <button className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700">
      <XIcon className="w-4 h-4 mr-2" />
      Cancel
    </button>
  </div>
</div>
```

**Button Features:**
- **Submit Button**: Green gradient, shows selected item count, disabled when no items selected
- **Cancel Button**: Red gradient with X icon, navigates back to rental details
- **Loading States**: Spinner animation during processing
- **Hover Effects**: Shadow and transform animations

### Type Definitions

**Core Types** (`src/types/rental-return.ts`):
```typescript
export interface ReturnItemState {
  item: RentalItem;
  selected: boolean;
  return_action: ReturnAction;
  return_quantity: number;
  condition_notes: string;
  damage_notes: string;
  damage_penalty: number;
}

export type ReturnAction = 
  | 'COMPLETE_RETURN'
  | 'PARTIAL_RETURN' 
  | 'MARK_LATE'
  | 'MARK_DAMAGED';

export type RentalStatus = 
  | 'RENTAL_INPROGRESS'
  | 'RENTAL_COMPLETED'
  | 'RENTAL_LATE'
  | 'RENTAL_EXTENDED'
  | 'RENTAL_PARTIAL_RETURN'
  | 'RENTAL_LATE_PARTIAL_RETURN';
```

### Testing Strategy

**E2E Testing:**
- `test-submit-cancel-buttons.js` - Tests sidebar button functionality and placement
- Screenshot testing for visual verification
- Puppeteer automation for complex user workflows

**Key Test Scenarios:**
- Search functionality with real-time filtering
- Conditional partial return options
- Status card calculations
- Button state changes based on selections
- Help dialog modal interactions

### Performance Optimizations

- **useMemo**: Search filtering to prevent unnecessary re-renders
- **Conditional Rendering**: Components only render when needed
- **Debounced Search**: Prevents excessive filtering operations
- **Efficient Filtering**: Status calculations use optimized filter operations

### Development Notes

**Important Implementation Details:**
1. **Main Navigation Removal**: `MainLayout.tsx` conditionally hides main nav using `pathname?.includes('/return')`
2. **Search State Management**: Search term stored in local state, filtered items calculated with useMemo
3. **Button Placement**: Submit/Cancel buttons moved from content area to sidebar footer per UX requirements
4. **Conditional Business Logic**: Partial return availability based on quantity constraints
5. **Status Synchronization**: Stats cards update dynamically with search results

**File Structure for Rental Returns:**
```
src/components/
├── RentalReturnPage.tsx          # Main orchestrator
├── RentalReturnSidebar.tsx       # Navigation sidebar with action buttons
├── ReturnItemsTable.tsx          # Main data table with business logic
├── dialogs/
│   └── HelpDialog.tsx           # Reusable help modal
└── tabs/
    ├── RentalItemsTab.tsx       # Items tab with search and stats
    ├── FinancialTab.tsx         # Financial preview tab
    └── ReturnNotesTab.tsx       # Notes and processing tab
```

## Debugging and Troubleshooting

### Common E2E Test Scripts (Puppeteer)

**Authentication & Login Issues:**
```bash
node test-login-issue.js              # Debug login problems
node test-demo-admin-login.js         # Test admin login flow
node test-login-comprehensive.js      # Comprehensive login testing
```

**Component Testing:**
```bash
node test-category-creation.js        # Category creation workflow
node test-item-creation-comprehensive.js  # Item creation testing
node test-unit-crud-comprehensive.js  # Unit of measurement CRUD
node test-brand-crud-comprehensive.js # Brand management testing
```

**Purchase Transactions:**
```bash
node test-purchase-transactions.js    # Purchase transaction testing
node test-serial-number-flow.js       # Serial number workflow
node create_20_diverse_purchase_transactions.js  # Create test data
```

**Rental System:**
```bash
node test-rental-creation-simple.js   # Basic rental creation
node test-rental-system.js            # Full rental system test
node test-rental-return-simple.js     # Rental return workflow
node test-active-rentals.js           # Active rentals functionality
```

**API Testing:**
```bash
node test-api-endpoints.js            # Test all API endpoints
node test-cors-comprehensive.sh       # CORS configuration testing
node test-backend-api.js              # Backend API validation
```

### Performance Testing

**Backend Performance:**
```bash
cd rental-manager-backend
python search_performance_benchmark.py  # Search performance testing
pytest -m "performance"                # Run performance tests
```

**Frontend Performance:**
```bash
cd rental-manager-frontend
npm run test:performance              # Run all performance tests
npm run performance:establish-baseline # Create performance baseline
npm run performance:compare           # Compare against baseline
```

### Data Management Scripts

**Clear Specific Data:**
```bash
cd rental-manager-backend
python clear_rental_transactions_only.py  # Clear only rental data
python clear_purchase_and_inventory_data.py  # Clear purchase/inventory
python clear_all_data_except_auth.py     # Keep auth data only
```

**Validate Data Integrity:**
```bash
python scripts/validate_master_data.py   # Check master data integrity
python validate_purchase_inventory_sync.py  # Verify inventory sync
```

## TypeScript Type System

### Core Type Definitions
The frontend uses comprehensive TypeScript types located in `src/types/`:
- `api.ts` - API response wrappers and pagination types
- `auth.ts` - Authentication and user types
- `customer.ts` - Customer domain types
- `inventory.ts` - Inventory management types
- `item.ts` - Item catalog types
- `purchases.ts` - Purchase transaction types
- `rentals.ts` - Rental transaction types
- `rental-return.ts` - Rental return specific types
- `sales.ts` - Sales transaction types

### API Response Pattern
All API responses follow this standardized pattern:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}
```

### Form Validation with Zod
Forms use Zod schemas for runtime validation with TypeScript inference:
```typescript
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  // ...
});
type FormData = z.infer<typeof schema>;
```

## Important Architectural Decisions

### No SQLite Support
The backend is designed exclusively for PostgreSQL with asyncpg. SQLite is not supported due to:
- Async driver requirements
- Advanced PostgreSQL features usage
- Production-oriented architecture

### RBAC Permission System
The application uses a comprehensive Role-Based Access Control system:
- Permissions are granular and resource-based
- Roles aggregate permissions
- Users are assigned roles
- Frontend enforces permissions via auth store

### Multi-Location Inventory
Inventory tracking supports multiple locations:
- Each item can have different stock levels per location
- Transfers between locations are tracked
- Location-based availability checking

### Transaction Architecture
All business transactions (purchases, rentals, sales) follow a unified pattern:
- Transaction headers contain metadata
- Transaction lines contain item details
- Automatic inventory updates via triggers
- Comprehensive audit logging

### Category-Based SKU Generation
SKUs are automatically generated based on:
- Category code (from category hierarchy)
- Sequential numbering within category
- Format: CATCODE-00001 (5-digit numeric)

## Common Development Patterns

### API Service Layer
Each domain has a dedicated API service file in `src/services/api/`:
- Centralized error handling
- Type-safe request/response
- Automatic token management
- Request/response interceptors

### Custom Hooks Pattern
Business logic is encapsulated in custom hooks:
- `use{Domain}` - Main data fetching hook
- `use{Domain}Search` - Search functionality
- `use{Domain}Mutations` - Create/update/delete operations

### Virtualized Dropdowns
For performance with large datasets:
- React Window for virtualization
- Debounced search (300ms)
- Keyboard navigation support
- Loading and error states

### Form Component Pattern
Consistent form implementation:
- React Hook Form for state management
- Zod for validation
- Separate validation schemas
- Optimistic updates where appropriate
## Important Reminders

1. **ALWAYS commit and push changes to git** after implementing any fix or feature
2. **Never leave changes uncommitted** - Railway needs pushed changes to deploy
3. **Use descriptive commit messages** following the conventional format (fix:, feat:, etc.)
4. **Test locally when possible** before committing, but commit even if untested when necessary
