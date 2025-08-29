/**
 * Test script to verify that /inventory/items only shows items with related inventory units
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testInventoryFiltering() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1200, height: 800 },
    slowMo: 100
  });

  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser Error:', msg.text());
      }
    });

    // Navigate to inventory items page
    console.log('🌐 Navigating to inventory items page...');
    await page.goto('http://localhost:3000/inventory/items', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for the page to load
    await page.waitForSelector('[data-testid="inventory-items-table"], .inventory-items-table, table', {
      timeout: 15000
    });

    console.log('✅ Inventory items page loaded successfully');

    // Test 1: Verify API endpoint is correct
    console.log('\n📊 Test 1: Verifying API endpoint...');
    
    // Listen for API requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/inventory/stocks')) {
        apiRequests.push(request.url());
      }
    });

    // Wait for API requests to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (apiRequests.length > 0) {
      console.log('✅ Correct API endpoint called:', apiRequests[0]);
    } else {
      console.log('⚠️ No API requests detected to /inventory/stocks');
    }

    // Test 2: Check that items are displayed
    console.log('\n📊 Test 2: Checking displayed items...');
    
    const itemRows = await page.$$eval('table tbody tr', rows => {
      return rows.map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return null;
        
        return {
          name: cells[0]?.textContent?.trim() || '',
          sku: cells[1]?.textContent?.trim() || '',
          category: cells[2]?.textContent?.trim() || '',
          brand: cells[3]?.textContent?.trim() || '',
          stock_total: cells[4]?.textContent?.trim() || '',
          stock_status: cells[5]?.textContent?.trim() || '',
          value: cells[6]?.textContent?.trim() || ''
        };
      }).filter(item => item && item.name);
    });

    console.log(`✅ Found ${itemRows.length} inventory items`);
    
    if (itemRows.length > 0) {
      console.log('📋 Sample items:');
      itemRows.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.name} (${item.sku}) - Stock: ${item.stock_total} - Status: ${item.stock_status}`);
      });
    }

    // Test 3: Verify all items have stock counts > 0 (indicating they have inventory units)
    console.log('\n📊 Test 3: Verifying items have inventory units...');
    
    let itemsWithZeroStock = 0;
    let itemsWithStock = 0;
    
    itemRows.forEach(item => {
      const stockTotal = parseInt(item.stock_total) || 0;
      if (stockTotal === 0) {
        itemsWithZeroStock++;
        console.log(`⚠️ Item with zero stock found: ${item.name} (${item.sku})`);
      } else {
        itemsWithStock++;
      }
    });

    console.log(`✅ Items with stock: ${itemsWithStock}`);
    console.log(`⚠️ Items with zero stock: ${itemsWithZeroStock}`);

    // Test 4: Direct API test to verify backend filtering
    console.log('\n📊 Test 4: Testing backend API directly...');
    
    try {
      const apiResponse = await page.evaluate(async () => {
        const response = await fetch('http://localhost:8000/api/v1/inventory/stocks', {
          headers: {
            'Authorization': localStorage.getItem('access_token') ? 
              `Bearer ${localStorage.getItem('access_token')}` : ''
          }
        });
        return response.json();
      });

      if (apiResponse.success && Array.isArray(apiResponse.data)) {
        console.log(`✅ Backend API returned ${apiResponse.data.length} items`);
        
        // Check first few items for inventory units
        const sampleItems = apiResponse.data.slice(0, 3);
        sampleItems.forEach(item => {
          const hasUnits = item.stock_summary?.total > 0;
          console.log(`   - ${item.item_name}: ${item.stock_summary?.total || 0} units (${hasUnits ? '✅' : '❌'})`);
        });
      } else {
        console.log('⚠️ Unexpected API response format:', apiResponse);
      }
    } catch (error) {
      console.log('❌ Error testing API directly:', error.message);
    }

    // Test 5: Check for informational messages about filtering
    console.log('\n📊 Test 5: Checking for user information about filtering...');
    
    const hasFilterInfo = await page.$eval('body', body => {
      const text = body.textContent.toLowerCase();
      return text.includes('inventory units') || 
             text.includes('with units') || 
             text.includes('physical inventory');
    });

    if (hasFilterInfo) {
      console.log('✅ Found user information about inventory filtering');
    } else {
      console.log('⚠️ No clear indication to users that filtering is applied');
    }

    // Test 6: Screenshot for visual verification
    console.log('\n📊 Test 6: Taking screenshot for visual verification...');
    
    await page.screenshot({ 
      path: 'inventory-items-filtering-test.png',
      fullPage: true 
    });
    console.log('✅ Screenshot saved as inventory-items-filtering-test.png');

    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`   • Items displayed: ${itemRows.length}`);
    console.log(`   • Items with stock: ${itemsWithStock}`);
    console.log(`   • Items with zero stock: ${itemsWithZeroStock}`);
    console.log(`   • API endpoint correct: ${apiRequests.length > 0 ? '✅' : '❌'}`);
    console.log(`   • User filtering info: ${hasFilterInfo ? '✅' : '⚠️'}`);

    if (itemsWithZeroStock === 0 && itemsWithStock > 0) {
      console.log('\n🎉 SUCCESS: All displayed items have inventory units!');
    } else if (itemsWithZeroStock > 0) {
      console.log('\n⚠️ WARNING: Some items with zero stock are being displayed');
    } else {
      console.log('\n❓ No items found - check if data exists in database');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take error screenshot
    try {
      const page = browser.pages()[0];
      if (page) {
        await page.screenshot({ path: 'inventory-filtering-error.png' });
        console.log('📸 Error screenshot saved as inventory-filtering-error.png');
      }
    } catch (screenshotError) {
      console.error('Could not take error screenshot:', screenshotError);
    }
  } finally {
    await browser.close();
  }
}

// Run the test
console.log('🧪 Starting Inventory Filtering Test...');
console.log('⚡ Make sure the frontend (http://localhost:3000) and backend (http://localhost:8000) are running');
console.log('---'.repeat(20));

testInventoryFiltering().then(() => {
  console.log('\n✅ Test completed!');
}).catch(error => {
  console.error('❌ Test script error:', error);
});