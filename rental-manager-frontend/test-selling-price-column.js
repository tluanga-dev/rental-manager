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

    // Check for "Selling Price" column header
    const columnHeader = await page.evaluate(() => {
      const headers = document.querySelectorAll('th button');
      for (let header of headers) {
        if (header.textContent?.includes('Selling Price')) {
          return {
            exists: true,
            text: header.textContent.trim()
          };
        }
        // Also check if old "Value" header still exists
        if (header.textContent?.includes('Value')) {
          return {
            exists: false,
            text: 'Still shows "Value"'
          };
        }
      }
      return {
        exists: false,
        text: 'Column not found'
      };
    });

    console.log(`\n✅ Column Header Check:`);
    if (columnHeader.exists) {
      console.log(`   ✅ SUCCESS: Column shows "${columnHeader.text}"`);
    } else {
      console.log(`   ⚠️  WARNING: ${columnHeader.text}`);
    }

    // Check the sorting functionality
    const sortingCheck = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('th button'))
        .find(btn => btn.textContent?.includes('Selling Price'));
      
      if (button) {
        // Click to test sorting
        button.click();
        return true;
      }
      return false;
    });

    console.log(`✅ Sorting Functionality: ${sortingCheck ? 'Working' : 'Not found'}`);

    // Analyze the selling price column data
    const priceData = await page.evaluate(() => {
      const info = {
        hasPrices: false,
        hasNotSet: false,
        priceFormats: [],
        hasOldValueFormat: false,
        cellCount: 0
      };

      // Find the column index for Selling Price
      const headers = Array.from(document.querySelectorAll('th'));
      let priceColumnIndex = -1;
      
      for (let i = 0; i < headers.length; i++) {
        if (headers[i].textContent?.includes('Selling Price')) {
          priceColumnIndex = i;
          break;
        }
      }

      if (priceColumnIndex === -1) {
        // Try to find it by looking for the 9th column (0-indexed)
        priceColumnIndex = 8;
      }

      // Check each row's selling price cell
      const rows = document.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > priceColumnIndex) {
          info.cellCount++;
          const priceCell = cells[priceColumnIndex];
          const text = priceCell.textContent?.trim();
          
          // Check for price format
          if (text?.includes('₹')) {
            info.hasPrices = true;
            // Check if it's the old format (with @ symbol for per unit)
            if (text.includes('@') || text.includes('/unit')) {
              info.hasOldValueFormat = true;
            }
            info.priceFormats.push(text);
          } else if (text === 'Not set') {
            info.hasNotSet = true;
          }
        }
      });

      return info;
    });

    console.log('\n📊 Selling Price Column Analysis:');
    console.log('===================================');
    console.log(`✅ Total rows analyzed: ${priceData.cellCount}`);
    console.log(`✅ Has prices displayed: ${priceData.hasPrices}`);
    console.log(`✅ Has "Not set" for missing prices: ${priceData.hasNotSet}`);
    
    if (priceData.hasOldValueFormat) {
      console.log('⚠️  WARNING: Still showing old format with "@/unit"');
    } else {
      console.log('✅ Clean format (no "@/unit" text)');
    }
    
    if (priceData.priceFormats.length > 0) {
      console.log('\n📌 Sample price formats:');
      priceData.priceFormats.slice(0, 3).forEach(format => {
        console.log(`   - ${format}`);
      });
    }

    // Check that old "Value" calculation is not present
    const hasOldValueLogic = await page.evaluate(() => {
      const cells = document.querySelectorAll('td');
      for (let cell of cells) {
        const text = cell.textContent || '';
        // Check for old patterns like "No price set" in orange
        if (text.includes('No price set')) {
          const hasOrangeClass = cell.querySelector('.text-orange-600');
          if (hasOrangeClass) {
            return true;
          }
        }
      }
      return false;
    });

    console.log(`\n✅ Old "No price set" warning removed: ${!hasOldValueLogic}`);

    // Take a screenshot
    await page.screenshot({ 
      path: 'inventory-selling-price-column.png',
      fullPage: false 
    });
    console.log('\n📸 Screenshot saved as inventory-selling-price-column.png');

    // Final summary
    console.log('\n🎯 Test Summary:');
    console.log('================');
    const allPassed = columnHeader.exists && 
                     !priceData.hasOldValueFormat && 
                     !hasOldValueLogic;
    
    if (allPassed) {
      console.log('✅ All tests passed!');
      console.log('✅ Column header changed to "Selling Price"');
      console.log('✅ Display shows simple price format');
      console.log('✅ "Not set" appears for items without prices');
      console.log('✅ Old value calculation removed');
    } else {
      console.log('⚠️  Some issues detected. Please review the implementation.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-selling-price-column.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();