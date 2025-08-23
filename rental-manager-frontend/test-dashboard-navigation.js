const puppeteer = require('puppeteer');

async function testDashboardNavigation() {
  console.log('🧭 Testing Dashboard Navigation Flow');
  console.log('=' * 50);

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    defaultViewport: { width: 1280, height: 720 }
  });
  
  const page = await browser.newPage();
  
  // Track API calls
  const apiCalls = [];
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/')) {
      apiCalls.push({ url, status, timestamp: new Date().toISOString() });
      if (url.includes('/analytics/')) {
        console.log(`📊 Analytics API: ${status} ${url}`);
      }
    }
  });

  try {
    console.log('\n📍 Step 1: Login to Application');
    await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle2', timeout: 15000 });
    
    // Find and click Demo Admin button
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
    
    if (demoButton) {
      console.log('✅ Demo Admin button found');
      await demoButton.click();
      console.log('🔄 Clicked Demo Admin button');
      
      // Wait for navigation
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        console.log('✅ Navigation completed');
      } catch (e) {
        console.log('⚠️  Navigation timeout, checking URL...');
      }
      
      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);
      
      if (!currentUrl.includes('/dashboard')) {
        throw new Error('Login failed - not redirected to dashboard');
      }
      
      console.log('🎉 Login successful!');
      
    } else {
      throw new Error('Demo Admin button not found');
    }
    
    console.log('\n📍 Step 2: Check Sidebar Visibility');
    
    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await page.screenshot({ path: 'test-screenshots/dashboard-loaded.png', fullPage: true });
    
    // Check for sidebar elements
    const sidebarSelectors = [
      'nav', // Generic sidebar navigation
      '[role="navigation"]', // ARIA navigation role
      'aside', // Sidebar semantic element
      '.sidebar', // Common sidebar class
      '[data-testid*="sidebar"]', // Test ID containing sidebar
    ];
    
    let sidebarFound = false;
    let sidebarElement = null;
    
    for (const selector of sidebarSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          // Check if element is visible (not hidden)
          const isVisible = await page.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0' &&
                   el.offsetWidth > 0 && 
                   el.offsetHeight > 0;
          }, element);
          
          if (isVisible) {
            console.log(`✅ Sidebar found with selector: ${selector}`);
            sidebarFound = true;
            sidebarElement = element;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    if (sidebarFound && sidebarElement) {
      // Check for navigation links
      const navLinks = await page.$$('a[href*="/"]');
      let dashboardLinks = [];
      
      for (const link of navLinks) {
        try {
          const href = await page.evaluate(el => el.getAttribute('href'), link);
          const text = await page.evaluate(el => el.textContent.trim(), link);
          if (href && (href.includes('/dashboard') || href.includes('/customers') || href.includes('/rentals'))) {
            dashboardLinks.push({ href, text });
          }
        } catch (e) {
          continue;
        }
      }
      
      if (dashboardLinks.length > 0) {
        console.log(`✅ Navigation links found: ${dashboardLinks.length} links`);
        dashboardLinks.slice(0, 5).forEach(link => {
          console.log(`   📎 ${link.text} → ${link.href}`);
        });
      } else {
        console.log('⚠️  No navigation links found in sidebar');
      }
      
    } else {
      console.log('❌ Sidebar not visible or not found');
    }
    
    console.log('\n📍 Step 3: Check Dashboard API Calls');
    
    // Wait a bit more for any async API calls to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check analytics API calls
    const analyticsAPICalls = apiCalls.filter(call => call.url.includes('/analytics/'));
    
    if (analyticsAPICalls.length > 0) {
      console.log(`✅ Analytics API calls detected: ${analyticsAPICalls.length} calls`);
      
      const successfulCalls = analyticsAPICalls.filter(call => call.status >= 200 && call.status < 300);
      const errorCalls = analyticsAPICalls.filter(call => call.status >= 400);
      
      console.log(`   📈 Successful calls: ${successfulCalls.length}`);
      console.log(`   ❌ Error calls: ${errorCalls.length}`);
      
      // Show specific endpoints
      const endpoints = [...new Set(analyticsAPICalls.map(call => {
        const url = new URL(call.url);
        return url.pathname;
      }))];
      
      console.log('   📊 Endpoints called:');
      endpoints.forEach(endpoint => {
        const calls = analyticsAPICalls.filter(call => call.url.includes(endpoint));
        const statuses = calls.map(call => call.status);
        console.log(`      ${endpoint}: ${statuses.join(', ')}`);
      });
      
    } else {
      console.log('⚠️  No analytics API calls detected');
    }
    
    console.log('\n📍 Step 4: Test Dashboard Interactivity');
    
    // Try to interact with dashboard elements
    const interactionTests = [];
    
    // Test tabs if they exist
    const tabs = await page.$$('[role="tab"], .tab, [data-testid*="tab"]');
    if (tabs.length > 0) {
      try {
        await tabs[0].click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        interactionTests.push({ test: 'Tab clicking', result: 'success' });
      } catch (e) {
        interactionTests.push({ test: 'Tab clicking', result: 'failed', error: e.message });
      }
    }
    
    // Test refresh button if it exists
    const refreshButtons = await page.$$('button[title*="refresh"], button:has-text("Refresh")');
    if (refreshButtons.length > 0) {
      try {
        await refreshButtons[0].click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        interactionTests.push({ test: 'Refresh button', result: 'success' });
      } catch (e) {
        interactionTests.push({ test: 'Refresh button', result: 'failed', error: e.message });
      }
    }
    
    if (interactionTests.length > 0) {
      console.log('🔧 Dashboard Interaction Tests:');
      interactionTests.forEach(test => {
        const status = test.result === 'success' ? '✅' : '❌';
        console.log(`   ${status} ${test.test}: ${test.result}`);
        if (test.error) {
          console.log(`      Error: ${test.error}`);
        }
      });
    }
    
    await page.screenshot({ path: 'test-screenshots/dashboard-final.png', fullPage: true });
    
    console.log('\n🎯 DASHBOARD TEST SUMMARY');
    console.log('=' * 30);
    
    const results = {
      login: currentUrl.includes('/dashboard'),
      sidebar: sidebarFound,
      analytics: analyticsAPICalls.length > 0,
      api_success: analyticsAPICalls.some(call => call.status >= 200 && call.status < 300)
    };
    
    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED!');
      console.log('✅ Login: Working');
      console.log('✅ Sidebar: Visible');  
      console.log('✅ Analytics API: Responding');
      console.log('✅ Dashboard: Functional');
    } else {
      console.log('⚠️  SOME ISSUES DETECTED:');
      console.log(`${results.login ? '✅' : '❌'} Login: ${results.login ? 'Working' : 'Failed'}`);
      console.log(`${results.sidebar ? '✅' : '❌'} Sidebar: ${results.sidebar ? 'Visible' : 'Not Found'}`);
      console.log(`${results.analytics ? '✅' : '❌'} Analytics API: ${results.analytics ? 'Called' : 'No Calls'}`);
      console.log(`${results.api_success ? '✅' : '❌'} API Success: ${results.api_success ? 'Working' : 'Errors'}`);
    }
    
    console.log('\n📸 Screenshots saved:');
    console.log('   dashboard-loaded.png');
    console.log('   dashboard-final.png');
    
    // Keep browser open for manual inspection
    console.log('\n⏱️  Browser will remain open for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-screenshots/dashboard-error.png', fullPage: true });
  } finally {
    await browser.close();
    console.log('✅ Test completed');
  }
}

testDashboardNavigation().catch(console.error);