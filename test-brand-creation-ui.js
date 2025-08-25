#!/usr/bin/env node

/**
 * Brand Creation UI Test with Puppeteer
 * Tests the brand creation dialog and verifies the API endpoint error
 */

const puppeteer = require('puppeteer');

// Configuration
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  apiUrl: 'http://localhost:8000/api/v1',
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOW_MO) || 50,
  timeout: 30000
};

// Test credentials
const TEST_USER = {
  email: 'admin@admin.com',
  password: 'admin'
};

class BrandCreationTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      apiRequests: []
    };
  }

  async setup() {
    console.log('🧪 Starting Brand Creation UI Test...');
    console.log('⏰ Started at:', new Date().toISOString());
    console.log('🌐 Testing URL:', CONFIG.baseUrl);
    console.log('');
    
    this.browser = await puppeteer.launch({
      headless: CONFIG.headless,
      slowMo: CONFIG.slowMo,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 720 }
    });
    
    this.page = await this.browser.newPage();
    
    // Monitor console messages
    this.page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' && !text.includes('DevTools')) {
        console.log('🖥️ Console Error:', text);
        this.results.errors.push(`Console: ${text}`);
      }
    });
    
    // Monitor network requests for brand API calls
    this.page.on('request', request => {
      const url = request.url();
      if (url.includes('/brands') || url.includes('/master-data')) {
        const requestInfo = {
          method: request.method(),
          url: url,
          timestamp: new Date().toISOString(),
          type: 'request'
        };
        this.results.apiRequests.push(requestInfo);
        console.log(`🌐 API Request: ${request.method()} ${url}`);
      }
    });
    
    this.page.on('response', response => {
      const url = response.url();
      if (url.includes('/brands') || url.includes('/master-data')) {
        const responseInfo = {
          url: url,
          status: response.status(),
          statusText: response.statusText(),
          timestamp: new Date().toISOString(),
          type: 'response'
        };
        this.results.apiRequests.push(responseInfo);
        
        const statusIcon = response.status() >= 400 ? '❌' : '✅';
        console.log(`📡 API Response: ${statusIcon} ${response.status()} ${response.statusText()} - ${url}`);
        
        if (response.status() === 404) {
          this.results.errors.push(`404 Not Found: ${url}`);
          console.log(`🚨 404 ERROR DETECTED: ${url}`);
        }
      }
    });
    
    // Handle page errors
    this.page.on('pageerror', error => {
      console.error('❌ Page Error:', error.message);
      this.results.errors.push(`Page Error: ${error.message}`);
    });
  }

  async test(name, testFunc) {
    this.results.total++;
    try {
      console.log(`\n🧪 Testing: ${name}`);
      await testFunc();
      console.log(`✅ PASSED: ${name}`);
      this.results.passed++;
      return true;
    } catch (error) {
      console.error(`❌ FAILED: ${name} - ${error.message}`);
      this.results.failed++;
      this.results.errors.push(`${name}: ${error.message}`);
      
      // Take screenshot on failure
      try {
        const screenshotPath = `brand-test-failure-${Date.now()}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        console.log('⚠️ Could not take screenshot:', screenshotError.message);
      }
      return false;
    }
  }

  // Test 1: Login to the application
  async testLogin() {
    console.log('🔐 Logging in to the application...');
    
    await this.page.goto(CONFIG.baseUrl, { 
      waitUntil: 'networkidle2',
      timeout: CONFIG.timeout 
    });
    
    // Check if already logged in or need to login
    const currentUrl = this.page.url();
    if (currentUrl.includes('/login') || currentUrl === CONFIG.baseUrl + '/') {
      // Try to click "Demo as Administrator" button first
      const demoAdminButton = await this.page.$('button:has-text("Demo as Administrator")');
      if (demoAdminButton) {
        console.log('🔘 Found "Demo as Administrator" button, clicking...');
        await demoAdminButton.click();
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: CONFIG.timeout });
      } else {
        // Manual login
        console.log('📝 Performing manual login...');
        await this.page.type('input[type="email"], input[name="email"], input[placeholder*="email" i]', TEST_USER.email);
        await this.page.type('input[type="password"], input[name="password"], input[placeholder*="password" i]', TEST_USER.password);
        
        const loginButton = await this.page.$('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
        if (loginButton) {
          await loginButton.click();
          await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: CONFIG.timeout });
        } else {
          throw new Error('Login button not found');
        }
      }
    }
    
    // Verify we're logged in by checking URL or looking for dashboard elements
    await this.page.waitForTimeout(2000);
    const afterLoginUrl = this.page.url();
    console.log('🟢 Current URL after login:', afterLoginUrl);
    
    if (afterLoginUrl.includes('/login')) {
      throw new Error('Login failed - still on login page');
    }
    
    console.log('✅ Successfully logged in');
  }

  // Test 2: Navigate to Brands Page
  async testNavigateToBrandsPage() {
    console.log('🌐 Navigating to brands page...');
    
    await this.page.goto(`${CONFIG.baseUrl}/products/brands`, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.timeout
    });
    
    // Wait for brands page to load
    await this.page.waitForSelector('h1', { timeout: 10000 });
    
    const pageTitle = await this.page.$eval('h1', el => el.textContent);
    console.log('🟢 Page title:', pageTitle);
    
    if (!pageTitle.toLowerCase().includes('brand')) {
      throw new Error(`Expected brands page, but got: ${pageTitle}`);
    }
    
    console.log('✅ Successfully navigated to brands page');
  }

  // Test 3: Open Add Brand Dialog
  async testOpenAddBrandDialog() {
    console.log('📝 Opening Add Brand dialog...');
    
    // Find and click the "Add Brand" button
    const addButton = await this.page.$('button:has-text("Add Brand")');
    if (!addButton) {
      throw new Error('Add Brand button not found');
    }
    
    await addButton.click();
    
    // Wait for dialog to open
    await this.page.waitForTimeout(1000);
    
    // Check if dialog is visible
    const dialogTitle = await this.page.$('h2:has-text("Add New Brand"), div:has-text("Add New Brand")');
    if (!dialogTitle) {
      throw new Error('Add Brand dialog did not open');
    }
    
    console.log('✅ Add Brand dialog opened successfully');
  }

  // Test 4: Fill Brand Form
  async testFillBrandForm() {
    console.log('📝 Filling brand form...');
    
    const timestamp = Date.now();
    const brandData = {
      name: `Test Brand ${timestamp}`,
      code: `TEST-${timestamp}`,
      description: 'This is a test brand created by Puppeteer'
    };
    
    // Fill brand name
    const nameInput = await this.page.$('input[id="brand-name"], input[placeholder*="Canon" i]');
    if (!nameInput) {
      throw new Error('Brand name input not found');
    }
    await nameInput.type(brandData.name);
    
    // Fill brand code
    const codeInput = await this.page.$('input[id="brand-code"], input[placeholder*="CANON" i]');
    if (codeInput) {
      await codeInput.type(brandData.code);
    }
    
    // Fill description
    const descriptionInput = await this.page.$('textarea[id="description"], textarea[placeholder*="description" i]');
    if (descriptionInput) {
      await descriptionInput.type(brandData.description);
    }
    
    console.log(`✅ Form filled with brand: ${brandData.name}`);
    return brandData;
  }

  // Test 5: Submit Brand Form and Monitor API
  async testSubmitBrandForm() {
    console.log('🚀 Submitting brand form...');
    
    // Clear previous API requests for clean monitoring
    this.results.apiRequests = [];
    
    // Find and click submit button
    const submitButton = await this.page.$('button:has-text("Create Brand")');
    if (!submitButton) {
      throw new Error('Submit button not found');
    }
    
    // Click submit and wait for response
    await submitButton.click();
    
    // Wait for API response
    await this.page.waitForTimeout(3000);
    
    // Check for 404 errors
    const notFoundErrors = this.results.apiRequests.filter(req => 
      req.status === 404 && req.type === 'response'
    );
    
    if (notFoundErrors.length > 0) {
      console.log('❌ 404 Errors detected:');
      notFoundErrors.forEach(error => {
        console.log(`   - ${error.url}`);
      });
      throw new Error(`404 Not Found errors detected for brand creation API`);
    }
    
    // Check for success dialog or notification
    const successDialog = await this.page.$('div:has-text("Success"), div:has-text("successfully")');
    if (successDialog) {
      console.log('✅ Brand created successfully');
    } else {
      // Check for error dialog
      const errorDialog = await this.page.$('div:has-text("Error"), div:has-text("Failed")');
      if (errorDialog) {
        const errorText = await errorDialog.evaluate(el => el.textContent);
        throw new Error(`Brand creation failed with error: ${errorText}`);
      }
    }
    
    console.log('✅ Brand form submitted');
  }

  // Test 6: Verify API Endpoints
  async testAPIEndpoints() {
    console.log('🔍 Analyzing API endpoints used...');
    
    const brandRequests = this.results.apiRequests.filter(req => 
      req.url && (req.url.includes('/brands') || req.url.includes('/master-data'))
    );
    
    const correctEndpoints = brandRequests.filter(req => 
      req.url.includes('/api/v1/brands/') && !req.url.includes('/master-data/')
    );
    
    const incorrectEndpoints = brandRequests.filter(req => 
      req.url.includes('/master-data/brands/')
    );
    
    console.log(`📊 Correct endpoints (/api/v1/brands/): ${correctEndpoints.length}`);
    console.log(`📊 Incorrect endpoints (/master-data/brands/): ${incorrectEndpoints.length}`);
    
    if (incorrectEndpoints.length > 0) {
      console.log('❌ Frontend is using incorrect endpoints:');
      incorrectEndpoints.forEach(req => {
        console.log(`   - ${req.method || 'RESPONSE'} ${req.url}`);
      });
      throw new Error('Frontend is calling incorrect /master-data/brands/ endpoints');
    }
    
    if (correctEndpoints.length === 0 && brandRequests.length === 0) {
      console.log('⚠️ No brand API calls detected');
    }
    
    console.log('🟢 API endpoint analysis complete');
  }

  async runAllTests() {
    try {
      await this.setup();
      
      console.log('\n🎯 Phase 1: Authentication');
      await this.test('Login to Application', () => this.testLogin());
      
      console.log('\n🎯 Phase 2: Navigation');
      await this.test('Navigate to Brands Page', () => this.testNavigateToBrandsPage());
      
      console.log('\n🎯 Phase 3: Brand Creation');
      await this.test('Open Add Brand Dialog', () => this.testOpenAddBrandDialog());
      await this.test('Fill Brand Form', () => this.testFillBrandForm());
      await this.test('Submit Brand Form', () => this.testSubmitBrandForm());
      
      console.log('\n🎯 Phase 4: API Analysis');
      await this.test('Verify API Endpoints', () => this.testAPIEndpoints());
      
    } catch (error) {
      console.error('❌ Test suite setup failed:', error.message);
      this.results.errors.push(`Setup failed: ${error.message}`);
    } finally {
      await this.cleanup();
      this.printResults();
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  printResults() {
    const duration = Date.now();
    const successRate = Math.round((this.results.passed / this.results.total) * 100);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 BRAND CREATION UI TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${this.results.passed}/${this.results.total}`);
    console.log(`❌ Failed: ${this.results.failed}/${this.results.total}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    // API Analysis
    const apiCalls = this.results.apiRequests.filter(req => req.url?.includes('/brands'));
    const correctCalls = apiCalls.filter(req => 
      req.url.includes('/api/v1/brands/') && !req.url.includes('/master-data/')
    );
    const incorrectCalls = apiCalls.filter(req => 
      req.url.includes('/master-data/brands/')
    );
    
    console.log('\n📡 API ENDPOINT ANALYSIS:');
    console.log(`🌐 Total Brand API Calls: ${apiCalls.length}`);
    console.log(`✅ Correct Endpoints (/brands/): ${correctCalls.length}`);
    console.log(`❌ Incorrect Endpoints (/master-data/brands/): ${incorrectCalls.length}`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ ERRORS DETECTED:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    // Final Assessment
    console.log('\n🎯 FINAL ASSESSMENT:');
    console.log('='.repeat(40));
    
    if (incorrectCalls.length > 0) {
      console.log('❌ ISSUE CONFIRMED: Frontend is using incorrect /master-data/brands/ endpoints');
      console.log('❌ This needs to be fixed in /src/services/api/brands.ts');
      console.log('❌ Change all "/master-data/brands/" to "/brands/"');
    } else if (this.results.failed === 0) {
      console.log('🎉 SUCCESS: Brand creation is working correctly!');
      console.log('✅ All API endpoints are correct');
      console.log('✅ Brand creation completed successfully');
    } else {
      console.log('⚠️ PARTIAL SUCCESS: Some tests failed but not due to endpoint issues');
    }
    
    console.log('='.repeat(70));
    
    // Exit with appropriate code
    process.exit(this.results.failed > 0 || incorrectCalls.length > 0 ? 1 : 0);
  }
}

// Run the test
if (require.main === module) {
  const tester = new BrandCreationTest();
  tester.runAllTests().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = BrandCreationTest;