/**
 * Rental Test Utilities
 * Shared functions and data for rental creation and return tests
 */

const API_URL = process.env.API_URL || 'http://localhost:8000/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  timeout: 60000,
  viewport: { width: 1920, height: 1080 },
  slowMo: 50, // Slow down by 50ms for visibility
  headless: false, // Set to true for CI/CD
  devtools: false,
  screenshot: {
    path: './test-screenshots/',
    fullPage: true
  }
};

// Test user credentials
const TEST_USERS = {
  admin: {
    username: 'admin',
    email: 'admin@admin.com',
    password: 'admin123'
  },
  staff: {
    username: 'staff',
    email: 'staff@rentalmanager.com',
    password: 'staff123'
  }
};

// Test customer data
const TEST_CUSTOMERS = [
  {
    customer_code: 'CUST001',
    customer_type: 'INDIVIDUAL',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@test.com',
    phone: '+1234567890',
    address_line1: '123 Test Street',
    city: 'Test City',
    state: 'TC',
    country: 'USA',
    postal_code: '12345',
    credit_limit: 10000,
    status: 'ACTIVE'
  },
  {
    customer_code: 'CUST002',
    customer_type: 'INDIVIDUAL',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@test.com',
    phone: '+0987654321',
    address_line1: '456 Demo Avenue',
    city: 'Demo Town',
    state: 'DT',
    country: 'USA',
    postal_code: '54321',
    credit_limit: 5000,
    status: 'ACTIVE'
  },
  {
    customer_code: 'CUST003',
    customer_type: 'INDIVIDUAL',
    first_name: 'Bob',
    last_name: 'Wilson',
    email: 'bob.wilson@test.com',
    phone: '+1122334455',
    address_line1: '789 Sample Road',
    city: 'Sample City',
    state: 'SC',
    country: 'USA',
    postal_code: '67890',
    credit_limit: 15000,
    status: 'ACTIVE'
  }
];

// Test rental items
const TEST_ITEMS = [
  {
    name: 'Camera - Canon EOS R5',
    sku: 'CAM-CANON-R5',
    category: 'Cameras',
    brand: 'Canon',
    daily_rate: 150,
    weekly_rate: 900,
    monthly_rate: 3000,
    deposit_amount: 500,
    replacement_value: 3500,
    quantity: 5
  },
  {
    name: 'Lens - 24-70mm f/2.8',
    sku: 'LENS-2470-28',
    category: 'Lenses',
    brand: 'Canon',
    daily_rate: 50,
    weekly_rate: 300,
    monthly_rate: 1000,
    deposit_amount: 200,
    replacement_value: 2000,
    quantity: 8
  },
  {
    name: 'Tripod - Professional',
    sku: 'TRIPOD-PRO',
    category: 'Accessories',
    brand: 'Manfrotto',
    daily_rate: 20,
    weekly_rate: 120,
    monthly_rate: 400,
    deposit_amount: 50,
    replacement_value: 500,
    quantity: 10
  },
  {
    name: 'Lighting Kit - Studio',
    sku: 'LIGHT-STUDIO',
    category: 'Lighting',
    brand: 'Profoto',
    daily_rate: 100,
    weekly_rate: 600,
    monthly_rate: 2000,
    deposit_amount: 300,
    replacement_value: 2500,
    quantity: 3
  }
];

// Damage types and descriptions
const DAMAGE_SCENARIOS = {
  MINOR: {
    type: 'COSMETIC',
    severity: 'MINOR',
    descriptions: [
      'Small scratch on surface',
      'Minor scuff marks',
      'Slight wear on edges'
    ],
    repair_cost_percentage: 0.05 // 5% of replacement value
  },
  MODERATE: {
    type: 'FUNCTIONAL',
    severity: 'MODERATE',
    descriptions: [
      'Dent affecting operation',
      'Loose components',
      'Calibration issues'
    ],
    repair_cost_percentage: 0.20 // 20% of replacement value
  },
  SEVERE: {
    type: 'STRUCTURAL',
    severity: 'SEVERE',
    descriptions: [
      'Cracked housing',
      'Broken mount',
      'Water damage'
    ],
    repair_cost_percentage: 0.50 // 50% of replacement value
  },
  TOTAL_LOSS: {
    type: 'TOTAL_LOSS',
    severity: 'TOTAL_LOSS',
    descriptions: [
      'Item completely destroyed',
      'Beyond economical repair',
      'Missing critical components'
    ],
    repair_cost_percentage: 1.00 // 100% of replacement value
  }
};

