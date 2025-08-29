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
    await new Promise(r => setTimeout(r, 3000));

    // Check if rental pricing section exists
    const hasRentalSection = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (let el of elements) {
        if (el.textContent && el.textContent.includes('Rental Pricing Configuration')) {
          return true;
        }
      }
      return false;
    });

    console.log(`\n✅ Rental Pricing Section exists: ${hasRentalSection}`);

    if (hasRentalSection) {
      // Check for rental rate editor
      const rentalRateInfo = await page.evaluate(() => {
        const info = {
          hasEditor: false,
          hasSetButton: false,
          hasChangeButton: false,
          hasPeriodSelector: false,
          hasDepositInput: false,
          currentRate: null,
          currentPeriod: null
        };

        // Check for rental rate editor elements
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
          if (btn.textContent?.includes('Set Rate')) info.hasSetButton = true;
          if (btn.textContent?.includes('Change')) info.hasChangeButton = true;
        });

        // Check for period selector
        const selects = document.querySelectorAll('[role="combobox"]');
        selects.forEach(select => {
          if (select.textContent?.includes('Per')) {
            info.hasPeriodSelector = true;
            info.currentPeriod = select.textContent;
          }
        });

        // Check for deposit input
        info.hasDepositInput = !!document.querySelector('input[placeholder*="deposit"]');

        // Check for rate display
        const rateElements = document.querySelectorAll('span');
        rateElements.forEach(el => {
          if (el.textContent?.includes('₹') && el.textContent?.includes('/')) {
            info.currentRate = el.textContent;
          }
        });

        return info;
      });

      console.log('\n📊 Rental Rate Configuration:');
      console.log('================================');
      console.log(`💰 Current Rate: ${rentalRateInfo.currentRate || 'Not set'}`);
      console.log(`📅 Current Period: ${rentalRateInfo.currentPeriod || 'Not set'}`);
      console.log(`✏️  Has Set/Change Button: ${rentalRateInfo.hasSetButton || rentalRateInfo.hasChangeButton ? 'Yes' : 'No'}`);
      console.log(`📆 Has Period Selector: ${rentalRateInfo.hasPeriodSelector ? 'Yes' : 'No'}`);
      console.log(`💵 Has Deposit Input: ${rentalRateInfo.hasDepositInput ? 'Yes' : 'No'}`);

      // Try to interact with the rental rate editor
      if (rentalRateInfo.hasSetButton || rentalRateInfo.hasChangeButton) {
        console.log('\n🔄 Testing rental rate editor...');
        
        // Click on Set Rate or Change button
        await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          for (let btn of buttons) {
            if (btn.textContent?.includes('Set Rate') || btn.textContent?.includes('Change')) {
              btn.click();
              break;
            }
          }
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        // Check if input field appeared
        const hasInput = await page.evaluate(() => {
          return !!document.querySelector('input[type="number"]');
        });
        
        console.log(`   ✅ Rate input field appears: ${hasInput}`);
      }

      // Check for master rate info
      const hasMasterRateInfo = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (let el of elements) {
          if (el.textContent && el.textContent.includes('Master rental rate:')) {
            return el.textContent;
          }
        }
        return null;
      });

      if (hasMasterRateInfo) {
        console.log(`\n📌 Master Rate Info: ${hasMasterRateInfo}`);
      }
    } else {
      console.log('\n⚠️  No Rental Pricing Section found');
      console.log('   This might mean the item is not marked as rentable');
    }

    // Take a screenshot
    await page.screenshot({ 
      path: 'unit-rental-rate-config.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as unit-rental-rate-config.png');

    console.log('\n✅ Unit rental rate test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-unit-rental-rate.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();