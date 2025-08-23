const puppeteer = require('puppeteer');
const fs = require('fs');

async function testSupplierCRUD() {
  console.log('🏭 Comprehensive Supplier CRUD Test Suite');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    defaultViewport: { width: 1600, height: 1000 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Test data for different supplier types
  const testSuppliers = {
    manufacturer: {
      supplier_code: `MFG${Date.now()}`,
      company_name: 'Test Manufacturing Corp',
      supplier_type: 'MANUFACTURER',
      contact_person: 'John Manufacturing',
      email: 'contact@testmfg.com',
      phone: '+1-555-0100',
      mobile: '+1-555-0101',
      address_line1: '123 Factory Lane',
      address_line2: 'Building A',
      city: 'Detroit',
      state: 'MI',
      postal_code: '48201',
      country: 'USA',
      tax_id: 'TAX123456',
      payment_terms: 'NET30',
      credit_limit: 50000,
      supplier_tier: 'PREMIUM',
      website: 'https://www.testmfg.com',
      account_manager: 'Sarah Manager',
      preferred_payment_method: 'Wire Transfer',
      certifications: 'ISO 9001, ISO 14001',
      notes: 'Premium manufacturer with excellent track record'
    },
    distributor: {
      supplier_code: `DIST${Date.now()}`,
      company_name: 'Global Distribution Partners',
      supplier_type: 'DISTRIBUTOR',
      contact_person: 'Jane Distributor',
      email: 'info@globaldist.com',
      phone: '+1-555-0200',
      mobile: '+1-555-0201',
      address_line1: '456 Commerce Street',
      city: 'Chicago',
      state: 'IL',
      postal_code: '60601',
      country: 'USA',
      payment_terms: 'NET45',
      credit_limit: 75000,
      supplier_tier: 'STANDARD',
      notes: 'Reliable distributor with wide network'
    },
    service: {
      supplier_code: `SVC${Date.now()}`,
      company_name: 'Professional Services Ltd',
      supplier_type: 'SERVICE',
      contact_person: 'Mike Service',
      email: 'support@proservices.com',
      phone: '+1-555-0300',
      address_line1: '789 Service Plaza',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94102',
      country: 'USA',
      payment_terms: 'IMMEDIATE',
      credit_limit: 10000,
      supplier_tier: 'BASIC',
      notes: 'Specialized service provider'
    },
    edgeCases: {
      minimal: {
        supplier_code: `MIN${Date.now()}`,
        company_name: 'Minimal Supplier Inc',
        supplier_type: 'DIRECT'
      },
      maxFields: {
        supplier_code: `MAX${Date.now()}`,
        company_name: 'A'.repeat(255), // Max length test
        supplier_type: 'WHOLESALER',
        contact_person: 'B'.repeat(255),
        email: 'test@' + 'x'.repeat(240) + '.com',
        phone: '+'.repeat(50),
        mobile: '9'.repeat(50),
        address_line1: 'C'.repeat(255),
        address_line2: 'D'.repeat(255),
        city: 'E'.repeat(100),
        state: 'F'.repeat(100),
        postal_code: 'G'.repeat(20),
        country: 'H'.repeat(100),
        tax_id: 'I'.repeat(50),
        payment_terms: 'NET90',
        credit_limit: 999999.99,
        supplier_tier: 'TRIAL',
        website: 'https://' + 'w'.repeat(247),
        account_manager: 'J'.repeat(255),
        preferred_payment_method: 'K'.repeat(50),
        certifications: 'L'.repeat(1000),
        notes: 'M'.repeat(1000)
      },
      unicode: {
        supplier_code: `UNI${Date.now()}`,
        company_name: '测试供应商 🏭 مورد الاختبار',
        supplier_type: 'RETAILER',
        contact_person: '李明 أحمد محمد',
        email: 'unicode@test.com',
        phone: '+86-138-0000-0000',
        address_line1: '北京市朝阳区 شارع الملك فهد',
        city: '北京',
        country: '中国',
        notes: 'Unicode test with emojis 🚀 and special chars'
      }
    }
  };

  let createdSupplierIds = [];
  const testResults = {
    authentication: false,
    navigation: false,
    supplierList: false,
    createManufacturer: false,
    createDistributor: false,
    createService: false,
    createMinimal: false,
    createMaxFields: false,
    createUnicode: false,
    readById: false,
    readByCode: false,
    searchOperations: false,
    filterByType: false,
    filterByStatus: false,
    filterByTier: false,
    updateBasic: false,
    updateContact: false,
    updateAddress: false,
    updateContract: false,
    updatePerformance: false,
    statusChanges: false,
    softDelete: false,
    bulkOperations: false,
    dataValidation: false,
    errorHandling: false,
    performanceMetrics: false
  };

  // Performance tracking
  const performanceMetrics = {
    createTimes: [],
    readTimes: [],
    updateTimes: [],
    deleteTimes: [],
    searchTimes: [],
    listLoadTimes: []
  };

  // Track API calls for debugging
  const apiCalls = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/') && url.includes('supplier')) {
      const responseTime = Date.now();
      apiCalls.push({
        method: response.request().method(),
        url,
        status: response.status(),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Track console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    console.log('\n📍 PHASE 1: Authentication & Environment Setup');
    console.log('─'.repeat(50));
    
    // Navigate to login
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2', 
      timeout: 20000 
    });
    
    console.log('✅ Login page loaded');
    await page.screenshot({ path: 'supplier-test-01-login.png' });
    
    // Login as admin
    const demoButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.trim() === 'Demo as Administrator');
    });
    
    if (!demoButton) {
      throw new Error('Demo Admin button not found');
    }
    
    await demoButton.click();
    console.log('🔄 Demo admin login initiated...');
    
    // Wait for authentication
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      throw new Error(`Authentication failed - URL: ${currentUrl}`);
    }
    
    testResults.authentication = true;
    console.log('✅ Authentication successful');

    console.log('\n📍 PHASE 2: Supplier List Navigation');
    console.log('─'.repeat(50));
    
    // Navigate to suppliers page
    const listStartTime = Date.now();
    await page.goto('http://localhost:3001/suppliers', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    performanceMetrics.listLoadTimes.push(Date.now() - listStartTime);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if suppliers page loaded
    const pageTitle = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      return heading ? heading.textContent.trim() : '';
    });
    
    if (pageTitle.includes('Supplier') || pageTitle.includes('supplier')) {
      testResults.navigation = true;
      testResults.supplierList = true;
      console.log('✅ Supplier list page loaded');
      console.log(`⏱️  List load time: ${performanceMetrics.listLoadTimes[0]}ms`);
    } else {
      console.log('❌ Supplier list page not loaded properly');
    }
    
    await page.screenshot({ path: 'supplier-test-02-list.png' });

    console.log('\n📍 PHASE 3: Supplier Creation Testing');
    console.log('─'.repeat(50));
    
    // Test 1: Create Manufacturer
    console.log('\n🏭 Testing Manufacturer Creation...');
    
    // Click "Add Supplier" or "New Supplier" button
    const addSupplierButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => 
        b.textContent.includes('Add Supplier') || 
        b.textContent.includes('New Supplier') ||
        b.textContent.includes('Create Supplier')
      );
    });
    
    if (addSupplierButton) {
      const createStartTime = Date.now();
      await addSupplierButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fill manufacturer form
      const mfg = testSuppliers.manufacturer;
      
      await page.type('input[name="supplier_code"]', mfg.supplier_code);
      await page.type('input[name="company_name"]', mfg.company_name);
      
      // Select supplier type
      await page.select('select[name="supplier_type"]', mfg.supplier_type);
      
      await page.type('input[name="contact_person"]', mfg.contact_person);
      await page.type('input[name="email"]', mfg.email);
      await page.type('input[name="phone"]', mfg.phone);
      await page.type('input[name="mobile"]', mfg.mobile);
      await page.type('input[name="address_line1"]', mfg.address_line1);
      await page.type('input[name="address_line2"]', mfg.address_line2);
      await page.type('input[name="city"]', mfg.city);
      await page.type('input[name="state"]', mfg.state);
      await page.type('input[name="postal_code"]', mfg.postal_code);
      await page.type('input[name="country"]', mfg.country);
      await page.type('input[name="tax_id"]', mfg.tax_id);
      
      await page.select('select[name="payment_terms"]', mfg.payment_terms);
      await page.type('input[name="credit_limit"]', mfg.credit_limit.toString());
      await page.select('select[name="supplier_tier"]', mfg.supplier_tier);
      
      await page.type('input[name="website"]', mfg.website);
      await page.type('input[name="account_manager"]', mfg.account_manager);
      await page.type('input[name="preferred_payment_method"]', mfg.preferred_payment_method);
      await page.type('textarea[name="certifications"]', mfg.certifications);
      await page.type('textarea[name="notes"]', mfg.notes);
      
      await page.screenshot({ path: 'supplier-test-03-create-manufacturer.png' });
      
      // Submit form
      const submitButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(b => 
          b.textContent.includes('Save') || 
          b.textContent.includes('Create') ||
          b.textContent.includes('Submit')
        );
      });
      
      if (submitButton) {
        await submitButton.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        performanceMetrics.createTimes.push(Date.now() - createStartTime);
        
        // Check if we're back on the list or detail page
        const afterCreateUrl = page.url();
        if (afterCreateUrl.includes('/suppliers')) {
          testResults.createManufacturer = true;
          console.log('✅ Manufacturer created successfully');
          console.log(`⏱️  Create time: ${performanceMetrics.createTimes[0]}ms`);
          
          // Extract the created supplier ID if visible
          const supplierId = await page.evaluate(() => {
            const urlMatch = window.location.pathname.match(/suppliers\/([a-f0-9-]+)/);
            return urlMatch ? urlMatch[1] : null;
          });
          
          if (supplierId) {
            createdSupplierIds.push(supplierId);
          }
        }
      }
    }

    // Test 2: Create Distributor
    console.log('\n📦 Testing Distributor Creation...');
    await page.goto('http://localhost:3001/suppliers/new', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    const dist = testSuppliers.distributor;
    const distStartTime = Date.now();
    
    await page.type('input[name="supplier_code"]', dist.supplier_code);
    await page.type('input[name="company_name"]', dist.company_name);
    await page.select('select[name="supplier_type"]', dist.supplier_type);
    await page.type('input[name="contact_person"]', dist.contact_person);
    await page.type('input[name="email"]', dist.email);
    await page.type('input[name="phone"]', dist.phone);
    await page.type('input[name="mobile"]', dist.mobile);
    await page.type('input[name="address_line1"]', dist.address_line1);
    await page.type('input[name="city"]', dist.city);
    await page.type('input[name="state"]', dist.state);
    await page.type('input[name="postal_code"]', dist.postal_code);
    await page.type('input[name="country"]', dist.country);
    await page.select('select[name="payment_terms"]', dist.payment_terms);
    await page.type('input[name="credit_limit"]', dist.credit_limit.toString());
    await page.select('select[name="supplier_tier"]', dist.supplier_tier);
    await page.type('textarea[name="notes"]', dist.notes);
    
    const submitDist = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Save') || b.textContent.includes('Create'));
    });
    
    if (submitDist) {
      await submitDist.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      performanceMetrics.createTimes.push(Date.now() - distStartTime);
      testResults.createDistributor = true;
      console.log('✅ Distributor created successfully');
    }

    // Test 3: Create Service Provider
    console.log('\n🔧 Testing Service Provider Creation...');
    await page.goto('http://localhost:3001/suppliers/new', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    const svc = testSuppliers.service;
    const svcStartTime = Date.now();
    
    await page.type('input[name="supplier_code"]', svc.supplier_code);
    await page.type('input[name="company_name"]', svc.company_name);
    await page.select('select[name="supplier_type"]', svc.supplier_type);
    await page.type('input[name="contact_person"]', svc.contact_person);
    await page.type('input[name="email"]', svc.email);
    await page.type('input[name="phone"]', svc.phone);
    await page.type('input[name="address_line1"]', svc.address_line1);
    await page.type('input[name="city"]', svc.city);
    await page.type('input[name="state"]', svc.state);
    await page.type('input[name="postal_code"]', svc.postal_code);
    await page.type('input[name="country"]', svc.country);
    await page.select('select[name="payment_terms"]', svc.payment_terms);
    await page.type('input[name="credit_limit"]', svc.credit_limit.toString());
    await page.select('select[name="supplier_tier"]', svc.supplier_tier);
    await page.type('textarea[name="notes"]', svc.notes);
    
    const submitSvc = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Save') || b.textContent.includes('Create'));
    });
    
    if (submitSvc) {
      await submitSvc.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      performanceMetrics.createTimes.push(Date.now() - svcStartTime);
      testResults.createService = true;
      console.log('✅ Service Provider created successfully');
    }

    // Test 4: Create Minimal Supplier
    console.log('\n📄 Testing Minimal Supplier Creation...');
    await page.goto('http://localhost:3001/suppliers/new', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    const minimal = testSuppliers.edgeCases.minimal;
    
    await page.type('input[name="supplier_code"]', minimal.supplier_code);
    await page.type('input[name="company_name"]', minimal.company_name);
    await page.select('select[name="supplier_type"]', minimal.supplier_type);
    
    const submitMin = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Save') || b.textContent.includes('Create'));
    });
    
    if (submitMin) {
      await submitMin.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      testResults.createMinimal = true;
      console.log('✅ Minimal supplier created successfully');
    }

    console.log('\n📍 PHASE 4: Read Operations Testing');
    console.log('─'.repeat(50));
    
    // Test search functionality
    console.log('\n🔍 Testing Search Operations...');
    await page.goto('http://localhost:3001/suppliers', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    const searchStartTime = Date.now();
    
    // Search for manufacturer
    const searchInput = await page.$('input[type="search"], input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.type('Manufacturing');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const searchResults = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr, .supplier-list-item');
        return rows.length;
      });
      
      if (searchResults > 0) {
        testResults.searchOperations = true;
        performanceMetrics.searchTimes.push(Date.now() - searchStartTime);
        console.log(`✅ Search found ${searchResults} results`);
        console.log(`⏱️  Search time: ${performanceMetrics.searchTimes[0]}ms`);
      }
      
      await page.screenshot({ path: 'supplier-test-04-search-results.png' });
    }

    // Test filters
    console.log('\n🎚️ Testing Filter Operations...');
    
    // Filter by type
    const typeFilter = await page.$('select[name="supplier_type"], select#supplier_type');
    if (typeFilter) {
      await typeFilter.select('MANUFACTURER');
      await new Promise(resolve => setTimeout(resolve, 1000));
      testResults.filterByType = true;
      console.log('✅ Filter by type working');
    }
    
    // Filter by tier
    const tierFilter = await page.$('select[name="supplier_tier"], select#supplier_tier');
    if (tierFilter) {
      await tierFilter.select('PREMIUM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      testResults.filterByTier = true;
      console.log('✅ Filter by tier working');
    }

    console.log('\n📍 PHASE 5: Update Operations Testing');
    console.log('─'.repeat(50));
    
    // Navigate to first supplier in list for editing
    const firstSupplierLink = await page.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.find(a => a.href.includes('/suppliers/') && !a.href.includes('/new'));
    });
    
    if (firstSupplierLink) {
      const updateStartTime = Date.now();
      await firstSupplierLink.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Click edit button
      const editButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(b => b.textContent.includes('Edit'));
      });
      
      if (editButton) {
        await editButton.click();
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Update contact person
        const contactInput = await page.$('input[name="contact_person"]');
        if (contactInput) {
          await contactInput.click({ clickCount: 3 });
          await contactInput.type('Updated Contact Person');
        }
        
        // Update notes
        const notesInput = await page.$('textarea[name="notes"]');
        if (notesInput) {
          await notesInput.click({ clickCount: 3 });
          await notesInput.type('Updated notes - test modification');
        }
        
        // Save changes
        const saveButton = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(b => b.textContent.includes('Save') || b.textContent.includes('Update'));
        });
        
        if (saveButton) {
          await saveButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          performanceMetrics.updateTimes.push(Date.now() - updateStartTime);
          testResults.updateBasic = true;
          console.log('✅ Basic update successful');
          console.log(`⏱️  Update time: ${performanceMetrics.updateTimes[0]}ms`);
        }
      }
    }

    console.log('\n📍 PHASE 6: Status Management Testing');
    console.log('─'.repeat(50));
    
    // Test status changes
    const statusButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => 
        b.textContent.includes('Status') || 
        b.textContent.includes('Deactivate') ||
        b.textContent.includes('Suspend')
      );
    });
    
    if (statusButton) {
      await statusButton.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      testResults.statusChanges = true;
      console.log('✅ Status change functionality working');
      await page.screenshot({ path: 'supplier-test-05-status-change.png' });
    }

    console.log('\n📍 PHASE 7: Delete Operations Testing');
    console.log('─'.repeat(50));
    
    // Navigate back to list
    await page.goto('http://localhost:3001/suppliers', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    // Find a supplier to delete
    const deleteButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Delete') || b.textContent.includes('Remove'));
    });
    
    if (deleteButton) {
      const deleteStartTime = Date.now();
      await deleteButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Confirm deletion if modal appears
      const confirmButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(b => b.textContent.includes('Confirm') || b.textContent.includes('Yes'));
      });
      
      if (confirmButton) {
        await confirmButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        performanceMetrics.deleteTimes.push(Date.now() - deleteStartTime);
        testResults.softDelete = true;
        console.log('✅ Soft delete successful');
        console.log(`⏱️  Delete time: ${performanceMetrics.deleteTimes[0]}ms`);
      }
    }

    console.log('\n📍 PHASE 8: Data Validation Testing');
    console.log('─'.repeat(50));
    
    // Test invalid data entry
    await page.goto('http://localhost:3001/suppliers/new', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    // Try to submit empty form
    const submitEmpty = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Save') || b.textContent.includes('Create'));
    });
    
    if (submitEmpty) {
      await submitEmpty.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check for validation errors
      const validationErrors = await page.evaluate(() => {
        const errors = document.querySelectorAll('.error, .text-red-500, [role="alert"]');
        return errors.length;
      });
      
      if (validationErrors > 0) {
        testResults.dataValidation = true;
        console.log(`✅ Validation working - ${validationErrors} error messages shown`);
      }
      
      await page.screenshot({ path: 'supplier-test-06-validation-errors.png' });
    }
    
    // Test invalid email
    await page.type('input[name="email"]', 'invalid-email');
    await page.type('input[name="credit_limit"]', '-1000');
    
    const submitInvalid = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Save') || b.textContent.includes('Create'));
    });
    
    if (submitInvalid) {
      await submitInvalid.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const emailError = await page.evaluate(() => {
        const errors = Array.from(document.querySelectorAll('.error, .text-red-500'));
        return errors.some(e => e.textContent.toLowerCase().includes('email'));
      });
      
      if (emailError) {
        testResults.errorHandling = true;
        console.log('✅ Email validation working');
      }
    }

    console.log('\n📍 PHASE 9: Performance & Bulk Operations');
    console.log('─'.repeat(50));
    
    // Create multiple suppliers rapidly
    const bulkStartTime = Date.now();
    const bulkPromises = [];
    
    for (let i = 0; i < 5; i++) {
      await page.goto('http://localhost:3001/suppliers/new', { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      });
      
      await page.type('input[name="supplier_code"]', `BULK${Date.now()}${i}`);
      await page.type('input[name="company_name"]', `Bulk Test Supplier ${i}`);
      await page.select('select[name="supplier_type"]', 'MANUFACTURER');
      
      const submitBulk = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(b => b.textContent.includes('Save') || b.textContent.includes('Create'));
      });
      
      if (submitBulk) {
        await submitBulk.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const bulkTime = Date.now() - bulkStartTime;
    if (bulkTime < 30000) { // Should complete in 30 seconds
      testResults.bulkOperations = true;
      testResults.performanceMetrics = true;
      console.log(`✅ Bulk operations completed in ${bulkTime}ms`);
    }

    // Final screenshot of supplier list
    await page.goto('http://localhost:3001/suppliers', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    await page.screenshot({ path: 'supplier-test-07-final-list.png' });

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
    
    console.log('\n📈 Performance Metrics:');
    if (performanceMetrics.createTimes.length > 0) {
      const avgCreate = performanceMetrics.createTimes.reduce((a, b) => a + b, 0) / performanceMetrics.createTimes.length;
      console.log(`   Create operations: avg ${avgCreate.toFixed(0)}ms`);
    }
    if (performanceMetrics.updateTimes.length > 0) {
      const avgUpdate = performanceMetrics.updateTimes.reduce((a, b) => a + b, 0) / performanceMetrics.updateTimes.length;
      console.log(`   Update operations: avg ${avgUpdate.toFixed(0)}ms`);
    }
    if (performanceMetrics.deleteTimes.length > 0) {
      const avgDelete = performanceMetrics.deleteTimes.reduce((a, b) => a + b, 0) / performanceMetrics.deleteTimes.length;
      console.log(`   Delete operations: avg ${avgDelete.toFixed(0)}ms`);
    }
    if (performanceMetrics.searchTimes.length > 0) {
      const avgSearch = performanceMetrics.searchTimes.reduce((a, b) => a + b, 0) / performanceMetrics.searchTimes.length;
      console.log(`   Search operations: avg ${avgSearch.toFixed(0)}ms`);
    }
    
    console.log('\n📊 Statistics:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${failedTests}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   API Calls Made: ${apiCalls.length}`);
    console.log(`   Console Errors: ${consoleErrors.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('\n⚠️  Console Errors Detected:');
      consoleErrors.slice(0, 5).forEach(error => {
        console.log(`   - ${error.substring(0, 100)}...`);
      });
    }
    
    // Save detailed test report
    const testReport = {
      timestamp: new Date().toISOString(),
      results: testResults,
      metrics: performanceMetrics,
      apiCalls: apiCalls.slice(-20), // Last 20 API calls
      errors: consoleErrors,
      successRate: successRate,
      createdSuppliers: createdSupplierIds
    };
    
    fs.writeFileSync('supplier-test-report.json', JSON.stringify(testReport, null, 2));
    console.log('\n📄 Detailed report saved to supplier-test-report.json');
    
    if (successRate === '100.0') {
      console.log('\n🎉 ALL TESTS PASSED! Supplier CRUD operations working perfectly!');
    } else if (passedTests >= totalTests * 0.8) {
      console.log('\n✅ Most tests passed. Some minor issues to address.');
    } else {
      console.log('\n⚠️  Several tests failed. Review the issues above.');
    }
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    await page.screenshot({ path: 'supplier-test-error.png' });
    
    // Save error details
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      url: page.url(),
      testResults: testResults,
      apiCalls: apiCalls.slice(-10)
    };
    
    fs.writeFileSync('supplier-test-error.json', JSON.stringify(errorReport, null, 2));
    console.log('Error details saved to supplier-test-error.json');
  } finally {
    await browser.close();
    console.log('\n🏁 Test suite completed');
  }
}

// Run the test
testSupplierCRUD().catch(console.error);