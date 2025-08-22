#!/usr/bin/env node

// Simple test without external dependencies
const https = require('https');
const http = require('http');

const testCustomerPayload = {
  customer_code: 'TEST-' + Date.now(),
  customer_type: 'INDIVIDUAL',
  first_name: 'Test',
  last_name: 'Customer',
  email: 'test@example.com',
  phone: '+1-555-123-4567',
  mobile: '+1-555-987-6543',
  address_line1: '123 Test Street',
  city: 'Test City',
  state: 'TS',
  postal_code: '12345',
  country: 'USA',
  credit_limit: 1000,
  payment_terms: 'Net 30',
  notes: 'Test customer for API validation'
};

async function testAPI() {
  console.log('🔍 Testing Customer API...');
  
  const postData = JSON.stringify(testCustomerPayload);
  
  const options = {
    hostname: 'localhost',
    port: 8000,
    path: '/api/customers/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 10000
  };

  return new Promise((resolve, reject) => {
    console.log('📤 Sending POST request to http://localhost:8000/api/customers/');
    console.log('📄 Payload:', JSON.stringify(testCustomerPayload, null, 2));
    
    const req = http.request(options, (res) => {
      console.log(`📊 Status Code: ${res.statusCode}`);
      console.log(`📊 Headers:`, res.headers);
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📄 Response Body:', data);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Customer creation successful!');
          try {
            const responseData = JSON.parse(data);
            console.log('📄 Parsed Response:', JSON.stringify(responseData, null, 2));
          } catch (e) {
            console.log('⚠️ Could not parse response as JSON');
          }
        } else {
          console.log('❌ Customer creation failed');
          try {
            const errorData = JSON.parse(data);
            console.log('📄 Error Details:', JSON.stringify(errorData, null, 2));
          } catch (e) {
            console.log('📄 Error Text:', data);
          }
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Request failed:', err.message);
      if (err.code === 'ECONNREFUSED') {
        console.log('💡 Make sure the backend server is running at http://localhost:8000');
      }
      resolve();
    });
    
    req.on('timeout', () => {
      console.log('⏰ Request timed out');
      req.destroy();
      resolve();
    });
    
    req.write(postData);
    req.end();
  });
}

// Test GET endpoint first
async function testGET() {
  console.log('🔍 Testing GET /api/customers/...');
  
  const options = {
    hostname: 'localhost',
    port: 8000,
    path: '/api/customers/',
    method: 'GET',
    timeout: 5000
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      console.log(`📊 GET Status Code: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ GET customers endpoint accessible');
        } else {
          console.log('❌ GET customers endpoint failed');
          console.log('📄 Response:', data.substring(0, 200));
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ GET request failed:', err.message);
      resolve();
    });
    
    req.on('timeout', () => {
      console.log('⏰ GET request timed out');
      req.destroy();
      resolve();
    });
    
    req.end();
  });
}

async function runTests() {
  await testGET();
  await testAPI();
  console.log('🎉 Test completed!');
}

runTests().catch(console.error);