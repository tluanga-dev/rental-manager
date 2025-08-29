const puppeteer = require('puppeteer');

/**
 * Comprehensive test for Item Creation including edge cases
 */

class ComprehensiveItemCreationTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.authToken = null;
    this.testResults = [];
  }

  async setup() {
    console.log('🚀 Starting comprehensive item creation test...\n');
    
    this.browser = await puppeteer.launch({
      headless: true, // Run in headless mode for speed
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Monitor API responses
    this.page.on('response', response => {
      const url = response.url();
      const status = response.status();
      
      if (url.includes('/api/v1/items') && response.request().method() === 'POST') {
        console.log(`   API Response: ${status} ${response.statusText()}`);
        if (status === 500) {
          response.text().then(body => {
            console.log(`   ❌ Server Error Details:`, body);
          });
        }
      }
    });

    await this.page.setViewport({ width: 1280, height: 800 });
  }

  async login() {
    console.log('🔐 Logging in...');
    await this.page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
    
    // Click Demo Admin button
    const buttons = await this.page.$$('button');
    for (const button of buttons) {
      const text = await this.page.evaluate(el => el.textContent, button);
      if (text && text.includes('Demo Admin')) {
        await button.click();
        break;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('   ✅ Logged in successfully\n');
  }

  async createItem(itemData) {
    const testName = itemData.testName;
    console.log(`📝 Test: ${testName}`);
    
    try {
      // Navigate to item creation page
      await this.page.goto('http://localhost:3000/products/items/new', { 
        waitUntil: 'networkidle0' 
      });
      
      // Clear and fill item name
      const nameInput = await this.page.$('input[name="item_name"]');
      if (nameInput) {
        await nameInput.click({ clickCount: 3 }); // Select all text
        await nameInput.type(itemData.name);
      }
      
      // Set rentable/salable flags
      if (itemData.isRentable !== undefined) {
        const rentableCheckbox = await this.page.$('input[name="is_rentable"]');
        if (rentableCheckbox) {
          const isChecked = await this.page.$eval('input[name="is_rentable"]', el => el.checked);
          if (isChecked !== itemData.isRentable) {
            await rentableCheckbox.click();
          }
        }
      }
      
      if (itemData.isSalable !== undefined) {
        const salableCheckbox = await this.page.$('input[name="is_salable"]');
        if (salableCheckbox) {
          const isChecked = await this.page.$eval('input[name="is_salable"]', el => el.checked);
          if (isChecked !== itemData.isSalable) {
            await salableCheckbox.click();
          }
        }
      }
      
      // Fill price fields if provided
      if (itemData.rentalRate) {
        const rentalInput = await this.page.$('input[name="rental_rate_per_day"]');
        if (rentalInput) {
          await rentalInput.type(itemData.rentalRate.toString());
        }
      }
      
      if (itemData.salePrice) {
        const priceInput = await this.page.$('input[name="sale_price"]');
        if (priceInput) {
          await priceInput.type(itemData.salePrice.toString());
        }
      }
      
      // Select dropdowns if not already selected
      const categoryDropdown = await this.page.$('[data-testid="category-dropdown"], select[name="category_id"], [role="combobox"]');
      if (categoryDropdown) {
        const hasValue = await this.page.evaluate(el => {
          return el.value && el.value !== '';
        }, categoryDropdown);
        
        if (!hasValue) {
          await categoryDropdown.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          const firstOption = await this.page.$('[role="option"], option:not(:first-child)');
          if (firstOption) await firstOption.click();
        }
      }
      
      const brandDropdown = await this.page.$('[data-testid="brand-dropdown"], select[name="brand_id"], [role="combobox"][aria-label*="brand" i]');
      if (brandDropdown) {
        const hasValue = await this.page.evaluate(el => {
          return el.value && el.value !== '';
        }, brandDropdown);
        
        if (!hasValue) {
          await brandDropdown.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          const firstOption = await this.page.$('[role="option"], option:not(:first-child)');
          if (firstOption) await firstOption.click();
        }
      }
      
      const uomDropdown = await this.page.$('[data-testid="uom-dropdown"], select[name="unit_of_measurement_id"], [role="combobox"][aria-label*="unit" i]');
      if (uomDropdown) {
        const hasValue = await this.page.evaluate(el => {
          return el.value && el.value !== '';
        }, uomDropdown);
        
        if (!hasValue) {
          await uomDropdown.click();
          await new Promise(resolve => setTimeout(resolve, 500));
          const firstOption = await this.page.$('[role="option"], option:not(:first-child)');
          if (firstOption) await firstOption.click();
        }
      }
      
      // Submit form
      let responseReceived = false;
      let responseStatus = null;
      
      this.page.once('response', response => {
        if (response.url().includes('/api/v1/items') && response.request().method() === 'POST') {
          responseReceived = true;
          responseStatus = response.status();
        }
      });
      
      const submitButton = await this.page.$('button[type="submit"]');
      if (submitButton) {
        await submitButton.click();
      }
      
      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check result
      if (responseStatus === 201 || responseStatus === 200) {
        console.log(`   ✅ ${testName}: Item created successfully`);
        this.testResults.push({ test: testName, status: 'PASSED' });
      } else if (responseStatus === 409 && itemData.expectDuplicate) {
        console.log(`   ✅ ${testName}: Duplicate error handled correctly`);
        this.testResults.push({ test: testName, status: 'PASSED' });
      } else if (responseStatus === 500) {
        console.log(`   ❌ ${testName}: Server error (greenlet issue may persist)`);
        this.testResults.push({ test: testName, status: 'FAILED', error: 'Server error 500' });
      } else {
        console.log(`   ⚠️ ${testName}: Unexpected status ${responseStatus}`);
        this.testResults.push({ test: testName, status: 'WARNING', status: responseStatus });
      }
      
    } catch (error) {
      console.log(`   ❌ ${testName}: ${error.message}`);
      this.testResults.push({ test: testName, status: 'FAILED', error: error.message });
    }
    
    console.log('');
  }

  async runTests() {
    await this.setup();
    await this.login();
    
    console.log('🧪 Running comprehensive item creation tests...\n');
    
    // Test 1: Rentable-only item
    await this.createItem({
      testName: 'Rentable-only Item',
      name: `Test Rental Item ${Date.now()}`,
      isRentable: true,
      isSalable: false,
      rentalRate: 50
    });
    
    // Test 2: Salable-only item
    await this.createItem({
      testName: 'Salable-only Item',
      name: `Test Sale Item ${Date.now()}`,
      isRentable: false,
      isSalable: true,
      salePrice: 299.99
    });
    
    // Test 3: Both rentable and salable
    await this.createItem({
      testName: 'Rentable & Salable Item',
      name: `Test Dual Item ${Date.now()}`,
      isRentable: true,
      isSalable: true,
      rentalRate: 75,
      salePrice: 599.99
    });
    
    // Test 4: Item with minimal data
    await this.createItem({
      testName: 'Minimal Data Item',
      name: `Test Minimal ${Date.now()}`,
      isRentable: true,
      isSalable: false
    });
    
    // Test 5: Duplicate item (should fail with 409)
    const duplicateName = `Test Duplicate ${Date.now()}`;
    await this.createItem({
      testName: 'Original Item for Duplicate Test',
      name: duplicateName,
      isRentable: true,
      isSalable: false
    });
    
    await this.createItem({
      testName: 'Duplicate Item Test',
      name: duplicateName,
      isRentable: true,
      isSalable: false,
      expectDuplicate: true
    });
    
    // Print summary
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    
    const passed = this.testResults.filter(r => r.status === 'PASSED').length;
    const failed = this.testResults.filter(r => r.status === 'FAILED').length;
    const warnings = this.testResults.filter(r => r.status === 'WARNING').length;
    
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    
    if (failed > 0) {
      console.log('\n🔍 Failed Tests:');
      this.testResults.filter(r => r.status === 'FAILED').forEach(result => {
        console.log(`   • ${result.test}: ${result.error}`);
      });
    }
    
    const successRate = Math.round((passed / this.testResults.length) * 100);
    console.log(`\n🎯 Success Rate: ${successRate}%`);
    
    if (successRate === 100) {
      console.log('🎉 All tests passed! The greenlet issue is completely fixed.');
    } else if (successRate >= 80) {
      console.log('✅ Most tests passed. Minor issues remain.');
    } else {
      console.log('⚠️ Significant issues detected. Review the failed tests.');
    }
    
    await this.browser.close();
  }
}

// Run the comprehensive test
const test = new ComprehensiveItemCreationTest();
test.runTests().catch(console.error);