// Utility Functions

/**
 * Login to the application
 */
async function login(page, userType = 'admin') {
  const user = TEST_USERS[userType];
  console.log(`Logging in as ${userType}...`);
  
  await page.goto(`${FRONTEND_URL}/login`);
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  
  await page.type('input[name="username"]', user.username);
  await page.type('input[name="password"]', user.password);
  
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  
  console.log('Login successful');
}

/**
 * Create a test customer via API
 */
async function createTestCustomer(authToken, customerData = TEST_CUSTOMERS[0]) {
  const response = await fetch(`${API_URL}/v1/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(customerData)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create customer: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.data || result;
}

/**
 * Create test items via API
 */
async function createTestItems(authToken, items = TEST_ITEMS) {
  const createdItems = [];
  
  for (const item of items) {
    const response = await fetch(`${API_URL}/v1/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(item)
    });
    
    if (!response.ok) {
      console.error(`Failed to create item ${item.name}: ${response.statusText}`);
      continue;
    }
    
    const result = await response.json();
    createdItems.push(result.data || result);
  }
  
  return createdItems;
}

/**
 * Navigate to rental creation page
 */
async function navigateToRentalCreation(page) {
  console.log('Navigating to rental creation...');
  
  await page.goto(`${FRONTEND_URL}/rentals/new`);
  await page.waitForSelector('[data-testid="rental-form"]', { timeout: 10000 });
  
  console.log('Rental creation page loaded');
}

/**
 * Fill rental creation form
 */
async function fillRentalForm(page, rentalData) {
  console.log('Filling rental form...');
  
  // Select customer
  if (rentalData.customer) {
    await page.click('[data-testid="customer-selector"]');
    await page.type('[data-testid="customer-search"]', rentalData.customer);
    await page.waitForTimeout(500);
    await page.click('[data-testid="customer-option"]:first-child');
  }
  
  // Set rental dates
  if (rentalData.startDate) {
    await page.click('[data-testid="start-date-picker"]');
    await selectDate(page, rentalData.startDate);
  }
  
  if (rentalData.endDate) {
    await page.click('[data-testid="end-date-picker"]');
    await selectDate(page, rentalData.endDate);
  }
  
  // Add items
  if (rentalData.items) {
    for (const item of rentalData.items) {
      await addRentalItem(page, item);
    }
  }
  
  // Set delivery options
  if (rentalData.delivery) {
    await page.click('[data-testid="delivery-checkbox"]');
    await page.type('[data-testid="delivery-address"]', rentalData.delivery.address);
  }
  
  // Set pickup options
  if (rentalData.pickup) {
    await page.click('[data-testid="pickup-checkbox"]');
    await page.type('[data-testid="pickup-time"]', rentalData.pickup.time);
  }
  
  // Add notes
  if (rentalData.notes) {
    await page.type('[data-testid="rental-notes"]', rentalData.notes);
  }
}

/**
 * Add item to rental
 */
async function addRentalItem(page, itemData) {
  console.log(`Adding item: ${itemData.name}`);
  
  await page.click('[data-testid="add-item-button"]');
  await page.waitForSelector('[data-testid="item-dialog"]', { timeout: 5000 });
  
  // Search and select item
  await page.type('[data-testid="item-search"]', itemData.name);
  await page.waitForTimeout(500);
  await page.click('[data-testid="item-option"]:first-child');
  
  // Set quantity
  await page.fill('[data-testid="item-quantity"]', itemData.quantity.toString());
  
  // Set rental period
  if (itemData.periodType) {
    await page.selectOption('[data-testid="period-type"]', itemData.periodType);
  }
  
  // Apply discount if specified
  if (itemData.discount) {
    await page.fill('[data-testid="discount-value"]', itemData.discount.toString());
  }
  
  await page.click('[data-testid="confirm-item"]');
  await page.waitForSelector('[data-testid="item-dialog"]', { state: 'hidden' });
}

