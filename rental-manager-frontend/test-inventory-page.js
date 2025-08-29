const puppeteer = require('puppeteer');
const fs = require('fs').promises;

/**
 * Inventory Page Data Loading Test
 * Tests authentication and data loading for the inventory page
 */

class InventoryPageTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };
  }

  async init() {
    console.log('🚀 Starting Inventory Page Test');
    
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 720 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Enable console logging from the page
    this.page.on('console', (msg) => {
      console.log('📱 PAGE:', msg.text());
    });
    
    // Enable network request logging
    this.page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('inventory')) {
        console.log(`🌐 API Response: ${response.status()} ${url}`);
      }
    });
    
    // Enable error logging
    this.page.on('pageerror', (error) => {
      console.error('❌ PAGE ERROR:', error.message);
    });
  }

  async testEnvironmentHealth() {
    console.log('\n🏥 Testing Environment Health');
    
    try {
      // Test frontend availability
      await this.page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 });
      console.log('✅ Frontend is accessible at http://localhost:3000');
      
      // Test backend API health
      const apiResponse = await this.page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:8000/api/health');
          return { status: response.status, ok: response.ok };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      if (apiResponse.ok) {
        console.log('✅ Backend API is accessible at http://localhost:8000/api');
      } else {
        console.log('❌ Backend API issue:', apiResponse);
      }
      
      this.results.tests.environment = { status: 'PASSED', details: 'Environment healthy' };
      return true;
    } catch (error) {
      console.error('❌ Environment health check failed:', error.message);
      this.results.tests.environment = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  async testAuthentication() {
    console.log('\n🔐 Testing Authentication Flow');
    
    try {
      // Go to inventory page directly
      await this.page.goto('http://localhost:3000/inventory', { waitUntil: 'networkidle0' });
      
      // Check if we're redirected to login or see auth guard
      const currentUrl = this.page.url();
      console.log('📍 Current URL after navigation:', currentUrl);
      
      // Check for authentication elements
      const authElements = await this.page.evaluate(() => {
        const hasLoginForm = !!document.querySelector('input[type="email"]');
        const hasAuthGuard = !!document.querySelector('[data-testid="auth-guard"]') || 
                           document.body.textContent.includes('Checking authentication') ||
                           document.body.textContent.includes('Authentication required');
        const hasInventoryContent = document.body.textContent.includes('Item Inventory');
        const hasLoadingState = document.body.textContent.includes('Loading') || 
                               document.body.textContent.includes('Checking');
        
        return {
          hasLoginForm,
          hasAuthGuard, 
          hasInventoryContent,
          hasLoadingState,
          bodyText: document.body.textContent.substring(0, 500) // First 500 chars
        };
      });
      
      console.log('🔍 Auth Elements Check:', authElements);
      
      // If we see login form, we need to authenticate
      if (authElements.hasLoginForm || currentUrl.includes('login')) {
        console.log('🔑 Login required, attempting demo login...');
        return await this.performLogin();
      }
      
      // If we see inventory content, we're already authenticated
      if (authElements.hasInventoryContent) {
        console.log('✅ Already authenticated, inventory page loaded');
        this.results.tests.authentication = { status: 'PASSED', details: 'Already authenticated' };
        return true;
      }
      
      // If we see auth guard or loading state, wait a bit
      if (authElements.hasAuthGuard || authElements.hasLoadingState) {
        console.log('⏳ Auth guard detected, waiting for auth check...');
        await this.page.waitForTimeout(3000);
        
        // Check again after waiting
        const finalState = await this.page.evaluate(() => {
          return {
            hasInventoryContent: document.body.textContent.includes('Item Inventory'),
            hasLoginForm: !!document.querySelector('input[type="email"]'),
            currentText: document.body.textContent.substring(0, 300)
          };
        });
        
        console.log('🔍 Final auth state:', finalState);
        
        if (finalState.hasInventoryContent) {
          console.log('✅ Authentication successful after waiting');
          this.results.tests.authentication = { status: 'PASSED', details: 'Authenticated after delay' };
          return true;
        }
        
        if (finalState.hasLoginForm) {
          console.log('🔑 Redirected to login, attempting demo login...');
          return await this.performLogin();
        }
      }
      
      console.log('❌ Authentication state unclear');
      this.results.tests.authentication = { status: 'UNCLEAR', details: authElements };
      return false;
      
    } catch (error) {
      console.error('❌ Authentication test failed:', error.message);
      this.results.tests.authentication = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  async performLogin() {
    try {
      console.log('🔐 Performing demo admin login...');
      
      // Wait for login form elements
      await this.page.waitForSelector('input[type="email"]', { timeout: 5000 });
      
      // Fill login form
      await this.page.type('input[type="email"]', 'admin@example.com');
      await this.page.type('input[type="password"]', 'admin123');
      
      // Submit login form
      await this.page.click('button[type="submit"]');
      
      // Wait for login to complete
      await this.page.waitForTimeout(2000);
      
      // Navigate to inventory page after login
      await this.page.goto('http://localhost:3000/inventory', { waitUntil: 'networkidle0' });
      
      // Check if we're now on the inventory page
      const inventoryContent = await this.page.evaluate(() => {
        return {
          hasInventoryContent: document.body.textContent.includes('Item Inventory'),
          hasError: document.body.textContent.includes('Error') || document.body.textContent.includes('Failed'),
          currentText: document.body.textContent.substring(0, 300)
        };
      });
      
      if (inventoryContent.hasInventoryContent) {
        console.log('✅ Login successful, inventory page loaded');
        this.results.tests.authentication = { status: 'PASSED', details: 'Login successful' };
        return true;
      } else {
        console.log('❌ Login completed but inventory page not loaded:', inventoryContent);
        this.results.tests.authentication = { status: 'FAILED', details: inventoryContent };
        return false;
      }
      
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      this.results.tests.authentication = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  async testInventoryDataLoading() {
    console.log('\n📊 Testing Inventory Data Loading');
    
    try {
      // Ensure we're on inventory page
      await this.page.goto('http://localhost:3000/inventory', { waitUntil: 'networkidle0' });
      
      // Check current page state
      const pageState = await this.page.evaluate(() => {
        const hasInventoryTable = !!document.querySelector('[data-testid="inventory-table"]') ||
                                 document.body.textContent.includes('SKU') ||
                                 document.body.textContent.includes('Item Name');
        const hasNoDataMessage = document.body.textContent.includes('No data') ||
                                document.body.textContent.includes('No items found') ||
                                document.body.textContent.includes('Empty');
        const hasLoadingState = document.body.textContent.includes('Loading') ||
                              document.body.textContent.includes('Fetching');
        const hasErrorMessage = document.body.textContent.includes('Error') ||
                              document.body.textContent.includes('Failed to load');
                              
        // Look for table rows or data indicators
        const tableRows = document.querySelectorAll('tr').length;
        const hasDataRows = tableRows > 1; // More than just header
        
        return {
          hasInventoryTable,
          hasNoDataMessage,
          hasLoadingState,
          hasErrorMessage,
          hasDataRows,
          tableRows,
          pageText: document.body.textContent.substring(0, 1000)
        };
      });
      
      console.log('📋 Inventory page state:', pageState);
      
      // Wait for data loading to complete
      if (pageState.hasLoadingState) {
        console.log('⏳ Data loading in progress, waiting...');
        await this.page.waitForTimeout(5000);
        
        // Check again after waiting
        const finalState = await this.page.evaluate(() => {
          const tableRows = document.querySelectorAll('tr').length;
          return {
            hasDataRows: tableRows > 1,
            tableRows,
            hasNoDataMessage: document.body.textContent.includes('No data'),
            hasErrorMessage: document.body.textContent.includes('Error'),
            pageText: document.body.textContent.substring(0, 500)
          };
        });
        
        console.log('📋 Final inventory state:', finalState);
        pageState.hasDataRows = finalState.hasDataRows;
        pageState.tableRows = finalState.tableRows;
        pageState.hasNoDataMessage = finalState.hasNoDataMessage;
        pageState.hasErrorMessage = finalState.hasErrorMessage;
      }
      
      // Analyze results
      if (pageState.hasDataRows && pageState.tableRows > 1) {
        console.log(`✅ Inventory data loaded successfully (${pageState.tableRows} rows)`);
        this.results.tests.dataLoading = { 
          status: 'PASSED', 
          details: `${pageState.tableRows} rows loaded`,
          hasData: true 
        };
        return true;
      } else if (pageState.hasNoDataMessage && !pageState.hasErrorMessage) {
        console.log('⚠️ No inventory data found (may be normal if database is empty)');
        this.results.tests.dataLoading = { 
          status: 'NO_DATA', 
          details: 'No data message displayed',
          hasData: false 
        };
        return true;
      } else if (pageState.hasErrorMessage) {
        console.log('❌ Error loading inventory data');
        this.results.tests.dataLoading = { 
          status: 'ERROR', 
          details: 'Error message displayed',
          hasData: false 
        };
        return false;
      } else {
        console.log('❌ Inventory page state unclear');
        this.results.tests.dataLoading = { 
          status: 'UNCLEAR', 
          details: pageState,
          hasData: false 
        };
        return false;
      }
      
    } catch (error) {
      console.error('❌ Inventory data loading test failed:', error.message);
      this.results.tests.dataLoading = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  async testApiEndpoint() {
    console.log('\n🔌 Testing /inventory/stocks API Endpoint');
    
    try {
      // Test the API endpoint directly
      const apiTest = await this.page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:8000/api/inventory/stocks', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              // Include auth token if available in localStorage
              ...(localStorage.getItem('auth-token') && {
                'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
              })
            }
          });
          
          const data = await response.json();
          
          return {
            status: response.status,
            ok: response.ok,
            dataType: Array.isArray(data) ? 'array' : typeof data,
            dataLength: Array.isArray(data) ? data.length : (data?.data ? data.data.length : 0),
            hasData: Array.isArray(data) ? data.length > 0 : !!(data?.data && data.data.length > 0),
            firstItem: Array.isArray(data) ? data[0] : data?.data?.[0],
            error: response.ok ? null : data
          };
        } catch (error) {
          return { error: error.message, networkError: true };
        }
      });
      
      console.log('🔍 API Test Results:', apiTest);
      
      if (apiTest.networkError) {
        console.log('❌ Network error accessing API endpoint');
        this.results.tests.apiEndpoint = { status: 'NETWORK_ERROR', error: apiTest.error };
        return false;
      } else if (apiTest.ok && apiTest.hasData) {
        console.log(`✅ API endpoint working, returned ${apiTest.dataLength} items`);
        this.results.tests.apiEndpoint = { 
          status: 'PASSED', 
          details: `${apiTest.dataLength} items returned`,
          sample: apiTest.firstItem 
        };
        return true;
      } else if (apiTest.ok && !apiTest.hasData) {
        console.log('⚠️ API endpoint working but no data returned');
        this.results.tests.apiEndpoint = { 
          status: 'NO_DATA', 
          details: 'Empty response from API',
          response: apiTest 
        };
        return true;
      } else {
        console.log(`❌ API endpoint error: ${apiTest.status}`, apiTest.error);
        this.results.tests.apiEndpoint = { status: 'API_ERROR', error: apiTest };
        return false;
      }
      
    } catch (error) {
      console.error('❌ API endpoint test failed:', error.message);
      this.results.tests.apiEndpoint = { status: 'FAILED', error: error.message };
      return false;
    }
  }

  async takeScreenshot() {
    try {
      await this.page.screenshot({ 
        path: 'inventory-page-screenshot.png',
        fullPage: true 
      });
      console.log('📸 Screenshot saved as inventory-page-screenshot.png');
    } catch (error) {
      console.log('⚠️ Could not take screenshot:', error.message);
    }
  }

  async runAllTests() {
    try {
      await this.init();
      
      console.log('='.repeat(60));
      console.log('🧪 INVENTORY PAGE DIAGNOSTIC TEST');
      console.log('='.repeat(60));
      
      const envHealthy = await this.testEnvironmentHealth();
      if (!envHealthy) {
        console.log('❌ Environment not healthy, stopping tests');
        await this.generateReport();
        return false;
      }
      
      const authenticated = await this.testAuthentication();
      if (!authenticated) {
        console.log('❌ Authentication failed, stopping tests');
        await this.generateReport();
        return false;
      }
      
      // Update todo
      console.log('\n✅ Authentication working, testing data loading...');
      
      const dataLoaded = await this.testInventoryDataLoading();
      const apiWorking = await this.testApiEndpoint();
      
      await this.takeScreenshot();
      await this.generateReport();
      
      return authenticated && (dataLoaded || apiWorking);
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      await this.generateReport();
      return false;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 INVENTORY PAGE TEST REPORT');
    console.log('='.repeat(60));
    
    const overallSuccess = Object.values(this.results.tests).every(test => 
      ['PASSED', 'NO_DATA'].includes(test.status)
    );
    
    console.log(`\n🏆 Overall Result: ${overallSuccess ? '✅ SUCCESS' : '❌ ISSUES FOUND'}`);
    
    for (const [testName, result] of Object.entries(this.results.tests)) {
      const statusIcon = result.status === 'PASSED' ? '✅' : 
                        result.status === 'NO_DATA' ? '⚠️' : '❌';
      console.log(`${statusIcon} ${testName}: ${result.status}`);
      if (result.details) console.log(`   Details: ${result.details}`);
      if (result.error) console.log(`   Error: ${result.error}`);
    }
    
    console.log('\n💡 Recommendations:');
    
    if (this.results.tests.environment?.status !== 'PASSED') {
      console.log('   - Check that Docker services are running');
      console.log('   - Verify backend API is accessible at http://localhost:8000');
    }
    
    if (this.results.tests.authentication?.status !== 'PASSED') {
      console.log('   - Check authentication configuration');
      console.log('   - Verify auth store and token management');
    }
    
    if (this.results.tests.dataLoading?.status === 'NO_DATA') {
      console.log('   - Database may be empty (this could be normal)');
      console.log('   - Check if inventory items exist in database');
    }
    
    if (this.results.tests.apiEndpoint?.status !== 'PASSED') {
      console.log('   - Check backend /inventory/stocks endpoint');
      console.log('   - Verify database has inventory data');
      console.log('   - Check API authentication and permissions');
    }
    
    console.log('='.repeat(60));
    
    // Save report
    await fs.writeFile('inventory-page-test-report.json', JSON.stringify(this.results, null, 2));
    console.log('📄 Detailed report saved as inventory-page-test-report.json');
  }
}

// Run the test
async function main() {
  const tester = new InventoryPageTester();
  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = InventoryPageTester;