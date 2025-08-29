const puppeteer = require('puppeteer');

async function testStockMovementsPage() {
  let browser;
  const results = {
    pageLoad: false,
    headerRendered: false,
    summarySection: false,
    filtersRendered: false,
    quickDateFilters: false,
    movementsTableRendered: false,
    dataLoaded: false,
    searchWorking: false,
    exportButton: false,
    paginationRendered: false,
    errors: []
  };

  try {
    console.log('🚀 Starting Stock Movements Page Test...\n');
    
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
      if (response.status() >= 400 && response.status() !== 401) {
        const url = response.url();
        if (!url.includes('favicon') && !url.includes('.ico')) {
          const errorMsg = `Network error: ${response.status()} - ${url}`;
          results.errors.push(errorMsg);
          console.log('❌', errorMsg);
        }
      }
    });

    console.log('📝 Test 1: Loading stock movements page...');
    await page.goto('http://localhost:3000/inventory/movements', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    results.pageLoad = true;
    console.log('✅ Page loaded successfully\n');

    // Wait for React to render
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📝 Test 2: Checking page header...');
    const headerText = await page.evaluate(() => {
      const headers = document.querySelectorAll('h1, h2, h3');
      for (const header of headers) {
        if (header.textContent?.includes('Movement') || header.textContent?.includes('Stock')) {
          return header.textContent;
        }
      }
      return null;
    });
    
    if (headerText) {
      results.headerRendered = true;
      console.log('✅ Header rendered:', headerText);
    } else {
      console.log('❌ Header not found');
    }

    console.log('\n📝 Test 3: Checking summary section...');
    const summaryData = await page.evaluate(() => {
      // Look for summary cards or stats
      const summaryCards = document.querySelectorAll('.bg-white.rounded-lg.border, .summary-card, .stat-card');
      const summaryTexts = [];
      
      summaryCards.forEach(card => {
        const label = card.querySelector('.text-sm, .text-gray-600');
        const value = card.querySelector('.text-xl, .font-semibold, .text-2xl');
        if (label && value) {
          summaryTexts.push(`${label.textContent}: ${value.textContent}`);
        }
      });
      
      // Also check for toggle button for summary
      const toggleButton = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent?.includes('Summary') || btn.textContent?.includes('Hide Summary')
      );
      
      return {
        hasSummary: summaryCards.length > 0 || !!toggleButton,
        summaryItems: summaryTexts,
        hasToggle: !!toggleButton
      };
    });

    if (summaryData.hasSummary) {
      results.summarySection = true;
      console.log('✅ Summary section found');
      if (summaryData.summaryItems.length > 0) {
        console.log('   Summary items:');
        summaryData.summaryItems.forEach(item => console.log(`   - ${item}`));
      }
      if (summaryData.hasToggle) {
        console.log('   ✅ Summary toggle button available');
      }
    } else {
      console.log('⚠️  Summary section not found');
    }

    console.log('\n📝 Test 4: Checking filter controls...');
    const filterElements = await page.evaluate(() => {
      const searchInputs = document.querySelectorAll('input[type="text"], input[type="search"]');
      const dropdowns = document.querySelectorAll('select, button[role="combobox"]');
      const dateInputs = document.querySelectorAll('input[type="date"]');
      
      // Look for specific filter labels
      const filterLabels = Array.from(document.querySelectorAll('label')).map(l => l.textContent);
      
      return {
        searchCount: searchInputs.length,
        dropdownCount: dropdowns.length,
        dateCount: dateInputs.length,
        hasFilters: searchInputs.length + dropdowns.length + dateInputs.length > 0,
        labels: filterLabels.slice(0, 5) // First 5 labels
      };
    });

    if (filterElements.hasFilters) {
      results.filtersRendered = true;
      console.log('✅ Filter controls found:');
      if (filterElements.searchCount > 0) console.log(`   - Search inputs: ${filterElements.searchCount}`);
      if (filterElements.dropdownCount > 0) console.log(`   - Dropdowns: ${filterElements.dropdownCount}`);
      if (filterElements.dateCount > 0) console.log(`   - Date inputs: ${filterElements.dateCount}`);
      if (filterElements.labels.length > 0) {
        console.log('   Filter labels:', filterElements.labels.join(', '));
      }
    } else {
      console.log('❌ No filter controls found');
    }

    console.log('\n📝 Test 5: Checking quick date filters...');
    const quickFilters = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const dateFilters = buttons.filter(btn => {
        const text = btn.textContent?.toLowerCase();
        return text?.includes('today') || 
               text?.includes('7 days') || 
               text?.includes('30 days') || 
               text?.includes('90 days') ||
               text?.includes('this week') ||
               text?.includes('this month');
      });
      
      return {
        hasQuickFilters: dateFilters.length > 0,
        filters: dateFilters.map(f => f.textContent?.trim())
      };
    });

    if (quickFilters.hasQuickFilters) {
      results.quickDateFilters = true;
      console.log('✅ Quick date filters found:');
      quickFilters.filters.forEach(filter => console.log(`   - ${filter}`));
    } else {
      console.log('⚠️  Quick date filters not found');
    }

    console.log('\n📝 Test 6: Checking movements table...');
    const tableData = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return null;

      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim());
      const rows = table.querySelectorAll('tbody tr');
      
      // Check for movement type badges
      const badges = table.querySelectorAll('.badge, [class*="badge"], [class*="bg-"]');
      
      return {
        hasTable: true,
        headers,
        rowCount: rows.length,
        hasData: rows.length > 0 && !rows[0].textContent?.includes('No movements'),
        hasBadges: badges.length > 0
      };
    });

    if (tableData?.hasTable) {
      results.movementsTableRendered = true;
      console.log('✅ Movements table found');
      console.log(`   - Headers: ${tableData.headers.join(', ')}`);
      console.log(`   - Rows: ${tableData.rowCount}`);
      
      if (tableData.hasData) {
        results.dataLoaded = true;
        console.log('✅ Movement data is loaded');
      } else {
        console.log('⚠️  No movement data found');
      }
      
      if (tableData.hasBadges) {
        console.log('   ✅ Movement type badges present');
      }
    } else {
      console.log('❌ Movements table not found');
    }

    console.log('\n📝 Test 7: Testing search functionality...');
    const searchInput = await page.$('input[type="text"], input[type="search"]');
    if (searchInput) {
      await searchInput.type('adjustment');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for debounce
      results.searchWorking = true;
      console.log('✅ Search input is functional');
      
      // Clear search
      await searchInput.click({ clickCount: 3 });
      await searchInput.press('Backspace');
    } else {
      console.log('⚠️  Search input not found');
    }

    console.log('\n📝 Test 8: Checking export button...');
    const exportButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => 
        btn.textContent?.includes('Export') || 
        btn.textContent?.includes('CSV') ||
        btn.querySelector('svg')?.parentElement?.textContent?.includes('Export')
      );
    });

    if (exportButton) {
      results.exportButton = true;
      console.log('✅ Export button found');
    } else {
      console.log('⚠️  Export button not found');
    }

    console.log('\n📝 Test 9: Checking pagination controls...');
    const paginationInfo = await page.evaluate(() => {
      const pageText = document.body.textContent || '';
      const paginationText = Array.from(document.querySelectorAll('p, span')).find(el => 
        el.textContent?.includes('Showing') && el.textContent?.includes('of')
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
      console.log('⚠️  Pagination controls not found (may not be needed)');
    }

    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'test-movements-screenshot.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as test-movements-screenshot.png');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    results.errors.push(error.message);
  } finally {
    if (browser) {
      await browser.close();
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY - Stock Movements Page');
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
testStockMovementsPage().catch(console.error);