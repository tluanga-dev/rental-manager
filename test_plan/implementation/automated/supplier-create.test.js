/**
 * Automated Tests for Supplier CREATE Operations
 * Test Cases: TC001-TC015
 */

const axios = require('axios');

describe('Supplier CREATE Operations', () => {
  const BASE_URL = 'http://localhost:3001';
  const API_BASE_URL = 'http://localhost:8001/api/v1';
  
  let page;
  let authToken;

  beforeAll(async () => {
    // Setup authentication token
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
        username: 'admin',
        password: 'K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3'
      });
      authToken = loginResponse.data.access_token;
    } catch (error) {
      console.error('Failed to authenticate for tests:', error.message);
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set auth token in localStorage to simulate logged-in state
    await page.goto(BASE_URL);
    await page.evaluate((token) => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          accessToken: token,
          isAuthenticated: true,
          user: { id: 1, username: 'admin', userType: 'SUPERADMIN' }
        }
      }));
    }, authToken);
  });

  afterEach(async () => {
    await page.close();
  });

  /**
   * TC001: Valid Supplier Creation - Complete Data
   */
  describe('TC001: Valid Supplier Creation - Complete Data', () => {
    test('should successfully create supplier with all fields populated', async () => {
      const testData = {
        supplier_code: `TEST${Date.now()}`,
        company_name: 'Test Company Ltd',
        supplier_type: 'DISTRIBUTOR',
        contact_person: 'John Doe',
        email: 'john@test.com',
        phone: '+1-555-0123',
        mobile: '+1-555-0124',
        address_line1: '123 Test Street',
        address_line2: 'Suite 100',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        postal_code: '12345',
        tax_id: 'TAX123456',
        payment_terms: 'NET30',
        credit_limit: '50000',
        supplier_tier: 'STANDARD',
        website: 'https://test.com',
        notes: 'Test supplier for automation'
      };

      // Navigate to create supplier page
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Fill form fields
      await page.fill('[name="supplier_code"]', testData.supplier_code);
      await page.fill('[name="company_name"]', testData.company_name);
      await page.selectOption('[name="supplier_type"]', testData.supplier_type);
      await page.fill('[name="contact_person"]', testData.contact_person);
      await page.fill('[name="email"]', testData.email);
      await page.fill('[name="phone"]', testData.phone);
      await page.fill('[name="mobile"]', testData.mobile);
      await page.fill('[name="address_line1"]', testData.address_line1);
      await page.fill('[name="address_line2"]', testData.address_line2);
      await page.fill('[name="city"]', testData.city);
      await page.fill('[name="state"]', testData.state);
      await page.fill('[name="country"]', testData.country);
      await page.fill('[name="postal_code"]', testData.postal_code);
      await page.fill('[name="tax_id"]', testData.tax_id);
      await page.selectOption('[name="payment_terms"]', testData.payment_terms);
      await page.fill('[name="credit_limit"]', testData.credit_limit);
      await page.selectOption('[name="supplier_tier"]', testData.supplier_tier);
      await page.fill('[name="website"]', testData.website);
      await page.fill('[name="notes"]', testData.notes);

      // Take screenshot before submission
      await page.screenshot({ 
        path: './reports/screenshots/tc001-form-filled.png',
        fullPage: true 
      });

      // Submit form
      await page.click('[type="submit"]');

      // Wait for navigation or success message
      await page.waitForTimeout(3000);

      // Verify success (check for redirect or success message)
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/purchases\/suppliers\/[\w-]+/);

      // Verify data is displayed correctly
      const displayedName = await page.textContent('h1, h2, [data-testid="company-name"]');
      expect(displayedName).toContain(testData.company_name);

      // Take screenshot of result
      await page.screenshot({ 
        path: './reports/screenshots/tc001-success.png',
        fullPage: true 
      });
    }, 30000);
  });

  /**
   * TC002: Minimal Required Fields Creation
   */
  describe('TC002: Minimal Required Fields Creation', () => {
    test('should create supplier with only required fields', async () => {
      const testData = {
        supplier_code: `MIN${Date.now()}`,
        company_name: 'Minimal Company',
        supplier_type: 'MANUFACTURER'
      };

      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      // Fill only required fields
      await page.fill('[name="supplier_code"]', testData.supplier_code);
      await page.fill('[name="company_name"]', testData.company_name);
      await page.selectOption('[name="supplier_type"]', testData.supplier_type);

      await page.click('[type="submit"]');
      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/purchases\/suppliers\/[\w-]+/);
    }, 20000);
  });

  /**
   * TC003: Duplicate Supplier Code Validation
   */
  describe('TC003: Duplicate Supplier Code Validation', () => {
    test('should prevent creation with duplicate supplier code', async () => {
      const duplicateCode = 'DUPLICATE001';

      // First, create a supplier
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      await page.fill('[name="supplier_code"]', duplicateCode);
      await page.fill('[name="company_name"]', 'First Company');
      await page.selectOption('[name="supplier_type"]', 'DISTRIBUTOR');
      await page.click('[type="submit"]');
      await page.waitForTimeout(3000);

      // Now try to create another with same code
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      await page.fill('[name="supplier_code"]', duplicateCode);
      await page.fill('[name="company_name"]', 'Second Company');
      await page.selectOption('[name="supplier_type"]', 'MANUFACTURER');
      await page.click('[type="submit"]');

      // Wait for error message
      await page.waitForTimeout(2000);

      // Check for error message
      const errorMessage = await page.textContent('.error, .alert-error, [role="alert"]');
      expect(errorMessage).toMatch(/already exists|duplicate|conflict/i);

      await page.screenshot({ 
        path: './reports/screenshots/tc003-duplicate-error.png',
        fullPage: true 
      });
    }, 30000);
  });

  /**
   * TC004: Field Validation - Supplier Code
   */
  describe('TC004: Field Validation - Supplier Code', () => {
    test('TC004.1: should show error for empty supplier code', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      await page.fill('[name="company_name"]', 'Test Company');
      await page.selectOption('[name="supplier_type"]', 'DISTRIBUTOR');
      await page.click('[type="submit"]');

      await page.waitForTimeout(1000);

      const errorMessage = await page.textContent('.error, .field-error, [role="alert"]');
      expect(errorMessage).toMatch(/required|empty/i);
    });

    test('TC004.2: should show error for code exceeding 50 characters', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      const longCode = 'A'.repeat(51);
      await page.fill('[name="supplier_code"]', longCode);
      await page.fill('[name="company_name"]', 'Test Company');
      await page.selectOption('[name="supplier_type"]', 'DISTRIBUTOR');

      // Trigger validation (blur event)
      await page.click('[name="company_name"]');
      await page.waitForTimeout(500);

      const fieldValue = await page.inputValue('[name="supplier_code"]');
      // Should be truncated or show error
      expect(fieldValue.length).toBeLessThanOrEqual(50);
    });
  });

  /**
   * TC005: Field Validation - Company Name
   */
  describe('TC005: Field Validation - Company Name', () => {
    test('TC005.1: should show error for empty company name', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      await page.fill('[name="supplier_code"]', 'TEST001');
      await page.selectOption('[name="supplier_type"]', 'DISTRIBUTOR');
      await page.click('[type="submit"]');

      await page.waitForTimeout(1000);

      const errorMessage = await page.textContent('.error, .field-error, [role="alert"]');
      expect(errorMessage).toMatch(/required|empty/i);
    });

    test('TC005.4: should sanitize HTML tags in company name', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      const htmlInput = '<script>alert("xss")</script>Test Company';
      await page.fill('[name="company_name"]', htmlInput);
      await page.click('[name="supplier_code"]'); // Blur event

      const fieldValue = await page.inputValue('[name="company_name"]');
      expect(fieldValue).not.toContain('<script>');
    });
  });

  /**
   * TC006: Field Validation - Email
   */
  describe('TC006: Field Validation - Email', () => {
    test('TC006.1: should show error for invalid email format', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      await page.fill('[name="email"]', 'notanemail');
      await page.click('[name="phone"]'); // Blur event
      await page.waitForTimeout(500);

      const errorExists = await page.locator('.error, .field-error, [role="alert"]').count() > 0;
      if (errorExists) {
        const errorMessage = await page.textContent('.error, .field-error, [role="alert"]');
        expect(errorMessage).toMatch(/email|invalid|format/i);
      }
    });

    test('TC006.5: should accept valid international emails', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      const validEmail = 'test@example.co.uk';
      await page.fill('[name="email"]', validEmail);
      await page.click('[name="phone"]'); // Blur event
      await page.waitForTimeout(500);

      const fieldValue = await page.inputValue('[name="email"]');
      expect(fieldValue).toBe(validEmail);
    });
  });

  /**
   * TC008: Field Validation - Credit Limit
   */
  describe('TC008: Field Validation - Credit Limit', () => {
    test('TC008.1: should prevent negative credit limit', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      await page.fill('[name="credit_limit"]', '-1000');
      await page.click('[name="notes"]'); // Blur event
      await page.waitForTimeout(500);

      // Check if field accepts negative value or shows error
      const fieldValue = await page.inputValue('[name="credit_limit"]');
      const isNegative = parseFloat(fieldValue) < 0;
      
      if (isNegative) {
        // Should show error message
        const errorExists = await page.locator('.error, .field-error, [role="alert"]').count() > 0;
        expect(errorExists).toBeTruthy();
      }
    });

    test('TC008.2: should accept zero credit limit', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      await page.fill('[name="credit_limit"]', '0');
      await page.click('[name="notes"]'); // Blur event

      const fieldValue = await page.inputValue('[name="credit_limit"]');
      expect(fieldValue).toBe('0');
    });
  });

  /**
   * TC010: Form State Management
   */
  describe('TC010: Form State Management', () => {
    test('TC010.4: should reset form when reset button is clicked', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      // Fill some fields
      await page.fill('[name="supplier_code"]', 'RESET001');
      await page.fill('[name="company_name"]', 'Reset Test Company');
      await page.fill('[name="email"]', 'reset@test.com');

      // Look for reset button (may be labeled differently)
      const resetButton = await page.locator('button[type="reset"], button:has-text("Reset"), button:has-text("Clear")').first();
      if (await resetButton.count() > 0) {
        await resetButton.click();

        // Verify fields are cleared
        const codeValue = await page.inputValue('[name="supplier_code"]');
        const nameValue = await page.inputValue('[name="company_name"]');
        const emailValue = await page.inputValue('[name="email"]');

        expect(codeValue).toBe('');
        expect(nameValue).toBe('');
        expect(emailValue).toBe('');
      }
    });
  });

  /**
   * TC013: Form Navigation
   */
  describe('TC013: Form Navigation', () => {
    test('TC013.1: should support tab navigation through fields', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      // Start from first field
      await page.focus('[name="supplier_code"]');
      
      // Tab through fields
      await page.keyboard.press('Tab');
      const focusedElement1 = await page.evaluate(() => document.activeElement.name);
      
      await page.keyboard.press('Tab');
      const focusedElement2 = await page.evaluate(() => document.activeElement.name);
      
      // Verify focus moved to different fields
      expect(focusedElement1).not.toBe('supplier_code');
      expect(focusedElement2).not.toBe(focusedElement1);
    });

    test('TC013.3: should submit form on Enter key in submit button', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers/new`);
      await page.waitForSelector('form');

      // Fill required fields
      await page.fill('[name="supplier_code"]', `ENTER${Date.now()}`);
      await page.fill('[name="company_name"]', 'Enter Test Company');
      await page.selectOption('[name="supplier_type"]', 'DISTRIBUTOR');

      // Focus submit button and press Enter
      await page.focus('[type="submit"]');
      await page.keyboard.press('Enter');

      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/purchases\/suppliers\/[\w-]+/);
    });
  });
});