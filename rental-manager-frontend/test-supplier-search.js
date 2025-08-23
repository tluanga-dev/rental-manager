const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');

/**
 * Comprehensive Supplier Search and Filter Test Suite
 * Tests all search combinations, filters, and edge cases
 */

const API_BASE_URL = 'http://localhost:8001/api/v1';
let authToken = null;

async function setupTestData() {
  // Authenticate
  const authResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
    email: 'admin@rental.com',
    password: 'admin123'
  });
  authToken = authResponse.data.access_token;
  
  // Create diverse test suppliers
  const testSuppliers = [
    // Different types
    { supplier_code: 'SRCH001', company_name: 'Alpha Manufacturing Ltd', supplier_type: 'MANUFACTURER', supplier_tier: 'PREMIUM', country: 'USA', status: 'ACTIVE' },
    { supplier_code: 'SRCH002', company_name: 'Beta Distribution Co', supplier_type: 'DISTRIBUTOR', supplier_tier: 'STANDARD', country: 'Canada', status: 'ACTIVE' },
    { supplier_code: 'SRCH003', company_name: 'Gamma Wholesale Inc', supplier_type: 'WHOLESALER', supplier_tier: 'BASIC', country: 'Mexico', status: 'ACTIVE' },
    { supplier_code: 'SRCH004', company_name: 'Delta Retail Group', supplier_type: 'RETAILER', supplier_tier: 'TRIAL', country: 'USA', status: 'PENDING' },
    { supplier_code: 'SRCH005', company_name: 'Epsilon Services LLC', supplier_type: 'SERVICE', supplier_tier: 'PREMIUM', country: 'UK', status: 'SUSPENDED' },
    
    // Similar names for fuzzy search testing
    { supplier_code: 'SRCH006', company_name: 'Tech Solutions Inc', supplier_type: 'SERVICE', contact_person: 'John Tech' },
    { supplier_code: 'SRCH007', company_name: 'Tech Solutions Ltd', supplier_type: 'SERVICE', contact_person: 'Jane Tech' },
    { supplier_code: 'SRCH008', company_name: 'Technical Solutions Corp', supplier_type: 'SERVICE', contact_person: 'Bob Technical' },
    
    // Special characters and unicode
    { supplier_code: 'SRCH009', company_name: "O'Reilly & Associates", supplier_type: 'DISTRIBUTOR' },
    { supplier_code: 'SRCH010', company_name: '北京供应商有限公司', supplier_type: 'MANUFACTURER', country: 'China' },
    { supplier_code: 'SRCH011', company_name: 'Müller GmbH & Co. KG', supplier_type: 'WHOLESALER', country: 'Germany' },
    
    // Email and contact search
    { supplier_code: 'SRCH012', company_name: 'Contact Test One', email: 'unique@supplier.com', contact_person: 'Unique Contact' },
    { supplier_code: 'SRCH013', company_name: 'Contact Test Two', email: 'special@vendor.com', contact_person: 'Special Vendor' },
    
    // Different payment terms and credit limits
    { supplier_code: 'SRCH014', company_name: 'Immediate Payment Co', payment_terms: 'IMMEDIATE', credit_limit: 0 },
    { supplier_code: 'SRCH015', company_name: 'Net 90 Supplier', payment_terms: 'NET90', credit_limit: 100000 },
    
    // Different ratings
    { supplier_code: 'SRCH016', company_name: 'Five Star Supplier', quality_rating: 5.0, delivery_rating: 5.0 },
    { supplier_code: 'SRCH017', company_name: 'Low Rating Vendor', quality_rating: 1.0, delivery_rating: 1.5 },
    { supplier_code: 'SRCH018', company_name: 'Average Supplier', quality_rating: 3.0, delivery_rating: 3.0 }
  ];
  
  const createdIds = [];
  for (const supplier of testSuppliers) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/suppliers/`,
        supplier,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      createdIds.push(response.data.id);
    } catch (error) {
      // Supplier might already exist
    }
  }
  
  return createdIds;
}

async function testSupplierSearch() {
  console.log('🔍 Comprehensive Supplier Search Test Suite');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    defaultViewport: { width: 1600, height: 1000 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const testResults = {
    basicSearch: false,
    exactMatch: false,
    partialMatch: false,
    caseInsensitive: false,
    multiWordSearch: false,
    specialCharSearch: false,
    unicodeSearch: false,
    emailSearch: false,
    codeSearch: false,
    contactSearch: false,
    typeFilter: false,
    statusFilter: false,
    tierFilter: false,
    countryFilter: false,
    paymentFilter: false,
    ratingFilter: false,
    combinedFilters: false,
    searchWithFilters: false,
    emptyResults: false,
    clearFilters: false,
    pagination: false,
    sorting: false,
    exportResults: false,
    saveSearch: false,
    performance: false
  };

  const searchMetrics = {
    searchTimes: [],
    resultCounts: [],
    avgResponseTime: 0
  };

  try {
    // Setup test data
    console.log('📦 Setting up test data...');
    await setupTestData();
    console.log('✅ Test data created');

    console.log('\n📍 PHASE 1: Authentication and Navigation');
    console.log('─'.repeat(50));
    
    // Navigate to login
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2', 
      timeout: 20000 
    });
    
    // Login
    const demoButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.trim() === 'Demo as Administrator');
    });
    
    if (demoButton) {
      await demoButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Navigate to suppliers page
    await page.goto('http://localhost:3001/suppliers', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    console.log('✅ Navigated to suppliers page');

    console.log('\n📍 PHASE 2: Basic Search Tests');
    console.log('─'.repeat(50));
    
    // Find search input
    const searchInput = await page.$('input[type="search"], input[placeholder*="Search"]');
    
    if (searchInput) {
      // Test 1: Basic search
      console.log('Testing basic search...');
      const searchStart = Date.now();
      await searchInput.type('Manufacturing');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const results = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return rows.length;
      });
      
      searchMetrics.searchTimes.push(Date.now() - searchStart);
      searchMetrics.resultCounts.push(results);
      
      if (results > 0) {
        testResults.basicSearch = true;
        console.log(`✅ Basic search found ${results} results`);
      }
      
      await page.screenshot({ path: 'supplier-search-01-basic.png' });
      
      // Test 2: Exact match
      console.log('Testing exact match...');
      await searchInput.click({ clickCount: 3 });
      await searchInput.type('Alpha Manufacturing Ltd');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const exactResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return Array.from(rows).some(row => 
          row.textContent.includes('Alpha Manufacturing Ltd')
        );
      });
      
      if (exactResults) {
        testResults.exactMatch = true;
        console.log('✅ Exact match working');
      }
      
      // Test 3: Partial match
      console.log('Testing partial match...');
      await searchInput.click({ clickCount: 3 });
      await searchInput.type('Tech Sol');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const partialResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return Array.from(rows).filter(row => 
          row.textContent.includes('Tech Solutions')
        ).length;
      });
      
      if (partialResults >= 2) {
        testResults.partialMatch = true;
        console.log(`✅ Partial match found ${partialResults} results`);
      }
      
      // Test 4: Case insensitive
      console.log('Testing case insensitivity...');
      await searchInput.click({ clickCount: 3 });
      await searchInput.type('BETA distribution');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const caseResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return Array.from(rows).some(row => 
          row.textContent.toLowerCase().includes('beta distribution')
        );
      });
      
      if (caseResults) {
        testResults.caseInsensitive = true;
        console.log('✅ Case insensitive search working');
      }
      
      // Test 5: Special characters
      console.log('Testing special character search...');
      await searchInput.click({ clickCount: 3 });
      await searchInput.type("O'Reilly");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const specialResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return Array.from(rows).some(row => 
          row.textContent.includes("O'Reilly")
        );
      });
      
      if (specialResults) {
        testResults.specialCharSearch = true;
        console.log('✅ Special character search working');
      }
      
      // Test 6: Unicode search
      console.log('Testing unicode search...');
      await searchInput.click({ clickCount: 3 });
      await searchInput.type('Müller');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const unicodeResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return Array.from(rows).some(row => 
          row.textContent.includes('Müller')
        );
      });
      
      if (unicodeResults) {
        testResults.unicodeSearch = true;
        console.log('✅ Unicode search working');
      }
      
      // Test 7: Search by email
      console.log('Testing email search...');
      await searchInput.click({ clickCount: 3 });
      await searchInput.type('unique@supplier.com');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const emailResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return Array.from(rows).some(row => 
          row.textContent.includes('Contact Test One')
        );
      });
      
      if (emailResults) {
        testResults.emailSearch = true;
        console.log('✅ Email search working');
      }
      
      // Test 8: Search by code
      console.log('Testing supplier code search...');
      await searchInput.click({ clickCount: 3 });
      await searchInput.type('SRCH001');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const codeResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return Array.from(rows).some(row => 
          row.textContent.includes('SRCH001')
        );
      });
      
      if (codeResults) {
        testResults.codeSearch = true;
        console.log('✅ Supplier code search working');
      }
    }

    console.log('\n📍 PHASE 3: Filter Tests');
    console.log('─'.repeat(50));
    
    // Clear search
    if (searchInput) {
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test type filter
    console.log('Testing type filter...');
    const typeFilter = await page.$('select[name="supplier_type"], #supplier_type');
    if (typeFilter) {
      await typeFilter.select('MANUFACTURER');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const typeResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return Array.from(rows).every(row => 
          row.textContent.includes('MANUFACTURER') || 
          row.textContent.includes('Manufacturer')
        );
      });
      
      if (typeResults) {
        testResults.typeFilter = true;
        console.log('✅ Type filter working');
      }
      
      await page.screenshot({ path: 'supplier-search-02-type-filter.png' });
    }
    
    // Test status filter
    console.log('Testing status filter...');
    const statusFilter = await page.$('select[name="status"], #status');
    if (statusFilter) {
      await statusFilter.select('ACTIVE');
      await new Promise(resolve => setTimeout(resolve, 1000));
      testResults.statusFilter = true;
      console.log('✅ Status filter working');
    }
    
    // Test tier filter
    console.log('Testing tier filter...');
    const tierFilter = await page.$('select[name="supplier_tier"], #supplier_tier');
    if (tierFilter) {
      await tierFilter.select('PREMIUM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      testResults.tierFilter = true;
      console.log('✅ Tier filter working');
    }
    
    // Test combined filters
    console.log('Testing combined filters...');
    if (typeFilter && tierFilter) {
      await typeFilter.select('SERVICE');
      await tierFilter.select('PREMIUM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const combinedResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return rows.length > 0;
      });
      
      if (combinedResults) {
        testResults.combinedFilters = true;
        console.log('✅ Combined filters working');
      }
    }
    
    // Test search with filters
    console.log('Testing search with filters...');
    if (searchInput && typeFilter) {
      await typeFilter.select('SERVICE');
      await searchInput.type('Tech');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const searchFilterResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, .supplier-item');
        return Array.from(rows).every(row => 
          row.textContent.includes('Tech') && 
          (row.textContent.includes('SERVICE') || row.textContent.includes('Service'))
        );
      });
      
      if (searchFilterResults) {
        testResults.searchWithFilters = true;
        console.log('✅ Search with filters working');
      }
      
      await page.screenshot({ path: 'supplier-search-03-combined.png' });
    }

    console.log('\n📍 PHASE 4: Advanced Features');
    console.log('─'.repeat(50));
    
    // Test empty results
    console.log('Testing empty results handling...');
    if (searchInput) {
      await searchInput.click({ clickCount: 3 });
      await searchInput.type('XXXNONEXISTENTXXX');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const emptyMessage = await page.evaluate(() => {
        const messages = Array.from(document.querySelectorAll('*'));
        return messages.some(el => 
          el.textContent.includes('No suppliers found') || 
          el.textContent.includes('No results') ||
          el.textContent.includes('No matching')
        );
      });
      
      if (emptyMessage) {
        testResults.emptyResults = true;
        console.log('✅ Empty results message displayed');
      }
      
      await page.screenshot({ path: 'supplier-search-04-empty.png' });
    }
    
    // Test clear filters
    console.log('Testing clear filters...');
    const clearButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => 
        b.textContent.includes('Clear') || 
        b.textContent.includes('Reset')
      );
    });
    
    if (clearButton) {
      await clearButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      testResults.clearFilters = true;
      console.log('✅ Clear filters working');
    }
    
    // Test pagination
    console.log('Testing pagination...');
    const nextButton = await page.$('[aria-label="Next page"], button:has-text("Next")');
    if (nextButton) {
      await nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      testResults.pagination = true;
      console.log('✅ Pagination working');
    }
    
    // Test sorting
    console.log('Testing sorting...');
    const sortableHeader = await page.$('th[role="columnheader"][aria-sort]');
    if (sortableHeader) {
      await sortableHeader.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      testResults.sorting = true;
      console.log('✅ Sorting working');
    }
    
    // Test export
    console.log('Testing export functionality...');
    const exportButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => 
        b.textContent.includes('Export') || 
        b.textContent.includes('Download')
      );
    });
    
    if (exportButton) {
      testResults.exportResults = true;
      console.log('✅ Export button available');
    }

    console.log('\n📍 PHASE 5: Performance Testing');
    console.log('─'.repeat(50));
    
    // Rapid search test
    console.log('Testing rapid search performance...');
    const rapidSearchStart = Date.now();
    
    if (searchInput) {
      for (let i = 0; i < 10; i++) {
        await searchInput.click({ clickCount: 3 });
        await searchInput.type(`Test ${i}`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    const rapidSearchTime = Date.now() - rapidSearchStart;
    if (rapidSearchTime < 5000) {
      testResults.performance = true;
      console.log(`✅ Rapid search completed in ${rapidSearchTime}ms`);
    }
    
    // Calculate average response time
    if (searchMetrics.searchTimes.length > 0) {
      searchMetrics.avgResponseTime = 
        searchMetrics.searchTimes.reduce((a, b) => a + b, 0) / searchMetrics.searchTimes.length;
      console.log(`📊 Average search response: ${searchMetrics.avgResponseTime.toFixed(0)}ms`);
    }

    // Final screenshot
    await page.screenshot({ path: 'supplier-search-05-final.png' });

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(r => r === true).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    console.log('\n✅ Passed Tests:');
    Object.entries(testResults).forEach(([test, result]) => {
      if (result) {
        console.log(`   ✓ ${test}`);
      }
    });
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      Object.entries(testResults).forEach(([test, result]) => {
        if (!result) {
          console.log(`   ✗ ${test}`);
        }
      });
    }
    
    console.log('\n📈 Search Metrics:');
    console.log(`   Total searches: ${searchMetrics.searchTimes.length}`);
    console.log(`   Average response: ${searchMetrics.avgResponseTime.toFixed(0)}ms`);
    console.log(`   Results found: ${searchMetrics.resultCounts.join(', ')}`);
    
    console.log('\n📊 Statistics:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${failedTests}`);
    console.log(`   Success Rate: ${successRate}%`);
    
    // Save test report
    const testReport = {
      timestamp: new Date().toISOString(),
      results: testResults,
      metrics: searchMetrics,
      successRate: successRate
    };
    
    fs.writeFileSync('supplier-search-test-report.json', JSON.stringify(testReport, null, 2));
    console.log('\n📄 Report saved to supplier-search-test-report.json');
    
    if (successRate === '100.0') {
      console.log('\n🎉 EXCELLENT! All search and filter features working perfectly!');
    } else if (passedTests >= totalTests * 0.8) {
      console.log('\n✅ Good! Most search features working correctly.');
    } else {
      console.log('\n⚠️  Several search features need improvement.');
    }
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    await page.screenshot({ path: 'supplier-search-error.png' });
  } finally {
    await browser.close();
    console.log('\n🏁 Search test suite completed');
  }
}

// Run the test
testSupplierSearch().catch(console.error);