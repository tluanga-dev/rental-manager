const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();

  try {
    // Navigate to inventory items page
    console.log('📍 Navigating to inventory items page...');
    await page.goto('http://localhost:3000/inventory/items', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for the table to load
    await new Promise(r => setTimeout(r, 3000));

    // Check if the value column is displaying correctly
    const tableData = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      const items = [];
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
          const sku = cells[0]?.textContent?.trim();
          const name = cells[1]?.querySelector('span')?.textContent?.trim();
          const valueCell = cells[7]; // Value column is the 8th column (index 7)
          const valueText = valueCell?.querySelector('span.font-medium')?.textContent?.trim();
          const pricePerUnit = valueCell?.querySelector('span.text-xs')?.textContent?.trim();
          
          items.push({
            sku,
            name,
            value: valueText,
            pricePerUnit: pricePerUnit
          });
        }
      });
      
      return items;
    });

    console.log('\n📊 Inventory Items Value Display:');
    console.log('================================');
    tableData.forEach(item => {
      console.log(`\n📦 ${item.name} (${item.sku})`);
      console.log(`   💰 Total Value: ${item.value || 'Not displayed'}`);
      console.log(`   💵 Price/Unit: ${item.pricePerUnit || 'Not displayed'}`);
    });

    // Check for any error messages
    const hasErrors = await page.evaluate(() => {
      const errorTexts = [];
      document.querySelectorAll('.text-orange-600').forEach(el => {
        if (el.textContent.includes('No price set')) {
          errorTexts.push(el.textContent.trim());
        }
      });
      return errorTexts;
    });

    if (hasErrors.length > 0) {
      console.log('\n⚠️  Items without pricing:', hasErrors.length);
    }

    // Take a screenshot
    await page.screenshot({ 
      path: 'inventory-values-display.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as inventory-values-display.png');

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-inventory-values.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();