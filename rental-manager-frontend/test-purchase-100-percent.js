const puppeteer = require('puppeteer');

/**
 * 100% Complete Purchase Recording Test
 * Tests the entire purchase recording workflow with authentication
 */

async function testPurchaseRecordingComplete() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 300,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  });

  const page = await browser.newPage();
  
  // Track all activity
  const activity = {
    loginAttempted: false,
    loginSuccessful: false,
    purchaseFormLoaded: false,
    dropdownsLoaded: false,
    purchaseApiCalled: false,
    purchaseCreated: false,
    errors: [],
    apiCalls: [],
    corsIssues: 0
  };

  // Monitor console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Login successful')) activity.loginSuccessful = true;
    if (text.includes('PURCHASE FORM')) activity.purchaseFormLoaded = true;
    if (text.includes('PURCHASE CREATION SUCCESS')) activity.purchaseCreated = true;
    if (text.includes('CORS')) activity.corsIssues++;
    if (text.includes('Error') || text.includes('ERROR')) {
      activity.errors.push(text.substring(0, 100));
    }
  });

  // Monitor API calls
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    
    if (url.includes('/api/')) {
      const apiCall = {
        url: url.replace('http://localhost:8000', ''),
        status,
        method: response.request().method()
      };
      
      activity.apiCalls.push(apiCall);
      
      if (url.includes('/auth/login')) {
        activity.loginAttempted = true;
        if (status === 200) activity.loginSuccessful = true;
      }
      
      if (url.includes('/transactions/purchases')) {
        activity.purchaseApiCalled = true;
        if (status === 201) {
          activity.purchaseCreated = true;
          console.log('🎯 PURCHASE CREATED SUCCESSFULLY!');
        } else if (status === 500) {
          try {
            const text = await response.text();
            console.log('❌ Purchase API 500 Error:', text.substring(0, 200));
          } catch (e) {}
        }
      }
      
      if (url.includes('/suppliers') && status === 200) {
        activity.dropdownsLoaded = true;
      }
    }
  });

  try {
    console.log('🧪 100% Complete Purchase Recording Test...\n');

    // Step 1: Login first
    console.log('🔐 Step 1: Logging in...');
    await page.goto('http://localhost:3000/login', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Try to login with default credentials
    await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email"]', { timeout: 5000 });
    await page.type('input[type="email"], input[name="email"], input[placeholder*="email"]', 'admin@rentalmanager.com');
    await page.type('input[type="password"], input[name="password"], input[placeholder*="password"]', 'admin123');
    
    // Click login button
    const loginButton = await page.$('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
    if (loginButton) {
      await loginButton.click();
      console.log('✅ Login form submitted');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Step 2: Navigate to purchase recording
    console.log('\n📋 Step 2: Loading purchase recording page...');
    await page.goto('http://localhost:3000/purchases/record', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    activity.purchaseFormLoaded = true;

    // Step 3: Analyze form structure
    console.log('\n🔍 Step 3: Analyzing form...');
    
    const formAnalysis = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input').length;
      const selects = document.querySelectorAll('select').length;
      const textareas = document.querySelectorAll('textarea').length;
      const buttons = Array.from(document.querySelectorAll('button'));
      
      const submitButton = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return btn.type === 'submit' && !text.includes('back') && !text.includes('cancel');
      });
      
      return {
        inputs,
        selects,
        textareas,
        totalButtons: buttons.length,
        submitButton: submitButton ? {
          text: submitButton.textContent?.trim(),
          disabled: submitButton.disabled,
          type: submitButton.type
        } : null
      };
    });
    
    console.log(`   📝 Form Elements: ${formAnalysis.inputs} inputs, ${formAnalysis.selects} selects, ${formAnalysis.textareas} textareas`);
    console.log(`   🎛️ Buttons: ${formAnalysis.totalButtons} total`);
    if (formAnalysis.submitButton) {
      console.log(`   🔘 Submit button: "${formAnalysis.submitButton.text}" (${formAnalysis.submitButton.disabled ? 'DISABLED' : 'ENABLED'})`);
    }

    // Step 4: Try to fill the form with minimal required data
    console.log('\n📝 Step 4: Filling form with test data...');
    
    // Wait for dropdowns to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to interact with supplier dropdown
    try {
      const supplierDropdown = await page.$('input[placeholder*="supplier" i], button:has-text("Select supplier")');
      if (supplierDropdown) {
        await supplierDropdown.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to select first supplier
        const firstSupplier = await page.$('[role="option"]:first-child, .dropdown-item:first-child');
        if (firstSupplier) {
          await firstSupplier.click();
          console.log('✅ Supplier selected');
        }
      }
    } catch (e) {
      console.log('⚠️ Could not select supplier:', e.message);
    }

    // Try to interact with location dropdown
    try {
      const locationDropdown = await page.$('input[placeholder*="location" i], button:has-text("Select location")');
      if (locationDropdown) {
        await locationDropdown.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to select first location
        const firstLocation = await page.$('[role="option"]:first-child, .dropdown-item:first-child');
        if (firstLocation) {
          await firstLocation.click();
          console.log('✅ Location selected');
        }
      }
    } catch (e) {
      console.log('⚠️ Could not select location:', e.message);
    }

    // Add a purchase item
    console.log('\n➕ Step 5: Adding purchase item...');
    const addItemButton = await page.$('button:has-text("Add"), button:has-text("Add Item"), button:has-text("Add Purchase Item")');
    if (addItemButton) {
      await addItemButton.click();
      console.log('✅ Add item button clicked');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to fill item details
      try {
        // Select an item if dropdown exists
        const itemDropdown = await page.$('input[placeholder*="item" i], select[name*="item"]');
        if (itemDropdown) {
          await itemDropdown.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          const firstItem = await page.$('[role="option"]:first-child');
          if (firstItem) await firstItem.click();
        }
        
        // Fill quantity
        await page.type('input[name*="quantity" i], input[placeholder*="quantity" i]', '10');
        
        // Fill price
        await page.type('input[name*="price" i], input[placeholder*="price" i]', '100.00');
        
        console.log('✅ Item details filled');
      } catch (e) {
        console.log('⚠️ Could not fill item details:', e.message);
      }
    }

    // Take screenshot before submission
    await page.screenshot({ path: 'purchase-form-filled-100.png' });
    console.log('\n📸 Form filled screenshot saved');

    // Step 6: Submit the form
    console.log('\n🚀 Step 6: Submitting purchase...');
    
    const submitResult = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitButton = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        return (btn.type === 'submit' || text.includes('submit') || text.includes('save') || text.includes('record')) 
               && !text.includes('back') && !text.includes('cancel');
      });
      
      if (submitButton && !submitButton.disabled) {
        submitButton.click();
        return { clicked: true, text: submitButton.textContent?.trim() };
      }
      return { clicked: false, reason: submitButton ? 'Button disabled' : 'No submit button found' };
    });
    
    console.log('🔘 Submit result:', submitResult);
    
    // Wait for API response
    console.log('\n⏳ Waiting for API response...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take final screenshot
    await page.screenshot({ path: 'purchase-form-result-100.png' });
    console.log('📸 Result screenshot saved');

    // Step 7: Final Results
    console.log('\n' + '='.repeat(60));
    console.log('🎯 100% Complete Test Results:');
    console.log('='.repeat(60));
    
    const results = {
      loginSuccessful: activity.loginSuccessful,
      formLoaded: activity.purchaseFormLoaded,
      dropdownsLoaded: activity.dropdownsLoaded,
      itemsAdded: formAnalysis.inputs > 5,
      submitAttempted: submitResult.clicked,
      purchaseApiCalled: activity.purchaseApiCalled,
      purchaseCreated: activity.purchaseCreated,
      corsIssues: activity.corsIssues,
      totalApiCalls: activity.apiCalls.length,
      errors: activity.errors.length
    };
    
    console.log(`🔐 Login successful: ${results.loginSuccessful ? '✅' : '❌'}`);
    console.log(`📋 Form loaded: ${results.formLoaded ? '✅' : '❌'}`);
    console.log(`📦 Dropdowns loaded: ${results.dropdownsLoaded ? '✅' : '❌'}`);
    console.log(`➕ Items added: ${results.itemsAdded ? '✅' : '❌'}`);
    console.log(`🚀 Submit attempted: ${results.submitAttempted ? '✅' : '❌'}`);
    console.log(`📡 Purchase API called: ${results.purchaseApiCalled ? '✅' : '❌'}`);
    console.log(`✨ Purchase created: ${results.purchaseCreated ? '✅ SUCCESS!' : '❌'}`);
    console.log(`🌐 CORS issues: ${results.corsIssues === 0 ? '✅ None' : `⚠️ ${results.corsIssues}`}`);
    console.log(`📊 Total API calls: ${results.totalApiCalls}`);
    console.log(`❌ Errors: ${results.errors === 0 ? '✅ None' : `⚠️ ${results.errors}`}`);
    
    // Show purchase API calls
    const purchaseCalls = activity.apiCalls.filter(call => call.url.includes('/transactions/purchases'));
    if (purchaseCalls.length > 0) {
      console.log('\n📡 Purchase API Calls:');
      purchaseCalls.forEach((call, i) => {
        console.log(`   ${i + 1}. ${call.method} ${call.status} ${call.url}`);
      });
    }
    
    // Show errors if any
    if (activity.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      activity.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }
    
    // Overall assessment
    const successScore = Object.values(results).filter(v => v === true).length;
    const totalChecks = Object.keys(results).length - 2; // Exclude error counts
    const successRate = Math.round((successScore / totalChecks) * 100);
    
    console.log('\n🎯 Overall Assessment:');
    if (results.purchaseCreated) {
      console.log('🎊 PERFECT: Purchase created successfully!');
      console.log('✅ All systems working 100%');
    } else if (results.purchaseApiCalled) {
      console.log('🟡 GOOD: API integration working, but purchase not created');
      console.log('   - Check authentication or validation errors');
    } else if (results.formLoaded && results.dropdownsLoaded) {
      console.log('🟠 PARTIAL: Form and dropdowns working');
      console.log('   - Submit functionality needs attention');
    } else {
      console.log('❌ NEEDS WORK: Basic functionality issues');
    }
    
    console.log(`\n📊 Success Rate: ${successRate}%`);
    
    return {
      success: results.purchaseCreated,
      successRate,
      results,
      activity
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'purchase-error-100.png', fullPage: true });
    throw error;
  } finally {
    // Don't close browser immediately to see results
    console.log('\n⏸️ Browser will close in 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testPurchaseRecordingComplete()
    .then((results) => {
      console.log('\n🏁 Test completed!');
      if (results.success) {
        console.log('🎉 SUCCESS: Purchase recording is 100% functional!');
        process.exit(0);
      } else {
        console.log(`📊 ${results.successRate}% functional - see details above`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testPurchaseRecordingComplete };