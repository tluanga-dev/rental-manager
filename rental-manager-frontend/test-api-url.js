const puppeteer = require('puppeteer');

async function testApiUrl() {
  console.log('🔍 Testing Frontend API URL Configuration');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  // Capture network requests to see what URLs are being called
  const requests = [];
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/') && !url.includes('_next')) {
      requests.push({
        url: url,
        method: request.method(),
        timestamp: new Date().toISOString()
      });
      console.log(`📡 API Request: ${request.method()} ${url}`);
    }
  });

  try {
    console.log('📍 Loading login page...');
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2', 
      timeout: 20000 
    });
    
    console.log('📍 Page loaded, waiting for potential API calls...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📍 Clicking demo admin...');
    const buttons = await page.$$('button');
    let demoButton = null;
    
    for (const button of buttons) {
      try {
        const text = await page.evaluate(el => el.textContent.trim(), button);
        if (text === 'Demo as Administrator') {
          demoButton = button;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (demoButton) {
      await demoButton.click();
      console.log('🔄 Demo login clicked, waiting for API calls...');
      
      // Wait for potential API calls
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n📊 API Requests Summary:');
    if (requests.length > 0) {
      requests.forEach((req, i) => {
        console.log(`${i + 1}. ${req.method} ${req.url}`);
      });
    } else {
      console.log('⚠️  No API requests captured');
    }
    
    // Keep browser open for manual inspection
    console.log('\n⏱️  Browser will remain open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ 
      path: 'api-url-test-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
    console.log('✅ Test completed');
  }
}

testApiUrl().catch(console.error);