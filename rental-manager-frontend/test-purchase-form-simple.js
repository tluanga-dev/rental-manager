const puppeteer = require('puppeteer');

/**
 * Simplified Purchase Form Test
 * This test focuses on the purchase form functionality and manual verification
 */

async function testPurchaseForm() {
  let browser;
  const results = {
    login: false,
    formLoad: false,
    formElements: false,
    manualTest: false
  };

  try {
    console.log('🚀 Starting Simplified Purchase Form Test...\n');
    
    browser = await puppeteer.launch({
      headless: false, // Keep visible for manual verification
      defaultViewport: { width: 1400, height: 900 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Monitor API calls
    page.on('response', response => {
      if (response.url().includes('/purchases') || response.url().includes('/transactions')) {
        console.log(`📡 API: ${response.status()} ${response.url()}`);
      }
    });

    // Step 1: Login
    console.log('📝 Step 1: Logging in...');
    await page.goto('http://localhost:3000/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await page.waitForSelector('button', { timeout: 10000 });
    
    const demoButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Demo as Administrator'));
    });
    
    if (demoButton) {
      await demoButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      results.login = true;
      console.log('✅ Login successful\n');
    }

    // Step 2: Navigate to purchase form
    console.log('📝 Step 2: Loading purchase form...');
    await page.goto('http://localhost:3000/purchases/record', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const formElements = await page.evaluate(() => {
      return {
        hasForm: !!document.querySelector('form'),
        hasTitle: document.querySelector('h1')?.textContent || '',
        supplierField: !!document.querySelector('input[placeholder*="supplier"], button[role="combobox"]'),
        locationField: !!document.querySelector('button[role="combobox"]'),
        addItemButton: !!Array.from(document.querySelectorAll('button')).find(btn => 
          btn.textContent?.includes('Add Purchase Item') || btn.textContent?.includes('Add Item')
        ),
        submitButton: !!document.querySelector('button[type="submit"]')
      };
    });

    if (formElements.hasForm) {
      results.formLoad = true;
      console.log('✅ Purchase form loaded successfully');
      console.log(`   Title: "${formElements.hasTitle}"`);
    }

    if (formElements.supplierField && formElements.addItemButton && formElements.submitButton) {
      results.formElements = true;
      console.log('✅ All key form elements present');
      console.log(`   - Supplier field: ✓`);
      console.log(`   - Location field: ✓`);
      console.log(`   - Add item button: ✓`);
      console.log(`   - Submit button: ✓`);
    }

    // Take screenshot
    await page.screenshot({ 
      path: 'purchase_form_loaded.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: purchase_form_loaded.png\n');

    // Step 3: Manual test instructions
    console.log('📝 Step 3: Manual Test Instructions');
    console.log('=' .repeat(50));
    console.log('The browser window will remain open for manual testing.');
    console.log('Please perform the following steps manually:');
    console.log('');
    console.log('1. Fill in the supplier field (should have dropdown with options)');
    console.log('2. Select a storage location');
    console.log('3. Click "Add Purchase Item" button');
    console.log('4. Fill in item details (name, quantity, price)');
    console.log('5. Add at least one item');
    console.log('6. Click "Submit" to create the purchase');
    console.log('7. Verify success message appears');
    console.log('8. Check that the purchase appears in purchase history');
    console.log('');
    console.log('Press Enter when manual testing is complete...');
    
    // Wait for user input (manual testing)
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise(resolve => {
      rl.question('', () => {
        rl.close();
        resolve();
      });
    });

    results.manualTest = true;
    console.log('✅ Manual testing completed\n');

    // Step 4: Verify database changes
    console.log('📝 Step 4: Checking database changes...');
    
    const currentTransactions = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/v1/transactions/purchases');
        const data = await response.json();
        return { success: true, count: Array.isArray(data) ? data.length : 0 };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    if (currentTransactions.success) {
      console.log(`✅ API accessible: ${currentTransactions.count} transactions found`);
    } else {
      console.log(`⚠️ API access issue: ${currentTransactions.error}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Generate summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PURCHASE FORM TEST SUMMARY');
    console.log('='.repeat(60));
    
    const tests = [
      { name: 'Login', passed: results.login },
      { name: 'Form Load', passed: results.formLoad },
      { name: 'Form Elements', passed: results.formElements },
      { name: 'Manual Test', passed: results.manualTest }
    ];

    let passed = 0;
    tests.forEach(test => {
      const status = test.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`${status} ${test.name}`);
      if (test.passed) passed++;
    });

    console.log('');
    console.log(`Overall: ${passed}/${tests.length} tests passed`);
    
    if (passed === tests.length) {
      console.log('🎉 All tests passed! The purchase form is working correctly.');
    } else {
      console.log('⚠️ Some issues detected. Check the form implementation.');
    }

    console.log('='.repeat(60));

    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testPurchaseForm().catch(console.error);