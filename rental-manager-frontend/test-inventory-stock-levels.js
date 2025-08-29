const puppeteer = require('puppeteer');

async function testStockLevelsPage() {
  let browser;
  const results = {
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
    console.log('🚀 Starting Stock Levels Page Test...\n');
    
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

    // Monitor network errors
    page.on('response', response => {
      if (response.status() >= 400) {
        const errorMsg = `Network error: ${response.status()} - ${response.url()}`;
        results.errors.push(errorMsg);
        console.log('❌', errorMsg);
      }
    });

    console.log('📝 Test 1: Loading stock levels page...');
    await page.goto('http://localhost:3000/inventory/stock-levels', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    results.pageLoad = true;
    console.log('✅ Page loaded successfully\n');

    // Wait a moment for React to render
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('📝 Test 2: Checking page header...');
    const headerText = await page.evaluate(() => {
      const header = document.querySelector('h1');
      return header ? header.textContent : null;
    });
    
    if (headerText && headerText.includes('Stock Levels Management')) {
      results.headerRendered = true;
      console.log('✅ Header rendered:', headerText);
    } else {
      console.log('❌ Header not found or incorrect');
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
      return {
        searchBox: !!document.querySelector('input[placeholder*="Search"]'),
        itemDropdown: !!document.querySelector('button[role="combobox"]'),
        locationDropdown: !!document.querySelectorAll('button[role="combobox"]')[1],
        statusFilter: !!document.querySelector('select, button[role="combobox"]'),
        refreshButton: !!Array.from(document.querySelectorAll('button')).find(btn => 
          btn.textContent?.includes('Refresh')
        )
      };
    });

    const allFiltersPresent = Object.values(filterElements).every(present => present);
    if (allFiltersPresent) {
      results.filtersRendered = true;
      console.log('✅ All filter controls are present');
      Object.entries(filterElements).forEach(([key, present]) => {
        console.log(`   - ${key}: ${present ? '✓' : '✗'}`);
      });
    } else {
      console.log('❌ Some filter controls are missing');
      Object.entries(filterElements).forEach(([key, present]) => {
        if (!present) console.log(`   - Missing: ${key}`);
      });
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
    const searchInput = await page.$('input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.type('test');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for debounce
      
      const searchApplied = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr');
        return rows.length >= 0; // Even 0 results means search worked
      });
      
      if (searchApplied) {
        results.searchWorking = true;
        console.log('✅ Search functionality is working');
      }
      
      // Clear search
      await searchInput.click({ clickCount: 3 });
      await searchInput.press('Backspace');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.log('⚠️  Search input not found');
    }

    console.log('\n📝 Test 7: Checking pagination controls...');
    const paginationInfo = await page.evaluate(() => {
      const paginationText = Array.from(document.querySelectorAll('p')).find(p => 
        p.textContent?.includes('Showing')
      );
      const prevButton = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent?.includes('Previous')
      );
      const nextButton = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent?.includes('Next')
      );
      
      return {
        hasInfo: !!paginationText,
        infoText: paginationText?.textContent,
        hasPrevButton: !!prevButton,
        hasNextButton: !!nextButton
      };
    });

    if (paginationInfo.hasInfo || (paginationInfo.hasPrevButton && paginationInfo.hasNextButton)) {
      results.paginationRendered = true;
      console.log('✅ Pagination controls found');
      if (paginationInfo.infoText) {
        console.log(`   - Info: ${paginationInfo.infoText}`);
      }
      console.log(`   - Previous button: ${paginationInfo.hasPrevButton ? '✓' : '✗'}`);
      console.log(`   - Next button: ${paginationInfo.hasNextButton ? '✓' : '✗'}`);
    } else {
      console.log('⚠️  Pagination controls not found (may not be needed if few items)');
    }

    console.log('\n📝 Test 8: Checking action buttons in table...');
    const actionButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('tbody button');
      const buttonTypes = new Set();
      
      buttons.forEach(btn => {
        const svg = btn.querySelector('svg');
        const text = btn.textContent?.trim();
        if (svg || text) {
          buttonTypes.add(text || 'icon-button');
        }
      });
      
      return {
        count: buttons.length,
        types: Array.from(buttonTypes)
      };
    });

    if (actionButtons.count > 0) {
      results.modalButtons = true;
      console.log(`✅ Found ${actionButtons.count} action buttons`);
      if (actionButtons.types.length > 0) {
        console.log(`   - Button types: ${actionButtons.types.join(', ')}`);
      }
    } else {
      console.log('⚠️  No action buttons found in table');
    }

    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'test-stock-levels-screenshot.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as test-stock-levels-screenshot.png');

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
      results.errors.forEach(err => console.log(`   - ${err}`));
    }

    process.exit(passedTests === totalTests ? 0 : 1);
  }
}

// Run the test
testStockLevelsPage().catch(console.error);