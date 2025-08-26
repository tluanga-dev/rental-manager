// Quick API test
const API_URL = 'http://localhost:8000/api';

async function testAPI() {
  try {
    // Login
    console.log('Testing login...');
    const loginResponse = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login successful:', loginData.user.username);
    const token = loginData.access_token;
    
    // Test customers endpoint
    console.log('\nTesting customers endpoint...');
    const customersResponse = await fetch(`${API_URL}/v1/customers`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Customers response status:', customersResponse.status);
    const customersData = await customersResponse.json();
    console.log('Customers count:', Array.isArray(customersData) ? customersData.length : 'Not an array');
    
    // Try to create a customer
    console.log('\nTrying to create customer...');
    const createResponse = await fetch(`${API_URL}/v1/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'Customer',
        email: 'test@example.com',
        phone: '1234567890',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        country: 'Test Country',
        postal_code: '12345'
      })
    });
    
    console.log('Create customer status:', createResponse.status);
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log('Error response:', errorText);
    } else {
      const customerData = await createResponse.json();
      console.log('Created customer:', customerData);
    }
    
    // Test items endpoint
    console.log('\nTesting items endpoint...');
    const itemsResponse = await fetch(`${API_URL}/v1/items`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Items response status:', itemsResponse.status);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAPI();