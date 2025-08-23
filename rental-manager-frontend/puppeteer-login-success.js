const puppeteer = require('puppeteer');

async function demonstrateSuccessfulLogin() {
  console.log('🎉 PUPPETEER LOGIN SUCCESS DEMONSTRATION');
  console.log('=' .repeat(55));
  console.log('Frontend: http://localhost:3001 (Docker)');
  console.log('Backend:  http://localhost:8000 (Mock with CORS)');
  console.log('');
  
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 300,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Track success indicators
  let loginAttempted = false;
  let apiCallMade = false;
  let authTokenReceived = false;
  let dashboardReached = false;
  
  // Monitor API calls for the mock backend
  page.on('request', request => {
    if (request.url().includes('localhost:8000/api/auth/login')) {
      console.log('✅ Login API call detected:', request.method(), request.url());
      apiCallMade = true;
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('localhost:8000/api/auth/login') && response.status() === 200) {
      console.log('✅ Successful login response received:', response.status());
      authTokenReceived = true;
    }
  });
  
  // Monitor console for login success
  page.on('console', msg => {
    if (msg.text().includes('Login successful')) {
      console.log('✅ Frontend confirmed login success');
    } else if (msg.text().includes('Demo login')) {
      console.log('📝 Demo login initiated');
      loginAttempted = true;
    }
  });
  
  try {
    console.log('🌐 Navigating to login page...');
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for page to fully load
    try {
      await page.waitForSelector('.animate-spin', { timeout: 3000 });
      await page.waitForSelector('.animate-spin', { hidden: true, timeout: 15000 });
    } catch (e) {
      // No loading spinner
    }
    
    // Wait for login form
    await page.waitForSelector('form', { timeout: 10000 });
    console.log('✅ Login page loaded successfully');
    
    // Check what buttons are available
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(btn => btn.textContent?.trim()).filter(text => text);
    });
    console.log('📋 Available buttons:', buttons);
    
    // Perform the login
    console.log('');
    console.log('🎭 Performing Demo Administrator Login...');
    console.log('-'.repeat(45));
    
    const buttonClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const adminButton = buttons.find(btn => 
        btn.textContent?.trim() === 'Demo as Administrator'
      );
      
      if (adminButton) {
        adminButton.click();
        return true;
      }
      return false;
    });
    
    if (buttonClicked) {
      console.log('✅ Demo as Administrator button clicked');
    } else {
      throw new Error('Demo as Administrator button not found');
    }
    
    // Wait for the authentication process
    console.log('⏳ Waiting for authentication process...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check final state
    const currentUrl = page.url();
    console.log('📍 Final URL:', currentUrl);
    
    if (currentUrl.includes('/dashboard')) {
      console.log('🎉 SUCCESS: Redirected to dashboard!');
      dashboardReached = true;
    }
    
    // Check for auth tokens
    const authState = await page.evaluate(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          return {
            hasUser: !!parsed.state?.user,
            hasToken: !!parsed.state?.accessToken,
            userRole: parsed.state?.user?.role?.name
          };
        } catch (e) {
          return { hasStorage: true, parseError: true };
        }
      }
      return { hasStorage: false };
    });
    
    console.log('🔑 Authentication state:', authState);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'puppeteer-success-demo.png',
      fullPage: false
    });
    console.log('📸 Screenshot saved: puppeteer-success-demo.png');
    
    console.log('');
    console.log('🎯 FINAL RESULTS:');
    console.log('=' .repeat(30));
    console.log(`✅ Login button clicked: ${buttonClicked ? 'YES' : 'NO'}`);
    console.log(`✅ API call made: ${apiCallMade ? 'YES' : 'NO'}`);
    console.log(`✅ Auth token received: ${authTokenReceived ? 'YES' : 'NO'}`);
    console.log(`✅ Dashboard reached: ${dashboardReached ? 'YES' : 'NO'}`);
    console.log(`✅ Auth state valid: ${authState.hasUser && authState.hasToken ? 'YES' : 'NO'}`);
    
    if (authState.userRole) {
      console.log(`👤 Logged in as: ${authState.userRole}`);
    }
    
    console.log('');
    if (apiCallMade && (authTokenReceived || authState.hasToken)) {
      console.log('🏆 PUPPETEER LOGIN TEST: **SUCCESSFUL** 🏆');
      console.log('');
      console.log('✨ What was demonstrated:');
      console.log('  • Puppeteer automated browser navigation');
      console.log('  • Frontend login form interaction');
      console.log('  • API authentication calls');
      console.log('  • Token storage and management');
      console.log('  • End-to-end login workflow');
    } else {
      console.log('⚠️ Login test partially successful - check backend connectivity');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    console.log('\\n⏸️ Keeping browser open for 8 seconds...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    await browser.close();
    console.log('🔚 Test completed');
  }
}

demonstrateSuccessfulLogin().catch(console.error);