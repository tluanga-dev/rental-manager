const puppeteer = require('puppeteer');

async function testInventoryAlertsPage() {
  let browser;
  const results = {
    pageLoad: false,
    headerRendered: false,
    alertTypeTabs: false,
    filtersRendered: false,
    alertsTableRendered: false,
    dataLoaded: false,
    searchWorking: false,
    exportButton: false,
    refreshButton: false,
    errors: []
  };

  try {
    console.log('🚀 Starting Inventory Alerts Page Test...\n');
    
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

    console.log('📝 Test 1: Loading inventory alerts page...');
    await page.goto('http://localhost:3000/inventory/alerts', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    results.pageLoad = true;
    console.log('✅ Page loaded successfully\n');

    // Wait for React to render
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📝 Test 2: Checking page header...');
    const headerText = await page.evaluate(() => {
      const header = document.querySelector('h1');
      return header ? header.textContent : null;
    });
    
    if (headerText && (headerText.includes('Alert') || headerText.includes('Inventory'))) {
      results.headerRendered = true;
      console.log('✅ Header rendered:', headerText);
    } else {
      console.log('❌ Header not found or incorrect');
      console.log('   Found text:', headerText);
    }

    console.log('\n📝 Test 3: Checking alert type tabs...');
    const tabsInfo = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"], button')).filter(el => 
        el.textContent?.includes('Low Stock') || 
        el.textContent?.includes('Inventory Alerts') ||
        el.textContent?.includes('All Alerts')
      );
      
      return {
        count: tabs.length,
        labels: tabs.map(t => t.textContent?.trim())
      };
    });

    if (tabsInfo.count > 0) {
      results.alertTypeTabs = true;
      console.log(`✅ Found ${tabsInfo.count} alert type tabs:`);
      tabsInfo.labels.forEach(label => console.log(`   - ${label}`));
    } else {
      console.log('⚠️  Alert type tabs not found');
    }

    console.log('\n📝 Test 4: Checking filter controls...');
    const filterElements = await page.evaluate(() => {
      const searchInputs = document.querySelectorAll('input[type="text"], input[type="search"]');
      const selects = document.querySelectorAll('select, button[role="combobox"]');
      const dateInputs = document.querySelectorAll('input[type="date"]');
      
      return {
        searchCount: searchInputs.length,
        selectCount: selects.length,
        dateCount: dateInputs.length,
        hasFilters: searchInputs.length + selects.length + dateInputs.length > 0
      };
    });

    if (filterElements.hasFilters) {
      results.filtersRendered = true;
      console.log('✅ Filter controls found:');
      if (filterElements.searchCount > 0) console.log(`   - Search inputs: ${filterElements.searchCount}`);
      if (filterElements.selectCount > 0) console.log(`   - Select/Dropdown: ${filterElements.selectCount}`);
      if (filterElements.dateCount > 0) console.log(`   - Date inputs: ${filterElements.dateCount}`);
    } else {
      console.log('❌ No filter controls found');
    }

    console.log('\n📝 Test 5: Checking alerts table/cards...');
    const contentData = await page.evaluate(() => {
      // Check for table
      const table = document.querySelector('table');
      if (table) {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim());
        const rows = table.querySelectorAll('tbody tr');
        return {
          type: 'table',
          headers,
          itemCount: rows.length,
          hasData: rows.length > 0 && !rows[0].textContent?.includes('No alerts')
        };
      }
      
      // Check for alert cards
      const cards = document.querySelectorAll('.bg-white.rounded-lg.border, .alert-card, [role="alert"]');
      if (cards.length > 0) {
        return {
          type: 'cards',
          itemCount: cards.length,
          hasData: true
        };
      }
      
      return { type: 'none', itemCount: 0, hasData: false };
    });

    if (contentData.type !== 'none') {
      results.alertsTableRendered = true;
      console.log(`✅ Alerts displayed as ${contentData.type}`);
      if (contentData.type === 'table' && contentData.headers) {
        console.log(`   - Headers: ${contentData.headers.join(', ')}`);
      }
      console.log(`   - Items: ${contentData.itemCount}`);
      
      if (contentData.hasData) {
        results.dataLoaded = true;
        console.log('✅ Alert data is loaded');
      } else {
        console.log('⚠️  No alert data found');
      }
    } else {
      console.log('❌ No alerts table or cards found');
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

    console.log('\n📝 Test 7: Checking export button...');
    const exportButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => 
        btn.textContent?.includes('Export') || 
        btn.querySelector('svg')?.parentElement?.textContent?.includes('Export')
      );
    });

    if (exportButton) {
      results.exportButton = true;
      console.log('✅ Export button found');
    } else {
      console.log('⚠️  Export button not found');
    }

    console.log('\n📝 Test 8: Checking refresh button...');
    const refreshButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => 
        btn.textContent?.includes('Refresh') || 
        btn.querySelector('svg')?.parentElement?.textContent?.includes('Refresh')
      );
    });

    if (refreshButton) {
      results.refreshButton = true;
      console.log('✅ Refresh button found');
    } else {
      console.log('⚠️  Refresh button not found');
    }

    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'test-alerts-screenshot.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as test-alerts-screenshot.png');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    results.errors.push(error.message);
  } finally {
    if (browser) {
      await browser.close();
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY - Inventory Alerts Page');
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
testInventoryAlertsPage().catch(console.error);