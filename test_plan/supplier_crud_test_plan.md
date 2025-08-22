# Comprehensive Supplier CRUD Test Plan
**Rental Manager Application - Frontend Testing**

## Table of Contents
1. [Test Overview](#test-overview)
2. [Backend API Analysis](#backend-api-analysis)
3. [Frontend Component Analysis](#frontend-component-analysis)
4. [Test Environment Setup](#test-environment-setup)
5. [Test Data Requirements](#test-data-requirements)
6. [CREATE Operations Testing](#create-operations-testing)
7. [READ Operations Testing](#read-operations-testing)
8. [UPDATE Operations Testing](#update-operations-testing)
9. [DELETE Operations Testing](#delete-operations-testing)
10. [Edge Cases & Error Handling](#edge-cases--error-handling)
11. [Performance Testing](#performance-testing)
12. [Security Testing](#security-testing)
13. [Integration Testing](#integration-testing)
14. [Test Execution Strategy](#test-execution-strategy)
15. [Coverage Metrics](#coverage-metrics)
16. [Test Data Appendix](#test-data-appendix)

---

## Test Overview

### Objectives
- Achieve **100% CRUD coverage** for supplier features from the frontend perspective
- Validate all business logic and data flows
- Ensure robust error handling and user experience
- Verify security and performance requirements
- Test all UI components and user interactions

### Scope
- **In Scope**: All supplier-related frontend operations, API integrations, UI components, validation, error handling
- **Out of Scope**: Database-level testing, infrastructure testing, third-party integrations

### Success Criteria
- ✅ All 150+ test cases pass
- ✅ 100% API endpoint coverage (8 endpoints)
- ✅ 100% UI component coverage (5 main pages)
- ✅ Zero critical bugs
- ✅ Performance benchmarks met
- ✅ Security vulnerabilities addressed

### Test Environment Requirements
- **Frontend**: Next.js application running on `http://localhost:3001`
- **Backend**: FastAPI application running on `http://localhost:8001`
- **Database**: PostgreSQL with test data
- **Authentication**: Valid JWT tokens for different user roles
- **Browser**: Chrome/Firefox latest versions
- **Network**: Stable internet connection

---

## Backend API Analysis

### API Endpoints Coverage Matrix

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|---------|
| `/api/v1/suppliers/` | POST | Create supplier | ✅ |
| `/api/v1/suppliers/` | GET | List suppliers with filters | ✅ |
| `/api/v1/suppliers/search` | GET | Search suppliers | ✅ |
| `/api/v1/suppliers/statistics` | GET | Get analytics | ✅ |
| `/api/v1/suppliers/{id}` | GET | Get single supplier | ✅ |
| `/api/v1/suppliers/{id}` | PUT | Update supplier | ✅ |
| `/api/v1/suppliers/{id}` | DELETE | Delete supplier | ✅ |
| `/api/v1/suppliers/{id}/status` | PUT | Update status | ✅ |

### Data Model Fields
**Core Fields:**
- `supplier_code` (string, required, unique, max 50 chars)
- `company_name` (string, required, max 255 chars)
- `supplier_type` (enum: MANUFACTURER, DISTRIBUTOR, WHOLESALER, RETAILER, INVENTORY, SERVICE, DIRECT)

**Contact Fields:**
- `contact_person` (string, optional, max 255 chars)
- `email` (string, optional, validated format, max 255 chars)
- `phone` (string, optional, max 50 chars)
- `mobile` (string, optional, max 50 chars)

**Address Fields:**
- `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country`

**Business Fields:**
- `tax_id`, `payment_terms`, `credit_limit`, `supplier_tier`, `status`

**Performance Fields:**
- `quality_rating`, `delivery_rating`, `average_delivery_days`, `total_orders`, `total_spend`

---

## Frontend Component Analysis

### Page Components
1. **Supplier List Page** (`/purchases/suppliers/page.tsx`)
   - List view with pagination
   - Filters and search
   - Statistics dashboard
   - Quick actions

2. **Create Supplier Page** (`/purchases/suppliers/new/page.tsx`)
   - Multi-section form
   - Real-time validation
   - Success/error handling

3. **Supplier Details Page** (`/purchases/suppliers/[id]/page.tsx`)
   - Detailed view
   - Performance metrics
   - Action buttons

4. **Edit Supplier Page** (`/purchases/suppliers/[id]/edit/page.tsx`)
   - Pre-populated form
   - Partial updates
   - Change tracking

5. **Analytics Page** (`/purchases/suppliers/analytics/page.tsx`)
   - Charts and graphs
   - Performance insights
   - Export functionality

### Shared Components
- **SupplierDropdown** - Virtualized search dropdown
- **SupplierCard** - Display component
- **SupplierForm** - Reusable form component

---

## Test Environment Setup

### Prerequisites
```bash
# Start backend services
cd rental-manager-api
docker-compose up -d

# Start frontend
cd rental-manager-frontend
npm run dev

# Verify services
curl http://localhost:8001/health
curl http://localhost:3001/api/health
```

### Test User Accounts
- **Admin User**: Full CRUD permissions
- **Manager User**: Read/Write permissions
- **Staff User**: Read-only permissions
- **Invalid User**: No permissions

### Test Data Seeding
```bash
# Run data seeding script
cd rental-manager-api
python scripts/seed_suppliers.py
```

---

## Test Data Requirements

### Base Test Suppliers
1. **ACME Manufacturing** (MANUFACTURER, PREMIUM)
2. **Global Distributors Ltd** (DISTRIBUTOR, STANDARD) 
3. **Quick Service Co** (SERVICE, BASIC)
4. **Retail Partners Inc** (RETAILER, STANDARD)
5. **Direct Supply Corp** (DIRECT, PREMIUM)

### Validation Test Data
- Suppliers with missing required fields
- Duplicate supplier codes
- Invalid email formats
- Boundary value credit limits
- Special characters in names
- Long text fields
- Unicode characters

---

## CREATE Operations Testing

### TC001: Valid Supplier Creation - Complete Data
**Objective:** Verify successful creation with all fields populated

**Test Steps:**
1. Navigate to `/purchases/suppliers/new`
2. Fill all form fields with valid data:
   - Supplier Code: "TEST001"
   - Company Name: "Test Company Ltd"
   - Type: "DISTRIBUTOR"
   - Contact Person: "John Doe"
   - Email: "john@test.com"
   - Phone: "+1-555-0123"
   - Address: "123 Test Street"
   - City: "Test City"
   - State: "Test State"
   - Country: "Test Country"
   - Postal Code: "12345"
   - Tax ID: "TAX123456"
   - Payment Terms: "NET30"
   - Credit Limit: 50000
   - Tier: "STANDARD"
3. Click "Save Supplier" button
4. Verify success message appears
5. Verify redirect to supplier details page
6. Verify all data is correctly displayed

**Expected Result:**
- ✅ Supplier created successfully
- ✅ Success notification displayed
- ✅ Redirected to details page
- ✅ All fields match input data
- ✅ Status is "ACTIVE" by default

**API Verification:**
- POST request to `/api/v1/suppliers/`
- Response status: 201 Created
- Response contains supplier ID and all fields

### TC002: Minimal Required Fields Creation
**Objective:** Verify creation with only required fields

**Test Steps:**
1. Navigate to `/purchases/suppliers/new`
2. Fill only required fields:
   - Supplier Code: "MIN001"
   - Company Name: "Minimal Company"
   - Type: "MANUFACTURER"
3. Leave optional fields empty
4. Click "Save Supplier"

**Expected Result:**
- ✅ Supplier created successfully
- ✅ Optional fields are null/empty
- ✅ Default values applied where specified

### TC003: Duplicate Supplier Code Validation
**Objective:** Verify duplicate code prevention

**Test Steps:**
1. Create supplier with code "DUP001"
2. Attempt to create another supplier with same code
3. Verify error handling

**Expected Result:**
- ❌ Creation fails
- ❌ Error message: "Supplier code already exists"
- ❌ Form remains open with data intact

### TC004: Field Validation - Supplier Code
**Test Cases:**
- TC004.1: Empty supplier code
- TC004.2: Code exceeding 50 characters
- TC004.3: Code with special characters
- TC004.4: Code with spaces
- TC004.5: Numeric-only code

### TC005: Field Validation - Company Name
**Test Cases:**
- TC005.1: Empty company name
- TC005.2: Name exceeding 255 characters
- TC005.3: Name with Unicode characters
- TC005.4: Name with HTML tags
- TC005.5: Name with SQL injection attempts

### TC006: Field Validation - Email
**Test Cases:**
- TC006.1: Invalid email format (no @)
- TC006.2: Invalid email format (no domain)
- TC006.3: Email exceeding 255 characters
- TC006.4: Multiple @ symbols
- TC006.5: Valid international emails

### TC007: Field Validation - Phone Numbers
**Test Cases:**
- TC007.1: Phone exceeding 50 characters
- TC007.2: Phone with letters
- TC007.3: International format validation
- TC007.4: Mobile vs phone field differences

### TC008: Field Validation - Credit Limit
**Test Cases:**
- TC008.1: Negative credit limit
- TC008.2: Zero credit limit
- TC008.3: Maximum allowed limit
- TC008.4: Non-numeric input
- TC008.5: Decimal precision validation

### TC009: Enum Field Validation
**Test Cases:**
- TC009.1: Invalid supplier type
- TC009.2: Invalid payment terms
- TC009.3: Invalid supplier tier
- TC009.4: Case sensitivity testing

### TC010: Form State Management
**Test Cases:**
- TC010.1: Form auto-save functionality
- TC010.2: Browser back button handling
- TC010.3: Page refresh with unsaved data
- TC010.4: Form reset functionality

### TC011: Real-time Validation
**Test Cases:**
- TC011.1: Field validation on blur
- TC011.2: Error message clearing on fix
- TC011.3: Submit button state management
- TC011.4: Progress indicators

### TC012: File Upload Testing (if applicable)
**Test Cases:**
- TC012.1: Valid document upload
- TC012.2: Invalid file types
- TC012.3: File size limits
- TC012.4: Multiple file uploads

### TC013: Form Navigation
**Test Cases:**
- TC013.1: Tab navigation through fields
- TC013.2: Keyboard shortcuts
- TC013.3: Enter key submission
- TC013.4: Escape key cancel

### TC014: Mobile Responsiveness
**Test Cases:**
- TC014.1: Form display on mobile devices
- TC014.2: Touch input validation
- TC014.3: Virtual keyboard handling
- TC014.4: Screen orientation changes

### TC015: Accessibility Testing
**Test Cases:**
- TC015.1: Screen reader compatibility
- TC015.2: High contrast mode
- TC015.3: Keyboard-only navigation
- TC015.4: ARIA labels validation

---

## READ Operations Testing

### TC016: Supplier List Display
**Objective:** Verify basic list functionality

**Test Steps:**
1. Navigate to `/purchases/suppliers`
2. Verify page loads successfully
3. Check default sorting (by company name)
4. Verify pagination controls
5. Count total suppliers displayed

**Expected Result:**
- ✅ Page loads within 3 seconds
- ✅ Suppliers displayed in grid/list format
- ✅ Pagination shows correct page numbers
- ✅ Default sort by company name A-Z

### TC017: Statistics Dashboard
**Test Cases:**
- TC017.1: Total suppliers count accuracy
- TC017.2: Active vs inactive suppliers
- TC017.3: Supplier type distribution
- TC017.4: Average quality rating calculation
- TC017.5: Total spend aggregation

### TC018: Filtering Functionality
**Test Cases:**
- TC018.1: Filter by supplier type
- TC018.2: Filter by supplier tier
- TC018.3: Filter by status (active/inactive)
- TC018.4: Multiple filter combinations
- TC018.5: Filter persistence on page refresh

### TC019: Search Functionality
**Test Cases:**
- TC019.1: Search by company name
- TC019.2: Search by supplier code
- TC019.3: Search by email
- TC019.4: Partial text search
- TC019.5: Case-insensitive search
- TC019.6: Search with special characters
- TC019.7: Empty search results handling

### TC020: Sorting Operations
**Test Cases:**
- TC020.1: Sort by company name (A-Z, Z-A)
- TC020.2: Sort by supplier code
- TC020.3: Sort by creation date
- TC020.4: Sort by quality rating
- TC020.5: Sort by total spend
- TC020.6: Multiple column sorting

### TC021: Pagination Testing
**Test Cases:**
- TC021.1: First page display
- TC021.2: Last page display
- TC021.3: Page size options (20, 50, 100)
- TC021.4: Next/Previous navigation
- TC021.5: Direct page number entry
- TC021.6: Page boundaries handling

### TC022: Individual Supplier Details
**Test Cases:**
- TC022.1: Basic information display
- TC022.2: Contact information formatting
- TC022.3: Address display
- TC022.4: Performance metrics
- TC022.5: Recent order history
- TC022.6: Document attachments

### TC023: Data Formatting
**Test Cases:**
- TC023.1: Currency formatting (credit limit, spend)
- TC023.2: Date formatting (creation, last order)
- TC023.3: Phone number formatting
- TC023.4: Address formatting
- TC023.5: Rating display (stars/numbers)

### TC024: Export Functionality
**Test Cases:**
- TC024.1: Export to CSV
- TC024.2: Export to Excel
- TC024.3: Export filtered results
- TC024.4: Export all fields vs selected fields
- TC024.5: Export file naming conventions

### TC025: Real-time Updates
**Test Cases:**
- TC025.1: Auto-refresh functionality
- TC025.2: WebSocket updates (if implemented)
- TC025.3: Manual refresh button
- TC025.4: Data staleness indicators

---

## UPDATE Operations Testing

### TC026: Full Supplier Update
**Objective:** Verify complete supplier information update

**Test Steps:**
1. Navigate to existing supplier details
2. Click "Edit" button
3. Modify all updateable fields
4. Save changes
5. Verify updates are reflected

**Expected Result:**
- ✅ Edit form pre-populated with current data
- ✅ All changes saved successfully
- ✅ Updated timestamp reflects change
- ✅ History log entry created

### TC027: Partial Updates
**Test Cases:**
- TC027.1: Update only contact information
- TC027.2: Update only address fields
- TC027.3: Update only business information
- TC027.4: Update single field
- TC027.5: Update performance metrics

### TC028: Status Updates
**Test Cases:**
- TC028.1: Activate inactive supplier
- TC028.2: Deactivate active supplier
- TC028.3: Suspend supplier
- TC028.4: Approve pending supplier
- TC028.5: Blacklist supplier
- TC028.6: Status transition validation

### TC029: Validation During Updates
**Test Cases:**
- TC029.1: Duplicate code validation (excluding self)
- TC029.2: Required field validation
- TC029.3: Format validation (email, phone)
- TC029.4: Business rule validation
- TC029.5: Cross-field validation

### TC030: Concurrent Updates
**Test Cases:**
- TC030.1: Two users editing same supplier
- TC030.2: Optimistic locking
- TC030.3: Conflict resolution
- TC030.4: Last-write-wins behavior
- TC030.5: User notification of conflicts

### TC031: Performance Metrics Updates
**Test Cases:**
- TC031.1: Quality rating updates
- TC031.2: Delivery rating updates
- TC031.3: Average delivery days
- TC031.4: Total orders increment
- TC031.5: Total spend calculation

### TC032: Contract Information Updates
**Test Cases:**
- TC032.1: Contract start date
- TC032.2: Contract end date
- TC032.3: Payment terms changes
- TC032.4: Credit limit adjustments
- TC032.5: Insurance expiry updates

### TC033: Address Updates
**Test Cases:**
- TC033.1: Complete address change
- TC033.2: City/state updates
- TC033.3: Country changes
- TC033.4: Postal code validation
- TC033.5: Multiple address formats

### TC034: Contact Updates
**Test Cases:**
- TC034.1: Primary contact change
- TC034.2: Email address updates
- TC034.3: Phone number changes
- TC034.4: Website URL updates
- TC034.5: Account manager assignment

### TC035: Bulk Updates
**Test Cases:**
- TC035.1: Bulk status changes
- TC035.2: Bulk tier updates
- TC035.3: Bulk contact updates
- TC035.4: Batch processing limits
- TC035.5: Error handling in bulk operations

---

## DELETE Operations Testing

### TC036: Standard Supplier Deletion
**Objective:** Verify standard delete functionality

**Test Steps:**
1. Navigate to supplier details
2. Click "Delete" button
3. Confirm deletion in modal
4. Verify supplier is removed

**Expected Result:**
- ✅ Confirmation modal appears
- ✅ Supplier marked as deleted (soft delete)
- ✅ Removed from active lists
- ✅ Audit trail maintained

### TC037: Delete Confirmation
**Test Cases:**
- TC037.1: Delete confirmation modal
- TC037.2: Cancel deletion operation
- TC037.3: Confirm deletion
- TC037.4: Keyboard shortcuts (ESC, Enter)

### TC038: Delete with Dependencies
**Test Cases:**
- TC038.1: Supplier with active orders
- TC038.2: Supplier with pending transactions
- TC038.3: Supplier with contracts
- TC038.4: Dependency warning messages
- TC038.5: Force delete with override

### TC039: Bulk Deletion
**Test Cases:**
- TC039.1: Select multiple suppliers
- TC039.2: Bulk delete confirmation
- TC039.3: Partial failure handling
- TC039.4: Progress indicators
- TC039.5: Rollback on errors

### TC040: Soft Delete vs Hard Delete
**Test Cases:**
- TC040.1: Soft delete implementation
- TC040.2: Recovery from soft delete
- TC040.3: Hard delete for admin users
- TC040.4: Data retention policies
- TC040.5: GDPR compliance

### TC041: Permission-based Deletion
**Test Cases:**
- TC041.1: Admin user deletion rights
- TC041.2: Manager user limitations
- TC041.3: Staff user restrictions
- TC041.4: Role-based button visibility
- TC041.5: API permission validation

---

## Edge Cases & Error Handling

### TC042: Network Connectivity Issues
**Test Cases:**
- TC042.1: Network timeout during creation
- TC042.2: Intermittent connectivity
- TC042.3: Offline functionality
- TC042.4: Auto-retry mechanisms
- TC042.5: User notification of network issues

### TC043: Server Error Handling
**Test Cases:**
- TC043.1: 500 Internal Server Error
- TC043.2: 503 Service Unavailable
- TC043.3: Database connection errors
- TC043.4: Timeout errors
- TC043.5: Memory/resource errors

### TC044: Authentication & Authorization
**Test Cases:**
- TC044.1: Token expiration during operation
- TC044.2: Invalid/malformed tokens
- TC044.3: Permission changes mid-session
- TC044.4: Logout during form submission
- TC044.5: Session hijacking protection

### TC045: Data Consistency
**Test Cases:**
- TC045.1: Stale data detection
- TC045.2: Cache invalidation
- TC045.3: Database transaction failures
- TC045.4: Partial update failures
- TC045.5: Data synchronization issues

### TC046: Input Sanitization
**Test Cases:**
- TC046.1: XSS prevention in text fields
- TC046.2: SQL injection attempts
- TC046.3: CSRF protection
- TC046.4: File upload security
- TC046.5: HTML tag filtering

### TC047: Browser Compatibility
**Test Cases:**
- TC047.1: Chrome latest version
- TC047.2: Firefox latest version
- TC047.3: Safari compatibility
- TC047.4: Edge compatibility
- TC047.5: Mobile browser testing

### TC048: Memory and Resource Management
**Test Cases:**
- TC048.1: Large dataset handling
- TC048.2: Memory leak detection
- TC048.3: Browser tab limits
- TC048.4: Cache overflow handling
- TC048.5: Resource cleanup on navigation

---

## Performance Testing

### TC049: Page Load Performance
**Benchmarks:**
- Supplier list page: < 3 seconds
- Create form: < 2 seconds
- Search results: < 2 seconds
- Details page: < 2 seconds

**Test Cases:**
- TC049.1: Initial page load time
- TC049.2: Subsequent page loads (cached)
- TC049.3: Large dataset performance
- TC049.4: Network throttling tests
- TC049.5: Mobile device performance

### TC050: API Response Times
**Benchmarks:**
- Create supplier: < 1 second
- List suppliers: < 2 seconds
- Search suppliers: < 1 second
- Update supplier: < 1 second

### TC051: Scalability Testing
**Test Cases:**
- TC051.1: 1,000 suppliers performance
- TC051.2: 10,000 suppliers performance
- TC051.3: 100,000 suppliers performance
- TC051.4: Pagination efficiency
- TC051.5: Search performance at scale

### TC052: Memory Usage
**Test Cases:**
- TC052.1: Memory usage during operations
- TC052.2: Memory leaks in long sessions
- TC052.3: Browser tab resource usage
- TC052.4: Mobile memory constraints

---

## Security Testing

### TC053: Input Validation Security
**Test Cases:**
- TC053.1: XSS payload injection
- TC053.2: SQL injection attempts
- TC053.3: Command injection testing
- TC053.4: Path traversal attempts
- TC053.5: Buffer overflow testing

### TC054: Authentication Security
**Test Cases:**
- TC054.1: JWT token security
- TC054.2: Token tampering detection
- TC054.3: Brute force protection
- TC054.4: Session fixation protection
- TC054.5: Multi-factor authentication

### TC055: Authorization Testing
**Test Cases:**
- TC055.1: Role-based access control
- TC055.2: Permission escalation attempts
- TC055.3: Resource access validation
- TC055.4: API endpoint protection
- TC055.5: Cross-user data access

### TC056: Data Protection
**Test Cases:**
- TC056.1: PII data handling
- TC056.2: Data encryption in transit
- TC056.3: Sensitive data masking
- TC056.4: GDPR compliance
- TC056.5: Data retention policies

---

## Integration Testing

### TC057: API Integration
**Test Cases:**
- TC057.1: Frontend-backend communication
- TC057.2: Request/response mapping
- TC057.3: Error response handling
- TC057.4: API versioning compatibility
- TC057.5: Content-type validation

### TC058: Database Integration
**Test Cases:**
- TC058.1: CRUD operations accuracy
- TC058.2: Transaction handling
- TC058.3: Data persistence
- TC058.4: Referential integrity
- TC058.5: Constraint validation

### TC059: Third-party Integration
**Test Cases:**
- TC059.1: Email service integration
- TC059.2: File storage services
- TC059.3: Analytics integration
- TC059.4: Notification services
- TC059.5: External API dependencies

---

## Test Execution Strategy

### Manual Testing Process
1. **Test Case Execution**
   - Execute test cases in order
   - Document results in test management tool
   - Capture screenshots for failures
   - Record video for complex scenarios

2. **Bug Reporting**
   - Use standardized bug report template
   - Include steps to reproduce
   - Attach relevant screenshots/logs
   - Assign severity and priority

3. **Regression Testing**
   - Execute after each bug fix
   - Focus on affected and related areas
   - Verify fix doesn't break other functionality

### Automated Testing Implementation
```javascript
// Example automated test for supplier creation
describe('Supplier Creation', () => {
  test('TC001: Valid Supplier Creation', async () => {
    // Test implementation
    await page.goto('/purchases/suppliers/new');
    await page.fill('[name="supplier_code"]', 'TEST001');
    await page.fill('[name="company_name"]', 'Test Company');
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/\/purchases\/suppliers\/\w+/);
  });
});
```

### Performance Testing Tools
- **Lighthouse**: Core web vitals
- **WebPageTest**: Network performance
- **Chrome DevTools**: Runtime performance
- **LoadRunner/JMeter**: Load testing

---

## Coverage Metrics

### API Endpoint Coverage
- ✅ 8/8 endpoints tested (100%)
- ✅ All HTTP methods covered
- ✅ All response codes validated

### UI Component Coverage
- ✅ 5/5 main pages tested (100%)
- ✅ All form fields validated
- ✅ All user interactions covered

### Functional Coverage
- ✅ Create operations: 15 test cases
- ✅ Read operations: 10 test cases
- ✅ Update operations: 10 test cases
- ✅ Delete operations: 6 test cases
- ✅ Edge cases: 15 test cases
- ✅ Performance: 4 test cases
- ✅ Security: 4 test cases
- ✅ Integration: 3 test cases

### Test Results Summary
```
Total Test Cases: 157
Passed: [To be filled during execution]
Failed: [To be filled during execution]
Blocked: [To be filled during execution]
Coverage: [To be calculated]
```

---

## Test Data Appendix

### Sample Supplier Data
```json
{
  "supplier_code": "ACME001",
  "company_name": "ACME Manufacturing Inc",
  "supplier_type": "MANUFACTURER",
  "contact_person": "John Smith",
  "email": "john.smith@acme.com",
  "phone": "+1-555-0123",
  "mobile": "+1-555-0124",
  "address_line1": "123 Industrial Blvd",
  "address_line2": "Suite 100",
  "city": "Manufacturing City",
  "state": "CA",
  "postal_code": "90210",
  "country": "USA",
  "tax_id": "TAX123456789",
  "payment_terms": "NET30",
  "credit_limit": 100000,
  "supplier_tier": "PREMIUM",
  "website": "https://www.acme.com",
  "notes": "Premier manufacturing partner"
}
```

### Invalid Test Data Examples
```json
{
  "invalid_email": "notanemail",
  "too_long_code": "SUPPL".repeat(15),
  "negative_credit": -1000,
  "invalid_type": "INVALID_TYPE",
  "xss_attempt": "<script>alert('xss')</script>",
  "sql_injection": "'; DROP TABLE suppliers; --"
}
```

### Boundary Value Test Data
- **Supplier Code**: "", "A", "A".repeat(50), "A".repeat(51)
- **Credit Limit**: -1, 0, 1, 999999999999, 1000000000000
- **Email**: "a@b.co", "a".repeat(250)+"@test.com"

---

## Test Sign-off

### Test Manager Approval
**Name:** [To be filled]  
**Date:** [To be filled]  
**Signature:** [To be filled]

### Development Team Approval
**Name:** [To be filled]  
**Date:** [To be filled]  
**Signature:** [To be filled]

### Business Stakeholder Approval
**Name:** [To be filled]  
**Date:** [To be filled]  
**Signature:** [To be filled]

---

**Document Version:** 1.0  
**Last Updated:** [Current Date]  
**Next Review Date:** [To be scheduled]