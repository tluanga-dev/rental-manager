# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Development Pipeline

### Git Workflow and Branch Strategy
**CRITICAL**: Follow this development pipeline for all work:

1. **Development Branch**: All new features and bug fixes are developed on the current working branch (currently `v5`)
2. **Local Testing**: All code MUST be tested locally before committing
3. **Commit to Current Branch**: Push changes to the current branch (v5) after local testing
4. **Main Branch Updates**: The `main` branch is ONLY updated through Pull Requests after complete testing
5. **No Direct Main Commits**: NEVER commit directly to main branch

**Development Flow**:
```bash
# 1. Ensure you're on the current development branch
git checkout v5

# 2. Make changes and test locally
npm run dev
npm test

# 3. Commit to current branch
git add -A
git commit -m "type: description"
git push origin v5

# 4. Create PR to main only after complete testing
# This is done through GitHub UI or CLI after all tests pass
```

**Branch Strategy**:
- `v5` (or current version branch) - Active development branch
- `main` - Production-ready code (updated only via PRs)
- Feature branches - Optional for large features

**Commit Message Format**:
- `fix:` - Bug fixes
- `feat:` - New features
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Maintenance tasks

## Project Overview

This is the Next.js frontend for a rental management system, built with React 19, TypeScript, and Tailwind CSS. The frontend communicates with a FastAPI backend and features comprehensive domain-driven components.

## Docker Compose Local Development (New!)

### Quick Start with Docker
The frontend is now part of the Docker Compose development setup. From the project root:

```bash
# Start all services including frontend with hot reload
../start_docker_dev.sh start

# Frontend will be available at http://localhost:3000
```

### Docker Development Features
- **Hot Module Replacement (HMR)**: Changes to `.tsx`, `.ts`, `.jsx`, `.js`, and `.css` files reload instantly
- **Volume Mounting**: Source code mounted for immediate reflection of changes
- **Optimized Build Cache**: `node_modules` and `.next` directories cached in container
- **Resource Limited**: 512MB RAM, 1 CPU core for efficient development
- **Automatic Backend Connection**: Pre-configured to connect to backend at `http://localhost:8000/api`

### Docker-Specific Commands
```bash
# View frontend logs
../start_docker_dev.sh logs frontend

# Open shell in frontend container
../start_docker_dev.sh shell-frontend

# Restart frontend only
docker-compose -f ../docker-compose.local.yml restart frontend

# Rebuild frontend container
docker-compose -f ../docker-compose.local.yml build frontend
```

### Development Workflow with Docker
1. **Make changes to frontend code** - HMR applies them instantly
2. **View console logs**: `../start_docker_dev.sh logs frontend`
3. **Debug in browser**: Use React DevTools as normal
4. **Run tests in container**:
   ```bash
   docker-compose -f ../docker-compose.local.yml exec frontend npm test
   ```

## Essential Commands

### Development
```bash
npm run dev                    # Start development server (http://localhost:3000)
npm run build                  # Build for production
npm run start                  # Start production server
npm run lint                   # Run ESLint
```

### Testing
```bash
npm test                       # Run Jest unit tests
npm run test:api              # Run API integration tests
npm run test:dropdowns        # Test dropdown components specifically
npm run test:watch            # Run tests in watch mode
```

### Specialized Testing Scripts
```bash
npm run test:dropdowns:full           # Comprehensive dropdown testing
npm run test:dropdowns:simple         # Simple dropdown validation
node test-category-creation.js        # Category creation workflow test
node test-all-urls.js                # Full application URL testing
```

## Architecture Patterns

### Component Organization
- **Domain-based modules**: Components organized by business domain (customers, suppliers, inventory, etc.)
- **Dropdown Pattern**: Virtualized dropdowns with search functionality using react-window
- **Hook-based architecture**: Custom hooks for API integration and business logic
- **Type-safe forms**: React Hook Form with Zod validation schemas

### Key Architectural Decisions

#### Virtualized Dropdowns
The application uses a consistent pattern for large data dropdowns:
```typescript
// Pattern: {Domain}Dropdown/
├── {Domain}Dropdown.tsx          # Main component
├── {Domain}Dropdown.types.ts     # TypeScript definitions
├── Virtual{Domain}List.tsx       # Virtualized list implementation
└── index.tsx                     # Barrel export
```

#### API Integration
- **Axios client**: Centralized API client with interceptors in `src/lib/axios.ts`
- **TanStack Query**: Server state management with automatic caching
- **Error handling**: Standardized error responses with token refresh logic
- **Type safety**: Full TypeScript coverage for API responses

#### State Management
- **Zustand stores**: Lightweight state management for auth and app state
- **Persistence**: Auth state persisted to localStorage with hydration handling
- **Permission system**: Role-based access control integrated with auth store

## Testing Strategy

