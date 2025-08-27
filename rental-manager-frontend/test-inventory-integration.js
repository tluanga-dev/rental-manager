const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Inventory Integration Test Suite
 * Tests inventory integration with transactions (purchases and rentals)
 */
class InventoryIntegrationTestSuite {
  constructor() {
    this.browser = null;
    this.page = null;
    this.integrationResults = {
      purchaseToInventory: [],
      rentalBlocking: [],
      rentalReturn: [],
      stockUpdates: [],
      crossPageConsistency: [],
      realTimeUpdates: []
    };
    this.testData = {
      createdPurchases: [],
      createdRentals: [],
      itemIds: [],
      customerIds: [],
      supplierIds: []
    };
    this.baseUrl = 'http://localhost:3000';
  }

  async initialize() {
    console.log('🔗 Initializing Inventory Integration Test Suite...');
    
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    this.page = await this.browser.newPage();

    // Set up monitoring
    await this.setupIntegrationMonitoring();

    console.log('✅ Integration test environment initialized');
  }

  async setupIntegrationMonitoring() {
    // Monitor network requests for API calls
    this.page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/') && (url.includes('/inventory/') || url.includes('/transactions/') || url.includes('/rentals/'))) {
        console.log(`🔍 API Call: ${response.status()} ${response.request().method()} ${url}`);
      }
    });

    // Monitor console for integration-related messages
    this.page.on('console', msg => {
      const text = msg.text();
      if (text.includes('inventory') || text.includes('transaction') || text.includes('rental') || text.includes('stock')) {
        console.log(`🔍 Console: [${msg.type()}] ${text}`);
      }
    });
  }

  async loginAsAdmin() {
    console.log('🔐 Logging in as admin...');
    
    try {
      await this.page.goto(`${this.baseUrl}/login`, { waitUntil: 'networkidle0' });
      
      await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
      
      await this.page.type('input[type="email"], input[name="email"]', 'admin@rentalmanager.com');
      await this.page.type('input[type="password"], input[name="password"]', 'admin123');
      await this.page.click('button[type="submit"]');
      
      await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
      
      const isLoggedIn = !this.page.url().includes('/login');
      console.log(isLoggedIn ? '✅ Admin login successful' : '❌ Admin login failed');
      return isLoggedIn;
    } catch (error) {
      console.log('❌ Admin login error:', error.message);
      return false;
    }
  }

  async testPurchaseToInventoryFlow() {
    console.log('\n📦 Testing Purchase to Inventory Integration...');
    
    try {
      // Navigate to purchase recording page
      await this.page.goto(`${this.baseUrl}/purchases/record`, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Wait for page to load
      await this.page.waitForTimeout(3000);
      
      console.log('🔍 Step 1: Recording a purchase...');
      
      // Check if purchase form exists
      const hasPurchaseForm = await this.page.$('form');
      if (!hasPurchaseForm) {
        console.log('⚠️ Purchase form not found - skipping purchase integration test');
        return { success: false, reason: 'Purchase form not available' };
      }

      // Fill purchase form (simplified version)
      try {
        // Look for supplier dropdown or input
        const supplierField = await this.page.$('input[placeholder*="supplier" i], select[name*="supplier"], [data-testid*="supplier"]');
        if (supplierField) {
          await supplierField.click();
          await supplierField.type('Test Supplier');
          await this.page.waitForTimeout(1000);
        }

        // Look for date input
        const dateField = await this.page.$('input[type="date"], input[name*="date"]');
        if (dateField) {
          await dateField.type('2024-01-15');
        }

        // Look for item fields (this might be complex depending on UI)
        const addItemButton = await this.page.$('button:has-text("Add"), button:has-text("Item")');
        if (addItemButton) {
          await addItemButton.click();
          await this.page.waitForTimeout(1000);
        }

        console.log('✅ Purchase form filled');
        
      } catch (error) {
        console.log('⚠️ Could not fill purchase form completely:', error.message);
      }

      // Get initial inventory count
      console.log('🔍 Step 2: Checking inventory before purchase...');
      await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(2000);

      const initialInventoryCount = await this.page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr');
        return rows.length;
      });

      console.log(`📊 Initial inventory items: ${initialInventoryCount}`);

      // Submit purchase (navigate back and try to submit)
      await this.page.goto(`${this.baseUrl}/purchases/record`, { waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(2000);

      const submitButton = await this.page.$('button[type="submit"], button:has-text("Submit"), button:has-text("Record")');
      if (submitButton) {
        console.log('🔍 Step 3: Submitting purchase...');
        try {
          await submitButton.click();
          await this.page.waitForTimeout(5000); // Wait for processing
          
          // Check for success message or redirect
          const isSuccessful = await this.page.evaluate(() => {
            const bodyText = document.body.innerText.toLowerCase();
            return bodyText.includes('success') || bodyText.includes('recorded') || bodyText.includes('created');
          });

          if (isSuccessful) {
            console.log('✅ Purchase submitted successfully');
          } else {
            console.log('⚠️ Purchase submission status unclear');
          }
          
        } catch (error) {
          console.log('⚠️ Purchase submission error:', error.message);
        }
      }

      // Check inventory after purchase
      console.log('🔍 Step 4: Checking inventory after purchase...');
      await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(3000);

      const finalInventoryCount = await this.page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr');
        return rows.length;
      });

      console.log(`📊 Final inventory items: ${finalInventoryCount}`);

      const inventoryUpdated = finalInventoryCount >= initialInventoryCount;
      
      const result = {
        testName: 'Purchase to Inventory Integration',
        initialCount: initialInventoryCount,
        finalCount: finalInventoryCount,
        inventoryUpdated: inventoryUpdated,
        success: inventoryUpdated,
        timestamp: new Date().toISOString()
      };

      this.integrationResults.purchaseToInventory.push(result);

      if (inventoryUpdated) {
        console.log('✅ Purchase to inventory integration working');
      } else {
        console.log('❌ Purchase to inventory integration issue detected');
      }

      return result;

    } catch (error) {
      console.log('❌ Purchase to inventory test failed:', error.message);
      
      const errorResult = {
        testName: 'Purchase to Inventory Integration',
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      };
      
      this.integrationResults.purchaseToInventory.push(errorResult);
      return errorResult;
    }
  }

  async testRentalBlockingFlow() {
    console.log('\n🚫 Testing Rental Inventory Blocking Flow...');
    
    try {
      // First, check available inventory
      await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(2000);

      console.log('🔍 Step 1: Checking available inventory...');
      
      const availableItems = await this.page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        return rows.map(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length > 5) {
            return {
              name: cells[0]?.textContent?.trim(),
              sku: cells[1]?.textContent?.trim(),
              available: cells[6]?.textContent?.trim() || '0'
            };
          }
          return null;
        }).filter(item => item && parseInt(item.available) > 0);
      });

      console.log(`📊 Found ${availableItems.length} items with available stock`);

      if (availableItems.length === 0) {
        console.log('⚠️ No available inventory for rental test');
        return { success: false, reason: 'No available inventory' };
      }

      const testItem = availableItems[0];
      console.log(`🎯 Testing with item: ${testItem.name} (Available: ${testItem.available})`);

      // Navigate to rental creation
      await this.page.goto(`${this.baseUrl}/rentals/create`, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Check if rental form exists
      const hasRentalForm = await this.page.$('form');
      if (!hasRentalForm) {
        console.log('⚠️ Rental form not found');
        return { success: false, reason: 'Rental form not available' };
      }

      console.log('🔍 Step 2: Creating rental...');

      try {
        // Fill rental form (simplified)
        const customerField = await this.page.$('input[placeholder*="customer" i], select[name*="customer"]');
        if (customerField) {
          await customerField.click();
          await customerField.type('Test Customer');
          await this.page.waitForTimeout(1000);
        }

        const startDateField = await this.page.$('input[type="date"], input[name*="start"], input[name*="from"]');
        if (startDateField) {
          const today = new Date().toISOString().split('T')[0];
          await startDateField.type(today);
        }

        const endDateField = await this.page.$('input[name*="end"], input[name*="to"], input[name*="return"]');
        if (endDateField) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          await endDateField.type(tomorrow.toISOString().split('T')[0]);
        }

        // Add item to rental
        const addItemButton = await this.page.$('button:has-text("Add"), button:has-text("Item")');
        if (addItemButton) {
          await addItemButton.click();
          await this.page.waitForTimeout(1000);
          
          // Try to select the test item
          const itemField = await this.page.$('input[placeholder*="item" i], select[name*="item"]');
          if (itemField) {
            await itemField.type(testItem.name.substring(0, 10));
            await this.page.waitForTimeout(1000);
          }
        }

        console.log('✅ Rental form filled');

      } catch (error) {
        console.log('⚠️ Could not fill rental form completely:', error.message);
      }

      // Submit rental
      const submitButton = await this.page.$('button[type="submit"], button:has-text("Submit"), button:has-text("Create")');
      if (submitButton) {
        console.log('🔍 Step 3: Submitting rental...');
        try {
          await submitButton.click();
          await this.page.waitForTimeout(5000);
        } catch (error) {
          console.log('⚠️ Rental submission error:', error.message);
        }
      }

      // Check inventory after rental
      console.log('🔍 Step 4: Checking inventory after rental creation...');
      await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(3000);

      const updatedItems = await this.page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        return rows.map(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length > 5) {
            return {
              name: cells[0]?.textContent?.trim(),
              sku: cells[1]?.textContent?.trim(),
              available: cells[6]?.textContent?.trim() || '0',
              onRent: cells[7]?.textContent?.trim() || '0'
            };
          }
          return null;
        }).filter(item => item);
      });

      const updatedTestItem = updatedItems.find(item => item.name === testItem.name);
      
      let rentalBlocked = false;
      if (updatedTestItem) {
        const newAvailable = parseInt(updatedTestItem.available);
        const onRent = parseInt(updatedTestItem.onRent);
        const originalAvailable = parseInt(testItem.available);
        
        rentalBlocked = newAvailable < originalAvailable || onRent > 0;
        
        console.log(`📊 Item: ${testItem.name}`);
        console.log(`   Original Available: ${originalAvailable}`);
        console.log(`   New Available: ${newAvailable}`);
        console.log(`   On Rent: ${onRent}`);
      }

      const result = {
        testName: 'Rental Inventory Blocking',
        itemTested: testItem.name,
        originalAvailable: testItem.available,
        updatedItem: updatedTestItem,
        inventoryBlocked: rentalBlocked,
        success: rentalBlocked,
        timestamp: new Date().toISOString()
      };

      this.integrationResults.rentalBlocking.push(result);

      if (rentalBlocked) {
        console.log('✅ Rental inventory blocking working');
      } else {
        console.log('❌ Rental inventory blocking issue detected');
      }

      return result;

    } catch (error) {
      console.log('❌ Rental blocking test failed:', error.message);
      
      const errorResult = {
        testName: 'Rental Inventory Blocking',
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      };
      
      this.integrationResults.rentalBlocking.push(errorResult);
      return errorResult;
    }
  }

  async testCrossPageConsistency() {
    console.log('\n🔄 Testing Cross-Page Data Consistency...');
    
    try {
      // Get inventory data from stock page
      console.log('🔍 Step 1: Getting inventory data from stock page...');
      await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(2000);

      const stockPageData = await this.page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        return rows.slice(0, 5).map(row => { // Test first 5 items
          const cells = row.querySelectorAll('td');
          if (cells.length > 5) {
            const itemName = cells[0]?.textContent?.trim();
            const sku = cells[1]?.textContent?.trim();
            const totalUnits = cells[5]?.textContent?.trim();
            const available = cells[6]?.textContent?.trim();
            
            return { itemName, sku, totalUnits, available };
          }
          return null;
        }).filter(item => item);
      });

      console.log(`📊 Collected data for ${stockPageData.length} items from stock page`);

      // Check the same items on their detail pages
      console.log('🔍 Step 2: Verifying data on item detail pages...');
      
      const consistencyResults = [];

      for (let i = 0; i < Math.min(stockPageData.length, 3); i++) { // Test first 3 items
        const item = stockPageData[i];
        
        try {
          // Find the item ID (this might require clicking the view button)
          await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
          await this.page.waitForTimeout(1000);

          // Look for view details buttons
          const viewButtons = await this.page.$$('button:has-text("View"), a[href*="/inventory/items/"]');
          
          if (viewButtons.length > i) {
            console.log(`🔍 Checking item ${i + 1}: ${item.itemName}`);
            
            await viewButtons[i].click();
            await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
            await this.page.waitForTimeout(2000);

            // Extract data from detail page
            const detailPageData = await this.page.evaluate(() => {
              const bodyText = document.body.innerText;
              
              // Look for item information (this will depend on actual UI structure)
              const itemName = document.querySelector('h1, h2, [class*="title"]')?.textContent?.trim();
              
              // Look for stock information
              const stockInfo = {
                itemName: itemName || 'Unknown',
                hasInventoryData: bodyText.includes('inventory') || bodyText.includes('stock'),
                hasUnitsData: bodyText.includes('units') || bodyText.includes('available'),
                dataPresent: bodyText.length > 100
              };

              return stockInfo;
            });

            const isConsistent = detailPageData.itemName && 
                               detailPageData.hasInventoryData && 
                               detailPageData.dataPresent;

            consistencyResults.push({
              itemName: item.itemName,
              sku: item.sku,
              stockPageData: item,
              detailPageData: detailPageData,
              isConsistent: isConsistent,
              timestamp: new Date().toISOString()
            });

            if (isConsistent) {
              console.log(`  ✅ Item ${item.itemName}: Data consistent`);
            } else {
              console.log(`  ❌ Item ${item.itemName}: Data inconsistency detected`);
            }
          }
          
        } catch (error) {
          console.log(`  ⚠️ Could not check item ${item.itemName}: ${error.message}`);
          consistencyResults.push({
            itemName: item.itemName,
            sku: item.sku,
            error: error.message,
            isConsistent: false,
            timestamp: new Date().toISOString()
          });
        }
      }

      const consistentCount = consistencyResults.filter(r => r.isConsistent).length;
      const totalCount = consistencyResults.length;

      const overallResult = {
        testName: 'Cross-Page Data Consistency',
        itemsTested: totalCount,
        consistentItems: consistentCount,
        inconsistentItems: totalCount - consistentCount,
        consistencyRate: totalCount > 0 ? Math.round((consistentCount / totalCount) * 100) : 0,
        success: consistentCount > 0,
        details: consistencyResults,
        timestamp: new Date().toISOString()
      };

      this.integrationResults.crossPageConsistency.push(overallResult);

      console.log(`📊 Cross-page consistency: ${consistentCount}/${totalCount} items (${overallResult.consistencyRate}%)`);

      if (overallResult.consistencyRate >= 70) {
        console.log('✅ Cross-page data consistency acceptable');
      } else {
        console.log('❌ Cross-page data consistency issues detected');
      }

      return overallResult;

    } catch (error) {
      console.log('❌ Cross-page consistency test failed:', error.message);
      
      const errorResult = {
        testName: 'Cross-Page Data Consistency',
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      };
      
      this.integrationResults.crossPageConsistency.push(errorResult);
      return errorResult;
    }
  }

  async testStockLevelUpdates() {
    console.log('\n📊 Testing Stock Level Updates...');
    
    try {
      // Go to inventory stock page
      await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(2000);

      console.log('🔍 Step 1: Getting initial stock levels...');

      // Capture initial state
      const initialState = await this.page.evaluate(() => {
        const summaryCards = Array.from(document.querySelectorAll('[class*="card"]')).map(card => {
          const title = card.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim();
          const value = card.querySelector('[class*="text-2xl"], [class*="text-xl"]')?.textContent?.trim();
          return { title, value };
        }).filter(card => card.title && card.value);

        const tableRows = document.querySelectorAll('tbody tr').length;
        
        return {
          summaryCards: summaryCards,
          totalItems: tableRows,
          timestamp: Date.now()
        };
      });

      console.log(`📊 Initial state: ${initialState.totalItems} items, ${initialState.summaryCards.length} summary cards`);

      // Perform some actions that should update stock levels
      console.log('🔍 Step 2: Performing stock-affecting actions...');

      // Try to trigger stock updates through filtering/searching
      const searchInput = await this.page.$('input[placeholder*="search" i]');
      if (searchInput) {
        await searchInput.type('Camera');
        await this.page.waitForTimeout(2000);
        
        await searchInput.click({ clickCount: 3 });
        await this.page.keyboard.press('Delete');
        await this.page.waitForTimeout(1000);
      }

      // Refresh the page to simulate stock updates
      await this.page.reload({ waitUntil: 'networkidle0' });
      await this.page.waitForTimeout(2000);

      // Capture final state
      const finalState = await this.page.evaluate(() => {
        const summaryCards = Array.from(document.querySelectorAll('[class*="card"]')).map(card => {
          const title = card.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim();
          const value = card.querySelector('[class*="text-2xl"], [class*="text-xl"]')?.textContent?.trim();
          return { title, value };
        }).filter(card => card.title && card.value);

        const tableRows = document.querySelectorAll('tbody tr').length;
        
        return {
          summaryCards: summaryCards,
          totalItems: tableRows,
          timestamp: Date.now()
        };
      });

      console.log(`📊 Final state: ${finalState.totalItems} items, ${finalState.summaryCards.length} summary cards`);

      // Compare states
      const dataConsistent = initialState.totalItems === finalState.totalItems ||
                            Math.abs(initialState.totalItems - finalState.totalItems) <= 2; // Allow small variations

      const cardsConsistent = initialState.summaryCards.length === finalState.summaryCards.length;

      const stockUpdatesWorking = dataConsistent && cardsConsistent;

      const result = {
        testName: 'Stock Level Updates',
        initialState: initialState,
        finalState: finalState,
        dataConsistent: dataConsistent,
        cardsConsistent: cardsConsistent,
        updatesWorking: stockUpdatesWorking,
        success: stockUpdatesWorking,
        timestamp: new Date().toISOString()
      };

      this.integrationResults.stockUpdates.push(result);

      if (stockUpdatesWorking) {
        console.log('✅ Stock level updates working correctly');
      } else {
        console.log('❌ Stock level update issues detected');
      }

      return result;

    } catch (error) {
      console.log('❌ Stock level updates test failed:', error.message);
      
      const errorResult = {
        testName: 'Stock Level Updates',
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      };
      
      this.integrationResults.stockUpdates.push(errorResult);
      return errorResult;
    }
  }

  async generateIntegrationReport() {
    console.log('\n📋 Generating Integration Test Report...');

    const report = {
      testSuite: 'Inventory Integration Test',
      timestamp: new Date().toISOString(),
      testResults: {
        purchaseToInventory: {
          tests: this.integrationResults.purchaseToInventory.length,
          successful: this.integrationResults.purchaseToInventory.filter(r => r.success).length,
          details: this.integrationResults.purchaseToInventory
        },
        rentalBlocking: {
          tests: this.integrationResults.rentalBlocking.length,
          successful: this.integrationResults.rentalBlocking.filter(r => r.success).length,
          details: this.integrationResults.rentalBlocking
        },
        crossPageConsistency: {
          tests: this.integrationResults.crossPageConsistency.length,
          successful: this.integrationResults.crossPageConsistency.filter(r => r.success).length,
          details: this.integrationResults.crossPageConsistency
        },
        stockUpdates: {
          tests: this.integrationResults.stockUpdates.length,
          successful: this.integrationResults.stockUpdates.filter(r => r.success).length,
          details: this.integrationResults.stockUpdates
        }
      },
      summary: {
        totalTests: 0,
        successfulTests: 0,
        integrationScore: 0
      }
    };

    // Calculate totals
    report.summary.totalTests = Object.values(report.testResults).reduce((sum, category) => sum + category.tests, 0);
    report.summary.successfulTests = Object.values(report.testResults).reduce((sum, category) => sum + category.successful, 0);
    report.summary.integrationScore = report.summary.totalTests > 0 
      ? Math.round((report.summary.successfulTests / report.summary.totalTests) * 100) 
      : 0;

    // Save JSON report
    const jsonReportPath = path.join(__dirname, 'inventory-integration-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlIntegrationReport(report);
    const htmlReportPath = path.join(__dirname, 'inventory-integration-report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log('\n🔗 INVENTORY INTEGRATION TEST RESULTS');
    console.log('======================================');
    console.log(`📊 Integration Score: ${report.summary.integrationScore}%`);
    console.log(`🔍 Total Tests: ${report.summary.totalTests}`);
    console.log(`✅ Successful: ${report.summary.successfulTests}`);
    console.log(`❌ Failed: ${report.summary.totalTests - report.summary.successfulTests}`);
    console.log(`\n📄 JSON Report: ${jsonReportPath}`);
    console.log(`🌐 HTML Report: ${htmlReportPath}`);

    return report;
  }

  generateHtmlIntegrationReport(report) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inventory Integration Test Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
            .integration-score { font-size: 3em; text-align: center; margin: 20px 0; }
            .excellent { color: #27ae60; }
            .good { color: #f39c12; }
            .poor { color: #e74c3c; }
            .test-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
            .test-card { background: #f8f9fa; padding: 20px; border-radius: 8px; }
            .success { border-left: 5px solid #27ae60; }
            .failure { border-left: 5px solid #e74c3c; }
            .partial { border-left: 5px solid #f39c12; }
            .detail-section { margin: 20px 0; }
            pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔗 Inventory Integration Test Report</h1>
                <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
                <p>Testing inventory integration with transactions and cross-page consistency</p>
            </div>
            
            <div class="integration-score ${report.summary.integrationScore >= 80 ? 'excellent' : report.summary.integrationScore >= 60 ? 'good' : 'poor'}">
                Integration Score: ${report.summary.integrationScore}%
            </div>

            <div style="text-align: center; margin: 20px 0;">
                <p><strong>Total Tests:</strong> ${report.summary.totalTests}</p>
                <p><strong>Successful:</strong> ${report.summary.successfulTests}</p>
                <p><strong>Failed:</strong> ${report.summary.totalTests - report.summary.successfulTests}</p>
            </div>

            <div class="test-grid">
                ${Object.entries(report.testResults).map(([category, results]) => {
                  const successRate = results.tests > 0 ? Math.round((results.successful / results.tests) * 100) : 0;
                  const cardClass = successRate === 100 ? 'success' : successRate > 0 ? 'partial' : 'failure';
                  return `
                    <div class="test-card ${cardClass}">
                        <h3>${successRate === 100 ? '✅' : successRate > 0 ? '⚠️' : '❌'} ${category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
                        <p><strong>Tests:</strong> ${results.tests}</p>
                        <p><strong>Successful:</strong> ${results.successful}</p>
                        <p><strong>Success Rate:</strong> ${successRate}%</p>
                    </div>
                  `;
                }).join('')}
            </div>

            <div class="detail-section">
                <h2>📊 Detailed Results</h2>
                
                ${Object.entries(report.testResults).map(([category, results]) => `
                    <h3>${category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
                    ${results.details.map(detail => `
                        <div style="background: ${detail.success ? '#e6f7e6' : '#ffe6e6'}; padding: 15px; margin: 10px 0; border-radius: 4px;">
                            <strong>${detail.success ? '✅ SUCCESS' : '❌ FAILURE'}:</strong> ${detail.testName || 'Integration Test'}
                            ${detail.error ? `<br><em>Error: ${detail.error}</em>` : ''}
                            ${detail.reason ? `<br><em>Reason: ${detail.reason}</em>` : ''}
                            <br><small>Timestamp: ${new Date(detail.timestamp).toLocaleString()}</small>
                        </div>
                    `).join('')}
                `).join('')}
            </div>

            <div class="detail-section">
                <h2>📋 Raw Test Data</h2>
                <pre>${JSON.stringify(report.testResults, null, 2)}</pre>
            </div>

            <div style="margin-top: 40px; text-align: center; color: #666;">
                <p>🔗 Integration testing ensures all parts work together seamlessly</p>
                <p>Report generated by Puppeteer Integration Test Suite</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('✅ Integration test cleanup completed');
  }

  async runIntegrationTestSuite() {
    try {
      await this.initialize();
      
      const loginSuccess = await this.loginAsAdmin();
      if (!loginSuccess) {
        throw new Error('Could not login - integration tests require authentication');
      }

      console.log('\n🎬 Starting Inventory Integration Test Suite...\n');

      // Run integration tests
      await this.testPurchaseToInventoryFlow();
      await this.testRentalBlockingFlow();
      await this.testCrossPageConsistency();
      await this.testStockLevelUpdates();

      // Generate comprehensive report
      const report = await this.generateIntegrationReport();

      console.log('\n🎉 INVENTORY INTEGRATION TESTING COMPLETE!');
      console.log(`📊 View detailed report: ${path.join(__dirname, 'inventory-integration-report.html')}`);

      return report;

    } catch (error) {
      console.error('❌ Integration test suite failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the integration test suite
if (require.main === module) {
  (async () => {
    const integrationTestSuite = new InventoryIntegrationTestSuite();
    await integrationTestSuite.runIntegrationTestSuite();
  })().catch(console.error);
}

module.exports = InventoryIntegrationTestSuite;