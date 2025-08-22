/**
 * Test Data Generator for Supplier CRUD Testing
 * Generates realistic test data for various test scenarios
 */

const faker = require('faker');
const fs = require('fs');
const path = require('path');

class SupplierTestDataGenerator {
  constructor() {
    this.supplierTypes = ['MANUFACTURER', 'DISTRIBUTOR', 'WHOLESALER', 'RETAILER', 'INVENTORY', 'SERVICE', 'DIRECT'];
    this.supplierTiers = ['PREMIUM', 'STANDARD', 'BASIC', 'TRIAL'];
    this.supplierStatuses = ['ACTIVE', 'INACTIVE', 'PENDING', 'APPROVED', 'SUSPENDED', 'BLACKLISTED'];
    this.paymentTerms = ['IMMEDIATE', 'NET15', 'NET30', 'NET45', 'NET60', 'NET90', 'COD'];
  }

  /**
   * Generate a single valid supplier
   */
  generateValidSupplier(overrides = {}) {
    const companyName = faker.company.name();
    const supplierCode = this.generateSupplierCode(companyName);
    
    return {
      supplier_code: supplierCode,
      company_name: companyName,
      supplier_type: faker.helpers.arrayElement(this.supplierTypes),
      contact_person: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number('+1-###-###-####'),
      mobile: faker.phone.number('+1-###-###-####'),
      address_line1: faker.location.streetAddress(),
      address_line2: faker.location.secondaryAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      postal_code: faker.location.zipCode(),
      country: faker.location.country(),
      tax_id: `TAX${faker.string.numeric(9)}`,
      payment_terms: faker.helpers.arrayElement(this.paymentTerms),
      credit_limit: faker.number.int({ min: 0, max: 1000000 }),
      supplier_tier: faker.helpers.arrayElement(this.supplierTiers),
      status: faker.helpers.arrayElement(this.supplierStatuses),
      quality_rating: faker.number.float({ min: 0, max: 5, precision: 0.1 }),
      delivery_rating: faker.number.float({ min: 0, max: 5, precision: 0.1 }),
      average_delivery_days: faker.number.int({ min: 1, max: 30 }),
      total_orders: faker.number.int({ min: 0, max: 1000 }),
      total_spend: faker.number.float({ min: 0, max: 5000000, precision: 0.01 }),
      last_order_date: faker.date.recent({ days: 365 }),
      notes: faker.lorem.paragraph(),
      website: faker.internet.url(),
      account_manager: faker.person.fullName(),
      preferred_payment_method: faker.helpers.arrayElement(['BANK_TRANSFER', 'CREDIT_CARD', 'CHECK', 'CASH']),
      insurance_expiry: faker.date.future({ years: 2 }),
      certifications: faker.lorem.words(3),
      contract_start_date: faker.date.past({ years: 1 }),
      contract_end_date: faker.date.future({ years: 2 }),
      ...overrides
    };
  }

  /**
   * Generate supplier code based on company name
   */
  generateSupplierCode(companyName) {
    const words = companyName.split(' ');
    const prefix = words.map(word => word.charAt(0).toUpperCase()).join('').substring(0, 4);
    const suffix = faker.string.numeric(3);
    return `${prefix}${suffix}`;
  }

  /**
   * Generate minimal supplier (only required fields)
   */
  generateMinimalSupplier(overrides = {}) {
    const companyName = faker.company.name();
    return {
      supplier_code: this.generateSupplierCode(companyName),
      company_name: companyName,
      supplier_type: faker.helpers.arrayElement(this.supplierTypes),
      ...overrides
    };
  }

  /**
   * Generate supplier with invalid data for validation testing
   */
  generateInvalidSupplier(invalidField) {
    const baseSupplier = this.generateValidSupplier();
    
    switch (invalidField) {
      case 'empty_code':
        return { ...baseSupplier, supplier_code: '' };
      
      case 'long_code':
        return { ...baseSupplier, supplier_code: 'A'.repeat(51) };
      
      case 'empty_name':
        return { ...baseSupplier, company_name: '' };
      
      case 'long_name':
        return { ...baseSupplier, company_name: 'A'.repeat(256) };
      
      case 'invalid_email':
        return { ...baseSupplier, email: 'not-an-email' };
      
      case 'long_email':
        return { ...baseSupplier, email: 'a'.repeat(250) + '@test.com' };
      
      case 'negative_credit':
        return { ...baseSupplier, credit_limit: -1000 };
      
      case 'invalid_type':
        return { ...baseSupplier, supplier_type: 'INVALID_TYPE' };
      
      case 'xss_attempt':
        return { ...baseSupplier, company_name: '<script>alert("xss")</script>Test Company' };
      
      case 'sql_injection':
        return { ...baseSupplier, supplier_code: "'; DROP TABLE suppliers; --" };
      
      default:
        return baseSupplier;
    }
  }

