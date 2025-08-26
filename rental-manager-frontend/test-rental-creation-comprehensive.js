/**
 * Comprehensive Rental Creation Test
 * Tests various rental creation scenarios including basic, advanced, and edge cases
 */

const puppeteer = require('puppeteer');
const {
  TEST_CONFIG,
  login,
  getAuthToken,
  createTestCustomer,
  createTestItems,
  navigateToRentalCreation,
  fillRentalForm,
  verifyRentalCreation,
  takeScreenshot,
  cleanupTestData,
  FRONTEND_URL
} = require('./rental-test-utilities');

// Test scenarios
const RENTAL_SCENARIOS = {
  // Basic single item rental
  basic_single_item: {
    name: 'Basic Single Item Rental',
    data: {
      customer: 'John Doe',
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'DAILY'
        }
      ],
      notes: 'Basic single item rental test'
    },
    expected: {
      status: 'PENDING',
      itemCount: 1,
      duration: 3
    }
  },
  
  // Multiple items rental
  multiple_items: {
    name: 'Multiple Items Rental',
    data: {
      customer: 'Jane Smith',
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 2,
          periodType: 'WEEKLY'
        },
        {
          name: 'Lens - 24-70mm f/2.8',
          quantity: 2,
          periodType: 'WEEKLY'
        },
        {
          name: 'Tripod - Professional',
          quantity: 1,
          periodType: 'WEEKLY'
        }
      ],
      notes: 'Multiple items weekly rental'
    },
    expected: {
      status: 'PENDING',
      itemCount: 3,
      duration: 7
    }
  },
  
  // Monthly rental with discount
  monthly_with_discount: {
    name: 'Monthly Rental with Discount',
    data: {
      customer: 'Bob Wilson',
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month
      items: [
        {
          name: 'Lighting Kit - Studio',
          quantity: 1,
          periodType: 'MONTHLY',
          discount: 10 // 10% discount
        }
      ],
      notes: 'Monthly rental with 10% discount'
    },
    expected: {
      status: 'PENDING',
      itemCount: 1,
      duration: 30,
      hasDiscount: true
    }
  },
  
  // Rental with delivery
  with_delivery: {
    name: 'Rental with Delivery',
    data: {
      customer: 'John Doe',
      startDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // Day after tomorrow
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'DAILY'
        },
        {
          name: 'Lighting Kit - Studio',
          quantity: 2,
          periodType: 'DAILY'
        }
      ],
      delivery: {
        address: '123 Delivery Street, Test City, TC 12345',
        fee: 50
      },
      notes: 'Rental with delivery service'
    },
    expected: {
      status: 'PENDING',
      itemCount: 2,
      hasDelivery: true
    }
  },
  
  // Rental with pickup scheduling
  with_pickup: {
    name: 'Rental with Scheduled Pickup',
    data: {
      customer: 'Jane Smith',
      startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'DAILY'
        }
      ],
      pickup: {
        time: '10:00 AM',
        location: 'Main Store'
      },
      notes: 'Rental with scheduled pickup'
    },
    expected: {
      status: 'PENDING',
      itemCount: 1,
      hasPickup: true
    }
  },
  
  // Large quantity rental
  large_quantity: {
    name: 'Large Quantity Rental',
    data: {
      customer: 'Bob Wilson',
      startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      items: [
        {
          name: 'Tripod - Professional',
          quantity: 8,
          periodType: 'DAILY'
        }
      ],
      notes: 'Large quantity rental test'
    },
    expected: {
      status: 'PENDING',
      itemCount: 1,
      largeQuantity: true
    }
  },
  
  // Same day rental
  same_day: {
    name: 'Same Day Rental',
    data: {
      customer: 'John Doe',
      startDate: new Date(),
      endDate: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'HOURLY'
        }
      ],
      notes: 'Same day rental - urgent'
    },
    expected: {
      status: 'PENDING',
      itemCount: 1,
      sameDay: true
    }
  },
  
  // Long-term rental
  long_term: {
    name: 'Long-term Rental (3 months)',
    data: {
      customer: 'Jane Smith',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 months
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'MONTHLY',
          discount: 20 // 20% long-term discount
        }
      ],
      notes: 'Long-term rental with special discount'
    },
    expected: {
      status: 'PENDING',
      itemCount: 1,
      duration: 90,
      longTerm: true
    }
  }
};

