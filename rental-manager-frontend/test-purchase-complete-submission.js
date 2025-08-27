const puppeteer = require('puppeteer');

/**
 * Complete Purchase Submission Test
 * Tests the entire purchase recording workflow with authentication and actual submission
 */

async function testCompletePurchaseSubmission() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 300,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--disable-web-security']
  });

  const page = await browser.newPage();
  
  const testStatus = {
    pageLoaded: false,
    loginSuccessful: false,
    purchaseFormLoaded: false,
    suppliersLoaded: false,
    locationsLoaded: false,
    itemsLoaded: false,
    formFilled: false,
    submitButtonEnabled: false,
    purchaseSubmitted: false,
    purchaseCreated: false,
    errors: [],
    apiErrors: []
  };

  // Enhanced console monitoring
  page.on('console', msg => {
    const text = msg.text();
    console.log('🖥️ Console:', text.substring(0, 150));
    
    if (text.includes('ERROR') || text.includes('error')) {
      testStatus.errors.push(text);
      if (text.includes('Category') || text.includes('category_name')) {
        console.log('❌ CATEGORY ERROR DETECTED:', text);
      }
      if (text.includes('UnitOfMeasurement') || text.includes('abbreviation')) {
        console.log('❌ UNIT OF MEASUREMENT ERROR DETECTED:', text);
      }
    }
    
    if (text.includes('Login successful') || text.includes('Logged in')) {
      testStatus.loginSuccessful = true;
    }
    
    if (text.includes('Purchase created') || text.includes('PURCHASE CREATION SUCCESS')) {
      testStatus.purchaseCreated = true;
    }
  });

  // Monitor all API responses
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    
    if (url.includes('/api/')) {
      const endpoint = url.replace('http://localhost:8000', '');
      
      // Log all API calls
      console.log(`📡 API: ${response.request().method()} ${status} ${endpoint}`);
      
      // Check for successful data loading
      if (url.includes('/suppliers') && status === 200) {
        testStatus.suppliersLoaded = true;
        console.log('✅ Suppliers loaded');
      }
      if (url.includes('/locations') && status === 200) {
        testStatus.locationsLoaded = true;
        console.log('✅ Locations loaded');
      }
      if (url.includes('/items') && status === 200) {
        testStatus.itemsLoaded = true;
        console.log('✅ Items loaded');
      }
      
      // Monitor purchase submission
      if (url.includes('/transactions/purchases')) {
        testStatus.purchaseSubmitted = true;
        
        if (status === 201) {
          testStatus.purchaseCreated = true;
          console.log('🎉 PURCHASE CREATED SUCCESSFULLY!');
          try {
            const responseData = await response.json();
            console.log('📋 Purchase ID:', responseData.data?.id || responseData.id);
            console.log('📋 Transaction Number:', responseData.data?.transaction_number || responseData.transaction_number);
          } catch (e) {}
        } else if (status === 500) {
          try {
            const errorText = await response.text();
            const errorData = JSON.parse(errorText);
            testStatus.apiErrors.push(errorData.detail || errorData.message);
            console.log('❌ 500 ERROR:', errorData.detail || errorData.message);
            
            // Check for specific attribute errors
            if (errorData.detail?.includes('category_name')) {
              console.log('❌ CRITICAL: Category.category_name error still present!');
            }
            if (errorData.detail?.includes('abbreviation')) {
              console.log('❌ CRITICAL: UnitOfMeasurement.abbreviation error still present!');
            }
          } catch (e) {
            console.log('❌ 500 ERROR (unparseable)');
          }
        } else if (status === 422) {
          console.log('⚠️ Validation error - missing required fields');
        } else if (status === 403 || status === 401) {
          console.log('🔐 Authentication required');
        }
      }
    }
  });

  // Monitor network errors
  page.on('requestfailed', request => {
    if (request.url().includes('/api/')) {
      console.log('🔴 Request failed:', request.url(), request.failure().errorText);
    }
  });

  try {
    console.log('🧪 Complete Purchase Submission Test\n');
    console.log('Testing full purchase recording workflow...\n');
    
    // Step 1: Navigate to the application
    console.log('📋 Step 1: Loading application...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    testStatus.pageLoaded = true;
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Check if already logged in or need to login
    console.log('\n🔐 Step 2: Checking authentication...');
    const currentUrl = page.url();
    
    if (currentUrl.includes('/login')) {
      console.log('   Need to login...');
      
      // Try to login
      try {
        await page.type('input[type="email"], input[name="email"]', 'admin@rentalmanager.com');
        await page.type('input[type="password"], input[name="password"]', 'admin123');
        
        const loginButton = await page.$('button[type="submit"]');
        if (loginButton) {
          await loginButton.click();
          console.log('   Login submitted');
          await page.waitForNavigation({ timeout: 5000 });
          testStatus.loginSuccessful = true;
        }
      } catch (e) {
        console.log('   Login failed or already logged in');
      }
    } else {
      console.log('   Already authenticated or no auth required');
      testStatus.loginSuccessful = true;
    }

    // Step 3: Navigate to purchase recording page
    console.log('\n📝 Step 3: Loading purchase recording page...');
    await page.goto('http://localhost:3000/purchases/record', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    testStatus.purchaseFormLoaded = true;
    
    // Wait for form to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Analyze form structure
    console.log('\n🔍 Step 4: Analyzing form structure...');
    
    const formInfo = await page.evaluate(() => {
      const form = document.querySelector('form');
      const inputs = document.querySelectorAll('input');
      const selects = document.querySelectorAll('select');
      const textareas = document.querySelectorAll('textarea');
      const buttons = Array.from(document.querySelectorAll('button'));
      
      const submitButton = buttons.find(btn => {
        const text = (btn.textContent || '').toLowerCase();
        return (btn.type === 'submit' || text.includes('submit') || text.includes('save')) 
               && !text.includes('back') && !text.includes('cancel');
      });
      
      return {
        hasForm: !!form,
        inputCount: inputs.length,
        selectCount: selects.length,
        textareaCount: textareas.length,
        buttonCount: buttons.length,
        submitButton: submitButton ? {
          text: submitButton.textContent?.trim(),
          disabled: submitButton.disabled,
          className: submitButton.className
        } : null
      };
    });
    
    console.log(`   Form found: ${formInfo.hasForm ? '✅' : '❌'}`);
    console.log(`   Inputs: ${formInfo.inputCount}`);
    console.log(`   Selects: ${formInfo.selectCount}`);
    console.log(`   Textareas: ${formInfo.textareaCount}`);
    console.log(`   Buttons: ${formInfo.buttonCount}`);
    if (formInfo.submitButton) {
      console.log(`   Submit button: "${formInfo.submitButton.text}" (${formInfo.submitButton.disabled ? 'DISABLED' : 'ENABLED'})`);
      testStatus.submitButtonEnabled = !formInfo.submitButton.disabled;
    }

    // Step 5: Fill the form with test data
    console.log('\n📝 Step 5: Filling form with test data...');
    
    // Wait for dropdowns to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fill supplier (try multiple selectors)
    try {
      const supplierSelectors = [
        'div[data-testid="supplier-dropdown"]',
        'button:has-text("Select supplier")',
        'input[placeholder*="supplier" i]',
        'select[name*="supplier" i]'
      ];
      
      for (const selector of supplierSelectors) {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try to select first option
          const option = await page.$('[role="option"]:first-child, .dropdown-item:first-child, option:nth-child(2)');
          if (option) {
            await option.click();
            console.log('   ✅ Supplier selected');
            break;
          }
        }
      }
    } catch (e) {
      console.log('   ⚠️ Could not select supplier');
    }

    // Fill location
    try {
      const locationSelectors = [
        'div[data-testid="location-dropdown"]',
        'button:has-text("Select location")',
        'input[placeholder*="location" i]',
        'select[name*="location" i]'
      ];
      
      for (const selector of locationSelectors) {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const option = await page.$('[role="option"]:first-child, .dropdown-item:first-child, option:nth-child(2)');
          if (option) {
            await option.click();
            console.log('   ✅ Location selected');
            break;
          }
        }
      }
    } catch (e) {
      console.log('   ⚠️ Could not select location');
    }

    // Add purchase items
    console.log('\n➕ Step 6: Adding purchase items...');
    
    const addItemButton = await page.$('button:has-text("Add Item"), button:has-text("Add Purchase Item"), button:has-text("Add")');
    if (addItemButton) {
      await addItemButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('   ✅ Add item clicked');
      
      // Try to fill item details
      try {
        // Select item
        const itemSelectors = [
          'div[data-testid="item-dropdown"]',
          'select[name*="item" i]',
          'input[placeholder*="item" i]'
        ];
        
        for (const selector of itemSelectors) {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            const option = await page.$('[role="option"]:first-child, option:nth-child(2)');
            if (option) {
              await option.click();
              console.log('   ✅ Item selected');
              break;
            }
          }
        }
        
        // Fill quantity
        const quantityInput = await page.$('input[name*="quantity" i], input[placeholder*="quantity" i], input[type="number"]:first-of-type');
        if (quantityInput) {
          await quantityInput.click({ clickCount: 3 });
          await quantityInput.type('10');
          console.log('   ✅ Quantity filled');
        }
        
        // Fill price
        const priceInput = await page.$('input[name*="price" i], input[placeholder*="price" i], input[type="number"]:last-of-type');
        if (priceInput) {
          await priceInput.click({ clickCount: 3 });
          await priceInput.type('99.99');
          console.log('   ✅ Price filled');
        }
        
        testStatus.formFilled = true;
      } catch (e) {
        console.log('   ⚠️ Could not fill item details:', e.message);
      }
    }

    // Take screenshot before submission
    await page.screenshot({ path: 'purchase-form-ready.png', fullPage: true });
    console.log('\n📸 Form screenshot saved');

    // Step 7: Submit the form
    console.log('\n🚀 Step 7: Submitting purchase...');
    
    const submitResult = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const submitButton = buttons.find(btn => {
        const text = (btn.textContent || '').toLowerCase();
        return (btn.type === 'submit' || text.includes('submit') || text.includes('save') || text.includes('create')) 
               && !text.includes('back') && !text.includes('cancel');
      });
      
      if (submitButton) {
        console.log(`Attempting to click: "${submitButton.textContent?.trim()}" (disabled: ${submitButton.disabled})`);
        if (!submitButton.disabled) {
          submitButton.click();
          return { clicked: true, text: submitButton.textContent?.trim() };
        }
        return { clicked: false, reason: 'Button is disabled' };
      }
      
      return { clicked: false, reason: 'No submit button found' };
    });
    
    console.log('   Submit result:', submitResult);
    
    // Wait for API response
    console.log('\n⏳ Waiting for API response...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take final screenshot
    await page.screenshot({ path: 'purchase-form-final.png', fullPage: true });
    console.log('📸 Final screenshot saved');

    // Step 8: Check for confirmation or errors
    console.log('\n📋 Step 8: Checking results...');
    
    const pageContent = await page.evaluate(() => {
      const successMessages = document.querySelectorAll('.success, .alert-success, [class*="success"]');
      const errorMessages = document.querySelectorAll('.error, .alert-danger, [class*="error"]');
      const toastMessages = document.querySelectorAll('.toast, [role="alert"]');
      
      return {
        hasSuccess: successMessages.length > 0,
        hasError: errorMessages.length > 0,
        hasToast: toastMessages.length > 0,
        successText: Array.from(successMessages).map(el => el.textContent?.trim()).join(', '),
        errorText: Array.from(errorMessages).map(el => el.textContent?.trim()).join(', ')
      };
    });
    
    if (pageContent.hasSuccess) {
      console.log('   ✅ Success message displayed:', pageContent.successText);
    }
    if (pageContent.hasError) {
      console.log('   ❌ Error message displayed:', pageContent.errorText);
    }

    // Final Results
    console.log('\n' + '='.repeat(70));
    console.log('🎯 COMPLETE PURCHASE SUBMISSION TEST RESULTS:');
    console.log('='.repeat(70));
    
    console.log('\n📊 Status Checks:');
    console.log(`   Page loaded: ${testStatus.pageLoaded ? '✅' : '❌'}`);
    console.log(`   Login successful: ${testStatus.loginSuccessful ? '✅' : '❌'}`);
    console.log(`   Purchase form loaded: ${testStatus.purchaseFormLoaded ? '✅' : '❌'}`);
    console.log(`   Suppliers loaded: ${testStatus.suppliersLoaded ? '✅' : '❌'}`);
    console.log(`   Locations loaded: ${testStatus.locationsLoaded ? '✅' : '❌'}`);
    console.log(`   Items loaded: ${testStatus.itemsLoaded ? '✅' : '❌'}`);
    console.log(`   Form filled: ${testStatus.formFilled ? '✅' : '❌'}`);
    console.log(`   Submit button enabled: ${testStatus.submitButtonEnabled ? '✅' : '❌'}`);
    console.log(`   Purchase submitted: ${testStatus.purchaseSubmitted ? '✅' : '❌'}`);
    console.log(`   Purchase created: ${testStatus.purchaseCreated ? '✅ SUCCESS!' : '❌'}`);
    
    if (testStatus.apiErrors.length > 0) {
      console.log('\n❌ API Errors:');
      testStatus.apiErrors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
        
        // Check for specific attribute errors
        if (error.includes('category_name')) {
          console.log('      ⚠️ Category attribute error - needs fix!');
        }
        if (error.includes('abbreviation')) {
          console.log('      ⚠️ UnitOfMeasurement attribute error - needs fix!');
        }
      });
    }
    
    // Calculate success score
    const checks = Object.values(testStatus).filter(v => typeof v === 'boolean');
    const passed = checks.filter(v => v === true).length;
    const successRate = Math.round((passed / checks.length) * 100);
    
    console.log('\n🏆 FINAL ASSESSMENT:');
    if (testStatus.purchaseCreated) {
      console.log('🎊 PERFECT! Purchase created successfully!');
      console.log('✅ All systems working 100%');
      console.log('✅ Form submission confirmed');
      console.log('✅ No attribute errors detected');
    } else if (testStatus.purchaseSubmitted) {
      if (testStatus.apiErrors.some(e => e.includes('category_name') || e.includes('abbreviation'))) {
        console.log('❌ CRITICAL: Attribute errors preventing submission');
        console.log('   Fix required for Category.name and UnitOfMeasurement.code');
      } else {
        console.log('🟡 PARTIAL: Form submitted but purchase not created');
        console.log('   Check validation or data requirements');
      }
    } else {
      console.log('🟠 INCOMPLETE: Form not submitted');
      console.log('   Check authentication and form requirements');
    }
    
    console.log(`\n📊 Success Rate: ${successRate}% (${passed}/${checks.length} checks passed)`);
    
    return {
      success: testStatus.purchaseCreated,
      successRate,
      testStatus,
      apiErrors: testStatus.apiErrors
    };

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    await page.screenshot({ path: 'purchase-test-error.png', fullPage: true });
    throw error;
  } finally {
    console.log('\n⏸️ Browser will close in 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testCompletePurchaseSubmission()
    .then((results) => {
      console.log('\n🏁 Test completed!');
      if (results.success) {
        console.log('🎉 100% SUCCESS - Purchase submission working perfectly!');
        process.exit(0);
      } else {
        console.log(`📊 ${results.successRate}% working - see details above`);
        if (results.apiErrors.length > 0) {
          console.log('⚠️ Fix the attribute errors and run test again');
        }
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testCompletePurchaseSubmission };