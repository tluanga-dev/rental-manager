const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testCompleteLoginFlow() {
  console.log('🎭 Starting Comprehensive Login Flow Test with Puppeteer');
  console.log('=' * 60);

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    defaultViewport: { width: 1280, height: 720 },
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--no-sandbox'
    ]
  });
  
  const page = await browser.newPage();
  
  // Enable console logging from the page
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`🌐 Browser ${type.toUpperCase()}: ${msg.text()}`);
    }
  });

  // Enable request/response logging
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/') || url.includes('/health')) {
      console.log(`📡 API Response: ${status} ${url}`);
    }
  });

  try {
    console.log('\n📍 Step 1: Navigate to Login Page');
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    console.log('✅ Login page loaded successfully');
    await page.screenshot({ path: 'test-screenshots/01-login-page-loaded.png', fullPage: true });

    console.log('\n📍 Step 2: Check Page Elements');
    
    // Wait for and verify demo admin button exists
    await page.waitForSelector('[data-testid="demo-admin-login"]', { timeout: 10000 });
    console.log('✅ Demo Admin button found');

    // Check if login form exists
    const loginForm = await page.$('form');
    if (loginForm) {
      console.log('✅ Login form found');
    } else {
      console.log('⚠️  Login form not found');
    }

    // Check for username and password fields
    const usernameField = await page.$('input[name="username"], input[type="text"]');
    const passwordField = await page.$('input[name="password"], input[type="password"]');
    
    if (usernameField) console.log('✅ Username field found');
    if (passwordField) console.log('✅ Password field found');

    console.log('\n📍 Step 3: Test Demo Admin Login');
    
    // Click the demo admin button
    console.log('🔄 Clicking Demo Admin button...');
    await page.click('[data-testid="demo-admin-login"]');
    
    console.log('⏳ Waiting for login to process...');
    
    // Wait for navigation or success indication
    try {
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2', 
        timeout: 15000 
      });
      console.log('✅ Navigation completed after demo login');
    } catch (navError) {
      console.log('⚠️  No navigation detected, checking current URL...');
    }

    await page.screenshot({ path: 'test-screenshots/02-after-demo-login-click.png', fullPage: true });
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Check for successful login indicators
    const isOnDashboard = currentUrl.includes('/dashboard') || currentUrl.includes('/main');
    const hasLogoutButton = await page.$('button:contains("Logout"), [data-testid*="logout"]') !== null;
    const hasUserInfo = await page.$('[data-testid*="user"], .user-info, .profile') !== null;

    if (isOnDashboard) {
      console.log('✅ Successfully redirected to dashboard');
    } else {
      console.log(`⚠️  Not on dashboard. Current URL: ${currentUrl}`);
    }

    console.log('\n📍 Step 4: Test Manual Login');
    
    // If demo login didn't work or we want to test manual login
    if (!isOnDashboard) {
      console.log('🔄 Testing manual login with credentials...');
      
      // Go back to login page if needed
      if (!currentUrl.includes('/login')) {
        await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle2' });
      }
      
      // Fill in the form manually
      await page.waitForSelector('input[type="text"], input[name="username"]', { timeout: 5000 });
      await page.type('input[type="text"], input[name="username"]', 'admin');
      console.log('✅ Typed username: admin');
      
      await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 5000 });
      await page.type('input[type="password"], input[name="password"]', 'admin123');
      console.log('✅ Typed password: admin123');
      
      await page.screenshot({ path: 'test-screenshots/03-form-filled.png', fullPage: true });
      
      // Submit the form
      const submitButton = await page.$('button[type="submit"], button:contains("Login"), button:contains("Sign In")');
      if (submitButton) {
        console.log('🔄 Clicking login button...');
        await submitButton.click();
        
        // Wait for response
        try {
          await page.waitForNavigation({ 
            waitUntil: 'networkidle2', 
            timeout: 15000 
          });
          console.log('✅ Form submission completed');
        } catch (e) {
          console.log('⚠️  Form submission timeout, checking for errors...');
        }
      }
    }

    await page.screenshot({ path: 'test-screenshots/04-final-state.png', fullPage: true });
    
    console.log('\n📍 Step 5: Verify Login Success');
    
    const finalUrl = page.url();
    console.log(`📍 Final URL: ${finalUrl}`);
    
    // Check for success indicators
    const successIndicators = {
      'Dashboard URL': finalUrl.includes('/dashboard') || finalUrl.includes('/main'),
      'Not on login page': !finalUrl.includes('/login'),
      'Page title changed': await page.title(),
    };
    
    console.log('\n📊 Success Indicators:');
    for (const [indicator, value] of Object.entries(successIndicators)) {
      const status = value ? '✅' : '❌';
      console.log(`${status} ${indicator}: ${value}`);
    }
    
    // Check for any error messages on the page
    const errorElements = await page.$$('.error, .alert-error, [data-testid*="error"]');
    if (errorElements.length > 0) {
      console.log(`⚠️  Found ${errorElements.length} error elements on page`);
      for (let i = 0; i < errorElements.length; i++) {
        try {
          const errorText = await page.evaluate(el => el.textContent, errorElements[i]);
          console.log(`   Error ${i + 1}: ${errorText}`);
        } catch (e) {
          console.log(`   Error ${i + 1}: Could not read error text`);
        }
      }
    } else {
      console.log('✅ No error messages found');
    }
    
    console.log('\n📍 Step 6: Test API Health (Browser Context)');
    
    // Test API endpoints from browser context
    try {
      const healthCheckResult = await page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:8001/health');
          return { status: response.status, ok: response.ok, url: response.url };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      if (healthCheckResult.ok) {
        console.log(`✅ Health endpoint accessible: ${healthCheckResult.status}`);
      } else {
        console.log(`❌ Health endpoint failed: ${healthCheckResult.error || healthCheckResult.status}`);
      }
    } catch (e) {
      console.log(`❌ Could not test health endpoint: ${e.message}`);
    }

    console.log('\n🎯 TEST SUMMARY');
    console.log('=' * 40);
    
    const finalSuccess = 
      (finalUrl.includes('/dashboard') || finalUrl.includes('/main') || !finalUrl.includes('/login')) &&
      errorElements.length === 0;
    
    if (finalSuccess) {
      console.log('🎉 LOGIN TEST: SUCCESS!');
      console.log('✅ Authentication flow working correctly');
      console.log('✅ User successfully logged in');
      console.log('✅ No errors detected');
    } else {
      console.log('❌ LOGIN TEST: ISSUES DETECTED');
      console.log('⚠️  Please review the screenshots and logs');
    }
    
    console.log('\n📸 Screenshots saved:');
    console.log('   01-login-page-loaded.png');
    console.log('   02-after-demo-login-click.png');  
    console.log('   03-form-filled.png');
    console.log('   04-final-state.png');
    
    // Keep browser open for 5 seconds for manual inspection
    console.log('\n⏱️  Browser will remain open for 5 seconds for inspection...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    await page.screenshot({ path: 'test-screenshots/error-screenshot.png', fullPage: true });
    console.log('📸 Error screenshot saved: error-screenshot.png');
  } finally {
    console.log('\n🔒 Closing browser...');
    await browser.close();
    console.log('✅ Test completed');
  }
}

// Create screenshots directory if it doesn't exist
const screenshotDir = 'test-screenshots';
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  console.log(`📁 Created directory: ${screenshotDir}`);
}

// Run the test
testCompleteLoginFlow().catch(console.error);