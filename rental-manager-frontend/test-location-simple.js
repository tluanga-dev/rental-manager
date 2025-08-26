const puppeteer = require('puppeteer');

/**
 * Simple Location Dashboard Test
 * Tests that the location dashboard loads and displays data without errors
 */

async function testLocationDashboard() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Track API responses
  let locationsLoaded = false;
  let apiError = null;
  let locationCount = 0;

  page.on('response', async (response) => {
    if (response.url().includes('/api/v1/locations')) {
      console.log(`📡 API Response: ${response.status()} ${response.url()}`);
      
      if (response.ok()) {
        try {
          const data = await response.json();
          if (data.locations) {
            locationCount = data.locations.length;
            locationsLoaded = true;
            console.log(`✅ Loaded ${locationCount} locations`);
          }
        } catch (e) {
          console.log('⚠️  Could not parse response as JSON');
        }
      } else {
        apiError = `${response.status()} ${response.statusText()}`;
        console.log(`❌ API Error: ${apiError}`);
      }
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Browser Console Error:', msg.text());
    }
  });

  try {
    console.log('🚀 Testing Location Dashboard...\n');

    // Step 1: Navigate directly to locations page
    console.log('📋 Step 1: Loading locations dashboard...');
    await page.goto('http://localhost:3000/inventory/locations', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait a bit for API calls to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Check if locations were loaded
    console.log('\n📋 Step 2: Checking API response...');
    if (apiError) {
      throw new Error(`API returned error: ${apiError}`);
    }

    if (!locationsLoaded) {
      console.log('⚠️  No location data loaded from API');
    } else {
      console.log(`✅ Successfully loaded ${locationCount} locations from API`);
    }

    // Step 3: Check for page elements
    console.log('\n📋 Step 3: Checking page elements...');
    
    // Check for statistics cards
    const statsCards = await page.$$('.card, [class*="card"]');
    console.log(`📊 Found ${statsCards.length} statistics cards`);

    // Check for location table or list
    const locationElements = await page.$$('table tbody tr, [class*="list"] > div, [class*="grid"] > div');
    console.log(`📍 Found ${locationElements.length} location elements in the UI`);

    // Check for search input
    const searchInput = await page.$('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]');
    if (searchInput) {
      console.log('✅ Search input found');
    } else {
      console.log('⚠️  Search input not found');
    }

    // Check for "Add Location" button
    const addButton = await page.$('a[href*="/new"]') || 
                     await page.$('button[class*="add"]') ||
                     await page.$('a[class*="add"]');
    if (addButton) {
      console.log('✅ Add Location button found');
    } else {
      console.log('⚠️  Add Location button not found');
    }

    // Step 4: Take screenshot
    await page.screenshot({ 
      path: 'location-dashboard-test.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as location-dashboard-test.png');

    // Step 5: Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary:');
    console.log('='.repeat(50));
    
    const testsPassed = [];
    const testsFailed = [];

    if (locationsLoaded && locationCount > 0) {
      testsPassed.push('API data loading');
    } else {
      testsFailed.push('API data loading');
    }

    if (!apiError) {
      testsPassed.push('No API errors');
    } else {
      testsFailed.push('API errors occurred');
    }

    if (statsCards.length >= 4) {
      testsPassed.push('Statistics cards present');
    } else {
      testsFailed.push('Statistics cards missing');
    }

    if (locationElements.length > 0) {
      testsPassed.push('Location data displayed');
    } else {
      testsFailed.push('Location data not displayed');
    }

    console.log(`\n✅ Passed: ${testsPassed.length} tests`);
    testsPassed.forEach(test => console.log(`   ✓ ${test}`));
    
    if (testsFailed.length > 0) {
      console.log(`\n❌ Failed: ${testsFailed.length} tests`);
      testsFailed.forEach(test => console.log(`   ✗ ${test}`));
    }

    const success = testsFailed.length === 0;
    console.log(`\n${success ? '🎉' : '⚠️'} Overall Result: ${success ? 'PASS' : 'PARTIAL PASS'}`);
    
    return { success, testsPassed, testsFailed, locationCount };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'location-dashboard-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved as location-dashboard-error.png');
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testLocationDashboard()
    .then((results) => {
      console.log('\n✅ Location dashboard test completed!');
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testLocationDashboard };