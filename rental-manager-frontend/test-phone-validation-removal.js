const puppeteer = require('puppeteer');

/**
 * Test Phone Validation Removal
 * Verifies that users can now enter phone numbers in various formats
 */

async function testPhoneValidationRemoval() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Track validation errors
  const validationErrors = [];
  page.on('console', msg => {
    if (msg.text().includes('E.164') || msg.text().includes('phone')) {
      validationErrors.push(msg.text());
    }
  });

  try {
    console.log('🔍 Testing Phone Validation Removal...\n');

    await page.goto('http://localhost:3000/inventory/locations/new', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('📋 Step 1: Testing various phone number formats...');

    // Test different phone formats
    const phoneFormats = [
      '(123) 456-7890',     // US format with parentheses
      '123-456-7890',       // US format with dashes
      '123 456 7890',       // US format with spaces
      '123.456.7890',       // US format with dots
      '1234567890',         // No formatting
      '+1-123-456-7890',    // International with dashes
      '+44 20 1234 5678',   // UK format
      '555-HELP',           // With letters
      'ext. 1234'           // Extension format
    ];

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < phoneFormats.length; i++) {
      const phoneNumber = phoneFormats[i];
      console.log(`\n📞 Testing format ${i + 1}: "${phoneNumber}"`);

      // Clear and fill contact number field
      const contactField = await page.$('input[name="contact_number"], input[id="contact_number"]');
      if (contactField) {
        await contactField.click({ clickCount: 3 });
        await contactField.type(phoneNumber);
        
        // Wait for validation
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check for validation errors in the UI
        const errorElements = await page.$$('.text-red-500');
        const hasErrors = errorElements.length > 0;
        
        if (hasErrors) {
          // Get error text
          const errorTexts = [];
          for (const errorEl of errorElements) {
            const text = await errorEl.evaluate(el => el.textContent);
            if (text && text.includes('E.164')) {
              errorTexts.push(text);
            }
          }
          
          if (errorTexts.length > 0) {
            console.log(`   ❌ FAILED: ${errorTexts.join(', ')}`);
            failureCount++;
          } else {
            console.log(`   ✅ PASSED: No E.164 errors (other validation may exist)`);
            successCount++;
          }
        } else {
          console.log(`   ✅ PASSED: No validation errors`);
          successCount++;
        }
      } else {
        console.log(`   ⚠️  Contact number field not found`);
      }
    }

    // Test contact person phone field
    console.log('\n📋 Step 2: Testing contact person phone field...');
    
    const contactPersonField = await page.$('input[name="contact_person_phone"], input[id="contact_person_phone"]');
    if (contactPersonField) {
      await contactPersonField.click({ clickCount: 3 });
      await contactPersonField.type('(555) 123-4567');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const errorElements = await page.$$('.text-red-500');
      const hasE164Errors = errorElements.length > 0;
      
      if (hasE164Errors) {
        const errorTexts = [];
        for (const errorEl of errorElements) {
          const text = await errorEl.evaluate(el => el.textContent);
          if (text && text.includes('E.164')) {
            errorTexts.push(text);
          }
        }
        
        if (errorTexts.length > 0) {
          console.log(`   ❌ Contact person phone still has E.164 validation: ${errorTexts.join(', ')}`);
        } else {
          console.log(`   ✅ Contact person phone accepts flexible format`);
        }
      } else {
        console.log(`   ✅ Contact person phone accepts flexible format`);
      }
    } else {
      console.log(`   ⚠️  Contact person phone field not found`);
    }

    // Take screenshot
    await page.screenshot({ 
      path: 'phone-validation-test.png',
      fullPage: true 
    });

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Phone Validation Test Results:');
    console.log('='.repeat(50));
    console.log(`✅ Successful formats: ${successCount}/${phoneFormats.length}`);
    console.log(`❌ Failed formats: ${failureCount}/${phoneFormats.length}`);
    
    const overallSuccess = failureCount === 0;
    console.log(`\n${overallSuccess ? '🎉 SUCCESS' : '⚠️ PARTIAL SUCCESS'}: ${
      overallSuccess 
        ? 'All phone formats accepted - E.164 validation removed successfully!'
        : 'Some formats still failing - may need additional fixes'
    }`);

    return { successCount, failureCount, total: phoneFormats.length, overallSuccess };

  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testPhoneValidationRemoval()
    .then((results) => {
      console.log('\n✅ Phone validation removal test completed!');
      process.exit(results.overallSuccess ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPhoneValidationRemoval };