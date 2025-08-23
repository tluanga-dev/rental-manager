const axios = require('axios');

async function testSupplierWithAuth() {
  console.log('🏭 Testing Supplier API with Authentication\n');
  
  try {
    // First, get the correct auth format
    console.log('1. Testing authentication...');
    
    // Try form-encoded auth (OAuth2 style)
    const formData = new URLSearchParams();
    formData.append('username', 'admin@rental.com');
    formData.append('password', 'admin123');
    
    try {
      const authResponse = await axios.post(
        'http://localhost:8001/api/v1/auth/login',
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      if (authResponse.data.access_token) {
        console.log('   ✅ Authentication successful!');
        const token = authResponse.data.access_token;
        
        // Now test supplier endpoints
        console.log('\n2. Testing supplier endpoints with token...');
        
        // Get suppliers
        const suppliersResponse = await axios.get(
          'http://localhost:8001/api/v1/suppliers/',
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        console.log(`   ✅ GET /suppliers - Status: ${suppliersResponse.status}`);
        console.log(`   Found ${suppliersResponse.data.length || 0} suppliers`);
        
        // Create a test supplier
        console.log('\n3. Creating test supplier...');
        const testSupplier = {
          supplier_code: `TEST${Date.now()}`,
          company_name: 'Test Supplier Company',
          supplier_type: 'MANUFACTURER',
          contact_person: 'Test Contact',
          email: 'test@supplier.com',
          phone: '+1-555-0000',
          payment_terms: 'NET30',
          credit_limit: 10000,
          supplier_tier: 'STANDARD',
          status: 'ACTIVE'
        };
        
        const createResponse = await axios.post(
          'http://localhost:8001/api/v1/suppliers/',
          testSupplier,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (createResponse.status === 201 || createResponse.status === 200) {
          console.log('   ✅ Supplier created successfully!');
          console.log(`   ID: ${createResponse.data.id}`);
          console.log(`   Code: ${createResponse.data.supplier_code}`);
          
          // Get the created supplier
          const getResponse = await axios.get(
            `http://localhost:8001/api/v1/suppliers/${createResponse.data.id}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          console.log(`   ✅ Retrieved supplier: ${getResponse.data.company_name}`);
          
          // Update the supplier
          console.log('\n4. Updating supplier...');
          const updateResponse = await axios.put(
            `http://localhost:8001/api/v1/suppliers/${createResponse.data.id}`,
            {
              contact_person: 'Updated Contact Name',
              notes: 'Updated via test script'
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log('   ✅ Supplier updated successfully!');
          
          // Delete the supplier
          console.log('\n5. Deleting supplier...');
          const deleteResponse = await axios.delete(
            `http://localhost:8001/api/v1/suppliers/${createResponse.data.id}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          console.log('   ✅ Supplier deleted successfully!');
          
          console.log('\n🎉 All CRUD operations successful!');
        }
        
      }
    } catch (authError) {
      console.log('   Auth failed:', authError.response?.status, authError.response?.data);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    }
  }
}

testSupplierWithAuth();
