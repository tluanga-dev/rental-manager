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

      // Try to click the Change or Set Rate button
      console.log('\n🔄 Testing rental rate update...');
      
      const buttonClicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (let btn of buttons) {
          if (btn.textContent?.includes('Change') || btn.textContent?.includes('Set Rate')) {
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (buttonClicked) {
        console.log('   ✅ Clicked on rate editor button');
        
        await new Promise(r => setTimeout(r, 1000));
        
        // Find and fill the input field
        const inputFilled = await page.evaluate(() => {
          const input = document.querySelector('input[type="number"]');
          if (input) {
            input.value = '250';
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
            return true;
          }
          return false;
        });

        if (inputFilled) {
          console.log('   ✅ Entered new rate: ₹250');
          
          // Click the save button (green checkmark)
          await new Promise(r => setTimeout(r, 500));
          
          const saved = await page.evaluate(() => {
            // Look for the save button (usually has a check icon or green background)
            const buttons = document.querySelectorAll('button');
            for (let btn of buttons) {
              // Check for green save button
              if (btn.classList.contains('bg-green-600') || 
                  btn.querySelector('svg') || 
                  btn.style.backgroundColor?.includes('green')) {
                btn.click();
                return true;
              }
            }
            return false;
          });

          if (saved) {
            console.log('   ✅ Clicked save button');
            
            // Wait for the save to complete
            await new Promise(r => setTimeout(r, 3000));
            
            // Check for success toast or updated rate
            const updateResult = await page.evaluate(() => {
              const result = {
                hasSuccessToast: false,
                hasErrorToast: false,
                newRate: null,
                toastMessage: null
              };

              // Check for toast messages
              const toasts = document.querySelectorAll('[role="alert"], .toast, [data-state="open"]');
              toasts.forEach(toast => {
                const text = toast.textContent || '';
                if (text.includes('Updated') || text.includes('success')) {
                  result.hasSuccessToast = true;
                  result.toastMessage = text;
                } else if (text.includes('Failed') || text.includes('error')) {
                  result.hasErrorToast = true;
                  result.toastMessage = text;
                }
              });

              // Check the updated rate
              const spans = document.querySelectorAll('span');
              for (let span of spans) {
                if (span.textContent?.includes('₹250')) {
                  result.newRate = 250;
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
            }

            // Test API by refreshing the page
            console.log('\n🔄 Refreshing page to verify persistence...');
            await page.reload({ waitUntil: 'networkidle0' });
            await new Promise(r => setTimeout(r, 2000));

            const persistedRate = await page.evaluate(() => {
              const spans = document.querySelectorAll('span');
              for (let span of spans) {
                if (span.textContent?.includes('₹250')) {
                  return true;
                }
              }
              return false;
            });

            if (persistedRate) {
              console.log('✅ VERIFIED: Rate persisted after refresh!');
            } else {
              console.log('❌ WARNING: Rate did not persist after refresh');
            }
          }
        }
      } else {
        console.log('⚠️  Could not find Change or Set Rate button');
      }
    }

    // Take a screenshot
    await page.screenshot({ 
      path: 'unit-rental-rate-update.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as unit-rental-rate-update.png');

    console.log('\n✅ Unit rental rate update test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-unit-rental-rate-update.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();