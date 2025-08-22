const puppeteer = require('puppeteer');

async function testDashboardSimple() {
  console.log('🔍 Testing Dashboard Frontend (Simple)...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const page = await browser.newPage();
  
  try {
    // Set up authentication by manually adding token to localStorage
    console.log('📊 Navigating to dashboard...');
    await page.goto('http://localhost:3000/dashboard/main', { waitUntil: 'networkidle0' });
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if we're redirected to login (expected without auth)
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/auth/login')) {
      console.log('🔐 Redirected to login (expected)');
      
      // Check if login form exists
      const usernameInput = await page.$('input[type="text"], input[type="email"], input[name*="user"], input[placeholder*="user"]');
      const passwordInput = await page.$('input[type="password"]');
      
      console.log(`   Username input: ${usernameInput ? '✅ Found' : '❌ Not found'}`);
      console.log(`   Password input: ${passwordInput ? '✅ Found' : '❌ Not found'}`);
      
      if (usernameInput && passwordInput) {
        console.log('🔐 Attempting login...');
        
        // Fill login form
        await usernameInput.type('admin');
        await passwordInput.type('K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3');
        
        // Find and click submit button
        const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:contains("Login"), button:contains("Sign")');
        if (submitBtn) {
          await submitBtn.click();
          
          // Wait for navigation
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const newUrl = page.url();
          console.log(`After login URL: ${newUrl}`);
          
          if (newUrl.includes('/dashboard')) {
            console.log('✅ Successfully accessed dashboard');
            
            // Take screenshot of dashboard
            await page.screenshot({ path: 'dashboard-screenshot.png', fullPage: true });
            console.log('📸 Screenshot saved: dashboard-screenshot.png');
            
            // Check for key dashboard elements
            const pageText = await page.content();
            
            const hasRevenueChart = pageText.includes('Revenue Trend') || pageText.includes('revenue');
            const hasTopItems = pageText.includes('Top Performing') || pageText.includes('top items');
            const hasMetrics = pageText.includes('Total Revenue') || pageText.includes('metric');
            
            console.log('\n📊 Dashboard Components:');
            console.log(`   Revenue components: ${hasRevenueChart ? '✅' : '❌'}`);
            console.log(`   Top items components: ${hasTopItems ? '✅' : '❌'}`);
            console.log(`   Metrics components: ${hasMetrics ? '✅' : '❌'}`);
            
          } else {
            console.log('❌ Login failed or not redirected to dashboard');
          }
        } else {
          console.log('❌ Submit button not found');
        }
      }
    } else {
      console.log('🔍 Already on dashboard page');
    }
    
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Take error screenshot
    try {
      await page.screenshot({ path: 'dashboard-error-screenshot.png', fullPage: true });
      console.log('📸 Error screenshot saved: dashboard-error-screenshot.png');
    } catch (e) {
      console.log('Could not take error screenshot');
    }
  } finally {
    await browser.close();
  }
}

testDashboardSimple();