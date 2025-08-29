const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Final Comprehensive Test...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const errors = [];
  const warnings = [];
  
  // Capture all errors and warnings
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('Download the React DevTools')) {
      errors.push(msg.text());
    } else if (msg.type() === 'warning' && msg.text().includes('params')) {
      warnings.push(msg.text());
    }
  });
  
  try {
    console.log('📍 Testing inventory items list...');
    await page.goto('http://localhost:3000/inventory/items', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    console.log('✅ Inventory items list loaded');
    
    console.log('👁️ Testing navigation to detail page...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const viewButton = buttons.find(btn => 
        btn.textContent.includes('View') && btn.querySelector('svg.lucide-eye')
      );
      if (viewButton) viewButton.click();
    });
    
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    
    const url = page.url();
    console.log('📍 Navigated to:', url);
    
    if (url.endsWith('/undefined')) {
      console.log('❌ Still navigating to undefined URL');
      return;
    }
    
    console.log('⏳ Waiting for detail page to load...');
    await page.waitForSelector('h1, h2, .card', { timeout: 10000 });
    
    // Wait for async content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📊 Final Results:');
    console.log(`  Page errors: ${errors.length}`);
    console.log(`  Param warnings: ${warnings.length}`);
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log('🎉 SUCCESS: All issues have been resolved!');
      console.log('✅ Navigation works correctly');
      console.log('✅ Detail page loads without errors');
      console.log('✅ No React parameter warnings');
    } else {
      if (errors.length > 0) {
        console.log('❌ Remaining errors:');
        errors.slice(0, 3).forEach(err => console.log(`  - ${err.substring(0, 100)}...`));
      }
      if (warnings.length > 0) {
        console.log('⚠️ Remaining warnings:');
        warnings.slice(0, 3).forEach(warn => console.log(`  - ${warn.substring(0, 100)}...`));
      }
    }
    
  } catch (error) {
    console.log('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();