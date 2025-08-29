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

    // Check if the Rental Rate column exists
    const hasRentalRateColumn = await page.evaluate(() => {
      const headers = document.querySelectorAll('thead th');
      let foundColumn = false;
      headers.forEach(header => {
        if (header.textContent && header.textContent.includes('Rental Rate')) {
          foundColumn = true;
        }
      });
      return foundColumn;
    });

    console.log(`\n✅ Rental Rate column exists: ${hasRentalRateColumn}`);

    // Check the rental rate cells
    const rentalRateData = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      const items = [];
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 9) { // Adjusted for new column
          const sku = cells[0]?.textContent?.trim();
          const name = cells[1]?.querySelector('span')?.textContent?.trim();
          const isRentable = cells[1]?.textContent?.includes('Rentable');
          
          // Count the columns: SKU(0), Name(1), Category(2), Brand(3), Stock(4), Available(5), Status(6), RentalRate(7), Value(8), Actions(9)
          const rentalRateCell = cells[7];
          let rentalRateInfo = {
            hasSetButton: false,
            hasChangeButton: false,
            hasEditor: false,
            displayText: '',
            isDash: false
          };
          
          if (rentalRateCell) {
            const buttons = rentalRateCell.querySelectorAll('button');
            let hasSetButton = false;
            let hasChangeButton = false;
            
            buttons.forEach(btn => {
              if (btn.textContent?.includes('Set Rate')) hasSetButton = true;
              if (btn.textContent?.includes('Change')) hasChangeButton = true;
            });
            
            const editor = rentalRateCell.querySelector('input[type="number"]');
            const dash = rentalRateCell.textContent?.trim() === '-';
            
            rentalRateInfo = {
              hasSetButton: hasSetButton,
              hasChangeButton: hasChangeButton,
              hasEditor: !!editor,
              displayText: rentalRateCell.textContent?.trim() || '',
              isDash: dash
            };
          }
          
          items.push({
            sku,
            name,
            isRentable,
            rentalRate: rentalRateInfo
          });
        }
      });
      
      return items;
    });

    console.log('\n📊 Rental Rate Display Analysis:');
    console.log('================================');
    rentalRateData.forEach(item => {
      console.log(`\n📦 ${item.name} (${item.sku})`);
      console.log(`   🏷️  Rentable: ${item.isRentable ? 'Yes' : 'No'}`);
      
      if (item.isRentable) {
        if (item.rentalRate.hasSetButton) {
          console.log(`   💰 Status: No rate set - "Set Rate" button visible`);
        } else if (item.rentalRate.hasEditor || item.rentalRate.hasChangeButton) {
          console.log(`   💰 Status: Rate editor/change button available`);
          console.log(`   💵 Display: ${item.rentalRate.displayText}`);
        } else {
          console.log(`   💰 Display: ${item.rentalRate.displayText}`);
        }
      } else {
        console.log(`   ➖ Non-rentable: ${item.rentalRate.isDash ? 'Shows dash' : item.rentalRate.displayText}`);
      }
    });

    // Try clicking a Set Rate button if it exists
    const hasSetRateButton = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (let btn of buttons) {
        if (btn.textContent?.includes('Set Rate')) return true;
      }
      return false;
    });

    if (hasSetRateButton) {
      console.log('\n🔄 Testing "Set Rate" button functionality...');
      
      // Click the first Set Rate button
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (let btn of buttons) {
          if (btn.textContent?.includes('Set Rate')) {
            btn.click();
            break;
          }
        }
      });
      await new Promise(r => setTimeout(r, 1000));
      
      // Check if an editor appeared
      const hasEditor = await page.evaluate(() => {
        return !!document.querySelector('input[type="number"]');
      });
      
      console.log(`   ✅ Editor appears after clicking Set Rate: ${hasEditor}`);
    }

    // Take a screenshot
    await page.screenshot({ 
      path: 'inventory-rental-rates.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as inventory-rental-rates.png');

    console.log('\n✅ Rental rate functionality test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-rental-rates.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();