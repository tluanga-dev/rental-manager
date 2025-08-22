#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Customer Creation Fixes...\n');

// Test 1: Check CustomerCreate interface
console.log('📋 Test 1: Validating CustomerCreate interface...');
try {
  const customersApiPath = path.join(__dirname, 'src/services/api/customers.ts');
  const customersApiContent = fs.readFileSync(customersApiPath, 'utf8');
  
  const requiredFields = [
    'customer_code: string',
    'customer_type: \'INDIVIDUAL\' | \'BUSINESS\'',
    'business_name?: string',
    'first_name?: string',
    'last_name?: string',
    'email?: string',
    'phone?: string',
    'mobile?: string',
    'address_line1?: string',
    'address_line2?: string',
    'city?: string',
    'state?: string',
    'postal_code?: string',
    'country?: string',
    'tax_number?: string',
    'credit_limit?: number',
    'payment_terms?: string',
    'notes?: string'
  ];
  
  let interfaceValid = true;
  requiredFields.forEach(field => {
    if (!customersApiContent.includes(field)) {
      console.log(`❌ Missing field: ${field}`);
      interfaceValid = false;
    }
  });
  
  if (interfaceValid) {
    console.log('✅ CustomerCreate interface contains all required fields');
  }
  
  // Check for old field names that should be removed
  const deprecatedFields = ['tax_id', 'customer_tier'];
  deprecatedFields.forEach(field => {
    if (customersApiContent.includes(`${field}:`)) {
      console.log(`⚠️ Deprecated field still present: ${field}`);
      interfaceValid = false;
    }
  });
  
  if (interfaceValid) {
    console.log('✅ No deprecated fields found');
  }
  
} catch (error) {
  console.log('❌ Error reading customers API file:', error.message);
}

// Test 2: Check API endpoints
console.log('\n📋 Test 2: Validating API endpoints...');
try {
  const customersApiPath = path.join(__dirname, 'src/services/api/customers.ts');
  const customersApiContent = fs.readFileSync(customersApiPath, 'utf8');
  
  const correctEndpoints = [
    "apiClient.post('/customers/', data)",
    "apiClient.get('/customers/', { params })",
    "apiClient.get(`/customers/${id}`)"
  ];
  
  let endpointsValid = true;
  correctEndpoints.forEach(endpoint => {
    if (!customersApiContent.includes(endpoint)) {
      console.log(`❌ Missing correct endpoint: ${endpoint}`);
      endpointsValid = false;
    }
  });
  
  if (endpointsValid) {
    console.log('✅ API endpoints are correctly formatted');
  }
  
  // Check for old double endpoints
  if (customersApiContent.includes('/customers/customers/')) {
    console.log('❌ Old double endpoint still present: /customers/customers/');
    endpointsValid = false;
  } else {
    console.log('✅ No old double endpoints found');
  }
  
} catch (error) {
  console.log('❌ Error validating API endpoints:', error.message);
}

// Test 3: Check form structure
console.log('\n📋 Test 3: Validating customer creation form...');
try {
  const customerFormPath = path.join(__dirname, 'src/app/customers/new/page.tsx');
  const customerFormContent = fs.readFileSync(customerFormPath, 'utf8');
  
  const requiredFormFields = [
    'customer_code: \'\'',
    'customer_type: \'INDIVIDUAL\'',
    'business_name: \'\'',
    'first_name: \'\'',
    'last_name: \'\'',
    'email: \'\'',
    'phone: \'\'',
    'mobile: \'\'',
    'address_line1: \'\'',
    'address_line2: \'\'',
    'city: \'\'',
    'state: \'\'',
    'postal_code: \'\'',
    'country: \'\'',
    'tax_number: \'\'',
    'credit_limit: 1000',
    'payment_terms: \'\'',
    'notes: \'\''
  ];
  
  let formValid = true;
  requiredFormFields.forEach(field => {
    if (!customerFormContent.includes(field)) {
      console.log(`❌ Missing form field: ${field}`);
      formValid = false;
    }
  });
  
  if (formValid) {
    console.log('✅ Customer form contains all required fields');
  }
  
  // Check for form inputs
  const requiredInputs = [
    'id="email"',
    'id="phone"',
    'id="mobile"',
    'id="address_line1"',
    'id="address_line2"',
    'id="city"',
    'id="state"',
    'id="postal_code"',
    'id="country"',
    'id="tax_number"',
    'id="payment_terms"',
    'id="notes"'
  ];
  
  requiredInputs.forEach(input => {
    if (!customerFormContent.includes(input)) {
      console.log(`❌ Missing form input: ${input}`);
      formValid = false;
    }
  });
  
  if (formValid) {
    console.log('✅ All form inputs are present');
  }
  
} catch (error) {
  console.log('❌ Error validating customer form:', error.message);
}

// Test 4: Check for debug console.logs (should be removed)
console.log('\n📋 Test 4: Checking for debug console.logs...');
try {
  const customersApiPath = path.join(__dirname, 'src/services/api/customers.ts');
  const customerFormPath = path.join(__dirname, 'src/app/customers/new/page.tsx');
  
  const apiContent = fs.readFileSync(customersApiPath, 'utf8');
  const formContent = fs.readFileSync(customerFormPath, 'utf8');
  
  const debugLogs = [
    'console.log(\'Customer API - Creating customer with data:\'',
    'console.log(\'Customer API - Response:\'',
    'console.log(\'Customer API - List params:\'',
    'console.log(\'Creating customer with data:\''
  ];
  
  let debugFound = false;
  debugLogs.forEach(log => {
    if (apiContent.includes(log) || formContent.includes(log)) {
      console.log(`⚠️ Debug log still present: ${log}`);
      debugFound = true;
    }
  });
  
  if (!debugFound) {
    console.log('✅ No debug console.logs found (production ready)');
  }
  
} catch (error) {
  console.log('❌ Error checking for debug logs:', error.message);
}

console.log('\n🎉 Validation complete!');
console.log('\n📖 Next steps:');
console.log('1. Start the backend server at http://localhost:8000');
console.log('2. Start the frontend server at http://localhost:3000');
console.log('3. Follow the manual testing instructions in MANUAL_TEST_INSTRUCTIONS.md');
console.log('4. Test customer creation with both individual and business types');