# Rental Transaction Test Documentation

## Overview
Comprehensive test suite for rental creation and return transactions with various scenarios including edge cases, damage assessment, partial returns, and extensions.

## Test Files

### 1. `rental-test-utilities.js`
Shared utility functions and test data for all rental tests.

**Key Components:**
- Test configuration and constants
- Test user credentials
- Sample customer and item data
- Damage scenario definitions
- Helper functions for common operations
- API interaction utilities
- Cleanup functions

### 2. `test-rental-creation-comprehensive.js`
Tests various rental creation scenarios.

**Test Scenarios:**

#### Basic Scenarios
1. **Basic Single Item Rental**
   - Single item, daily rate
   - Expected: Creates rental with PENDING status

2. **Multiple Items Rental**
   - Multiple items, weekly rates
   - Expected: All items added to rental

3. **Monthly Rental with Discount**
   - Monthly pricing with percentage discount
   - Expected: Discount applied correctly

#### Advanced Features
4. **Rental with Delivery**
   - Includes delivery address and fee
   - Expected: Delivery details saved

5. **Rental with Scheduled Pickup**
   - Specific pickup time and location
   - Expected: Pickup scheduling recorded

6. **Large Quantity Rental**
   - High quantity of single item
   - Expected: Inventory availability checked

#### Special Cases
7. **Same Day Rental**
   - Hourly rental for same day
   - Expected: Minimum rental period enforced

8. **Long-term Rental (3 months)**
   - Extended period with special discount
   - Expected: Long-term rates applied

#### Edge Cases Tested
- Past date validation
- Overlapping rental detection
- Maximum quantity validation
- Customer credit limit checking

### 3. `test-rental-returns-comprehensive.js`
Tests various return scenarios with damage assessment and extensions.

## Return Test Scenarios

### Full Returns
1. **On-Time Full Return**
   - All items returned on schedule
   - Expected Outcome:
     - Status: COMPLETED
     - Late Fees: $0
     - Damage Charges: $0
     - Deposit: Full refund

2. **Late Full Return**
   - All items returned after due date
   - Expected Outcome:
     - Status: COMPLETED
     - Late Fees: Calculated (1.5x daily rate × days late)
     - Deposit: Refund minus late fees

3. **Early Return**
   - Items returned before end date
   - Expected Outcome:
     - Status: COMPLETED
     - Refund: Prorated for unused days
     - Deposit: Full refund

### Partial Returns
4. **Partial Quantity Return**
   - Some items kept, some returned
   - Expected Outcome:
     - Status: PARTIAL_RETURN
     - Remaining items tracked
     - Partial deposit release

5. **Sequential Partial Returns**
   - Multiple return events over time
   - Expected Outcome:
     - Status updates with each return
     - Accurate tracking of outstanding items

### Damage Scenarios

#### Minor Damage (5% of replacement value)
- **Examples:** Small scratches, minor scuffs
- **Expected Charges:** $175 for $3,500 camera
- **Deposit Impact:** Partial refund

#### Moderate Damage (20% of replacement value)
- **Examples:** Dents, loose components, calibration issues
- **Expected Charges:** $400 for $2,000 lens
- **Deposit Impact:** May consume entire deposit

#### Severe Damage (50% of replacement value)
- **Examples:** Cracked housing, water damage
- **Expected Charges:** $1,250 for $2,500 lighting kit
- **Deposit Impact:** Customer owes additional

#### Total Loss (100% of replacement value)
- **Examples:** Complete destruction, beyond repair
- **Expected Charges:** Full replacement cost
- **Item Disposition:** Write-off from inventory

### Complex Scenarios
6. **Mixed Return (Late + Damaged + Partial)**
   - Combination of issues in single return
   - Expected Outcome:
     - Multiple fee calculations
     - Complex status management
     - Accurate total charges

## Extension Scenarios

1. **Simple Extension**
   - Extend by few days
   - Expected: Additional charges calculated