/**
 * Process rental return
 */
async function processRentalReturn(page, returnData) {
  console.log('Processing rental return...');
  
  // Navigate to rental details
  await page.goto(`${FRONTEND_URL}/rentals/${returnData.rentalId}`);
  await page.waitForSelector('[data-testid="rental-details"]', { timeout: 10000 });
  
  // Click return button
  await page.click('[data-testid="return-button"]');
  await page.waitForSelector('[data-testid="return-dialog"]', { timeout: 5000 });
  
  // Select items to return
  for (const item of returnData.items) {
    const itemSelector = `[data-testid="return-item-${item.id}"]`;
    await page.click(itemSelector);
    
    // Set return quantity
    if (item.quantity) {
      await page.fill(`[data-testid="return-quantity-${item.id}"]`, item.quantity.toString());
    }
    
    // Add damage assessment if applicable
    if (item.damage) {
      await addDamageAssessment(page, item.id, item.damage);
    }
  }
  
  // Add return notes
  if (returnData.notes) {
    await page.type('[data-testid="return-notes"]', returnData.notes);
  }
  
  // Submit return
  await page.click('[data-testid="submit-return"]');
  await page.waitForSelector('[data-testid="return-success"]', { timeout: 10000 });
}

/**
 * Add damage assessment for an item
 */
async function addDamageAssessment(page, itemId, damageData) {
  console.log(`Adding damage assessment for item ${itemId}`);
  
  await page.click(`[data-testid="damage-checkbox-${itemId}"]`);
  
  // Select damage type
  await page.selectOption(`[data-testid="damage-type-${itemId}"]`, damageData.type);
  
  // Select severity
  await page.selectOption(`[data-testid="damage-severity-${itemId}"]`, damageData.severity);
  
  // Add description
  await page.type(`[data-testid="damage-description-${itemId}"]`, damageData.description);
  
  // Set repair cost
  if (damageData.repairCost) {
    await page.fill(`[data-testid="repair-cost-${itemId}"]`, damageData.repairCost.toString());
  }
  
  // Upload photos if provided
  if (damageData.photos) {
    const fileInput = await page.$(`[data-testid="damage-photos-${itemId}"]`);
    await fileInput.setInputFiles(damageData.photos);
  }
}

/**
 * Process rental extension
 */
async function processRentalExtension(page, extensionData) {
  console.log('Processing rental extension...');
  
  // Navigate to rental details
  await page.goto(`${FRONTEND_URL}/rentals/${extensionData.rentalId}`);
  await page.waitForSelector('[data-testid="rental-details"]', { timeout: 10000 });
  
  // Click extend button
  await page.click('[data-testid="extend-button"]');
  await page.waitForSelector('[data-testid="extension-dialog"]', { timeout: 5000 });
  
  // Set new end date
  await page.click('[data-testid="new-end-date-picker"]');
  await selectDate(page, extensionData.newEndDate);
  
  // Add reason
  if (extensionData.reason) {
    await page.type('[data-testid="extension-reason"]', extensionData.reason);
  }
  
  // Submit extension
  await page.click('[data-testid="submit-extension"]');
  await page.waitForSelector('[data-testid="extension-success"]', { timeout: 10000 });
}

/**
 * Helper function to select date in calendar
 */
async function selectDate(page, date) {
  const dateObj = new Date(date);
  const day = dateObj.getDate();
  const month = dateObj.toLocaleString('default', { month: 'long' });
  const year = dateObj.getFullYear();
  
  // Navigate to correct month/year
  await page.click(`[data-testid="calendar-month-year"]`);
  await page.selectOption('[data-testid="calendar-month"]', month);
  await page.selectOption('[data-testid="calendar-year"]', year.toString());
  
  // Click the day
  await page.click(`[data-testid="calendar-day-${day}"]`);
}

