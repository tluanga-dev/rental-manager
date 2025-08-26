const puppeteer = require('puppeteer');

/**
 * Test Locations Display Fix
 * Verifies that locations are now properly displayed on the dashboard
 */

async function testLocationsDisplayFix() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Capture console messages to see debug output
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    
    // Log important debug messages
    if (text.includes('📊 LocationsPage render:')) {
      console.log('🔍 Frontend Debug:', text.substring(0, 200) + '...');
    }
  });

  // Track API calls
  let apiCalls = 0;
  let locationCount = 0;
  
  page.on('response', async response => {
    if (response.url().includes('/api/v1/locations')) {
      apiCalls++;
      console.log(`📡 API Call #${apiCalls}: ${response.status()} ${response.url()}`);
      
      if (response.ok()) {
        try {
          const data = await response.json();
          if (data.locations) {
            locationCount = data.locations.length;
            console.log(`✅ API returned ${locationCount} locations`);
          } else if (Array.isArray(data)) {
            locationCount = data.length;
            console.log(`✅ API returned ${locationCount} locations (direct array)`);
          }
        } catch (e) {
          console.log('⚠️  Could not parse API response');
        }
      }
    }
  });

  try {
    console.log('🚀 Testing Locations Display Fix...\n');

    // Navigate to locations page
    console.log('📋 Step 1: Loading locations dashboard...');
    await page.goto('http://localhost:3000/inventory/locations', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for data to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check statistics cards
    console.log('\n📋 Step 2: Checking statistics cards...');
    const statsCards = await page.$$('.card');
    console.log(`📊 Found ${statsCards.length} statistics cards`);

    // Check for location data in the UI
    const locationRows = await page.$$('table tbody tr, [data-testid="location-item"]');
    console.log(`📍 Found ${locationRows.length} location rows in UI`);

    // Check for loading states
    const loadingElements = await page.$$('[class*="loading"], [class*="Loading"]');
    console.log(`⏳ Loading elements: ${loadingElements.length}`);

    // Check for error messages
    const errorElements = await page.$$('.alert-error, [class*="error"]');
    console.log(`❌ Error elements: ${errorElements.length}`);

    // Check for "No locations" message
    const noDataMessage = await page.$('text=/no locations/i, text=/empty/i');
    const hasNoDataMessage = !!noDataMessage;

    // Get statistics card values
    const statValues = [];
    for (let i = 0; i < Math.min(4, statsCards.length); i++) {
      try {
        const value = await statsCards[i].evaluate(card => {
          const valueEl = card.querySelector('.text-2xl, [class*="text-2xl"]');
          return valueEl ? valueEl.textContent.trim() : 'N/A';
        });
        statValues.push(value);
      } catch (e) {
        statValues.push('Error');
      }
    }

    console.log(`📊 Statistics values: [${statValues.join(', ')}]`);

    // Take screenshot
    await page.screenshot({ 
      path: 'locations-display-test.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved as locations-display-test.png');

    // Analysis
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results:');
    console.log('='.repeat(60));

    const results = {
      apiCallsMade: apiCalls > 0,
      apiReturnsData: locationCount > 0,
      statsCardsPresent: statsCards.length >= 4,
      statsShowData: statValues.some(val => val !== '...' && val !== '0' && val !== 'N/A'),
      locationsInUI: locationRows.length > 0,
      hasLoadingState: loadingElements.length > 0,
      hasErrors: errorElements.length > 0,
      hasNoDataMessage: hasNoDataMessage
    };

    console.log(`📡 API calls made: ${results.apiCallsMade}`);
    console.log(`📊 API returns ${locationCount} locations: ${results.apiReturnsData}`);
    console.log(`📋 Statistics cards present: ${results.statsCardsPresent}`);
    console.log(`📈 Statistics show data: ${results.statsShowData}`);
    console.log(`📍 Locations visible in UI: ${results.locationsInUI}`);
    console.log(`⏳ Still loading: ${results.hasLoadingState}`);
    console.log(`❌ Has errors: ${results.hasErrors}`);
    console.log(`📭 Shows "no data" message: ${results.hasNoDataMessage}`);

    // Determine success
    const isFixed = results.apiReturnsData && results.locationsInUI && results.statsShowData;
    const isPending = results.hasLoadingState;
    const hasIssues = results.hasErrors || results.hasNoDataMessage;

    console.log('\n🎯 Diagnosis:');
    if (isFixed) {
      console.log('✅ SUCCESS: Locations display fix is working!');
      console.log('   - API returns data correctly');
      console.log('   - Locations are visible in the dashboard');
      console.log('   - Statistics cards show correct values');
    } else if (isPending) {
      console.log('⏳ PENDING: Data might still be loading');
      console.log('   - Try refreshing the page or wait a moment');
    } else if (hasIssues) {
      console.log('❌ ISSUES DETECTED: Fix may need additional work');
      console.log('   - Check console logs for specific errors');
      console.log('   - Verify API connectivity');
    } else {
      console.log('⚠️  UNCLEAR: Mixed results - may need investigation');
    }

    return { isFixed, results, consoleMessages: consoleMessages.length };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    await page.screenshot({ 
      path: 'locations-display-error.png',
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
  testLocationsDisplayFix()
    .then((results) => {
      console.log('\n🎉 Locations display test completed!');
      process.exit(results.isFixed ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testLocationsDisplayFix };