const axios = require('axios');
const fs = require('fs');

/**
 * Comprehensive Supplier API Validation Test Suite
 * Tests all supplier endpoints with various data scenarios
 */

const API_BASE_URL = 'http://localhost:8001/api/v1';
let authToken = null;

// Test data generators
const generateSupplierCode = () => `SUP${Date.now()}${Math.floor(Math.random() * 1000)}`;

const testData = {
  valid: {
    minimal: {
      supplier_code: generateSupplierCode(),
      company_name: 'Minimal Test Supplier',
      supplier_type: 'MANUFACTURER'
    },
    complete: {
      supplier_code: generateSupplierCode(),
      company_name: 'Complete Test Supplier Corp',
      supplier_type: 'DISTRIBUTOR',
      contact_person: 'John Complete',
      email: 'complete@testsupplier.com',
      phone: '+1-555-0100',
      mobile: '+1-555-0101',
      address_line1: '123 Complete Street',
      address_line2: 'Suite 456',
      city: 'Test City',
      state: 'TC',
      postal_code: '12345',
      country: 'USA',
      tax_id: 'TAX123456789',
      payment_terms: 'NET30',
      credit_limit: 100000.00,
      supplier_tier: 'PREMIUM',
      status: 'ACTIVE',
      quality_rating: 4.5,
      delivery_rating: 4.8,
      average_delivery_days: 3,
      total_orders: 150,
      total_spend: 500000.00,
      notes: 'Premium supplier with excellent track record',
      website: 'https://www.testsupplier.com',
      account_manager: 'Sarah Manager',
      preferred_payment_method: 'Wire Transfer',
      certifications: 'ISO 9001, ISO 14001, OHSAS 18001'
    },
    allTypes: [
      { supplier_code: generateSupplierCode(), company_name: 'Manufacturer Test', supplier_type: 'MANUFACTURER' },
      { supplier_code: generateSupplierCode(), company_name: 'Distributor Test', supplier_type: 'DISTRIBUTOR' },
      { supplier_code: generateSupplierCode(), company_name: 'Wholesaler Test', supplier_type: 'WHOLESALER' },
      { supplier_code: generateSupplierCode(), company_name: 'Retailer Test', supplier_type: 'RETAILER' },
      { supplier_code: generateSupplierCode(), company_name: 'Inventory Test', supplier_type: 'INVENTORY' },
      { supplier_code: generateSupplierCode(), company_name: 'Service Test', supplier_type: 'SERVICE' },
      { supplier_code: generateSupplierCode(), company_name: 'Direct Test', supplier_type: 'DIRECT' }
    ],
    allTiers: [
      { supplier_code: generateSupplierCode(), company_name: 'Premium Tier', supplier_type: 'MANUFACTURER', supplier_tier: 'PREMIUM' },
      { supplier_code: generateSupplierCode(), company_name: 'Standard Tier', supplier_type: 'MANUFACTURER', supplier_tier: 'STANDARD' },
      { supplier_code: generateSupplierCode(), company_name: 'Basic Tier', supplier_type: 'MANUFACTURER', supplier_tier: 'BASIC' },
      { supplier_code: generateSupplierCode(), company_name: 'Trial Tier', supplier_type: 'MANUFACTURER', supplier_tier: 'TRIAL' }
    ],
    allPaymentTerms: [
      { supplier_code: generateSupplierCode(), company_name: 'Immediate Pay', supplier_type: 'SERVICE', payment_terms: 'IMMEDIATE' },
      { supplier_code: generateSupplierCode(), company_name: 'Net 15', supplier_type: 'SERVICE', payment_terms: 'NET15' },
      { supplier_code: generateSupplierCode(), company_name: 'Net 30', supplier_type: 'SERVICE', payment_terms: 'NET30' },
      { supplier_code: generateSupplierCode(), company_name: 'Net 45', supplier_type: 'SERVICE', payment_terms: 'NET45' },
      { supplier_code: generateSupplierCode(), company_name: 'Net 60', supplier_type: 'SERVICE', payment_terms: 'NET60' },
      { supplier_code: generateSupplierCode(), company_name: 'Net 90', supplier_type: 'SERVICE', payment_terms: 'NET90' },
      { supplier_code: generateSupplierCode(), company_name: 'COD', supplier_type: 'SERVICE', payment_terms: 'COD' }
    ]
  },
  invalid: {
    missingRequired: {
      // Missing supplier_code
      company_name: 'Missing Code Supplier',
      supplier_type: 'MANUFACTURER'
    },
    invalidType: {
      supplier_code: generateSupplierCode(),
      company_name: 'Invalid Type Supplier',
      supplier_type: 'INVALID_TYPE' // Invalid enum value
    },
    invalidEmail: {
      supplier_code: generateSupplierCode(),
      company_name: 'Invalid Email Supplier',
      supplier_type: 'MANUFACTURER',
      email: 'not-an-email' // Invalid email format
    },
    negativeCreditLimit: {
      supplier_code: generateSupplierCode(),
      company_name: 'Negative Credit Supplier',
      supplier_type: 'MANUFACTURER',
      credit_limit: -1000 // Negative value
    },
    invalidRating: {
      supplier_code: generateSupplierCode(),
      company_name: 'Invalid Rating Supplier',
      supplier_type: 'MANUFACTURER',
      quality_rating: 10, // > 5
      delivery_rating: -1 // < 0
    },
    exceedMaxLength: {
      supplier_code: 'A'.repeat(51), // Max 50 chars
      company_name: 'B'.repeat(256), // Max 255 chars
      supplier_type: 'MANUFACTURER',
      email: 'test@' + 'x'.repeat(251) + '.com', // Max 255 chars
      phone: '+'.repeat(51), // Max 50 chars
      tax_id: 'TAX'.repeat(20) // Max 50 chars
    },
    sqlInjection: {
      supplier_code: "'; DROP TABLE suppliers; --",
      company_name: "'; DELETE FROM suppliers WHERE 1=1; --",
      supplier_type: 'MANUFACTURER',
      notes: "'; UPDATE suppliers SET credit_limit=999999; --"
    },
    xssAttempt: {
      supplier_code: generateSupplierCode(),
      company_name: '<script>alert("XSS")</script>',
      supplier_type: 'MANUFACTURER',
      notes: '<img src=x onerror=alert("XSS")>',
      website: 'javascript:alert("XSS")'
    }
  },
  edgeCases: {
    unicode: {
      supplier_code: generateSupplierCode(),
      company_name: '测试供应商 🏭 مورد الاختبار తెలుగు சோதனை',
      supplier_type: 'MANUFACTURER',
      contact_person: '李明 أحمد محمد राज कुमार',
      notes: 'Unicode test 你好世界 مرحبا بالعالم 🌍🚀💼'
    },
    specialChars: {
      supplier_code: generateSupplierCode(),
      company_name: 'O\'Reilly & Sons, Inc.',
      supplier_type: 'DISTRIBUTOR',
      contact_person: 'Jean-François Müller-König',
      address_line1: '123 "Main" Street & Co.',
      notes: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?/~`'
    },
    boundaries: {
      zeroValues: {
        supplier_code: generateSupplierCode(),
        company_name: 'Zero Values Supplier',
        supplier_type: 'MANUFACTURER',
        credit_limit: 0,
        quality_rating: 0,
        delivery_rating: 0,
        average_delivery_days: 0,
        total_orders: 0,
        total_spend: 0
      },
      maxValues: {
        supplier_code: generateSupplierCode(),
        company_name: 'Max Values Supplier',
        supplier_type: 'MANUFACTURER',
        credit_limit: 999999.99,
        quality_rating: 5.0,
        delivery_rating: 5.0,
        average_delivery_days: 365,
        total_orders: 999999,
        total_spend: 9999999.99
      }
    }
  }
};

async function authenticate() {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@rental.com',
      password: 'admin123'
    });
    
    authToken = response.data.access_token;
    console.log('✅ Authentication successful');
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCreateOperations() {
  console.log('\n📝 Testing CREATE Operations');
  console.log('─'.repeat(50));
  
  const results = {
    minimal: false,
    complete: false,
    allTypes: false,
    allTiers: false,
    allPaymentTerms: false,
    duplicateCode: false,
    invalidData: false,
    validation: false
  };
  
  try {
    // Test 1: Minimal required fields
    console.log('Testing minimal required fields...');
    const minimalResponse = await axios.post(
      `${API_BASE_URL}/suppliers/`,
      testData.valid.minimal,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (minimalResponse.status === 201) {
      results.minimal = true;
      console.log('✅ Minimal supplier created');
    }
    
    // Test 2: Complete all fields
    console.log('Testing complete supplier data...');
    const completeResponse = await axios.post(
      `${API_BASE_URL}/suppliers/`,
      testData.valid.complete,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (completeResponse.status === 201) {
      results.complete = true;
      console.log('✅ Complete supplier created');
    }
    
    // Test 3: All supplier types
    console.log('Testing all supplier types...');
    let allTypesSuccess = true;
    for (const typeData of testData.valid.allTypes) {
      try {
        await axios.post(
          `${API_BASE_URL}/suppliers/`,
          typeData,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
      } catch (error) {
        allTypesSuccess = false;
        console.log(`❌ Failed to create ${typeData.supplier_type}`);
      }
    }
    results.allTypes = allTypesSuccess;
    if (allTypesSuccess) console.log('✅ All supplier types created');
    
    // Test 4: Duplicate supplier code
    console.log('Testing duplicate supplier code rejection...');
    try {
      await axios.post(
        `${API_BASE_URL}/suppliers/`,
        testData.valid.minimal, // Same code as before
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      console.log('❌ Duplicate code was not rejected');
    } catch (error) {
      if (error.response?.status === 409) {
        results.duplicateCode = true;
        console.log('✅ Duplicate code properly rejected');
      }
    }
    
    // Test 5: Invalid data validation
    console.log('Testing invalid data validation...');
    try {
      await axios.post(
        `${API_BASE_URL}/suppliers/`,
        testData.invalid.missingRequired,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      console.log('❌ Invalid data was not rejected');
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 422) {
        results.validation = true;
        console.log('✅ Invalid data properly rejected');
      }
    }
    
  } catch (error) {
    console.error('Create operation error:', error.response?.data || error.message);
  }
  
  return results;
}

async function testReadOperations() {
  console.log('\n📖 Testing READ Operations');
  console.log('─'.repeat(50));
  
  const results = {
    list: false,
    getById: false,
    getByCode: false,
    search: false,
    filterByType: false,
    filterByStatus: false,
    filterByTier: false,
    pagination: false,
    sorting: false,
    statistics: false
  };
  
  try {
    // Create a test supplier first
    const testSupplier = await axios.post(
      `${API_BASE_URL}/suppliers/`,
      {
        supplier_code: generateSupplierCode(),
        company_name: 'Read Test Supplier',
        supplier_type: 'MANUFACTURER'
      },
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    const supplierId = testSupplier.data.id;
    const supplierCode = testSupplier.data.supplier_code;
    
    // Test 1: List all suppliers
    console.log('Testing list all suppliers...');
    const listResponse = await axios.get(
      `${API_BASE_URL}/suppliers/`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (listResponse.status === 200 && Array.isArray(listResponse.data)) {
      results.list = true;
      console.log(`✅ Listed ${listResponse.data.length} suppliers`);
    }
    
    // Test 2: Get by ID
    console.log('Testing get by ID...');
    const getByIdResponse = await axios.get(
      `${API_BASE_URL}/suppliers/${supplierId}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (getByIdResponse.status === 200 && getByIdResponse.data.id === supplierId) {
      results.getById = true;
      console.log('✅ Retrieved supplier by ID');
    }
    
    // Test 3: Search
    console.log('Testing search functionality...');
    const searchResponse = await axios.get(
      `${API_BASE_URL}/suppliers/search`,
      { 
        headers: { 'Authorization': `Bearer ${authToken}` },
        params: { search_term: 'Read Test' }
      }
    );
    
    if (searchResponse.status === 200) {
      results.search = true;
      console.log('✅ Search functionality working');
    }
    
    // Test 4: Filter by type
    console.log('Testing filter by type...');
    const filterTypeResponse = await axios.get(
      `${API_BASE_URL}/suppliers/`,
      { 
        headers: { 'Authorization': `Bearer ${authToken}` },
        params: { supplier_type: 'MANUFACTURER' }
      }
    );
    
    if (filterTypeResponse.status === 200) {
      results.filterByType = true;
      console.log('✅ Filter by type working');
    }
    
    // Test 5: Pagination
    console.log('Testing pagination...');
    const paginationResponse = await axios.get(
      `${API_BASE_URL}/suppliers/`,
      { 
        headers: { 'Authorization': `Bearer ${authToken}` },
        params: { skip: 0, limit: 5 }
      }
    );
    
    if (paginationResponse.status === 200) {
      results.pagination = true;
      console.log('✅ Pagination working');
    }
    
    // Test 6: Statistics
    console.log('Testing statistics endpoint...');
    try {
      const statsResponse = await axios.get(
        `${API_BASE_URL}/suppliers/statistics`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (statsResponse.status === 200) {
        results.statistics = true;
        console.log('✅ Statistics endpoint working');
      }
    } catch (error) {
      console.log('⚠️  Statistics endpoint not available');
    }
    
  } catch (error) {
    console.error('Read operation error:', error.response?.data || error.message);
  }
  
  return results;
}

async function testUpdateOperations() {
  console.log('\n✏️  Testing UPDATE Operations');
  console.log('─'.repeat(50));
  
  const results = {
    fullUpdate: false,
    partialUpdate: false,
    statusUpdate: false,
    contactUpdate: false,
    addressUpdate: false,
    performanceUpdate: false,
    invalidUpdate: false
  };
  
  try {
    // Create a test supplier
    const testSupplier = await axios.post(
      `${API_BASE_URL}/suppliers/`,
      {
        supplier_code: generateSupplierCode(),
        company_name: 'Update Test Supplier',
        supplier_type: 'MANUFACTURER',
        email: 'original@test.com'
      },
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    const supplierId = testSupplier.data.id;
    
    // Test 1: Full update
    console.log('Testing full update...');
    const fullUpdateData = {
      company_name: 'Fully Updated Supplier',
      contact_person: 'New Contact',
      email: 'updated@test.com',
      phone: '+1-555-9999',
      supplier_tier: 'PREMIUM',
      notes: 'Fully updated supplier information'
    };
    
    const fullUpdateResponse = await axios.put(
      `${API_BASE_URL}/suppliers/${supplierId}`,
      fullUpdateData,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (fullUpdateResponse.status === 200) {
      results.fullUpdate = true;
      console.log('✅ Full update successful');
    }
    
    // Test 2: Partial update
    console.log('Testing partial update...');
    const partialUpdateResponse = await axios.put(
      `${API_BASE_URL}/suppliers/${supplierId}`,
      { notes: 'Only notes updated' },
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (partialUpdateResponse.status === 200) {
      results.partialUpdate = true;
      console.log('✅ Partial update successful');
    }
    
    // Test 3: Status update
    console.log('Testing status update...');
    try {
      const statusUpdateResponse = await axios.put(
        `${API_BASE_URL}/suppliers/${supplierId}/status`,
        { status: 'SUSPENDED', notes: 'Test suspension' },
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (statusUpdateResponse.status === 200) {
        results.statusUpdate = true;
        console.log('✅ Status update successful');
      }
    } catch (error) {
      console.log('⚠️  Status update endpoint not available');
    }
    
    // Test 4: Invalid update
    console.log('Testing invalid update rejection...');
    try {
      await axios.put(
        `${API_BASE_URL}/suppliers/${supplierId}`,
        { credit_limit: -5000 }, // Negative credit limit
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      console.log('❌ Invalid update was not rejected');
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 422) {
        results.invalidUpdate = true;
        console.log('✅ Invalid update properly rejected');
      }
    }
    
  } catch (error) {
    console.error('Update operation error:', error.response?.data || error.message);
  }
  
  return results;
}

async function testDeleteOperations() {
  console.log('\n🗑️  Testing DELETE Operations');
  console.log('─'.repeat(50));
  
  const results = {
    softDelete: false,
    verifyDeleted: false,
    deleteNonExistent: false
  };
  
  try {
    // Create a test supplier
    const testSupplier = await axios.post(
      `${API_BASE_URL}/suppliers/`,
      {
        supplier_code: generateSupplierCode(),
        company_name: 'Delete Test Supplier',
        supplier_type: 'MANUFACTURER'
      },
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    const supplierId = testSupplier.data.id;
    
    // Test 1: Soft delete
    console.log('Testing soft delete...');
    const deleteResponse = await axios.delete(
      `${API_BASE_URL}/suppliers/${supplierId}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    if (deleteResponse.status === 204 || deleteResponse.status === 200) {
      results.softDelete = true;
      console.log('✅ Soft delete successful');
    }
    
    // Test 2: Verify supplier is soft deleted
    console.log('Verifying soft delete...');
    try {
      const getDeletedResponse = await axios.get(
        `${API_BASE_URL}/suppliers/${supplierId}`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (getDeletedResponse.data.is_active === false) {
        results.verifyDeleted = true;
        console.log('✅ Supplier correctly marked as inactive');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        results.verifyDeleted = true;
        console.log('✅ Deleted supplier not accessible');
      }
    }
    
    // Test 3: Delete non-existent supplier
    console.log('Testing delete non-existent supplier...');
    try {
      await axios.delete(
        `${API_BASE_URL}/suppliers/00000000-0000-0000-0000-000000000000`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      console.log('❌ Non-existent delete was not rejected');
    } catch (error) {
      if (error.response?.status === 404) {
        results.deleteNonExistent = true;
        console.log('✅ Non-existent delete properly rejected');
      }
    }
    
  } catch (error) {
    console.error('Delete operation error:', error.response?.data || error.message);
  }
  
  return results;
}

async function testEdgeCases() {
  console.log('\n🔬 Testing Edge Cases');
  console.log('─'.repeat(50));
  
  const results = {
    unicode: false,
    specialChars: false,
    zeroValues: false,
    maxValues: false,
    sqlInjection: false,
    xss: false
  };
  
  try {
    // Test 1: Unicode characters
    console.log('Testing unicode characters...');
    try {
      const unicodeResponse = await axios.post(
        `${API_BASE_URL}/suppliers/`,
        testData.edgeCases.unicode,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (unicodeResponse.status === 201) {
        // Verify unicode was preserved
        const getResponse = await axios.get(
          `${API_BASE_URL}/suppliers/${unicodeResponse.data.id}`,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        
        if (getResponse.data.company_name === testData.edgeCases.unicode.company_name) {
          results.unicode = true;
          console.log('✅ Unicode characters handled correctly');
        }
      }
    } catch (error) {
      console.log('❌ Unicode handling failed');
    }
    
    // Test 2: Special characters
    console.log('Testing special characters...');
    try {
      const specialResponse = await axios.post(
        `${API_BASE_URL}/suppliers/`,
        testData.edgeCases.specialChars,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (specialResponse.status === 201) {
        results.specialChars = true;
        console.log('✅ Special characters handled correctly');
      }
    } catch (error) {
      console.log('❌ Special character handling failed');
    }
    
    // Test 3: Zero values
    console.log('Testing zero boundary values...');
    try {
      const zeroResponse = await axios.post(
        `${API_BASE_URL}/suppliers/`,
        testData.edgeCases.boundaries.zeroValues,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (zeroResponse.status === 201) {
        results.zeroValues = true;
        console.log('✅ Zero values handled correctly');
      }
    } catch (error) {
      console.log('❌ Zero value handling failed');
    }
    
    // Test 4: SQL Injection prevention
    console.log('Testing SQL injection prevention...');
    try {
      const sqlResponse = await axios.post(
        `${API_BASE_URL}/suppliers/`,
        testData.invalid.sqlInjection,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      // If it succeeds, verify the data was escaped
      if (sqlResponse.status === 201) {
        const getResponse = await axios.get(
          `${API_BASE_URL}/suppliers/${sqlResponse.data.id}`,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        
        if (getResponse.data.supplier_code === testData.invalid.sqlInjection.supplier_code) {
          results.sqlInjection = true;
          console.log('✅ SQL injection properly escaped');
        }
      }
    } catch (error) {
      results.sqlInjection = true; // Rejected is also good
      console.log('✅ SQL injection attempt rejected');
    }
    
    // Test 5: XSS prevention
    console.log('Testing XSS prevention...');
    try {
      const xssResponse = await axios.post(
        `${API_BASE_URL}/suppliers/`,
        testData.invalid.xssAttempt,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      if (xssResponse.status === 201) {
        const getResponse = await axios.get(
          `${API_BASE_URL}/suppliers/${xssResponse.data.id}`,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        
        // Check if HTML was escaped
        if (!getResponse.data.company_name.includes('<script>')) {
          results.xss = true;
          console.log('✅ XSS properly escaped');
        }
      }
    } catch (error) {
      results.xss = true; // Rejected is also good
      console.log('✅ XSS attempt rejected');
    }
    
  } catch (error) {
    console.error('Edge case error:', error.response?.data || error.message);
  }
  
  return results;
}

async function testPerformance() {
  console.log('\n⚡ Testing Performance');
  console.log('─'.repeat(50));
  
  const results = {
    bulkCreate: false,
    largeList: false,
    complexSearch: false,
    responseTime: false
  };
  
  const metrics = {
    createTimes: [],
    listTime: 0,
    searchTime: 0
  };
  
  try {
    // Test 1: Bulk create
    console.log('Testing bulk creation performance...');
    const bulkStartTime = Date.now();
    const bulkPromises = [];
    
    for (let i = 0; i < 20; i++) {
      bulkPromises.push(
        axios.post(
          `${API_BASE_URL}/suppliers/`,
          {
            supplier_code: generateSupplierCode(),
            company_name: `Bulk Test Supplier ${i}`,
            supplier_type: 'MANUFACTURER'
          },
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        )
      );
    }
    
    await Promise.all(bulkPromises);
    const bulkTime = Date.now() - bulkStartTime;
    
    if (bulkTime < 10000) { // Should complete in 10 seconds
      results.bulkCreate = true;
      console.log(`✅ Bulk creation completed in ${bulkTime}ms`);
    }
    
    // Test 2: Large list retrieval
    console.log('Testing large list retrieval...');
    const listStartTime = Date.now();
    const largeListResponse = await axios.get(
      `${API_BASE_URL}/suppliers/`,
      { 
        headers: { 'Authorization': `Bearer ${authToken}` },
        params: { limit: 100 }
      }
    );
    metrics.listTime = Date.now() - listStartTime;
    
    if (metrics.listTime < 2000) { // Should complete in 2 seconds
      results.largeList = true;
      console.log(`✅ Large list retrieved in ${metrics.listTime}ms`);
    }
    
    // Test 3: Complex search
    console.log('Testing complex search performance...');
    const searchStartTime = Date.now();
    await axios.get(
      `${API_BASE_URL}/suppliers/search`,
      { 
        headers: { 'Authorization': `Bearer ${authToken}` },
        params: { 
          search_term: 'Test',
          supplier_type: 'MANUFACTURER',
          limit: 50
        }
      }
    );
    metrics.searchTime = Date.now() - searchStartTime;
    
    if (metrics.searchTime < 3000) { // Should complete in 3 seconds
      results.complexSearch = true;
      console.log(`✅ Complex search completed in ${metrics.searchTime}ms`);
    }
    
    // Overall response time check
    const avgResponseTime = (bulkTime/20 + metrics.listTime + metrics.searchTime) / 3;
    if (avgResponseTime < 2000) {
      results.responseTime = true;
      console.log(`✅ Average response time: ${avgResponseTime.toFixed(0)}ms`);
    }
    
  } catch (error) {
    console.error('Performance test error:', error.response?.data || error.message);
  }
  
  return { results, metrics };
}

async function runAllTests() {
  console.log('🏭 Supplier API Validation Test Suite');
  console.log('='.repeat(60));
  
  // Authenticate first
  const authSuccess = await authenticate();
  if (!authSuccess) {
    console.error('Cannot proceed without authentication');
    return;
  }
  
  const testResults = {
    create: await testCreateOperations(),
    read: await testReadOperations(),
    update: await testUpdateOperations(),
    delete: await testDeleteOperations(),
    edgeCases: await testEdgeCases(),
    performance: await testPerformance()
  };
  
  // Generate summary report
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const [category, results] of Object.entries(testResults)) {
    if (category === 'performance') {
      const perfResults = results.results;
      console.log(`\n${category.toUpperCase()}:`);
      for (const [test, passed] of Object.entries(perfResults)) {
        totalTests++;
        if (passed) passedTests++;
        console.log(`  ${passed ? '✅' : '❌'} ${test}`);
      }
    } else {
      console.log(`\n${category.toUpperCase()}:`);
      for (const [test, passed] of Object.entries(results)) {
        totalTests++;
        if (passed) passedTests++;
        console.log(`  ${passed ? '✅' : '❌'} ${test}`);
      }
    }
  }
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log('\n' + '─'.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${successRate}%`);
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    results: testResults,
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: totalTests - passedTests,
      successRate: successRate
    }
  };
  
  fs.writeFileSync('supplier-api-test-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Detailed report saved to supplier-api-test-report.json');
  
  if (successRate === '100.0') {
    console.log('\n🎉 PERFECT SCORE! All API tests passed!');
  } else if (passedTests >= totalTests * 0.9) {
    console.log('\n✅ Excellent! Most tests passed.');
  } else if (passedTests >= totalTests * 0.7) {
    console.log('\n⚠️  Good progress, but some issues need attention.');
  } else {
    console.log('\n❌ Multiple failures detected. Review the API implementation.');
  }
}

// Run all tests
runAllTests().catch(console.error);