const puppeteer = require('puppeteer');

async function simpleInventoryTest() {
  console.log('🚀 Simple Inventory Page Test');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  try {
    const page = await browser.newPage();
    
    // Track API calls
    const apiCalls = [];
    page.on('request', request => {
      if (request.url().includes('/api/inventory/stocks_info_all_items_brief')) {
        apiCalls.push(request.url());
        console.log('🌐 Inventory API called:', request.url());
      }
    });
    
    console.log('📄 Going to inventory page...');
    await page.goto('http://localhost:3000/inventory', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Check if login is needed
    const hasLoginForm = await page.$('input[type="password"]') !== null;
    
    if (hasLoginForm) {
      console.log('🔐 Login required...');
      
      try {
        await page.type('input[name="username"], input[type="email"]', 'admin');
        await page.type('input[type="password"]', 'YourSecure@Password123!');
        
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
        
        // Go to inventory page again
        await page.goto('http://localhost:3000/inventory', { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        
        console.log('✅ Login successful');
      } catch (error) {
        console.log('❌ Login error:', error.message);
      }
    }
    
    // Wait a bit and check what's on the page
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Simple checks
    const pageContent = await page.content();
    const hasInventoryText = pageContent.includes('Item Inventory') || pageContent.includes('inventory');
    const hasTable = await page.$('table') !== null;
    const hasCards = await page.$$('.card, [class*="card"]').then(els => els.length > 0);
    
    console.log('\n📊 Page Content Check:');
    console.log(`   Has inventory text: ${hasInventoryText}`);
    console.log(`   Has table: ${hasTable}`);
    console.log(`   Has cards: ${hasCards}`);
    console.log(`   API calls made: ${apiCalls.length}`);
    
    if (apiCalls.length > 0) {
      console.log(`   Last API call: ${apiCalls[apiCalls.length - 1]}`);
    }
    
    // Count elements
    const tableRows = await page.$$('tbody tr').then(rows => rows.length);
    const buttons = await page.$$('button').then(btns => btns.length);
    const inputs = await page.$$('input').then(inputs => inputs.length);
    
    console.log('\n🔢 Element Count:');
    console.log(`   Table rows: ${tableRows}`);
    console.log(`   Buttons: ${buttons}`);
    console.log(`   Inputs: ${inputs}`);
    
    // Get sample button texts
    const sampleButtons = await page.$$eval('button', buttons => 
      buttons.slice(0, 5).map(btn => btn.textContent?.trim()).filter(text => text)
    );
    console.log(`   Sample buttons: ${sampleButtons.join(', ')}`);
    
    // Take screenshot
    const timestamp = Date.now();
    await page.screenshot({ 
      path: `simple-inventory-test-${timestamp}.png`,
      fullPage: true 
    });
    console.log(`\n📸 Screenshot: simple-inventory-test-${timestamp}.png`);
    
    // Wait for manual inspection
    console.log('\n⏳ Keeping browser open for 20 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Final status
    const isWorking = hasInventoryText && (hasTable || hasCards) && apiCalls.length > 0;
    console.log(`\n🎯 Overall Status: ${isWorking ? '✅ WORKING' : '❌ NOT WORKING'}`);
    
    if (isWorking) {
      console.log('🎉 Inventory page appears to be working correctly!');
    } else {
      console.log('⚠️  Inventory page needs attention.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    try {
      const timestamp = Date.now();
      await page.screenshot({ 
        path: `simple-inventory-error-${timestamp}.png`,
        fullPage: true 
      });
      console.log(`📸 Error screenshot: simple-inventory-error-${timestamp}.png`);
    } catch (screenshotError) {
      console.log('Could not take error screenshot');
    }
  } finally {
    await browser.close();
  }
}

simpleInventoryTest();