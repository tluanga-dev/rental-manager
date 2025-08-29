const axios = require('axios');

async function testAPI() {
  console.log('🔍 Testing API endpoints...\n');
  
  // Test with the environment variable value
  const baseURL = 'http://localhost:8000/api/v1';
  const headers = {
    'Authorization': 'Bearer dev-access-token',
    'Content-Type': 'application/json'
  };
  
  try {
    // Test the categories endpoint
    console.log('📡 Testing categories endpoint:');
    console.log(`   URL: ${baseURL}/categories/`);
    
    const response = await axios.get(`${baseURL}/categories/`, { 
      headers,
      params: {
        include_inactive: false,
        page_size: 100,
        sort_field: 'name',
        sort_direction: 'asc'
      }
    });
    
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   ✅ Found ${response.data.items.length} categories`);
    
    if (response.data.items.length > 0) {
      console.log('\n📋 Categories:');
      response.data.items.forEach(cat => {
        console.log(`     - ${cat.name} (${cat.category_path})`);
      });
    }
    
    // Test what the frontend is actually calling
    console.log('\n📡 Testing what frontend calls (base + endpoint):');
    const frontendBase = 'http://localhost:8000/api/v1';
    const frontendEndpoint = '/categories/';
    const fullURL = frontendBase + frontendEndpoint;
    console.log(`   Full URL: ${fullURL}`);
    
    const response2 = await axios.get(fullURL, { 
      headers,
      params: {
        include_inactive: false,
        page_size: 100,
        sort_field: 'name',
        sort_direction: 'asc'
      }
    });
    
    console.log(`   ✅ Status: ${response2.status}`);
    console.log(`   ✅ Response works!`);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testAPI();