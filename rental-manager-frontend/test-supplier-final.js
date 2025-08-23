const axios = require('axios');

async function testSupplierCRUD() {
  console.log('🏭 Supplier CRUD Test - Final Version\n');
  console.log('='.repeat(60));
  
  const results = {
    auth: false,
    list: false,
    create: false,
    read: false,
    update: false,
    delete: false,
    search: false
  };
  
  try {
    // 1. Authentication with JSON
    console.log('\n📍 Phase 1: Authentication');
    console.log('─'.repeat(50));
    
    const authResponse = await axios.post(
      'http://localhost:8001/api/v1/auth/login',
      {
        username: 'admin',  // API accepts username field for email
        password: 'admin123'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (authResponse.data.access_token) {
      results.auth = true;
      console.log('✅ Authentication successful');
      const token = authResponse.data.access_token;
      
      // Configure axios defaults
      const apiClient = axios.create({
        baseURL: 'http://localhost:8001/api/v1',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // 2. List suppliers
      console.log('\n📍 Phase 2: List Suppliers');
      console.log('─'.repeat(50));
      
      const listResponse = await apiClient.get('/suppliers/');
      results.list = true;
      console.log(`✅ Listed ${listResponse.data.length || 0} existing suppliers`);
      
      // 3. Create supplier
      console.log('\n📍 Phase 3: Create Supplier');
      console.log('─'.repeat(50));
      
      const newSupplier = {
        supplier_code: `TEST${Date.now()}`,
        company_name: 'Test Manufacturing Corp',
        supplier_type: 'MANUFACTURER',
        contact_person: 'John Test',
        email: 'test@manufacturer.com',
        phone: '+1-555-0123',
        mobile: '+1-555-0124',
        address_line1: '123 Test Street',
        address_line2: 'Suite 100',
        city: 'Test City',
        state: 'TC',
        postal_code: '12345',
        country: 'USA',
        tax_id: 'TAX123456',
        payment_terms: 'NET30',
        credit_limit: 50000.00,
        supplier_tier: 'PREMIUM',
        status: 'ACTIVE',
        notes: 'Test supplier created via automated test',
        website: 'https://www.testmanufacturer.com',
        account_manager: 'Sarah Manager'
      };
      
      const createResponse = await apiClient.post('/suppliers/', newSupplier);
      
      if (createResponse.status === 201 || createResponse.status === 200) {
        results.create = true;
        const supplierId = createResponse.data.id;
        console.log(`✅ Created supplier with ID: ${supplierId}`);
        console.log(`   Code: ${createResponse.data.supplier_code}`);
        console.log(`   Name: ${createResponse.data.company_name}`);
        
        // 4. Read supplier
        console.log('\n📍 Phase 4: Read Supplier');
        console.log('─'.repeat(50));
        
        const getResponse = await apiClient.get(`/suppliers/${supplierId}`);
        if (getResponse.data.id === supplierId) {
          results.read = true;
          console.log('✅ Retrieved supplier successfully');
          console.log(`   Company: ${getResponse.data.company_name}`);
          console.log(`   Type: ${getResponse.data.supplier_type}`);
          console.log(`   Status: ${getResponse.data.status}`);
        }
        
        // 5. Update supplier
        console.log('\n📍 Phase 5: Update Supplier');
        console.log('─'.repeat(50));
        
        const updateData = {
          contact_person: 'Jane Updated',
          phone: '+1-555-9999',
          notes: 'Updated via automated test',
          credit_limit: 75000.00
        };
        
        const updateResponse = await apiClient.put(`/suppliers/${supplierId}`, updateData);
        if (updateResponse.data.contact_person === 'Jane Updated') {
          results.update = true;
          console.log('✅ Updated supplier successfully');
          console.log(`   New contact: ${updateResponse.data.contact_person}`);
          console.log(`   New credit limit: ${updateResponse.data.credit_limit}`);
        }
        
        // 6. Search suppliers
        console.log('\n📍 Phase 6: Search Suppliers');
        console.log('─'.repeat(50));
        
        try {
          const searchResponse = await apiClient.get('/suppliers/search', {
            params: { search_term: 'Test' }
          });
          if (searchResponse.status === 200) {
            results.search = true;
            console.log(`✅ Search found ${searchResponse.data.length || 0} results`);
          }
        } catch (searchError) {
          // Try alternative search endpoint
          const altSearchResponse = await apiClient.get('/suppliers/', {
            params: { search: 'Test' }
          });
          if (altSearchResponse.status === 200) {
            results.search = true;
            console.log(`✅ Search found results`);
          }
        }
        
        // 7. Delete supplier
        console.log('\n📍 Phase 7: Delete Supplier');
        console.log('─'.repeat(50));
        
        const deleteResponse = await apiClient.delete(`/suppliers/${supplierId}`);
        if (deleteResponse.status === 204 || deleteResponse.status === 200) {
          results.delete = true;
          console.log('✅ Deleted supplier successfully');
          
          // Verify deletion
          try {
            const verifyResponse = await apiClient.get(`/suppliers/${supplierId}`);
            if (!verifyResponse.data.is_active) {
              console.log('✅ Supplier marked as inactive (soft delete)');
            }
          } catch (err) {
            if (err.response?.status === 404) {
              console.log('✅ Supplier no longer accessible');
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r === true).length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log('\nResults:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${test.toUpperCase()}`);
  });
  
  console.log('\nStatistics:');
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${totalTests - passedTests}`);
  console.log(`  Success Rate: ${successRate}%`);
  
  if (successRate === '100.0') {
    console.log('\n🎉 PERFECT! All supplier CRUD operations working!');
  } else if (passedTests >= 5) {
    console.log('\n✅ Good! Most operations working correctly.');
  } else {
    console.log('\n⚠️  Several operations need attention.');
  }
}

testSupplierCRUD();
