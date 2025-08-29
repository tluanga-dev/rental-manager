const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,  // Open DevTools automatically
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log('❌ Console Error:', text);
    } else if (type === 'warning') {
      console.log('⚠️ Console Warning:', text);
    } else if (text.includes('API') || text.includes('categories')) {
      console.log('📝 Console Log:', text);
    }
  });
  
  // Monitor network requests
  const requests = [];
  page.on('request', request => {
    if (request.url().includes('categories')) {
      console.log('📤 Request:', request.method(), request.url());
      console.log('   Headers:', request.headers());
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('categories')) {
      console.log('📥 Response:', response.status(), response.url());
      response.text().then(body => {
        try {
          const data = JSON.parse(body);
          console.log('   Data:', JSON.stringify(data).substring(0, 200));
        } catch (e) {
          console.log('   Body:', body.substring(0, 200));
        }
      }).catch(e => {
        console.log('   Could not read body');
      });
    }
  });
  
  page.on('requestfailed', request => {
    if (request.url().includes('categories')) {
      console.log('❌ Request Failed:', request.url());
      console.log('   Failure:', request.failure());
    }
  });
  
  try {
    console.log('🔍 Testing Categories Page with Network Monitoring...\n');
    
    // Navigate to categories page
    console.log('📄 Loading /products/categories page...');
    await page.goto('http://localhost:3005/products/categories', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for potential API calls...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n📊 Summary:');
    console.log(`   Total category requests: ${requests.length}`);
    
    if (requests.length === 0) {
      console.log('   ⚠️ No category API requests were made!');
      console.log('   This suggests the component might not be calling the API.');
    }
    
    // Check localStorage for auth token
    const localStorage = await page.evaluate(() => {
      const authState = window.localStorage.getItem('auth-storage');
      return authState ? JSON.parse(authState) : null;
    });
    
    console.log('\n🔑 Auth State:');
    if (localStorage && localStorage.state) {
      console.log('   User:', localStorage.state.user?.email || 'No user');
      console.log('   Token:', localStorage.state.token ? 'Present' : 'Missing');
    } else {
      console.log('   No auth state in localStorage');
    }
    
    console.log('\n👀 DevTools is open. Check the Network tab for more details.');
    console.log('   Keep browser open to inspect further...');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
})();