const puppeteer = require('puppeteer');
const fs = require('fs');

async function testSalePriceEditor() {
  let browser;
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting Sale Price Editor Test...');
    
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable request interception to log API calls
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().includes('/inventory/units/')) {
        console.log(`📡 API Request: ${request.method()} ${request.url()}`);
      }
      request.continue();
    });
    
    page.on('response', response => {
      if (response.url().includes('/inventory/units/') && response.url().includes('sale-price')) {
        console.log(`📡 API Response: ${response.status()} ${response.url()}`);
      }
    });
    
    // Navigate to login page
    console.log('📱 Navigating to login page...');
    await page.goto('http://localhost:3003/login', { waitUntil: 'networkidle2' });
    
    // Login
    console.log('🔐 Logging in...');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@rentalmanager.com');
    await page.type('input[type="password"]', 'admin123');
    
    // Click login button
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    console.log('✅ Login successful');
    
    // Navigate to inventory items
    console.log('📦 Navigating to inventory items...');
    await page.goto('http://localhost:3003/inventory/items', { waitUntil: 'networkidle2' });
    
    // Wait for inventory table to load
    await page.waitForSelector('table', { timeout: 10000 });
    console.log('✅ Inventory items page loaded');
    
    // Find the first inventory item link
    const firstItemLink = await page.$('table tbody tr:first-child a');
    if (!firstItemLink) {
      throw new Error('No inventory item found in table');
    }
    
    console.log('🔍 Clicking on first inventory item...');
    await firstItemLink.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    // Wait for item detail page to load
    await page.waitForSelector('h1', { timeout: 10000 });
    console.log('✅ Item detail page loaded');
    
    // Look for Units tab and click it
    console.log('📋 Looking for Units tab...');
    const unitsTab = await page.$x('//button[contains(text(), "Units")]');
    if (unitsTab.length > 0) {
      await unitsTab[0].click();
      await page.waitForTimeout(1000); // Wait for tab content to load
      console.log('✅ Units tab clicked');
    }
    
    // Look for a unit in the units table
    console.log('🔍 Looking for units in table...');
    await page.waitForSelector('table tbody tr', { timeout: 5000 });
    
    // Click on first unit to open unit detail
    const firstUnitLink = await page.$('table tbody tr:first-child a');
    if (firstUnitLink) {
      console.log('🔍 Clicking on first unit...');
      await firstUnitLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      
      // Wait for unit detail page to load
      await page.waitForSelector('h1', { timeout: 10000 });
      console.log('✅ Unit detail page loaded');
      
      // Look for sale price section
      console.log('💰 Looking for sale price editor...');
      
      // Wait for the sale price section to be visible
      const salePriceSection = await page.waitForSelector('::-p-text(Sale Price)', { timeout: 5000 });
      if (salePriceSection) {
        console.log('✅ Found sale price section');
        
        // Look for the SalePriceEditor component
        const changeButton = await page.$('button::-p-text(Change)');
        if (changeButton) {
          console.log('💡 Found Change button for sale price');
          
          // Take screenshot before edit
          await page.screenshot({ path: 'test-sale-price-before-edit.png', fullPage: true });
          console.log('📸 Screenshot taken: test-sale-price-before-edit.png');
          
          // Click the change button
          await changeButton.click();
          await page.waitForTimeout(1000);
          
          console.log('✏️ Change button clicked, looking for input field...');
          
          // Look for the input field
          const priceInput = await page.$('input[type="number"]');
          if (priceInput) {
            console.log('✅ Found price input field');
            
            // Clear and enter new price
            await priceInput.click({ clickCount: 3 }); // Select all
            await priceInput.type('999.99');
            
            console.log('💰 Entered new price: 999.99');
            
            // Look for save button (green check)
            const saveButton = await page.$('button .lucide-check');
            if (saveButton) {
              console.log('💾 Found save button, clicking...');
              
              await saveButton.click();
              await page.waitForTimeout(2000); // Wait for API call and toast
              
              console.log('✅ Save button clicked');
              
              // Take screenshot after edit
              await page.screenshot({ path: 'test-sale-price-after-edit.png', fullPage: true });
              console.log('📸 Screenshot taken: test-sale-price-after-edit.png');
              
              // Check for success toast
              const toast = await page.$('.toast, [data-testid="toast"], .toaster');
              if (toast) {
                const toastText = await toast.evaluate(el => el.textContent);
                console.log(`🎉 Toast message: ${toastText}`);
              }
              
              console.log('✅ Sale price update test completed successfully!');
              
            } else {
              console.log('❌ Save button not found');
              await page.screenshot({ path: 'test-sale-price-error-no-save-button.png', fullPage: true });
            }
            
          } else {
            console.log('❌ Price input field not found after clicking Change');
            await page.screenshot({ path: 'test-sale-price-error-no-input.png', fullPage: true });
          }
          
        } else {
          console.log('❌ Change button not found in sale price section');
          await page.screenshot({ path: 'test-sale-price-error-no-change-button.png', fullPage: true });
        }
        
      } else {
        console.log('❌ Sale price section not found');
        await page.screenshot({ path: 'test-sale-price-error-no-section.png', fullPage: true });
      }
      
    } else {
      console.log('❌ No units found in table');
      await page.screenshot({ path: 'test-sale-price-error-no-units.png', fullPage: true });
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\n🏁 Test completed in ${duration}s`);
    
    // Generate test report
    const report = {
      testName: 'Sale Price Editor Test',
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED',
      screenshots: [
        'test-sale-price-before-edit.png',
        'test-sale-price-after-edit.png'
      ]
    };
    
    fs.writeFileSync('test-sale-price-report.json', JSON.stringify(report, null, 2));
    console.log('📊 Test report saved: test-sale-price-report.json');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (browser) {
      const page = await browser.newPage();
      await page.screenshot({ path: 'test-sale-price-error.png', fullPage: true });
      console.log('📸 Error screenshot saved: test-sale-price-error.png');
    }
    
    // Generate error report
    const errorReport = {
      testName: 'Sale Price Editor Test',
      status: 'FAILED',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('test-sale-price-error-report.json', JSON.stringify(errorReport, null, 2));
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testSalePriceEditor().catch(console.error);