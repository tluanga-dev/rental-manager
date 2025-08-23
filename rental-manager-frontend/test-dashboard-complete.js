const puppeteer = require('puppeteer');
const fs = require('fs');

async function testDashboardComplete() {
  console.log('🎭 Complete Dashboard Navigation Test');
  console.log('=' * 60);

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  // Track API responses
  const apiResponses = [];
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/')) {
      apiResponses.push({
        url,
        status,
        timestamp: new Date().toISOString(),
        isAnalytics: url.includes('/analytics/')
      });
      
      // Log analytics API calls with status
      if (url.includes('/analytics/')) {
        const statusIcon = status >= 200 && status < 300 ? '✅' : '❌';
        console.log(`📊 ${statusIcon} Analytics API: ${status} ${url}`);
      }
    }
  });

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    console.log('\n📍 STEP 1: Authentication Test');
    console.log('─' * 30);
    
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2', 
      timeout: 20000 
    });
    
    console.log('✅ Login page loaded');
    await page.screenshot({ 
      path: 'test-screenshots/01-login-page.png', 
      fullPage: true 
    });
    
    // Find and click demo admin button
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
    
    console.log('✅ Demo Admin button located');
    await demoButton.click();
    console.log('🔄 Demo login initiated...');
    
    // Wait for navigation with multiple strategies
    let navigationSuccess = false;
    try {
      await page.waitForNavigation({ 
        waitUntil: 'networkidle2', 
        timeout: 15000 
      });
      navigationSuccess = true;
    } catch (e) {
      console.log('⚠️  Direct navigation timeout, checking URL...');
      // Sometimes navigation is instant, check URL manually
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    if (!currentUrl.includes('/dashboard/main')) {
      throw new Error(`Login failed - Expected /dashboard/main, got ${currentUrl}`);
    }
    
    console.log('🎉 Authentication successful!');
    
    console.log('\n📍 STEP 2: Layout & Sidebar Test');
    console.log('─' * 30);
    
    // Wait for dashboard to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await page.screenshot({ 
      path: 'test-screenshots/02-dashboard-loaded.png', 
      fullPage: true 
    });
    
    // Check page structure
    const pageStructure = await page.evaluate(() => {
      const structure = {};
      
      // Check for layout elements
      structure.hasSidebar = !!document.querySelector('nav, aside, [role="navigation"]');
      structure.hasTopbar = !!document.querySelector('header, .topbar, [role="banner"]');
      structure.hasMainContent = !!document.querySelector('main, .main-content, [role="main"]');
      
      // Check sidebar visibility
      const sidebar = document.querySelector('nav, aside');
      if (sidebar) {
        const rect = sidebar.getBoundingClientRect();
        const style = window.getComputedStyle(sidebar);
        structure.sidebarVisible = (
          style.display !== 'none' && 
          style.visibility !== 'hidden' && 
          rect.width > 0 && 
          rect.height > 0
        );
        structure.sidebarWidth = rect.width;
        structure.sidebarHeight = rect.height;
      }
      
      // Count navigation links
      const navLinks = document.querySelectorAll('a[href]');
      structure.totalLinks = navLinks.length;
      structure.dashboardLinks = Array.from(navLinks)
        .filter(link => {
          const href = link.getAttribute('href');
          return href && (
            href.includes('/dashboard') || 
            href.includes('/customers') || 
            href.includes('/rentals') ||
            href.includes('/inventory') ||
            href.includes('/sales') ||
            href.includes('/purchases')
          );
        })
        .map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent.trim()
        }));
      
      return structure;
    });
    
    console.log('🏗️  Page Structure Analysis:');
    console.log(`   Sidebar Present: ${pageStructure.hasSidebar ? '✅' : '❌'}`);
    console.log(`   Sidebar Visible: ${pageStructure.sidebarVisible ? '✅' : '❌'}`);
    console.log(`   Topbar Present: ${pageStructure.hasTopbar ? '✅' : '❌'}`);
    console.log(`   Main Content: ${pageStructure.hasMainContent ? '✅' : '❌'}`);
    console.log(`   Total Links: ${pageStructure.totalLinks}`);
    console.log(`   Navigation Links: ${pageStructure.dashboardLinks.length}`);
    
    if (pageStructure.sidebarVisible && pageStructure.sidebarWidth) {
      console.log(`   Sidebar Dimensions: ${Math.round(pageStructure.sidebarWidth)}x${Math.round(pageStructure.sidebarHeight)}px`);
    }
    
    if (pageStructure.dashboardLinks.length > 0) {
      console.log('🔗 Navigation Links Found:');
      pageStructure.dashboardLinks.slice(0, 8).forEach((link, i) => {
        console.log(`   ${i + 1}. ${link.text} → ${link.href}`);
      });
      if (pageStructure.dashboardLinks.length > 8) {
        console.log(`   ... and ${pageStructure.dashboardLinks.length - 8} more`);
      }
    }
    
    console.log('\n📍 STEP 3: API Integration Test');
    console.log('─' * 30);
    
    // Wait longer for all API calls to complete
    console.log('⏳ Waiting for API calls to complete...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Analyze API responses
    const analyticsResponses = apiResponses.filter(r => r.isAnalytics);
    const uniqueEndpoints = [...new Set(analyticsResponses.map(r => {
      try {
        const url = new URL(r.url);
        return url.pathname.replace('/api', '');
      } catch (e) {
        return r.url;
      }
    }))];
    
    console.log(`📊 Analytics API Summary:`);
    console.log(`   Total API Calls: ${apiResponses.length}`);
    console.log(`   Analytics Calls: ${analyticsResponses.length}`);
    console.log(`   Unique Endpoints: ${uniqueEndpoints.length}`);
    
    // Analyze success/failure patterns
    const successfulCalls = analyticsResponses.filter(r => r.status >= 200 && r.status < 300);
    const failedCalls = analyticsResponses.filter(r => r.status >= 400);
    
    console.log(`   Successful: ${successfulCalls.length} (${Math.round(successfulCalls.length / analyticsResponses.length * 100)}%)`);
    console.log(`   Failed: ${failedCalls.length} (${Math.round(failedCalls.length / analyticsResponses.length * 100)}%)`);
    
    if (uniqueEndpoints.length > 0) {
      console.log('\n📈 Endpoint Status:');
      uniqueEndpoints.forEach(endpoint => {
        const calls = analyticsResponses.filter(r => r.url.includes(endpoint));
        const successful = calls.filter(r => r.status >= 200 && r.status < 300).length;
        const failed = calls.filter(r => r.status >= 400).length;
        const statusIcon = successful > failed ? '✅' : failed > successful ? '❌' : '⚠️';
        console.log(`   ${statusIcon} ${endpoint}: ${successful}✅ ${failed}❌`);
      });
    }
    
    console.log('\n📍 STEP 4: Dashboard Functionality Test');
    console.log('─' * 30);
    
    const functionalityTests = [];
    
    // Test 1: Dashboard cards/metrics
    const dashboardCards = await page.$$('.card, [data-testid*="card"], [data-testid*="metric"]');
    functionalityTests.push({
      test: 'Dashboard Cards',
      result: dashboardCards.length > 0,
      detail: `${dashboardCards.length} cards found`
    });
    
    // Test 2: Interactive elements
    const interactiveButtonElements = await page.$$('button');
    const interactiveButtons = [];
    for (const button of interactiveButtonElements) {
      try {
        const text = await page.evaluate(el => el.textContent.trim(), button);
        const isDisabled = await page.evaluate(el => el.disabled, button);
        if (text && !isDisabled && (
          text.toLowerCase().includes('refresh') ||
          text.toLowerCase().includes('export') ||
          text.toLowerCase().includes('filter')
        )) {
          interactiveButtons.push(text);
        }
      } catch (e) {
        continue;
      }
    }
    
    functionalityTests.push({
      test: 'Interactive Buttons',
      result: interactiveButtons.length > 0,
      detail: `${interactiveButtons.length} actionable buttons: ${interactiveButtons.slice(0, 3).join(', ')}`
    });
    
    // Test 3: Data visualization elements
    const charts = await page.$$('canvas, svg, .chart, [data-testid*="chart"]');
    functionalityTests.push({
      test: 'Charts/Visualizations',
      result: charts.length > 0,
      detail: `${charts.length} visualization elements found`
    });
    
    // Test 4: Tabs or navigation within dashboard
    const tabs = await page.$$('[role="tab"], .tab, [data-testid*="tab"]');
    functionalityTests.push({
      test: 'Dashboard Tabs',
      result: tabs.length > 0,
      detail: `${tabs.length} tabs found`
    });
    
    console.log('🔧 Functionality Tests:');
    functionalityTests.forEach(test => {
      const icon = test.result ? '✅' : '❌';
      console.log(`   ${icon} ${test.test}: ${test.detail}`);
    });
    
    // Test tab interaction if tabs exist
    if (tabs.length > 1) {
      try {
        console.log('🎯 Testing tab interaction...');
        await tabs[1].click(); // Click second tab
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('✅ Tab interaction successful');
      } catch (e) {
        console.log('⚠️  Tab interaction failed:', e.message);
      }
    }
    
    await page.screenshot({ 
      path: 'test-screenshots/03-dashboard-final.png', 
      fullPage: true 
    });
    
    console.log('\n📍 STEP 5: Error Analysis');
    console.log('─' * 30);
    
    console.log(`🚨 Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('   Recent errors:');
      consoleErrors.slice(-5).forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.substring(0, 100)}...`);
      });
    } else {
      console.log('✅ No console errors detected');
    }
    
    console.log('\n🎯 COMPREHENSIVE TEST RESULTS');
    console.log('=' * 50);
    
    const overallResults = {
      authentication: currentUrl.includes('/dashboard/main'),
      sidebarVisible: pageStructure.sidebarVisible,
      navigationLinks: pageStructure.dashboardLinks.length > 0,
      apiCalls: analyticsResponses.length > 0,
      apiSuccess: successfulCalls.length > 0,
      dashboardFunctionality: functionalityTests.filter(t => t.result).length >= 2,
      lowErrorCount: consoleErrors.length < 5
    };
    
    const passedTests = Object.values(overallResults).filter(result => result).length;
    const totalTests = Object.keys(overallResults).length;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    console.log(`📊 Success Rate: ${passedTests}/${totalTests} (${successRate}%)\n`);
    
    console.log('📋 Detailed Results:');
    console.log(`${overallResults.authentication ? '✅' : '❌'} Authentication: ${overallResults.authentication ? 'Successfully logged in' : 'Login failed'}`);
    console.log(`${overallResults.sidebarVisible ? '✅' : '❌'} Sidebar Visibility: ${overallResults.sidebarVisible ? 'Sidebar is visible' : 'Sidebar not visible'}`);
    console.log(`${overallResults.navigationLinks ? '✅' : '❌'} Navigation Links: ${pageStructure.dashboardLinks.length} links found`);
    console.log(`${overallResults.apiCalls ? '✅' : '❌'} API Integration: ${analyticsResponses.length} analytics calls made`);
    console.log(`${overallResults.apiSuccess ? '✅' : '❌'} API Success: ${successfulCalls.length} successful responses`);
    console.log(`${overallResults.dashboardFunctionality ? '✅' : '❌'} Dashboard Functionality: ${functionalityTests.filter(t => t.result).length} features working`);
    console.log(`${overallResults.lowErrorCount ? '✅' : '❌'} Error Rate: ${consoleErrors.length} console errors`);
    
    if (successRate >= 85) {
      console.log('\n🎉 EXCELLENT! Dashboard is fully functional');
      console.log('✨ All major components are working correctly');
    } else if (successRate >= 70) {
      console.log('\n✅ GOOD! Dashboard is mostly functional');
      console.log('🔧 Minor issues detected but core functionality works');
    } else {
      console.log('\n⚠️  NEEDS ATTENTION! Several issues detected');
      console.log('🛠️  Review the failed tests and fix underlying issues');
    }
    
    console.log('\n📸 Screenshots captured:');
    console.log('   📷 01-login-page.png - Initial login page');
    console.log('   📷 02-dashboard-loaded.png - Dashboard after login');
    console.log('   📷 03-dashboard-final.png - Final state with interactions');
    
    // Keep browser open for manual verification
    console.log('\n⏱️  Browser will remain open for 15 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error('Stack trace:', error.stack);
    await page.screenshot({ 
      path: 'test-screenshots/error-state.png', 
      fullPage: true 
    });
    console.log('📸 Error screenshot saved: error-state.png');
  } finally {
    await browser.close();
    console.log('\n✅ Test execution completed');
  }
}

// Ensure screenshots directory exists
const screenshotDir = 'test-screenshots';
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  console.log(`📁 Created ${screenshotDir} directory`);
}

testDashboardComplete().catch(console.error);