// Main test function
async function runRentalCreationTests() {
  let browser;
  let page;
  let authToken;
  const testResults = [];
  const createdData = {
    rentals: [],
    customers: [],
    items: []
  };
  
  try {
    console.log('Starting Comprehensive Rental Creation Tests');
    console.log('===========================================\n');
    
    // Setup browser
    browser = await puppeteer.launch({
      headless: TEST_CONFIG.headless,
      slowMo: TEST_CONFIG.slowMo,
      devtools: TEST_CONFIG.devtools,
      defaultViewport: TEST_CONFIG.viewport,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    
    // Set up console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
    
    // Get auth token for API operations
    authToken = await getAuthToken('admin');
    console.log('Auth token obtained\n');
    
    // Create test data
    console.log('Setting up test data...');
    const customers = await Promise.all([
      createTestCustomer(authToken, { name: 'John Doe', email: 'john.doe@test.com' }),
      createTestCustomer(authToken, { name: 'Jane Smith', email: 'jane.smith@test.com' }),
      createTestCustomer(authToken, { name: 'Bob Wilson', email: 'bob.wilson@test.com' })
    ]);
    createdData.customers = customers.map(c => c.id);
    console.log(`Created ${customers.length} test customers`);
    
    const items = await createTestItems(authToken);
    createdData.items = items.map(i => i.id);
    console.log(`Created ${items.length} test items\n`);
    
    // Login to frontend
    await login(page, 'admin');
    
    // Run each test scenario
    for (const [key, scenario] of Object.entries(RENTAL_SCENARIOS)) {
      console.log(`\nTest: ${scenario.name}`);
      console.log('-'.repeat(50));
      
      try {
        // Navigate to rental creation
        await navigateToRentalCreation(page);
        
        // Fill and submit form
        await fillRentalForm(page, scenario.data);
        
        // Take screenshot before submission
        await takeScreenshot(page, `rental-creation-${key}-before`);
        
        // Submit the form
        await page.click('[data-testid="submit-rental"]');
        
        // Wait for success and verify
        const rentalId = await verifyRentalCreation(page, scenario.expected);
        createdData.rentals.push(rentalId);
        
        // Take screenshot after submission
        await takeScreenshot(page, `rental-creation-${key}-after`);
        
        // Record success
        testResults.push({
          scenario: scenario.name,
          status: 'PASSED',
          rentalId: rentalId,
          duration: scenario.expected.duration
        });
        
        console.log(`✓ Test passed - Rental ID: ${rentalId}`);
        
        // Wait before next test
        await page.waitForTimeout(1000);
        
      } catch (error) {
        console.error(`✗ Test failed: ${error.message}`);
        await takeScreenshot(page, `rental-creation-${key}-error`);
        
        testResults.push({
          scenario: scenario.name,
          status: 'FAILED',
          error: error.message
        });
      }
    }
    
    // Test edge cases
    console.log('\n\nTesting Edge Cases');
    console.log('==================\n');
    
    // Test 1: Past date validation
    console.log('Test: Past Date Validation');
    try {
      await navigateToRentalCreation(page);
      await fillRentalForm(page, {
        customer: 'John Doe',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        endDate: new Date(),
        items: [{
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'DAILY'
        }]
      });
      
      await page.click('[data-testid="submit-rental"]');
      
      // Should show validation error
      await page.waitForSelector('[data-testid="date-error"]', { timeout: 5000 });
      console.log('✓ Past date validation working correctly');
      
    } catch (error) {
      console.error('✗ Past date validation test failed:', error.message);
    }
    
    // Test 2: Overlapping rental detection
    console.log('\nTest: Overlapping Rental Detection');
    try {
      // Create first rental
      await navigateToRentalCreation(page);
      const firstRentalData = {
        customer: 'John Doe',
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        items: [{
          name: 'Camera - Canon EOS R5',
          quantity: 5, // Use all available units
          periodType: 'DAILY'
        }]
      };
      
      await fillRentalForm(page, firstRentalData);
      await page.click('[data-testid="submit-rental"]');
      const firstRentalId = await verifyRentalCreation(page, { status: 'PENDING' });
      createdData.rentals.push(firstRentalId);
      
      // Try to create overlapping rental
      await navigateToRentalCreation(page);
      const overlappingRentalData = {
        customer: 'Jane Smith',
        startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Overlaps
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        items: [{
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'DAILY'
        }]
      };
      
      await fillRentalForm(page, overlappingRentalData);
      await page.click('[data-testid="check-availability"]');
      
      // Should show availability warning
      await page.waitForSelector('[data-testid="availability-warning"]', { timeout: 5000 });
      console.log('✓ Overlapping rental detection working correctly');
      
    } catch (error) {
      console.error('✗ Overlapping rental test failed:', error.message);
    }
    
    // Test 3: Maximum quantity validation
    console.log('\nTest: Maximum Quantity Validation');
    try {
      await navigateToRentalCreation(page);
      await fillRentalForm(page, {
        customer: 'Bob Wilson',
        startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        items: [{
          name: 'Tripod - Professional',
          quantity: 15, // More than available (10)
          periodType: 'DAILY'
        }]
      });
      
      await page.click('[data-testid="submit-rental"]');
      
      // Should show quantity error
      await page.waitForSelector('[data-testid="quantity-error"]', { timeout: 5000 });
      console.log('✓ Maximum quantity validation working correctly');
      
    } catch (error) {
      console.error('✗ Maximum quantity validation test failed:', error.message);
    }
    
    // Print test summary
    console.log('\n\nTest Summary');
    console.log('============');
    console.log(`Total tests run: ${testResults.length}`);
    console.log(`Passed: ${testResults.filter(r => r.status === 'PASSED').length}`);
    console.log(`Failed: ${testResults.filter(r => r.status === 'FAILED').length}`);
    
    console.log('\nDetailed Results:');
    testResults.forEach(result => {
      const icon = result.status === 'PASSED' ? '✓' : '✗';
      console.log(`${icon} ${result.scenario}: ${result.status}`);
      if (result.rentalId) {
        console.log(`   Rental ID: ${result.rentalId}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error('Test suite failed:', error);
    if (page) {
      await takeScreenshot(page, 'rental-creation-suite-error');
    }
    
  } finally {
    // Cleanup
    console.log('\nCleaning up test data...');
    if (authToken) {
      await cleanupTestData(authToken, createdData);
    }
    
    if (browser) {
      await browser.close();
    }
    
    console.log('Test suite completed');
  }
}

// Run the tests
runRentalCreationTests().catch(console.error);