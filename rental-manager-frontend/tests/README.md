# Rental Management System - E2E Test Suite

A comprehensive Puppeteer-based end-to-end testing framework for the Rental Management System, covering purchase transactions, rental workflows, edge cases, and form validation.

## 🎯 Test Coverage

### Core Test Suites

1. **Purchase Transaction Tests** (`transactions/purchase-transaction-tests.js`)
   - Basic purchase creation workflow
   - Serial number handling for tracked items
   - Multi-item purchase transactions
   - Edge cases (zero quantities, negative values, etc.)
   - Purchase list navigation and search functionality

2. **Rental Transaction Tests** (`transactions/rental-transaction-tests.js`)
   - Complete rental creation workflow
   - Date validation for rental periods
   - Multi-item rentals with different rental periods
   - Rental return process testing
   - Rental search and filtering functionality

3. **Edge Case Tests** (`edge-cases/edge-case-tests.js`)
   - Input validation and security testing (XSS, SQL injection)
   - Numeric boundary conditions
   - Date boundary conditions and validation
   - Form state management and session handling
   - Performance and load testing

4. **Form Validation Tests** (via `main-test-runner.js`)
   - Comprehensive validation of key forms
   - Required field enforcement
   - Email format validation
   - Numeric input constraints
   - Accessibility compliance testing

### Supporting Modules

- **Authentication Helper** (`helpers/auth-helper.js`) - Robust login handling with retry logic
- **Test Data Generator** (`helpers/test-data-generator.js`) - Realistic test data creation
- **Validation Helper** (`helpers/validation-helper.js`) - Reusable form validation utilities

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install puppeteer

# Ensure the application is running
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

### Running Tests

#### Run All Tests
```bash
# Run complete test suite (headless)
node tests/main-test-runner.js

# Run with browser visible
node tests/main-test-runner.js --visible

# Run specific test suites
node tests/main-test-runner.js --suites=purchase,rental

# Run tests in parallel (experimental)
node tests/main-test-runner.js --parallel
```

#### Run Individual Test Suites
```bash
# Purchase transaction tests only
node tests/transactions/purchase-transaction-tests.js

# Rental transaction tests only
node tests/transactions/rental-transaction-tests.js

# Edge case tests only
node tests/edge-cases/edge-case-tests.js
```

### Configuration Options

```javascript
const config = {
    baseUrl: 'http://localhost:3000',        // Frontend URL
    backendUrl: 'http://localhost:8000',     // Backend URL
    timeout: 30000,                          // Default timeout (ms)
    headless: true,                          // Run in headless mode
    screenshotDir: './test-screenshots',     // Screenshot directory
    viewport: { width: 1920, height: 1080 }, // Browser viewport
    testSuites: ['purchase', 'rental', 'edge-cases', 'validation']
};
```

## 📊 Test Results and Reporting

### Screenshot Capture
- Automatic screenshots for all major test steps
- Error screenshots when tests fail
- Organized by test suite and timestamp

### Comprehensive Reporting
- Detailed JSON report: `test-screenshots/test-report.json`
- Summary text report: `test-screenshots/test-summary.txt`
- Console output with color-coded results

### Sample Output
```
📊 COMPREHENSIVE TEST EXECUTION REPORT
=====================================
⏱️ EXECUTION SUMMARY:
  Total Duration: 45.67 seconds
  Test Suites: 4

📈 OVERALL RESULTS:
  Total Tests: 28
  Passed: 24 ✅
  Failed: 4 ❌
  Success Rate: 85.7%
  Screenshots: 67

🎯 TEST SUITE BREAKDOWN:
  ✅ Purchase Transactions: 8/10 passed (80.0%)
  ✅ Rental Transactions: 9/10 passed (90.0%)
  ⚠️ Edge Cases: 5/6 passed (83.3%)
  ✅ Form Validation: 2/2 passed (100.0%)
```

## 🔍 Test Details

### Purchase Transaction Tests

| Test | Description | Validation Points |
|------|-------------|-------------------|
| Basic Purchase Creation | Complete purchase workflow | Form fields, validation, submission |
| Serial Number Handling | Serialized item management | Serial number input, tracking |
| Multi-Item Purchase | Large order processing | Item addition, calculation, performance |
| Edge Cases | Boundary conditions | Invalid inputs, error handling |
| List and Search | Purchase management | Navigation, search, filtering |

### Rental Transaction Tests

| Test | Description | Validation Points |
|------|-------------|-------------------|
| Basic Rental Creation | Complete rental workflow | Date validation, item selection |
| Date Validation | Rental period constraints | Past dates, invalid ranges |
| Multi-Item Rentals | Complex rental scenarios | Multiple items, different periods |
| Return Process | Rental return workflow | Return forms, status updates |
| Search and Filtering | Rental management | Advanced filtering, status-based search |

### Edge Case Tests

| Category | Test Cases | Purpose |
|----------|------------|---------|
| Security | XSS, SQL injection, special characters | Input sanitization validation |
| Numeric | Zero values, negatives, large numbers | Boundary condition handling |
| Dates | Invalid dates, leap years, ranges | Date validation robustness |
| Forms | State persistence, rapid submission | Form behavior validation |
| Performance | Large datasets, rapid navigation | Load handling and memory usage |

## 🛠️ Advanced Usage

### Custom Test Configuration

```javascript
// Create custom configuration
const customConfig = {
    baseUrl: 'https://staging.example.com',
    headless: false,
    timeout: 60000,
    testSuites: ['purchase', 'rental'], // Run only specific suites
    screenshotDir: './custom-screenshots'
};

const runner = new MainTestRunner(customConfig);
runner.runAllTests();
```

### Running Specific Test Categories

```bash
# Security tests only
node tests/edge-cases/edge-case-tests.js

# Form validation for specific form
node -e "
const ValidationHelper = require('./tests/helpers/validation-helper');
// Custom validation logic here
"
```

### Parallel Test Execution

```bash
# Run test suites in parallel (faster but uses more resources)
node tests/main-test-runner.js --parallel
```

## 📋 Test Data Management

### Automatic Test Data Generation

The test suite includes a comprehensive data generator that creates:

- **Customers**: Random customer data with valid formats
- **Suppliers**: Business supplier information
- **Items**: Inventory items with SKUs and pricing
- **Transactions**: Purchase and rental transactions
- **Edge Case Data**: Invalid inputs for security testing

### Data Cleanup

Tests are designed to be non-destructive:
- Uses test-specific data when possible
- Creates fallback data if reference data is missing
- Includes cleanup recommendations in reports

## 🔧 Troubleshooting

### Common Issues

1. **Authentication Failures**
   ```bash
   # Verify admin credentials
   Username: admin@admin.com
   Password: YourSecure@Password123!
   ```

2. **Timeout Errors**
   ```bash
   # Increase timeout for slow systems
   node tests/main-test-runner.js --timeout=60000
   ```

3. **Missing Elements**
   - Check that the frontend is fully loaded
   - Verify that all required test data exists
   - Review screenshots for UI state verification

### Debug Mode

```bash
# Run with visible browser for debugging
node tests/main-test-runner.js --visible

# Enable additional logging
DEBUG=* node tests/main-test-runner.js
```

## 📈 Performance Benchmarks

### Expected Performance
- Purchase transaction creation: < 5 seconds
- Rental transaction creation: < 8 seconds
- Form validation tests: < 2 seconds per form
- Edge case battery: < 15 seconds
- Complete test suite: < 60 seconds

### Performance Monitoring
- Automatic timing for all operations
- Memory usage tracking
- Network request monitoring
- Screenshot capture impact measurement

## 🔐 Security Testing

### Automated Security Checks
- XSS prevention validation
- SQL injection attempt testing
- Input sanitization verification
- CSRF protection validation (where applicable)
- Authentication bypass prevention

### Security Test Results
Security tests validate that the application properly:
- Sanitizes dangerous HTML/JavaScript input
- Prevents SQL injection attempts
- Handles special characters safely
- Enforces proper authentication

## 🎯 CI/CD Integration

### Headless Execution
```bash
# Suitable for CI environments
node tests/main-test-runner.js --headless
```

### Exit Codes
- `0`: All tests passed
- `1`: One or more tests failed

### Jenkins/GitHub Actions Example
```yaml
- name: Run E2E Tests
  run: |
    npm install puppeteer
    node tests/main-test-runner.js --headless
    
- name: Upload Screenshots
  uses: actions/upload-artifact@v2
  if: always()
  with:
    name: test-screenshots
    path: test-screenshots/
```

## 🤝 Contributing

### Adding New Tests

1. Create test file in appropriate directory
2. Extend existing test classes or create new ones
3. Update main test runner configuration
4. Add documentation for new test cases

### Test Structure
```javascript
class NewTestSuite {
    constructor(config) {
        // Initialize with configuration
    }
    
    async testSpecificFeature(page) {
        // Test implementation
        this.logTest('Feature Name', 'PASS|FAIL', 'Details');
    }
    
    async runAllTests() {
        // Test orchestration
    }
}
```

## 📖 Reference

### Test File Structure
```
tests/
├── helpers/
│   ├── auth-helper.js          # Authentication utilities
│   ├── test-data-generator.js  # Test data creation
│   └── validation-helper.js    # Form validation utilities
├── transactions/
│   ├── purchase-transaction-tests.js
│   └── rental-transaction-tests.js
├── edge-cases/
│   └── edge-case-tests.js
├── main-test-runner.js         # Main orchestrator
└── README.md                   # This file
```

### Environment Requirements
- Node.js 14+
- Puppeteer compatible Chrome/Chromium
- Frontend running on port 3000
- Backend running on port 8000
- Admin user credentials configured

---

**Built for comprehensive testing of the Rental Management System** 🚀