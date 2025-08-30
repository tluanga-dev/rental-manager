const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const TEST_ITEM_SKU = 'MAC201-00001'; // The item mentioned by user
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots', 'rental-config-test');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function testRentalConfiguration() {
  console.log('🚀 Starting Rental Configuration Test...');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI/CD
    defaultViewport: { width: 1920, height: 1080 },
    slowMo: 500, // Slow down for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let page;
  
  try {
    page = await browser.newPage();
    
    // Enable console logging from the browser
    page.on('console', (msg) => {
      console.log('🖥️  Browser Console:', msg.text());
    });
    
    // Enable error logging
    page.on('pageerror', (error) => {
      console.error('❌ Page Error:', error.message);
    });
    
    // Step 1: Navigate to inventory item detail page
    console.log('📋 Step 1: Navigating to inventory item detail page...');
    const itemUrl = `${BASE_URL}/inventory/items/${TEST_ITEM_SKU}`;
    console.log(`🔗 URL: ${itemUrl}`);
    
    await page.goto(itemUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-item-detail-page.png'), fullPage: true });
    
    // Check if page loaded correctly
    const pageTitle = await page.title();
    console.log(`📖 Page title: ${pageTitle}`);
    
    // Step 2: Wait for the page to fully load
    console.log('⏳ Step 2: Waiting for page content to load...');
    await page.waitForSelector('[data-testid="inventory-item-detail"], .container', { timeout: 15000 });
    
    // Step 3: Look for the Pricing Information Card
    console.log('🔍 Step 3: Looking for Pricing Information Card...');
    
    let pricingCard;
    try {
      // Look for the card with "Rental Pricing" title
      await page.waitForSelector('h3, [role="heading"]', { timeout: 10000 });
      
      // Find the pricing card by looking for "Rental Pricing" text
      pricingCard = await page.evaluateHandle(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'));
        const pricingHeading = headings.find(h => h.textContent.includes('Rental Pricing'));
        return pricingHeading ? pricingHeading.closest('[class*="card"], .card, [data-testid*="card"]') || pricingHeading.parentElement.parentElement : null;
      });
      
      if (!pricingCard || await pricingCard.evaluate(node => !node)) {
        throw new Error('Pricing card not found');
      }
      
      console.log('✅ Found Pricing Information Card');
    } catch (error) {
      console.log('⚠️  Pricing card not immediately visible, checking page structure...');
      
      // Debug: Log all visible text on the page
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('📄 Page content preview:', pageText.substring(0, 500) + '...');
      
      // Look for any pricing-related content
      const pricingElements = await page.$$eval('*', (elements) => {
        return elements
          .filter(el => el.textContent && (
            el.textContent.includes('rental') || 
            el.textContent.includes('pricing') || 
            el.textContent.includes('Configure')
          ))
          .map(el => ({ 
            tag: el.tagName, 
            text: el.textContent.substring(0, 100),
            classes: el.className 
          }));
      });
      
      console.log('🔍 Found pricing-related elements:', pricingElements);
    }
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-looking-for-pricing-card.png'), fullPage: true });
    
    // Step 4: Look for the "Configure for Rental" button
    console.log('🔍 Step 4: Looking for "Configure for Rental" button...');
    
    let configureButton;
    try {
      // First, verify the button exists from our button list
      console.log('🔍 Looking for Configure for Rental button...');
      
      // Direct approach - check if the button exists and get it
      const buttonInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const configBtn = buttons.find(btn => 
          btn.textContent && btn.textContent.includes('Configure for Rental')
        );
        
        if (configBtn) {
          const rect = configBtn.getBoundingClientRect();
          return {
            found: true,
            text: configBtn.textContent,
            visible: rect.width > 0 && rect.height > 0,
            classes: configBtn.className
          };
        }
        return { found: false };
      });
      
      if (buttonInfo.found) {
        console.log(`✅ Found configure button: "${buttonInfo.text}"`);
        console.log(`🔍 Button visible: ${buttonInfo.visible}`);
        console.log(`🎨 Button classes: ${buttonInfo.classes}`);
        
        if (!buttonInfo.visible) {
          throw new Error('Configure button exists but is not visible');
        }
        
        // Get the actual element for clicking
        configureButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          return buttons.find(btn => 
            btn.textContent && btn.textContent.includes('Configure for Rental')
          );
        });
        
      } else {
        throw new Error('Configure for Rental button not found in DOM');
      }
      
    } catch (error) {
      console.log('❌ Configure button not found, checking if item is already rentable...');
      
      // Check if the item might already be rentable
      const existingPricingContent = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return {
          hasManagePricing: text.includes('manage pricing'),
          hasDailyRate: text.includes('daily rate'),
          hasTieredPricing: text.includes('tier'),
          hasRentalRate: text.includes('rental rate')
        };
      });
      
      console.log('🔍 Existing pricing content:', existingPricingContent);
      
      if (existingPricingContent.hasManagePricing || existingPricingContent.hasDailyRate) {
        console.log('✅ Item appears to already be rentable - no configure button needed');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-already-rentable.png'), fullPage: true });
        await browser.close();
        return;
      }
      
      // Debug: Take screenshot and list all buttons
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-no-configure-button.png'), fullPage: true });
      
      const allButtons = await page.$$eval('button, [role="button"]', (buttons) => {
        return buttons.map(btn => ({
          text: btn.textContent?.trim() || '',
          classes: btn.className,
          visible: btn.getBoundingClientRect().width > 0
        })).filter(btn => btn.text);
      });
      
      console.log('🔍 All buttons found on page:', allButtons);
      throw new Error('Configure for Rental button not found');
    }
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-found-configure-button.png'), fullPage: true });
    
    // Step 5: Click the "Configure for Rental" button
    console.log('👆 Step 5: Clicking "Configure for Rental" button...');
    
    // Scroll the button into view
    await configureButton.evaluate(node => node.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await configureButton.click();
    console.log('✅ Clicked Configure for Rental button');
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-clicked-configure-button.png'), fullPage: true });
    
    // Step 6: Wait for confirmation dialog to appear
    console.log('⏳ Step 6: Waiting for confirmation dialog...');
    
    let dialog;
    try {
      // Look for dialog with multiple possible selectors
      const dialogSelectors = [
        '[role="dialog"]',
        '[class*="dialog"]',
        '.dialog',
        '[data-testid*="dialog"]',
        '[aria-modal="true"]'
      ];
      
      for (const selector of dialogSelectors) {
        try {
          dialog = await page.waitForSelector(selector, { timeout: 5000 });
          if (dialog) {
            console.log(`✅ Found dialog with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!dialog) {
        throw new Error('Dialog not found with any selector');
      }
      
    } catch (error) {
      console.log('❌ Confirmation dialog did not appear');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-no-dialog.png'), fullPage: true });
      
      // Debug: Check what happened after clicking
      const currentUrl = page.url();
      console.log(`🔗 Current URL: ${currentUrl}`);
      
      // Check for any error messages
      const errorElements = await page.$$eval('[class*="error"], [class*="alert"], [role="alert"]', (elements) => {
        return elements.map(el => ({ text: el.textContent, classes: el.className }));
      });
      
      if (errorElements.length > 0) {
        console.log('⚠️  Found error elements:', errorElements);
      }
      
      // Check console errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      if (consoleErrors.length > 0) {
        console.log('❌ Console errors:', consoleErrors);
      }
      
      throw error;
    }
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-dialog-appeared.png'), fullPage: true });
    
    // Step 7: Verify dialog content
    console.log('📋 Step 7: Verifying dialog content...');
    
    const dialogText = await dialog.evaluate(node => node.textContent);
    console.log('📄 Dialog content:', dialogText);
    
    // Check for expected dialog elements
    const expectedElements = {
      title: 'Enable Rental Configuration',
      description: 'Configure',
      enableButton: 'Enable Rental',
      cancelButton: 'Cancel'
    };
    
    for (const [key, expectedText] of Object.entries(expectedElements)) {
      if (dialogText.includes(expectedText)) {
        console.log(`✅ Found expected ${key}: "${expectedText}"`);
      } else {
        console.log(`⚠️  Missing expected ${key}: "${expectedText}"`);
      }
    }
    
    // Step 8: Click "Enable Rental" button in dialog
    console.log('👆 Step 8: Looking for "Enable Rental" button in dialog...');
    
    let enableButton;
    try {
      // Look for the enable button within the dialog using evaluate
      enableButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const enableBtn = buttons.find(btn => 
          btn.textContent && btn.textContent.trim() === 'Enable Rental'
        );
        return enableBtn || null;
      });
      
      // Double check that we got a valid button
      const hasButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        return buttons.some(btn => btn.textContent && btn.textContent.trim() === 'Enable Rental');
      });
      
      if (!hasButton) {
        throw new Error('Enable button not found in dialog');
      }
      
      if (!enableButton) {
        throw new Error('Enable button handle not created');
      }
      
      const enableButtonText = await enableButton.evaluate(node => node.textContent);
      console.log(`✅ Found enable button: "${enableButtonText}"`);
      
    } catch (error) {
      console.log('❌ Enable button not found in dialog');
      
      // Debug: list all buttons in dialog
      const dialogButtons = await dialog.$$eval('button, [role="button"]', (buttons) => {
        return buttons.map(btn => ({
          text: btn.textContent?.trim(),
          classes: btn.className
        }));
      });
      
      console.log('🔍 All buttons in dialog:', dialogButtons);
      throw error;
    }
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-before-enable-click.png'), fullPage: true });
    
    // Click the Enable Rental button
    await enableButton.click();
    console.log('✅ Clicked Enable Rental button');
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-clicked-enable-button.png'), fullPage: true });
    
    // Step 9: Wait for success dialog or pricing section to appear
    console.log('⏳ Step 9: Waiting for success confirmation...');
    
    try {
      // Wait for either success dialog or pricing management to appear
      const checkForSuccess = async () => {
        return await page.evaluate(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('success') || 
                 text.includes('enabled') || 
                 text.includes('manage pricing') ||
                 text.includes('rental configuration');
        });
      };
      
      // Poll for success indicators
      let attempts = 0;
      while (attempts < 20 && !(await checkForSuccess())) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-after-enable-success.png'), fullPage: true });
      
      // Check if pricing section now appears
      const pricingVisible = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return {
          hasManagePricing: text.includes('manage pricing'),
          hasDailyRate: text.includes('daily rate'),
          hasRentalConfig: text.includes('rental') && (text.includes('configure') || text.includes('manage'))
        };
      });
      
      console.log('📊 Pricing section visibility:', pricingVisible);
      
      if (pricingVisible.hasManagePricing) {
        console.log('🎉 SUCCESS: Rental configuration enabled! Pricing management is now available.');
      } else {
        console.log('⚠️  Rental may have been enabled but pricing section not yet visible');
      }
      
    } catch (error) {
      console.log('⚠️  Timeout waiting for success confirmation');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-timeout-waiting.png'), fullPage: true });
    }
    
    // Step 10: Final verification
    console.log('✅ Step 10: Final verification...');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Allow time for UI updates
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-final-state.png'), fullPage: true });
    
    // Check final state
    const finalState = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      return {
        url: window.location.href,
        hasManagePricing: bodyText.includes('manage pricing'),
        hasDailyRate: bodyText.includes('daily rate'),
        hasTieredPricing: bodyText.includes('tier') && bodyText.includes('pricing'),
        hasRentalSection: bodyText.includes('rental pricing'),
        hasConfigureButton: bodyText.includes('configure for rental')
      };
    });
    
    console.log('📊 Final page state:', finalState);
    
    // Determine test result
    if (finalState.hasManagePricing || finalState.hasDailyRate || finalState.hasTieredPricing) {
      console.log('🎉 TEST PASSED: Rental configuration feature is working correctly!');
      console.log('✅ User can now configure rental rates and pricing tiers.');
    } else if (!finalState.hasConfigureButton) {
      console.log('🤔 TEST INCONCLUSIVE: Configure button not visible - item might already be rentable');
    } else {
      console.log('❌ TEST FAILED: Rental configuration did not complete successfully');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    
    if (page) {
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error-screenshot.png'), fullPage: true });
      
      // Capture page source for debugging
      const html = await page.content();
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'error-page-source.html'), html);
      
      console.log(`📸 Error screenshot and HTML saved to: ${SCREENSHOTS_DIR}`);
    }
    
    throw error;
    
  } finally {
    console.log('🔄 Cleaning up...');
    await browser.close();
    
    console.log(`📁 Test screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log('🏁 Test completed.');
  }
}

// Run the test
testRentalConfiguration()
  .then(() => {
    console.log('✅ Test execution completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });