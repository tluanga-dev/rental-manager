const puppeteer = require('puppeteer');

(async () => {
  console.log('🧪 Testing Purchase Detail Page Fix...\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    // Monitor console errors to catch the "Invalid time value" error
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('❌ Console Error:', msg.text());
      }
    });

    // Monitor page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
      console.log('💥 Page Error:', error.message);
    });

    // Go to login page
    console.log('📍 Navigating to login page...');
    await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle2' });

    // Login
    console.log('🔐 Logging in...');
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', 'admin@rentalmanager.com');
    await page.type('input[name="password"]', 'admin123');
    
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Navigate to the specific purchase detail page that was failing
    const purchaseId = '87244183-c72b-4a4f-a5ff-e763e26f0e3c';
    const purchaseUrl = `http://localhost:3000/purchases/history/${purchaseId}`;
    
    console.log(`📍 Navigating to purchase detail page: ${purchaseUrl}`);
    await page.goto(purchaseUrl, { waitUntil: 'networkidle2' });

    // Wait a moment for any API calls to complete and errors to surface
    await page.waitForTimeout(3000);

    // Check for specific errors
    const hasInvalidTimeValueError = consoleErrors.some(error => 
      error.includes('Invalid time value') || error.includes('Invalid Date')
    );

    const hasGetReturnsByPurchaseError = consoleErrors.some(error => 
      error.includes('get_returns_by_purchase') || 
      error.includes('Failed to fetch purchase returns')
    );

    // Take a screenshot to see the current state
    await page.screenshot({ 
      path: 'purchase-detail-test.png',
      fullPage: true
    });

    // Check if the page loaded successfully by looking for expected elements
    const hasTitle = await page.$('h1') !== null;
    const hasBackButton = await page.$('text=Back') !== null;

    // Look for the specific date display to see if it shows "Date not available" or a proper date
    const dateElement = await page.$eval('p.text-muted-foreground', el => el?.textContent).catch(() => null);

    console.log('\n📊 Test Results:');
    console.log(`   ✅ Page title found: ${hasTitle}`);
    console.log(`   ✅ Back button found: ${hasBackButton}`);
    console.log(`   📅 Date display: ${dateElement || 'Not found'}`);
    console.log(`   ❌ Invalid time value errors: ${hasInvalidTimeValueError ? 'YES' : 'NO'}`);
    console.log(`   ❌ get_returns_by_purchase errors: ${hasGetReturnsByPurchaseError ? 'YES' : 'NO'}`);
    console.log(`   📊 Total console errors: ${consoleErrors.length}`);
    console.log(`   📊 Total page errors: ${pageErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\n🚨 Console Errors:');
      consoleErrors.forEach(error => console.log(`   - ${error}`));
    }

    if (pageErrors.length > 0) {
      console.log('\n💥 Page Errors:');
      pageErrors.forEach(error => console.log(`   - ${error}`));
    }

    // Final assessment
    const testPassed = !hasInvalidTimeValueError && !hasGetReturnsByPurchaseError && hasTitle;
    console.log(`\n${testPassed ? '✅ TEST PASSED' : '❌ TEST FAILED'}: Purchase detail page fix verification`);

    if (testPassed) {
      console.log('✨ The fixes appear to be working! No critical errors detected.');
    } else {
      console.log('⚠️  There may still be issues that need attention.');
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    await browser.close();
  }
})();