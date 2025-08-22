# Sales Feature Testing Suite

This directory contains a comprehensive testing suite for the Sales feature implementation. The tests validate both frontend UI functionality and backend API integration, with special focus on inventory impact verification.

## 🎯 Test Overview

The testing suite consists of three main components:

1. **Test Data Setup** - Prepares the system with necessary data
2. **API Workflow Test** - Validates backend functionality
3. **Frontend E2E Test** - Tests complete user workflows

## 📋 Prerequisites

### System Requirements
- Node.js 16+ with npm
- Backend server running at `http://localhost:8000`
- Frontend server running at `http://localhost:3000` (for E2E tests)
- PostgreSQL database with proper migrations
- Admin user account (`admin@admin.com` / `YourSecure@Password123!`)

### Required Dependencies
```bash
npm install puppeteer node-fetch
```

### Environment Setup
1. Ensure backend server is running:
   ```bash
   cd rental-manager-backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. Ensure frontend server is running:
   ```bash
   cd rental-manager-frontend
   npm run dev
   ```

3. Verify database is accessible and migrations are up to date:
   ```bash
   cd rental-manager-backend
   alembic upgrade head
   ```

## 🚀 Running Tests

### Quick Start - Run All Tests
```bash
# Run the complete test suite
node run-sales-comprehensive-test.js
```

### Individual Test Scripts

#### 1. Setup Test Data
```bash
# Prepare test customers, items, and inventory
node setup-sales-test-data.js
```
**What it does:**
- Creates test customers (Test Customer Corp, Demo Sales Customer)
- Sets up test locations (Main Warehouse, Sales Floor)
- Creates saleable items with sufficient inventory
- Verifies system readiness for testing

#### 2. API Workflow Test
```bash
# Test sales API endpoints and inventory integration
node test-sales-api-workflow.js
```
**What it does:**
- Authenticates with the backend API
- Records initial inventory levels
- Creates a sale transaction via API
- Verifies inventory reduction matches sale quantities
- Checks stock movement records creation
- Validates transaction details and status

#### 3. Frontend E2E Test
```bash
# Test complete UI workflow with Puppeteer
node test-sales-creation-inventory.js
```
**What it does:**
- Opens browser and navigates to sales creation page
- Fills out customer information and sale items
- Submits the sale transaction
- Verifies successful creation and inventory impact
- Takes screenshots at each step for visual verification

## 📊 Test Results

### Output Locations
- **Screenshots**: `./test-screenshots/sales-creation/`
- **Test Reports**: `./test-results/`
- **Console Output**: Real-time progress and results

### Understanding Results

#### Success Indicators
- ✅ Green checkmarks indicate passed tests
- 📊 Inventory levels correctly reduced
- 🆔 Transaction ID generated and retrievable
- 📋 Stock movement records created

#### Failure Indicators
- ❌ Red X marks indicate failed tests
- Error messages with specific failure reasons
- Screenshots showing UI state at failure point

### Sample Output
```
🚀 COMPREHENSIVE SALES TEST SUMMARY
============================================================
⏱️  Total Duration: 45.2s
📋 Total Tests: 7
✅ Passed: 7
❌ Failed: 0
⏭️  Skipped: 0
📈 Success Rate: 100.0%

📋 Detailed Results:
   ✅ PASS Test Data Setup (12.3s)
   ✅ PASS Sales API Workflow Test (18.7s)
   ✅ PASS Sales Frontend E2E Test (14.2s)
```

## 🔧 Configuration

### Environment Variables
```bash
# Backend URL (default: http://localhost:8000)
BACKEND_URL=http://localhost:8000

# Frontend URL (default: http://localhost:3000)  
FRONTEND_URL=http://localhost:3000
```

### Test Data Configuration
Edit `setup-sales-test-data.js` to modify:
- Customer information and types
- Location details and types
- Item specifications and pricing
- Initial inventory quantities

### Test Parameters
Edit individual test files to adjust:
- Timeouts and wait periods
- Screenshot settings
- API endpoints
- Test data quantities

## 📋 Test Scenarios Covered

### Backend API Tests
- [x] User authentication and authorization
- [x] Customer data retrieval and validation
- [x] Item availability checking
- [x] Sale transaction creation
- [x] Inventory level verification
- [x] Stock movement record creation
- [x] Transaction detail retrieval
- [x] Sales listing and filtering

### Frontend UI Tests
- [x] Page navigation and loading
- [x] Customer selection dropdown/autocomplete
- [x] Item selection and quantity input
- [x] Price calculation and total computation
- [x] Form validation and error handling
- [x] Transaction submission
- [x] Success confirmation and redirection

### Inventory Integration Tests
- [x] Initial inventory level recording
- [x] Stock reduction calculation accuracy
- [x] Multi-item transaction handling
- [x] Stock movement audit trail
- [x] Concurrent transaction handling
- [x] Insufficient stock validation

## 🐛 Troubleshooting

### Common Issues

#### "Authentication failed"
- Verify admin user exists: `admin@admin.com` / `YourSecure@Password123!`
- Check backend server is running and accessible
- Ensure database connection is working

#### "Item not found" or "Insufficient stock"
- Run the setup script first: `node setup-sales-test-data.js`
- Check that items exist in the database
- Verify inventory levels are sufficient

#### "Cannot connect to backend"
- Ensure backend server is running on correct port
- Check firewall settings and network connectivity
- Verify API endpoints are responding

#### "Puppeteer browser errors"
- Install Chromium: `npx puppeteer browsers install chrome`
- Run in headless mode by setting `HEADLESS: true` in config
- Check for sufficient system resources

#### "Frontend not accessible"
- Ensure frontend dev server is running
- Check for port conflicts (default 3000)
- Verify no build errors in frontend

### Debug Mode
Enable detailed logging by setting environment variables:
```bash
DEBUG=true node test-sales-api-workflow.js
```

For Puppeteer debugging, set `HEADLESS: false` in the test configuration to see browser actions.

## 📈 Performance Considerations

### Test Duration
- **Setup**: ~10-15 seconds
- **API Tests**: ~15-25 seconds  
- **E2E Tests**: ~20-40 seconds
- **Total**: ~45-80 seconds

### Resource Usage
- **Memory**: ~200-500MB during E2E tests
- **CPU**: Moderate during browser automation
- **Network**: Light API calls, mostly localhost
- **Storage**: Screenshots ~2-10MB per test run

### Optimization Tips
- Run API tests first to validate backend before UI tests
- Use headless mode for faster execution
- Clear test data between runs if needed
- Run tests on dedicated test database

## 🔄 Continuous Integration

### CI/CD Integration
```yaml
# Example GitHub Actions workflow
name: Sales Feature Tests
on: [push, pull_request]
jobs:
  sales-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: node run-sales-comprehensive-test.js
```

### Docker Support
```dockerfile
# Add to your test Dockerfile
RUN npx puppeteer browsers install chrome
COPY test-*.js ./
RUN node run-sales-comprehensive-test.js
```

## 📚 Additional Resources

### Related Documentation
- [Sales API Documentation](../api-docs/sales-api.md)
- [Frontend Component Documentation](../src/components/sales/README.md)
- [Database Schema](../docs/database-schema.md)

### External Tools
- [Puppeteer Documentation](https://pptr.dev/)
- [Jest Testing Framework](https://jestjs.io/)
- [Node-fetch Library](https://github.com/node-fetch/node-fetch)

## 🤝 Contributing

### Adding New Tests
1. Follow the existing test patterns
2. Include proper error handling
3. Add descriptive console output
4. Update this README with new test descriptions

### Test Naming Convention
- `test-[feature]-[type].js` for test files
- `setup-[feature]-[purpose].js` for setup scripts
- `run-[feature]-[scope]-test.js` for test runners

### Code Style
- Use async/await for asynchronous operations
- Include comprehensive error handling
- Add descriptive console logging
- Take screenshots at key points for E2E tests

---

## 📞 Support

If you encounter issues with the testing suite:

1. Check the troubleshooting section above
2. Review the console output for specific error messages
3. Examine screenshots in the test results directory
4. Verify all prerequisites are met
5. Check backend logs for API-related issues

For additional support, refer to the main project documentation or create an issue with:
- Test output/error messages
- System configuration details
- Steps to reproduce the issue