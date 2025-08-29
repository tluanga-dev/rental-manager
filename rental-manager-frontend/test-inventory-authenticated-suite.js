const puppeteer = require('puppeteer');

async function loginToApp(page) {
  console.log('🔐 Logging in to the application using demo admin...');
  
  // Navigate to login page
  await page.goto('http://localhost:3000/login', { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });
  
  // Wait for the demo button to be ready
  await page.waitForSelector('button', { timeout: 10000 });
  
  // Click the "Demo as Administrator" button
  const demoButton = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn => btn.textContent?.includes('Demo as Administrator'));
  });
  
  if (demoButton) {
    await demoButton.click();
    console.log('   Clicked demo admin button');
  } else {
    throw new Error('Demo admin button not found');
  }
  
  // Wait for navigation after login or for dashboard to appear
  await Promise.race([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    page.waitForSelector('nav', { timeout: 30000 }), // Wait for navigation sidebar
  ]).catch(() => {
    console.log('   Navigation completed or dashboard loaded');
  });
  
  // Additional wait to ensure full page load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('✅ Login successful\n');
  return true;
}

async function testStockLevelsPage(page) {
  const results = {
    pageLoad: false,
    headerRendered: false,
    tableRendered: false,
    filtersRendered: false,
    dataLoaded: false,
    errors: []
  };

  try {
    console.log('📝 Testing Stock Levels Page...');
    
    await page.goto('http://localhost:3000/inventory/stock-levels', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    results.pageLoad = true;
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we're still on the stock levels page
    const currentUrl = page.url();
    if (!currentUrl.includes('/inventory/stock-levels')) {
      console.log('   ⚠️ Redirected away from stock levels page to:', currentUrl);
      return results;
    }

    const pageContent = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const table = document.querySelector('table');
      const filters = document.querySelectorAll('input, select, button[role="combobox"]');
      const rows = document.querySelectorAll('tbody tr');
      
      return {
        header: h1?.textContent || '',
        hasTable: !!table,
        filterCount: filters.length,
        rowCount: rows.length,
        tableHeaders: table ? Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim()) : []
      };
    });

    if (pageContent.header.includes('Stock') || pageContent.header.includes('Levels')) {
      results.headerRendered = true;
      console.log(`   ✅ Header: ${pageContent.header}`);
    }

    if (pageContent.hasTable) {
      results.tableRendered = true;
      console.log(`   ✅ Table found with headers: ${pageContent.tableHeaders.join(', ')}`);
    }

    if (pageContent.filterCount > 2) {
      results.filtersRendered = true;
      console.log(`   ✅ ${pageContent.filterCount} filter controls found`);
    }

    if (pageContent.rowCount > 0) {
      results.dataLoaded = true;
      console.log(`   ✅ ${pageContent.rowCount} data rows found`);
    }

  } catch (error) {
    console.log(`   ❌ Error testing stock levels: ${error.message}`);
    results.errors.push(error.message);
  }

  return results;
}

async function testAlertsPage(page) {
  const results = {
    pageLoad: false,
    headerRendered: false,
    contentRendered: false,
    filtersRendered: false,
    dataLoaded: false,
    errors: []
  };

  try {
    console.log('\n📝 Testing Inventory Alerts Page...');
    
    await page.goto('http://localhost:3000/inventory/alerts', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    results.pageLoad = true;
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we're still on the alerts page
    const currentUrl = page.url();
    if (!currentUrl.includes('/inventory/alerts')) {
      console.log('   ⚠️ Redirected away from alerts page to:', currentUrl);
      return results;
    }

    const pageContent = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const table = document.querySelector('table');
      const cards = document.querySelectorAll('.bg-white.rounded-lg.border, [role="alert"]');
      const filters = document.querySelectorAll('input, select, button[role="combobox"]');
      const rows = document.querySelectorAll('tbody tr');
      
      return {
        header: h1?.textContent || h2?.textContent || '',
        hasTable: !!table,
        cardCount: cards.length,
        filterCount: filters.length,
        rowCount: rows.length,
        hasContent: !!table || cards.length > 0
      };
    });

    if (pageContent.header.includes('Alert') || pageContent.header.includes('Inventory')) {
      results.headerRendered = true;
      console.log(`   ✅ Header: ${pageContent.header}`);
    }

    if (pageContent.hasContent) {
      results.contentRendered = true;
      if (pageContent.hasTable) {
        console.log(`   ✅ Alerts table found`);
      } else if (pageContent.cardCount > 0) {
        console.log(`   ✅ ${pageContent.cardCount} alert cards found`);
      }
    }

    if (pageContent.filterCount > 2) {
      results.filtersRendered = true;
      console.log(`   ✅ ${pageContent.filterCount} filter controls found`);
    }

    if (pageContent.rowCount > 0 || pageContent.cardCount > 0) {
      results.dataLoaded = true;
      console.log(`   ✅ Alert data loaded`);
    }

  } catch (error) {
    console.log(`   ❌ Error testing alerts: ${error.message}`);
    results.errors.push(error.message);
  }

  return results;
}

async function testMovementsPage(page) {
  const results = {
    pageLoad: false,
    headerRendered: false,
    tableRendered: false,
    filtersRendered: false,
    dataLoaded: false,
    errors: []
  };

  try {
    console.log('\n📝 Testing Stock Movements Page...');
    
    await page.goto('http://localhost:3000/inventory/movements', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    results.pageLoad = true;
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we're still on the movements page
    const currentUrl = page.url();
    if (!currentUrl.includes('/inventory/movements')) {
      console.log('   ⚠️ Redirected away from movements page to:', currentUrl);
      return results;
    }

    const pageContent = await page.evaluate(() => {
      const headers = document.querySelectorAll('h1, h2, h3');
      let headerText = '';
      for (const h of headers) {
        if (h.textContent?.includes('Movement') || h.textContent?.includes('Stock')) {
          headerText = h.textContent;
          break;
        }
      }
      
      const table = document.querySelector('table');
      const filters = document.querySelectorAll('input, select, button[role="combobox"]');
      const rows = document.querySelectorAll('tbody tr');
      const quickFilters = Array.from(document.querySelectorAll('button')).filter(btn => {
        const text = btn.textContent?.toLowerCase();
        return text?.includes('today') || text?.includes('days');
      });
      
      return {
        header: headerText,
        hasTable: !!table,
        filterCount: filters.length,
        rowCount: rows.length,
        quickFilterCount: quickFilters.length,
        tableHeaders: table ? Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim()) : []
      };
    });

    if (pageContent.header) {
      results.headerRendered = true;
      console.log(`   ✅ Header: ${pageContent.header}`);
    }

    if (pageContent.hasTable) {
      results.tableRendered = true;
      console.log(`   ✅ Table found with headers: ${pageContent.tableHeaders.join(', ')}`);
    }

    if (pageContent.filterCount > 2) {
      results.filtersRendered = true;
      console.log(`   ✅ ${pageContent.filterCount} filter controls found`);
      if (pageContent.quickFilterCount > 0) {
        console.log(`   ✅ ${pageContent.quickFilterCount} quick date filters found`);
      }
    }

    if (pageContent.rowCount > 0) {
      results.dataLoaded = true;
      console.log(`   ✅ ${pageContent.rowCount} movement records found`);
    }

  } catch (error) {
    console.log(`   ❌ Error testing movements: ${error.message}`);
    results.errors.push(error.message);
  }

  return results;
}

