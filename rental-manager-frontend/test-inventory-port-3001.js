const puppeteer = require('puppeteer');

/**
 * Quick test of inventory page on port 3001 with authentication bypass
 */

async function testInventoryPage() {
  console.log('🧪 Testing inventory page on port 3001 with auth bypass...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 }
  });
  
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', (msg) => {
    console.log('📱 PAGE:', msg.text());
  });
  
  // Enable API response logging
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('inventory')) {
      console.log(`🌐 API: ${response.status()} ${url}`);
    }
  });
  
  try {
    // Navigate to inventory page on port 3001
    console.log('🔍 Navigating to http://localhost:3001/inventory...');
    await page.goto('http://localhost:3001/inventory', { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Wait a bit for the page to settle
    await page.waitForTimeout(3000);
    
    // Check page state
    const pageState = await page.evaluate(() => {
      const hasInventoryTitle = document.body.textContent.includes('Item Inventory');
      const hasAuthGuard = document.body.textContent.includes('Checking authentication') ||
                          document.body.textContent.includes('Authentication required');
      const hasLoginRedirect = document.body.textContent.includes('Login');
      const hasTableData = document.querySelectorAll('tr').length > 1;
      const hasNoDataMessage = document.body.textContent.includes('No data') ||
                               document.body.textContent.includes('No items found');
      const hasErrorMessage = document.body.textContent.includes('Error') ||
                              document.body.textContent.includes('Failed');
      
      return {
        hasInventoryTitle,
        hasAuthGuard,
        hasLoginRedirect,
        hasTableData,
        hasNoDataMessage,
        hasErrorMessage,
        tableRows: document.querySelectorAll('tr').length,
        currentUrl: window.location.href,
        pageText: document.body.textContent.substring(0, 500)
      };
    });
    
    console.log('📊 Page State:', pageState);
    
    // Test API endpoint directly
    console.log('\n🔌 Testing API endpoint...');
    const apiResult = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/inventory/stocks');
        const data = await response.json();
        return {
          status: response.status,
          ok: response.ok,
          dataType: Array.isArray(data) ? 'array' : typeof data,
          hasData: Array.isArray(data) ? data.length > 0 : !!(data?.data && data.data.length > 0),
          dataLength: Array.isArray(data) ? data.length : (data?.data ? data.data.length : 0)
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('📊 API Result:', apiResult);
    
    // Take screenshot
    await page.screenshot({ path: 'inventory-page-port-3001.png', fullPage: true });
    console.log('📸 Screenshot saved as inventory-page-port-3001.png');
    
    // Summary
    console.log('\n🏆 RESULTS:');
    
    if (pageState.hasInventoryTitle && !pageState.hasAuthGuard && !pageState.hasLoginRedirect) {
      console.log('✅ Authentication bypass working - inventory page loaded');
      
      if (pageState.hasTableData) {
        console.log(`✅ Data displayed - ${pageState.tableRows} table rows found`);
      } else if (pageState.hasNoDataMessage && !pageState.hasErrorMessage) {
        console.log('⚠️ No data found (database may be empty)');
      } else if (pageState.hasErrorMessage) {
        console.log('❌ Error loading data');
      } else {
        console.log('⚠️ Page loaded but data state unclear');
      }
      
      if (apiResult.ok && apiResult.hasData) {
        console.log(`✅ API working - ${apiResult.dataLength} items returned`);
      } else if (apiResult.ok && !apiResult.hasData) {
        console.log('⚠️ API working but no data returned');
      } else {
        console.log('❌ API error:', apiResult);
      }
      
    } else {
      console.log('❌ Authentication issues persist');
      if (pageState.hasAuthGuard) console.log('  - Auth guard still active');
      if (pageState.hasLoginRedirect) console.log('  - Still redirected to login');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testInventoryPage().catch(console.error);