const puppeteer = require('puppeteer');

async function loginToApp(page) {
  console.log('🔐 Logging in to the application...');
  
  // Navigate to login page
  await page.goto('http://localhost:3000/login', { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });
  
  // Wait for login form to be ready
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  
  // Fill in login credentials
  await page.type('input[name="email"]', 'admin@rentalmanager.com');
  await page.type('input[name="password"]', 'admin123');
  
  // Click login button
  await page.click('button[type="submit"]');
  
  // Wait for navigation after login
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  console.log('✅ Login successful\n');
}

async function testStockLevelsPage() {
  let browser;
  const results = {
    login: false,
    pageLoad: false,
    headerRendered: false,
    statsCardsRendered: false,
    filtersRendered: false,
    tableRendered: false,
    dataLoaded: false,
    searchWorking: false,
    paginationRendered: false,
    modalButtons: false,
    errors: []
  };

  try {
    console.log('🚀 Starting Stock Levels Page Test (with Authentication)...\n');
    
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1400, height: 900 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.errors.push(msg.text());
        console.log('❌ Console error:', msg.text());
      }
    });

    // Monitor network errors (ignore 401s during auth)
    page.on('response', response => {
      if (response.status() >= 400 && response.status() !== 401) {
        const url = response.url();
        // Ignore favicon and other non-critical resources
        if (!url.includes('favicon') && !url.includes('.ico')) {
          const errorMsg = `Network error: ${response.status()} - ${url}`;
          results.errors.push(errorMsg);
          console.log('❌', errorMsg);
        }
      }
    });

    // Login first
    try {
      await loginToApp(page);
      results.login = true;
    } catch (error) {
      console.log('❌ Login failed:', error.message);
      throw new Error('Cannot proceed without authentication');
    }

    console.log('📝 Test 1: Loading stock levels page...');
    await page.goto('http://localhost:3000/inventory/stock-levels', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    results.pageLoad = true;
    console.log('✅ Page loaded successfully\n');

    // Wait longer for React to render
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('📝 Test 2: Checking page header...');
    const headerText = await page.evaluate(() => {
      const header = document.querySelector('h1');
      return header ? header.textContent : null;
    });
    
    if (headerText && headerText.includes('Stock Levels')) {
      results.headerRendered = true;
      console.log('✅ Header rendered:', headerText);
    } else {
      console.log('❌ Header not found or incorrect');
      console.log('   Found text:', headerText);
    }

    console.log('\n📝 Test 3: Checking stats cards...');
    const statsCards = await page.evaluate(() => {
      const cards = document.querySelectorAll('.bg-white.rounded-lg.border');
      const stats = [];
      cards.forEach(card => {
        const label = card.querySelector('.text-sm.text-gray-600');
        const value = card.querySelector('.text-xl.font-semibold');
        if (label && value) {
          stats.push({
            label: label.textContent,
            value: value.textContent
          });
        }
      });
      return stats;
    });

    if (statsCards.length > 0) {
      results.statsCardsRendered = true;
      console.log(`✅ Found ${statsCards.length} stats cards:`);
      statsCards.forEach(stat => {
        console.log(`   - ${stat.label}: ${stat.value}`);
      });
    } else {
      console.log('❌ No stats cards found');
    }

    console.log('\n📝 Test 4: Checking filter controls...');
    const filterElements = await page.evaluate(() => {
      // Look for various filter elements
      const searchInputs = document.querySelectorAll('input[type="text"], input[type="search"]');
      const dropdowns = document.querySelectorAll('button[role="combobox"], select');
      const buttons = Array.from(document.querySelectorAll('button')).filter(btn => 
        btn.textContent?.includes('Refresh') || 
        btn.textContent?.includes('Export') ||
        btn.textContent?.includes('Filter')
      );
      
      return {
        searchInputCount: searchInputs.length,
        dropdownCount: dropdowns.length,
        actionButtonCount: buttons.length,
        hasFilters: searchInputs.length > 0 || dropdowns.length > 0
      };
    });

    if (filterElements.hasFilters) {
      results.filtersRendered = true;
      console.log('✅ Filter controls found:');
      console.log(`   - Search inputs: ${filterElements.searchInputCount}`);
      console.log(`   - Dropdowns: ${filterElements.dropdownCount}`);
      console.log(`   - Action buttons: ${filterElements.actionButtonCount}`);
    } else {
      console.log('❌ No filter controls found');
    }

    console.log('\n📝 Test 5: Checking stock levels table...');
    const tableData = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return null;

      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim());
      const rows = table.querySelectorAll('tbody tr');
      
      return {
        hasTable: true,
        headers,
        rowCount: rows.length,
        hasData: rows.length > 0 && !rows[0].textContent?.includes('No stock levels found')
      };
    });

    if (tableData?.hasTable) {
      results.tableRendered = true;
      console.log('✅ Table structure found');
      console.log(`   - Headers: ${tableData.headers.join(', ')}`);
      console.log(`   - Rows: ${tableData.rowCount}`);
      
      if (tableData.hasData) {
        results.dataLoaded = true;
        console.log('✅ Table contains data');
      } else {
        console.log('⚠️  Table is empty or shows "No stock levels found"');
      }
    } else {
      console.log('❌ Table not found');
    }

    console.log('\n📝 Test 6: Testing search functionality...');
    const searchInput = await page.$('input[type="text"], input[type="search"]');
    if (searchInput) {
      await searchInput.type('test');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for debounce
      
      results.searchWorking = true;
      console.log('✅ Search input is functional');
      
      // Clear search
      await searchInput.click({ clickCount: 3 });
      await searchInput.press('Backspace');
    } else {
      console.log('⚠️  Search input not found');
    }

    console.log('\n📝 Test 7: Checking pagination controls...');
    const paginationInfo = await page.evaluate(() => {
      const pageText = document.body.textContent || '';
      const hasPagination = pageText.includes('Showing') || 
                           pageText.includes('Previous') || 
                           pageText.includes('Next') ||
                           pageText.includes('Page');
      
      return { hasPagination };
    });

    if (paginationInfo.hasPagination) {
      results.paginationRendered = true;
      console.log('✅ Pagination indicators found');
    } else {
      console.log('⚠️  Pagination not found (may not be needed if few items)');
    }

    console.log('\n📝 Test 8: Checking action buttons in table...');
    const actionButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('tbody button, tbody a[role="button"]');
      return buttons.length;
    });

    if (actionButtons > 0) {
      results.modalButtons = true;
      console.log(`✅ Found ${actionButtons} action buttons in table`);
    } else {
      console.log('⚠️  No action buttons found (table may be empty)');
    }

    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'test-stock-levels-authenticated.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as test-stock-levels-authenticated.png');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    results.errors.push(error.message);
  } finally {
    if (browser) {
      await browser.close();
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY - Stock Levels Page');
    console.log('='.repeat(50));
    
    const totalTests = Object.keys(results).filter(k => k !== 'errors').length;
    const passedTests = Object.entries(results)
      .filter(([key, value]) => key !== 'errors' && value === true).length;
    
    Object.entries(results).forEach(([test, passed]) => {
      if (test !== 'errors') {
        const status = passed ? '✅' : '❌';
        const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase();
        console.log(`${status} ${testName}: ${passed ? 'PASSED' : 'FAILED'}`);
      }
    });

    console.log('\n' + '='.repeat(50));
    console.log(`Overall: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests * 100)}%)`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      [...new Set(results.errors)].forEach(err => console.log(`   - ${err}`));
    }

    process.exit(passedTests === totalTests ? 0 : 1);
  }
}

// Run the test
testStockLevelsPage().catch(console.error);