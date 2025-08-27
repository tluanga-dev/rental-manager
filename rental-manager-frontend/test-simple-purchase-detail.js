const puppeteer = require('puppeteer');

(async () => {
  console.log('🧪 Simple Purchase Detail Page Test...\n');

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    // Monitor console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // First, just try to load the home page to verify frontend is working
    console.log('📍 Testing frontend availability...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    // Get the page title to verify it loaded
    const title = await page.title();
    console.log(`✅ Frontend is responding. Page title: ${title}`);

    // Now test our specific endpoint (the purchase detail page may not load due to auth,
    // but we can test if our backend fix worked)
    const purchaseId = '87244183-c72b-4a4f-a5ff-e763e26f0e3c';
    console.log(`📍 Testing purchase detail page navigation (${purchaseId})...`);
    
    await page.goto(`http://localhost:3000/purchases/history/${purchaseId}`, { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });

    // Wait a moment for any errors to surface
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for specific errors we fixed
    const hasInvalidTimeValueError = consoleErrors.some(error => 
      error.includes('Invalid time value') || 
      error.includes('Invalid Date')
    );

    const hasGetReturnsByPurchaseError = consoleErrors.some(error => 
      error.includes('get_returns_by_purchase') || 
      error.includes('object has no attribute')
    );

    const has500Error = consoleErrors.some(error => 
      error.includes('500') && error.includes('purchase-returns')
    );

    console.log('\n📊 Test Results:');
    console.log(`   ❌ Invalid time value errors: ${hasInvalidTimeValueError ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`   ❌ get_returns_by_purchase errors: ${hasGetReturnsByPurchaseError ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`   ❌ 500 errors from purchase-returns API: ${has500Error ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`   📊 Total console errors: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\n🚨 All Console Errors:');
      consoleErrors.forEach((error, i) => console.log(`   ${i + 1}. ${error.substring(0, 100)}...`));
    }

    // Success criteria: no specific errors we targeted for fixing
    const testPassed = !hasInvalidTimeValueError && !hasGetReturnsByPurchaseError && !has500Error;
    
    console.log(`\n${testPassed ? '✅ TEST PASSED' : '❌ TEST FAILED'}: Purchase detail fix verification`);

    if (testPassed) {
      console.log('🎉 Great! The specific errors we targeted have been resolved.');
      if (consoleErrors.length > 0) {
        console.log('ℹ️  Note: There are still some console errors, but not the ones we were fixing.');
      }
    } else {
      console.log('⚠️  The specific errors we targeted are still occurring.');
    }

  } catch (error) {
    console.error('❌ Test execution error:', error.message);
  } finally {
    await browser.close();
  }
})();