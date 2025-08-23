const puppeteer = require('puppeteer');

async function debugLoginPage() {
  console.log('🔍 Starting login page debug session...');
  
  const browser = await puppeteer.launch({
    headless: false, // Run in visible mode for debugging
    slowMo: 500,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('📱 Navigating to login page...');
    await page.goto('http://localhost:3000/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for page to fully load...');
    
    // Wait for loading to complete
    try {
      await page.waitForSelector('.animate-spin', { timeout: 3000 });
      console.log('⏳ Loading spinner found, waiting for it to disappear...');
      await page.waitForSelector('.animate-spin', { hidden: true, timeout: 20000 });
      console.log('✅ Loading spinner disappeared');
    } catch (e) {
      console.log('ℹ️ No loading spinner detected');
    }
    
    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🔍 Analyzing page content...');
    
    // Get page title
    const title = await page.title();
    console.log('📄 Page title:', title);
    
    // Get current URL
    const url = page.url();
    console.log('🌐 Current URL:', url);
    
    // Check if form exists
    const formExists = await page.$('form') !== null;
    console.log('📝 Form exists:', formExists);
    
    // Get all buttons
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(btn => ({
        text: btn.textContent?.trim(),
        disabled: btn.disabled,
        className: btn.className,
        visible: btn.offsetParent !== null
      }));
    });
    
    console.log('🔍 Found buttons:', JSON.stringify(buttons, null, 2));
    
    // Get all text content to see what's actually rendered
    const bodyText = await page.evaluate(() => document.body.textContent);
    console.log('📄 Page content snippet:', bodyText.substring(0, 500));
    
    // Check for specific elements
    const elementChecks = {
      'form': await page.$('form') !== null,
      'input[name="username"]': await page.$('input[name="username"]') !== null,
      'input[name="password"]': await page.$('input[name="password"]') !== null,
      'button[type="submit"]': await page.$('button[type="submit"]') !== null,
      'Demo as Administrator text': bodyText.includes('Demo as Administrator'),
      'Login form text': bodyText.includes('Login')
    };
    
    console.log('✅ Element presence check:', JSON.stringify(elementChecks, null, 2));
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: 'debug-login-screenshot.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved as debug-login-screenshot.png');
    
    // Check console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Browser console error:', msg.text());
      }
    });
    
    // Wait for user to inspect
    console.log('⏸️ Browser will stay open for 10 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('💥 Debug session failed:', error.message);
  } finally {
    await browser.close();
    console.log('🔚 Debug session ended');
  }
}

debugLoginPage().catch(console.error);