#!/usr/bin/env node
/**
 * Test purchase creation through the frontend using Puppeteer
 * Creates a new purchase transaction via the UI
 */

const puppeteer = require('puppeteer');

async function testPurchaseCreation() {
    console.log('🚀 Starting Purchase Creation Test via Frontend');
    console.log('=========================================\n');
    
    const browser = await puppeteer.launch({
        headless: false, // Set to true for CI/CD
        slowMo: 50, // Slow down actions for visibility
        args: ['--window-size=1920,1080']
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Navigate to login page
        console.log('📍 Step 1: Navigating to login page...');
        await page.goto('http://localhost:3000/login', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Login
        console.log('🔐 Step 2: Logging in...');
        await page.type('input[name="email"]', 'admin@admin.com');
        await page.type('input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        
        // Wait for navigation to complete
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log('✅ Login successful');
        
        // Navigate to purchases page
        console.log('📍 Step 3: Navigating to purchases...');
        await page.goto('http://localhost:3000/purchases', { 
            waitUntil: 'networkidle2' 
        });
        
        // Click "New Purchase" button
        console.log('➕ Step 4: Clicking New Purchase button...');
        await page.waitForSelector('button:has-text("New Purchase"), a:has-text("New Purchase")', { timeout: 10000 });
        await page.click('button:has-text("New Purchase"), a:has-text("New Purchase")');
        
        // Wait for form to load
        await page.waitForSelector('form', { timeout: 10000 });
        console.log('📝 Purchase form loaded');
        
        // Fill in purchase details
        console.log('📋 Step 5: Filling purchase details...');
        
        // Select supplier (click dropdown and select first option)
        const supplierSelector = 'select[name="supplier_id"], #supplier_id, [data-testid="supplier-select"]';
        await page.waitForSelector(supplierSelector, { timeout: 5000 });
        const supplierExists = await page.$(supplierSelector);
        if (supplierExists) {
            // Get available options
            const supplierOptions = await page.$$eval(`${supplierSelector} option`, options => 
                options.filter(opt => opt.value && opt.value !== '').map(opt => ({
                    value: opt.value,
                    text: opt.textContent
                }))
            );
            
            if (supplierOptions.length > 0) {
                console.log(`  - Selecting supplier: ${supplierOptions[0].text}`);
                await page.select(supplierSelector, supplierOptions[0].value);
            }
        }
        
        // Select location
        const locationSelector = 'select[name="location_id"], #location_id, [data-testid="location-select"]';
        await page.waitForSelector(locationSelector, { timeout: 5000 });
        const locationExists = await page.$(locationSelector);
        if (locationExists) {
            const locationOptions = await page.$$eval(`${locationSelector} option`, options => 
                options.filter(opt => opt.value && opt.value !== '').map(opt => ({
                    value: opt.value,
                    text: opt.textContent
                }))
            );
            
            if (locationOptions.length > 0) {
                console.log(`  - Selecting location: ${locationOptions[0].text}`);
                await page.select(locationSelector, locationOptions[0].value);
            }
        }
        
        // Set purchase date (today)
        const dateInput = await page.$('input[type="date"]');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            await page.evaluate((el, date) => el.value = date, dateInput, today);
            console.log(`  - Set purchase date: ${today}`);
        }
        
        // Set reference number
        const timestamp = Date.now();
        const refNumber = `PO-TEST-${timestamp}`;
        await page.type('input[name="reference_number"], #reference_number', refNumber);
        console.log(`  - Reference number: ${refNumber}`);
        
        // Add notes
        await page.type('textarea[name="notes"], #notes', 'Test purchase created via Puppeteer automation');
        
        // Add item to purchase
        console.log('🛒 Step 6: Adding items to purchase...');
        
        // Click "Add Item" button if it exists
        const addItemBtn = await page.$('button:has-text("Add Item")');
        if (addItemBtn) {
            await addItemBtn.click();
            await page.waitForTimeout(500);
        }
        
        // Select first available item
        const itemSelector = 'select[name*="item_id"], #item_id, [data-testid="item-select"]';
        const itemSelect = await page.$(itemSelector);
        if (itemSelect) {
            const itemOptions = await page.$$eval(`${itemSelector} option`, options => 
                options.filter(opt => opt.value && opt.value !== '').map(opt => ({
                    value: opt.value,
                    text: opt.textContent
                }))
            );
            
            if (itemOptions.length > 0) {
                console.log(`  - Selecting item: ${itemOptions[0].text}`);
                await page.select(itemSelector, itemOptions[0].value);
            }
        }
        
        // Set quantity
        await page.type('input[name*="quantity"], #quantity', '5');
        console.log('  - Quantity: 5');
        
        // Set unit cost
        await page.type('input[name*="unit_cost"], #unit_cost', '100.00');
        console.log('  - Unit cost: $100.00');
        
        // Set tax rate
        const taxInput = await page.$('input[name*="tax_rate"], #tax_rate');
        if (taxInput) {
            await page.type('input[name*="tax_rate"], #tax_rate', '10');
            console.log('  - Tax rate: 10%');
        }
        
        // Take screenshot before submission
        await page.screenshot({ 
            path: 'purchase-form-filled.png',
            fullPage: true 
        });
        console.log('📸 Screenshot saved: purchase-form-filled.png');
        
        // Submit the form
        console.log('🚀 Step 7: Submitting purchase...');
        
        // Find and click submit button
        const submitButton = await page.$('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save"), button:has-text("Create Purchase")');
        if (submitButton) {
            await submitButton.click();
            
            // Wait for either success message or navigation
            await Promise.race([
                page.waitForSelector('.toast-success, .success-message, [role="alert"]', { timeout: 10000 }),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
            ]).catch(() => {});
            
            console.log('✅ Purchase form submitted');
            
            // Check for success message or new URL
            const currentUrl = page.url();
            if (currentUrl.includes('/purchases') && !currentUrl.includes('/new')) {
                console.log('✅ Purchase created successfully!');
                
                // Try to find transaction number
                const transactionText = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    const purElement = elements.find(el => 
                        el.textContent && el.textContent.includes('PUR-')
                    );
                    return purElement ? purElement.textContent : null;
                });
                
                if (transactionText) {
                    const match = transactionText.match(/PUR-\d{8}-[A-Z0-9]+/);
                    if (match) {
                        console.log(`📋 Transaction Number: ${match[0]}`);
                    }
                }
            }
            
            // Take final screenshot
            await page.screenshot({ 
                path: 'purchase-created.png',
                fullPage: true 
            });
            console.log('📸 Final screenshot saved: purchase-created.png');
            
        } else {
            console.log('⚠️ Submit button not found');
        }
        
    } catch (error) {
        console.error('❌ Error during test:', error.message);
        
        // Take error screenshot
        const page = (await browser.pages())[0];
        if (page) {
            await page.screenshot({ 
                path: 'purchase-error.png',
                fullPage: true 
            });
            console.log('📸 Error screenshot saved: purchase-error.png');
        }
        
        throw error;
    } finally {
        console.log('\n🔚 Test completed');
        await browser.close();
    }
}

// Run the test
testPurchaseCreation()
    .then(() => {
        console.log('\n✅ Purchase creation test completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Purchase creation test failed:', error.message);
        process.exit(1);
    });