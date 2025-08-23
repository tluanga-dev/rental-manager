const puppeteer = require('puppeteer');

async function testDashboardManual() {
  console.log('🔍 Manual Dashboard Verification Test');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  // Track successful API calls
  const successfulApiCalls = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/v1/analytics/') && response.status() === 200) {
      successfulApiCalls.push(url);
    }
  });

  try {
    console.log('📍 Loading login page...');
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2', 
      timeout: 20000 
    });
    
    console.log('📍 Clicking demo admin...');
    const demoButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.trim() === 'Demo as Administrator');
    });
    
    if (demoButton) {
      await demoButton.click();
      console.log('🔄 Demo login clicked');
    }
    
    // Wait for dashboard to load
    console.log('⏳ Waiting for dashboard to load...');
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/dashboard/main')) {
      console.log('✅ Successfully navigated to dashboard');
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check for dashboard elements
      const dashboardElements = await page.evaluate(() => {
        const elements = {
          cards: document.querySelectorAll('.card, [data-testid*="card"], [data-testid*="metric"]').length,
          sidebar: !!document.querySelector('nav, aside, [role="navigation"]'),
          mainContent: !!document.querySelector('main, .main-content, [role="main"]'),
          errorMessages: document.querySelectorAll('[data-testid="error"], .error, .alert-destructive').length,
          loadingSpinners: document.querySelectorAll('.animate-spin, .loading').length
        };
        return elements;
      });
      
      console.log('🎯 Dashboard Elements Found:');
      console.log(`   Cards/Metrics: ${dashboardElements.cards}`);
      console.log(`   Sidebar: ${dashboardElements.sidebar ? '✅' : '❌'}`);
      console.log(`   Main Content: ${dashboardElements.mainContent ? '✅' : '❌'}`);
      console.log(`   Error Messages: ${dashboardElements.errorMessages}`);
      console.log(`   Loading Spinners: ${dashboardElements.loadingSpinners}`);
      
      console.log(`\n📊 Successful API Calls: ${successfulApiCalls.length}`);
      if (successfulApiCalls.length > 0) {
        console.log('   Recent successful calls:');
        successfulApiCalls.slice(-5).forEach((url, i) => {
          const endpoint = url.split('/').pop();
          console.log(`   ${i + 1}. ${endpoint}`);
        });
      }
      
      // Take final screenshot
      await page.screenshot({ 
        path: 'dashboard-manual-verification.png', 
        fullPage: true 
      });
      console.log('📸 Screenshot saved: dashboard-manual-verification.png');
      
    } else {
      console.log('❌ Failed to navigate to dashboard');
    }
    
    console.log('\n⏱️  Browser will remain open for 60 seconds for manual inspection...');
    console.log('      You can manually inspect the dashboard and check for any "Failed to load dashboard data" messages');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ 
      path: 'dashboard-manual-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
    console.log('✅ Manual verification completed');
  }
}

testDashboardManual().catch(console.error);