  /**
   * Generate boundary value test data
   */
  generateBoundaryTestData() {
    return {
      supplier_codes: {
        empty: '',
        single_char: 'A',
        max_length: 'A'.repeat(50),
        over_max: 'A'.repeat(51),
        special_chars: 'SUPP-001_TEST@#',
        numeric_only: '123456',
        unicode: 'SUPP测试'
      },
      company_names: {
        empty: '',
        single_char: 'A',
        max_length: 'A'.repeat(255),
        over_max: 'A'.repeat(256),
        unicode: '测试公司名称',
        html_tags: '<b>Company</b> Name',
        special_chars: 'Company & Co. Ltd.'
      },
      credit_limits: {
        negative: -1,
        zero: 0,
        max_safe_integer: Number.MAX_SAFE_INTEGER,
        decimal: 12345.67,
        very_large: 999999999999.99
      },
      emails: {
        valid_simple: 'test@example.com',
        valid_international: 'test@example.co.uk',
        valid_subdomain: 'test@mail.example.com',
        invalid_no_at: 'testexample.com',
        invalid_no_domain: 'test@',
        invalid_no_tld: 'test@example',
        max_length: 'a'.repeat(240) + '@test.com',
        over_max: 'a'.repeat(250) + '@test.com'
      },
      phone_numbers: {
        us_format: '+1-555-123-4567',
        international: '+44-20-1234-5678',
        no_formatting: '5551234567',
        with_extension: '+1-555-123-4567 ext 123',
        max_length: '1'.repeat(50),
        over_max: '1'.repeat(51)
      }
    };
  }

  /**
   * Generate performance test data (large dataset)
   */
  generatePerformanceTestData(count = 1000) {
    const suppliers = [];
    const usedCodes = new Set();
    
    for (let i = 0; i < count; i++) {
      let supplier;
      let attempts = 0;
      
      // Ensure unique supplier codes
      do {
        supplier = this.generateValidSupplier({
          supplier_code: `PERF${String(i).padStart(6, '0')}`
        });
        attempts++;
      } while (usedCodes.has(supplier.supplier_code) && attempts < 10);
      
      usedCodes.add(supplier.supplier_code);
      suppliers.push(supplier);
    }
    
    return suppliers;
  }

  /**
   * Generate search test data
   */
  generateSearchTestData() {
    return [
      // Companies with common search terms
      this.generateValidSupplier({ 
        company_name: 'ACME Manufacturing Corp',
        supplier_code: 'ACME001' 
      }),
      this.generateValidSupplier({ 
        company_name: 'Global Distributors Ltd',
        supplier_code: 'GLOB001' 
      }),
      this.generateValidSupplier({ 
        company_name: 'Tech Solutions Inc',
        supplier_code: 'TECH001' 
      }),
      this.generateValidSupplier({ 
        company_name: 'Quick Service Co',
        supplier_code: 'QUICK01' 
      }),
      // Suppliers with special characters
      this.generateValidSupplier({ 
        company_name: 'A&B Manufacturing',
        supplier_code: 'AB001' 
      }),
      // Suppliers with numbers
      this.generateValidSupplier({ 
        company_name: '123 Supply Company',
        supplier_code: '123SUP' 
      }),
      // Unicode test
      this.generateValidSupplier({ 
        company_name: 'Café Supplies Ltd',
        supplier_code: 'CAFE01' 
      })
    ];
  }

  /**
   * Generate filter test data
   */
  generateFilterTestData() {
    const suppliers = [];
    
    // Generate suppliers for each type
    this.supplierTypes.forEach(type => {
      suppliers.push(this.generateValidSupplier({ 
        supplier_type: type,
        supplier_code: `${type.substring(0,4)}001`
      }));
    });
    
    // Generate suppliers for each tier
    this.supplierTiers.forEach(tier => {
      suppliers.push(this.generateValidSupplier({ 
        supplier_tier: tier,
        supplier_code: `${tier.substring(0,4)}001`
      }));
    });
    
    // Generate suppliers for each status
    this.supplierStatuses.forEach(status => {
      suppliers.push(this.generateValidSupplier({ 
        status: status,
        supplier_code: `${status.substring(0,4)}001`
      }));
    });
    
    return suppliers;
  }

  /**
   * Generate concurrent testing data
   */
  generateConcurrentTestData() {
    return {
      original: this.generateValidSupplier({
        supplier_code: 'CONCURRENT001',
        company_name: 'Concurrent Test Company'
      }),
      update1: {
        company_name: 'Updated by User 1',
        contact_person: 'Contact Updated by User 1'
      },
      update2: {
        company_name: 'Updated by User 2', 
        contact_person: 'Contact Updated by User 2'
      }
    };
  }

  /**
   * Save test data to files
   */
  saveTestDataToFiles() {
    const dataDir = path.join(__dirname);
    
    // Ensure directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const testData = {
      valid_suppliers: Array.from({ length: 50 }, () => this.generateValidSupplier()),
      minimal_suppliers: Array.from({ length: 10 }, () => this.generateMinimalSupplier()),
      invalid_suppliers: {
        empty_code: this.generateInvalidSupplier('empty_code'),
        long_code: this.generateInvalidSupplier('long_code'),
        empty_name: this.generateInvalidSupplier('empty_name'),
        invalid_email: this.generateInvalidSupplier('invalid_email'),
        negative_credit: this.generateInvalidSupplier('negative_credit'),
        xss_attempt: this.generateInvalidSupplier('xss_attempt'),
        sql_injection: this.generateInvalidSupplier('sql_injection')
      },
      boundary_data: this.generateBoundaryTestData(),
      search_data: this.generateSearchTestData(),
      filter_data: this.generateFilterTestData(),
      concurrent_data: this.generateConcurrentTestData(),
      performance_data: this.generatePerformanceTestData(100) // Smaller set for file
    };

    // Save main test data
    fs.writeFileSync(
      path.join(dataDir, 'supplier-test-data.json'),
      JSON.stringify(testData, null, 2)
    );

    // Save CSV for manual testing
    this.saveToCSV(testData.valid_suppliers, path.join(dataDir, 'valid-suppliers.csv'));
    
    console.log('✅ Test data generated and saved to:', dataDir);
    console.log(`📊 Generated ${testData.valid_suppliers.length} valid suppliers`);
    console.log(`📊 Generated ${Object.keys(testData.invalid_suppliers).length} invalid test cases`);
    console.log(`📊 Generated ${testData.search_data.length} search test suppliers`);
    console.log(`📊 Generated ${testData.filter_data.length} filter test suppliers`);
    
    return testData;
  }

  /**
   * Save suppliers to CSV format
   */
  saveToCSV(suppliers, filePath) {
    if (suppliers.length === 0) return;

    const headers = Object.keys(suppliers[0]);
    const csvContent = [
      headers.join(','),
      ...suppliers.map(supplier => 
        headers.map(header => {
          const value = supplier[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    fs.writeFileSync(filePath, csvContent);
  }

  /**
   * Load test data from file
   */
  loadTestData() {
    const filePath = path.join(__dirname, 'supplier-test-data.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
  }

  /**
   * Clean up test data (remove generated files)
   */
  cleanup() {
    const dataDir = path.join(__dirname);
    const files = ['supplier-test-data.json', 'valid-suppliers.csv'];
    
    files.forEach(file => {
      const filePath = path.join(dataDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Removed ${file}`);
      }
    });
  }
}

// Command line usage
if (require.main === module) {
  const generator = new SupplierTestDataGenerator();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'generate':
      generator.saveTestDataToFiles();
      break;
    
    case 'cleanup':
      generator.cleanup();
      break;
    
    case 'performance':
      const count = parseInt(process.argv[3]) || 1000;
      const perfData = generator.generatePerformanceTestData(count);
      fs.writeFileSync(
        path.join(__dirname, 'performance-test-data.json'),
        JSON.stringify(perfData, null, 2)
      );
      console.log(`✅ Generated ${count} suppliers for performance testing`);
      break;
    
    default:
      console.log('Usage:');
      console.log('  node test-data-generator.js generate    - Generate all test data');
      console.log('  node test-data-generator.js cleanup     - Clean up generated files');
      console.log('  node test-data-generator.js performance [count] - Generate performance test data');
      break;
  }
}

module.exports = SupplierTestDataGenerator;