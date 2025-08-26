# Location Functionality Test Plan

## Overview
This document outlines the comprehensive testing strategy for the location management functionality in the Rental Manager application, covering both frontend and backend components.

## Root Cause Analysis Summary
- **Issue**: Location dashboard showing 404 errors
- **Cause**: API endpoint mismatch between frontend (`/master-data/locations/`) and backend (`/locations/`)
- **Fix**: Updated frontend API service to use correct endpoint paths

## Test Categories

### 1. API Endpoint Testing (Backend)

#### 1.1 Core CRUD Operations
- **GET /api/v1/locations/** - List locations with pagination
  - ✅ Returns locations array
  - ✅ Handles pagination parameters (skip, limit)
  - ✅ Supports filtering by location_type, city, state, country
  - ✅ Supports search functionality
  - ✅ Handles empty results gracefully

- **POST /api/v1/locations/** - Create new location
  - ✅ Accepts valid location data
  - ✅ Validates required fields (location_code, location_name, location_type)
  - ✅ Returns created location with ID
  - ✅ Handles duplicate location codes
  - ✅ Validates email format
  - ✅ Validates coordinate ranges

- **GET /api/v1/locations/{id}** - Get location by ID
  - ✅ Returns location data for valid ID
  - ✅ Returns 404 for non-existent location
  - ✅ Handles UUID validation

- **PUT /api/v1/locations/{id}** - Update location
  - ✅ Updates specified fields only
  - ✅ Maintains data integrity
  - ✅ Validates updated data
  - ✅ Returns updated location

- **DELETE /api/v1/locations/{id}** - Soft delete location
  - ✅ Performs soft delete (sets is_active = false)
  - ✅ Prevents deletion of default location
  - ✅ Handles cascade deletion of child locations

#### 1.2 Advanced Operations
- **POST /api/v1/locations/{id}/activate** - Activate location
- **POST /api/v1/locations/{id}/deactivate** - Deactivate location
- **POST /api/v1/locations/{id}/assign-manager** - Assign manager
- **POST /api/v1/locations/{id}/remove-manager** - Remove manager
- **GET /api/v1/locations/analytics/statistics** - Get statistics

#### 1.3 Search and Filter Operations
- **POST /api/v1/locations/search** - Advanced search
- **POST /api/v1/locations/nearby** - Geospatial search
- **GET /api/v1/locations/{id}/hierarchy** - Get location hierarchy

### 2. Frontend Component Testing

#### 2.1 Location Dashboard (`/inventory/locations`)
- ✅ Loads without 404 errors
- ✅ Displays statistics cards (Total, Active, With Manager, New This Month)
- ✅ Shows location list with proper data
- ✅ Handles loading states
- ✅ Displays error messages appropriately
- ✅ Supports search functionality
- ✅ Supports filtering by type and status
- ✅ Handles pagination

#### 2.2 Location Creation Form (`/inventory/locations/new`)
- ✅ Form renders with all required fields
- ✅ Validates required fields (location_code, location_name, location_type)
- ✅ Validates optional field formats (email, phone, coordinates)
- ✅ Handles form submission
- ✅ Shows success/error messages
- ✅ Redirects appropriately after creation

#### 2.3 Location Edit Form (`/inventory/locations/{id}/edit`)
- ✅ Pre-populates form with existing data
- ✅ Allows partial updates
- ✅ Validates changes
- ✅ Handles update submission

#### 2.4 Location Detail View (`/inventory/locations/{id}`)
- ✅ Displays complete location information
- ✅ Shows hierarchical relationships
- ✅ Provides action buttons (Edit, Delete, Activate/Deactivate)

### 3. Integration Testing

#### 3.1 End-to-End Workflows
- **Location Creation Workflow**
  1. Navigate to locations dashboard
  2. Click "Add Location" button
  3. Fill in location form
  4. Submit form
  5. Verify success message
  6. Verify location appears in dashboard

- **Location Edit Workflow**
  1. Navigate to location detail/edit
  2. Modify location data
  3. Submit changes
  4. Verify updates are saved

- **Location Search Workflow**
  1. Enter search term in dashboard
  2. Verify filtered results
  3. Clear search
  4. Verify all locations shown

#### 3.2 Error Handling
- Network failures
- Invalid data submission
- Unauthorized access attempts
- Concurrent modification conflicts

### 4. Performance Testing

#### 4.1 Load Testing Scenarios
- **Large Dataset Rendering**
  - Test with 1,000+ locations
  - Verify pagination works correctly
  - Check virtual scrolling if implemented

- **Search Performance**
  - Test search with large datasets
  - Verify debounced search implementation
  - Check response times for complex queries

- **Form Submission Performance**
  - Test with maximum field lengths
  - Verify timeout handling
  - Check progress indicators

#### 4.2 Memory and Resource Usage
- Monitor memory usage during long sessions
- Check for memory leaks in location list
- Verify cleanup of event listeners

### 5. Security Testing

#### 5.1 Authentication & Authorization
- Verify JWT token validation
- Test unauthorized access attempts
- Check role-based permissions

#### 5.2 Data Validation
- SQL injection prevention
- XSS prevention in form inputs
- CSRF token validation

### 6. Browser Compatibility Testing

#### 6.1 Supported Browsers
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

#### 6.2 Responsive Design
- Mobile devices (iPhone, Android)
- Tablet devices (iPad, Android tablets)
- Desktop resolutions (1920x1080, 1366x768)

## Test Execution Plan

### Phase 1: API Testing (Backend)
```bash
cd rental-manager-api
make test  # Run all backend tests
pytest tests/unit/test_location.py -v  # Location-specific tests
```

### Phase 2: Component Testing (Frontend)
```bash
cd rental-manager-frontend
npm test  # Run Jest unit tests
npm run test:api  # API integration tests
```

### Phase 3: End-to-End Testing
```bash
cd rental-manager-frontend
node test-location-creation.js  # Comprehensive E2E test
```

### Phase 4: Manual Testing
1. Start development environment: `docker-compose up -d`
2. Navigate to http://localhost:3000/inventory/locations
3. Execute manual test scenarios
4. Document any issues found

## Test Data

### Valid Location Data
```json
{
  "location_code": "WH-001",
  "location_name": "Main Warehouse",
  "location_type": "WAREHOUSE",
  "address": "123 Storage Way",
  "city": "Inventory City",
  "state": "Storage State",
  "country": "Test Country",
  "postal_code": "12345",
  "contact_number": "+1234567890",
  "email": "warehouse@example.com",
  "contact_person": "John Manager"
}
```

### Edge Case Data
```json
{
  "location_code": "A",  // Minimum length
  "location_name": "X".repeat(100),  // Maximum length
  "location_type": "STORE",
  "latitude": 90.0,  // Maximum latitude
  "longitude": -180.0,  // Minimum longitude
  "capacity": 0  // Minimum capacity
}
```

### Invalid Data (Should Fail)
```json
{
  "location_code": "",  // Empty required field
  "location_name": "X".repeat(101),  // Exceeds max length
  "location_type": "INVALID_TYPE",  // Invalid enum value
  "email": "invalid-email",  // Invalid email format
  "latitude": 91.0,  // Out of range
  "capacity": -1  // Negative capacity
}
```

## Success Criteria

### Must Pass
- ✅ All API endpoints return correct status codes
- ✅ Location dashboard loads without errors
- ✅ Location creation works end-to-end
- ✅ Location editing works correctly
- ✅ Search and filter functionality works
- ✅ Data validation prevents invalid submissions

### Should Pass
- ✅ Performance meets acceptable thresholds
- ✅ Error messages are user-friendly
- ✅ Loading states provide good UX
- ✅ Responsive design works on all devices

### Nice to Have
- ✅ Advanced search features work
- ✅ Bulk operations perform well
- ✅ Export functionality works
- ✅ Geospatial features work correctly

## Known Issues & Limitations

### Fixed Issues
- ❌ **FIXED**: API endpoint mismatch causing 404 errors
- ❌ **FIXED**: Frontend service using `/master-data/locations/` instead of `/locations/`

### Outstanding Issues
- None currently identified

### Future Enhancements
- Add location import/export functionality
- Implement advanced geospatial features
- Add location analytics dashboard
- Implement location hierarchy management UI

## Maintenance & Updates

### Regular Testing Schedule
- **Daily**: Automated API tests in CI/CD
- **Weekly**: Frontend component tests
- **Monthly**: Full E2E test suite
- **Quarterly**: Performance and security testing

### Test Data Management
- Refresh test data monthly
- Maintain separate test database
- Clean up test artifacts after runs

## Reporting & Documentation

### Test Results Format
- Automated test results in JUnit XML format
- Manual test results in shared spreadsheet
- Screenshots for failed UI tests
- Performance metrics tracking over time

### Issue Tracking
- Log all bugs in GitHub Issues
- Tag with appropriate labels (bug, frontend, backend, etc.)
- Assign severity levels (critical, high, medium, low)
- Track resolution timeline

---

**Last Updated**: $(date)
**Test Plan Version**: 1.0
**Reviewed By**: Development Team