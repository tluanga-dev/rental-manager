/**
 * Customer API Integration Tests
 * Tests for customer API service integration with backend
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('Customer API Integration Tests', () => {
  let authToken = null;
  let createdCustomerIds = [];

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
  });

  afterAll(async () => {
    // Clean up all created customers
    if (authToken && createdCustomerIds.length > 0) {
      const deletePromises = createdCustomerIds.map(id =>
        axios.delete(
          `${API_BASE_URL}/customers/${id}`,
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

  describe('Complete Customer Lifecycle Integration', () => {
    test('should support full CRUD lifecycle for individual customer', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      // Create
      const createData = {
        customer: {
          customer_type: 'INDIVIDUAL',
          first_name: 'Integration',
          last_name: 'Test',
          customer_tier: 'BRONZE',
          credit_limit: 1000
        },
        contact_methods: [
          {
            contact_type: 'EMAIL',
            contact_value: 'integration.test@example.com',
            is_primary: true,
            opt_in_marketing: true
          }
        ],
        addresses: [
          {
            address_type: 'BOTH',
            address_line1: '123 Integration St',
            city: 'Test City',
            state: 'TS',
            country: 'USA',
            postal_code: '12345',
            is_default: true
          }
        ]
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/customers/`,
        createData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(createResponse.status).toBe(201);
      const customerId = createResponse.data.id;
      createdCustomerIds.push(customerId);

      // Read
      const readResponse = await axios.get(
        `${API_BASE_URL}/customers/${customerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(readResponse.status).toBe(200);
      expect(readResponse.data.first_name).toBe('Integration');
      expect(readResponse.data.last_name).toBe('Test');

      // Update
      const updateData = {
        customer: {
          first_name: 'Updated Integration',
          customer_tier: 'GOLD'
        },
        contact_methods: [
          {
            contact_type: 'EMAIL',
            contact_value: 'updated.integration@example.com',
            is_primary: true,
            opt_in_marketing: false
          },
          {
            contact_type: 'MOBILE',
            contact_value: '+1234567890',
            is_primary: false,
            opt_in_marketing: false
          }
        ]
      };

      const updateResponse = await axios.put(
        `${API_BASE_URL}/customers/${customerId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.first_name).toBe('Updated Integration');
      expect(updateResponse.data.customer_tier).toBe('GOLD');
      expect(updateResponse.data.contact_methods).toHaveLength(2);

      // Verify update persisted
      const verifyResponse = await axios.get(
        `${API_BASE_URL}/customers/${customerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.data.first_name).toBe('Updated Integration');
      expect(verifyResponse.data.customer_tier).toBe('GOLD');

      // Delete (Soft delete)
      const deleteResponse = await axios.delete(
        `${API_BASE_URL}/customers/${customerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(deleteResponse.status).toBe(200);

      // Verify soft delete
      const afterDeleteResponse = await axios.get(
        `${API_BASE_URL}/customers/${customerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(afterDeleteResponse.status).toBe(200);
      expect(afterDeleteResponse.data.is_active).toBe(false);
    });

    test('should support full CRUD lifecycle for business customer', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      // Create
      const createData = {
        customer: {
          customer_type: 'BUSINESS',
          business_name: 'Integration Corp',
          tax_id: 'TAX123456789',
          customer_tier: 'SILVER',
          credit_limit: 5000
        },
        contact_methods: [
          {
            contact_type: 'EMAIL',
            contact_value: 'info@integration-corp.com',
            is_primary: true,
            opt_in_marketing: true
          }
        ],
        addresses: [
          {
            address_type: 'BILLING',
            address_line1: '456 Business Ave',
            city: 'Business City',
            state: 'BC',
            country: 'USA',
            postal_code: '67890',
            is_default: true
          }
        ],
        contact_persons: [
          {
            contact_name: 'Integration Manager',
            designation: 'Manager',
            department: 'Operations',
            is_primary: true,
            contact_methods: [
              {
                contact_type: 'EMAIL',
                contact_value: 'manager@integration-corp.com',
                is_primary: true
              }
            ]
          }
        ]
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/customers/`,
        createData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(createResponse.status).toBe(201);
      const customerId = createResponse.data.id;
      createdCustomerIds.push(customerId);

      // Verify business-specific fields
      expect(createResponse.data.business_name).toBe('Integration Corp');
      expect(createResponse.data.contact_persons).toHaveLength(1);

      // Update business customer
      const updateData = {
        customer: {
          business_name: 'Updated Integration Corp',
          customer_tier: 'PLATINUM'
        },
        contact_persons: [
          {
            contact_name: 'Updated Manager',
            designation: 'Senior Manager',
            department: 'Operations',
            is_primary: true,
            contact_methods: [
              {
                contact_type: 'EMAIL',
                contact_value: 'senior.manager@integration-corp.com',
                is_primary: true
              },
              {
                contact_type: 'MOBILE',
                contact_value: '+9876543210',
                is_primary: false
              }
            ]
          },
          {
            contact_name: 'Assistant Manager',
            designation: 'Assistant',
            department: 'Support',
            is_primary: false,
            contact_methods: [
              {
                contact_type: 'EMAIL',
                contact_value: 'assistant@integration-corp.com',
                is_primary: true
              }
            ]
          }
        ]
      };

      const updateResponse = await axios.put(
        `${API_BASE_URL}/customers/${customerId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.business_name).toBe('Updated Integration Corp');
      expect(updateResponse.data.contact_persons).toHaveLength(2);
    });
  });

  describe('Advanced Customer Operations Integration', () => {
    let testCustomerId = null;

    beforeEach(async () => {
      if (!authToken) return;

      // Create a test customer for advanced operations
      const customerData = {
        customer: {
          customer_type: 'INDIVIDUAL',
          first_name: 'Advanced',
          last_name: 'Operations',
          customer_tier: 'BRONZE',
          credit_limit: 1000
        },
        contact_methods: [
          {
            contact_type: 'EMAIL',
            contact_value: 'advanced.operations@example.com',
            is_primary: true,
            opt_in_marketing: true
          }
        ],
        addresses: [
          {
            address_type: 'BOTH',
            address_line1: '789 Advanced St',
            city: 'Operations City',
            state: 'OC',
            country: 'USA',
            postal_code: '54321',
            is_default: true
          }
        ]
      };

      const response = await axios.post(
        `${API_BASE_URL}/customers/`,
        customerData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      testCustomerId = response.data.id;
      createdCustomerIds.push(testCustomerId);
    });

    test('should support tier management operations', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // Update tier to GOLD
      const goldResponse = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}/tier`,
        { customer_tier: 'GOLD' },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(goldResponse.status).toBe(200);
      expect(goldResponse.data.customer_tier).toBe('GOLD');

      // Update tier to PLATINUM
      const platinumResponse = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}/tier`,
        { customer_tier: 'PLATINUM' },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(platinumResponse.status).toBe(200);
      expect(platinumResponse.data.customer_tier).toBe('PLATINUM');

      // Verify tier change persisted
      const verifyResponse = await axios.get(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(verifyResponse.data.customer_tier).toBe('PLATINUM');
    });

    test('should support credit limit management operations', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // Increase credit limit
      const increaseResponse = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}/credit-limit`,
        { credit_limit: 5000 },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(increaseResponse.status).toBe(200);
      expect(increaseResponse.data.credit_limit).toBe(5000);

      // Decrease credit limit
      const decreaseResponse = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}/credit-limit`,
        { credit_limit: 2000 },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(decreaseResponse.status).toBe(200);
      expect(decreaseResponse.data.credit_limit).toBe(2000);

      // Verify credit limit change persisted
      const verifyResponse = await axios.get(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(verifyResponse.data.credit_limit).toBe(2000);
    });

    test('should support blacklist management operations', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // Blacklist customer
      const blacklistResponse = await axios.post(
        `${API_BASE_URL}/customers/${testCustomerId}/blacklist`,
        { action: 'blacklist', reason: 'Integration test blacklist' },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(blacklistResponse.status).toBe(200);
      expect(blacklistResponse.data.blacklist_status).toBe('BLACKLISTED');

      // Verify blacklist status persisted
      const verifyBlacklistResponse = await axios.get(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(verifyBlacklistResponse.data.blacklist_status).toBe('BLACKLISTED');

      // Unblacklist customer
      const unblacklistResponse = await axios.post(
        `${API_BASE_URL}/customers/${testCustomerId}/blacklist`,
        { action: 'unblacklist' },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(unblacklistResponse.status).toBe(200);
      expect(unblacklistResponse.data.blacklist_status).toBe('CLEAR');

      // Verify unblacklist status persisted
      const verifyUnblacklistResponse = await axios.get(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(verifyUnblacklistResponse.data.blacklist_status).toBe('CLEAR');
    });
  });

  describe('Customer Search and Filtering Integration', () => {
    let searchTestCustomers = [];

    beforeAll(async () => {
      if (!authToken) return;

      // Create diverse customers for search testing
      const customerDataList = [
        {
          customer: {
            customer_type: 'INDIVIDUAL',
            first_name: 'SearchTest',
            last_name: 'Alpha',
            customer_tier: 'BRONZE',
            credit_limit: 1000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'searchtest.alpha@example.com',
              is_primary: true,
              opt_in_marketing: true
            }
          ],
          addresses: [
            {
              address_type: 'BOTH',
              address_line1: '100 Alpha St',
              city: 'Alpha City',
              state: 'AC',
              country: 'USA',
              postal_code: '10000',
              is_default: true
            }
          ]
        },
        {
          customer: {
            customer_type: 'BUSINESS',
            business_name: 'SearchTest Beta Corp',
            tax_id: 'BETA123',
            customer_tier: 'SILVER',
            credit_limit: 3000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'info@searchtest-beta.com',
              is_primary: true,
              opt_in_marketing: false
            }
          ],
          addresses: [
            {
              address_type: 'BOTH',
              address_line1: '200 Beta Ave',
              city: 'Beta City',
              state: 'BC',
              country: 'USA',
              postal_code: '20000',
              is_default: true
            }
          ]
        },
        {
          customer: {
            customer_type: 'INDIVIDUAL',
            first_name: 'SearchTest',
            last_name: 'Gamma',
            customer_tier: 'GOLD',
            credit_limit: 5000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'searchtest.gamma@example.com',
              is_primary: true,
              opt_in_marketing: true
            }
          ],
          addresses: [
            {
              address_type: 'BOTH',
              address_line1: '300 Gamma Blvd',
              city: 'Gamma City',
              state: 'GC',
              country: 'USA',
              postal_code: '30000',
              is_default: true
            }
          ]
        }
      ];

      try {
        const createPromises = customerDataList.map(data =>
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

        const responses = await Promise.all(createPromises);
        searchTestCustomers = responses.map(response => response.data);
        createdCustomerIds.push(...searchTestCustomers.map(c => c.id));
      } catch (error) {
        console.error('Failed to create search test customers:', error.response?.data || error.message);
      }
    });

    test('should support comprehensive search functionality', async () => {
      if (!authToken || searchTestCustomers.length === 0) {
        throw new Error('Authentication and search test customers required for this test');
      }

      // Search by first name
      const firstNameResponse = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: 'SearchTest'
          }
        }
      );

      expect(firstNameResponse.status).toBe(200);
      const searchTestResults = firstNameResponse.data.customers.filter(c => 
        c.first_name === 'SearchTest' || c.business_name?.includes('SearchTest')
      );
      expect(searchTestResults.length).toBeGreaterThanOrEqual(2);

      // Search by email domain
      const emailDomainResponse = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: 'searchtest-beta.com'
          }
        }
      );

      expect(emailDomainResponse.status).toBe(200);
      const betaCorpResult = emailDomainResponse.data.customers.find(c => 
        c.business_name === 'SearchTest Beta Corp'
      );
      expect(betaCorpResult).toBeTruthy();

      // Search by city
      const cityResponse = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            city: 'Alpha City'
          }
        }
      );

      expect(cityResponse.status).toBe(200);
      const alphaCityResult = cityResponse.data.customers.find(c => 
        c.last_name === 'Alpha'
      );
      expect(alphaCityResult).toBeTruthy();
    });

    test('should support advanced filtering combinations', async () => {
      if (!authToken || searchTestCustomers.length === 0) {
        throw new Error('Authentication and search test customers required for this test');
      }

      // Filter by customer type and tier
      const businessSilverResponse = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            customer_type: 'BUSINESS',
            customer_tier: 'SILVER'
          }
        }
      );

      expect(businessSilverResponse.status).toBe(200);
      expect(businessSilverResponse.data.customers.every(c => 
        c.customer_type === 'BUSINESS' && c.customer_tier === 'SILVER'
      )).toBe(true);

      // Filter by credit limit range
      const creditLimitResponse = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            min_lifetime_value: 0,
            max_lifetime_value: 10000
          }
        }
      );

      expect(creditLimitResponse.status).toBe(200);
      expect(Array.isArray(creditLimitResponse.data.customers)).toBe(true);

      // Filter by state and active status
      const stateActiveResponse = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            state: 'AC',
            is_active: true
          }
        }
      );

      expect(stateActiveResponse.status).toBe(200);
      const acActiveCustomers = stateActiveResponse.data.customers.filter(c => c.last_name === 'Alpha');
      expect(acActiveCustomers.length).toBeGreaterThanOrEqual(1);
    });

    test('should support pagination with filtering', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      // Get first page with small limit
      const firstPageResponse = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            customer_type: 'INDIVIDUAL',
            skip: 0,
            limit: 2
          }
        }
      );

      expect(firstPageResponse.status).toBe(200);
      expect(firstPageResponse.data.customers.length).toBeLessThanOrEqual(2);
      expect(firstPageResponse.data.customers.every(c => c.customer_type === 'INDIVIDUAL')).toBe(true);

      // Get second page if available
      if (firstPageResponse.data.total_count > 2) {
        const secondPageResponse = await axios.get(
          `${API_BASE_URL}/customers/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              customer_type: 'INDIVIDUAL',
              skip: 2,
              limit: 2
            }
          }
        );

        expect(secondPageResponse.status).toBe(200);
        expect(secondPageResponse.data.customers.every(c => c.customer_type === 'INDIVIDUAL')).toBe(true);

        // Verify no duplicate customers between pages
        const firstPageIds = firstPageResponse.data.customers.map(c => c.id);
        const secondPageIds = secondPageResponse.data.customers.map(c => c.id);
        const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
        expect(overlap).toHaveLength(0);
      }
    });
  });

  describe('Customer Analytics Integration', () => {
    test('should retrieve customer analytics with real data', async () => {
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
      expect(response.data.total_customers).toBeGreaterThanOrEqual(response.data.active_customers);
      
      if (response.data.customer_breakdown) {
        expect(typeof response.data.customer_breakdown).toBe('object');
      }
    });

    test('should retrieve customer transaction history integration', async () => {
      if (!authToken || createdCustomerIds.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      const customerId = createdCustomerIds[0];
      
      const response = await axios.get(
        `${API_BASE_URL}/analytics/customers/${customerId}/transactions`,
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

  describe('Specialized Customer Retrieval Integration', () => {
    test('should retrieve customers by tier with proper filtering', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const tiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
      
      for (const tier of tiers) {
        const response = await axios.get(
          `${API_BASE_URL}/customers/tier/${tier}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              limit: 10
            }
          }
        );

        expect(response.status).toBe(200);
        expect(Array.isArray(response.data.customers)).toBe(true);
        
        if (response.data.customers.length > 0) {
          expect(response.data.customers.every(c => c.customer_tier === tier)).toBe(true);
        }
      }
    });

    test('should search customers by name with proper limits', async () => {
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
            name: 'Test',
            limit: 5
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeLessThanOrEqual(5);
      
      if (response.data.length > 0) {
        response.data.forEach(customer => {
          const hasTestInName = 
            customer.first_name?.toLowerCase().includes('test') ||
            customer.last_name?.toLowerCase().includes('test') ||
            customer.business_name?.toLowerCase().includes('test');
          expect(hasTestInName).toBe(true);
        });
      }
    });

    test('should handle blacklisted customers retrieval', async () => {
      if (!authToken || createdCustomerIds.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      // First blacklist a customer
      const customerId = createdCustomerIds[0];
      await axios.post(
        `${API_BASE_URL}/customers/${customerId}/blacklist`,
        { action: 'blacklist', reason: 'Integration test blacklist' },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Retrieve blacklisted customers
      const response = await axios.get(
        `${API_BASE_URL}/customers/blacklisted/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            limit: 10
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.customers)).toBe(true);
      
      if (response.data.customers.length > 0) {
        expect(response.data.customers.every(c => c.blacklist_status === 'BLACKLISTED')).toBe(true);
        
        const blacklistedCustomer = response.data.customers.find(c => c.id === customerId);
        expect(blacklistedCustomer).toBeTruthy();
      }

      // Clean up: unblacklist the customer
      await axios.post(
        `${API_BASE_URL}/customers/${customerId}/blacklist`,
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

  describe('Error Handling and Edge Cases Integration', () => {
    test('should handle authentication errors consistently', async () => {
      if (createdCustomerIds.length === 0) {
        throw new Error('Test customers required for this test');
      }

      const customerId = createdCustomerIds[0];
      const endpoints = [
        { method: 'GET', url: `${API_BASE_URL}/customers/${customerId}` },
        { method: 'PUT', url: `${API_BASE_URL}/customers/${customerId}`, data: { customer: { first_name: 'Test' } } },
        { method: 'DELETE', url: `${API_BASE_URL}/customers/${customerId}` },
        { method: 'GET', url: `${API_BASE_URL}/customers/` }
      ];

      for (const endpoint of endpoints) {
        try {
          const config = {
            method: endpoint.method.toLowerCase(),
            url: endpoint.url
          };
          
          if (endpoint.data) {
            config.data = endpoint.data;
          }

          await axios(config);
          
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error.response.status).toBe(401);
        }
      }
    });

    test('should handle validation errors consistently', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const invalidDataSets = [
        // Invalid customer type
        {
          customer: {
            customer_type: 'INVALID_TYPE',
            first_name: 'Test',
            last_name: 'User'
          },
          contact_methods: [],
          addresses: []
        },
        // Missing required fields for individual
        {
          customer: {
            customer_type: 'INDIVIDUAL',
            customer_tier: 'BRONZE'
          },
          contact_methods: [],
          addresses: []
        },
        // Invalid email format
        {
          customer: {
            customer_type: 'INDIVIDUAL',
            first_name: 'Test',
            last_name: 'User',
            customer_tier: 'BRONZE'
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'invalid-email',
              is_primary: true
            }
          ],
          addresses: []
        }
      ];

      for (const invalidData of invalidDataSets) {
        try {
          await axios.post(
            `${API_BASE_URL}/customers/`,
            invalidData,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error.response.status).toBe(422);
          expect(error.response.data.detail).toBeDefined();
        }
      }
    });

    test('should handle not found errors consistently', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const endpoints = [
        { method: 'GET', url: `${API_BASE_URL}/customers/${nonExistentId}` },
        { method: 'PUT', url: `${API_BASE_URL}/customers/${nonExistentId}`, data: { customer: { first_name: 'Test' } } },
        { method: 'DELETE', url: `${API_BASE_URL}/customers/${nonExistentId}` }
      ];

      for (const endpoint of endpoints) {
        try {
          const config = {
            method: endpoint.method.toLowerCase(),
            url: endpoint.url,
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          };
          
          if (endpoint.data) {
            config.data = endpoint.data;
          }

          await axios(config);
          
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error.response.status).toBe(404);
          expect(error.response.data.detail).toBe('Customer not found');
        }
      }
    });
  });

  describe('Performance and Concurrency Integration', () => {
    test('should handle concurrent customer operations', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      // Create multiple customers concurrently
      const customerDataList = Array.from({ length: 3 }, (_, index) => ({
        customer: {
          customer_type: 'INDIVIDUAL',
          first_name: `Concurrent${index}`,
          last_name: 'Test',
          customer_tier: 'BRONZE',
          credit_limit: 1000
        },
        contact_methods: [
          {
            contact_type: 'EMAIL',
            contact_value: `concurrent${index}@example.com`,
            is_primary: true,
            opt_in_marketing: true
          }
        ],
        addresses: [
          {
            address_type: 'BOTH',
            address_line1: `${index} Concurrent St`,
            city: 'Concurrent City',
            state: 'CC',
            country: 'USA',
            postal_code: '12345',
            is_default: true
          }
        ]
      }));

      const createPromises = customerDataList.map(data =>
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

      const createResponses = await Promise.all(createPromises);
      const concurrentCustomerIds = createResponses.map(response => response.data.id);
      createdCustomerIds.push(...concurrentCustomerIds);

      // Verify all customers were created successfully
      createResponses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.data.first_name).toBe(`Concurrent${index}`);
      });

      // Verify all customers have unique IDs
      const uniqueIds = new Set(concurrentCustomerIds);
      expect(uniqueIds.size).toBe(concurrentCustomerIds.length);

      // Perform concurrent reads
      const readPromises = concurrentCustomerIds.map(id =>
        axios.get(
          `${API_BASE_URL}/customers/${id}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        )
      );

      const readResponses = await Promise.all(readPromises);
      
      readResponses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.data.id).toBe(concurrentCustomerIds[index]);
        expect(response.data.first_name).toBe(`Concurrent${index}`);
      });
    });

    test('should maintain data consistency under concurrent updates', async () => {
      if (!authToken || createdCustomerIds.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      const customerId = createdCustomerIds[0];

      // Perform concurrent updates with different fields
      const updatePromises = [
        axios.put(
          `${API_BASE_URL}/customers/${customerId}/tier`,
          { customer_tier: 'GOLD' },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        axios.put(
          `${API_BASE_URL}/customers/${customerId}/credit-limit`,
          { credit_limit: 3000 },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
      ];

      const updateResults = await Promise.allSettled(updatePromises);
      
      // At least one should succeed
      const successfulUpdates = updateResults.filter(result => result.status === 'fulfilled');
      expect(successfulUpdates.length).toBeGreaterThan(0);

      // Verify final state is consistent
      const finalStateResponse = await axios.get(
        `${API_BASE_URL}/customers/${customerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(finalStateResponse.status).toBe(200);
      expect(finalStateResponse.data).toHaveProperty('customer_tier');
      expect(finalStateResponse.data).toHaveProperty('credit_limit');
    });
  });
});