### Unit Testing (Jest)
- Test files: `src/__tests__/` and `tests/`
- Component testing for business logic
- API service testing with mocked responses

### E2E Testing (Puppeteer)
- Puppeteer tests for critical user workflows
- Screenshot testing for UI validation
- Integration testing with real backend API
- Configuration: `jest-puppeteer.config.js`

### API Integration Testing
```bash
npm run test:api               # Direct backend API testing
node test-api-server.py        # Python-based API validation
```

### Dropdown Testing
The application has extensive dropdown testing due to complex virtualization:
```bash
npm run test:dropdowns         # Core dropdown functionality
node test-item-dropdowns.js   # Item-specific dropdown testing
node test-category-simple.js  # Category dropdown validation
```

## Component Patterns

### Form Components
- Use React Hook Form with Zod schemas for validation
- Consistent error handling and loading states
- TypeScript interfaces in separate `.types.ts` files

### API Service Pattern
Each domain has corresponding API services in `src/services/api/`:
```typescript
// Example: src/services/api/customers.ts
export const customersApi = {
  getAll: () => apiClient.get('/customers'),
  getById: (id: string) => apiClient.get(`/customers/${id}`),
  create: (data: CreateCustomerRequest) => apiClient.post('/customers', data),
  // ...
};
```

### Hook Pattern
Custom hooks in `src/hooks/` and domain-specific hooks in `src/components/{domain}/hooks/`:
```typescript
// Example: useCustomers.ts
export const useCustomers = () => {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
    // ...
  });
};
```

## Development Guidelines

### File Structure
- **Barrel exports**: Use `index.ts` files for clean imports
- **Type definitions**: Separate `.types.ts` files for complex types
- **Domain separation**: Keep related components in domain folders

### Authentication Flow
- JWT tokens managed by auth store with automatic refresh
- Protected routes using `ProtectedRoute` component
- Permission-based UI rendering using auth store methods

### Error Handling
- Centralized error handling in axios interceptors
- User-friendly error messages with fallbacks
- Console logging for debugging with request correlation IDs

### Performance Optimizations
- React Window for large lists (10,000+ items)
- Debounced search inputs (300ms delay)
- Optimistic updates for mutations
- Query invalidation strategies

## Important Implementation Notes

### API Response Format
The backend uses this response format:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}
```

### Environment Variables
- `NEXT_PUBLIC_API_URL`: Backend API base URL (default: http://localhost:8000/api)

### Common Debugging Commands
```bash
# Debug specific workflows
node test-category-creation.js     # Category creation issues
node debug-auth-timing.js          # Authentication timing issues
node test-dropdown-selection.js    # Dropdown selection problems

# UI debugging with screenshots
node test-login-ui.js             # Login page visual testing
node test-sidebar-layout.js       # Sidebar navigation testing
```

### Testing Pages
The application includes dedicated test pages for development:
- `/test-calendar` - Calendar component testing
- `/test-brand-dropdown` - Brand dropdown testing
- `/test-category-dropdown` - Category dropdown testing
- `/test-rentable-dropdown` - Rentable items testing

## Critical Development Patterns

### Dropdown Search Implementation
All major dropdowns use this pattern:
1. Debounced search input
2. Virtualized rendering for performance
3. Keyboard navigation support
4. Loading and error states
5. Type-ahead functionality

### Form Validation Strategy
- Zod schemas defined in component files or `src/lib/validations.ts`
- React Hook Form integration with TypeScript inference
- Field-level and form-level error handling
- Optimistic validation for better UX

### API Error Recovery
- Automatic token refresh on 401 responses
- Request queuing during token refresh
- Graceful degradation for network issues
- User notification for critical errors

## Server Integration

This frontend is designed to work with the FastAPI backend at `../rental-manager-backend/`. Ensure the backend is running for full functionality.

### API Documentation
For comprehensive API endpoint documentation, including request/response formats, authentication patterns, and data types, refer to:
- **API Reference**: `api-docs/API_REFERENCE.md` - Complete API documentation with examples
- **Interactive Docs**: http://localhost:8000/docs (Swagger UI when backend is running)

### Key API Patterns
- **Base URL**: `http://localhost:8000/api`
- **Authentication**: JWT Bearer tokens with automatic refresh
- **Response Format**: Standardized JSON responses with pagination
- **Error Handling**: Consistent error responses with detailed validation messages

### Core Endpoints
- **Authentication**: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/me`
- **Master Data**: `/api/master-data/brands/brands/`, `/api/master-data/categories/categories/`, `/api/master-data/locations/locations/`
- **Business Operations**: `/api/customers/customers/`, `/api/suppliers/suppliers/`, `/api/inventory/inventory/items`
- **Transactions**: `/api/transactions/transactions/`, `/api/rentals/rentals/`