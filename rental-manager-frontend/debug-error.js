const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Debugging Detailed Error Information...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const errors = [];
  
  // Capture detailed error information
  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  });
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({
        message: msg.text(),
        type: 'console-error',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  try {
    console.log('📍 Navigating to inventory items...');
    await page.goto('http://localhost:3000/inventory/items', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    console.log('👁️ Clicking view button...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const viewButton = buttons.find(btn => 
        btn.textContent.includes('View') && btn.querySelector('svg.lucide-eye')
      );
      if (viewButton) {
        viewButton.click();
      }
    });
    
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    
    // Wait for any async errors
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📊 Error Analysis:');
    console.log(`  Total errors captured: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Detailed Error Information:');
      errors.forEach((error, index) => {
        console.log(`\n--- Error ${index + 1} ---`);
        console.log(`Type: ${error.type || 'page-error'}`);
        console.log(`Time: ${error.timestamp}`);
        console.log(`Message: ${error.message}`);
        if (error.stack) {
          console.log(`Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
        }
      });
    } else {
      console.log('✅ No errors found!');
    }
    
  } catch (error) {
    console.log('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();