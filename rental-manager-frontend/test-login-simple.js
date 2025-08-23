const puppeteer = require('puppeteer');

async function testLogin() {
  console.log('🎭 Testing Login Flow with Puppeteer');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    defaultViewport: { width: 1280, height: 720 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('📍 1. Navigating to login page...');
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    console.log('✅ Login page loaded');
    await page.screenshot({ path: 'test-screenshots/login-page.png' });
    
    console.log('📍 2. Looking for demo admin button...');
    
    // Wait for page to load completely
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to find the demo admin button with different selectors
    const selectors = [
      'button:contains("Demo as Administrator")',
      'button[onclick*="admin"]',
      'button:has-text("Demo as Administrator")',
      'button',  // fallback to any button
    ];
    
    let demoButton = null;
    for (const selector of selectors) {
      try {
        if (selector === 'button:contains("Demo as Administrator")') {
          // Use XPath for contains text
          const [button] = await page.$x('//button[contains(text(), "Demo as Administrator")]');
          if (button) {
            demoButton = button;
            console.log('✅ Found demo button with XPath');
            break;
          }
        } else if (selector === 'button:has-text("Demo as Administrator")') {
          // Skip this one as it's Playwright syntax, not Puppeteer
          continue;
        } else {
          const button = await page.$(selector);
          if (button) {
            // Check if it's the right button by getting its text
            const text = await page.evaluate(el => el.textContent, button);
            if (text.includes('Demo as Administrator') || text.includes('Admin')) {
              demoButton = button;
              console.log(`✅ Found demo button with selector: ${selector}, text: "${text}"`);
              break;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!demoButton) {
      console.log('⚠️  Could not find demo admin button, trying manual login...');
      
      // Manual login approach
      console.log('📍 3. Filling login form manually...');
      
      await page.type('input[name="username"], input[type="text"]', 'admin');
      console.log('✅ Typed username');
      
      await page.type('input[name="password"], input[type="password"]', 'admin123');  
      console.log('✅ Typed password');
      
      await page.screenshot({ path: 'test-screenshots/form-filled.png' });
      
      // Click submit button
      const submitButton = await page.$('button[type="submit"]');
      if (submitButton) {
        console.log('🔄 Clicking submit button...');
        await submitButton.click();
      }
      
    } else {
      console.log('📍 3. Clicking demo admin button...');
      await demoButton.click();
    }
    
    console.log('⏳ Waiting for login to complete...');
    
    // Wait for navigation or URL change
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    await page.screenshot({ path: 'test-screenshots/after-login.png' });
    
    // Check for success indicators
    const success = !currentUrl.includes('/login') || 
                   currentUrl.includes('/dashboard') || 
                   currentUrl.includes('/main');
    
    if (success) {
      console.log('🎉 LOGIN SUCCESS!');
      console.log('✅ User successfully authenticated');
    } else {
      console.log('❌ Login may have failed');
      console.log('⚠️  Still on login page or no navigation detected');
    }
    
    // Keep browser open for inspection
    console.log('⏱️  Browser staying open for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: 'test-screenshots/error.png' });
  } finally {
    await browser.close();
    console.log('✅ Test completed');
  }
}

testLogin();