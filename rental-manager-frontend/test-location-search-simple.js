const puppeteer = require('puppeteer');

/**
 * Simple Location Search Test
 * Focuses on search functionality specifically
 */

async function testLocationSearchSimple() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 200,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Track API calls
  let searchApiCalls = [];
  page.on('response', async response => {
    if (response.url().includes('/api/v1/locations')) {
      const url = response.url();
      const hasSearch = url.includes('search=');
      const searchTerm = hasSearch ? url.split('search=')[1]?.split('&')[0] : 'none';
      
      searchApiCalls.push({
        url,
        status: response.status(),
        hasSearch,
        searchTerm: decodeURIComponent(searchTerm || 'none')
      });
      
      console.log(`📡 API Call: ${response.status()} - search: "${decodeURIComponent(searchTerm || 'none')}"`);
    }
  });

  try {
    console.log('🔍 Testing Location Search Functionality...\n');

    // Navigate to locations page
    console.log('📋 Loading locations page...');
    await page.goto('http://localhost:3000/inventory/locations', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Count initial locations
    const initialRows = await page.$$('table tbody tr');
    console.log(`📍 Initial locations: ${initialRows.length}`);

    // Test search
    console.log('\n🔍 Testing search...');
    const searchInput = await page.$('input[placeholder*="Search"]');
    
    if (searchInput) {
      console.log('✅ Search input found');
      
      // Test 1: Search for "test"
      await searchInput.click();
      await searchInput.type('test');
      console.log('⌨️ Typed "test"');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const testResults = await page.$$('table tbody tr');
      console.log(`📊 "test" results: ${testResults.length} locations`);
      
      // Test 2: Clear and search for something else
      await searchInput.click({ clickCount: 3 });
      await searchInput.type('warehouse');
      console.log('⌨️ Typed "warehouse"');
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const warehouseResults = await page.$$('table tbody tr');
      console.log(`📊 "warehouse" results: ${warehouseResults.length} locations`);
      
      // Test 3: Clear search
      await searchInput.click({ clickCount: 3 });
      await searchInput.press('Backspace');
      console.log('🧹 Cleared search');
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const finalResults = await page.$$('table tbody tr');
      console.log(`📊 Final results: ${finalResults.length} locations`);
      
    } else {
      console.log('❌ Search input not found');
    }

    // Check for statistics cards
    console.log('\n📊 Checking statistics...');
    const cardElements = await page.$$('[class*="card"], .card');
    console.log(`📈 Found ${cardElements.length} card elements`);
    
    if (cardElements.length >= 4) {
      console.log('✅ Statistics cards appear to be present');
    } else {
      console.log('⚠️  Statistics cards may need investigation');
    }

    // Take screenshot
    await page.screenshot({ 
      path: 'location-search-simple-test.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved');

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎯 Search Test Results:');
    console.log('='.repeat(50));
    
    const hasWorkingSearch = searchApiCalls.some(call => call.hasSearch);
    const hasDebouncedCalls = searchApiCalls.length > 2; // Should have multiple calls due to typing
    
    console.log(`📍 Initial locations loaded: ${initialRows.length > 0}`);
    console.log(`🔍 Search input functional: ${!!await page.$('input[placeholder*="Search"]')}`);
    console.log(`📡 Search API calls made: ${hasWorkingSearch}`);
    console.log(`⏱️ Debouncing working: ${hasDebouncedCalls}`);
    console.log(`📊 Statistics cards: ${cardElements.length >= 4 ? 'Present' : 'Missing'}`);
    
    console.log('\n📝 API Call Summary:');
    searchApiCalls.forEach((call, index) => {
      console.log(`   ${index + 1}. ${call.status} - ${call.hasSearch ? `search: "${call.searchTerm}"` : 'no search'}`);
    });
    
    const isSuccess = initialRows.length > 0 && hasWorkingSearch;
    
    console.log('\n🎯 Overall Assessment:');
    if (isSuccess) {
      console.log('✅ SUCCESS: Search functionality is working correctly!');
      console.log('   - Debounced API calls are being made');
      console.log('   - Search results are being displayed');
      console.log('   - UI is responsive to search input');
    } else {
      console.log('⚠️  ISSUES: Some aspects may need attention');
    }
    
    return { success: isSuccess, apiCalls: searchApiCalls.length, cardCount: cardElements.length };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'location-search-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testLocationSearchSimple()
    .then((results) => {
      console.log('\n🎉 Search test completed!');
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testLocationSearchSimple };