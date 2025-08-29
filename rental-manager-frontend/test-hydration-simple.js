#!/usr/bin/env node

/**
 * Simple Puppeteer test to check for hydration errors
 */

const puppeteer = require('puppeteer');

async function testHydrationErrors() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Capture console errors
  const hydrationErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      
      // Check for hydration-specific errors
      if (text.includes('hydration') || 
          text.includes('button') && text.includes('descendant') ||
          text.includes('validateDOMNesting') ||
          text.includes('cannot be a descendant of')) {
        hydrationErrors.push(text);
        console.log('🚨 HYDRATION ERROR DETECTED:', text);
      }
    }
  });

  try {
    console.log('🚀 Testing for hydration errors...');
    
    // Navigate to inventory items page
    await page.goto('http://localhost:3000/inventory/items', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('✅ Page loaded');

    // Wait for React hydration to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take a screenshot for verification
    await page.screenshot({ 
      path: 'hydration-simple-test.png',
      fullPage: false 
    });

    // Report results
    console.log('\n📋 Hydration Test Results:');
    console.log('==========================');
    
    if (hydrationErrors.length === 0) {
      console.log('✅ SUCCESS: No hydration errors detected!');
      console.log('✅ The nested button issue appears to be resolved.');
      return true;
    } else {
      console.log('❌ HYDRATION ERRORS FOUND:');
      hydrationErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
testHydrationErrors()
  .then(success => {
    console.log(success ? '\n🎉 Test PASSED!' : '\n💥 Test FAILED!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });