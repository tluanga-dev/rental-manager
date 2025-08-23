const puppeteer = require('puppeteer');

async function testLoginWithDocker() {
  console.log('🧪 Testing Login with Docker Compose Setup');
  
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 200,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Enable console logging from the page
  page.on('console', msg => {
    console.log('🖥️ Browser Console:', msg.type().toUpperCase(), '-', msg.text());
  });
  
  // Enable request logging
  page.on('request', request => {
    console.log('📤 REQUEST:', request.method(), request.url());
  });
  
  // Enable response logging
  page.on('response', response => {
    console.log('📥 RESPONSE:', response.status(), response.url());
  });
  
  try {
    console.log('🌐 Navigating to Docker frontend (port 3001)...');
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for loading to complete
    try {
      await page.waitForSelector('.animate-spin', { timeout: 3000 });
      console.log('⏳ Waiting for loading to complete...');
      await page.waitForSelector('.animate-spin', { hidden: true, timeout: 15000 });
    } catch (e) {
      console.log('✅ Page loaded without loading spinner');
    }
    
    // Wait for form
    await page.waitForSelector('form', { timeout: 10000 });
    console.log('✅ Login form found');
    
    // Check what demo buttons are available
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent?.trim(),
        visible: btn.offsetParent !== null,
        disabled: btn.disabled
      }));
    });
    console.log('🔍 Available buttons:', buttons);
    
    // Click demo admin button
    console.log('🖱️ Clicking Demo as Administrator...');
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
    
    if (!buttonClicked) {
      throw new Error('Could not find Demo as Administrator button');
    }
    
    console.log('✅ Button clicked successfully');
    
    // Wait longer and monitor what happens
    console.log('⏳ Waiting 10 seconds to monitor API calls and responses...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const currentUrl = page.url();
    console.log('📍 Final URL:', currentUrl);
    
    // Check for any error messages on the page
    const pageText = await page.evaluate(() => document.body.textContent);
    if (pageText.includes('error') || pageText.includes('Error') || pageText.includes('failed') || pageText.includes('Failed')) {
      console.log('⚠️ Possible error text found on page');
      
      // Look for specific error elements
      const errorElements = await page.$$('[role="alert"], .alert-error, .error, .text-red-500, .text-red-600');
      for (let i = 0; i < errorElements.length; i++) {
        const errorText = await page.evaluate(el => el.textContent, errorElements[i]);
        if (errorText && errorText.trim()) {
          console.log(`❌ Error ${i + 1}:`, errorText.trim());
        }
      }
    }
    
    // Check localStorage for tokens
    const authData = await page.evaluate(() => {
      const keys = ['auth-token', 'access_token', 'token', 'auth-storage'];
      const result = {};
      keys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          result[key] = value.length > 50 ? value.substring(0, 50) + '...' : value;
        }
      });
      return result;
    });
    
    console.log('🔑 Auth data in localStorage:', authData);
    
    // Take a screenshot
    try {
      await page.screenshot({ 
        path: 'login-docker-test-result.png',
        fullPage: false
      });
      console.log('📸 Screenshot saved: login-docker-test-result.png');
    } catch (e) {
      console.log('⚠️ Screenshot failed:', e.message);
    }
    
    console.log('');
    console.log('🎯 DOCKER LOGIN TEST RESULTS:');
    console.log('='.repeat(35));
    
    if (currentUrl.includes('/dashboard')) {
      console.log('🎉 SUCCESS: Navigated to dashboard!');
    } else if (currentUrl.includes('/login')) {
      console.log('⚠️ Still on login page - check API connectivity');
      console.log('💡 This suggests the backend API call may have failed');
    } else {
      console.log('🤔 Unexpected URL:', currentUrl);
    }
    
    if (Object.keys(authData).length > 0) {
      console.log('✅ Auth tokens found in localStorage');
    } else {
      console.log('❌ No auth tokens found - login likely failed');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    console.log('\\n⏸️ Browser will stay open for 5 more seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close();
  }
}

testLoginWithDocker().catch(console.error);