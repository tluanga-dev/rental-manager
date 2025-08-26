const puppeteer = require('puppeteer');

/**
 * CORS Fix Test
 * Verify that CORS is properly configured and working
 */

async function testCORSFix() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 200,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Track all network activity
  let corsHeaders = {};
  let requests = [];
  let responses = [];

  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    });
  });

  page.on('response', async response => {
    const headers = response.headers();
    responses.push({
      url: response.url(),
      status: response.status(),
      headers: headers
    });
    
    // Check for CORS headers on API responses
    if (response.url().includes('/api/v1/transactions/purchases')) {
      corsHeaders = {
        'access-control-allow-origin': headers['access-control-allow-origin'],
        'access-control-allow-methods': headers['access-control-allow-methods'],
        'access-control-allow-headers': headers['access-control-allow-headers'],
        'access-control-allow-credentials': headers['access-control-allow-credentials'],
      };
      
      console.log('🌐 CORS Headers from API:', corsHeaders);
    }
  });

  try {
    console.log('🔍 Testing CORS Configuration...\n');

    // Navigate to purchase recording page
    console.log('📋 Step 1: Loading purchase recording page...');
    await page.goto('http://localhost:3000/purchases/record', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test direct API call from browser context
    console.log('\n🧪 Step 2: Testing direct API call from browser...');
    
    const directApiTest = await page.evaluate(async () => {
      try {
        // Clear any cached data first
        if (typeof(Storage) !== "undefined" && localStorage) {
          console.log('Clearing local storage...');
        }
        
        const testData = {
          supplier_id: "fc23017a-dbb1-47f1-a060-4038b9fbe6b6",
          location_id: "2d040477-da58-4b63-aa6f-286ae635eb15",
          purchase_date: "2025-08-26",
          payment_method: "BANK_TRANSFER",
          currency: "INR",
          items: [{
            item_id: "651776f5-4890-4293-a81e-6b0e07a3dce1",
            quantity: 1,
            unit_price: 100.00,
            location_id: "2d040477-da58-4b63-aa6f-286ae635eb15",
            condition_code: "A"
          }]
        };

        // First try a simple OPTIONS preflight
        console.log('🔍 Testing OPTIONS preflight...');
        const preflightResponse = await fetch('http://localhost:8000/api/v1/transactions/purchases', {
          method: 'OPTIONS',
          headers: {
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type'
          }
        });
        
        console.log('✅ Preflight status:', preflightResponse.status);
        console.log('✅ Preflight headers:', Object.fromEntries(preflightResponse.headers.entries()));
        
        // Now try the actual POST request
        console.log('🔍 Testing actual POST request...');
        const response = await fetch('http://localhost:8000/api/v1/transactions/purchases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000'
          },
          body: JSON.stringify(testData)
        });
        
        const responseText = await response.text();
        
        return {
          preflightStatus: preflightResponse.status,
          preflightHeaders: Object.fromEntries(preflightResponse.headers.entries()),
          postStatus: response.status,
          postHeaders: Object.fromEntries(response.headers.entries()),
          responseBody: responseText,
          ok: response.ok
        };
      } catch (error) {
        return {
          error: error.message,
          name: error.name,
          stack: error.stack
        };
      }
    });

    console.log('🧪 Direct API Test Results:', JSON.stringify(directApiTest, null, 2));

    // Test browser network API
    console.log('\n🌐 Step 3: Testing with browser network conditions...');
    
    // Clear browser cache
    await page.evaluate(() => {
      if (typeof(Storage) !== "undefined") {
        localStorage.clear();
        if (sessionStorage) sessionStorage.clear();
      }
    });

    // Wait a bit for any background requests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Take screenshot
    await page.screenshot({ 
      path: 'cors-fix-test.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved');

    // Results analysis
    console.log('\n' + '='.repeat(50));
    console.log('🎯 CORS Test Results:');
    console.log('='.repeat(50));
    
    const results = {
      pageLoaded: true,
      preflightWorking: directApiTest.preflightStatus === 200,
      corsHeadersPresent: directApiTest.preflightHeaders && 
                          directApiTest.preflightHeaders['access-control-allow-origin'] === 'http://localhost:3000',
      postRequestWorking: directApiTest.postStatus !== undefined,
      authenticationRequired: directApiTest.postStatus === 403,
      networkError: directApiTest.error && directApiTest.error.includes('Network Error'),
      totalRequests: requests.length,
      totalResponses: responses.length
    };
    
    console.log(`📋 Page loaded: ${results.pageLoaded ? '✅' : '❌'}`);
    console.log(`✈️ Preflight working: ${results.preflightWorking ? '✅' : '❌'}`);
    console.log(`🌐 CORS headers present: ${results.corsHeadersPresent ? '✅' : '❌'}`);
    console.log(`📡 POST request working: ${results.postRequestWorking ? '✅' : '❌'}`);
    console.log(`🔐 Authentication required (expected): ${results.authenticationRequired ? '✅' : '❌'}`);
    console.log(`🚫 Network error: ${results.networkError ? '❌' : '✅ No network error'}`);
    console.log(`📊 Total requests: ${results.totalRequests}`);
    console.log(`📈 Total responses: ${results.totalResponses}`);

    if (directApiTest.error) {
      console.log('\n❌ API Error Details:');
      console.log(`   Error: ${directApiTest.error}`);
      console.log(`   Type: ${directApiTest.name}`);
    } else {
      console.log('\n✅ API Response Details:');
      console.log(`   Preflight Status: ${directApiTest.preflightStatus}`);
      console.log(`   POST Status: ${directApiTest.postStatus}`);
      console.log(`   POST Response: ${directApiTest.responseBody}`);
    }

    // Overall assessment
    const corsWorking = results.preflightWorking && results.corsHeadersPresent && !results.networkError;
    
    console.log('\n🎯 Overall Assessment:');
    if (corsWorking) {
      console.log('✅ SUCCESS: CORS is configured correctly!');
      console.log('   - Preflight requests work');
      console.log('   - CORS headers are present');
      console.log('   - No network errors detected');
      if (results.authenticationRequired) {
        console.log('   - API endpoint is accessible (auth needed)');
      }
    } else {
      console.log('⚠️  ISSUES: CORS may need attention');
      if (!results.preflightWorking) {
        console.log('   - Preflight requests failing');
      }
      if (!results.corsHeadersPresent) {
        console.log('   - CORS headers missing or incorrect');
      }
      if (results.networkError) {
        console.log('   - Network errors detected');
      }
    }
    
    return { success: corsWorking, results, directApiTest };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'cors-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testCORSFix()
    .then((results) => {
      console.log('\n🎉 CORS test completed!');
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testCORSFix };