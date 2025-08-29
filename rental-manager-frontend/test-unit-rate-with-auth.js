const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();

  // Monitor console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    } else if (msg.text().includes('Failed') || msg.text().includes('Error')) {
      console.log('⚠️  Console:', msg.text());
    }
  });

  // Monitor API responses
  page.on('response', response => {
    if (response.url().includes('/rental-rate')) {
      console.log(`📡 API Response: ${response.status()} - ${response.url()}`);
      response.text().then(text => {
        try {
          const data = JSON.parse(text);
          console.log('   Response data:', JSON.stringify(data, null, 2));
        } catch (e) {
          console.log('   Response text:', text);
        }
      });
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
      // Get current rental rate
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

      // Click the Change or Set Rate button
      console.log('\n🔄 Testing rental rate update...');
      
      const buttonClicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (let btn of buttons) {
          if (btn.textContent?.includes('Change') || btn.textContent?.includes('Set Rate')) {
            console.log('Clicking button:', btn.textContent);
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (buttonClicked) {
        console.log('   ✅ Clicked on rate editor button');
        
        await new Promise(r => setTimeout(r, 1000));
        
        // Enter a new rate
        const newRate = 350;
        const inputFilled = await page.evaluate((rate) => {
          const input = document.querySelector('input[type="number"]');
          if (input) {
            console.log('Found input, setting value to:', rate);
            input.value = rate.toString();
            // Trigger various events
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        }, newRate);

        if (inputFilled) {
          console.log(`   ✅ Entered new rate: ₹${newRate}`);
          
          await new Promise(r => setTimeout(r, 500));
          
          // Click save button
          const saved = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (let btn of buttons) {
              if (btn.classList.contains('bg-green-600') || 
                  btn.querySelector('svg[class*="lucide-check"]') ||
                  (btn.style.backgroundColor && btn.style.backgroundColor.includes('green'))) {
                console.log('Clicking save button');
                btn.click();
                return true;
              }
            }
            return false;
          });

          if (saved) {
            console.log('   ✅ Clicked save button');
            
            // Wait for the API call to complete
            await new Promise(r => setTimeout(r, 3000));
            
            // Check for toast messages and updated rate
            const updateResult = await page.evaluate(() => {
              const result = {
                hasSuccessToast: false,
                hasErrorToast: false,
                newRate: null,
                toastMessage: null
              };

              // Check for toast messages (multiple possible selectors)
              const toastSelectors = [
                '[role="alert"]',
                '.toast',
                '[data-state="open"]',
                '[class*="toast"]',
                'div[class*="Toast"]'
              ];
              
              for (let selector of toastSelectors) {
                const toasts = document.querySelectorAll(selector);
                toasts.forEach(toast => {
                  const text = toast.textContent || '';
                  if (text.includes('Updated') || text.includes('success') || text.includes('Rate Updated')) {
                    result.hasSuccessToast = true;
                    result.toastMessage = text;
                  } else if (text.includes('Failed') || text.includes('error')) {
                    result.hasErrorToast = true;
                    result.toastMessage = text;
                  }
                });
              }

              // Check the updated rate
              const spans = document.querySelectorAll('span');
              for (let span of spans) {
                if (span.textContent?.includes('₹350')) {
                  result.newRate = 350;
                  break;
                }
              }

              return result;
            });

            console.log('\n📊 Update Result:');
            console.log('================================');
            if (updateResult.hasSuccessToast) {
              console.log('✅ SUCCESS: Rate update saved!');
              console.log(`   Message: ${updateResult.toastMessage}`);
            } else if (updateResult.hasErrorToast) {
              console.log('❌ ERROR: Rate update failed');
              console.log(`   Message: ${updateResult.toastMessage}`);
            } else {
              console.log('⚠️  No toast message detected');
            }
            
            if (updateResult.newRate) {
              console.log(`✅ New rate displayed: ₹${updateResult.newRate}`);
            } else {
              console.log('⚠️  New rate not displayed in UI');
            }

            // Verify through API call
            console.log('\n🔍 Verifying through API...');
            await new Promise(r => setTimeout(r, 2000));
            
            await page.reload({ waitUntil: 'networkidle0' });
            await new Promise(r => setTimeout(r, 2000));

            const persistedRate = await page.evaluate(() => {
              const spans = document.querySelectorAll('span');
              for (let span of spans) {
                if (span.textContent?.includes('₹350')) {
                  return 350;
                } else if (span.textContent?.includes('₹') && span.textContent?.includes('/')) {
                  const match = span.textContent.match(/₹([\d.]+)/);
                  if (match) {
                    return parseFloat(match[1]);
                  }
                }
              }
              return null;
            });

            if (persistedRate === 350) {
              console.log('✅ VERIFIED: Rate persisted after refresh! Rate is ₹350');
            } else if (persistedRate) {
              console.log(`⚠️  Rate after refresh is ₹${persistedRate} (expected ₹350)`);
            } else {
              console.log('❌ WARNING: Could not find rate after refresh');
            }
          }
        }
      }
    }

    // Take a screenshot
    await page.screenshot({ 
      path: 'unit-rental-rate-auth-test.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as unit-rental-rate-auth-test.png');

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-unit-rate-auth.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();