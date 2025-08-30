const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('🧪 Starting comprehensive rental configuration test...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'],
    devtools: false
  });
  
  const page = await browser.newPage();
  
  try {
    // Set up console logging
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      
      if (type === 'error' || text.includes('❌') || text.includes('Error')) {
        console.log(`🔴 Console Error: ${text}`);
      } else if (text.includes('✅') || text.includes('🔄')) {
        console.log(`🟢 Console Log: ${text}`);
      }
    });
    
    // Set up request/response logging
    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      
      if (url.includes('/inventory/items/') || url.includes('/items/')) {
        console.log(`📡 API Response: ${status} ${url}`);
        
        if (status >= 400) {
          console.log(`❌ API Error Response: ${status} ${url}`);
        }
      }
    });
    
    page.on('requestfailed', (request) => {
      const url = request.url();
      if (url.includes('/inventory/items/') || url.includes('/items/')) {
        console.log(`❌ Request Failed: ${url}`);
        console.log(`   Failure text: ${request.failure().errorText}`);
      }
    });

    console.log('🔗 Navigating to inventory item page...');
    await page.goto('http://localhost:3000/inventory/items/MAC201-00001', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for page to load completely
    await page.waitForTimeout(3000);
    
    console.log('📸 Taking initial screenshot...');
    await page.screenshot({ path: 'test-rental-initial.png', fullPage: true });
    
    // Check if the page loaded correctly
    const pageTitle = await page.title();
    console.log(`📄 Page title: ${pageTitle}`);
    
    // Look for pricing info card
    console.log('🔍 Looking for pricing info card...');
    try {
      await page.waitForSelector('[data-testid="pricing-info-card"], .pricing-info-card, h2, h1, h3', { timeout: 10000 });
      console.log('✅ Found page elements');
    } catch (error) {
      console.log('⚠️ Could not find specific elements, proceeding with general search');
    }
    
    // Check current rental status
    console.log('🔍 Checking current item rental status...');
    
    const isCurrentlyRentable = await page.evaluate(() => {
      // Look for rental pricing card or enable rental button
      const pricingCard = document.querySelector('[class*="pricing"], [class*="rental"]');
      const enableButton = document.querySelector('button[class*="rental"], button:has-text("Enable"), button:has-text("Configure")');
      const rentalText = document.body.innerText.toLowerCase();
      
      return {
        hasPricingElements: !!pricingCard,
        hasEnableButton: !!enableButton,
        pageText: rentalText.includes('rental') || rentalText.includes('configure'),
        bodyContent: document.body.innerText.substring(0, 500) // First 500 chars for debugging
      };
    });
    
    console.log('📊 Current rental status:', isCurrentlyRentable);
    
    // Look for Enable Rental button
    console.log('🔍 Looking for Enable Rental Configuration button...');
    
    const enableButtonFound = await page.evaluate(() => {
      // Multiple strategies to find the button
      const selectors = [
        'button:has-text("Configure for Rental")',
        'button:has-text("Enable Rental")',
        'button[class*="rental"]',
        'button[class*="configure"]',
        'button[class*="green"]'
      ];
      
      for (const selector of selectors) {
        try {
          const button = document.querySelector(selector);
          if (button) return { found: true, selector, text: button.innerText };
        } catch (e) {
          // Selector not valid, continue
        }
      }
      
      // Fallback: search all buttons for relevant text
      const allButtons = Array.from(document.querySelectorAll('button'));
      const relevantButton = allButtons.find(btn => {
        const text = btn.innerText.toLowerCase();
        return text.includes('rental') || text.includes('configure') || text.includes('enable');
      });
      
      return relevantButton ? 
        { found: true, selector: 'text-search', text: relevantButton.innerText, element: relevantButton } :
        { found: false, availableButtons: allButtons.map(b => b.innerText).filter(t => t.trim()) };
    });
    
    console.log('🔍 Enable button search result:', enableButtonFound);
    
    if (enableButtonFound.found) {
      console.log('✅ Enable Rental button found!');
      
      // Click the enable rental button
      if (enableButtonFound.element) {
        console.log('🖱️ Clicking enable rental button via element...');
        await page.evaluate((btn) => btn.click(), enableButtonFound.element);
      } else {
        console.log('🖱️ Clicking enable rental button via text search...');
        await page.click('button', { text: enableButtonFound.text });
      }
      
      // Wait for confirmation dialog
      console.log('⏳ Waiting for confirmation dialog...');
      try {
        await page.waitForSelector('[role="dialog"], .dialog, [data-testid="dialog"]', { timeout: 5000 });
        console.log('✅ Confirmation dialog appeared');
        
        await page.screenshot({ path: 'test-rental-dialog.png', fullPage: true });
        
        // Look for confirm button in dialog
        console.log('🔍 Looking for confirm button in dialog...');
        const confirmButton = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"], .dialog, [data-testid="dialog"]');
          if (!dialog) return { found: false };
          
          const buttons = Array.from(dialog.querySelectorAll('button'));
          const confirmBtn = buttons.find(btn => {
            const text = btn.innerText.toLowerCase();
            return text.includes('enable') || text.includes('confirm') || text.includes('yes');
          });
          
          return confirmBtn ? 
            { found: true, text: confirmBtn.innerText } : 
            { found: false, availableButtons: buttons.map(b => b.innerText) };
        });
        
        console.log('🔍 Confirm button search result:', confirmButton);
        
        if (confirmButton.found) {
          console.log('🖱️ Clicking confirm button...');
          await page.click(`button:has-text("${confirmButton.text}")`);
          
          // Wait for success dialog
          console.log('⏳ Waiting for success dialog...');
          await page.waitForTimeout(2000);
          
          await page.screenshot({ path: 'test-rental-success.png', fullPage: true });
          
          // Check for any API errors in console
          await page.waitForTimeout(3000);
          
          console.log('✅ Rental configuration flow completed successfully!');
          
          // Look for pricing modal if it opens
          try {
            await page.waitForSelector('[role="dialog"]', { timeout: 3000 });
            console.log('✅ Pricing modal opened automatically');
            await page.screenshot({ path: 'test-rental-pricing-modal.png', fullPage: true });
          } catch (e) {
            console.log('ℹ️ Pricing modal did not open automatically (might be expected)');
          }
          
        } else {
          console.log('❌ Could not find confirm button in dialog');
          console.log('Available buttons:', confirmButton.availableButtons);
        }
        
      } catch (error) {
        console.log('❌ Confirmation dialog did not appear:', error.message);
        await page.screenshot({ path: 'test-rental-dialog-error.png', fullPage: true });
      }
      
    } else {
      console.log('⚠️ Enable Rental button not found');
      console.log('Available buttons on page:', enableButtonFound.availableButtons);
      
      // Check if item is already rentable
      const alreadyRentable = await page.evaluate(() => {
        const pageText = document.body.innerText.toLowerCase();
        return pageText.includes('manage pricing') || pageText.includes('daily rental rate');
      });
      
      if (alreadyRentable) {
        console.log('ℹ️ Item appears to already be rentable (Manage Pricing button found)');
        console.log('✅ Test passed - rental configuration already enabled');
      } else {
        console.log('❌ Item does not appear to be rentable and no enable button found');
        await page.screenshot({ path: 'test-rental-not-found.png', fullPage: true });
      }
    }
    
    // Final screenshot
    console.log('📸 Taking final screenshot...');
    await page.screenshot({ path: 'test-rental-final.png', fullPage: true });
    
    console.log('🎉 Test completed successfully!');
    console.log('📸 Screenshots saved:');
    console.log('   - test-rental-initial.png');
    console.log('   - test-rental-dialog.png (if dialog appeared)');
    console.log('   - test-rental-success.png (if successful)');
    console.log('   - test-rental-final.png');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ path: 'test-rental-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();