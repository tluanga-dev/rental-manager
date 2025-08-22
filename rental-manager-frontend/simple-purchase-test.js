const puppeteer = require('puppeteer');

async function testPurchasePageDirectly() {
    let browser;
    let page;
    
    try {
        console.log('🚀 Testing purchase details page directly...');
        
        browser = await puppeteer.launch({
            headless: false,
            slowMo: 50,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        
        // Enable console logging
        page.on('console', msg => {
            const type = msg.type();
            console.log(`Console ${type.toUpperCase()}: ${msg.text()}`);
        });
        
        // Go directly to login
        console.log('🔐 Navigating to login page...');
        await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
        
        // Login as admin
        await page.type('input[type="email"]', 'admin@admin.com');
        await page.type('input[type="password"]', 'YourSecure@Password123!');
        await page.click('button[type="submit"]');
        
        // Wait for login to complete
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        // Navigate to the purchase details page
        console.log('🛒 Navigating to purchase details...');
        await page.goto('http://localhost:3000/purchases/history/7fc85d4e-0ac9-4d10-8009-75993365b1da', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Take screenshot for verification
        await page.screenshot({ 
            path: 'purchase-details-final.png', 
            fullPage: true 
        });
        console.log('📸 Screenshot saved as purchase-details-final.png');
        
        // Check page content
        const bodyText = await page.evaluate(() => document.body.innerText);
        console.log('\n📄 Page Content Summary:');
        console.log('======================');
        console.log(`Content length: ${bodyText.length} characters`);
        
        // Check for key elements
        const hasError = bodyText.includes('Failed to load') || bodyText.includes('Error');
        const hasBackButton = bodyText.includes('Back');
        const hasPurchaseInfo = bodyText.includes('Purchase') && bodyText.includes('PUR-');
        const hasAmount = bodyText.includes('₹') || bodyText.includes('Amount');
        const hasSupplier = bodyText.includes('Supplier');
        const hasItems = bodyText.includes('Item') || bodyText.includes('Quantity');
        
        console.log(`❌ Has Error: ${hasError}`);
        console.log(`✅ Has Back Button: ${hasBackButton}`);
        console.log(`✅ Has Purchase Info: ${hasPurchaseInfo}`);
        console.log(`✅ Has Amount: ${hasAmount}`);
        console.log(`✅ Has Supplier: ${hasSupplier}`);
        console.log(`✅ Has Items: ${hasItems}`);
        
        // Sample of the content
        const sampleContent = bodyText.substring(0, 500);
        console.log('\n📝 Sample Content:');
        console.log(sampleContent);
        
        const success = !hasError && hasBackButton && hasPurchaseInfo;
        return success;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    } finally {
        if (page) await page.close();
        if (browser) await browser.close();
    }
}

// Run the test
testPurchasePageDirectly()
    .then(success => {
        if (success) {
            console.log('\n🎉 Purchase details page appears to be working!');
        } else {
            console.log('\n❌ Purchase details page has issues.');
        }
    })
    .catch(console.error);