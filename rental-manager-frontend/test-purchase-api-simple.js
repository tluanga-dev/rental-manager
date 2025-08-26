const puppeteer = require('puppeteer');

/**
 * Simple Purchase API Test
 * Focus on testing if the 405 error is resolved
 */

async function testPurchaseAPISimple() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 200,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Track purchase API calls specifically
  let purchaseApiCalls = [];
  
  page.on('response', async response => {
    if (response.url().includes('/transactions/purchases')) {
      const call = {
        method: response.request().method(),
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      };
      
      try {
        if (response.ok()) {
          const responseText = await response.text();
          call.success = true;
          call.responsePreview = responseText.substring(0, 200) + '...';
        } else {
          const errorText = await response.text();
          call.success = false;
          call.error = errorText;
        }
      } catch (e) {
        call.error = `Failed to read response: ${e.message}`;
      }
      
      purchaseApiCalls.push(call);
      console.log(`📡 Purchase API: ${call.method} ${call.status} ${call.statusText}`);
      
      if (call.status === 405) {
        console.log('❌ 405 Method Not Allowed - API endpoint issue still exists');
      } else if (call.status === 200 || call.status === 201) {
        console.log('✅ API endpoint responding correctly');
      }
    }
  });

  try {
    console.log('🔍 Testing Purchase API Endpoint Fix...\n');

    // Navigate to purchase recording page
    console.log('📋 Step 1: Loading purchase recording page...');
    await page.goto('http://localhost:3000/purchases/record', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to find and interact with form elements using basic selectors
    console.log('\n⌨️ Step 2: Looking for form elements...');
    
    const formInputs = await page.$$('input, select');
    console.log(`📝 Found ${formInputs.length} form inputs`);
    
    const buttons = await page.$$('button');
    console.log(`🔘 Found ${buttons.length} buttons`);
    
    // Look for submit/save buttons
    let submitButton = null;
    for (let button of buttons) {
      const text = await button.evaluate(el => el.textContent?.toLowerCase());
      if (text && (text.includes('save') || text.includes('submit') || text.includes('record') || text.includes('create'))) {
        submitButton = button;
        console.log(`✅ Found potential submit button: "${text}"`);
        break;
      }
    }

    // Check if we can access the developer tools or simulate an API call
    console.log('\n📡 Step 3: Testing API endpoint directly...');
    
    // Try to simulate what the form would send
    const testPurchaseData = {
      supplier_id: "123e4567-e89b-12d3-a456-426614174000",
      location_id: "123e4567-e89b-12d3-a456-426614174001", 
      purchase_date: "2024-08-26",
      payment_method: "BANK_TRANSFER",
      currency: "INR",
      items: [{
        item_id: "123e4567-e89b-12d3-a456-426614174002",
        quantity: 1,
        unit_price: 100.00,
        location_id: "123e4567-e89b-12d3-a456-426614174001",
        condition_code: "A"
      }]
    };

    // Execute a fetch request from the browser context to test the API
    const apiTestResult = await page.evaluate(async (testData) => {
      try {
        const response = await fetch('/api/transactions/purchases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testData)
        });
        
        return {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          url: response.url
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    }, testPurchaseData);

    console.log('🧪 Direct API test result:', apiTestResult);

    // Take screenshot
    await page.screenshot({ 
      path: 'purchase-api-simple-test.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved');

    // Results analysis
    console.log('\n' + '='.repeat(50));
    console.log('🎯 Purchase API Test Results:');
    console.log('='.repeat(50));
    
    const results = {
      pageLoaded: true,
      formElementsFound: formInputs.length > 0,
      submitButtonFound: !!submitButton,
      api405ErrorFixed: !purchaseApiCalls.some(call => call.status === 405),
      apiCallsMade: purchaseApiCalls.length > 0,
      directApiTest: apiTestResult
    };
    
    console.log(`📋 Page loaded: ${results.pageLoaded ? '✅' : '❌'}`);
    console.log(`🏗️ Form elements found: ${results.formElementsFound ? '✅' : '❌'} (${formInputs.length} inputs)`);
    console.log(`🔘 Submit button found: ${results.submitButtonFound ? '✅' : '❌'}`);
    console.log(`📡 Purchase API calls made: ${results.apiCallsMade ? '✅' : '❌'} (${purchaseApiCalls.length})`);
    console.log(`🔧 405 error fixed: ${results.api405ErrorFixed ? '✅' : '❌'}`);
    
    // API call details
    if (purchaseApiCalls.length > 0) {
      console.log('\n📝 Purchase API Call Details:');
      purchaseApiCalls.forEach((call, index) => {
        console.log(`${index + 1}. ${call.method} ${call.status} ${call.statusText}`);
        if (call.error) {
          console.log(`   Error: ${call.error.substring(0, 100)}...`);
        } else if (call.success) {
          console.log(`   ✅ Success`);
        }
      });
    }

    // Direct API test analysis
    console.log('\n🧪 Direct API Test Analysis:');
    if (apiTestResult.error) {
      console.log(`❌ API Error: ${apiTestResult.error}`);
    } else {
      console.log(`📡 Status: ${apiTestResult.status} ${apiTestResult.statusText}`);
      if (apiTestResult.status === 405) {
        console.log('❌ 405 Method Not Allowed - Endpoint issue still exists');
      } else if (apiTestResult.status === 401) {
        console.log('🔐 401 Unauthorized - Authentication needed (but endpoint exists!)');
      } else if (apiTestResult.status === 403) {
        console.log('🚫 403 Forbidden - Permission issue (but endpoint exists!)');  
      } else if (apiTestResult.status >= 200 && apiTestResult.status < 300) {
        console.log('✅ Success - API endpoint working correctly!');
      } else if (apiTestResult.status >= 400) {
        console.log(`⚠️  ${apiTestResult.status} Error - Endpoint exists but has validation/server issues`);
      }
    }

    // Overall assessment
    const isFixed = apiTestResult.status !== 405;
    const endpointExists = !apiTestResult.error && apiTestResult.status !== 404;
    
    console.log('\n🎯 Overall Assessment:');
    if (isFixed && endpointExists) {
      console.log('✅ SUCCESS: 405 Method Not Allowed error has been fixed!');
      console.log('   - API endpoint is responding (not 405)');
      console.log('   - Purchase recording endpoint exists');
      if (apiTestResult.status === 401 || apiTestResult.status === 403) {
        console.log('   - Only authentication/permission issues remain');
      }
    } else if (apiTestResult.status === 405) {
      console.log('❌ ISSUE: 405 Method Not Allowed error still exists');
      console.log('   - Check backend route registration');
      console.log('   - Verify HTTP method matches endpoint');
    } else {
      console.log('⚠️  MIXED: Endpoint may have other issues to investigate');
    }
    
    return { 
      success: isFixed, 
      results, 
      apiTestResult,
      endpointFixed: isFixed && endpointExists
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'purchase-api-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testPurchaseAPISimple()
    .then((results) => {
      console.log('\n🎉 Purchase API test completed!');
      if (results.endpointFixed) {
        console.log('🎊 The 405 Method Not Allowed error has been successfully fixed!');
      }
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPurchaseAPISimple };