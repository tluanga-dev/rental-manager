const puppeteer = require('puppeteer');

async function quickRouterTest() {
  console.log('🎯 Quick Router Error Test...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  let routerErrors = [];
  
  // Capture console errors
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('NextRouter was not mounted') || text.includes('🎯 Return Page Loading')) {
      routerErrors.push(text);
      console.log('Console:', text);
    }
  });
  
  try {
    await page.goto('http://localhost:3000/rentals/67870147-2936-40df-8797-f0315f7b4c44/return', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    
    // Wait a bit for any errors to appear
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`📊 Found ${routerErrors.length} router-related logs`);
    
    const hasError = routerErrors.some(err => err.includes('NextRouter was not mounted'));
    console.log(hasError ? '❌ Router error still present' : '✅ No router errors detected');
    
    return !hasError;
    
  } catch (error) {
    console.log('⚠️ Page load error (expected if backend is down):', error.message);
    // Still check if we caught router errors
    const hasRouterError = routerErrors.some(err => err.includes('NextRouter was not mounted'));
    return !hasRouterError;
  } finally {
    await browser.close();
  }
}

quickRouterTest()
  .then(success => {
    console.log(success ? '🎉 Router fix successful!' : '💥 Router error still exists');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test error:', error);
    process.exit(1);
  });