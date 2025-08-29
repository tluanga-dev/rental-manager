/**
 * Test to verify inventory units are displayed on the detail page
 */

const puppeteer = require('puppeteer');

async function testInventoryDetailUnits() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 },
    slowMo: 100
  });

  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser Error:', msg.text());
      } else if (msg.type() === 'warn') {
        console.log('⚠️ Browser Warning:', msg.text());
      }
    });

    // Navigate to the specific inventory item detail page
    const itemId = '6fb55465-8030-435c-82ea-090224a32a53';
    console.log('🌐 Navigating to inventory item detail page...');
    console.log(`   URL: http://localhost:3000/inventory/items/${itemId}`);
    
    await page.goto(`http://localhost:3000/inventory/items/${itemId}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('✅ Page loaded successfully');

    // Wait for the page to render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if inventory units section exists
    console.log('\n📊 Checking for inventory units section...');
    
    const hasUnitsSection = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2, h3'));
      return headings.some(h => 
        h.textContent.toLowerCase().includes('inventory unit') ||
        h.textContent.toLowerCase().includes('unit detail') ||
        h.textContent.toLowerCase().includes('serialized unit')
      );
    });

    if (hasUnitsSection) {
      console.log('✅ Found inventory units section');
    } else {
      console.log('⚠️ Inventory units section not found');
    }

    // Check for inventory units in table or list
    console.log('\n📊 Looking for inventory unit details...');
    
    const unitDetails = await page.evaluate(() => {
      // Look for table rows with SKU pattern (e.g., MAC201-00001-0001)
      const rows = Array.from(document.querySelectorAll('tr, [role="row"]'));
      const units = [];
      
      rows.forEach(row => {
        const text = row.textContent || '';
        // Look for unit SKU pattern
        if (text.match(/MAC201-00001-\d{4}/)) {
          const cells = Array.from(row.querySelectorAll('td, [role="cell"]'));
          if (cells.length > 0) {
            units.push({
              sku: cells[0]?.textContent?.trim() || '',
              status: cells[1]?.textContent?.trim() || '',
              location: cells[2]?.textContent?.trim() || '',
              condition: cells[3]?.textContent?.trim() || ''
            });
          }
        }
      });
      
      return units;
    });

    if (unitDetails.length > 0) {
      console.log(`✅ Found ${unitDetails.length} inventory units:`);
      unitDetails.slice(0, 3).forEach((unit, index) => {
        console.log(`   ${index + 1}. SKU: ${unit.sku}, Status: ${unit.status}, Location: ${unit.location}`);
      });
    } else {
      console.log('❌ No inventory units found in the display');
    }

    // Check API calls made
    console.log('\n📊 Monitoring API calls...');
    const apiCalls = [];
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/inventory/items/') && url.includes('/units')) {
        apiCalls.push({
          url: url,
          status: response.status()
        });
      }
    });

    // Refresh to capture API calls
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (apiCalls.length > 0) {
      console.log('✅ API calls detected:');
      apiCalls.forEach(call => {
        console.log(`   - ${call.url} (Status: ${call.status})`);
      });
    }

    // Take screenshot
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({ 
      path: 'inventory-detail-units-test.png',
      fullPage: true 
    });
    console.log('✅ Screenshot saved as inventory-detail-units-test.png');

    // Check for any error messages
    const errorMessages = await page.evaluate(() => {
      const errors = [];
      // Look for common error indicators
      const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"], .text-red-500, .text-red-600');
      errorElements.forEach(el => {
        if (el.textContent && el.textContent.trim()) {
          errors.push(el.textContent.trim());
        }
      });
      return errors;
    });

    if (errorMessages.length > 0) {
      console.log('\n⚠️ Error messages found on page:');
      errorMessages.forEach(err => console.log(`   - ${err}`));
    }

    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`   • Item ID: ${itemId}`);
    console.log(`   • Units Section Found: ${hasUnitsSection ? '✅' : '❌'}`);
    console.log(`   • Units Displayed: ${unitDetails.length}`);
    console.log(`   • API Calls Made: ${apiCalls.length}`);
    console.log(`   • Errors: ${errorMessages.length > 0 ? '❌ Yes' : '✅ None'}`);

    if (unitDetails.length > 0) {
      console.log('\n🎉 SUCCESS: Inventory units are being displayed!');
    } else {
      console.log('\n❌ ISSUE: Inventory units are not being displayed properly');
      console.log('   Check the console logs and screenshot for more details');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take error screenshot
    try {
      const page = (await browser.pages())[0];
      if (page) {
        await page.screenshot({ path: 'inventory-detail-error.png' });
        console.log('📸 Error screenshot saved');
      }
    } catch (screenshotError) {
      console.error('Could not take error screenshot:', screenshotError);
    }
  } finally {
    await browser.close();
  }
}

// Run the test
console.log('🧪 Starting Inventory Detail Units Test...');
console.log('⚡ Testing item: Cannon Cement Mixer (7 units expected)');
console.log('---'.repeat(20));

testInventoryDetailUnits().then(() => {
  console.log('\n✅ Test completed!');
}).catch(error => {
  console.error('❌ Test script error:', error);
});