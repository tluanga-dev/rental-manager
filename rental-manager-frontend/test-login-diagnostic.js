const puppeteer = require('puppeteer');

async function diagnosticTest() {
  console.log('🔍 Running Login Page Diagnostic Test');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    defaultViewport: { width: 1280, height: 720 }
  });
  
  const page = await browser.newPage();
  
  try {
    // Check frontend access
    console.log('📍 1. Testing frontend access...');
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2', timeout: 10000 });
    
    const rootUrl = page.url();
    console.log(`✅ Root page accessible: ${rootUrl}`);
    
    const pageTitle = await page.title();
    console.log(`📄 Page title: ${pageTitle}`);
    
    // Try login page
    console.log('\n📍 2. Testing login page access...');
    try {
      await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle2', timeout: 10000 });
      const loginUrl = page.url();
      console.log(`✅ Login page accessible: ${loginUrl}`);
    } catch (loginError) {
      console.log(`❌ Login page error: ${loginError.message}`);
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-screenshots/login-diagnostic-error.png', fullPage: true });
    }
    
    // List all buttons on the page
    console.log('\n📍 3. Analyzing page elements...');
    const buttons = await page.$$('button');
    console.log(`🔘 Found ${buttons.length} buttons on page`);
    
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      try {
        const text = await page.evaluate(el => el.textContent.trim(), buttons[i]);
        const classes = await page.evaluate(el => el.className, buttons[i]);
        console.log(`   Button ${i + 1}: "${text}" (classes: ${classes})`);
      } catch (e) {
        console.log(`   Button ${i + 1}: Could not read text`);
      }
    }
    
    // Check for forms
    const forms = await page.$$('form');
    console.log(`📝 Found ${forms.length} forms on page`);
    
    // Check for input fields
    const inputs = await page.$$('input');
    console.log(`📥 Found ${inputs.length} input fields on page`);
    
    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      try {
        const type = await page.evaluate(el => el.type, inputs[i]);
        const name = await page.evaluate(el => el.name || 'unnamed', inputs[i]);
        const placeholder = await page.evaluate(el => el.placeholder || 'no placeholder', inputs[i]);
        console.log(`   Input ${i + 1}: type="${type}", name="${name}", placeholder="${placeholder}"`);
      } catch (e) {
        console.log(`   Input ${i + 1}: Could not read attributes`);
      }
    }
    
    await page.screenshot({ path: 'test-screenshots/diagnostic-full-page.png', fullPage: true });
    console.log('\n📸 Screenshot saved: diagnostic-full-page.png');
    
    // Keep browser open for manual inspection
    console.log('\n⏱️  Browser will stay open for 15 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('❌ Diagnostic test error:', error.message);
    await page.screenshot({ path: 'test-screenshots/diagnostic-error.png', fullPage: true });
  } finally {
    await browser.close();
    console.log('✅ Diagnostic test completed');
  }
}

diagnosticTest().catch(console.error);