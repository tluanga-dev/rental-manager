const puppeteer = require('puppeteer');

async function testUnitDetailNavigation() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    console.log('1. Navigating to inventory items page...');
    await page.goto('http://localhost:3002/inventory/items', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Wait for the page to load
    await page.waitForTimeout(2000);
    
    console.log('2. Looking for an inventory item with units...');
    
    // Click on the first item in the table to go to item detail
    const itemRow = await page.$('table tbody tr:first-child');
    if (itemRow) {
      await itemRow.click();
      await page.waitForTimeout(2000);
      
      console.log('3. On item detail page, looking for units table...');
      
      // Check if we're on the item detail page
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      // Look for units in the Units tab
      const unitsTab = await page.$('button:has-text("Inventory Unit")');
      if (unitsTab) {
        console.log('4. Clicking on Inventory Unit tab...');
        await unitsTab.click();
        await page.waitForTimeout(1000);
      }
      
      // Try to find and click a unit row
      const unitRows = await page.$$('table tbody tr');
      console.log(`Found ${unitRows.length} unit rows`);
      
      if (unitRows.length > 0) {
        console.log('5. Clicking on the first unit...');
        
        // Get unit ID before clicking
        const unitId = await page.evaluate(() => {
          const firstRow = document.querySelector('table tbody tr:first-child');
          if (firstRow) {
            const firstCell = firstRow.querySelector('td:first-child');
            return firstCell ? firstCell.textContent : null;
          }
          return null;
        });
        
        console.log('Unit ID:', unitId);
        
        // Click on the first unit row
        await unitRows[0].click();
        
        // Wait for navigation
        await page.waitForTimeout(3000);
        
        // Check if we navigated to the unit detail page
        const newUrl = page.url();
        console.log('6. Navigated to:', newUrl);
        
        if (newUrl.includes('/inventory/units/')) {
          console.log('✅ SUCCESS: Navigated to unit detail page!');
          
          // Check for page content
          const pageTitle = await page.$eval('h1', el => el.textContent).catch(() => null);
          console.log('Page title:', pageTitle);
          
          // Check for tabs
          const tabs = await page.$$eval('[role="tab"]', tabs => tabs.map(t => t.textContent));
          console.log('Available tabs:', tabs);
          
          // Test tab navigation
          console.log('7. Testing tab navigation...');
          
          for (const tabName of ['Stock Movements', 'Rental History', 'Analytics', 'Maintenance']) {
            const tab = await page.$(`button:has-text("${tabName}")`);
            if (tab) {
              console.log(`   Clicking on ${tabName} tab...`);
              await tab.click();
              await page.waitForTimeout(1000);
            }
          }
          
          console.log('✅ All tabs tested successfully!');
        } else {
          console.log('❌ FAILED: Did not navigate to unit detail page');
        }
      } else {
        console.log('⚠️ No units found in the table');
      }
    } else {
      console.log('❌ No inventory items found');
    }
    
    console.log('\nTest completed. Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

testUnitDetailNavigation().catch(console.error);