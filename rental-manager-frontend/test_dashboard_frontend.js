const puppeteer = require('puppeteer');

async function testDashboard() {
  console.log('🔍 Testing Dashboard Frontend...');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI/CD
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to login page
    console.log('📱 Navigating to login page...');
    await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle2' });
    
    // Login
    console.log('🔐 Logging in...');
    await page.type('input[name="username"]', 'admin');
    await page.type('input[name="password"]', 'K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✅ Login successful');
    
    // Navigate to main dashboard
    console.log('📊 Navigating to dashboard...');
    await page.goto('http://localhost:3000/dashboard/main', { waitUntil: 'networkidle2' });
    
    // Wait for dashboard content to load
    await page.waitForTimeout(3000);
    
    // Check for specific dashboard components
    console.log('🔍 Checking dashboard components...');
    
    // Check for Revenue Trend chart
    const revenueTrendExists = await page.$('h3:contains("Revenue Trend")') !== null;
    console.log(`   Revenue Trend component: ${revenueTrendExists ? '✅' : '❌'}`);
    
    // Check for Top Performing Items
    const topItemsExists = await page.$('h3:contains("Top Performing Items")') !== null;
    console.log(`   Top Performing Items: ${topItemsExists ? '✅' : '❌'}`);
    
    // Check for loading indicators (should not be present after load)
    const loadingSpinners = await page.$$('.animate-spin');
    console.log(`   Loading spinners: ${loadingSpinners.length === 0 ? '✅ None (good)' : `❌ ${loadingSpinners.length} found`}`);
    
    // Check for error messages
    const errorMessages = await page.$$('[class*="error"], [class*="Error"]');
    console.log(`   Error messages: ${errorMessages.length === 0 ? '✅ None (good)' : `❌ ${errorMessages.length} found`}`);
    
    // Take a screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'dashboard-test-screenshot.png', fullPage: true });
    
    // Check network requests for API calls
    console.log('🌐 Checking network activity...');
    const responses = [];
    page.on('response', response => {
      if (response.url().includes('/api/analytics/dashboard')) {
        responses.push({
          url: response.url(),
          status: response.status()
        });
      }
    });
    
    // Refresh page to trigger API calls
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
    
    console.log('📡 API Responses:');
    responses.forEach(resp => {
      console.log(`   ${resp.status === 200 ? '✅' : '❌'} ${resp.url} (${resp.status})`);
    });
    
    console.log('✅ Dashboard test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testDashboard();