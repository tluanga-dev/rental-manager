const puppeteer = require('puppeteer');

/**
 * Simple Location API Fix Verification Test
 * 
 * This test verifies that the location dashboard loads without 404 errors
 * after fixing the API endpoint path mismatch.
 */

const BASE_URL = 'http://localhost:3000';

async function testLocationAPIFix() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Track API requests and responses
  const apiRequests = [];
  const apiErrors = [];

  await page.setRequestInterception(true);
  
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/locations') || request.url().includes('/api/v1/master-data/locations')) {
      apiRequests.push({
        method: request.method(),
        url: request.url(),
        timestamp: new Date().toISOString()
      });
    }
    request.continue();
  });

  page.on('response', async (response) => {
    if ((response.url().includes('/api/v1/locations') || response.url().includes('/api/v1/master-data/locations')) && !response.ok()) {
      apiErrors.push({
        method: response.request().method(),
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        timestamp: new Date().toISOString()
      });
    }
  });

  try {
    console.log('🔍 Testing Location API Fix...\n');

    // Step 1: Navigate directly to locations page (bypassing auth for now)
    console.log('📋 Step 1: Loading locations dashboard...');
    await page.goto(`${BASE_URL}/inventory/locations`, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Wait a bit for any async requests to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`📊 API Requests made: ${apiRequests.length}`);
    console.log(`❌ API Errors: ${apiErrors.length}`);

    // Log all API requests for analysis
    console.log('\n📋 API Requests:');
    apiRequests.forEach((req, index) => {
      console.log(`${index + 1}. ${req.method} ${req.url}`);
    });

    // Check for the specific error we're trying to fix
    const masterDataErrors = apiErrors.filter(error => 
      error.url.includes('/master-data/locations')
    );
    
    const correctEndpointRequests = apiRequests.filter(req => 
      req.url.includes('/api/v1/locations') && !req.url.includes('master-data')
    );

    console.log('\n🔍 Analysis:');
    console.log(`❌ Old endpoint (/master-data/locations) errors: ${masterDataErrors.length}`);
    console.log(`✅ Correct endpoint (/locations) requests: ${correctEndpointRequests.length}`);

    if (masterDataErrors.length > 0) {
      console.log('\n❌ Still using old endpoint! Errors found:');
      masterDataErrors.forEach(error => {
        console.log(`   ${error.method} ${error.url} - ${error.status} ${error.statusText}`);
      });
    }

    if (correctEndpointRequests.length > 0) {
      console.log('\n✅ Using correct endpoint! Requests found:');
      correctEndpointRequests.forEach(req => {
        console.log(`   ${req.method} ${req.url}`);
      });
    }

    // Check page content for basic functionality
    const pageTitle = await page.title();
    console.log(`\n📄 Page title: ${pageTitle}`);

    // Look for error messages on the page
    const errorElements = await page.$$('[class*="error"], [class*="Error"], .alert-error, .text-red');
    console.log(`⚠️  Error elements on page: ${errorElements.length}`);

    // Look for loading indicators
    const loadingElements = await page.$$('[class*="loading"], [class*="Loading"], [class*="spinner"]');
    console.log(`⏳ Loading elements: ${loadingElements.length}`);

    // Take a screenshot for visual verification
    await page.screenshot({ 
      path: 'location-dashboard-after-fix.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot saved as location-dashboard-after-fix.png');

    // Final assessment
    console.log('\n🎯 Test Results:');
    console.log('='.repeat(50));
    
    if (masterDataErrors.length === 0 && correctEndpointRequests.length > 0) {
      console.log('✅ SUCCESS: API endpoint fix is working correctly!');
      console.log('✅ No more requests to /master-data/locations');
      console.log('✅ Requests are going to /locations as expected');
    } else if (masterDataErrors.length > 0) {
      console.log('❌ ISSUE: Still making requests to old endpoint');
      console.log('❌ More fixes might be needed in the frontend');
    } else {
      console.log('⚠️  UNCLEAR: No location API requests detected');
      console.log('⚠️  This might indicate authentication issues or other problems');
    }

    return {
      success: masterDataErrors.length === 0 && correctEndpointRequests.length > 0,
      apiRequests: apiRequests.length,
      apiErrors: apiErrors.length,
      masterDataErrors: masterDataErrors.length,
      correctRequests: correctEndpointRequests.length
    };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    await page.screenshot({ 
      path: 'location-test-error-fix.png', 
      fullPage: true 
    });
    console.log('📸 Error screenshot saved as location-test-error-fix.png');
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testLocationAPIFix()
    .then((results) => {
      console.log('\n🎉 Location API fix test completed!');
      console.log(`Final Score: ${results.success ? 'PASS' : 'FAIL'}`);
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testLocationAPIFix };