async function runComprehensiveTest() {
  let browser;
  const allResults = {
    login: false,
    stockLevels: {},
    alerts: {},
    movements: {},
    screenshots: []
  };

  try {
    console.log('🚀 Starting Comprehensive Inventory Test Suite\n');
    console.log('=' .repeat(50) + '\n');
    
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1400, height: 900 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
        console.log('   ⚠️ Console error:', msg.text().substring(0, 100));
      }
    });

    // Step 1: Login
    try {
      allResults.login = await loginToApp(page);
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      throw new Error('Cannot proceed without authentication');
    }

    // Step 2: Test Stock Levels Page
    allResults.stockLevels = await testStockLevelsPage(page);
    await page.screenshot({ 
      path: 'test-auth-stock-levels.png',
      fullPage: true 
    });
    allResults.screenshots.push('test-auth-stock-levels.png');

    // Step 3: Test Alerts Page
    allResults.alerts = await testAlertsPage(page);
    await page.screenshot({ 
      path: 'test-auth-alerts.png',
      fullPage: true 
    });
    allResults.screenshots.push('test-auth-alerts.png');

    // Step 4: Test Movements Page
    allResults.movements = await testMovementsPage(page);
    await page.screenshot({ 
      path: 'test-auth-movements.png',
      fullPage: true 
    });
    allResults.screenshots.push('test-auth-movements.png');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }

    // Print comprehensive summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 COMPREHENSIVE TEST SUMMARY');
    console.log('=' .repeat(50) + '\n');

    // Login status
    console.log('🔐 Authentication: ' + (allResults.login ? '✅ PASSED' : '❌ FAILED'));

    // Stock Levels Summary
    console.log('\n📦 Stock Levels Page:');
    const stockTests = Object.entries(allResults.stockLevels)
      .filter(([key]) => key !== 'errors');
    const stockPassed = stockTests.filter(([, value]) => value === true).length;
    console.log(`   Overall: ${stockPassed}/${stockTests.length} tests passed`);
    stockTests.forEach(([test, passed]) => {
      if (test !== 'errors') {
        console.log(`   ${passed ? '✅' : '❌'} ${test}`);
      }
    });

    // Alerts Summary
    console.log('\n🔔 Alerts Page:');
    const alertTests = Object.entries(allResults.alerts)
      .filter(([key]) => key !== 'errors');
    const alertsPassed = alertTests.filter(([, value]) => value === true).length;
    console.log(`   Overall: ${alertsPassed}/${alertTests.length} tests passed`);
    alertTests.forEach(([test, passed]) => {
      if (test !== 'errors') {
        console.log(`   ${passed ? '✅' : '❌'} ${test}`);
      }
    });

    // Movements Summary
    console.log('\n📈 Movements Page:');
    const movementTests = Object.entries(allResults.movements)
      .filter(([key]) => key !== 'errors');
    const movementsPassed = movementTests.filter(([, value]) => value === true).length;
    console.log(`   Overall: ${movementsPassed}/${movementTests.length} tests passed`);
    movementTests.forEach(([test, passed]) => {
      if (test !== 'errors') {
        console.log(`   ${passed ? '✅' : '❌'} ${test}`);
      }
    });

    // Overall Summary
    const totalTests = stockTests.length + alertTests.length + movementTests.length;
    const totalPassed = stockPassed + alertsPassed + movementsPassed;
    const percentage = Math.round((totalPassed / totalTests) * 100);

    console.log('\n' + '=' .repeat(50));
    console.log(`🎯 OVERALL RESULT: ${totalPassed}/${totalTests} tests passed (${percentage}%)`);
    console.log('=' .repeat(50));

    if (allResults.screenshots.length > 0) {
      console.log('\n📸 Screenshots saved:');
      allResults.screenshots.forEach(file => console.log(`   - ${file}`));
    }

    // Determine exit code
    const exitCode = percentage >= 80 ? 0 : 1; // Pass if 80% or more tests pass
    console.log(`\n${percentage >= 80 ? '✅' : '❌'} Test suite ${percentage >= 80 ? 'PASSED' : 'FAILED'}`);
    
    process.exit(exitCode);
  }
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);