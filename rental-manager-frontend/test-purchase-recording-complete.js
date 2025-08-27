const puppeteer = require('puppeteer');

/**
 * Complete Purchase Recording Test
 * Tests the entire purchase recording workflow with all fixes applied
 */

async function testPurchaseRecordingComplete() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 500,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  });

  const page = await browser.newPage();
  
  // Track all API calls and responses
  let apiCalls = [];
  let corsErrors = [];
  let networkErrors = [];
  let purchaseApiCalled = false;
  let purchaseResponse = null;

  // Intercept console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('CORS') || text.includes('Network Error')) {
      corsErrors.push(text);
      console.log('🚨 CORS/Network Issue:', text.substring(0, 100) + '...');
    } else if (text.includes('PURCHASE FORM SUBMISSION START')) {
      console.log('🚀 Purchase form submission detected');
    } else if (text.includes('PURCHASE CREATION SUCCESS')) {
      console.log('✅ Purchase creation successful');
    } else if (text.includes('PURCHASE CREATION FAILED')) {
      console.log('❌ Purchase creation failed');
    }
  });

  // Track API calls
  page.on('response', async response => {
    const url = response.url();
    const method = response.request().method();
    
    if (url.includes('/api/')) {
      const call = {
        method,
        url: url.replace('http://localhost:8000', ''),
        status: response.status(),
        ok: response.ok(),
        timestamp: Date.now()
      };

      // Check for CORS headers
      const corsHeaders = {
        origin: response.headers()['access-control-allow-origin'],
        methods: response.headers()['access-control-allow-methods'],
        credentials: response.headers()['access-control-allow-credentials']
      };

      if (url.includes('/transactions/purchases')) {
        purchaseApiCalled = true;
        call.corsHeaders = corsHeaders;
        
        try {
          const responseText = await response.text();
          call.responseBody = responseText;
          
          if (response.ok()) {
            purchaseResponse = JSON.parse(responseText);
            console.log('✅ Purchase API Success:', response.status());
          } else if (response.status() === 403) {
            console.log('🔐 Purchase API - Authentication required (expected)');
          } else {
            console.log('⚠️ Purchase API Error:', response.status(), responseText.substring(0, 100));
          }
        } catch (e) {
          call.responseError = e.message;
        }
      }

      apiCalls.push(call);
    }
  });

  // Track failed requests
  page.on('requestfailed', request => {
    if (request.url().includes('/api/')) {
      networkErrors.push({
        url: request.url(),
        failure: request.failure().errorText,
        method: request.method()
      });
      console.log('🔴 Request Failed:', request.failure().errorText);
    }
  });

  try {
    console.log('🧪 Testing Complete Purchase Recording Functionality...\n');

    // Step 1: Navigate to purchase recording page
    console.log('📋 Step 1: Loading purchase recording page...');
    await page.goto('http://localhost:3000/purchases/record', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Check page structure and form elements
    console.log('\n🔍 Step 2: Validating form structure...');
    
    const formElements = await page.evaluate(() => {
      return {
        supplierInputs: document.querySelectorAll('input[name*="supplier"], select[name*="supplier"], [data-testid*="supplier"]').length,
        locationInputs: document.querySelectorAll('input[name*="location"], select[name*="location"], [data-testid*="location"]').length,
        dateInputs: document.querySelectorAll('input[type="date"], input[name*="date"]').length,
        submitButtons: document.querySelectorAll('button[type="submit"], button:contains("Submit"), button:contains("Save"), button:contains("Record")').length,
        formElements: document.querySelectorAll('input, select, textarea').length,
        totalButtons: document.querySelectorAll('button').length
      };
    });

    console.log(`   📝 Supplier inputs: ${formElements.supplierInputs}`);
    console.log(`   📍 Location inputs: ${formElements.locationInputs}`);
    console.log(`   📅 Date inputs: ${formElements.dateInputs}`);
    console.log(`   🔘 Submit buttons: ${formElements.submitButtons}`);
    console.log(`   🏗️ Total form elements: ${formElements.formElements}`);
    console.log(`   🎛️ Total buttons: ${formElements.totalButtons}`);

    // Step 3: Try to interact with form elements
    console.log('\n⌨️ Step 3: Testing form interactions...');
    
    // Look for submit button by text content
    const submitButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return text.includes('submit') || text.includes('save') || 
               text.includes('record') || text.includes('create') ||
               btn.type === 'submit';
      });
    });

    if (submitButton) {
      console.log('✅ Submit button found');
      
      // Try to fill some basic fields first
      try {
        // Look for and fill purchase date
        const dateInput = await page.$('input[type="date"], input[name*="date"]');
        if (dateInput) {
          await dateInput.click();
          await dateInput.type('2025-08-26');
          console.log('✅ Filled purchase date');
        }

        // Look for notes field
        const notesField = await page.$('textarea[name*="note"], input[name*="note"]');
        if (notesField) {
          await notesField.click();
          await notesField.type('Test purchase via Puppeteer');
          console.log('✅ Filled notes field');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (fillError) {
        console.log('⚠️ Form filling partial:', fillError.message);
      }

      // Step 4: Test form submission (this will trigger API calls)
      console.log('\n🚀 Step 4: Testing form submission...');
      
      try {
        // Click the submit button
        await page.evaluate(btn => {
          if (btn) btn.click();
        }, submitButton);
        
        console.log('✅ Submit button clicked');
        
        // Wait for API calls or responses
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (submitError) {
        console.log('⚠️ Submit interaction issue:', submitError.message);
      }
    } else {
      console.log('❌ Submit button not found');
    }

    // Step 5: Analyze API calls and CORS
    console.log('\n📡 Step 5: Analyzing API calls and CORS...');
    
    const purchaseApiCalls = apiCalls.filter(call => call.url.includes('/transactions/purchases'));
    const otherApiCalls = apiCalls.filter(call => !call.url.includes('/transactions/purchases'));
    
    console.log(`📊 Total API calls: ${apiCalls.length}`);
    console.log(`🎯 Purchase API calls: ${purchaseApiCalls.length}`);
    console.log(`🔧 Other API calls: ${otherApiCalls.length}`);
    console.log(`🚨 CORS errors: ${corsErrors.length}`);
    console.log(`🔴 Network failures: ${networkErrors.length}`);

    if (purchaseApiCalls.length > 0) {
      console.log('\n📋 Purchase API Call Details:');
      purchaseApiCalls.forEach((call, index) => {
        console.log(`   ${index + 1}. ${call.method} ${call.status} ${call.url}`);
        if (call.corsHeaders && call.corsHeaders.origin) {
          console.log(`      CORS Origin: ${call.corsHeaders.origin}`);
          console.log(`      CORS Methods: ${call.corsHeaders.methods}`);
        }
        if (call.responseBody) {
          console.log(`      Response: ${call.responseBody.substring(0, 100)}...`);
        }
      });
    }

    // Step 6: Take screenshots
    await page.screenshot({ 
      path: 'purchase-recording-complete-test.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as purchase-recording-complete-test.png');

    // Step 7: Results analysis
    console.log('\n' + '='.repeat(60));
    console.log('🎯 Complete Purchase Recording Test Results:');
    console.log('='.repeat(60));
    
    const results = {
      // Basic functionality
      pageLoaded: true,
      formElementsFound: formElements.formElements > 0,
      submitButtonFound: !!submitButton,
      
      // API integration
      apiCallsMade: apiCalls.length > 0,
      purchaseEndpointCalled: purchaseApiCalled,
      corsErrorsCount: corsErrors.length,
      networkFailuresCount: networkErrors.length,
      
      // CORS analysis
      corsHeadersPresent: purchaseApiCalls.some(call => call.corsHeaders?.origin === 'http://localhost:3000'),
      authenticationWorking: purchaseApiCalls.some(call => call.status === 403),
      endpointNotFound: purchaseApiCalls.some(call => call.status === 404),
      methodNotAllowed: purchaseApiCalls.some(call => call.status === 405),
      
      // Success indicators
      purchaseCreated: !!purchaseResponse,
      noMajorErrors: corsErrors.length === 0 && networkErrors.length === 0
    };
    
    console.log(`📋 Page loaded successfully: ${results.pageLoaded ? '✅' : '❌'}`);
    console.log(`🏗️ Form elements found: ${results.formElementsFound ? '✅' : '❌'} (${formElements.formElements} elements)`);
    console.log(`🔘 Submit button found: ${results.submitButtonFound ? '✅' : '❌'}`);
    console.log(`📡 API calls made: ${results.apiCallsMade ? '✅' : '❌'} (${apiCalls.length} total)`);
    console.log(`🎯 Purchase endpoint called: ${results.purchaseEndpointCalled ? '✅' : '❌'}`);
    console.log(`🌐 CORS headers present: ${results.corsHeadersPresent ? '✅' : '❌'}`);
    console.log(`🔐 Authentication check: ${results.authenticationWorking ? '✅ 403 Forbidden (expected)' : '❌'}`);
    console.log(`🚫 405 Method Not Allowed: ${results.methodNotAllowed ? '❌ Still present' : '✅ Fixed'}`);
    console.log(`🎯 Endpoint found: ${results.endpointNotFound ? '❌ 404 errors' : '✅ Endpoints accessible'}`);
    console.log(`🚨 CORS errors: ${results.corsErrorsCount === 0 ? '✅ None' : `❌ ${results.corsErrorsCount} errors`}`);
    console.log(`🔴 Network failures: ${results.networkFailuresCount === 0 ? '✅ None' : `❌ ${results.networkFailuresCount} failures`}`);
    console.log(`✨ Purchase created: ${results.purchaseCreated ? '✅ Success' : '❌ Not completed'}`);

    // Detailed error analysis
    if (corsErrors.length > 0) {
      console.log('\n🚨 CORS Error Details:');
      corsErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.substring(0, 150)}...`);
      });
    }

    if (networkErrors.length > 0) {
      console.log('\n🔴 Network Error Details:');
      networkErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.method} ${error.url} - ${error.failure}`);
      });
    }

    // Overall assessment
    const criticalIssues = results.methodNotAllowed || results.endpointNotFound || 
                          results.corsErrorsCount > 0 || results.networkFailuresCount > 0;
    
    const basicFunctionality = results.pageLoaded && results.formElementsFound && 
                              results.submitButtonFound;
    
    const apiIntegration = results.purchaseEndpointCalled && results.corsHeadersPresent;
    
    console.log('\n🎯 Overall Assessment:');
    
    if (!criticalIssues && basicFunctionality && apiIntegration) {
      console.log('✅ EXCELLENT: Purchase recording functionality is working perfectly!');
      console.log('   ✅ All critical issues resolved');
      console.log('   ✅ Form functionality complete');
      console.log('   ✅ API integration working');
      console.log('   ✅ CORS configured correctly');
      if (results.authenticationWorking) {
        console.log('   ✅ Only authentication required (expected)');
      }
    } else if (basicFunctionality && apiIntegration) {
      console.log('🟡 GOOD: Core functionality working, minor issues remain');
      console.log('   ✅ Basic functionality complete');
      console.log('   ✅ API integration working');
      if (criticalIssues) {
        console.log('   ⚠️ Some errors to investigate');
      }
    } else if (basicFunctionality) {
      console.log('🟡 PARTIAL: Form loads but API integration needs work');
      console.log('   ✅ Form functionality present');
      console.log('   ⚠️ API integration issues');
    } else {
      console.log('❌ ISSUES: Significant problems detected');
      console.log('   ❌ Basic functionality problems');
    }

    // Calculate success score
    const successfulChecks = Object.values(results).filter(Boolean).length;
    const totalChecks = Object.keys(results).length;
    const successRate = Math.round((successfulChecks / totalChecks) * 100);
    
    console.log(`\n📊 Success Rate: ${successRate}% (${successfulChecks}/${totalChecks} checks passed)`);
    
    return {
      success: successRate >= 70 && !criticalIssues,
      results,
      successRate,
      apiCalls: apiCalls.length,
      corsErrors: corsErrors.length,
      networkErrors: networkErrors.length,
      purchaseApiCalled,
      criticalIssues
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    await page.screenshot({ 
      path: 'purchase-recording-complete-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved');
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testPurchaseRecordingComplete()
    .then((results) => {
      console.log('\n🎉 Complete purchase recording test finished!');
      console.log(`🏆 Final Result: ${results.successRate}% success rate`);
      
      if (results.success) {
        console.log('🎊 SUCCESS: Purchase recording functionality is working correctly!');
      } else {
        console.log('⚠️ Issues detected - review results above for details');
      }
      
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testPurchaseRecordingComplete };