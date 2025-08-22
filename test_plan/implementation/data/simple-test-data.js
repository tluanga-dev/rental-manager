/**
 * Simple Test Data Generator (No External Dependencies)
 * Generates basic test data for supplier testing
 */

const fs = require('fs');
const path = require('path');

// Simple data generators
const companies = [
  'ACME Manufacturing Corp', 'Global Distributors Ltd', 'Tech Solutions Inc', 
  'Quick Service Co', 'Premier Suppliers LLC', 'Industrial Components Ltd',
  'Quality Parts Co', 'Reliable Equipment Inc', 'Professional Services Corp',
  'Advanced Materials Ltd'
];

const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Chris', 'Emma', 'Tom', 'Anna'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Wilson'];

const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'FL', 'OH', 'GA', 'NC'];

const supplierTypes = ['MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'RETAILER', 'INVENTORY', 'SERVICE', 'DIRECT'];
const supplierTiers = ['PREMIUM', 'STANDARD', 'BASIC', 'TRIAL'];
const supplierStatuses = ['ACTIVE', 'INACTIVE', 'PENDING', 'APPROVED', 'SUSPENDED', 'BLACKLISTED'];
const paymentTerms = ['IMMEDIATE', 'NET15', 'NET30', 'NET45', 'NET60', 'NET90', 'COD'];

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSupplierCode(companyName, index) {
  const words = companyName.split(' ');
  const prefix = words.map(word => word.charAt(0).toUpperCase()).join('').substring(0, 4);
  const suffix = String(index).padStart(3, '0');
  return `${prefix}${suffix}`;
}

function generateEmail(firstName, lastName) {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${randomChoice(['test', 'demo', 'sample'])}.com`;
}

function generatePhone() {
  return `+1-${randomNumber(100, 999)}-${randomNumber(100, 999)}-${randomNumber(1000, 9999)}`;
}

function generateValidSupplier(index = 0) {
  const companyName = randomChoice(companies);
  const firstName = randomChoice(firstNames);
  const lastName = randomChoice(lastNames);
  
  return {
    supplier_code: generateSupplierCode(companyName, index),
    company_name: companyName,
    supplier_type: randomChoice(supplierTypes),
    contact_person: `${firstName} ${lastName}`,
    email: generateEmail(firstName, lastName),
    phone: generatePhone(),
    mobile: generatePhone(),
    address_line1: `${randomNumber(100, 9999)} ${randomChoice(['Main', 'Oak', 'First', 'Second', 'Park', 'Elm'])} Street`,
    address_line2: Math.random() > 0.5 ? `Suite ${randomNumber(100, 999)}` : '',
    city: randomChoice(cities),
    state: randomChoice(states),
    postal_code: String(randomNumber(10000, 99999)),
    country: 'USA',
    tax_id: `TAX${randomNumber(100000000, 999999999)}`,
    payment_terms: randomChoice(paymentTerms),
    credit_limit: randomNumber(0, 1000000),
    supplier_tier: randomChoice(supplierTiers),
    status: randomChoice(supplierStatuses),
    quality_rating: Math.round((Math.random() * 5) * 10) / 10,
    delivery_rating: Math.round((Math.random() * 5) * 10) / 10,
    average_delivery_days: randomNumber(1, 30),
    total_orders: randomNumber(0, 1000),
    total_spend: Math.round(Math.random() * 5000000 * 100) / 100,
    notes: 'Generated test supplier data',
    website: `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    account_manager: `${randomChoice(firstNames)} ${randomChoice(lastNames)}`,
    preferred_payment_method: randomChoice(['BANK_TRANSFER', 'CREDIT_CARD', 'CHECK', 'CASH'])
  };
}

function generateTestData() {
  console.log('📊 Generating test data...');
  
  const testData = {
    valid_suppliers: [],
    invalid_suppliers: {
      empty_code: {
        supplier_code: '',
        company_name: 'Test Company',
        supplier_type: 'DISTRIBUTOR'
      },
      long_code: {
        supplier_code: 'A'.repeat(51),
        company_name: 'Test Company',
        supplier_type: 'DISTRIBUTOR'
      },
      empty_name: {
        supplier_code: 'TEST001',
        company_name: '',
        supplier_type: 'DISTRIBUTOR'
      },
      invalid_email: {
        supplier_code: 'TEST002',
        company_name: 'Test Company',
        supplier_type: 'DISTRIBUTOR',
        email: 'not-an-email'
      },
      negative_credit: {
        supplier_code: 'TEST003',
        company_name: 'Test Company',
        supplier_type: 'DISTRIBUTOR',
        credit_limit: -1000
      },
      xss_attempt: {
        supplier_code: 'TEST004',
        company_name: '<script>alert("xss")</script>Test Company',
        supplier_type: 'DISTRIBUTOR'
      },
      sql_injection: {
        supplier_code: "'; DROP TABLE suppliers; --",
        company_name: 'Test Company',
        supplier_type: 'DISTRIBUTOR'
      }
    }
  };
  
  // Generate 50 valid suppliers
  for (let i = 1; i <= 50; i++) {
    testData.valid_suppliers.push(generateValidSupplier(i));
  }
  
  // Save to file
  const dataDir = __dirname;
  const filePath = path.join(dataDir, 'supplier-test-data.json');
  
  fs.writeFileSync(filePath, JSON.stringify(testData, null, 2));
  
  console.log(`✅ Generated ${testData.valid_suppliers.length} valid suppliers`);
  console.log(`✅ Generated ${Object.keys(testData.invalid_suppliers).length} invalid test cases`);
  console.log(`✅ Test data saved to: ${filePath}`);
  
  return testData;
}

// Command line usage
if (require.main === module) {
  generateTestData();
}

module.exports = { generateTestData, generateValidSupplier };