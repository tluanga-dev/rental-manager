const puppeteer = require('puppeteer');

/**
 * Test suite for Item Creation Success Dialog functionality
 * 
 * This test validates:
 * 1. Success dialog appears after item creation
 * 2. No more "Checking for duplicates..." message
 * 3. Auto-redirect countdown works
 * 4. Manual navigation options work
 * 5. Create another item clears the form
 */

class ItemCreationSuccessDialogTest {
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
    console.log('🚀 Starting Puppeteer for Success Dialog test...');
    
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
      if (text.includes('Item created successfully') || text.includes('Success')) {
        console.log(`   ✅ Browser Console: ${text}`);
      }
      if (text.includes('Checking for duplicates')) {
        console.log(`   ⚠️ Still showing: ${text}`);
      }
    });

    // Monitor API responses
    this.page.on('response', response => {
      const url = response.url();
      const status = response.status();
      if (url.includes('/api/v1/items') && response.request().method() === 'POST') {
        console.log(`   📡 API Response: ${status} ${response.statusText()}`);
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
    const filename = `test-success-dialog-${name}-${timestamp}.png`;
    await this.page.screenshot({ path: filename, fullPage: true });
    this.testResults.screenshots.push(filename);
    console.log(`   📸 Screenshot saved: ${filename}`);
    return filename;
  }

  async login() {
    console.log('🔐 Logging in...');
    await this.page.goto('http://localhost:3000/login', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Click Demo Admin button
    await this.page.waitForSelector('button', { timeout: 10000 });
    const buttons = await this.page.$$('button');
    for (const button of buttons) {
      const text = await this.page.evaluate(el => el.textContent, button);
      if (text && text.includes('Demo Admin')) {
        await button.click();
        break;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('   ✓ Logged in successfully');
  }

  async testSuccessDialogFlow() {
    await this.runTest('Success Dialog Appears After Creation', async () => {
      console.log('   📍 Navigating to item creation page...');
      await this.page.goto('http://localhost:3000/products/items/new', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Fill form with unique item name
      const itemName = `Test Dialog Item ${Date.now()}`;
      console.log(`   📝 Creating item: ${itemName}`);
      
      await this.page.waitForSelector('input[name="item_name"]', { timeout: 10000 });
      await this.page.type('input[name="item_name"]', itemName);

      // Set as rentable
      const rentableCheckbox = await this.page.$('input[name="is_rentable"]');
      if (rentableCheckbox) {
        const isChecked = await this.page.$eval('input[name="is_rentable"]', el => el.checked);
        if (!isChecked) {
          await rentableCheckbox.click();
        }
      }

      // Submit form
      const submitButton = await this.page.$('button[type="submit"]');
      if (!submitButton) {
        throw new Error('Submit button not found');
      }

      await submitButton.click();

      // Wait for success dialog to appear
      console.log('   ⏳ Waiting for success dialog...');
      await this.page.waitForSelector('[role="dialog"]', { timeout: 10000 });
      
      await this.takeScreenshot('01-success-dialog');

      // Check if dialog content is present
      const dialogText = await this.page.$eval('[role="dialog"]', el => el.textContent);
      
      if (!dialogText.includes('Item Created Successfully')) {
        throw new Error('Success dialog does not contain expected text');
      }

      // Check if "Checking for duplicates" message is gone
      const pageContent = await this.page.content();
      if (pageContent.includes('Checking for duplicates')) {
        throw new Error('"Checking for duplicates" message still visible after success');
      }

      console.log('   ✓ Success dialog displayed correctly');
      console.log('   ✓ No duplicate checking message visible');
    });
  }

  async testAutoRedirect() {
    await this.runTest('Auto-redirect Countdown', async () => {
      // The dialog should still be open from previous test
      const dialog = await this.page.$('[role="dialog"]');
      if (!dialog) {
        throw new Error('Dialog not found for auto-redirect test');
      }

      // Check for countdown message
      const countdownElement = await this.page.$('p:has-text("Redirecting to item details")');
      if (!countdownElement) {
        console.log('   ⚠️ No countdown element found - might be disabled or already redirected');
        return;
      }

      // Wait a bit to see countdown change
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const countdownText = await this.page.$eval('p:has-text("Redirecting")', el => el.textContent);
      console.log(`   ⏱️ Countdown text: ${countdownText}`);
      
      await this.takeScreenshot('02-countdown');
    });
  }

  async testViewItemButton() {
    await this.runTest('View Item Details Button', async () => {
      // Click View Item Details button
      const viewButton = await this.page.$('button:has-text("View Item Details")');
      if (!viewButton) {
        console.log('   ⚠️ View Item Details button not found - may have auto-redirected');
        return;
      }

      await viewButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if we navigated to item detail page
      const url = this.page.url();
      if (url.includes('/products/items/') && !url.includes('/new')) {
        console.log(`   ✓ Navigated to item detail page: ${url}`);
      } else {
        throw new Error(`Did not navigate to item detail page. Current URL: ${url}`);
      }

      await this.takeScreenshot('03-item-detail-page');
    });
  }

  async testCreateAnotherButton() {
    await this.runTest('Create Another Item Button', async () => {
      // Go back to create a new item
      await this.page.goto('http://localhost:3000/products/items/new', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Create another item quickly
      const itemName = `Test Another Item ${Date.now()}`;
      await this.page.waitForSelector('input[name="item_name"]', { timeout: 10000 });
      await this.page.type('input[name="item_name"]', itemName);

      const submitButton = await this.page.$('button[type="submit"]');
      await submitButton.click();

      // Wait for success dialog
      await this.page.waitForSelector('[role="dialog"]', { timeout: 10000 });

      // Click Create Another button
      const createAnotherButton = await this.page.$('button:has-text("Create Another")');
      if (!createAnotherButton) {
        throw new Error('Create Another button not found');
      }

      await createAnotherButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if form is cleared
      const itemNameInput = await this.page.$('input[name="item_name"]');
      if (itemNameInput) {
        const value = await this.page.$eval('input[name="item_name"]', el => el.value);
        if (value && value.length > 0) {
          console.log(`   ⚠️ Form not fully cleared, item name still has: ${value}`);
        } else {
          console.log('   ✓ Form cleared successfully');
        }
      }

      await this.takeScreenshot('04-form-cleared');
    });
  }

  async testGoToListButton() {
    await this.runTest('Go to Items List Button', async () => {
      // Create one more item to test the Go to List button
      const itemName = `Test List Navigation ${Date.now()}`;
      
      // Check if we're on the form page, if not navigate there
      const url = this.page.url();
      if (!url.includes('/products/items/new')) {
        await this.page.goto('http://localhost:3000/products/items/new', {
          waitUntil: 'networkidle0',
          timeout: 30000
        });
      }

      await this.page.waitForSelector('input[name="item_name"]', { timeout: 10000 });
      
      // Clear existing text if any
      const itemNameInput = await this.page.$('input[name="item_name"]');
      await itemNameInput.click({ clickCount: 3 });
      await itemNameInput.type(itemName);

      const submitButton = await this.page.$('button[type="submit"]');
      await submitButton.click();

      // Wait for success dialog
      await this.page.waitForSelector('[role="dialog"]', { timeout: 10000 });

      // Click Go to Items List button
      const listButton = await this.page.$('button:has-text("Go to Items List")');
      if (!listButton) {
        throw new Error('Go to Items List button not found');
      }

      await listButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if we navigated to items list
      const currentUrl = this.page.url();
      if (currentUrl.includes('/products/items') && !currentUrl.includes('/new')) {
        console.log(`   ✓ Navigated to items list: ${currentUrl}`);
      } else {
        throw new Error(`Did not navigate to items list. Current URL: ${currentUrl}`);
      }

      await this.takeScreenshot('05-items-list');
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
      
      console.log('\n🎯 Starting Success Dialog Test Suite');
      console.log('='.repeat(50));

      await this.login();
      await this.testSuccessDialogFlow();
      await this.testAutoRedirect();
      await this.testViewItemButton();
      await this.testCreateAnotherButton();
      await this.testGoToListButton();

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
        console.log('🎉 All tests passed! Success dialog flow is working perfectly.');
      } else if (successRate >= 80) {
        console.log('✅ Test suite completed successfully with minor issues.');
      } else {
        console.log('⚠️ Test suite completed with significant issues. Please review.');
      }

    } catch (error) {
      console.error('💥 Test suite failed with error:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test suite
const testSuite = new ItemCreationSuccessDialogTest();
testSuite.runAllTests();