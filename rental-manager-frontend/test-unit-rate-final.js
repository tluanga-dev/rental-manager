const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();

  // Monitor API responses
  page.on('response', response => {
    if (response.url().includes('/rental-rate')) {
      console.log(`📡 API Response: ${response.status()} - ${response.url().split('/api/')[1]}`);
    }
  });

  try {
    // Navigate to the unit detail page
    console.log('📍 Navigating to unit detail page...');
    await page.goto('http://localhost:3000/inventory/items/MAC201-00001/units/3a4f8f4b-f180-4d10-9d9b-dc19a20ba04c', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await new Promise(r => setTimeout(r, 3000));

    // Get current rate
    const currentRate = await page.evaluate(() => {
      const spans = document.querySelectorAll('span');
      for (let span of spans) {
        if (span.textContent?.includes('₹') && span.textContent?.includes('/')) {
          const match = span.textContent.match(/₹([\d.]+)/);
          if (match) {
            return parseFloat(match[1]);
          }
        }
      }
      return null;
    });

    console.log(`\n📊 Current rental rate: ${currentRate ? `₹${currentRate}` : 'Not set'}`);

    // Click Change/Set Rate button
    console.log('\n🔄 Updating rental rate...');
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (let btn of buttons) {
        if (btn.textContent?.includes('Change') || btn.textContent?.includes('Set Rate')) {
          btn.click();
          break;
        }
      }
    });

    await new Promise(r => setTimeout(r, 1000));

    // Set new rate to 500
    const newRate = 500;
    await page.evaluate((rate) => {
      const input = document.querySelector('input[type="number"]');
      if (input) {
        input.value = rate.toString();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, newRate);

    console.log(`   ✅ Entered new rate: ₹${newRate}`);
    await new Promise(r => setTimeout(r, 500));

    // Click save
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (let btn of buttons) {
        if (btn.classList.contains('bg-green-600')) {
          btn.click();
          break;
        }
      }
    });

    console.log('   ✅ Clicked save button');
    
    // Wait for API response
    await new Promise(r => setTimeout(r, 3000));

    // Check for success
    const result = await page.evaluate(() => {
      const toasts = document.querySelectorAll('[role="alert"], [data-state="open"]');
      for (let toast of toasts) {
        const text = toast.textContent || '';
        if (text.includes('Successfully') || text.includes('Updated')) {
          return { success: true, message: text };
        }
        if (text.includes('Failed') || text.includes('Error')) {
          return { success: false, message: text };
        }
      }
      return { success: null, message: 'No toast found' };
    });

    if (result.success === true) {
      console.log(`\n✅ SUCCESS: ${result.message}`);
    } else if (result.success === false) {
      console.log(`\n❌ ERROR: ${result.message}`);
    } else {
      console.log(`\n⚠️  ${result.message}`);
    }

    // Verify by refreshing
    console.log('\n🔄 Refreshing to verify...');
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    const newRateAfterRefresh = await page.evaluate(() => {
      const spans = document.querySelectorAll('span');
      for (let span of spans) {
        if (span.textContent?.includes('₹') && span.textContent?.includes('/')) {
          const match = span.textContent.match(/₹([\d.]+)/);
          if (match) {
            return parseFloat(match[1]);
          }
        }
      }
      return null;
    });

    if (newRateAfterRefresh === newRate) {
      console.log(`✅ VERIFIED: Rate persisted! New rate is ₹${newRateAfterRefresh}`);
    } else {
      console.log(`⚠️  Rate after refresh: ₹${newRateAfterRefresh} (expected ₹${newRate})`);
    }

    // Take screenshot
    await page.screenshot({ path: 'unit-rate-final-test.png' });
    console.log('\n📸 Screenshot saved as unit-rate-final-test.png');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();