/**
 * Debug test to check console logs for inventory units
 */

const puppeteer = require('puppeteer');

async function debugInventoryUnits() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 },
    slowMo: 50,
    devtools: true // Open DevTools automatically
  });

  try {
    const page = await browser.newPage();
    
    // Capture ALL console messages
    const consoleLogs = [];
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleLogs.push({ type, text });
      
      if (text.includes('inventory units') || text.includes('📦')) {
        console.log(`📦 [${type.toUpperCase()}] ${text}`);
      } else if (type === 'error') {
        console.log(`❌ [ERROR] ${text}`);
      } else if (type === 'warning') {
        console.log(`⚠️ [WARNING] ${text}`);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      console.log('❌ PAGE ERROR:', error.message);
    });

    // Navigate
    const itemId = '6fb55465-8030-435c-82ea-090224a32a53';
    console.log(`🌐 Navigating to: http://localhost:3000/inventory/items/${itemId}`);
    
    await page.goto(`http://localhost:3000/inventory/items/${itemId}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait a bit for React to render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if console log about units was found
    const unitsLog = consoleLogs.find(log => log.text.includes('inventory units'));
    if (unitsLog) {
      console.log('\n✅ Found units log:', unitsLog.text);
    } else {
      console.log('\n⚠️ No console log about inventory units found');
    }

    // Try to manually call the API from the page context
    console.log('\n📊 Manually fetching units from API...');
    const apiResult = await page.evaluate(async (itemId) => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/inventory/items/${itemId}/units`, {
          headers: {
            'Authorization': localStorage.getItem('access_token') ? 
              `Bearer ${localStorage.getItem('access_token')}` : ''
          }
        });
        const data = await response.json();
        return {
          success: true,
          status: response.status,
          data: data
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, itemId);

    if (apiResult.success) {
      console.log('✅ API call successful, status:', apiResult.status);
      if (apiResult.data?.data?.inventory_units) {
        console.log(`✅ Found ${apiResult.data.data.inventory_units.length} units in API response`);
        // Show first unit as sample
        if (apiResult.data.data.inventory_units[0]) {
          const firstUnit = apiResult.data.data.inventory_units[0];
          console.log('📦 Sample unit:', {
            sku: firstUnit.sku,
            status: firstUnit.status,
            location: firstUnit.location?.name
          });
        }
      }
    } else {
      console.log('❌ API call failed:', apiResult.error);
    }

    // Check React Query cache
    console.log('\n📊 Checking React Query cache...');
    const queryCache = await page.evaluate(() => {
      const queries = window.__REACT_QUERY_STATE__ || {};
      const unitsQuery = Object.keys(queries).find(key => 
        key.includes('inventory-item-units')
      );
      if (unitsQuery) {
        return queries[unitsQuery];
      }
      return null;
    });

    if (queryCache) {
      console.log('✅ Found units in React Query cache');
    } else {
      console.log('⚠️ No units found in React Query cache');
    }

    // Check if Units Only tab exists
    const tabExists = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      return tabs.some(tab => tab.textContent.includes('Units Only'));
    });

    if (tabExists) {
      console.log('\n✅ "Units Only" tab exists');
      
      // Try clicking it
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
        const unitsTab = tabs.find(tab => tab.textContent.includes('Units Only'));
        if (unitsTab) unitsTab.click();
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✅ Clicked on Units Only tab');
      
      // Check if table rows appear
      const tableRows = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr');
        return rows.length;
      });
      
      console.log(`📊 Found ${tableRows} table rows after clicking Units tab`);
    } else {
      console.log('\n❌ "Units Only" tab not found');
    }

    // Take screenshot
    await page.screenshot({ 
      path: 'inventory-units-debug.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as inventory-units-debug.png');

    // Summary
    console.log('\n📋 CONSOLE LOG SUMMARY:');
    consoleLogs.forEach((log, index) => {
      if (index < 10) { // Show first 10 logs
        console.log(`   ${index + 1}. [${log.type}] ${log.text.substring(0, 100)}...`);
      }
    });
    console.log(`   Total logs: ${consoleLogs.length}`);

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    console.log('\n⏸️ Keeping browser open for manual inspection...');
    console.log('   Check the DevTools Console for more details');
    console.log('   Press Ctrl+C to close when done');
    
    // Keep browser open for manual inspection
    await new Promise(() => {});
  }
}

// Run debug
console.log('🧪 Starting Inventory Units Debug...');
console.log('---'.repeat(20));

debugInventoryUnits().catch(error => {
  console.error('❌ Script error:', error);
  process.exit(1);
});