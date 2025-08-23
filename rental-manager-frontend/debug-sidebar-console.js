const puppeteer = require('puppeteer');

async function debugSidebarConsole() {
  console.log('🔍 Debug Sidebar Console Output');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  // Capture console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({
      type: msg.type(),
      text: text,
      timestamp: new Date().toISOString()
    });
    
    // Log menu-related messages immediately
    if (text.includes('Menu item') || text.includes('permission') || text.includes('filtered out')) {
      console.log(`[${msg.type().toUpperCase()}] ${text}`);
    }
  });

  try {
    console.log('📍 Loading login page...');
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2', 
      timeout: 20000 
    });
    
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
    
    if (!demoButton) {
      throw new Error('Demo Admin button not found');
    }
    
    await demoButton.click();
    
    // Wait for navigation
    try {
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2', 
        timeout: 15000 
      });
    } catch (e) {
      // Sometimes navigation is instant
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Wait a bit longer for all logs to appear
    console.log('⏳ Waiting for console logs...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n📊 Console Analysis:');
    console.log(`Total console messages: ${consoleMessages.length}`);
    
    // Filter menu-related messages
    const menuMessages = consoleMessages.filter(msg => 
      msg.text.includes('Menu item') || 
      msg.text.includes('permission') || 
      msg.text.includes('filtered out') ||
      msg.text.includes('hasPermission') ||
      msg.text.includes('userType')
    );
    
    if (menuMessages.length > 0) {
      console.log('\n🔍 Menu-related console messages:');
      menuMessages.forEach((msg, i) => {
        console.log(`${i + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
      });
    } else {
      console.log('\n⚠️  No menu-related debug messages found');
    }
    
    // Check if debug mode is actually enabled
    const isDev = await page.evaluate(() => process.env.NODE_ENV === 'development');
    console.log(`\n🔧 NODE_ENV === 'development': ${isDev}`);
    
    // Force debug by evaluating in browser context
    console.log('\n🔍 Checking user and auth state in browser:');
    const authState = await page.evaluate(() => {
      // Access auth store state
      try {
        const authStore = window.zustandStores?.authStore || window.__zustand_auth_store__;
        if (!authStore) {
          return { error: 'Auth store not found in window object' };
        }
        
        const state = authStore.getState();
        return {
          hasUser: !!state.user,
          userType: state.user?.userType,
          isSuperuser: state.user?.isSuperuser,
          permissions: state.permissions,
          isAuthenticated: state.isAuthenticated
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('Auth State:', authState);
    
    // Keep browser open longer for manual inspection
    console.log('\n⏱️  Browser will remain open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    await page.screenshot({ 
      path: 'debug-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
    console.log('✅ Debug completed');
  }
}

debugSidebarConsole().catch(console.error);