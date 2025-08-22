/**
 * Customer Retrieval Tests
 * Tests for retrieving customer information with various scenarios
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('Customer Retrieval Tests', () => {
  let authToken = null;
  let testCustomers = [];

  beforeAll(async () => {
    // Get authentication token
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login-simple`, {
        email: 'admin@rental.com',
        password: 'admin123'
      });
      
      if (response.data && response.data.access_token) {
        authToken = response.data.access_token;
      }
    } catch (error) {
      console.error('Failed to authenticate:', error.response?.data || error.message);
    }

    // Create test customers for retrieval tests
    if (authToken) {
      const customerDataList = [
        {
          customer: {
            customer_type: 'INDIVIDUAL',
            first_name: 'Alice',
            last_name: 'Johnson',
            customer_tier: 'BRONZE',
            credit_limit: 1000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'alice.johnson@email.com',
              is_primary: true,
              opt_in_marketing: true
            },
            {
              contact_type: 'MOBILE',
              contact_value: '+1234567890',
              is_primary: false,
              opt_in_marketing: false
            }
          ],
          addresses: [
            {
              address_type: 'BOTH',
              address_line1: '123 Main St',
              city: 'New York',
              state: 'NY',
              country: 'USA',
              postal_code: '10001',
              is_default: true
            }
          ]
        },
        {
          customer: {
            customer_type: 'BUSINESS',
            business_name: 'Tech Solutions Inc',
            tax_id: 'TAX123456789',
            customer_tier: 'SILVER',
            credit_limit: 5000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'info@techsolutions.com',
              is_primary: true,
              opt_in_marketing: true
            },
            {
              contact_type: 'PHONE',
              contact_value: '+1-800-TECH-SOL',
              is_primary: false,
              opt_in_marketing: false
            }
          ],
          addresses: [
            {
              address_type: 'BILLING',
              address_line1: '456 Business Ave',
              address_line2: 'Suite 100',
              city: 'Los Angeles',
              state: 'CA',
              country: 'USA',
              postal_code: '90210',
              is_default: true
            },
            {
              address_type: 'SHIPPING',
              address_line1: '789 Warehouse St',
              city: 'Los Angeles',
              state: 'CA',
              country: 'USA',
              postal_code: '90211',
              is_default: false
            }
          ],
          contact_persons: [
            {
              contact_name: 'John Smith',
              designation: 'CEO',
              department: 'Executive',
              is_primary: true,
              contact_methods: [
                {
                  contact_type: 'EMAIL',
                  contact_value: 'john.smith@techsolutions.com',
                  is_primary: true
                }
              ]
            }
          ]
        },
        {
          customer: {
            customer_type: 'INDIVIDUAL',
            first_name: 'Bob',
            last_name: 'Williams',
            customer_tier: 'GOLD',
            credit_limit: 3000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'bob.williams@email.com',
              is_primary: true,
              opt_in_marketing: false
            }
          ],
          addresses: [
            {
              address_type: 'BOTH',
              address_line1: '789 Oak Ave',
              city: 'Chicago',
              state: 'IL',
              country: 'USA',
              postal_code: '60601',
              is_default: true
            }
          ]
        }
      ];

      try {
        const customerPromises = customerDataList.map(data =>
          axios.post(
            `${API_BASE_URL}/customers/`,
            data,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          )
        );

        const responses = await Promise.all(customerPromises);
        testCustomers = responses.map(response => response.data);
      } catch (error) {
        console.error('Failed to create test customers:', error.response?.data || error.message);
      }
    }
  });

  afterAll(async () => {
    // Clean up test customers
    if (authToken && testCustomers.length > 0) {
      const deletePromises = testCustomers.map(customer =>
        axios.delete(
          `${API_BASE_URL}/customers/${customer.id}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        ).catch(() => {}) // Ignore cleanup errors
      );

      await Promise.all(deletePromises);
    }
  });

  describe('Individual Customer Retrieval', () => {
    test('should retrieve customer by ID with complete information', async () => {
      if (!authToken || testCustomers.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      const individualCustomer = testCustomers.find(c => c.customer_type === 'INDIVIDUAL');
      
      const response = await axios.get(
        `${API_BASE_URL}/customers/${individualCustomer.id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(individualCustomer.id);
      expect(response.data.customer_type).toBe('INDIVIDUAL');
      expect(response.data.first_name).toBe('Alice');
      expect(response.data.last_name).toBe('Johnson');
      expect(response.data.customer_tier).toBe('BRONZE');
      expect(response.data.credit_limit).toBe(1000);
      expect(response.data.is_active).toBe(true);
      expect(response.data.blacklist_status).toBe('CLEAR');
      
      // Verify contact methods
      expect(response.data.contact_methods).toHaveLength(2);
      const primaryEmail = response.data.contact_methods.find(c => c.is_primary);
      expect(primaryEmail.contact_type).toBe('EMAIL');
      expect(primaryEmail.contact_value).toBe('alice.johnson@email.com');
      
      // Verify addresses
      expect(response.data.addresses).toHaveLength(1);
      expect(response.data.addresses[0].address_line1).toBe('123 Main St');
      expect(response.data.addresses[0].city).toBe('New York');
    });

    test('should retrieve customer by customer code', async () => {
      if (!authToken || testCustomers.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      const customer = testCustomers[0];
      
      if (customer.customer_code) {
        const response = await axios.get(
          `${API_BASE_URL}/customers/code/${customer.customer_code}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(customer.id);
        expect(response.data.customer_code).toBe(customer.customer_code);
      } else {
        // If customer_code is not automatically generated, skip this test
        console.log('Customer code not available, skipping customer code retrieval test');
      }
    });

    test('should include calculated fields in customer data', async () => {
      if (!authToken || testCustomers.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      const customer = testCustomers[0];
      
      const response = await axios.get(
        `${API_BASE_URL}/customers/${customer.id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('lifetime_value');
      expect(response.data).toHaveProperty('created_at');
      expect(response.data).toHaveProperty('updated_at');
      expect(typeof response.data.lifetime_value).toBe('number');
      expect(response.data.lifetime_value).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Business Customer Retrieval', () => {
    test('should retrieve business customer with contact persons', async () => {
      if (!authToken || testCustomers.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      const businessCustomer = testCustomers.find(c => c.customer_type === 'BUSINESS');
      
      const response = await axios.get(
        `${API_BASE_URL}/customers/${businessCustomer.id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.customer_type).toBe('BUSINESS');
      expect(response.data.business_name).toBe('Tech Solutions Inc');
      expect(response.data.tax_id).toBe('TAX123456789');
      
      // Verify contact persons
      expect(response.data.contact_persons).toHaveLength(1);
      const contactPerson = response.data.contact_persons[0];
      expect(contactPerson.contact_name).toBe('John Smith');
      expect(contactPerson.designation).toBe('CEO');
      expect(contactPerson.is_primary).toBe(true);
      expect(contactPerson.contact_methods).toHaveLength(1);
      
      // Verify multiple addresses
      expect(response.data.addresses).toHaveLength(2);
      const billingAddress = response.data.addresses.find(a => a.address_type === 'BILLING');
      const shippingAddress = response.data.addresses.find(a => a.address_type === 'SHIPPING');
      expect(billingAddress).toBeTruthy();
      expect(shippingAddress).toBeTruthy();
    });
  });

  describe('Customer List Retrieval', () => {
    test('should retrieve paginated list of customers', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            skip: 0,
            limit: 10
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('customers');
      expect(response.data).toHaveProperty('total_count');
      expect(response.data).toHaveProperty('page');
      expect(response.data).toHaveProperty('page_size');
      expect(Array.isArray(response.data.customers)).toBe(true);
      expect(response.data.total_count).toBeGreaterThanOrEqual(testCustomers.length);
    });

    test('should filter customers by customer type', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            customer_type: 'INDIVIDUAL'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.customers.every(c => c.customer_type === 'INDIVIDUAL')).toBe(true);
    });

    test('should filter customers by customer tier', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            customer_tier: 'GOLD'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.customers.every(c => c.customer_tier === 'GOLD')).toBe(true);
    });

    test('should filter customers by active status', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            is_active: true
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.customers.every(c => c.is_active === true)).toBe(true);
    });

    test('should search customers by name', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: 'Alice'
          }
        }
      );

      expect(response.status).toBe(200);
      const aliceCustomer = response.data.customers.find(c => 
        c.first_name === 'Alice' && c.last_name === 'Johnson'
      );
      expect(aliceCustomer).toBeTruthy();
    });

    test('should search customers by email', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: 'techsolutions.com'
          }
        }
      );

      expect(response.status).toBe(200);
      const techCustomer = response.data.customers.find(c => 
        c.business_name === 'Tech Solutions Inc'
      );
      expect(techCustomer).toBeTruthy();
    });

    test('should filter by location (city/state)', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            city: 'New York'
          }
        }
      );

      expect(response.status).toBe(200);
      const nyCustomer = response.data.customers.find(c => 
        c.first_name === 'Alice' && c.last_name === 'Johnson'
      );
      expect(nyCustomer).toBeTruthy();
    });

    test('should filter by blacklist status', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            blacklist_status: 'CLEAR'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.customers.every(c => c.blacklist_status === 'CLEAR')).toBe(true);
    });

    test('should handle pagination correctly', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      // Get first page
      const firstPageResponse = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            skip: 0,
            limit: 2
          }
        }
      );

      expect(firstPageResponse.status).toBe(200);
      expect(firstPageResponse.data.customers).toHaveLength(Math.min(2, firstPageResponse.data.total_count));

      // Get second page if there are enough customers
      if (firstPageResponse.data.total_count > 2) {
        const secondPageResponse = await axios.get(
          `${API_BASE_URL}/customers/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              skip: 2,
              limit: 2
            }
          }
        );

        expect(secondPageResponse.status).toBe(200);
        
        // Verify different customers on different pages
        const firstPageIds = firstPageResponse.data.customers.map(c => c.id);
        const secondPageIds = secondPageResponse.data.customers.map(c => c.id);
        const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
        expect(overlap).toHaveLength(0);
      }
    });
  });

  describe('Specialized Customer Retrieval', () => {
    test('should retrieve customers by tier', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/tier/GOLD`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.customers.every(c => c.customer_tier === 'GOLD')).toBe(true);
    });

    test('should search customers by name with limit', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/search/name`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            name: 'Johnson',
            limit: 5
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeLessThanOrEqual(5);
      
      if (response.data.length > 0) {
        const customer = response.data.find(c => c.last_name === 'Johnson');
        expect(customer).toBeTruthy();
      }
    });

    test('should retrieve blacklisted customers', async () => {
      if (!authToken || testCustomers.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      // First blacklist a customer
      const customer = testCustomers[0];
      await axios.post(
        `${API_BASE_URL}/customers/${customer.id}/blacklist`,
        { action: 'blacklist', reason: 'Test blacklist' },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Then retrieve blacklisted customers
      const response = await axios.get(
        `${API_BASE_URL}/customers/blacklisted/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.customers)).toBe(true);
      const blacklistedCustomer = response.data.customers.find(c => c.id === customer.id);
      expect(blacklistedCustomer).toBeTruthy();
      expect(blacklistedCustomer.blacklist_status).toBe('BLACKLISTED');

      // Clean up: unblacklist the customer
      await axios.post(
        `${API_BASE_URL}/customers/${customer.id}/blacklist`,
        { action: 'unblacklist' },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    });
  });

  describe('Customer Analytics Retrieval', () => {
    test('should retrieve customer analytics data', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/analytics/customers`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('total_customers');
      expect(response.data).toHaveProperty('active_customers');
      expect(response.data).toHaveProperty('customer_breakdown');
      expect(typeof response.data.total_customers).toBe('number');
      expect(typeof response.data.active_customers).toBe('number');
    });

    test('should retrieve customer transaction history', async () => {
      if (!authToken || testCustomers.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      const customer = testCustomers[0];
      
      const response = await axios.get(
        `${API_BASE_URL}/analytics/customers/${customer.id}/transactions`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('transactions');
      expect(response.data).toHaveProperty('summary');
      expect(Array.isArray(response.data.transactions)).toBe(true);
      expect(typeof response.data.summary).toBe('object');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should require authentication for customer retrieval', async () => {
      if (testCustomers.length === 0) {
        throw new Error('Test customers required for this test');
      }

      try {
        await axios.get(`${API_BASE_URL}/customers/${testCustomers[0].id}`);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should return 404 for non-existent customer ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

      try {
        await axios.get(
          `${API_BASE_URL}/customers/${nonExistentId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.detail).toBe('Customer not found');
      }
    });

    test('should handle malformed customer ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const malformedId = 'invalid-id';

      try {
        await axios.get(
          `${API_BASE_URL}/customers/${malformedId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });

    test('should handle invalid pagination parameters', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            skip: -1,
            limit: 0
          }
        }
      );

      // Should handle gracefully, either with default values or validation error
      expect([200, 400, 422]).toContain(response.status);
    });

    test('should return empty list for non-matching search', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: 'NonExistentCustomerName12345'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.customers).toHaveLength(0);
      expect(response.data.total_count).toBe(0);
    });

    test('should handle invalid customer tier filter', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      try {
        await axios.get(
          `${API_BASE_URL}/customers/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              customer_tier: 'INVALID_TIER'
            }
          }
        );
        
        // Might succeed with empty results or fail with validation error
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });
  });

  describe('Performance Tests', () => {
    test('should retrieve customer list within reasonable time', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const startTime = Date.now();
      
      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            limit: 50
          }
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should retrieve individual customer within reasonable time', async () => {
      if (!authToken || testCustomers.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      const startTime = Date.now();
      
      const response = await axios.get(
        `${API_BASE_URL}/customers/${testCustomers[0].id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test('should handle concurrent customer retrievals', async () => {
      if (!authToken || testCustomers.length < 2) {
        throw new Error('Authentication and multiple test customers required for this test');
      }

      const retrievalPromises = testCustomers.slice(0, 3).map(customer =>
        axios.get(
          `${API_BASE_URL}/customers/${customer.id}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        )
      );

      const responses = await Promise.all(retrievalPromises);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.data.id).toBe(testCustomers[index].id);
      });
    });
  });
});