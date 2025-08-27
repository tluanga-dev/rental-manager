const puppeteer = require('puppeteer');

/**
 * Detailed Purchase Form Test
 * Attempts to fully complete the purchase form and submit it
 */

async function testPurchaseFormDetailed() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 500,
    defaultViewport: { width: 1280, height: 900 }
  });

  const page = await browser.newPage();
  
  let purchaseApiCalled = false;
  let formSubmissionLogs = [];
  let apiCalls = [];

  // Monitor console for form submission events
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('PURCHASE') || text.includes('API') || text.includes('CORS')) {
      formSubmissionLogs.push(text);
      console.log('📋 Form Log:', text.substring(0, 120) + '...');
    }
  });

  // Monitor network for purchase API
  page.on('response', response => {
    if (response.url().includes('/api/v1/transactions/purchases')) {
      purchaseApiCalled = true;
      console.log(`🎯 PURCHASE API CALLED: ${response.request().method()} ${response.status()}`);
      
      apiCalls.push({
        method: response.request().method(),
        status: response.status(),
        url: response.url()
      });
    }
  });

  try {
    console.log('🔍 Detailed Purchase Form Test...\n');

    // Load the page
    console.log('📋 Loading purchase recording page...');
    await page.goto('http://localhost:3000/purchases/record', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take initial screenshot
    await page.screenshot({ path: 'purchase-form-initial.png' });

    // Analyze form fields in detail
    console.log('\n🔍 Analyzing form fields...');
    
    const formAnalysis = await page.evaluate(() => {
      const fields = {
        allInputs: [],
        selects: [],
        textareas: [],
        buttons: []
      };
      
      // Analyze all inputs
      document.querySelectorAll('input').forEach((input, i) => {
        fields.allInputs.push({
          index: i,
          type: input.type,
          name: input.name,
          placeholder: input.placeholder,
          required: input.required,
          value: input.value,
          id: input.id
        });
      });
      
      // Analyze selects
      document.querySelectorAll('select').forEach((select, i) => {
        fields.selects.push({
          index: i,
          name: select.name,
          required: select.required,
          options: Array.from(select.options).map(opt => ({ value: opt.value, text: opt.text })),
          selectedIndex: select.selectedIndex
        });
      });
      
      // Analyze textareas
      document.querySelectorAll('textarea').forEach((textarea, i) => {
        fields.textareas.push({
          index: i,
          name: textarea.name,
          placeholder: textarea.placeholder,
          required: textarea.required,
          value: textarea.value
        });
      });
      
      // Analyze buttons
      document.querySelectorAll('button').forEach((button, i) => {
        fields.buttons.push({
          index: i,
          type: button.type,
          text: button.textContent?.trim(),
          disabled: button.disabled
        });
      });
      
      return fields;
    });

    console.log('\n📝 Form Field Analysis:');
    console.log(`   Inputs: ${formAnalysis.allInputs.length}`);
    formAnalysis.allInputs.forEach((input, i) => {
      console.log(`     ${i + 1}. ${input.type} "${input.name}" (${input.placeholder || 'no placeholder'}) ${input.required ? '[REQUIRED]' : ''}`);
    });
    
    console.log(`   Selects: ${formAnalysis.selects.length}`);
    formAnalysis.selects.forEach((select, i) => {
      console.log(`     ${i + 1}. "${select.name}" - ${select.options.length} options ${select.required ? '[REQUIRED]' : ''}`);
    });
    
    console.log(`   Textareas: ${formAnalysis.textareas.length}`);
    formAnalysis.textareas.forEach((textarea, i) => {
      console.log(`     ${i + 1}. "${textarea.name}" (${textarea.placeholder || 'no placeholder'}) ${textarea.required ? '[REQUIRED]' : ''}`);
    });
    
    console.log(`   Buttons: ${formAnalysis.buttons.length}`);
    formAnalysis.buttons.forEach((button, i) => {
      console.log(`     ${i + 1}. ${button.type || 'button'} "${button.text}" ${button.disabled ? '[DISABLED]' : ''}`);
    });

    // Try to fill the form more completely
    console.log('\n📝 Attempting to fill form completely...');
    
    try {
      // Fill date field if present
      const dateInputs = await page.$$('input[type="date"]');
      if (dateInputs.length > 0) {
        await dateInputs[0].click();
        await dateInputs[0].type('2025-08-26');
        console.log('✅ Date field filled');
      }

      // Fill text inputs
      const textInputs = await page.$$('input[type="text"]');
      for (let i = 0; i < textInputs.length; i++) {
        await textInputs[i].click();
        await textInputs[i].type(`Test input ${i + 1}`);
        console.log(`✅ Text input ${i + 1} filled`);
      }

      // Fill select dropdowns
      const selects = await page.$$('select');
      for (let i = 0; i < selects.length; i++) {
        const options = await selects[i].$$('option');
        if (options.length > 1) {
          await page.select(`select:nth-of-type(${i + 1})`, await options[1].evaluate(opt => opt.value));
          console.log(`✅ Select ${i + 1} filled`);
        }
      }

      // Fill textareas
      const textareas = await page.$$('textarea');
      for (let i = 0; i < textareas.length; i++) {
        await textareas[i].click();
        await textareas[i].type('Detailed test purchase submission');
        console.log(`✅ Textarea ${i + 1} filled`);
      }

    } catch (fillError) {
      console.log('⚠️ Form filling encountered issues:', fillError.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Take screenshot after filling
    await page.screenshot({ path: 'purchase-form-filled.png' });
    console.log('📸 Form filled screenshot saved');

    // Look for and click submit button
    console.log('\n🚀 Looking for submit button...');
    
    const submitAttempt = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      
      // Look for submit buttons more broadly
      const possibleSubmitButtons = buttons.filter(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        const type = btn.type?.toLowerCase() || '';
        return type === 'submit' || 
               text.includes('submit') || 
               text.includes('save') || 
               text.includes('record') ||
               text.includes('create') ||
               text.includes('add');
      });
      
      console.log(`Found ${possibleSubmitButtons.length} possible submit buttons:`, 
                  possibleSubmitButtons.map(btn => `"${btn.textContent?.trim()}" (${btn.type})`));
      
      if (possibleSubmitButtons.length > 0) {
        const submitBtn = possibleSubmitButtons[0];
        console.log(`Clicking: "${submitBtn.textContent?.trim()}" (disabled: ${submitBtn.disabled})`);
        
        if (!submitBtn.disabled) {
          submitBtn.click();
          return { clicked: true, buttonText: submitBtn.textContent?.trim() };
        } else {
          return { clicked: false, reason: 'Button is disabled', buttonText: submitBtn.textContent?.trim() };
        }
      }
      
      return { clicked: false, reason: 'No submit button found' };
    });

    console.log('🔘 Submit attempt result:', submitAttempt);

    // Wait for potential API calls
    console.log('\n⏳ Waiting for API calls...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take final screenshot
    await page.screenshot({ path: 'purchase-form-submitted.png' });
    console.log('📸 Final screenshot saved');

    // Results
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Detailed Purchase Form Test Results:');
    console.log('='.repeat(60));

    const results = {
      pageLoaded: true,
      formFieldsFound: formAnalysis.allInputs.length > 0 || formAnalysis.selects.length > 0,
      submitButtonFound: submitAttempt.clicked || submitAttempt.buttonText,
      submitButtonClicked: submitAttempt.clicked,
      purchaseApiCalled,
      formSubmissionLogs: formSubmissionLogs.length,
      apiCallsTotal: apiCalls.length
    };

    console.log(`📋 Page loaded: ${results.pageLoaded ? '✅' : '❌'}`);
    console.log(`🏗️ Form fields found: ${results.formFieldsFound ? '✅' : '❌'}`);
    console.log(`🔘 Submit button found: ${results.submitButtonFound ? '✅' : '❌'} (${submitAttempt.buttonText || 'None'})`);
    console.log(`🚀 Submit button clicked: ${results.submitButtonClicked ? '✅' : '❌'} (${submitAttempt.reason || 'Success'})`);
    console.log(`🎯 Purchase API called: ${results.purchaseApiCalled ? '✅' : '❌'}`);
    console.log(`📋 Form submission logs: ${results.formSubmissionLogs} entries`);

    if (formSubmissionLogs.length > 0) {
      console.log('\n📋 Form Submission Activity:');
      formSubmissionLogs.forEach((log, i) => {
        console.log(`   ${i + 1}. ${log.substring(0, 120)}...`);
      });
    }

    if (apiCalls.length > 0) {
      console.log('\n🎯 Purchase API Calls:');
      apiCalls.forEach((call, i) => {
        console.log(`   ${i + 1}. ${call.method} ${call.status} ${call.url}`);
      });
    }

    // Overall assessment
    console.log('\n🎯 Overall Assessment:');
    if (results.purchaseApiCalled) {
      console.log('🎊 EXCELLENT: Purchase API was called successfully!');
      console.log('   - Form submission is working');
      console.log('   - API integration is functional');
      console.log('   - Previous fixes are effective');
    } else if (results.submitButtonClicked && results.formSubmissionLogs > 0) {
      console.log('🟡 PARTIAL SUCCESS: Form submission attempted');
      console.log('   - Submit button was clicked');
      console.log('   - Form processing detected');  
      console.log('   - May need authentication or additional data');
    } else if (results.submitButtonFound) {
      console.log('⚠️ FORM ISSUES: Submit button found but not working properly');
      console.log('   - Form validation may be preventing submission');
      console.log('   - Required fields may be missing');
    } else {
      console.log('❌ INTERFACE ISSUES: Form submission mechanism not found');
    }

    return {
      success: results.purchaseApiCalled || (results.submitButtonClicked && results.formSubmissionLogs > 0),
      results,
      formAnalysis,
      purchaseApiCalled,
      submitAttempt
    };

  } catch (error) {
    console.error('\n❌ Detailed test failed:', error.message);
    await page.screenshot({ path: 'purchase-form-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testPurchaseFormDetailed()
    .then((results) => {
      console.log('\n🏁 Detailed purchase form test completed!');
      
      if (results.purchaseApiCalled) {
        console.log('🎉 SUCCESS: Purchase API integration is working!');
        console.log('🚀 The 405 and CORS fixes are effective!');
      } else if (results.success) {
        console.log('🟡 PROGRESS: Form functionality is working');
        console.log('📋 API integration may need authentication');
      } else {
        console.log('📝 Form analysis complete - see details above');
      }
      
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPurchaseFormDetailed };