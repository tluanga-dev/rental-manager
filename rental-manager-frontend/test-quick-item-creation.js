const puppeteer = require('puppeteer');

async function quickTest() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50
  });

  try {
    const page = await browser.newPage();
    
    // Monitor API responses
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/v1/items') && response.request().method() === 'POST') {
        console.log(`API Response: ${response.status()} ${response.statusText()}`);
        if (response.status() === 500) {
          response.text().then(body => {
            console.log('Error details:', body);
          });
        }
      }
    });

    console.log('1. Navigating to login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });

    console.log('2. Clicking Demo Admin...');
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && text.includes('Demo Admin')) {
        await button.click();
        break;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('3. Navigating to item creation...');
    await page.goto('http://localhost:3000/products/items/new', { waitUntil: 'networkidle0' });

    console.log('4. Filling form...');
    const itemName = `Test Item ${Date.now()}`;
    await page.waitForSelector('input[name="item_name"]');
    await page.type('input[name="item_name"]', itemName);

    // Set as rentable
    const rentableCheckbox = await page.$('input[name="is_rentable"]');
    if (rentableCheckbox) {
      const isChecked = await page.$eval('input[name="is_rentable"]', el => el.checked);
      if (!isChecked) {
        await rentableCheckbox.click();
      }
    }

    console.log('5. Submitting form...');
    const submitButton = await page.$('button[type="submit"]');
    await submitButton.click();

    // Wait a bit for response
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for success dialog
    const dialog = await page.$('[role="dialog"]');
    if (dialog) {
      const dialogText = await page.$eval('[role="dialog"]', el => el.textContent);
      if (dialogText.includes('Successfully')) {
        console.log('✅ SUCCESS! Item created and dialog shown!');
      } else {
        console.log('Dialog text:', dialogText);
      }
    } else {
      console.log('❌ No success dialog found');
      
      // Check for error messages
      const pageContent = await page.content();
      if (pageContent.includes('greenlet')) {
        console.log('❌ Greenlet error still present!');
      }
    }

    await page.screenshot({ path: 'test-quick-result.png' });
    console.log('Screenshot saved as test-quick-result.png');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

quickTest();