/**
 * Verify rental creation
 */
async function verifyRentalCreation(page, expectedData) {
  console.log('Verifying rental creation...');
  
  // Check for success message
  await page.waitForSelector('[data-testid="rental-success"]', { timeout: 10000 });
  
  // Get rental ID from success message
  const rentalId = await page.$eval('[data-testid="rental-id"]', el => el.textContent);
  
  // Verify rental details
  await page.goto(`${FRONTEND_URL}/rentals/${rentalId}`);
  await page.waitForSelector('[data-testid="rental-details"]', { timeout: 10000 });
  
  // Check rental status
  const status = await page.$eval('[data-testid="rental-status"]', el => el.textContent);
  if (status !== expectedData.status) {
    throw new Error(`Expected status ${expectedData.status}, got ${status}`);
  }
  
  // Check total amount
  const totalAmount = await page.$eval('[data-testid="rental-total"]', el => el.textContent);
  console.log(`Rental total: ${totalAmount}`);
  
  return rentalId;
}

/**
 * Verify rental return
 */
async function verifyRentalReturn(page, expectedData) {
  console.log('Verifying rental return...');
  
  // Check return status
  const returnStatus = await page.$eval('[data-testid="return-status"]', el => el.textContent);
  if (returnStatus !== expectedData.status) {
    throw new Error(`Expected return status ${expectedData.status}, got ${returnStatus}`);
  }
  
  // Check fees if applicable
  if (expectedData.lateFees) {
    const lateFees = await page.$eval('[data-testid="late-fees"]', el => el.textContent);
    console.log(`Late fees: ${lateFees}`);
  }
  
  if (expectedData.damageCharges) {
    const damageCharges = await page.$eval('[data-testid="damage-charges"]', el => el.textContent);
    console.log(`Damage charges: ${damageCharges}`);
  }
  
  // Check deposit refund
  if (expectedData.depositRefund) {
    const depositRefund = await page.$eval('[data-testid="deposit-refund"]', el => el.textContent);
    console.log(`Deposit refund: ${depositRefund}`);
  }
}

/**
 * Take screenshot with timestamp
 */
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${TEST_CONFIG.screenshot.path}${name}-${timestamp}.png`;
  
  await page.screenshot({
    path: filename,
    fullPage: TEST_CONFIG.screenshot.fullPage
  });
  
  console.log(`Screenshot saved: ${filename}`);
}

/**
 * Cleanup test data via API
 */
async function cleanupTestData(authToken, dataIds) {
  console.log('Cleaning up test data...');
  
  // Delete rentals
  if (dataIds.rentals) {
    for (const rentalId of dataIds.rentals) {
      await fetch(`${API_URL}/v1/rentals/${rentalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    }
  }
  
  // Delete customers
  if (dataIds.customers) {
    for (const customerId of dataIds.customers) {
      await fetch(`${API_URL}/v1/customers/${customerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    }
  }
  
  // Delete items
  if (dataIds.items) {
    for (const itemId of dataIds.items) {
      await fetch(`${API_URL}/v1/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    }
  }
  
  console.log('Cleanup completed');
}

/**
 * Get auth token
 */
async function getAuthToken(userType = 'admin') {
  const user = TEST_USERS[userType];
  
  const response = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: user.username,
      password: user.password
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get auth token: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.access_token;
}

// Export everything
module.exports = {
  TEST_CONFIG,
  TEST_USERS,
  TEST_CUSTOMERS,
  TEST_ITEMS,
  DAMAGE_SCENARIOS,
  API_URL,
  FRONTEND_URL,
  login,
  createTestCustomer,
  createTestItems,
  navigateToRentalCreation,
  fillRentalForm,
  addRentalItem,
  processRentalReturn,
  addDamageAssessment,
  processRentalExtension,
  selectDate,
  verifyRentalCreation,
  verifyRentalReturn,
  takeScreenshot,
  cleanupTestData,
  getAuthToken
};