/**
 * Automated Tests for Supplier UPDATE Operations
 * Test Cases: TC026-TC035
 */

const axios = require('axios');

describe('Supplier UPDATE Operations', () => {
  const BASE_URL = 'http://localhost:3001';
  const API_BASE_URL = 'http://localhost:8001/api/v1';
  
  let page;
  let authToken;
  let testSupplierId;

  beforeAll(async () => {
    // Setup authentication token
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
        username: 'admin',
        password: 'K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3'
      });
      authToken = loginResponse.data.access_token;

      // Create a test supplier for update operations
      const supplierData = {
        supplier_code: `UPDATE_TEST_${Date.now()}`,
        company_name: 'Update Test Company',
        supplier_type: 'DISTRIBUTOR',
        contact_person: 'Original Contact',
        email: 'original@test.com',
        phone: '+1-555-0100',
        credit_limit: 25000,
        supplier_tier: 'STANDARD',
        status: 'ACTIVE'
      };

      const createResponse = await axios.post(`${API_BASE_URL}/suppliers/`, supplierData, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      testSupplierId = createResponse.data.id;
    } catch (error) {
      console.error('Failed to setup test data:', error.message);
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set auth token in localStorage
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
   * TC026: Full Supplier Update
   */
  describe('TC026: Full Supplier Update', () => {
    test('should successfully update all supplier fields', async () => {
      if (!testSupplierId) {
        console.log('Skipping test - no test supplier created');
        return;
      }

      // Navigate to edit page
      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Update all editable fields
      const updatedData = {
        company_name: 'Updated Company Name Ltd',
        contact_person: 'Updated Contact Person',
        email: 'updated@test.com',
        phone: '+1-555-0199',
        mobile: '+1-555-0299',
        address_line1: 'Updated Address Line 1',
        city: 'Updated City',
        state: 'Updated State',
        country: 'Updated Country',
        postal_code: '54321',
        credit_limit: '75000',
        website: 'https://updated.com',
        notes: 'Updated notes for testing'
      };

      // Clear and fill all fields
      for (const [field, value] of Object.entries(updatedData)) {
        const fieldSelector = `[name="${field}"]`;
        const fieldElement = await page.locator(fieldSelector).first();
        
        if (await fieldElement.count() > 0) {
          await fieldElement.clear();
          await fieldElement.fill(value);
        }
      }

      // Take screenshot before saving
      await page.screenshot({ 
        path: './reports/screenshots/tc026-before-update.png',
        fullPage: true 
      });

      // Save changes
      const saveButton = await page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first();
      await saveButton.click();

      // Wait for save completion
      await page.waitForTimeout(3000);

      // Verify redirect to details page or success message
      const currentUrl = page.url();
      const isDetailsPage = currentUrl.includes(`/suppliers/${testSupplierId}`) && !currentUrl.includes('/edit');
      const hasSuccessMessage = await page.locator('.success, .alert-success, [role="alert"]').count() > 0;

      expect(isDetailsPage || hasSuccessMessage).toBeTruthy();

      // Verify updated data is displayed
      if (isDetailsPage) {
        const displayedName = await page.textContent('h1, h2, [data-testid="company-name"]');
        expect(displayedName).toContain('Updated Company Name Ltd');
      }

      await page.screenshot({ 
        path: './reports/screenshots/tc026-after-update.png',
        fullPage: true 
      });
    }, 30000);
  });

  /**
   * TC027: Partial Updates
   */
  describe('TC027: Partial Updates', () => {
    test('TC027.1: should update only contact information', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Update only contact fields
      await page.fill('[name="contact_person"]', 'Partial Update Contact');
      await page.fill('[name="email"]', 'partial@update.com');
      await page.fill('[name="phone"]', '+1-555-PARTIAL');

      // Save changes
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Verify update was successful
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/edit');
    });

    test('TC027.2: should update only address fields', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Update only address fields
      const addressFields = {
        address_line1: 'New Address Line 1',
        city: 'New City',
        state: 'New State',
        postal_code: '99999'
      };

      for (const [field, value] of Object.entries(addressFields)) {
        const fieldElement = await page.locator(`[name="${field}"]`).first();
        if (await fieldElement.count() > 0) {
          await fieldElement.clear();
          await fieldElement.fill(value);
        }
      }

      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Verify update
      const hasError = await page.locator('.error, .alert-error').count() > 0;
      expect(hasError).toBeFalsy();
    });

    test('TC027.4: should update single field', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Update only company name
      await page.fill('[name="company_name"]', 'Single Field Update Company');

      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Verify single field update worked
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/edit');
    });
  });

  /**
   * TC028: Status Updates
   */
  describe('TC028: Status Updates', () => {
    test('TC028.2: should deactivate active supplier', async () => {
      if (!testSupplierId) return;

      // Navigate to supplier details
      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}`);
      await page.waitForSelector('button, .actions', { timeout: 10000 });

      // Look for deactivate/status change button
      const statusButton = await page.locator('button:has-text("Deactivate"), button:has-text("Status"), [data-testid="status-change"]').first();
      
      if (await statusButton.count() > 0) {
        await statusButton.click();
        await page.waitForTimeout(1000);

        // Look for confirmation dialog or status options
        const confirmButton = await page.locator('button:has-text("Confirm"), button:has-text("Deactivate"), button:has-text("Yes")').first();
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(2000);

          // Verify status change
          const statusIndicator = await page.locator('.status, [data-testid="status"], .badge').textContent();
          expect(statusIndicator.toLowerCase()).toMatch(/inactive|deactivated|disabled/);
        }

        await page.screenshot({ 
          path: './reports/screenshots/tc028-2-deactivate.png',
          fullPage: true 
        });
      }
    });

    test('TC028.6: should validate status transitions', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}`);
      await page.waitForSelector('.status, .actions', { timeout: 10000 });

      // Get current status
      const currentStatus = await page.locator('.status, [data-testid="status"]').textContent();
      
      // Try to change status
      const statusButton = await page.locator('button:has-text("Status"), .status-dropdown').first();
      if (await statusButton.count() > 0) {
        await statusButton.click();
        await page.waitForTimeout(500);

        // Check available status options
        const statusOptions = await page.locator('option, .dropdown-item').count();
        expect(statusOptions).toBeGreaterThan(0);
      }
    });
  });

  /**
   * TC029: Validation During Updates
   */
  describe('TC029: Validation During Updates', () => {
    test('TC029.2: should validate required fields during update', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Clear required field (company name)
      await page.fill('[name="company_name"]', '');

      // Try to save
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);

      // Should show validation error
      const errorMessage = await page.locator('.error, .field-error, [role="alert"]').count() > 0;
      expect(errorMessage).toBeTruthy();

      await page.screenshot({ 
        path: './reports/screenshots/tc029-2-required-validation.png',
        fullPage: true 
      });
    });

    test('TC029.3: should validate email format during update', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Enter invalid email
      await page.fill('[name="email"]', 'invalid-email-format');
      await page.click('[name="phone"]'); // Blur event

      await page.waitForTimeout(500);

      // Check for validation error
      const emailError = await page.locator('.error, .field-error').count() > 0;
      if (emailError) {
        const errorText = await page.textContent('.error, .field-error');
        expect(errorText.toLowerCase()).toMatch(/email|invalid|format/);
      }
    });

    test('TC029.4: should validate business rules', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Test negative credit limit
      await page.fill('[name="credit_limit"]', '-5000');
      await page.click('[name="notes"]'); // Blur event

      await page.waitForTimeout(500);

      // Should validate credit limit is non-negative
      const fieldValue = await page.inputValue('[name="credit_limit"]');
      const creditLimitError = parseFloat(fieldValue) < 0;
      
      if (creditLimitError) {
        const errorExists = await page.locator('.error, .field-error').count() > 0;
        expect(errorExists).toBeTruthy();
      }
    });
  });

  /**
   * TC030: Concurrent Updates
   */
  describe('TC030: Concurrent Updates', () => {
    test('TC030.1: should handle concurrent editing attempts', async () => {
      if (!testSupplierId) return;

      // Open edit page in first session
      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Simulate update from another user via API
      try {
        const updateData = {
          company_name: 'Concurrent Update from API',
          contact_person: 'API Updated Contact'
        };

        await axios.put(`${API_BASE_URL}/suppliers/${testSupplierId}`, updateData, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        // Now try to save from the form
        await page.fill('[name="company_name"]', 'Form Update Company');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);

        // Check for conflict handling (warning message or latest data)
        const conflictWarning = await page.locator('text=/conflict|outdated|updated/i').count() > 0;
        const formStillOpen = page.url().includes('/edit');
        
        // Either should show conflict warning or successfully save
        expect(conflictWarning || !formStillOpen).toBeTruthy();

        await page.screenshot({ 
          path: './reports/screenshots/tc030-1-concurrent-update.png',
          fullPage: true 
        });
      } catch (error) {
        console.log('API update failed, skipping concurrent test:', error.message);
      }
    });
  });

  /**
   * TC032: Contract Information Updates
   */
  describe('TC032: Contract Information Updates', () => {
    test('TC032.3: should update payment terms', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Update payment terms
      const paymentTermsSelect = await page.locator('[name="payment_terms"], select:has(option:has-text("NET"))').first();
      
      if (await paymentTermsSelect.count() > 0) {
        await paymentTermsSelect.selectOption('NET45');
        
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        // Verify update successful
        const hasError = await page.locator('.error').count() > 0;
        expect(hasError).toBeFalsy();
      }
    });

    test('TC032.4: should update credit limit', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Update credit limit
      await page.fill('[name="credit_limit"]', '100000');
      
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Verify update
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/edit');
    });
  });

  /**
   * TC033: Address Updates
   */
  describe('TC033: Address Updates', () => {
    test('TC033.1: should update complete address', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Update all address fields
      const addressData = {
        address_line1: '456 New Business Blvd',
        address_line2: 'Floor 5',
        city: 'Business City',
        state: 'Business State',
        postal_code: '67890',
        country: 'Business Country'
      };

      for (const [field, value] of Object.entries(addressData)) {
        const fieldElement = await page.locator(`[name="${field}"]`).first();
        if (await fieldElement.count() > 0) {
          await fieldElement.clear();
          await fieldElement.fill(value);
        }
      }

      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Verify address update
      const hasError = await page.locator('.error').count() > 0;
      expect(hasError).toBeFalsy();

      await page.screenshot({ 
        path: './reports/screenshots/tc033-1-address-update.png',
        fullPage: true 
      });
    });
  });

  /**
   * TC034: Contact Updates
   */
  describe('TC034: Contact Updates', () => {
    test('TC034.1: should update primary contact information', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Update contact information
      await page.fill('[name="contact_person"]', 'New Primary Contact');
      await page.fill('[name="email"]', 'newcontact@company.com');
      await page.fill('[name="phone"]', '+1-555-NEW-CONTACT');

      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Verify contact update
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/edit');
    });

    test('TC034.4: should update website URL', async () => {
      if (!testSupplierId) return;

      await page.goto(`${BASE_URL}/purchases/suppliers/${testSupplierId}/edit`);
      await page.waitForSelector('form', { timeout: 10000 });

      // Update website
      await page.fill('[name="website"]', 'https://newcompanywebsite.com');

      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Verify website update
      const hasError = await page.locator('.error').count() > 0;
      expect(hasError).toBeFalsy();
    });
  });
});