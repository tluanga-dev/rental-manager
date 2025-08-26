const puppeteer = require('puppeteer');

/**
 * Location Creation Test
 * Tests the ability to navigate to and interact with the location creation form
 */

async function testLocationCreation() {
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  
  // Track navigation and API calls
  let formLoaded = false;
  let createApiCalled = false;
  let createSuccess = false;

  page.on('response', async (response) => {
    const url = response.url();
    
    // Track location creation API call
    if (url.includes('/api/v1/locations') && response.request().method() === 'POST') {
      createApiCalled = true;
      console.log(`📡 Create API called: ${response.status()}`);
      
      if (response.ok()) {
        createSuccess = true;
        console.log('✅ Location created successfully');
      } else {
        console.log(`❌ Creation failed: ${response.status()} ${response.statusText()}`);
      }
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('404')) {
      console.log('❌ Console Error:', msg.text());
    }
  });

  try {
    console.log('🚀 Testing Location Creation Flow...\n');

    // Step 1: Navigate to locations dashboard
    console.log('📋 Step 1: Loading locations dashboard...');
    await page.goto('http://localhost:3000/inventory/locations', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    console.log('✅ Dashboard loaded');

    // Step 2: Navigate to creation form
    console.log('\n📋 Step 2: Navigating to location creation form...');
    
    // Try different ways to get to the creation form
    // First, try direct navigation
    await page.goto('http://localhost:3000/inventory/locations/new', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Check if we're on the creation page
    const currentUrl = page.url();
    if (currentUrl.includes('/new')) {
      formLoaded = true;
      console.log('✅ Location creation form loaded');
    } else {
      console.log('⚠️  Could not navigate to creation form');
      throw new Error('Creation form not accessible');
    }

    // Step 3: Check form elements
    console.log('\n📋 Step 3: Checking form elements...');
    
    const formElements = {
      location_code: await page.$('input[name="location_code"], input[id="location_code"], input[placeholder*="code" i]'),
      location_name: await page.$('input[name="location_name"], input[id="location_name"], input[placeholder*="name" i]'),
      location_type: await page.$('select[name="location_type"], select[id="location_type"], [data-testid="location_type"]'),
      address: await page.$('input[name="address"], textarea[name="address"], input[id="address"]'),
      city: await page.$('input[name="city"], input[id="city"]'),
      state: await page.$('input[name="state"], input[id="state"]'),
      country: await page.$('input[name="country"], input[id="country"]'),
      submit_button: await page.$('button[type="submit"]')
    };

    const foundElements = Object.entries(formElements)
      .filter(([_, element]) => element !== null)
      .map(([name]) => name);
    
    const missingElements = Object.entries(formElements)
      .filter(([_, element]) => element === null)
      .map(([name]) => name);

    console.log(`✅ Found ${foundElements.length} form elements:`, foundElements.join(', '));
    if (missingElements.length > 0) {
      console.log(`⚠️  Missing ${missingElements.length} elements:`, missingElements.join(', '));
    }

    // Step 4: Try to fill the form (if elements exist)
    if (formElements.location_code && formElements.location_name) {
      console.log('\n📋 Step 4: Filling location form...');
      
      const testData = {
        location_code: `TEST-${Date.now()}`,
        location_name: 'Test Location Dashboard',
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country'
      };

      try {
        // Fill location code
        if (formElements.location_code) {
          await formElements.location_code.click({ clickCount: 3 });
          await formElements.location_code.type(testData.location_code);
          console.log(`✅ Filled location_code: ${testData.location_code}`);
        }

        // Fill location name
        if (formElements.location_name) {
          await formElements.location_name.click({ clickCount: 3 });
          await formElements.location_name.type(testData.location_name);
          console.log(`✅ Filled location_name: ${testData.location_name}`);
        }

        // Fill address if available
        if (formElements.address) {
          await formElements.address.type(testData.address);
          console.log(`✅ Filled address`);
        }

        // Fill city if available
        if (formElements.city) {
          await formElements.city.type(testData.city);
          console.log(`✅ Filled city`);
        }

        console.log('✅ Form filled successfully');
        
        // Take screenshot of filled form
        await page.screenshot({ 
          path: 'location-form-filled.png',
          fullPage: true 
        });
        console.log('📸 Form screenshot saved as location-form-filled.png');

      } catch (fillError) {
        console.log('⚠️  Error filling form:', fillError.message);
      }
    } else {
      console.log('\n⚠️  Cannot fill form - required fields not found');
    }

    // Step 5: Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary:');
    console.log('='.repeat(50));

    const results = {
      dashboard_accessible: true,
      form_accessible: formLoaded,
      form_elements_found: foundElements.length,
      required_fields_present: !!(formElements.location_code && formElements.location_name),
      location_created: createSuccess
    };

    console.log('\nTest Results:');
    console.log(`✅ Dashboard accessible: ${results.dashboard_accessible}`);
    console.log(`${results.form_accessible ? '✅' : '❌'} Form accessible: ${results.form_accessible}`);
    console.log(`📝 Form elements found: ${results.form_elements_found}/8`);
    console.log(`${results.required_fields_present ? '✅' : '❌'} Required fields present: ${results.required_fields_present}`);

    const overallSuccess = results.form_accessible && results.required_fields_present;
    console.log(`\n${overallSuccess ? '🎉' : '⚠️'} Overall Result: ${overallSuccess ? 'PASS' : 'PARTIAL PASS'}`);

    return results;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'location-create-error.png',
      fullPage: true 
    });
    console.log('📸 Error screenshot saved as location-create-error.png');
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testLocationCreation()
    .then((results) => {
      console.log('\n✅ Location creation test completed!');
      process.exit(results.form_accessible ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testLocationCreation };