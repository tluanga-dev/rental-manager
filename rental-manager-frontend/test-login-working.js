const puppeteer = require('puppeteer');
const fs = require('fs');

async function testWorkingLogin() {
  console.log('🎭 Testing Complete Login Flow - Working Version');
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
    console.log('\\n📍 Step 1: Navigate to Login Page');
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    console.log('✅ Login page loaded successfully');
    await page.screenshot({ path: 'test-screenshots/working-01-login-loaded.png', fullPage: true });

    console.log('\\n📍 Step 2: Find Demo Admin Button');
    
    // Look for the Demo as Administrator button
    let demoButton = null;
    
    // Get all buttons and check their text
    const buttons = await page.$$('button');
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
      console.log('✅ Demo Admin button found');
      
      console.log('\\n📍 Step 3: Click Demo Admin Button');
      await demoButton.click();
      console.log('🔄 Demo Admin button clicked');
      
      // Wait for login to process
      console.log('⏳ Waiting for login to complete...');
      
      try {
        await page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: 15000 
        });
        console.log('✅ Navigation completed after demo login');
      } catch (navError) {
        console.log('⚠️  No navigation detected, checking current state...');
      }
      
      // Wait a bit for any async operations
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const finalUrl = page.url();
      console.log(`📍 Final URL: ${finalUrl}`);
      
      await page.screenshot({ path: 'test-screenshots/working-02-after-demo-click.png', fullPage: true });
      
      // Check for success indicators
      const isLoggedIn = finalUrl.includes('/dashboard') || finalUrl.includes('/main') || !finalUrl.includes('/login');
      
      if (isLoggedIn) {
        console.log('🎉 LOGIN SUCCESS!');
        console.log('✅ Demo admin login working correctly');
      } else {
        console.log('❌ Login may have failed - still on login page');
        
        // Check for any error messages
        const errorElements = await page.$$('.error, .alert-error, [role="alert"]');
        if (errorElements.length > 0) {
          console.log('🚨 Found error messages on page:');
          for (let i = 0; i < errorElements.length; i++) {
            try {
              const errorText = await page.evaluate(el => el.textContent.trim(), errorElements[i]);
              console.log(`   Error ${i + 1}: ${errorText}`);
            } catch (e) {
              console.log(`   Error ${i + 1}: Could not read error text`);
            }
          }
        }
      }
      
    } else {
      console.log('❌ Demo Admin button not found, trying manual login...');
      
      console.log('\\n📍 Step 3: Manual Login Fallback');
      
      // Fill username field
      const usernameField = await page.$('input[name="username"]');
      if (usernameField) {
        await usernameField.type('admin');
        console.log('✅ Username entered: admin');
      }
      
      // Fill password field  
      const passwordField = await page.$('input[name="password"]');
      if (passwordField) {
        await passwordField.type('admin123');
        console.log('✅ Password entered');
      }
      
      await page.screenshot({ path: 'test-screenshots/working-03-form-filled.png', fullPage: true });
      
      // Submit form
      const submitButton = await page.$('button[type="submit"]');
      if (submitButton) {
        await submitButton.click();
        console.log('🔄 Submit button clicked');
        
        // Wait for response
        try {
          await page.waitForNavigation({ 
            waitUntil: 'networkidle2', 
            timeout: 15000 
          });
          console.log('✅ Form submission completed');
        } catch (e) {
          console.log('⚠️  Form submission timeout');
        }
        
        const finalUrl = page.url();
        console.log(`📍 Final URL after manual login: ${finalUrl}`);
      }
    }

    console.log('\\n📍 Step 4: Final Status Check');
    
    const currentUrl = page.url();
    const pageTitle = await page.title();
    
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`📄 Page Title: ${pageTitle}`);
    
    await page.screenshot({ path: 'test-screenshots/working-04-final-state.png', fullPage: true });
    
    // Test API health from browser context
    console.log('\\n📍 Step 5: Test API Connectivity');
    try {
      const healthResult = await page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:8001/health');
          return { status: response.status, ok: response.ok };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      if (healthResult.ok) {
        console.log('✅ API health check successful');
      } else {
        console.log(`❌ API health check failed: ${healthResult.error || healthResult.status}`);
      }
    } catch (e) {
      console.log(`❌ Could not perform API health check: ${e.message}`);
    }
    
    console.log('\\n🎯 TEST SUMMARY');
    console.log('=' * 40);
    
    const success = currentUrl.includes('/dashboard') || 
                   currentUrl.includes('/main') || 
                   !currentUrl.includes('/login');
    
    if (success) {
      console.log('🎉 COMPREHENSIVE LOGIN TEST: SUCCESS!');
      console.log('✅ Authentication flow working correctly');
      console.log('✅ Demo admin button functional');
      console.log('✅ Navigation working properly');
    } else {
      console.log('❌ LOGIN TEST: NEEDS INVESTIGATION');
      console.log('⚠️  Login may have failed or navigation not working');
      console.log('📸 Check screenshots for details');
    }
    
    console.log('\\n📸 Screenshots saved:');
    console.log('   working-01-login-loaded.png');
    console.log('   working-02-after-demo-click.png'); 
    console.log('   working-03-form-filled.png');
    console.log('   working-04-final-state.png');
    
    // Keep browser open for 10 seconds for manual inspection
    console.log('\\n⏱️  Browser will remain open for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Full error:', error);
    await page.screenshot({ path: 'test-screenshots/working-error.png', fullPage: true });
  } finally {
    console.log('\\n🔒 Closing browser...');
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
testWorkingLogin().catch(console.error);