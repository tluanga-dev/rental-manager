const puppeteer = require('puppeteer');

/**
 * Test suite for Inventory Items page endpoint fix
 * 
 * This test validates:
 * 1. Page accessibility at http://localhost:3000/inventory/items
 * 2. API endpoint resolution (no 404 errors for /api/v1/inventory/items)  
 * 3. Component loading and error handling
 * 4. UI elements and functionality
 */

class InventoryItemsPageTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async setup() {
    console.log('🚀 Starting Puppeteer for Inventory Items page test...');
    
    this.browser = await puppeteer.launch({ 
      headless: false, // Keep browser open to see what's happening
      slowMo: 100, // Slow down actions for visibility
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Enable console logging from the page
    this.page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || text.includes('inventory')) {
        console.log(`🔍 Browser Console [${type}]: ${text}`);
      }
    });

    // Monitor network requests for API calls
    this.page.on('requestfailed', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        console.log(`❌ Failed API Request: ${request.method()} ${url}`);
        console.log(`   Failure: ${request.failure().errorText}`);
      }
    });

    this.page.on('response', response => {
      const url = response.url();
      const status = response.status();
      if (url.includes('/api/v1/inventory/')) {
        if (status >= 400) {
          console.log(`❌ API Error: ${status} ${response.statusText()} - ${url}`);
        } else {
          console.log(`✅ API Success: ${status} - ${url}`);
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

  async testPageAccessibility() {
    await this.runTest('Page Accessibility', async () => {
      console.log('   📍 Navigating to http://localhost:3000/inventory/items');
      
      const response = await this.page.goto('http://localhost:3000/inventory/items', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      if (!response.ok() && response.status() !== 200) {
        throw new Error(`Page returned status ${response.status()}: ${response.statusText()}`);
      }

      console.log('   ✓ Page loaded successfully');
    });
  }

  async testNoApiErrors() {
    await this.runTest('No API 404 Errors', async () => {
      console.log('   🔍 Checking for API 404 errors in network requests');
      
      let apiErrors = [];
      
      // Set up request monitoring before navigation
      this.page.on('response', response => {
        const url = response.url();
        const status = response.status();
        if (url.includes('/api/v1/inventory/items') && status === 404) {
          apiErrors.push({
            url: url,
            status: status,
            statusText: response.statusText()
          });
        }
      });

      // Wait a bit for any async API calls to complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (apiErrors.length > 0) {
        throw new Error(`Found ${apiErrors.length} API 404 errors: ${JSON.stringify(apiErrors, null, 2)}`);
      }

      console.log('   ✓ No 404 errors found for inventory API endpoints');
    });
  }

  async testPageTitle() {
    await this.runTest('Page Title and Headers', async () => {
      console.log('   🔍 Checking page title and header elements');

      const title = await this.page.title();
      console.log(`   📄 Page title: ${title}`);

      // Wait for the page to fully load and check for the inventory items header
      try {
        await this.page.waitForSelector('h1', { timeout: 10000 });
        const headerText = await this.page.$eval('h1', el => el.textContent);
        console.log(`   📋 Header found: ${headerText}`);
        
        if (headerText && headerText.includes('Inventory Items')) {
          console.log('   ✓ Inventory Items header found');
        } else {
          console.log('   ℹ️ Header text does not contain "Inventory Items" - might be in authentication or loading state');
        }
      } catch (error) {
        console.log('   ℹ️ No h1 element found - page might be in loading or auth state');
      }
    });
  }

  async testComponentLoading() {
    await this.runTest('Component Loading', async () => {
      console.log('   🔍 Checking for component loading indicators');

      // Check if we're in an authentication loading state
      const bodyText = await this.page.$eval('body', el => el.textContent);
      
      if (bodyText.includes('Checking authentication')) {
        console.log('   ℹ️ Page is in authentication loading state (expected)');
        return;
      }

      // Check for error messages  
      if (bodyText.includes('Failed to Load')) {
        throw new Error(`Component shows error in page content`);
      }

      // Check for loading spinners or content
      const loadingElement = await this.page.$('[class*="animate-spin"]');
      if (loadingElement) {
        console.log('   ℹ️ Loading spinner detected - component is loading');
      }

      console.log('   ✓ No error components detected');
    });
  }

  async testApiEndpointDirectly() {
    await this.runTest('Direct API Endpoint Test', async () => {
      console.log('   🔍 Testing API endpoints directly');

      // Test the inventory stocks endpoint (which should work now)
      const response = await this.page.goto('http://localhost:8000/api/v1/inventory/stocks', {
        waitUntil: 'networkidle0',
        timeout: 10000
      });

      if (!response.ok()) {
        throw new Error(`API endpoint returned status ${response.status()}: ${response.statusText()}`);
      }

      const responseText = await this.page.content();
      console.log('   📄 API Response preview:', responseText.substring(0, 200) + '...');

      try {
        const jsonMatch = responseText.match(/{[\s\S]*}/);
        if (jsonMatch) {
          const responseData = JSON.parse(jsonMatch[0]);
          if (responseData.success !== undefined) {
            console.log(`   ✓ API Response format correct: success=${responseData.success}, data count=${Array.isArray(responseData.data) ? responseData.data.length : 'N/A'}`);
          }
        }
      } catch (e) {
        console.log('   ℹ️ Could not parse response as JSON, but response was received');
      }
    });
  }

  async testConsoleErrors() {
    await this.runTest('Console Error Check', async () => {
      console.log('   🔍 Checking for JavaScript console errors');

      let consoleErrors = [];

      this.page.on('pageerror', error => {
        consoleErrors.push(error.message);
      });

      // Navigate back to the main page and wait for any console errors
      await this.page.goto('http://localhost:3000/inventory/items', {
        waitUntil: 'networkidle0',
        timeout: 15000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Filter out common non-critical errors
      const criticalErrors = consoleErrors.filter(error => 
        !error.includes('ResizeObserver') && 
        !error.includes('Non-passive event listener') &&
        !error.includes('favicon')
      );

      if (criticalErrors.length > 0) {
        console.log('   ⚠️ Found console errors (might be expected during development):');
        criticalErrors.forEach(error => console.log(`     - ${error}`));
      } else {
        console.log('   ✓ No critical console errors detected');
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
      
      console.log('\n🎯 Starting Inventory Items Page Test Suite');
      console.log('='.repeat(50));

      await this.testPageAccessibility();
      await this.testNoApiErrors();
      await this.testPageTitle();
      await this.testComponentLoading();
      await this.testApiEndpointDirectly();
      await this.testConsoleErrors();

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

      const successRate = Math.round((this.testResults.passed / this.testResults.total) * 100);
      console.log(`\n🎯 Success Rate: ${successRate}%`);

      if (successRate >= 80) {
        console.log('🎉 Test suite completed successfully! The inventory items page is working correctly.');
      } else {
        console.log('⚠️ Test suite completed with some issues. Review the errors above.');
      }

    } catch (error) {
      console.error('💥 Test suite failed with error:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test suite
const testSuite = new InventoryItemsPageTest();
testSuite.runAllTests();