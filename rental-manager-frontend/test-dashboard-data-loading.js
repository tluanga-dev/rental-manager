const puppeteer = require('puppeteer');

async function testDashboardDataLoading() {
  console.log('🎭 Dashboard Data Loading Test');
  console.log('=' * 50);

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  // Track API calls
  const apiCalls = [];
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/')) {
      apiCalls.push({
        url,
        status,
        timestamp: new Date().toISOString(),
        success: status >= 200 && status < 300,
        isAnalytics: url.includes('/analytics/')
      });
      
      if (url.includes('/analytics/')) {
        const statusIcon = status >= 200 && status < 300 ? '✅' : '❌';
        const endpoint = url.split('/').slice(-2).join('/').split('?')[0];
        console.log(`📊 ${statusIcon} Analytics: ${status} ${endpoint}`);
      }
    }
  });

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  try {
    console.log('📍 STEP 1: Loading and Authentication');
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2', 
      timeout: 20000 
    });
    
    console.log('✅ Login page loaded');
    
    // Find and click demo admin
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
    console.log('🔄 Demo login initiated...');
    
    // Wait for navigation
    let navigationSuccess = false;
    try {
      await page.waitForNavigation({ 
        waitUntil: 'networkidle0', 
        timeout: 15000 
      });
      navigationSuccess = true;
    } catch (e) {
      console.log('⚠️  Navigation timeout, checking URL manually...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    if (!currentUrl.includes('/dashboard')) {
      throw new Error(`Login failed - not on dashboard. Current URL: ${currentUrl}`);
    }
    
    console.log('🎉 Authentication successful!');
    
    console.log('\n📍 STEP 2: Dashboard Data Loading Analysis');
    
    // Wait for dashboard to load completely
    console.log('⏳ Waiting for dashboard data to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check for error messages
    const errorMessages = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('.text-red-600, .text-red-500, .border-red-200, .bg-red-50');
      const messages = [];
      errorElements.forEach(el => {
        const text = el.textContent.trim();
        if (text.includes('Failed to load') || text.includes('error') || text.includes('Error')) {
          messages.push(text);
        }
      });
      return messages;
    });
    
    // Check for loading states
    const loadingStates = await page.evaluate(() => {
      return {
        loadingSpinners: document.querySelectorAll('.animate-spin, .loading').length,
        skeletonLoaders: document.querySelectorAll('.animate-pulse').length
      };
    });
    
    // Check for actual data content
    const dataElements = await page.evaluate(() => {
      return {
        metricCards: document.querySelectorAll('.card, [data-testid*="card"], [data-testid*="metric"]').length,
        charts: document.querySelectorAll('canvas, svg, .chart').length,
        dataRows: document.querySelectorAll('tbody tr, .data-row').length,
        hasNumbers: !!document.querySelector('body').textContent.match(/[\$€£¥]\s*[\d,]+|[\d,]+\s*%|\d{1,3}(,\d{3})*(\.\d+)?/),
      };
    });
    
    console.log('\n📊 Dashboard Analysis Results:');
    console.log(`   Error Messages: ${errorMessages.length}`);
    if (errorMessages.length > 0) {
      errorMessages.forEach((msg, i) => console.log(`     ${i + 1}. ${msg}`));
    }
    
    console.log(`   Loading Spinners: ${loadingStates.loadingSpinners}`);
    console.log(`   Skeleton Loaders: ${loadingStates.skeletonLoaders}`);
    console.log(`   Metric Cards: ${dataElements.metricCards}`);
    console.log(`   Charts/Visualizations: ${dataElements.charts}`);
    console.log(`   Data Rows: ${dataElements.dataRows}`);
    console.log(`   Has Numeric Data: ${dataElements.hasNumbers ? '✅' : '❌'}`);
    
    // API Call Analysis
    const analyticsAPIs = apiCalls.filter(call => call.isAnalytics);
    const successfulAPIs = analyticsAPIs.filter(call => call.success);
    const failedAPIs = analyticsAPIs.filter(call => !call.success);
    
    console.log('\n📡 API Call Analysis:');
    console.log(`   Total Analytics Calls: ${analyticsAPIs.length}`);
    console.log(`   Successful: ${successfulAPIs.length} (${Math.round(successfulAPIs.length / analyticsAPIs.length * 100)}%)`);
    console.log(`   Failed: ${failedAPIs.length} (${Math.round(failedAPIs.length / analyticsAPIs.length * 100)}%)`);
    
    if (failedAPIs.length > 0) {
      console.log('   Failed endpoints:');
      failedAPIs.forEach(call => {
        const endpoint = call.url.split('/').slice(-2).join('/').split('?')[0];
        console.log(`     ❌ ${call.status} ${endpoint}`);
      });
    }
    
    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'dashboard-data-loading-test.png', 
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved: dashboard-data-loading-test.png');
    
    // Overall assessment
    console.log('\n🎯 OVERALL ASSESSMENT:');
    const hasDataLoadingErrors = errorMessages.some(msg => msg.toLowerCase().includes('failed to load'));
    const hasSuccessfulAPIs = successfulAPIs.length > 0;
    const hasVisualData = dataElements.metricCards > 0 || dataElements.charts > 0 || dataElements.hasNumbers;
    
    if (hasDataLoadingErrors) {
      console.log('❌ FAILED: Dashboard shows "Failed to load" error messages');
    } else if (successfulAPIs.length === 0) {
      console.log('❌ FAILED: No successful analytics API calls detected');
    } else if (successfulAPIs.length < analyticsAPIs.length / 2) {
      console.log('⚠️  PARTIAL: Some API calls failing, dashboard partially functional');
    } else if (hasVisualData) {
      console.log('✅ SUCCESS: Dashboard data loading is working properly!');
      console.log('   - No "Failed to load" error messages detected');
      console.log(`   - ${successfulAPIs.length} analytics endpoints responding successfully`);
      console.log('   - Dashboard displaying data content');
    } else {
      console.log('⚠️  UNCLEAR: APIs working but dashboard may still be loading');
    }
    
    // Keep browser open for manual inspection
    console.log('\n⏱️  Browser remaining open for 15 seconds for visual inspection...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    await page.screenshot({ 
      path: 'dashboard-test-error.png', 
      fullPage: true 
    });
    console.log('📸 Error screenshot saved: dashboard-test-error.png');
  } finally {
    await browser.close();
    console.log('\n✅ Dashboard data loading test completed');
  }
}

testDashboardDataLoading().catch(console.error);