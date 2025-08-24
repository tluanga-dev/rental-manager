# 🧪 Company Feature - Comprehensive Testing Plan

## Overview
This document outlines the complete automated test suite for the Company CRUD feature, covering API testing, UI validation, business logic, RBAC, CORS compliance, and stress testing with 10,000 companies.

## Test Architecture

### Testing Stack
- **API Testing**: curl scripts with JSON validation
- **UI Testing**: Puppeteer with headless Chrome
- **Business Logic**: Python scripts with SQLAlchemy
- **Load Testing**: Data seeding + performance measurement
- **Integration**: Docker Compose orchestration

### Test Categories

## 1. CRUD Operations Testing

### Create Company
**API Tests:**
- ✅ Valid company creation (all fields): `{company_name: "Tech Corp", address: "123 Tech St", email: "info@tech.com", phone: "+1234567890", gst_no: "27AABCU9603R1ZM", registration_number: "L85110TN2019PTC123456"}`
- ✅ Valid company (required fields only): `{company_name: "Simple Corp"}`
- ❌ Empty company_name → 422 validation error
- ❌ Whitespace-only company_name → 422 validation error
- ❌ Company_name too long (>255 chars) → 422 validation error
- ❌ Email too long (>255 chars) → 422 validation error
- ❌ Phone too long (>50 chars) → 422 validation error
- ❌ GST too long (>50 chars) → 422 validation error
- ❌ Registration number too long (>100 chars) → 422 validation error
- ❌ Invalid email format → 422 validation error
- ❌ Phone whitespace only → 422 validation error
- ✅ GST auto-uppercase: `gst27abc` becomes `GST27ABC`
- ✅ Registration auto-uppercase: `reg123abc` becomes `REG123ABC`
- ❌ Duplicate company_name → 409 conflict error
- ❌ Duplicate gst_no → 409 conflict error
- ❌ Duplicate registration_number → 409 conflict error

**UI Tests:**
- Form validation error messages
- Real-time field validation
- Success notifications
- Auto-uppercase display for GST/Registration
- Required field indicators

### Read Company
**API Tests:**
- ✅ Fetch company by ID
- ✅ List companies with pagination
- ✅ Filter by is_active status
- ✅ Search by company name
- ✅ Search by email
- ✅ Search by GST number
- ✅ Search by registration number
- ✅ Sort by company_name, created_at, updated_at
- ❌ Non-existent ID → 404 error
- ✅ Pagination edge cases (page 0, beyond max)

**UI Tests:**
- Company list display
- Search functionality across all fields
- Filtering controls (active/inactive)
- Pagination navigation
- Company detail view
- Responsive design

### Update Company
**API Tests (via update_info method):**
- ✅ Update company_name with validation
- ✅ Update address, email, phone fields
- ✅ Update GST with auto-uppercase
- ✅ Update registration_number with auto-uppercase
- ✅ Partial updates (single field changes)
- ❌ Update to invalid values → 422 validation error
- ❌ Update to duplicate company_name → 409 conflict
- ❌ Update to duplicate GST → 409 conflict
- ❌ Update to duplicate registration → 409 conflict
- ❌ Non-existent ID → 404 error

**UI Tests:**
- Edit form pre-population
- Field validation on update
- Conflict error handling
- Auto-uppercase display
- Success notifications

### Delete Company
**API Tests:**
- ✅ Delete existing company → 200 success
- ❌ Delete non-existent ID → 404 error
- ✅ Soft delete (is_active=False)
- ❌ Delete only active company → 400 business rule error

**UI Tests:**
- Delete confirmation modal
- Delete button state based on business rules
- Error messages for protected companies
- Success feedback

## 2. Business Logic Testing

### Display Name Property
- ✅ Returns company_name: `display_name = "Tech Corp"`
- ✅ Handles special characters and spaces correctly

### String Representations
- ✅ `__str__()`: Returns display_name
- ✅ `__repr__()`: Returns `<Company(id=uuid, name='Tech Corp', active=True)>`

### Update Info Method
- ✅ Valid updates with validation
- ✅ Field normalization (strip whitespace)
- ✅ GST/Registration uppercase conversion
- ❌ Invalid data rejected with proper errors
- ✅ Audit trail (updated_at, updated_by)

