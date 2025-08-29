const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting Inventory Detail Test...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  
  // Enable console logging from the page
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error') {
      console.log('🚨 PAGE ERROR:', msg.text());
    } else if (type === 'warning') {
      console.log('⚠️ PAGE WARNING:', msg.text());
    } else {
      console.log('📄 PAGE LOG:', msg.text());
    }
  });
  
  // Listen for page errors
  page.on('pageerror', error => {
    console.log('💥 PAGE EXCEPTION:', error.message);
  });
  
  // Listen for failed requests
  page.on('requestfailed', request => {
    console.log('🔴 FAILED REQUEST:', request.url(), request.failure().errorText);
  });
  
  try {
    console.log('📍 Navigating to inventory items page...');
    await page.goto('http://localhost:3000/inventory/items', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for inventory items to load...');
    await page.waitForSelector('table', { timeout: 10000 });
    
    console.log('🔍 Looking for View button...');
    // Wait for the first view button in the table
    const viewButton = await page.waitForSelector('button:has-text("View")', { 
      timeout: 5000 
    }).catch(() => null);
    
    if (!viewButton) {
      // Try alternative selector
      const eyeButton = await page.$('button svg[data-lucide="eye"]');
      if (eyeButton) {
        const button = await eyeButton.evaluateHandle(el => el.closest('button'));
        console.log('👁️ Found eye button, clicking...');
        await button.click();
      } else {
        console.log('❌ No view button found');
        return;
      }
    } else {
      console.log('👁️ Found view button, clicking...');
      await viewButton.click();
    }
    
    console.log('⏳ Waiting for navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
    
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);
    
    // Check if we're on a detail page
    if (currentUrl.includes('/inventory/items/') && !currentUrl.endsWith('/undefined')) {
      console.log('✅ Successfully navigated to item detail page');
      
      // Wait for content to load and check for errors
      await page.waitForSelector('div', { timeout: 5000 });
      
      // Check for error alerts
      const errorAlert = await page.$('.bg-red-50, .bg-red-100, [role="alert"]');
      if (errorAlert) {
        const errorText = await errorAlert.textContent();
        console.log('🚨 Error found on detail page:', errorText);
      } else {
        console.log('✅ No error alerts found on detail page');
        
        // Check for loading indicators
        const loadingIndicator = await page.$('.animate-spin');
        if (loadingIndicator) {
          console.log('⏳ Page is still loading...');
          await page.waitForFunction(
            () => !document.querySelector('.animate-spin'),
            { timeout: 10000 }
          ).catch(() => console.log('⚠️ Loading did not complete'));
        }
        
        console.log('✅ Item detail page loaded successfully');
      }
      
    } else if (currentUrl.endsWith('/undefined')) {
      console.log('❌ Navigation failed - went to /undefined (item ID issue)');
    } else {
      console.log('❌ Unexpected navigation result');
    }
    
  } catch (error) {
    console.log('💥 Test failed with error:', error.message);
  } finally {
    console.log('🏁 Test completed');
    await browser.close();
  }
})();