2. **Multiple Extensions**
   - Sequential extensions (max 3)
   - Expected: Extension limit enforced

## Expected System Behaviors

### Transaction Status Flow
```
PENDING → IN_PROGRESS → COMPLETED
                     ↘ PARTIAL_RETURN
                     ↘ EXTENDED
```

### Fee Calculations

#### Late Fees
- Grace Period: 1 day
- Rate: 150% of daily rate
- Formula: `daily_rate × 1.5 × (days_late - grace_period) × quantity`

#### Damage Fees
- Based on severity assessment
- Percentage of replacement value
- Added to transaction total

#### Deposit Handling
- Security Deposit: 20% of item value
- Refund: `deposit - (late_fees + damage_charges)`
- Minimum refund: $0

### Inventory Management
- **Blocking:** Items blocked during rental period
- **Release:** Items released after full return
- **Damage Tracking:** Damaged items flagged for repair

## Test Execution

### Prerequisites
1. Backend API running on `http://localhost:8000`
2. Frontend running on `http://localhost:3000`
3. Test database with clean state
4. Node.js and Puppeteer installed

### Running Tests

```bash
# Install dependencies
npm install puppeteer

# Run rental creation tests
node test-rental-creation-comprehensive.js

# Run return tests
node test-rental-returns-comprehensive.js

# Run with custom environment
API_URL=http://custom-api:8000 node test-rental-creation-comprehensive.js
```

### Test Configuration

```javascript
TEST_CONFIG = {
  timeout: 60000,
  viewport: { width: 1920, height: 1080 },
  slowMo: 50, // Slow down for visibility
  headless: false, // Set true for CI
  screenshot: {
    path: './test-screenshots/',
    fullPage: true
  }
}
```

## Validation Points

### Rental Creation
- ✓ Transaction number generation
- ✓ Customer validation
- ✓ Item availability checking
- ✓ Pricing calculations
- ✓ Date validation
- ✓ Inventory blocking

### Rental Returns
- ✓ Return quantity validation
- ✓ Damage assessment recording
- ✓ Fee calculations
- ✓ Status transitions
- ✓ Deposit adjustments
- ✓ Inventory release

### Data Integrity
- ✓ Lifecycle record creation
- ✓ Event logging
- ✓ Status history tracking
- ✓ Financial reconciliation

## Test Output

### Success Indicators
- All scenarios pass
- Screenshots captured
- Proper cleanup executed
- No console errors

### Failure Handling
- Error screenshots saved
- Detailed error messages
- Stack traces logged
- Partial cleanup attempted

## Troubleshooting

### Common Issues

1. **Timeout Errors**
   - Increase timeout in TEST_CONFIG
   - Check network latency
   - Verify API responsiveness

2. **Element Not Found**
   - Update selectors if UI changed
   - Add wait conditions
   - Check page navigation

3. **Authentication Failures**
   - Verify test credentials
   - Check token expiration
   - Confirm API endpoints

4. **Data Conflicts**
   - Run cleanup before tests
   - Use unique test data
   - Check for race conditions

## Continuous Integration

### GitHub Actions Example
```yaml
name: Rental Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test:rentals
```

## Metrics & Reporting

### Key Metrics
- Test execution time
- Pass/fail rate
- Coverage percentage
- Performance benchmarks

### Report Generation
Tests generate JSON reports with:
- Timestamp
- Test results
- Error details
- Performance data

## Future Enhancements

1. **Additional Scenarios**
   - Multi-location rentals
   - Bulk rentals
   - Recurring rentals
   - Package deals

2. **Performance Testing**
   - Load testing with multiple concurrent rentals
   - Stress testing return processing
   - Database query optimization validation

3. **Integration Testing**
   - Payment gateway integration
   - Email notification testing
   - SMS alert validation
   - Inventory sync verification

4. **Security Testing**
   - Authorization boundary testing
   - Input validation testing
   - SQL injection prevention
   - XSS protection validation