### Validation Business Rules
- ✅ Company name trimming and length validation
- ✅ Email format validation (contains @, valid domain)
- ✅ Phone number length and format validation
- ✅ GST number format and uppercase enforcement
- ✅ Registration number format and uppercase enforcement
- ✅ Uniqueness constraint enforcement

## 3. Validation Testing

### Field-Level Validation
**Company Name:**
- Required field validation
- Length constraints (1-255 characters)
- Uniqueness constraints
- Whitespace trimming and validation

**Email:**
- Optional field handling
- Format validation (must contain @)
- Length constraints (max 255 characters)
- Domain validation

**Phone:**
- Optional field handling
- Length constraints (max 50 characters)
- Whitespace-only rejection

**GST Number:**
- Optional field handling
- Length constraints (max 50 characters)
- Auto-uppercase conversion
- Uniqueness constraints
- Format validation (alphanumeric)

**Registration Number:**
- Optional field handling
- Length constraints (max 100 characters)
- Auto-uppercase conversion
- Uniqueness constraints
- Format validation (alphanumeric)

### Model-Level Validation
- Comprehensive field validation in `_validate()` method
- Custom validation messages
- Business rule enforcement
- Data integrity checks

## 4. Database Integration Testing

### Constraints and Indexes
**Uniqueness Constraints:**
- Company name uniqueness across active companies
- GST number global uniqueness
- Registration number global uniqueness
- Concurrent creation conflict resolution

**Database Indexes:**
- `idx_company_name_active` performance testing
- Query optimization verification
- Index utilization analysis

### Relationship Testing
**Base Model Integration:**
- UUID primary key generation
- Timestamp fields (created_at, updated_at)
- Audit fields (created_by, updated_by)
- Soft delete functionality (is_active, deleted_at)

## 5. RBAC (Role-Based Access Control) Testing

### Access Control Matrix

| Role | Create | Read | Update | Delete | Activate |
|------|--------|------|--------|---------|----------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ✅ | ❌ | ❌ |
| Viewer | ❌ | ✅ | ❌ | ❌ | ❌ |
| Unauthorized | ❌ | ❌ | ❌ | ❌ | ❌ |

**Test Cases:**
- JWT token validation
- Role-based endpoint access
- Permission inheritance
- Unauthorized access → 401/403 errors
- Token expiration handling
- API key validation (if applicable)

## 6. CORS Compliance Testing

### Preflight OPTIONS Requests
**Required Headers:**
- `Access-Control-Allow-Origin: *` (or specific origins)
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With`
- `Access-Control-Allow-Credentials: true`

**Test Endpoints:**
- `/api/v1/companies` (GET, POST)
- `/api/v1/companies/{id}` (GET, PUT, DELETE)
- `/api/v1/companies/search` (GET)
- `/api/v1/companies/activate` (POST)

### Cross-Origin Request Testing
- Different origin scenarios
- Credential handling
- Header validation
- Method validation

## 7. Stress Testing (10,000 Companies)

### Data Generation Strategy
**Volume**: 10,000 unique companies
**Distribution**:
- Company names: Realistic business names with variations
- Addresses: Diverse geographical locations
- Emails: Valid format with domain variations
- Phones: International and local format variations
- GST numbers: Valid Indian GST format variations
- Registration numbers: Realistic corporate registration patterns

### Performance Benchmarks
**API Performance:**
- List companies: < 500ms with pagination
- Search companies: < 300ms with indexes
- Create company: < 100ms
- Update company: < 100ms
- Delete validation: < 50ms

**Database Performance:**
- Index utilization verification
- Query execution plans analysis
- Memory usage monitoring
- Connection pooling efficiency
- Concurrent operation handling

**Frontend Performance:**
- Company list rendering: < 1s for 50 items/page
- Search responsiveness: < 200ms with debouncing
- Form submission: < 500ms
- Pagination navigation: < 300ms

### Load Testing Scenarios
1. **Bulk Creation**: 1000 companies in parallel
2. **Concurrent Reads**: 100 users browsing companies
3. **Search Load**: Multiple search queries simultaneously
4. **Mixed Operations**: CRUD operations under load
5. **Duplicate Validation**: Stress test uniqueness constraints

### Scalability Testing
- Memory usage under load
- Database connection pool exhaustion
- API response time degradation
- Frontend responsiveness under load

## 8. UI/UX Testing

### Form Validation
- Real-time validation feedback
- Error message clarity and positioning
- Field highlighting and focus management
- Accessibility compliance (ARIA labels, keyboard navigation)
- Screen reader compatibility

### User Experience
- Loading states and spinners
- Success/error notifications
- Responsive design (mobile/tablet/desktop)
- Progressive enhancement
- Offline capability (if applicable)

### Edge Cases
- Network failures and retry logic
- Slow API responses
- Browser compatibility testing
- JavaScript disabled scenarios
- Large dataset handling

## Test Implementation Files

### API Tests (curl)
```
/rental-manager-api/scripts/
├── test-company-crud.sh              # CRUD operations
├── test-company-security.sh          # RBAC + CORS
├── test-company-validation.sh        # Field validation
├── seed-companies-10k.py             # Stress test data
└── test-company-performance.sh       # Load testing
```

### UI Tests (Puppeteer)
```
/rental-manager-frontend/tests/
├── company-crud-ui.js               # UI CRUD workflows
├── company-validation-ui.js         # Form validation
├── company-search-ui.js             # Search functionality
├── company-performance-ui.js        # Frontend performance
└── company-accessibility.js         # A11y testing
```

### Business Logic Tests (Python)
```
/rental-manager-api/scripts/
├── test-company-business-logic.py   # Model methods
├── test-company-relationships.py   # Database relationships
└── test-company-constraints.py     # Database constraints
```

### Docker Integration
```
/rental-manager/
├── docker-compose.company-tests.yml  # Test orchestration
├── Dockerfile.company-tests          # Test environment
└── run-company-tests-complete.sh     # Test runner
```

## Success Criteria

### Functional Requirements
- ✅ All CRUD operations work correctly
- ✅ All validation rules enforced
- ✅ All business logic methods function properly
- ✅ Database constraints maintained correctly
- ✅ RBAC permissions enforced
- ✅ CORS headers properly configured

### Performance Requirements
- ✅ API responses < 500ms under normal load
- ✅ 10,000 companies handled efficiently
- ✅ Database queries optimized with indexes
- ✅ Frontend responsive with large datasets
- ✅ Memory usage within acceptable limits
- ✅ Concurrent operations handled gracefully

### Quality Requirements
- ✅ 95%+ test coverage across all layers
- ✅ Error handling comprehensive and user-friendly
- ✅ User experience smooth and intuitive
- ✅ Security vulnerabilities addressed
- ✅ Cross-browser compatibility verified
- ✅ Accessibility standards met (WCAG 2.1 AA)

## Test Execution Strategy

### Phase 1: Unit & Integration
1. Model validation tests
2. CRUD repository tests
3. Service layer tests
4. API endpoint tests
5. Business logic tests

### Phase 2: Security & Compliance
1. RBAC testing across all roles
2. CORS validation for all endpoints
3. Input sanitization verification
4. SQL injection prevention
5. XSS protection validation

### Phase 3: Performance & Load
1. Stress test data generation (10K companies)
2. Load testing execution
3. Performance metric collection
4. Bottleneck identification and resolution
5. Scalability testing

### Phase 4: UI & UX
1. Puppeteer automation setup
2. Form validation flows
3. User journey testing
4. Accessibility validation
5. Cross-browser testing

### Phase 5: Integration & CI/CD
1. Docker test environment setup
2. Complete test suite execution
3. CI/CD pipeline integration
4. Automated reporting and notifications
5. Production deployment readiness

## Special Considerations

### Business Logic Complexity
- Company activation/deactivation rules
- Single active company constraint
- Default company initialization
- Audit trail requirements

### Data Integrity
- Multi-field uniqueness constraints
- Concurrent operation safety
- Transaction isolation
- Rollback scenarios

### Performance Optimization
- Database index strategy
- Query optimization
- Caching mechanisms
- Connection pooling

### Security Considerations
- Data sanitization
- Injection prevention
- Authentication/authorization
- Data privacy compliance

This comprehensive testing plan ensures the Company feature meets all functional, performance, security, and usability requirements while providing confidence for production deployment.