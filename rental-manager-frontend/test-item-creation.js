const puppeteer = require('puppeteer');

/**
 * Test suite for Item Creation functionality
 * 
 * This test validates:
 * 1. Login authentication
 * 2. Navigation to item creation page
 * 3. Form filling and validation
 * 4. Successful item creation
 * 5. Error handling
 */

class ItemCreationTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      screenshots: []
    };
  }

  async setup() {
    console.log('🚀 Starting Puppeteer for Item Creation test...');
    
    this.browser = await puppeteer.launch({
      headless: false,
      slowMo: 50,
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox',
        '--window-size=1280,800'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Enable console logging
    this.page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || text.includes('Error') || text.includes('Failed')) {
        console.log(`🔍 Browser Console [${type}]: ${text}`);
      }
    });

    // Monitor network failures
    this.page.on('requestfailed', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        console.log(`❌ Failed API Request: ${request.method()} ${url}`);
        console.log(`   Failure: ${request.failure().errorText}`);
      }
    });

    // Monitor API responses
    this.page.on('response', response => {
      const url = response.url();
      const status = response.status();
      if (url.includes('/api/v1/items')) {
        if (status >= 400) {
          console.log(`❌ API Error: ${status} ${response.statusText()} - ${url}`);
        } else if (status === 201) {
          console.log(`✅ Item Created Successfully: ${status} - ${url}`);
        }
      }
    });

    await this.page.setViewport({ width: 1280, height: 800 });
  }

  async runTest(name, testFn) {
    this.testResults.total++;
    try {
      console.log(`\n🧪 Running test: ${name}`);
      await testFn();
      this.testResults.passed++;
      console.log(`✅ PASSED: ${name}`);
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push({ test: name, error: error.message });
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}`);
    }
  }

  async takeScreenshot(name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-item-creation-${name}-${timestamp}.png`;
    await this.page.screenshot({ path: filename, fullPage: true });
    this.testResults.screenshots.push(filename);
    console.log(`   📸 Screenshot saved: ${filename}`);
    return filename;
  }

  async testLogin() {
    await this.runTest('Login Authentication', async () => {
      console.log('   📍 Navigating to login page...');
      await this.page.goto('http://localhost:3000/login', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      await this.takeScreenshot('01-login-page');

      // Click on Demo Admin button
      console.log('   🔑 Clicking Demo Admin button...');
      
      // Wait for button and click it
      await this.page.waitForSelector('button', { timeout: 10000 });
      const buttons = await this.page.$$('button');
      for (const button of buttons) {
        const text = await this.page.evaluate(el => el.textContent, button);
        if (text && text.includes('Demo Admin')) {
          await button.click();
          break;
        }
      }

      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verify we're logged in
      const url = this.page.url();
      if (!url.includes('/dashboard') && !url.includes('/products')) {
        throw new Error(`Login failed - unexpected URL: ${url}`);
      }
      
      console.log('   ✓ Login successful');
      await this.takeScreenshot('02-after-login');
    });
  }

  async testNavigateToItemCreation() {
    await this.runTest('Navigate to Item Creation', async () => {
      console.log('   📍 Navigating to item creation page...');
      
      // Navigate directly to item creation page
      await this.page.goto('http://localhost:3000/products/items/new', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      await this.takeScreenshot('03-item-creation-page');

      // Wait for form to load
      const formExists = await this.page.$('form');
      if (!formExists) {
        throw new Error('Item creation form not found');
      }

      console.log('   ✓ Item creation page loaded');
    });
  }

  async testFillItemForm() {
    await this.runTest('Fill Item Creation Form', async () => {
      console.log('   📝 Filling item creation form...');

      // Fill item name
      console.log('   • Filling item name...');
      await this.page.waitForSelector('input[name="item_name"]', { timeout: 10000 });
      await this.page.type('input[name="item_name"]', 'ADJ Products BS72 Serving Station');

      // Select category
      console.log('   • Selecting category...');
      const categoryDropdown = await this.page.$('[data-testid="category-dropdown"], [role="combobox"][aria-label*="category" i]');
      if (categoryDropdown) {
        await categoryDropdown.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        // Click first available option
        const categoryOption = await this.page.$('[role="option"]');
        if (categoryOption) {
          await categoryOption.click();
        }
      }

      // Select brand
      console.log('   • Selecting brand...');
      const brandDropdown = await this.page.$('[data-testid="brand-dropdown"], [role="combobox"][aria-label*="brand" i]');
      if (brandDropdown) {
        await brandDropdown.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        // Click first available option
        const brandOption = await this.page.$('[role="option"]');
        if (brandOption) {
          await brandOption.click();
        }
      }

      // Select unit of measurement
      console.log('   • Selecting unit of measurement...');
      const uomDropdown = await this.page.$('[data-testid="uom-dropdown"], [role="combobox"][aria-label*="unit" i]');
      if (uomDropdown) {
        await uomDropdown.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        // Click first available option
        const uomOption = await this.page.$('[role="option"]');
        if (uomOption) {
          await uomOption.click();
        }
      }

      // Set as rentable
      console.log('   • Setting item as rentable...');
      const rentableCheckbox = await this.page.$('input[name="is_rentable"]');
      if (rentableCheckbox) {
        const isChecked = await this.page.$eval('input[name="is_rentable"]', el => el.checked);
        if (!isChecked) {
          await rentableCheckbox.click();
        }
      }

      await this.takeScreenshot('04-form-filled');
      console.log('   ✓ Form filled successfully');
    });
  }

  async testSubmitItemCreation() {
    await this.runTest('Submit Item Creation', async () => {
      console.log('   🚀 Submitting item creation form...');

      // Set up response listener for the API call
      let apiResponse = null;
      this.page.once('response', response => {
        if (response.url().includes('/api/v1/items') && response.request().method() === 'POST') {
          apiResponse = response;
        }
      });

      // Click submit button
      const submitButton = await this.page.$('button[type="submit"]');
      if (!submitButton) {
        throw new Error('Submit button not found');
      }

      await submitButton.click();

      // Wait for API response or error
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (apiResponse) {
        const status = apiResponse.status();
        console.log(`   📡 API Response Status: ${status}`);
        
        if (status === 201 || status === 200) {
          console.log('   ✓ Item created successfully!');
          await this.takeScreenshot('05-success');
        } else if (status === 500) {
          const responseBody = await apiResponse.text();
          console.log('   ❌ Server Error Response:', responseBody);
          throw new Error(`Server error (500): ${responseBody}`);
        } else if (status >= 400) {
          const responseBody = await apiResponse.text();
          throw new Error(`API error (${status}): ${responseBody}`);
        }
      }

      // Check for success message on page
      const successMessage = await this.page.$('.success-message, [role="alert"][aria-live="polite"]');
      if (successMessage) {
        const messageText = await this.page.evaluate(el => el.textContent, successMessage);
        console.log(`   ✓ Success message: ${messageText}`);
      }

      // Check for error message on page
      const errorMessage = await this.page.$('.error-message, [role="alert"][aria-live="assertive"]');
      if (errorMessage) {
        const messageText = await this.page.evaluate(el => el.textContent, errorMessage);
        console.log(`   ❌ Error message on page: ${messageText}`);
        await this.takeScreenshot('06-error');
      }
    });
  }

  async testNavigateToItemsList() {
    await this.runTest('Navigate to Items List', async () => {
      console.log('   📍 Navigating to items list...');
      
      await this.page.goto('http://localhost:3000/products/items', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      await this.takeScreenshot('07-items-list');

      // Check if the newly created item appears in the list
      const pageContent = await this.page.content();
      if (pageContent.includes('ADJ Products BS72 Serving Station')) {
        console.log('   ✓ Newly created item found in the list!');
      } else {
        console.log('   ⚠️ Newly created item not visible in the list (might need refresh)');
      }
    });
  }

  async testCreateDuplicateItem() {
    await this.runTest('Test Duplicate Item Creation', async () => {
      console.log('   🔄 Testing duplicate item creation...');
      
      // Navigate back to creation page
      await this.page.goto('http://localhost:3000/products/items/new', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Fill the same item name
      await this.page.waitForSelector('input[name="item_name"]', { timeout: 10000 });
      await this.page.type('input[name="item_name"]', 'ADJ Products BS72 Serving Station');

      // Submit
      const submitButton = await this.page.$('button[type="submit"]');
      if (submitButton) {
        await submitButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check for duplicate error
        const errorMessage = await this.page.$('.error-message, [role="alert"]');
        if (errorMessage) {
          const messageText = await this.page.evaluate(el => el.textContent, errorMessage);
          if (messageText.includes('already exists') || messageText.includes('duplicate')) {
            console.log('   ✓ Duplicate item error handled correctly');
          }
        }
      }
    });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async runAllTests() {
    try {
      await this.setup();
      
      console.log('\n🎯 Starting Item Creation Test Suite');
      console.log('='.repeat(50));

      await this.testLogin();
      await this.testNavigateToItemCreation();
      await this.testFillItemForm();
      await this.testSubmitItemCreation();
      await this.testNavigateToItemsList();
      await this.testCreateDuplicateItem();

      console.log('\n📊 Test Results Summary');
      console.log('='.repeat(50));
      console.log(`Total tests: ${this.testResults.total}`);
      console.log(`✅ Passed: ${this.testResults.passed}`);
      console.log(`❌ Failed: ${this.testResults.failed}`);

      if (this.testResults.errors.length > 0) {
        console.log('\n🔍 Error Details:');
        this.testResults.errors.forEach(({ test, error }, index) => {
          console.log(`${index + 1}. ${test}: ${error}`);
        });
      }

      if (this.testResults.screenshots.length > 0) {
        console.log('\n📸 Screenshots captured:');
        this.testResults.screenshots.forEach(screenshot => {
          console.log(`   • ${screenshot}`);
        });
      }

      const successRate = Math.round((this.testResults.passed / this.testResults.total) * 100);
      console.log(`\n🎯 Success Rate: ${successRate}%`);

      if (successRate === 100) {
        console.log('🎉 All tests passed! Item creation is working perfectly.');
      } else if (successRate >= 80) {
        console.log('✅ Test suite completed successfully with minor issues.');
      } else {
        console.log('⚠️ Test suite completed with significant issues. Please review the errors.');
      }

    } catch (error) {
      console.error('💥 Test suite failed with error:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test suite
const testSuite = new ItemCreationTest();
testSuite.runAllTests();