/**
 * Inventory Testing Helper Utilities
 * Provides reusable functions for inventory feature testing
 */

const fs = require('fs');
const path = require('path');

class InventoryTestHelpers {
  constructor(page) {
    this.page = page;
    this.baseUrl = 'http://localhost:3000';
    this.apiBaseUrl = 'http://localhost:8000/api/v1';
  }

  // Authentication helpers
  async login(credentials = { email: 'admin@rentalmanager.com', password: 'admin123' }) {
    console.log('🔐 Attempting login...');
    
    try {
      await this.page.goto(`${this.baseUrl}/login`, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait for form to be ready
      await this.page.waitForSelector('form, input[type="email"], input[name="email"]', { timeout: 10000 });

      // Find and fill email field
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        'input[id*="email" i]'
      ];

      let emailField = null;
      for (const selector of emailSelectors) {
        try {
          emailField = await this.page.$(selector);
          if (emailField) break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!emailField) {
        throw new Error('Email field not found');
      }

      // Find and fill password field
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[placeholder*="password" i]',
        'input[id*="password" i]'
      ];

      let passwordField = null;
      for (const selector of passwordSelectors) {
        try {
          passwordField = await this.page.$(selector);
          if (passwordField) break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!passwordField) {
        throw new Error('Password field not found');
      }

      // Clear and fill fields
      await emailField.click({ clickCount: 3 });
      await emailField.type(credentials.email);
      await passwordField.click({ clickCount: 3 });
      await passwordField.type(credentials.password);

      // Submit form
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign in")',
        'form button:last-of-type'
      ];

      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          submitButton = await this.page.$(selector);
          if (submitButton) break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!submitButton) {
        throw new Error('Submit button not found');
      }

      await submitButton.click();

      // Wait for navigation or success
      try {
        await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
      } catch (e) {
        // Sometimes navigation doesn't trigger, check URL instead
        await this.page.waitForTimeout(2000);
      }

      const currentUrl = this.page.url();
      const isLoggedIn = !currentUrl.includes('/login') && 
                        (currentUrl.includes('/dashboard') || currentUrl.includes('/inventory') || currentUrl.includes('/'));

      if (isLoggedIn) {
        console.log('✅ Login successful');
        return true;
      } else {
        console.log('❌ Login failed - still on login page');
        return false;
      }

    } catch (error) {
      console.log('❌ Login error:', error.message);
      return false;
    }
  }

  // Navigation helpers
  async navigateToInventoryStock() {
    console.log('🧭 Navigating to inventory stock page...');
    
    try {
      await this.page.goto(`${this.baseUrl}/inventory/stock`, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait for page content
      await this.page.waitForSelector('body', { timeout: 10000 });
      await this.page.waitForTimeout(2000); // Allow React to render

      const isOnInventoryPage = this.page.url().includes('/inventory');
      
      if (isOnInventoryPage) {
        console.log('✅ Successfully navigated to inventory stock page');
        return true;
      } else {
        console.log('❌ Failed to navigate to inventory stock page');
        return false;
      }
    } catch (error) {
      console.log('❌ Navigation error:', error.message);
      return false;
    }
  }

  async navigateToItemDetail(itemId) {
    console.log(`🧭 Navigating to item detail page: ${itemId}...`);
    
    try {
      await this.page.goto(`${this.baseUrl}/inventory/items/${itemId}`, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      await this.page.waitForSelector('body', { timeout: 10000 });
      await this.page.waitForTimeout(2000);

      const isOnItemPage = this.page.url().includes(`/inventory/items/${itemId}`);
      
      if (isOnItemPage) {
        console.log('✅ Successfully navigated to item detail page');
        return true;
      } else {
        console.log('❌ Failed to navigate to item detail page');
        return false;
      }
    } catch (error) {
      console.log('❌ Item detail navigation error:', error.message);
      return false;
    }
  }

  // Search and filter helpers
  async performSearch(searchTerm) {
    console.log(`🔍 Performing search: "${searchTerm}"`);
    
    try {
      const searchSelectors = [
        'input[placeholder*="search" i]',
        'input[placeholder*="Search"]',
        'input[type="search"]',
        'input[name="search"]',
        'input[id*="search" i]'
      ];

      let searchInput = null;
      for (const selector of searchSelectors) {
        try {
          searchInput = await this.page.$(selector);
          if (searchInput) break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!searchInput) {
        console.log('⚠️ Search input not found');
        return false;
      }

      // Clear and type search term
      await searchInput.click({ clickCount: 3 });
      await this.page.keyboard.press('Delete');
      
      if (searchTerm) {
        await searchInput.type(searchTerm);
      }

      // Wait for debounced search
      await this.page.waitForTimeout(800);

      console.log('✅ Search performed successfully');
      return true;

    } catch (error) {
      console.log('❌ Search error:', error.message);
      return false;
    }
  }

  async applyFilter(filterType, filterValue) {
    console.log(`🎛️ Applying filter: ${filterType} = ${filterValue}`);
    
    try {
      let filterElement = null;

      switch (filterType) {
        case 'category':
          filterElement = await this.page.$('select[data-testid="category-filter"], select:has(option[value*="category"])', 'select');
          break;
        case 'stock_status':
          filterElement = await this.page.$('select[data-testid="stock-status-filter"], select:has(option[value*="STOCK"])');
          break;
        case 'brand':
          filterElement = await this.page.$('select[data-testid="brand-filter"], select:has(option[value*="brand"])');
          break;
        case 'location':
          filterElement = await this.page.$('select[data-testid="location-filter"], select:has(option[value*="location"])');
          break;
      }

      if (!filterElement) {
        console.log(`⚠️ Filter element not found for: ${filterType}`);
        return false;
      }

      await filterElement.select(filterValue);
      await this.page.waitForTimeout(1000);

      console.log('✅ Filter applied successfully');
      return true;

    } catch (error) {
      console.log('❌ Filter error:', error.message);
      return false;
    }
  }

  async clearAllFilters() {
    console.log('🧹 Clearing all filters...');
    
    try {
      const clearButtons = [
        'button:has-text("Clear")',
        'button:has-text("Reset")',
        'button:has-text("Clear Filters")',
        'button[data-testid="clear-filters"]'
      ];

      let clearButton = null;
      for (const selector of clearButtons) {
        try {
          clearButton = await this.page.$(selector);
          if (clearButton) break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (clearButton) {
        await clearButton.click();
        await this.page.waitForTimeout(1000);
        console.log('✅ Filters cleared');
        return true;
      } else {
        console.log('⚠️ Clear filters button not found');
        return false;
      }

    } catch (error) {
      console.log('❌ Clear filters error:', error.message);
      return false;
    }
  }

  // Data validation helpers
  async getTableData() {
    console.log('📊 Extracting table data...');
    
    try {
      const tableData = await this.page.evaluate(() => {
        const table = document.querySelector('table');
        if (!table) return null;

        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim());
        
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(row => {
          return Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim());
        });

        return { headers, rows, rowCount: rows.length };
      });

      if (tableData) {
        console.log(`✅ Extracted ${tableData.rowCount} rows with ${tableData.headers.length} columns`);
        return tableData;
      } else {
        console.log('⚠️ No table found');
        return null;
      }

    } catch (error) {
      console.log('❌ Table data extraction error:', error.message);
      return null;
    }
  }

  async getSummaryCardData() {
    console.log('📋 Extracting summary card data...');
    
    try {
      const summaryData = await this.page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('[class*="card"], .card, [data-testid*="card"]'));
        
        return cards.map((card, index) => {
          const title = card.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"]')?.textContent?.trim();
          const value = card.querySelector('[class*="text-2xl"], [class*="text-xl"], .value')?.textContent?.trim();
          const description = card.querySelector('p, [class*="text-sm"], .description')?.textContent?.trim();
          
          return { index, title, value, description };
        }).filter(card => card.title || card.value);
      });

      console.log(`✅ Found ${summaryData.length} summary cards`);
      return summaryData;

    } catch (error) {
      console.log('❌ Summary card extraction error:', error.message);
      return [];
    }
  }

  async validatePageContent(expectedContent) {
    console.log('🔍 Validating page content...');
    
    try {
      const pageContent = await this.page.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body.innerText.toLowerCase(),
          hasTable: !!document.querySelector('table'),
          hasCards: !!document.querySelector('[class*="card"], .card'),
          hasForm: !!document.querySelector('form'),
          hasButtons: document.querySelectorAll('button').length,
          hasInputs: document.querySelectorAll('input').length
        };
      });

      const validations = [];

      for (const [key, expectedValue] of Object.entries(expectedContent)) {
        if (key === 'containsText') {
          const contains = Array.isArray(expectedValue) 
            ? expectedValue.some(text => pageContent.bodyText.includes(text.toLowerCase()))
            : pageContent.bodyText.includes(expectedValue.toLowerCase());
          validations.push({ key, expected: expectedValue, actual: contains, passed: contains });
        } else if (key === 'minimumButtons') {
          const passed = pageContent.hasButtons >= expectedValue;
          validations.push({ key, expected: `>= ${expectedValue}`, actual: pageContent.hasButtons, passed });
        } else if (key === 'minimumInputs') {
          const passed = pageContent.hasInputs >= expectedValue;
          validations.push({ key, expected: `>= ${expectedValue}`, actual: pageContent.hasInputs, passed });
        } else {
          const passed = pageContent[key] === expectedValue;
          validations.push({ key, expected: expectedValue, actual: pageContent[key], passed });
        }
      }

      const passedValidations = validations.filter(v => v.passed).length;
      const totalValidations = validations.length;

      console.log(`✅ Content validation: ${passedValidations}/${totalValidations} passed`);
      
      validations.forEach(v => {
        const status = v.passed ? '✅' : '❌';
        console.log(`  ${status} ${v.key}: expected ${v.expected}, got ${v.actual}`);
      });

      return { validations, passRate: passedValidations / totalValidations };

    } catch (error) {
      console.log('❌ Content validation error:', error.message);
      return { validations: [], passRate: 0 };
    }
  }

  // Performance measurement helpers
  async measurePageLoadTime() {
    console.log('⏱️ Measuring page load time...');
    
    try {
      const navigationMetrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            totalTime: navigation.loadEventEnd - navigation.fetchStart,
            dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
            tcpConnect: navigation.connectEnd - navigation.connectStart,
            ttfb: navigation.responseStart - navigation.requestStart
          };
        }
        return null;
      });

      if (navigationMetrics) {
        console.log('📊 Page load metrics:', navigationMetrics);
        return navigationMetrics;
      }

      return null;

    } catch (error) {
      console.log('❌ Performance measurement error:', error.message);
      return null;
    }
  }

  async measureFilterResponseTime() {
    console.log('⏱️ Measuring filter response time...');
    
    try {
      const startTime = Date.now();
      
      // Perform a search operation
      await this.performSearch('test');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`📊 Filter response time: ${responseTime}ms`);
      return responseTime;

    } catch (error) {
      console.log('❌ Filter response time measurement error:', error.message);
      return null;
    }
  }

  // Screenshot and reporting helpers
  async takeScreenshot(filename, options = {}) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join(__dirname, '../test-screenshots/inventory', `${filename}-${timestamp}.png`);
      
      // Ensure directory exists
      const dir = path.dirname(screenshotPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await this.page.screenshot({ 
        path: screenshotPath, 
        fullPage: true,
        ...options
      });

      console.log(`📸 Screenshot saved: ${path.basename(screenshotPath)}`);
      return screenshotPath;

    } catch (error) {
      console.log(`❌ Screenshot error for ${filename}:`, error.message);
      return null;
    }
  }

  async captureNetworkRequests(duration = 5000) {
    console.log(`📡 Capturing network requests for ${duration}ms...`);
    
    const requests = [];
    const responses = [];

    const requestHandler = request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now()
      });
    };

    const responseHandler = response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        timestamp: Date.now()
      });
    };

    this.page.on('request', requestHandler);
    this.page.on('response', responseHandler);

    await this.page.waitForTimeout(duration);

    this.page.removeListener('request', requestHandler);
    this.page.removeListener('response', responseHandler);

    console.log(`📊 Captured ${requests.length} requests and ${responses.length} responses`);
    
    return { requests, responses };
  }

  // Error checking helpers
  async checkForErrors() {
    console.log('🚨 Checking for page errors...');
    
    try {
      const errors = await this.page.evaluate(() => {
        const errorElements = document.querySelectorAll('[class*="error"], .error, [role="alert"]');
        const errorMessages = Array.from(errorElements).map(el => el.textContent?.trim()).filter(Boolean);
        
        // Check for common error indicators in text
        const bodyText = document.body.innerText.toLowerCase();
        const errorKeywords = ['error', 'failed', 'not found', '404', '500', 'something went wrong'];
        const foundKeywords = errorKeywords.filter(keyword => bodyText.includes(keyword));
        
        return {
          errorElements: errorMessages,
          errorKeywords: foundKeywords,
          hasErrors: errorMessages.length > 0 || foundKeywords.length > 0
        };
      });

      if (errors.hasErrors) {
        console.log('⚠️ Page errors detected:');
        errors.errorElements.forEach(msg => console.log(`  - ${msg}`));
        errors.errorKeywords.forEach(keyword => console.log(`  - Found keyword: ${keyword}`));
      } else {
        console.log('✅ No errors detected');
      }

      return errors;

    } catch (error) {
      console.log('❌ Error checking failed:', error.message);
      return { errorElements: [], errorKeywords: [], hasErrors: false };
    }
  }

  // Utility methods
  async waitForDataLoad(maxWaitTime = 10000) {
    console.log('⏳ Waiting for data to load...');
    
    try {
      // Wait for loading indicators to disappear
      await this.page.waitForFunction(() => {
        const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], .loading, .spinner');
        return loadingElements.length === 0;
      }, { timeout: maxWaitTime });

      // Additional wait for data to populate
      await this.page.waitForTimeout(2000);

      console.log('✅ Data loaded');
      return true;

    } catch (error) {
      console.log('⚠️ Data load timeout (this may be normal)');
      return false;
    }
  }

  async scrollToBottom() {
    console.log('📜 Scrolling to bottom of page...');
    
    try {
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await this.page.waitForTimeout(1000);
      
      console.log('✅ Scrolled to bottom');
      return true;

    } catch (error) {
      console.log('❌ Scroll error:', error.message);
      return false;
    }
  }

  // Test result formatting
  formatTestResult(testName, success, details = '') {
    const status = success ? '✅ PASS' : '❌ FAIL';
    const result = `${status} ${testName}`;
    
    if (details) {
      console.log(`${result} - ${details}`);
    } else {
      console.log(result);
    }
    
    return { testName, success, details, timestamp: new Date().toISOString() };
  }

  // Generate test summary
  generateTestSummary(testResults) {
    const total = testResults.length;
    const passed = testResults.filter(r => r.success).length;
    const failed = total - passed;
    const successRate = Math.round((passed / total) * 100);
    
    const summary = {
      total,
      passed,
      failed,
      successRate,
      timestamp: new Date().toISOString()
    };

    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${successRate}%`);

    return summary;
  }
}

module.exports = InventoryTestHelpers;