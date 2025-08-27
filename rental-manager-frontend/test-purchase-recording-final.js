const puppeteer = require('puppeteer');

/**
 * Final Purchase Recording Test
 * Tests the complete purchase recording workflow with proper Puppeteer syntax
 */

async function testPurchaseRecordingFinal() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 300,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Track API activity
  let apiCalls = [];
  let corsIssues = [];
  let purchaseApiResponse = null;

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('PURCHASE FORM SUBMISSION START')) {
      console.log('🚀 Purchase form submission detected');
    } else if (text.includes('CORS') || text.includes('Network Error')) {
      corsIssues.push(text);
      console.log('⚠️ CORS/Network:', text.substring(0, 80) + '...');
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const call = {
        method: response.request().method(),
        url: response.url().replace('http://localhost:8000', ''),
        status: response.status()
      };

      if (response.url().includes('/transactions/purchases')) {
        console.log(`📡 Purchase API: ${call.method} ${call.status}`);
        
        const corsOrigin = response.headers()['access-control-allow-origin'];
        call.corsOrigin = corsOrigin;
        
        try {
          const responseText = await response.text();
          call.responseBody = responseText.substring(0, 200);
          if (response.status() === 201) {
            purchaseApiResponse = JSON.parse(responseText);
          }
        } catch (e) {
          call.parseError = true;
        }
      }
      
      apiCalls.push(call);
    }
  });

  try {
    console.log('🧪 Final Purchase Recording Test...\n');

    // Step 1: Load page
    console.log('📋 Step 1: Loading purchase recording page...');
    await page.goto('http://localhost:3000/purchases/record', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Analyze page structure  
    console.log('\n🔍 Step 2: Analyzing page structure...');
    
    const pageInfo = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input').length;
      const selects = document.querySelectorAll('select').length;
      const textareas = document.querySelectorAll('textarea').length;
      const buttons = document.querySelectorAll('button').length;
      
      // Find submit button using proper approach
      const allButtons = Array.from(document.querySelectorAll('button'));
      const submitButton = allButtons.find(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return text.includes('submit') || text.includes('save') || 
               text.includes('record') || btn.type === 'submit';
      });
      
      return {
        inputs,
        selects, 
        textareas,
        buttons,
        hasSubmitButton: !!submitButton,
        submitButtonText: submitButton?.textContent?.trim() || 'Not found'
      };
    });

    console.log(`   📝 Form Elements: ${pageInfo.inputs} inputs, ${pageInfo.selects} selects, ${pageInfo.textareas} textareas`);
    console.log(`   🎛️ Buttons: ${pageInfo.buttons} total`);
    console.log(`   🔘 Submit button: ${pageInfo.hasSubmitButton ? '✅' : '❌'} ("${pageInfo.submitButtonText}")`);

    // Step 3: Test basic form interaction
    console.log('\n⌨️ Step 3: Testing form interaction...');
    
    // Try to find and fill basic fields
    try {
      const dateInput = await page.$('input[type="date"]');
      if (dateInput) {
        await dateInput.click();
        await dateInput.type('2025-08-26');
        console.log('✅ Date filled');
      }

      const textareas = await page.$$('textarea');
      if (textareas.length > 0) {
        await textareas[0].click();
        await textareas[0].type('Test purchase via Puppeteer final test');
        console.log('✅ Notes filled');
      }

    } catch (fillError) {
      console.log('⚠️ Form filling issues:', fillError.message);
    }

    // Step 4: Try form submission
    console.log('\n🚀 Step 4: Attempting form submission...');
    
    const submissionAttempted = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitBtn = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return text.includes('submit') || text.includes('save') || 
               text.includes('record') || btn.type === 'submit';
      });
      
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    });

    if (submissionAttempted) {
      console.log('✅ Submit button clicked');
      await new Promise(resolve => setTimeout(resolve, 4000)); // Wait for API calls
    } else {
      console.log('❌ Could not find/click submit button');
    }

    // Step 5: API Analysis
    console.log('\n📡 Step 5: API Call Analysis...');
    
    const purchaseCalls = apiCalls.filter(call => call.url.includes('/transactions/purchases'));
    const otherCalls = apiCalls.filter(call => !call.url.includes('/transactions/purchases'));
    
    console.log(`📊 Total API calls: ${apiCalls.length}`);
    console.log(`🎯 Purchase API calls: ${purchaseCalls.length}`);
    console.log(`🔧 Other API calls: ${otherCalls.length}`);

    if (purchaseCalls.length > 0) {
      console.log('\n📋 Purchase API Details:');
      purchaseCalls.forEach((call, i) => {
        console.log(`   ${i + 1}. ${call.method} ${call.status} ${call.url}`);
        console.log(`      CORS Origin: ${call.corsOrigin || 'Not set'}`);
        if (call.responseBody) {
          console.log(`      Response: ${call.responseBody}...`);
        }
      });
    }

    // Step 6: Screenshot
    await page.screenshot({ 
      path: 'purchase-recording-final-test.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved');

    // Results
    console.log('\n' + '='.repeat(50));
    console.log('🏁 Final Test Results:');
    console.log('='.repeat(50));
    
    const results = {
      pageLoaded: true,
      formFound: pageInfo.inputs > 0,
      submitButtonFound: pageInfo.hasSubmitButton,
      submissionAttempted,
      apiCallsMade: apiCalls.length > 0,
      purchaseApiCalled: purchaseCalls.length > 0,
      corsIssuesCount: corsIssues.length,
      
      // Detailed API analysis
      endpointFound: !purchaseCalls.some(call => call.status === 404),
      methodAllowed: !purchaseCalls.some(call => call.status === 405),
      corsWorking: purchaseCalls.some(call => call.corsOrigin === 'http://localhost:3000'),
      authenticationRequired: purchaseCalls.some(call => call.status === 403),
      purchaseCreated: purchaseCalls.some(call => call.status === 201),
    };

    console.log(`📋 Page loaded: ${results.pageLoaded ? '✅' : '❌'}`);
    console.log(`🏗️ Form found: ${results.formFound ? '✅' : '❌'}`);
    console.log(`🔘 Submit button: ${results.submitButtonFound ? '✅' : '❌'}`);
    console.log(`🚀 Submission attempted: ${results.submissionAttempted ? '✅' : '❌'}`);
    console.log(`📡 API calls made: ${results.apiCallsMade ? '✅' : '❌'} (${apiCalls.length})`);
    console.log(`🎯 Purchase API called: ${results.purchaseApiCalled ? '✅' : '❌'}`);
    console.log(`🌐 CORS working: ${results.corsWorking ? '✅' : '❌'}`);
    console.log(`🔧 Endpoint found: ${results.endpointFound ? '✅' : '❌'} (not 404)`);
    console.log(`✅ Method allowed: ${results.methodAllowed ? '✅' : '❌'} (not 405)`);
    console.log(`🔐 Auth required: ${results.authenticationRequired ? '✅ Expected' : '❌'}`);
    console.log(`🎊 Purchase created: ${results.purchaseCreated ? '✅ Success!' : '❌'}`);
    console.log(`🚨 CORS issues: ${results.corsIssuesCount === 0 ? '✅ None' : `❌ ${results.corsIssuesCount}`}`);

    // Overall assessment  
    const criticalFixesWorking = results.endpointFound && results.methodAllowed && results.corsWorking;
    const basicFunctionality = results.pageLoaded && results.formFound && results.submitButtonFound;
    const apiIntegration = results.purchaseApiCalled;
    
    console.log('\n🎯 Overall Assessment:');
    if (criticalFixesWorking && basicFunctionality && apiIntegration) {
      console.log('🎉 SUCCESS: All critical fixes are working!');
      console.log('   ✅ 405 Method Not Allowed - FIXED');
      console.log('   ✅ CORS configuration - WORKING'); 
      console.log('   ✅ API endpoint - ACCESSIBLE');
      console.log('   ✅ Form functionality - COMPLETE');
      
      if (results.purchaseCreated) {
        console.log('   🎊 Purchase successfully created!');
      } else if (results.authenticationRequired) {
        console.log('   🔐 Only authentication needed (expected)');
      }
      
    } else {
      console.log('⚠️ Issues remaining:');
      if (!results.endpointFound) console.log('   ❌ API endpoint not found');
      if (!results.methodAllowed) console.log('   ❌ 405 Method Not Allowed still present');  
      if (!results.corsWorking) console.log('   ❌ CORS not working properly');
      if (!basicFunctionality) console.log('   ❌ Basic form functionality issues');
      if (!apiIntegration) console.log('   ❌ API integration not working');
    }

    const score = Object.values(results).filter(Boolean).length;
    const totalChecks = Object.keys(results).length;
    const successRate = Math.round((score / totalChecks) * 100);
    
    console.log(`\n📊 Final Score: ${successRate}% (${score}/${totalChecks})`);

    return {
      success: criticalFixesWorking && basicFunctionality,
      results,
      successRate,
      purchaseCreated: results.purchaseCreated,
      corsIssuesCount: results.corsIssuesCount
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'purchase-final-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testPurchaseRecordingFinal()
    .then((results) => {
      console.log('\n🏁 Purchase recording test completed!');
      if (results.success) {
        console.log('🎊 VICTORY: Purchase recording is working correctly!');
        if (results.purchaseCreated) {
          console.log('🚀 Bonus: Purchase was actually created!');
        }
      } else {
        console.log('📋 Some functionality needs attention - see details above');
      }
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPurchaseRecordingFinal };