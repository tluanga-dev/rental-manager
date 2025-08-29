const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing Inventory Detail Button Click...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('📍 Navigating to inventory items page...');
    await page.goto('http://localhost:3000/inventory/items', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for table to load...');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    console.log('👁️ Looking for View button and clicking...');
    const clicked = await page.evaluate(() => {
      // Find the first View button (contains both eye icon and "View" text)
      const buttons = Array.from(document.querySelectorAll('button'));
      const viewButton = buttons.find(btn => 
        btn.textContent.includes('View') && btn.querySelector('svg.lucide-eye')
      );
      if (viewButton) {
        viewButton.click();
        return true;
      }
      return false;
    });
    
    if (!clicked) {
      console.log('❌ Could not find View button');
      return;
    }
    
    console.log('⏳ Waiting for navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    
    const finalUrl = page.url();
    console.log('📍 Final URL:', finalUrl);
    
    // Test the result
    if (finalUrl.includes('/inventory/items/') && !finalUrl.endsWith('/undefined')) {
      console.log('✅ SUCCESS: Navigated to valid item detail page');
      
      // Wait a bit and check for errors
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const hasErrors = await page.evaluate(() => {
        return !!document.querySelector('.bg-red-50, .bg-red-100, [role="alert"]');
      });
      
      if (hasErrors) {
        console.log('❌ Error found on detail page');
      } else {
        console.log('✅ No errors on detail page');
      }
      
    } else if (finalUrl.endsWith('/undefined')) {
      console.log('❌ FAILURE: Still navigating to /undefined');
    } else {
      console.log('❌ FAILURE: Unexpected navigation result');
    }
    
  } catch (error) {
    console.log('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();