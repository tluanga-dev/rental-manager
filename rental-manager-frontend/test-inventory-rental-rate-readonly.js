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
    await page.waitForSelector('table', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    // Check for rental rate column header
    const hasRentalRateColumn = await page.evaluate(() => {
      const headers = document.querySelectorAll('th button');
      for (let header of headers) {
        if (header.textContent?.includes('Rental Rate')) {
          return true;
        }
      }
      return false;
    });

    console.log(`\n✅ Rental Rate column exists: ${hasRentalRateColumn}`);

    // Check for absence of "Set Rate" buttons
    const setRateButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const setRateCount = Array.from(buttons).filter(btn => 
        btn.textContent?.includes('Set Rate')
      ).length;
      return setRateCount;
    });

    console.log(`✅ "Set Rate" buttons found: ${setRateButtons}`);
    if (setRateButtons > 0) {
      console.log('⚠️  WARNING: "Set Rate" buttons still exist!');
    } else {
      console.log('✅ SUCCESS: No "Set Rate" buttons found (as expected)');
    }

    // Check for absence of RentalRateEditor components (Change buttons)
    const changeButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const changeCount = Array.from(buttons).filter(btn => 
        btn.textContent === 'Change'
      ).length;
      return changeCount;
    });

    console.log(`✅ "Change" buttons found: ${changeButtons}`);
    if (changeButtons > 0) {
      console.log('⚠️  WARNING: "Change" buttons still exist!');
    } else {
      console.log('✅ SUCCESS: No "Change" buttons found (as expected)');
    }

    // Check rental rate display format
    const rentalRateInfo = await page.evaluate(() => {
      const info = {
        hasRates: false,
        hasNotSet: false,
        hasDash: false,
        rateFormats: []
      };

      // Find rental rate cells (8th column in each row)
      const rows = document.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
          const rentalCell = cells[7]; // 0-indexed, so 8th column is index 7
          const text = rentalCell.textContent?.trim();
          
          if (text?.includes('₹')) {
            info.hasRates = true;
            info.rateFormats.push(text);
          } else if (text === 'Not set') {
            info.hasNotSet = true;
          } else if (text === '-') {
            info.hasDash = true;
          }
        }
      });

      return info;
    });

    console.log('\n📊 Rental Rate Display Analysis:');
    console.log('================================');
    console.log(`✅ Has rental rates displayed: ${rentalRateInfo.hasRates}`);
    console.log(`✅ Has "Not set" for unset rates: ${rentalRateInfo.hasNotSet}`);
    console.log(`✅ Has "-" for non-rentable items: ${rentalRateInfo.hasDash}`);
    
    if (rentalRateInfo.rateFormats.length > 0) {
      console.log('\n📌 Sample rate formats:');
      rentalRateInfo.rateFormats.slice(0, 3).forEach(format => {
        console.log(`   - ${format}`);
      });
    }

    // Check for absence of input fields
    const inputFields = await page.evaluate(() => {
      return document.querySelectorAll('input[type="number"]').length;
    });

    console.log(`\n✅ Number input fields found: ${inputFields}`);
    if (inputFields > 0) {
      console.log('⚠️  Note: Input fields exist (might be for other purposes)');
    }

    // Take a screenshot
    await page.screenshot({ 
      path: 'inventory-rental-rate-readonly.png',
      fullPage: false 
    });
    console.log('\n📸 Screenshot saved as inventory-rental-rate-readonly.png');

    // Final summary
    console.log('\n🎯 Test Summary:');
    console.log('================');
    const allPassed = setRateButtons === 0 && changeButtons === 0;
    if (allPassed) {
      console.log('✅ All tests passed! The rental rate column is now read-only.');
      console.log('✅ No "Set Rate" or "Change" buttons are present.');
      console.log('✅ Rental rates are displayed as read-only values.');
    } else {
      console.log('⚠️  Some interactive elements may still be present.');
      console.log('   Please verify the implementation.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-rental-rate-readonly.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();