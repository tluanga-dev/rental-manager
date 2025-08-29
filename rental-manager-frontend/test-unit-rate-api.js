const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--disable-blink-features=AutomationControlled'],
    devtools: true // Open DevTools to see network requests
  });

  const page = await browser.newPage();

  // Enable console log capture
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });

  // Capture network errors
  page.on('requestfailed', request => {
    console.log('❌ Request failed:', request.url(), request.failure().errorText);
  });

  // Monitor API calls
  page.on('response', response => {
    if (response.url().includes('/rental-rate')) {
      console.log(`📡 API Response: ${response.url()} - Status: ${response.status()}`);
    }
  });

  try {
    // Navigate to the unit detail page
    console.log('📍 Navigating to unit detail page...');
    await page.goto('http://localhost:3000/inventory/items/MAC201-00001/units/3a4f8f4b-f180-4d10-9d9b-dc19a20ba04c', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for the page to load
    await new Promise(r => setTimeout(r, 3000));

    console.log('\n🔄 Attempting to update rental rate...');
    
    // Try to update the rate using page evaluation
    const updateResult = await page.evaluate(async () => {
      const result = {
        buttonFound: false,
        inputFound: false,
        saveClicked: false,
        apiError: null,
        consoleErrors: []
      };

      try {
        // Find and click the Change/Set Rate button
        const buttons = document.querySelectorAll('button');
        for (let btn of buttons) {
          if (btn.textContent?.includes('Change') || btn.textContent?.includes('Set Rate')) {
            btn.click();
            result.buttonFound = true;
            break;
          }
        }

        if (!result.buttonFound) return result;

        // Wait a bit for the input to appear
        await new Promise(r => setTimeout(r, 1000));

        // Find and fill the input
        const input = document.querySelector('input[type="number"]');
        if (input) {
          result.inputFound = true;
          input.value = '300';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (!result.inputFound) return result;

        // Wait a bit
        await new Promise(r => setTimeout(r, 500));

        // Find and click save button
        const saveButtons = document.querySelectorAll('button');
        for (let btn of saveButtons) {
          if (btn.classList.contains('bg-green-600') || 
              btn.style.backgroundColor?.includes('green')) {
            btn.click();
            result.saveClicked = true;
            break;
          }
        }

      } catch (error) {
        result.apiError = error.message;
      }

      return result;
    });

    console.log('\n📊 Operation Result:');
    console.log('================================');
    console.log(`Button found and clicked: ${updateResult.buttonFound ? '✅' : '❌'}`);
    console.log(`Input found and filled: ${updateResult.inputFound ? '✅' : '❌'}`);
    console.log(`Save button clicked: ${updateResult.saveClicked ? '✅' : '❌'}`);
    
    if (updateResult.apiError) {
      console.log(`API Error: ${updateResult.apiError}`);
    }

    // Wait for potential API response
    await new Promise(r => setTimeout(r, 3000));

    // Check console for errors
    const consoleErrors = await page.evaluate(() => {
      // This would only work if we injected error tracking earlier
      return window.__errors || [];
    });

    if (consoleErrors.length > 0) {
      console.log('\n❌ Console Errors Found:');
      consoleErrors.forEach(err => console.log(`   - ${err}`));
    }

    // Try to directly call the API to test if backend is working
    console.log('\n🧪 Testing API directly...');
    const apiTestResult = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:8000/api/inventory/units/3a4f8f4b-f180-4d10-9d9b-dc19a20ba04c/rental-rate', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
          },
          body: JSON.stringify({ rental_rate_per_period: 300 })
        });
        
        const data = await response.json();
        return {
          status: response.status,
          success: response.ok,
          data: data
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    });

    console.log('\n📡 Direct API Test Result:');
    if (apiTestResult.error) {
      console.log(`❌ Error: ${apiTestResult.error}`);
    } else {
      console.log(`Status: ${apiTestResult.status}`);
      console.log(`Success: ${apiTestResult.success ? '✅' : '❌'}`);
      if (apiTestResult.data) {
        console.log('Response:', JSON.stringify(apiTestResult.data, null, 2));
      }
    }

    // Take a screenshot
    await page.screenshot({ 
      path: 'unit-rate-api-test.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as unit-rate-api-test.png');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-unit-rate-api.png', fullPage: true });
  } finally {
    console.log('\n⏸️  Keeping browser open for 10 seconds to check DevTools...');
    await new Promise(r => setTimeout(r, 10000));
    await browser.close();
  }
})();