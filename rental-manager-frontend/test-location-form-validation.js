const puppeteer = require('puppeteer');

/**
 * Location Form Validation Test
 * 
 * This test specifically checks for the inactive "Create Location" button issue
 * and verifies that form validation works correctly.
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testLocationFormValidation() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 200,
    defaultViewport: { width: 1280, height: 720 },
    devtools: false
  });

  const page = await browser.newPage();
  
  // Track console logs to see debug output
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Log form state debug messages
    if (text.includes('LocationForm state:') || text.includes('Form data')) {
      console.log('🔍 Browser Console:', text);
    }
    
    if (msg.type() === 'error' && !text.includes('404')) {
      console.log('❌ Console Error:', text);
    }
  });

  // Track form submissions
  let formSubmitted = false;
  let submitAttempts = 0;
  
  page.on('request', request => {
    if (request.url().includes('/api/v1/locations') && request.method() === 'POST') {
      submitAttempts++;
      console.log(`📤 Form submission attempt #${submitAttempts}`);
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/v1/locations') && response.request().method() === 'POST') {
      console.log(`📡 Submission response: ${response.status()}`);
      if (response.ok()) {
        formSubmitted = true;
        console.log('✅ Form submitted successfully!');
      }
    }
  });

  try {
    console.log('🚀 Testing Location Form Validation...\n');

    // Step 1: Navigate to location creation form
    console.log('📋 Step 1: Loading location creation form...');
    await page.goto('http://localhost:3000/inventory/locations/new', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    console.log('✅ Form loaded');

    // Step 2: Check initial button state
    console.log('\n📋 Step 2: Checking initial button state...');
    await delay(1000); // Wait for form to initialize
    
    const submitButton = await page.$('button[type="submit"]');
    if (!submitButton) {
      throw new Error('Submit button not found');
    }

    const isInitiallyDisabled = await submitButton.evaluate(btn => btn.disabled);
    console.log(`📝 Initial button state: ${isInitiallyDisabled ? 'DISABLED' : 'ENABLED'}`);

    // Step 3: Fill required fields one by one and check button state
    console.log('\n📋 Step 3: Testing field-by-field validation...');

    const testData = {
      location_code: `TEST-${Date.now()}`,
      location_name: 'Test Location Form Validation',
      location_type: 'WAREHOUSE'
    };

    // Check button state after filling location code
    console.log('📝 Filling location_code...');
    const locationCodeInput = await page.$('input[name="location_code"], input[id="location_code"]');
    if (locationCodeInput) {
      await locationCodeInput.click({ clickCount: 3 });
      await locationCodeInput.type(testData.location_code);
      await delay(500); // Wait for validation
      
      const buttonStateAfterCode = await submitButton.evaluate(btn => btn.disabled);
      console.log(`   Button after location_code: ${buttonStateAfterCode ? 'DISABLED' : 'ENABLED'}`);
    } else {
      console.log('⚠️  Location code input not found');
    }

    // Check button state after filling location name
    console.log('📝 Filling location_name...');
    const locationNameInput = await page.$('input[name="location_name"], input[id="location_name"]');
    if (locationNameInput) {
      await locationNameInput.click({ clickCount: 3 });
      await locationNameInput.type(testData.location_name);
      await delay(500); // Wait for validation
      
      const buttonStateAfterName = await submitButton.evaluate(btn => btn.disabled);
      console.log(`   Button after location_name: ${buttonStateAfterName ? 'DISABLED' : 'ENABLED'}`);
    } else {
      console.log('⚠️  Location name input not found');
    }

    // Check button state after selecting location type
    console.log('📝 Selecting location_type...');
    const locationTypeSelect = await page.$('[data-radix-collection-item]') || 
                               await page.$('select[name="location_type"]') ||
                               await page.$('[data-testid="location-type"]');
    
    if (locationTypeSelect) {
      // Try to click the select trigger first
      const selectTrigger = await page.$('button[role="combobox"]') || 
                           await page.$('[data-radix-select-trigger]') ||
                           await page.$('.select-trigger');
      
      if (selectTrigger) {
        await selectTrigger.click();
        await delay(500);
        
        // Look for warehouse option
        const warehouseOption = await page.$('[data-value="WAREHOUSE"]') || 
                               await page.$('option[value="WAREHOUSE"]') ||
                               await page.$text('Warehouse');
        
        if (warehouseOption) {
          await warehouseOption.click();
          await delay(500);
          console.log('   ✅ Selected WAREHOUSE');
        } else {
          console.log('   ⚠️  Could not find WAREHOUSE option');
        }
      } else {
        console.log('   ⚠️  Could not find select trigger');
      }
      
      const buttonStateAfterType = await submitButton.evaluate(btn => btn.disabled);
      console.log(`   Button after location_type: ${buttonStateAfterType ? 'DISABLED' : 'ENABLED'}`);
    } else {
      console.log('⚠️  Location type select not found');
    }

    // Step 4: Check final button state
    console.log('\n📋 Step 4: Final button state check...');
    await delay(1000); // Wait for all validations to complete
    
    const finalButtonState = await submitButton.evaluate(btn => btn.disabled);
    console.log(`📝 Final button state: ${finalButtonState ? 'DISABLED' : 'ENABLED'}`);

    // Get button text for debugging
    const buttonText = await submitButton.evaluate(btn => btn.textContent);
    console.log(`📝 Button text: "${buttonText}"`);

    // Step 5: Try to submit if button is enabled
    if (!finalButtonState) {
      console.log('\n📋 Step 5: Attempting form submission...');
      await submitButton.click();
      await delay(2000); // Wait for submission
      
      if (formSubmitted) {
        console.log('✅ Form submitted successfully');
      } else if (submitAttempts > 0) {
        console.log('⚠️  Form submission attempted but may have failed');
      } else {
        console.log('⚠️  No form submission detected');
      }
    } else {
      console.log('\n⚠️  Step 5: Cannot test submission - button remains disabled');
    }

    // Step 6: Check for validation errors
    console.log('\n📋 Step 6: Checking for validation errors...');
    const errorElements = await page.$$('.text-red-500, .error, [class*="error"]');
    if (errorElements.length > 0) {
      console.log(`⚠️  Found ${errorElements.length} validation errors:`);
      for (let i = 0; i < errorElements.length; i++) {
        const errorText = await errorElements[i].evaluate(el => el.textContent);
        console.log(`   ${i + 1}. ${errorText}`);
      }
    } else {
      console.log('✅ No validation errors visible');
    }

    // Take screenshot
    await page.screenshot({ 
      path: 'location-form-validation-test.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as location-form-validation-test.png');

    // Step 7: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary:');
    console.log('='.repeat(60));

    const results = {
      form_loaded: true,
      button_found: !!submitButton,
      initially_disabled: isInitiallyDisabled,
      finally_enabled: !finalButtonState,
      validation_errors: errorElements.length,
      form_submitted: formSubmitted,
      console_logs: consoleLogs.length
    };

    console.log('\n✅ Test Results:');
    console.log(`   Form loaded: ${results.form_loaded}`);
    console.log(`   Submit button found: ${results.button_found}`);
    console.log(`   Initially disabled: ${results.initially_disabled}`);
    console.log(`   Finally enabled: ${results.finally_enabled}`);
    console.log(`   Validation errors: ${results.validation_errors}`);
    console.log(`   Form submitted: ${results.form_submitted}`);
    console.log(`   Console logs captured: ${results.console_logs}`);

    // Diagnosis
    console.log('\n🔍 Diagnosis:');
    if (results.finally_enabled && results.form_submitted) {
      console.log('✅ SUCCESS: Button works correctly and form can be submitted');
    } else if (results.finally_enabled && !results.form_submitted) {
      console.log('⚠️  PARTIAL: Button enabled but submission may have issues');
    } else if (!results.finally_enabled) {
      console.log('❌ ISSUE: Button remains disabled after filling required fields');
      console.log('   - Check form validation logic');
      console.log('   - Review console logs for validation errors');
      console.log('   - Verify all required fields are properly filled');
    }

    return results;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    await page.screenshot({ 
      path: 'location-form-validation-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved as location-form-validation-error.png');
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testLocationFormValidation()
    .then((results) => {
      console.log('\n🎉 Location form validation test completed!');
      const success = results.finally_enabled || results.form_submitted;
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testLocationFormValidation };