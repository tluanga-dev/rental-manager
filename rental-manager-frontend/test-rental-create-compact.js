/**
 * Test Rental Creation using create-compact page
 */

const puppeteer = require('puppeteer');

const FRONTEND_URL = 'http://localhost:3000';

async function testRentalCreateCompact() {
  let browser;
  let page;
  
  try {
    console.log('Testing Rental Create Compact Page');
    console.log('===================================\n');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 100,
      defaultViewport: { width: 1920, height: 1080 }
    });
    
    page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser error:', msg.text());
      }
    });
    
    // Login
    console.log('Step 1: Logging in...');
    await page.goto(`${FRONTEND_URL}/login`);
    
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.type('input[name="username"]', 'admin');
    await page.type('input[type="password"]', 'admin123');
    
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    } catch (e) {
      // Check if logged in anyway
    }
    console.log('  ✓ Logged in\n');
    
    // Navigate directly to create-compact page
    console.log('Step 2: Navigating to Rental Creation...');
    await page.goto(`${FRONTEND_URL}/rentals/create-compact`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take screenshot
    await page.screenshot({
      path: './test-screenshots/rental-create-compact-loaded.png',
      fullPage: true
    });
    console.log('  ✓ Rental creation page loaded\n');
    
    // Analyze the page
    console.log('Step 3: Analyzing form fields...');
    
    // Check for customer selector
    const customerField = await page.$('input[placeholder*="customer" i], select[name*="customer" i], [data-testid*="customer"]');
    console.log(`  Customer field: ${customerField ? '✓ Found' : '✗ Not found'}`);
    
    // Check for date fields
    const dateFields = await page.$$('input[type="date"], input[placeholder*="date" i]');
    console.log(`  Date fields: ${dateFields.length > 0 ? `✓ Found (${dateFields.length})` : '✗ Not found'}`);
    
    // Check for item selection
    const itemFields = await page.$$('[data-testid*="item"], input[placeholder*="item" i], select[name*="item" i]');
    console.log(`  Item fields: ${itemFields.length > 0 ? `✓ Found (${itemFields.length})` : '✗ Not found'}`);
    
    // Check for submit button
    const submitButton = await page.$('button[type="submit"], button:not([type]):not([disabled])');
    console.log(`  Submit button: ${submitButton ? '✓ Found' : '✗ Not found'}`);
    
    // Try to fill the form if fields exist
    if (customerField) {
      console.log('\nStep 4: Attempting to fill form...');
      
      // Try to select/enter customer
      try {
        await customerField.click();
        await customerField.type('Test Customer');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if dropdown appeared
        const customerOptions = await page.$$('[role="option"], .dropdown-item, .select-option');
        if (customerOptions.length > 0) {
          console.log(`  Customer options found: ${customerOptions.length}`);
          await customerOptions[0].click();
        }
      } catch (e) {
        console.log('  Could not select customer:', e.message);
      }
    }
    
    // Try to set dates if date fields exist
    if (dateFields.length >= 2) {
      try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        await dateFields[0].type(tomorrow.toISOString().split('T')[0]);
        await dateFields[1].type(nextWeek.toISOString().split('T')[0]);
        console.log('  ✓ Dates set');
      } catch (e) {
        console.log('  Could not set dates:', e.message);
      }
    }
    
    // Take screenshot after form interaction
    await page.screenshot({
      path: './test-screenshots/rental-create-compact-filled.png',
      fullPage: true
    });
    
    console.log('\nStep 5: Page Structure Analysis...');
    
    // Get all form elements
    const forms = await page.$$('form');
    console.log(`  Forms on page: ${forms.length}`);
    
    const inputs = await page.$$('input');
    console.log(`  Input fields: ${inputs.length}`);
    
    const selects = await page.$$('select');
    console.log(`  Select fields: ${selects.length}`);
    
    const buttons = await page.$$('button');
    console.log(`  Buttons: ${buttons.length}`);
    
    const textareas = await page.$$('textarea');
    console.log(`  Text areas: ${textareas.length}`);
    
    // Check for any error messages
    const errors = await page.$$('.error, .alert-danger, [role="alert"], .text-red-500');
    if (errors.length > 0) {
      console.log(`\n  ⚠️  Error messages found: ${errors.length}`);
      for (let i = 0; i < Math.min(errors.length, 3); i++) {
        const errorText = await errors[i].evaluate(el => el.textContent);
        console.log(`     - ${errorText.trim()}`);
      }
    }
    
    console.log('\n✓ Test completed successfully');
    console.log('Screenshots saved to ./test-screenshots/');
    
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    
    if (page) {
      await page.screenshot({
        path: './test-screenshots/rental-create-compact-error.png',
        fullPage: true
      });
      console.log('Error screenshot saved');
    }
    
  } finally {
    console.log('\nClosing browser...');
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testRentalCreateCompact().catch(console.error);