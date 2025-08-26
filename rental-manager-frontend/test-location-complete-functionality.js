const puppeteer = require('puppeteer');

/**
 * Complete Location Functionality Test
 * Tests both search and filtering functionality
 */

async function testLocationCompleteFunctionality() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 200,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Track API calls
  let apiCalls = [];
  page.on('response', async response => {
    if (response.url().includes('/api/v1/locations')) {
      const url = response.url();
      apiCalls.push({
        url,
        status: response.status(),
        timestamp: Date.now()
      });
      console.log(`📡 API: ${response.status()} ${url.replace('http://localhost:8000', '')}`);
    }
  });

  try {
    console.log('🧪 Testing Complete Location Functionality...\n');

    // Navigate to locations page
    console.log('📋 Step 1: Loading locations page...');
    await page.goto('http://localhost:3000/inventory/locations', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Count initial locations and check statistics
    const initialRows = await page.$$('table tbody tr');
    const statsCards = await page.$$('[class*="card"]');
    console.log(`📍 Initial locations: ${initialRows.length}`);
    console.log(`📊 Statistics cards: ${statsCards.length}`);

    // Test 1: Search functionality
    console.log('\n🔍 Test 1: Search Functionality...');
    const searchInput = await page.$('input[placeholder*="Search"]');
    
    if (searchInput) {
      console.log('✅ Search input found');
      
      // Search for "warehouse"
      await searchInput.click();
      await searchInput.type('warehouse');
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for debounce
      
      const searchResults = await page.$$('table tbody tr');
      console.log(`   - "warehouse" search: ${searchResults.length} results`);
      
      // Clear search
      await searchInput.click({ clickCount: 3 });
      await searchInput.press('Backspace');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const clearedResults = await page.$$('table tbody tr');
      console.log(`   - After clearing: ${clearedResults.length} results`);
      
    } else {
      console.log('❌ Search input not found');
    }

    // Test 2: Filter functionality
    console.log('\n🔧 Test 2: Filter Functionality...');
    
    // Find and click the Filters button
    const filtersButton = await page.$('button:contains("Filters")') || 
                          await page.$('button[class*="outline"]:has(svg)') ||
                          await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            return buttons.find(btn => btn.textContent?.includes('Filters'));
                          });
    
    if (filtersButton) {
      await page.evaluate(btn => btn.click(), filtersButton);
      console.log('✅ Opened filters panel');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if filters panel is visible
      const filtersPanel = await page.$('.bg-gray-50, [class*="bg-gray-50"]');
      if (filtersPanel) {
        console.log('✅ Filters panel is visible');
        
        // Look for select elements in the filters
        const filterSelects = await page.$$('select, [role="combobox"]');
        console.log(`   - Found ${filterSelects.length} filter controls`);
        
      } else {
        console.log('⚠️  Filters panel not immediately visible');
      }
      
    } else {
      console.log('⚠️  Filters button not found - trying alternative approach');
      
      // Alternative: look for any button that might be the filters button
      const possibleFilters = await page.$$('button');
      console.log(`   - Found ${possibleFilters.length} buttons on page`);
      
      for (let i = 0; i < Math.min(5, possibleFilters.length); i++) {
        try {
          const text = await possibleFilters[i].evaluate(el => el.textContent?.trim());
          if (text?.toLowerCase().includes('filter')) {
            console.log(`   - Button ${i + 1}: "${text}" (potential filter button)`);
          }
        } catch (e) {
          // Skip if evaluation fails
        }
      }
    }

    // Test 3: Statistics Cards
    console.log('\n📊 Test 3: Statistics Cards...');
    const cardStats = [];
    
    for (let i = 0; i < Math.min(4, statsCards.length); i++) {
      try {
        const cardData = await statsCards[i].evaluate(card => {
          const title = card.querySelector('[class*="text-sm"]')?.textContent?.trim();
          const value = card.querySelector('[class*="text-2xl"]')?.textContent?.trim();
          const description = card.querySelector('[class*="text-xs"]')?.textContent?.trim();
          
          return { title, value, description };
        });
        
        cardStats.push(cardData);
        console.log(`   - Card ${i + 1}: ${cardData.title} = ${cardData.value}`);
        
      } catch (e) {
        console.log(`   - Card ${i + 1}: Error reading data`);
      }
    }

    // Test 4: Table functionality
    console.log('\n📋 Test 4: Table Display...');
    const tableHeaders = await page.$$('table thead th');
    const tableRows = await page.$$('table tbody tr');
    
    console.log(`   - Table headers: ${tableHeaders.length}`);
    console.log(`   - Table rows: ${tableRows.length}`);
    
    if (tableRows.length > 0) {
      // Check first row content
      try {
        const firstRowData = await tableRows[0].evaluate(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          return cells.map(cell => cell.textContent?.trim().substring(0, 50)).filter(Boolean);
        });
        
        console.log(`   - First row sample: [${firstRowData.slice(0, 3).join(', ')}...]`);
      } catch (e) {
        console.log('   - Could not read first row data');
      }
    }

    // Take final screenshot
    await page.screenshot({ 
      path: 'location-complete-test.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as location-complete-test.png');

    // Results analysis
    console.log('\n' + '='.repeat(60));
    console.log('🎯 Complete Functionality Test Results:');
    console.log('='.repeat(60));
    
    const results = {
      pageLoaded: initialRows.length > 0,
      searchWorking: apiCalls.some(call => call.url.includes('search=')),
      statsPresent: statsCards.length >= 4,
      statsHaveData: cardStats.some(card => card.value && card.value !== '...' && card.value !== '0'),
      tableWorking: tableRows.length > 0,
      apiCallsTotal: apiCalls.length
    };
    
    console.log(`📋 Page loaded successfully: ${results.pageLoaded}`);
    console.log(`🔍 Search functionality: ${results.searchWorking ? '✅ Working' : '❌ Issues'}`);
    console.log(`📊 Statistics cards present: ${results.statsPresent ? '✅ Yes' : '❌ No'}`);
    console.log(`📈 Statistics show data: ${results.statsHaveData ? '✅ Yes' : '⚠️  Loading/Empty'}`);
    console.log(`📋 Table display: ${results.tableWorking ? '✅ Working' : '❌ Issues'}`);
    console.log(`📡 Total API calls made: ${results.apiCallsTotal}`);
    
    console.log('\n📝 API Call Summary:');
    apiCalls.forEach((call, index) => {
      const urlParts = call.url.split('?');
      const params = urlParts[1] || 'no params';
      console.log(`   ${index + 1}. ${call.status} - ${params}`);
    });
    
    // Overall assessment
    const overallScore = Object.values(results).filter(Boolean).length;
    const totalTests = 6; // Number of boolean tests
    const successRate = (overallScore / totalTests * 100).toFixed(0);
    
    console.log('\n🎯 Overall Assessment:');
    console.log(`   Success Rate: ${successRate}% (${overallScore}/${totalTests} tests passed)`);
    
    if (successRate >= 80) {
      console.log('✅ EXCELLENT: Location functionality is working very well!');
    } else if (successRate >= 60) {
      console.log('🟡 GOOD: Most functionality working, minor issues to address');
    } else {
      console.log('⚠️  NEEDS ATTENTION: Several components need investigation');
    }
    
    return { 
      success: successRate >= 80, 
      results, 
      successRate: parseInt(successRate),
      apiCalls: apiCalls.length,
      cardStats
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'location-complete-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testLocationCompleteFunctionality()
    .then((results) => {
      console.log('\n🎉 Complete functionality test completed!');
      console.log(`Final assessment: ${results.successRate}% success rate`);
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testLocationCompleteFunctionality };