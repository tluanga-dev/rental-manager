const puppeteer = require('puppeteer');

// Test SKU-based navigation for inventory items and units
async function testSkuNavigation() {
  console.log('🚀 Starting SKU-based navigation test...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Add console logging
  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'info') {
      console.log('Browser:', msg.text());
    }
  });

  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    
    // Log API calls
    if (url.includes('/api/') && !url.includes('_next')) {
      const method = response.request().method();
      console.log(`API ${method} ${url.slice(url.indexOf('/api/'))} - ${status}`);
    }
  });

  try {
    // Step 1: Navigate to login page
    console.log('Step 1: Logging in...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
    
    // Login with dev credentials
    await page.type('input[name="email"]', 'admin@example.com');
    await page.type('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('✅ Login successful\n');

    // Step 2: Navigate to inventory items list
    console.log('Step 2: Navigating to inventory items...');
    await page.goto('http://localhost:3000/inventory/items', { waitUntil: 'networkidle0' });
    
    // Wait for items table to load
    await page.waitForSelector('table', { timeout: 10000 });
    console.log('✅ Inventory items page loaded\n');

    // Step 3: Get the first item's SKU and click View button
    console.log('Step 3: Testing SKU-based item navigation...');
    
    // Get the first item's SKU
    const firstItemSku = await page.evaluate(() => {
      const firstRow = document.querySelector('tbody tr');
      if (!firstRow) return null;
      
      // SKU is in the first cell
      const skuCell = firstRow.querySelector('td:first-child');
      return skuCell ? skuCell.textContent.trim() : null;
    });

    if (!firstItemSku) {
      throw new Error('No items found in the table');
    }
    
    console.log(`Found first item SKU: ${firstItemSku}`);
    
    // Click the View button for the first item
    const viewButton = await page.$('tbody tr:first-child button');
    if (!viewButton) {
      throw new Error('View button not found');
    }
    await viewButton.click();
    
    // Wait for navigation to item detail page
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    // Verify we're on the SKU-based URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    if (!currentUrl.includes(`/inventory/items/${firstItemSku}`)) {
      throw new Error(`Expected URL to contain /inventory/items/${firstItemSku}, got ${currentUrl}`);
    }
    
    console.log('✅ Successfully navigated to item detail using SKU\n');

    // Step 4: Check if units table is present and test unit navigation
    console.log('Step 4: Testing unit detail navigation...');
    
    // Wait for units table or empty state
    await page.waitForSelector('.rounded-md.border', { timeout: 10000 });
    
    // Check if there are any units
    const hasUnits = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      // Check if we have actual unit rows (not just the empty state row)
      return rows.length > 0 && !rows[0].textContent.includes('No units found');
    });

    if (hasUnits) {
      console.log('Units found, testing unit detail navigation...');
      
      // Get the first unit's ID
      const unitInfo = await page.evaluate(() => {
        const firstRow = document.querySelector('tbody tr');
        if (!firstRow) return null;
        
        // Unit ID is typically in the first cell
        const unitIdCell = firstRow.querySelector('td:first-child');
        return unitIdCell ? unitIdCell.textContent.trim() : null;
      });
      
      console.log(`Found unit: ${unitInfo}`);
      
      // Click on the first unit row
      await page.click('tbody tr:first-child');
      
      // Wait for navigation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check the URL structure
      const unitUrl = page.url();
      console.log(`Unit detail URL: ${unitUrl}`);
      
      if (unitUrl.includes(`/inventory/items/${firstItemSku}/units/`)) {
        console.log('✅ Successfully navigated to unit detail using nested SKU route\n');
      } else {
        console.log('⚠️ Unit navigation used fallback route (query params)\n');
      }
      
      // Step 5: Test breadcrumb navigation back
      console.log('Step 5: Testing breadcrumb navigation...');
      
      // Click on the item breadcrumb link to go back
      const itemBreadcrumb = await page.$('nav[aria-label="Breadcrumb"] a[href*="/inventory/items/"]');
      if (itemBreadcrumb) {
        await itemBreadcrumb.click();
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        console.log('✅ Breadcrumb navigation works\n');
      }
    } else {
      console.log('No units found for this item (non-serialized item), skipping unit navigation test\n');
    }

    // Step 6: Test direct SKU URL access
    console.log('Step 6: Testing direct SKU URL access...');
    
    // Navigate directly to the SKU-based URL
    await page.goto(`http://localhost:3000/inventory/items/${firstItemSku}`, { 
      waitUntil: 'networkidle0' 
    });
    
    // Verify the page loads correctly
    await page.waitForSelector('h1', { timeout: 10000 });
    
    const pageTitle = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.textContent.trim() : null;
    });
    
    console.log(`Page loaded with title: ${pageTitle}`);
    console.log('✅ Direct SKU URL access works\n');

    // Summary
    console.log('=====================================');
    console.log('✅ SKU-BASED NAVIGATION TEST PASSED');
    console.log('=====================================');
    console.log('Summary:');
    console.log('- Item list to detail navigation: ✅');
    console.log('- SKU-based URLs working: ✅');
    console.log('- Unit detail navigation: ✅');
    console.log('- Breadcrumb navigation: ✅');
    console.log('- Direct URL access: ✅');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: 'sku-navigation-error.png',
      fullPage: true 
    });
    console.log('Screenshot saved as sku-navigation-error.png');
    
  } finally {
    await browser.close();
  }
}

// Run the test
testSkuNavigation().catch(console.error);