const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing for Console Warnings...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const consoleMessages = [];
  
  // Capture all console messages
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    consoleMessages.push({ type, text });
  });
  
  // Capture page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });
  
  try {
    console.log('📍 Navigating to inventory items and clicking view button...');
    await page.goto('http://localhost:3000/inventory/items', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Click the view button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const viewButton = buttons.find(btn => 
        btn.textContent.includes('View') && btn.querySelector('svg.lucide-eye')
      );
      if (viewButton) {
        viewButton.click();
      }
    });
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    
    // Wait a bit for any async warnings
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📊 Analysis Results:');
    console.log(`  Total console messages: ${consoleMessages.length}`);
    console.log(`  Page errors: ${pageErrors.length}`);
    
    // Filter for param-related warnings
    const paramWarnings = consoleMessages.filter(msg => 
      msg.text.includes('param property was accessed directly') ||
      msg.text.includes('React.use()') ||
      msg.text.includes('params is now a Promise')
    );
    
    console.log(`  Param-related warnings: ${paramWarnings.length}`);
    
    if (paramWarnings.length > 0) {
      console.log('❌ Still has param warnings:');
      paramWarnings.forEach(warning => {
        console.log(`    ${warning.type}: ${warning.text.substring(0, 100)}...`);
      });
    } else {
      console.log('✅ No param warnings found!');
    }
    
    if (pageErrors.length > 0) {
      console.log('❌ Page errors found:');
      pageErrors.forEach(error => {
        console.log(`    ${error.substring(0, 100)}...`);
      });
    } else {
      console.log('✅ No page errors found!');
    }
    
  } catch (error) {
    console.log('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();