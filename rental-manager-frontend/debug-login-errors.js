const puppeteer = require('puppeteer');

async function debugLoginErrors() {
  console.log('🔍 Starting comprehensive login error analysis...');
  
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text, timestamp: new Date().toISOString() });
    
    if (type === 'error') {
      console.log('❌ Browser Error:', text);
    } else if (type === 'warn') {
      console.log('⚠️  Browser Warning:', text);
    } else if (type === 'log' && (text.includes('API') || text.includes('auth') || text.includes('login'))) {
      console.log('ℹ️  Browser Log:', text);
    }
  });
  
  // Capture network requests
  const networkRequests = [];
  page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('auth') || url.includes('login')) {
      networkRequests.push({
        type: 'request',
        method: request.method(),
        url,
        headers: request.headers(),
        timestamp: new Date().toISOString()
      });
      console.log('📤 Network Request:', request.method(), url);
    }
  });
  
  page.on('response', response => {
    const url = response.url();
    if (url.includes('api') || url.includes('auth') || url.includes('login')) {
      networkRequests.push({
        type: 'response',
        status: response.status(),
        statusText: response.statusText(),
        url,
        headers: response.headers(),
        timestamp: new Date().toISOString()
      });
      console.log('📥 Network Response:', response.status(), response.statusText(), url);
    }
  });
  
  try {
    console.log('🌐 Navigating to login page...');
    await page.goto('http://localhost:3000/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for page to load
    console.log('⏳ Waiting for login form...');
    await page.waitForSelector('form', { timeout: 15000 });
    
    // Check environment configuration
    const envInfo = await page.evaluate(() => {
      return {
        apiUrl: window.location.origin,
        nextPublicApiUrl: process?.env?.NEXT_PUBLIC_API_URL || 'not accessible',
        userAgent: navigator.userAgent,
        href: window.location.href
      };
    });
    console.log('🔧 Environment Info:', envInfo);
    
    // Test demo login to capture errors
    console.log('🎭 Testing demo login to capture errors...');
    
    // Click demo admin button
    const buttonClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const adminButton = buttons.find(btn => 
        btn.textContent?.trim() === 'Demo as Administrator'
      );
      
      if (adminButton) {
        adminButton.click();
        return true;
      }
      return false;
    });
    
    if (buttonClicked) {
      console.log('✅ Demo admin button clicked');
      
      // Wait for API call and capture errors
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check for any error messages on page
      const errorMessages = await page.evaluate(() => {
        const errorSelectors = [
          '[role="alert"]',
          '.alert-error',
          '.error',
          '.text-red-500',
          '.text-red-600',
          '.text-destructive'
        ];
        
        const errors = [];
        errorSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (el.textContent?.trim()) {
              errors.push({
                selector,
                text: el.textContent.trim(),
                visible: el.offsetParent !== null
              });
            }
          });
        });
        
        return errors;
      });
      
      console.log('🔍 Error messages found:', errorMessages);
      
    } else {
      console.log('❌ Could not click demo admin button');
    }
    
    // Wait a bit more to capture any delayed errors
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate comprehensive report
    console.log('\n📊 COMPREHENSIVE ERROR ANALYSIS REPORT');
    console.log('═'.repeat(60));
    
    console.log('\n🔧 Environment Configuration:');
    console.log(`  API URL: ${envInfo.nextPublicApiUrl}`);
    console.log(`  Current Page: ${envInfo.href}`);
    
    console.log('\n📤 Network Requests:');
    networkRequests.forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.type.toUpperCase()}: ${req.method || ''} ${req.url}`);
      if (req.status) {
        console.log(`     Status: ${req.status} ${req.statusText || ''}`);
      }
    });
    
    console.log('\n🔍 Console Messages:');
    consoleMessages.forEach((msg, i) => {
      if (msg.type === 'error' || msg.type === 'warn' || 
          (msg.type === 'log' && (msg.text.includes('API') || msg.text.includes('auth')))) {
        console.log(`  ${i + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
      }
    });
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      environment: envInfo,
      networkRequests,
      consoleMessages,
      errorMessages
    };
    
    const fs = require('fs');
    fs.writeFileSync(
      'login-error-analysis-report.json', 
      JSON.stringify(report, null, 2)
    );
    console.log('\n📄 Detailed report saved: login-error-analysis-report.json');
    
  } catch (error) {
    console.error('💥 Debug session failed:', error.message);
  } finally {
    console.log('\n⏸️  Browser will stay open for 10 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await browser.close();
    console.log('🔚 Debug session completed');
  }
}

debugLoginErrors().catch(console.error);