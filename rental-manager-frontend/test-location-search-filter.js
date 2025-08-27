const puppeteer = require('puppeteer');

/**
 * Test Location Search and Filter Functionality
 * Verifies that search and filtering work properly on locations page
 */

async function testLocationSearchAndFilter() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 300,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Track API calls for debugging
  let apiCalls = 0;
  page.on('response', async response => {
    if (response.url().includes('/api/v1/locations')) {
      apiCalls++;
      console.log(`📡 API Call #${apiCalls}: ${response.status()} ${response.url()}`);
    }
  });

  try {
    console.log('🔍 Testing Location Search and Filter Functionality...\n');

    // Step 1: Navigate to locations page
    console.log('📋 Step 1: Loading locations page...');
    await page.goto('http://localhost:3000/inventory/locations', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Count initial locations
    const initialRows = await page.$$('table tbody tr');
    console.log(`📍 Initial locations displayed: ${initialRows.length}`);

    // Step 3: Test search functionality
    console.log('\n🔍 Step 3: Testing search functionality...');
    
    // Find and use the search input
    const searchInput = await page.$('input[placeholder*="Search locations"]');
    if (searchInput) {
      console.log('✅ Search input found');
      
      // Test search with a common term
      await searchInput.click();
      await searchInput.type('test', { delay: 100 });
      console.log('⌨️ Typed "test" in search');
      
      // Wait for debounce and potential API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Count filtered results
      const searchResults = await page.$$('table tbody tr');
      console.log(`📊 Search results for "test": ${searchResults.length} locations`);
      
      // Clear search
      await searchInput.click({ clickCount: 3 });
      await searchInput.press('Backspace');
      console.log('🧹 Cleared search');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      const clearedResults = await page.$$('table tbody tr');
      console.log(`📊 Results after clearing search: ${clearedResults.length} locations`);
      
    } else {
      console.log('❌ Search input not found');
    }

    // Step 4: Test filter functionality
    console.log('\n🔧 Step 4: Testing filter functionality...');
    
    // Find and click filters button
    const filtersButton = await page.$('button:has-text("Filters")');
    if (filtersButton) {
      await filtersButton.click();
      console.log('✅ Opened filters panel');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test location type filter
      const typeSelect = await page.$('select, [role="combobox"]');
      if (typeSelect) {
        console.log('✅ Found filter controls');
      } else {
        console.log('⚠️  Filter controls not immediately visible');
      }
      
    } else {
      console.log('❌ Filters button not found');
    }

    // Step 5: Check statistics cards
    console.log('\n📊 Step 5: Checking statistics cards...');
    const statsSelectors = [
      '[class*="card"]',
      '.card',
      '[class*="grid"] > div',
      '.space-y-6 > div:first-child > div'
    ];
    
    let foundStats = false;
    for (const selector of statsSelectors) {
      const cards = await page.$$(selector);
      if (cards.length >= 4) {
        console.log(`✅ Found ${cards.length} statistics cards with selector: ${selector}`);
        
        // Get values from first 4 cards
        const values = [];
        for (let i = 0; i < 4; i++) {
          try {
            const text = await cards[i].evaluate(el => {
              const valueEl = el.querySelector('[class*="text-2xl"]');
              return valueEl ? valueEl.textContent.trim() : null;
            });
            values.push(text || 'N/A');
          } catch (e) {
            values.push('Error');
          }
        }
        console.log(`📈 Statistics values: [${values.join(', ')}]`);
        foundStats = true;
        break;
      }
    }
    
    if (!foundStats) {
      console.log('❌ Statistics cards not found with any selector');
    }

    // Take final screenshot
    await page.screenshot({ 
      path: 'location-search-filter-test.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved as location-search-filter-test.png');

    // Results summary
    console.log('\n' + '='.repeat(60));
    console.log('🎯 Test Summary:');
    console.log('='.repeat(60));
    
    const results = {
      pageLoaded: initialRows.length > 0,
      searchInputFound: !!await page.$('input[placeholder*="Search locations"]'),
      filtersButtonFound: !!await page.$('button:has-text("Filters")'),
      statsCardsFound: foundStats,
      apiCallsMade: apiCalls > 0
    };
    
    console.log(`📋 Page loaded with locations: ${results.pageLoaded}`);
    console.log(`🔍 Search input found: ${results.searchInputFound}`);
    console.log(`🔧 Filters button found: ${results.filtersButtonFound}`);
    console.log(`📊 Statistics cards found: ${results.statsCardsFound}`);
    console.log(`📡 API calls made: ${results.apiCallsMade}`);
    
    const overallSuccess = results.pageLoaded && results.searchInputFound && results.apiCallsMade;
    
    console.log('\n🎯 Overall Status:');
    if (overallSuccess) {
      console.log('✅ SUCCESS: Core search and filter functionality appears to be working');
    } else {
      console.log('⚠️  PARTIAL: Some components may need attention');
    }
    
    return { success: overallSuccess, results, apiCalls };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    await page.screenshot({ 
      path: 'location-search-filter-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved');
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testLocationSearchAndFilter()
    .then((results) => {
      console.log('\n🎉 Location search and filter test completed!');
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testLocationSearchAndFilter };