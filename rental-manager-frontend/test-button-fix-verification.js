const puppeteer = require('puppeteer');

/**
 * Quick Button Fix Verification
 * Confirms that the Create Location button issue is resolved
 */

async function verifyButtonFix() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();

  try {
    console.log('🔍 Verifying Create Location Button Fix...\n');

    await page.goto('http://localhost:3000/inventory/locations/new', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Check initial state
    const submitButton = await page.$('button[type="submit"]');
    const initialState = await submitButton.evaluate(btn => ({
      disabled: btn.disabled,
      text: btn.textContent.trim()
    }));

    console.log(`📝 Initial: Button "${initialState.text}" is ${initialState.disabled ? 'DISABLED' : 'ENABLED'}`);

    // Fill required fields
    await page.type('input[name="location_code"]', 'TEST-VERIFY');
    await page.type('input[name="location_name"]', 'Verification Test');
    
    // Wait for validation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check final state
    const finalState = await submitButton.evaluate(btn => ({
      disabled: btn.disabled,
      text: btn.textContent.trim()
    }));

    console.log(`📝 After filling fields: Button "${finalState.text}" is ${finalState.disabled ? 'DISABLED' : 'ENABLED'}`);

    // Take screenshot
    await page.screenshot({ path: 'button-fix-verification.png', fullPage: true });

    const success = !finalState.disabled;
    console.log(`\n${success ? '✅ SUCCESS' : '❌ FAILED'}: Create Location button fix ${success ? 'works correctly' : 'still has issues'}`);

    return success;

  } finally {
    await browser.close();
  }
}

verifyButtonFix()
  .then(success => {
    console.log('\n🎉 Button fix verification completed!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });