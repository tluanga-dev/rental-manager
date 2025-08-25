#!/usr/bin/env node

/**
 * Simple Brand Creation Test
 * Tests brand creation through the UI after API endpoint fix
 */

const puppeteer = require('puppeteer');

async function testBrandCreation() {
  console.log('🧪 Testing Brand Creation...');
  console.log('=====================================');
  
  let browser = null;
  const errors = [];
  const apiRequests = [];
  
  try {
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Monitor API requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/v1/') && url.includes('brands')) {
        apiRequests.push({
          method: request.method(),
          url: url,
          type: 'request'
        });
        console.log(`🌐 Request: ${request.method()} ${url}`);
      }
    });
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/v1/') && url.includes('brands')) {
        apiRequests.push({
          url: url,
          status: response.status(),
          statusText: response.statusText(),
          type: 'response'
        });
        console.log(`📡 Response: ${response.status()} ${response.statusText()} - ${url}`);
        
        if (response.status() === 404) {
          errors.push(`404 Not Found: ${url}`);
        }
      }
    });
    
    // Step 1: Navigate to login page
    console.log('\n1. Navigating to application...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Step 2: Login using Demo as Administrator button
    console.log('2. Logging in as administrator...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Click Demo as Administrator button using text content
    const demoButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const button = buttons.find(btn => btn.textContent.includes('Demo as Administrator'));
      if (button) {
        button.click();
        return true;
      }
      return false;
    });
    
    if (!demoButton) {
      throw new Error('Demo as Administrator button not found');
    }
    
    // Wait for navigation after login
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Navigate to brands page
    console.log('3. Navigating to brands page...');
    await page.goto('http://localhost:3000/products/brands', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Click Add Brand button
    console.log('4. Opening Add Brand dialog...');
    const addBrandClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const button = buttons.find(btn => btn.textContent.includes('Add Brand'));
      if (button) {
        button.click();
        return true;
      }
      return false;
    });
    
    if (!addBrandClicked) {
      console.log('⚠️ Add Brand button not found - may need to wait for page load');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 5: Fill the form
    console.log('5. Filling brand form...');
    const timestamp = Date.now();
    const brandName = `Test Brand ${timestamp}`;
    
    // Try to fill the brand name input
    const nameInput = await page.$('#brand-name');
    if (nameInput) {
      await nameInput.type(brandName);
      console.log(`   Entered brand name: ${brandName}`);
    } else {
      console.log('   ⚠️ Brand name input not found');
    }
    
    // Try to fill the brand code
    const codeInput = await page.$('#brand-code');
    if (codeInput) {
      await codeInput.type(`TEST-${timestamp}`);
      console.log(`   Entered brand code: TEST-${timestamp}`);
    }
    
    // Try to fill description
    const descInput = await page.$('#description');
    if (descInput) {
      await descInput.type('Test brand created by Puppeteer');
      console.log('   Entered description');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 6: Submit the form
    console.log('6. Submitting brand form...');
    const submitClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const button = buttons.find(btn => btn.textContent.includes('Create Brand'));
      if (button) {
        button.click();
        return true;
      }
      return false;
    });
    
    if (!submitClicked) {
      console.log('   ⚠️ Create Brand button not found');
    }
    
    // Wait for API response
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Analysis
    console.log('\n📊 ANALYSIS:');
    console.log('===============');
    
    const totalRequests = apiRequests.filter(r => r.type === 'request').length;
    const totalResponses = apiRequests.filter(r => r.type === 'response').length;
    console.log(`🌐 Total API requests: ${totalRequests}`);
    console.log(`📡 Total API responses: ${totalResponses}`);
    
    // Check for incorrect endpoints
    const incorrectRequests = apiRequests.filter(r => r.url && r.url.includes('/master-data/brands/'));
    console.log(`❌ Incorrect endpoints (/master-data/brands/): ${incorrectRequests.length}`);
    
    // Check for correct endpoints
    const correctRequests = apiRequests.filter(r => 
      r.url && r.url.includes('/api/v1/brands/') && !r.url.includes('/master-data/')
    );
    console.log(`✅ Correct endpoints (/api/v1/brands/): ${correctRequests.length}`);
    
    // Check for 404 errors
    const notFoundErrors = apiRequests.filter(r => r.status === 404);
    console.log(`🚨 404 Not Found errors: ${notFoundErrors.length}`);
    
    if (notFoundErrors.length > 0) {
      console.log('\n❌ 404 Errors found:');
      notFoundErrors.forEach(error => {
        console.log(`   - ${error.url}`);
      });
    }
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    }
    
    // Final result
    console.log('\n🎯 RESULTS:');
    console.log('============');
    
    if (incorrectRequests.length === 0 && notFoundErrors.length === 0 && correctRequests.length > 0) {
      console.log('🎉 SUCCESS: Brand API endpoint fix is working!');
      console.log('✅ No incorrect endpoints detected');
      console.log('✅ No 404 errors found');
      console.log('✅ Using correct /api/v1/brands/ endpoints');
      return true;
    } else if (incorrectRequests.length > 0) {
      console.log('❌ ISSUES DETECTED:');
      console.log('❌ Still using incorrect /master-data/brands/ endpoints');
      console.log('❌ The fix was not applied correctly');
      return false;
    } else if (notFoundErrors.length > 0) {
      console.log('❌ ISSUES DETECTED:');
      console.log('❌ 404 errors still occurring');
      console.log('❌ API endpoints may not be configured correctly');
      return false;
    } else if (correctRequests.length === 0) {
      console.log('⚠️ WARNING:');
      console.log('⚠️ No brand API calls detected');
      console.log('⚠️ The form may not have been submitted properly');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testBrandCreation().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});