const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();

  // Capture console logs
  page.on('console', msg => {
    console.log('📋 CONSOLE:', msg.text());
  });

  try {
    console.log('📍 Navigating to unit detail page...');
    await page.goto('http://localhost:3000/inventory/items/MAC201-00001/units/3a4f8f4b-f180-4d10-9d9b-dc19a20ba04c', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await new Promise(r => setTimeout(r, 3000));

    console.log('\n🔄 Updating rental rate to 600...');
    
    // Click the edit button and enter 600
    await page.evaluate(() => {
      console.log('Starting rate update process...');
      
      // Find and click Change/Set Rate button
      const buttons = document.querySelectorAll('button');
      for (let btn of buttons) {
        if (btn.textContent?.includes('Change') || btn.textContent?.includes('Set Rate')) {
          console.log('Clicking edit button:', btn.textContent);
          btn.click();
          break;
        }
      }
    });

    await new Promise(r => setTimeout(r, 1000));

    // Set the new value
    await page.evaluate(() => {
      const input = document.querySelector('input[type="number"]');
      if (input) {
        console.log('Found input, current value:', input.value);
        input.value = '600';
        console.log('Set input value to:', input.value);
        // Trigger events
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.log('Input not found!');
      }
    });

    await new Promise(r => setTimeout(r, 500));

    // Click save button
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (let btn of buttons) {
        if (btn.classList.contains('bg-green-600')) {
          console.log('Clicking save button');
          btn.click();
          break;
        }
      }
    });

    // Wait for logs and API response
    await new Promise(r => setTimeout(r, 5000));

    console.log('\n📊 Test completed! Check console logs above for debugging info.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n⏸️  Keeping browser open for manual inspection...');
    await new Promise(r => setTimeout(r, 10000));
    await browser.close();
  }
})();