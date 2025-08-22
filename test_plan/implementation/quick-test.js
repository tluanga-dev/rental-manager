/**
 * Quick Test Execution - Direct Testing Without Jest Server Management
 */

const puppeteer = require('puppeteer');
const axios = require('axios');

async function quickTest() {
  console.log('🚀 Starting Quick Supplier CRUD Test...\n');
  
  let browser;
  let results = {
    environment: { passed: 0, failed: 0 },
    authentication: { passed: 0, failed: 0 },
    create: { passed: 0, failed: 0 },
    read: { passed: 0, failed: 0 },
    overall: { passed: 0, failed: 0, total: 0 }
  };

  try {
    // Environment Check
    console.log('🔍 Environment Checks:');
    
    // Check frontend
    try {
      const frontendResponse = await axios.get('http://localhost:3001', { timeout: 5000 });
      console.log('   ✅ Frontend Server: OK');
      results.environment.passed++;
    } catch (error) {
      console.log('   ❌ Frontend Server: FAILED');
      results.environment.failed++;
    }
    
    // Check backend
    try {
      const backendResponse = await axios.get('http://localhost:8001/health', { timeout: 5000 });
      console.log('   ✅ Backend API: OK');
      results.environment.passed++;
    } catch (error) {
      console.log('   ❌ Backend API: FAILED');
      results.environment.failed++;
    }
    
    console.log();

    // Authentication Test
    console.log('🔐 Authentication Test:');
    let authToken = null;
    
    try {
      const loginResponse = await axios.post('http://localhost:8001/api/v1/auth/login', {
        username: 'admin',
        password: 'K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3'
      }, { timeout: 10000 });
      
      authToken = loginResponse.data.access_token;
      console.log('   ✅ Admin Login: OK');
      results.authentication.passed++;
    } catch (error) {
      console.log('   ❌ Admin Login: FAILED -', error.response?.status || error.message);
      results.authentication.failed++;
    }
    
    console.log();

    // Launch Browser for Frontend Tests
    console.log('🌐 Starting Browser Tests:');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set auth token in localStorage
    if (authToken) {
      await page.goto('http://localhost:3001');
      await page.evaluate((token) => {
        localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            accessToken: token,
            isAuthenticated: true,
            user: { id: 1, username: 'admin', userType: 'SUPERADMIN' }
          }
        }));
      }, authToken);
    }
    
    // Test 1: Navigate to Suppliers Page
    console.log('📋 READ Test: Supplier List Page');
    try {
      await page.goto('http://localhost:3001/purchases/suppliers', {
        waitUntil: 'networkidle2',
        timeout: 15000
      });
      
      const pageTitle = await page.title();
      console.log(`   ✅ Page loaded: ${pageTitle}`);
      results.read.passed++;
      
      // Take screenshot
      await page.screenshot({ 
        path: './reports/screenshots/quick-test-supplier-list.png',
        fullPage: true 
      });
      
    } catch (error) {
      console.log('   ❌ Supplier list page failed:', error.message);
      results.read.failed++;
    }
    
    // Test 2: Navigate to Create Form
    console.log('📝 CREATE Test: New Supplier Form');
    try {
      await page.goto('http://localhost:3001/purchases/suppliers/new', {
        waitUntil: 'networkidle2', 
        timeout: 15000
      });
      
      // Check if form is present
      await page.waitForSelector('form', { timeout: 5000 });
      console.log('   ✅ Create form loaded');
      results.create.passed++;
      
      // Fill basic form fields
      await page.fill('[name="supplier_code"]', 'QUICKTEST001');
      await page.fill('[name="company_name"]', 'Quick Test Company');
      await page.selectOption('[name="supplier_type"]', 'DISTRIBUTOR');
      
      console.log('   ✅ Form fields populated');
      results.create.passed++;
      
      // Take screenshot
      await page.screenshot({ 
        path: './reports/screenshots/quick-test-create-form.png',
        fullPage: true 
      });
      
    } catch (error) {
      console.log('   ❌ Create form test failed:', error.message);
      results.create.failed++;
    }
    
    // API Test: List Suppliers
    if (authToken) {
      console.log('📡 API Test: List Suppliers');
      try {
        const suppliersResponse = await axios.get('http://localhost:8001/api/v1/suppliers/', {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 10000
        });
        
        console.log(`   ✅ API returned ${suppliersResponse.data.length || 0} suppliers`);
        results.read.passed++;
        
      } catch (error) {
        console.log('   ❌ API suppliers list failed:', error.response?.status || error.message);
        results.read.failed++;
      }
    }
    
  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  // Calculate overall results
  results.overall.passed = results.environment.passed + results.authentication.passed + 
                          results.create.passed + results.read.passed;
  results.overall.failed = results.environment.failed + results.authentication.failed + 
                          results.create.failed + results.read.failed;
  results.overall.total = results.overall.passed + results.overall.failed;
  
  // Print Summary
  console.log('\n═'.repeat(60));
  console.log('🏁 QUICK TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`📊 Total Tests: ${results.overall.total}`);
  console.log(`✅ Passed: ${results.overall.passed}`);
  console.log(`❌ Failed: ${results.overall.failed}`);
  console.log(`📈 Success Rate: ${((results.overall.passed/results.overall.total)*100).toFixed(1)}%`);
  console.log();
  
  // Detailed breakdown
  console.log('📋 Detailed Results:');
  console.log(`   🔍 Environment: ${results.environment.passed}✅ ${results.environment.failed}❌`);
  console.log(`   🔐 Authentication: ${results.authentication.passed}✅ ${results.authentication.failed}❌`);
  console.log(`   📝 CREATE Operations: ${results.create.passed}✅ ${results.create.failed}❌`);
  console.log(`   📋 READ Operations: ${results.read.passed}✅ ${results.read.failed}❌`);
  
  console.log('\n📁 Screenshots saved in: ./reports/screenshots/');
  console.log();
  
  const success = results.overall.failed === 0;
  console.log(success ? '🎉 ALL QUICK TESTS PASSED!' : '⚠️  SOME TESTS FAILED - Check details above');
  console.log('═'.repeat(60));
  
  return success;
}

// Run the test
quickTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Quick test failed:', error);
    process.exit(1);
  });