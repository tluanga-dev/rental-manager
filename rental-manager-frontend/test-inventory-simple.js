const puppeteer = require('puppeteer');

/**
 * Simple inventory page test with auth bypass
 */
async function testInventorySimple() {
  console.log('🧪 Quick test of inventory page with auth bypass...');
  
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Navigate directly to inventory on port 3001
    console.log('🔍 Going to http://localhost:3001/inventory...');
    await page.goto('http://localhost:3001/inventory', { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    // Wait a moment for the page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const result = await page.evaluate(() => {
      const hasInventoryTitle = document.body.textContent.includes('Item Inventory');
      const hasAuthGuard = document.body.textContent.includes('Checking authentication');
      const hasLogin = document.body.textContent.includes('Login');
      const hasTableRows = document.querySelectorAll('tr').length > 1;
      const hasNoData = document.body.textContent.includes('No data') || document.body.textContent.includes('No items');
      
      return {
        hasInventoryTitle,
        hasAuthGuard,
        hasLogin,
        hasTableRows,
        hasNoData,
        tableRows: document.querySelectorAll('tr').length,
        url: window.location.href
      };
    });
    
    console.log('📊 Results:', result);
    
    // Take screenshot
    await page.screenshot({ path: 'inventory-quick-test.png', fullPage: true });
    console.log('📸 Screenshot: inventory-quick-test.png');
    
    if (result.hasInventoryTitle && !result.hasAuthGuard && !result.hasLogin) {
      console.log('✅ SUCCESS: Inventory page loaded with auth bypass!');
      if (result.hasTableRows) {
        console.log(`✅ Data found: ${result.tableRows} table rows`);
      } else if (result.hasNoData) {
        console.log('⚠️ No data displayed (database may be empty)');
      }
    } else {
      console.log('❌ ISSUE: Auth bypass not working properly');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testInventorySimple();