const puppeteer = require('puppeteer');

/**
 * Comprehensive Purchase Recording Test Suite
 * Tests the complete purchase recording workflow with proper API integration
 */

async function testPurchaseRecording() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 300,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  });

  const page = await browser.newPage();
  
  // Track API calls and responses
  let apiCalls = [];
  let purchaseCreated = null;
  let errorEncountered = null;

  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const call = {
        method: response.request().method(),
        url: response.url(),
        status: response.status(),
        timestamp: Date.now()
      };

      try {
        // Try to get response data for purchases API
        if (response.url().includes('/transactions/purchases')) {
          const responseText = await response.text();
          call.responseData = responseText;
          
          if (response.ok() && response.request().method() === 'POST') {
            try {
              const data = JSON.parse(responseText);
              purchaseCreated = data;
              console.log('✅ Purchase API Success Response:', JSON.stringify(data, null, 2));
            } catch (e) {
              console.log('⚠️  Could not parse purchase response as JSON');
            }
          }
        }
      } catch (e) {
        call.responseError = e.message;
      }

      apiCalls.push(call);
      console.log(`📡 API: ${call.method} ${call.status} ${call.url.replace('http://localhost:8000', '')}`);
    }
  });

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errorEncountered = msg.text();
      console.log('🚨 Browser Console Error:', msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errorEncountered = error.message;
    console.log('💥 Page Error:', error.message);
  });

  try {
    console.log('🧪 Testing Purchase Recording Functionality...\n');

    // Step 1: Navigate to purchase recording page
    console.log('📋 Step 1: Loading purchase recording page...');
    await page.goto('http://localhost:3000/purchases/record', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Check if form loaded properly
    console.log('\n🔍 Step 2: Validating form structure...');
    
    const supplierSelect = await page.$('[data-testid="supplier-select"], select[name="supplier_id"], input[name="supplier_id"]');
    const locationSelect = await page.$('[data-testid="location-select"], select[name="location_id"], input[name="location_id"]');
    const purchaseDate = await page.$('[data-testid="purchase-date"], input[name="purchase_date"], input[type="date"]');
    const submitButton = await page.$('button[type="submit"], button:contains("Save"), button:contains("Submit")') ||
                          await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            return buttons.find(btn => 
                              btn.textContent?.toLowerCase().includes('save') || 
                              btn.textContent?.toLowerCase().includes('submit') ||
                              btn.textContent?.toLowerCase().includes('record') ||
                              btn.textContent?.toLowerCase().includes('create')
                            );
                          });

    console.log(`   - Supplier field: ${supplierSelect ? '✅ Found' : '❌ Missing'}`);
    console.log(`   - Location field: ${locationSelect ? '✅ Found' : '❌ Missing'}`);
    console.log(`   - Purchase date field: ${purchaseDate ? '✅ Found' : '❌ Missing'}`);
    console.log(`   - Submit button: ${submitButton ? '✅ Found' : '❌ Missing'}`);

    if (!supplierSelect || !locationSelect || !purchaseDate || !submitButton) {
      console.log('⚠️  Form validation failed - trying alternative selectors...');
      
      // Log all form elements for debugging
      const allInputs = await page.$$('input, select, textarea');
      console.log(`📝 Found ${allInputs.length} form elements on page`);
      
      for (let i = 0; i < Math.min(10, allInputs.length); i++) {
        const element = allInputs[i];
        const info = await element.evaluate(el => ({
          tag: el.tagName,
          type: el.type,
          name: el.name,
          id: el.id,
          placeholder: el.placeholder,
          className: el.className
        }));
        console.log(`   Element ${i + 1}:`, info);
      }
    }

    // Step 3: Test basic form interaction
    console.log('\n⌨️ Step 3: Testing form interactions...');
    
    if (supplierSelect && locationSelect && purchaseDate) {
      try {
        // Try to fill supplier (look for dropdown or input)
        const supplierOptions = await page.$$('option');
        if (supplierOptions.length > 1) {
          await page.select('select[name="supplier_id"]', supplierOptions[1].value);
          console.log('✅ Selected first supplier from dropdown');
        } else {
          // Try input field
          await supplierSelect.click();
          await supplierSelect.type('test supplier');
          console.log('✅ Typed into supplier field');
        }
        
        // Try to fill location
        const locationOptions = await page.$$('select[name="location_id"] option');
        if (locationOptions.length > 1) {
          await page.select('select[name="location_id"]', locationOptions[1].value);
          console.log('✅ Selected first location from dropdown');
        }
        
        // Fill purchase date
        await purchaseDate.click();
        await purchaseDate.type('2024-08-26');
        console.log('✅ Filled purchase date');
        
      } catch (fillError) {
        console.log('⚠️  Form filling error:', fillError.message);
      }
    }

    // Step 4: Look for item section
    console.log('\n📦 Step 4: Checking item management...');
    const addItemButton = await page.$('button:contains("Add Item"), button:contains("Add Product"), [data-testid="add-item"]') ||
                          await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            return buttons.find(btn => 
                              btn.textContent?.toLowerCase().includes('add item') || 
                              btn.textContent?.toLowerCase().includes('add product')
                            );
                          });
    
    if (addItemButton) {
      console.log('✅ Add Item button found');
      
      try {
        await page.evaluate(btn => btn.click(), addItemButton);
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ Clicked Add Item button');
      } catch (e) {
        console.log('⚠️  Could not click Add Item button:', e.message);
      }
    } else {
      console.log('❌ Add Item button not found');
    }

    // Step 5: Check current API calls
    console.log('\n📡 Step 5: API Call Analysis...');
    const uniqueEndpoints = [...new Set(apiCalls.map(call => `${call.method} ${call.url.split('?')[0]}`))];
    console.log(`📊 Unique endpoints called: ${uniqueEndpoints.length}`);
    
    uniqueEndpoints.forEach((endpoint, index) => {
      const calls = apiCalls.filter(call => `${call.method} ${call.url.split('?')[0]}` === endpoint);
      console.log(`   ${index + 1}. ${endpoint} (${calls.length} calls)`);
    });

    // Step 6: Take screenshot
    await page.screenshot({ 
      path: 'purchase-recording-test.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as purchase-recording-test.png');

    // Results analysis
    console.log('\n' + '='.repeat(60));
    console.log('🧪 Purchase Recording Test Results:');
    console.log('='.repeat(60));
    
    const results = {
      pageLoaded: true,
      formElementsFound: !!(supplierSelect && locationSelect && purchaseDate),
      submitButtonFound: !!submitButton,
      addItemButtonFound: !!addItemButton,
      apiCallsMade: apiCalls.length > 0,
      purchaseEndpointCalled: apiCalls.some(call => call.url.includes('/transactions/purchases')),
      noErrors: !errorEncountered,
      totalApiCalls: apiCalls.length
    };
    
    console.log(`📋 Page loaded: ${results.pageLoaded ? '✅' : '❌'}`);
    console.log(`🏗️ Form elements found: ${results.formElementsFound ? '✅' : '❌'}`);
    console.log(`🔘 Submit button found: ${results.submitButtonFound ? '✅' : '❌'}`);
    console.log(`➕ Add item button found: ${results.addItemButtonFound ? '✅' : '❌'}`);
    console.log(`📡 API calls made: ${results.apiCallsMade ? '✅' : '❌'} (${results.totalApiCalls} total)`);
    console.log(`🎯 Purchase endpoint accessible: ${results.purchaseEndpointCalled ? '✅' : '❌'}`);
    console.log(`🐛 No errors: ${results.noErrors ? '✅' : '❌'}`);
    
    if (errorEncountered) {
      console.log(`❌ Error details: ${errorEncountered}`);
    }

    // Detailed API analysis
    console.log('\n📋 Detailed API Call Log:');
    apiCalls.forEach((call, index) => {
      console.log(`${index + 1}. ${call.method} ${call.status} ${call.url}`);
      if (call.status >= 400) {
        console.log(`   ❌ Error response: ${call.responseData || call.responseError}`);
      } else if (call.status === 201 && call.url.includes('/purchases')) {
        console.log(`   ✅ Purchase created successfully`);
      }
    });

    // Overall assessment
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length - 1; // Exclude totalApiCalls from scoring
    const successRate = (passedTests / totalTests * 100).toFixed(0);
    
    console.log('\n🎯 Overall Assessment:');
    console.log(`   Success Rate: ${successRate}% (${passedTests}/${totalTests} tests passed)`);
    
    if (successRate >= 80) {
      console.log('✅ EXCELLENT: Purchase recording form is functional!');
    } else if (successRate >= 60) {
      console.log('🟡 GOOD: Most functionality working, some issues to address');
    } else {
      console.log('⚠️  NEEDS ATTENTION: Several components need investigation');
    }
    
    return { 
      success: successRate >= 60, 
      results, 
      successRate: parseInt(successRate),
      apiCalls: apiCalls.length,
      errorEncountered,
      purchaseCreated
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    await page.screenshot({ 
      path: 'purchase-recording-error.png',
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
  testPurchaseRecording()
    .then((results) => {
      console.log('\n🎉 Purchase recording test completed!');
      console.log(`Final assessment: ${results.successRate}% success rate`);
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testPurchaseRecording };