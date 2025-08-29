const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();

  try {
    // Navigate to the unit detail page
    console.log('📍 Navigating to unit detail page...');
    await page.goto('http://localhost:3000/inventory/items/MAC201-00001/units/3a4f8f4b-f180-4d10-9d9b-dc19a20ba04c', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for the page to load
    await new Promise(r => setTimeout(r, 2000));

    // Click on the Stock Movements tab
    console.log('🔄 Clicking on Stock Movements tab...');
    const movementsTab = await page.waitForSelector('button[role="tab"]:has-text("Stock Movements"), button:has-text("Stock Movements")', { timeout: 5000 }).catch(() => null);
    
    if (!movementsTab) {
      // Try alternative selector
      const tabs = await page.$$eval('button[role="tab"]', buttons => 
        buttons.map(b => ({ text: b.textContent, index: buttons.indexOf(b) }))
      );
      console.log('Available tabs:', tabs);
      
      // Look for movements tab by partial text
      const movTab = await page.$('button[role="tab"][data-state="inactive"]');
      if (movTab) {
        await movTab.click();
      }
    } else {
      await movementsTab.click();
    }

    // Wait for movements to load
    await new Promise(r => setTimeout(r, 2000));

    // Check if movements are displayed
    const movementsContent = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (table) {
        const rows = table.querySelectorAll('tbody tr');
        return {
          hasTable: true,
          rowCount: rows.length,
          firstRowText: rows[0]?.textContent || 'No rows'
        };
      }
      
      const noMovementsText = document.querySelector('*:has-text("No movements recorded")');
      if (noMovementsText) {
        return {
          hasTable: false,
          message: 'No movements recorded message shown'
        };
      }
      
      return {
        hasTable: false,
        message: 'Unable to find movements display'
      };
    });

    console.log('📊 Stock Movements Display:', movementsContent);

    // Take a screenshot
    await page.screenshot({ 
      path: 'unit-movements-display.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved as unit-movements-display.png');

    // Check console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console error:', msg.text());
      }
    });

    await new Promise(r => setTimeout(r, 3000));

    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-movements.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();