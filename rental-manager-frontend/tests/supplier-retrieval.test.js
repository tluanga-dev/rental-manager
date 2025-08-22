/**
 * Supplier Retrieval Tests
 * Tests for retrieving supplier information using various endpoints and filters
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('Supplier Retrieval Tests', () => {
  let authToken = null;
  let testSuppliers = []; // Store multiple test suppliers for comprehensive testing

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

    // Create multiple test suppliers for retrieval testing
    if (authToken) {
      const supplierDataArray = [
        {
          supplier_code: `RETR1${Date.now()}`,
          company_name: 'Retrieval Test Manufacturing Corp',
          supplier_type: 'MANUFACTURER',
          contact_person: 'John Manufacturing',
          email: 'john@retrieval-mfg.com',
          phone: '+1-555-0001',
          address: '123 Manufacturing Ave, Test City, TC 12345',
          payment_terms: 'NET30',
          credit_limit: 50000.00,
          supplier_tier: 'PREFERRED'
        },
        {
          supplier_code: `RETR2${Date.now()}`,
          company_name: 'Retrieval Test Distribution Co',
          supplier_type: 'DISTRIBUTOR',
          contact_person: 'Jane Distribution',
          email: 'jane@retrieval-dist.com',
          phone: '+1-555-0002',
          address: '456 Distribution Blvd, Test City, TC 67890',
          payment_terms: 'NET45',
          credit_limit: 25000.00,
          supplier_tier: 'STANDARD'
        },
        {
          supplier_code: `RETR3${Date.now()}`,
          company_name: 'Retrieval Test Service Provider',
          supplier_type: 'SERVICE_PROVIDER',
          contact_person: 'Mike Service',
          email: 'mike@retrieval-service.com',
          phone: '+1-555-0003',
          payment_terms: 'NET15',
          credit_limit: 10000.00,
          supplier_tier: 'RESTRICTED'
        },
        {
          supplier_code: `RETR4${Date.now()}`,
          company_name: 'Retrieval Test Wholesale House',
          supplier_type: 'WHOLESALER',
          contact_person: 'Sarah Wholesale',
          email: 'sarah@retrieval-wholesale.com',
          phone: '+1-555-0004',
          payment_terms: 'COD',
          credit_limit: 75000.00,
          supplier_tier: 'PREFERRED'
        },
        {
          supplier_code: `RETR5${Date.now()}`,
          company_name: 'Retrieval Test Retail Partner',
          supplier_type: 'RETAILER',
          contact_person: 'Tom Retail',
          email: 'tom@retrieval-retail.com',
          phone: '+1-555-0005',
          payment_terms: 'PREPAID',
          credit_limit: 5000.00,
          supplier_tier: 'STANDARD'
        }
      ];

      try {
        const createPromises = supplierDataArray.map(supplierData =>
          axios.post(
            `${API_BASE_URL}/suppliers/`,
            supplierData,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          )
        );

        const responses = await Promise.all(createPromises);
        testSuppliers = responses.map((response, index) => ({
          ...response.data,
          originalData: supplierDataArray[index]
        }));
      } catch (error) {
        console.error('Failed to create test suppliers:', error.response?.data || error.message);
      }
    }
  });

  afterAll(async () => {
    // Clean up test suppliers
    if (authToken && testSuppliers.length > 0) {
      const deletePromises = testSuppliers.map(supplier =>
        axios.delete(
          `${API_BASE_URL}/suppliers/${supplier.id}`,
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

  describe('Get Supplier by ID', () => {
    test('should retrieve supplier by valid ID', async () => {
      if (!authToken || testSuppliers.length === 0) {
        throw new Error('Authentication and test suppliers required for this test');
      }

      const testSupplier = testSuppliers[0];
      const response = await axios.get(
        `${API_BASE_URL}/suppliers/${testSupplier.id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(testSupplier.id);
      expect(response.data.company_name).toBe(testSupplier.company_name);
      expect(response.data.supplier_type).toBe(testSupplier.supplier_type);
      expect(response.data.contact_person).toBe(testSupplier.contact_person);
      expect(response.data.email).toBe(testSupplier.email);
    });

    test('should return 404 for non-existent supplier ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

      try {
        await axios.get(
          `${API_BASE_URL}/suppliers/${nonExistentId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.detail).toContain('not found');
      }
    });

    test('should return 400 for malformed supplier ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const malformedId = 'invalid-uuid';

      try {
        await axios.get(
          `${API_BASE_URL}/suppliers/${malformedId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });

    test('should require authentication for get by ID', async () => {
      if (testSuppliers.length === 0) {
        throw new Error('Test suppliers required for this test');
      }

      const testSupplier = testSuppliers[0];

      try {
        await axios.get(`${API_BASE_URL}/suppliers/${testSupplier.id}`);
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Get Supplier by Code', () => {
    test('should retrieve supplier by valid code', async () => {
      if (!authToken || testSuppliers.length === 0) {
        throw new Error('Authentication and test suppliers required for this test');
      }

      const testSupplier = testSuppliers[0];
      const response = await axios.get(
        `${API_BASE_URL}/suppliers/code/${testSupplier.supplier_code}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(testSupplier.id);
      expect(response.data.supplier_code).toBe(testSupplier.supplier_code);
      expect(response.data.company_name).toBe(testSupplier.company_name);
    });

    test('should return 404 for non-existent supplier code', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentCode = 'NONEXIST999';

      try {
        await axios.get(
          `${API_BASE_URL}/suppliers/code/${nonExistentCode}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.detail).toContain('not found');
      }
    });

    test('should handle case-insensitive supplier code lookup', async () => {
      if (!authToken || testSuppliers.length === 0) {
        throw new Error('Authentication and test suppliers required for this test');
      }

      const testSupplier = testSuppliers[0];
      const lowercaseCode = testSupplier.supplier_code.toLowerCase();

      try {
        const response = await axios.get(
          `${API_BASE_URL}/suppliers/code/${lowercaseCode}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(testSupplier.id);
      } catch (error) {
        // If case-insensitive lookup is not supported, expect 404
        expect(error.response.status).toBe(404);
      }
    });
  });

  describe('List Suppliers with Pagination', () => {
    test('should list suppliers with default pagination', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('items');
      expect(response.data).toHaveProperty('total');
      expect(response.data).toHaveProperty('skip');
      expect(response.data).toHaveProperty('limit');
      expect(Array.isArray(response.data.items)).toBe(true);
      expect(response.data.total).toBeGreaterThanOrEqual(testSuppliers.length);
    });

    test('should list suppliers with custom pagination', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
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

      expect(response.status).toBe(200);
      expect(response.data.items.length).toBeLessThanOrEqual(2);
      expect(response.data.skip).toBe(0);
      expect(response.data.limit).toBe(2);
    });

    test('should handle skip parameter correctly', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      // Get first page
      const firstPageResponse = await axios.get(
        `${API_BASE_URL}/suppliers/`,
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

      // Get second page
      const secondPageResponse = await axios.get(
        `${API_BASE_URL}/suppliers/`,
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

      expect(firstPageResponse.status).toBe(200);
      expect(secondPageResponse.status).toBe(200);
      
      // Verify different items on different pages (if there are enough suppliers)
      if (firstPageResponse.data.total > 2) {
        const firstPageIds = firstPageResponse.data.items.map(item => item.id);
        const secondPageIds = secondPageResponse.data.items.map(item => item.id);
        
        // Should have no overlapping IDs
        const intersection = firstPageIds.filter(id => secondPageIds.includes(id));
        expect(intersection.length).toBe(0);
      }
    });
  });

  describe('List Suppliers with Filters', () => {
    test('should filter suppliers by supplier type', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            supplier_type: 'MANUFACTURER'
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(supplier => {
        expect(supplier.supplier_type).toBe('MANUFACTURER');
      });
    });

    test('should filter suppliers by supplier tier', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            supplier_tier: 'PREFERRED'
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(supplier => {
        expect(supplier.supplier_tier).toBe('PREFERRED');
      });
    });

    test('should filter suppliers by payment terms', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            payment_terms: 'NET30'
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(supplier => {
        expect(supplier.payment_terms).toBe('NET30');
      });
    });

    test('should filter suppliers by active status', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
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
      response.data.items.forEach(supplier => {
        expect(supplier.is_active).toBe(true);
      });
    });

    test('should combine multiple filters', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            supplier_type: 'MANUFACTURER',
            supplier_tier: 'PREFERRED',
            is_active: true
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(supplier => {
        expect(supplier.supplier_type).toBe('MANUFACTURER');
        expect(supplier.supplier_tier).toBe('PREFERRED');
        expect(supplier.is_active).toBe(true);
      });
    });
  });

  describe('Search Suppliers', () => {
    test('should search suppliers by company name', async () => {
      if (!authToken || testSuppliers.length === 0) {
        throw new Error('Authentication and test suppliers required for this test');
      }

      const searchTerm = 'Retrieval Test';
      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: searchTerm
          }
        }
      );

      expect(response.status).toBe(200);
      // All our test suppliers should match this search term
      const matchingSuppliers = response.data.items.filter(supplier =>
        supplier.company_name.includes(searchTerm)
      );
      expect(matchingSuppliers.length).toBeGreaterThan(0);
    });

    test('should search suppliers by contact person', async () => {
      if (!authToken || testSuppliers.length === 0) {
        throw new Error('Authentication and test suppliers required for this test');
      }

      const searchTerm = 'John Manufacturing';
      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: searchTerm
          }
        }
      );

      expect(response.status).toBe(200);
      // Should find at least one supplier with this contact person
      const matchingSuppliers = response.data.items.filter(supplier =>
        supplier.contact_person && supplier.contact_person.includes('John Manufacturing')
      );
      expect(matchingSuppliers.length).toBeGreaterThan(0);
    });

    test('should search suppliers by supplier code', async () => {
      if (!authToken || testSuppliers.length === 0) {
        throw new Error('Authentication and test suppliers required for this test');
      }

      const testSupplier = testSuppliers[0];
      const searchTerm = testSupplier.supplier_code.substring(0, 5); // Partial code search

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: searchTerm
          }
        }
      );

      expect(response.status).toBe(200);
      // Should find suppliers matching the partial code
      const matchingSuppliers = response.data.items.filter(supplier =>
        supplier.supplier_code.includes(searchTerm)
      );
      expect(matchingSuppliers.length).toBeGreaterThan(0);
    });

    test('should return empty results for non-matching search', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonMatchingSearch = 'ZZZ_NONEXISTENT_SEARCH_TERM_XYZ';
      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: nonMatchingSearch
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.items.length).toBe(0);
    });
  });

  describe('Specialized Supplier Endpoints', () => {
    test('should search suppliers by name using search endpoint', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const searchName = 'Test';
      const response = await axios.get(
        `${API_BASE_URL}/suppliers/search/name`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            name: searchName,
            limit: 10
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeLessThanOrEqual(10);
      
      // All returned suppliers should have the search term in their name
      response.data.forEach(supplier => {
        expect(supplier.company_name.toLowerCase()).toContain(searchName.toLowerCase());
      });
    });

    test('should get suppliers by tier using tier endpoint', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const tier = 'PREFERRED';
      const response = await axios.get(
        `${API_BASE_URL}/suppliers/tier/${tier}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            skip: 0,
            limit: 50
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('items');
      expect(response.data).toHaveProperty('total');
      
      response.data.items.forEach(supplier => {
        expect(supplier.supplier_tier).toBe(tier);
      });
    });

    test('should get top suppliers by spend', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/top/by-spend`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            limit: 5
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeLessThanOrEqual(5);
      
      // Verify ordering by spend (if there are suppliers with spend data)
      if (response.data.length > 1) {
        for (let i = 1; i < response.data.length; i++) {
          const currentSpend = parseFloat(response.data[i].total_spend || '0');
          const previousSpend = parseFloat(response.data[i-1].total_spend || '0');
          expect(currentSpend).toBeLessThanOrEqual(previousSpend);
        }
      }
    });
  });

  describe('Retrieval Error Handling', () => {
    test('should handle invalid supplier type filter', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      try {
        await axios.get(
          `${API_BASE_URL}/suppliers/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              supplier_type: 'INVALID_TYPE'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });

    test('should handle invalid supplier tier filter', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      try {
        await axios.get(
          `${API_BASE_URL}/suppliers/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              supplier_tier: 'INVALID_TIER'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });

    test('should handle invalid payment terms filter', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      try {
        await axios.get(
          `${API_BASE_URL}/suppliers/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              payment_terms: 'INVALID_TERMS'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });

    test('should handle negative skip parameter', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      try {
        await axios.get(
          `${API_BASE_URL}/suppliers/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              skip: -1
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });

    test('should handle limit parameter exceeding maximum', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      try {
        await axios.get(
          `${API_BASE_URL}/suppliers/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              limit: 2000 // Exceeds typical max of 1000
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });

    test('should handle search term too short', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      try {
        await axios.get(
          `${API_BASE_URL}/suppliers/search/name`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              name: 'A' // Too short (min 2 characters)
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });
  });

  describe('Retrieval Performance', () => {
    test('should retrieve supplier by ID within reasonable time', async () => {
      if (!authToken || testSuppliers.length === 0) {
        throw new Error('Authentication and test suppliers required for this test');
      }

      const testSupplier = testSuppliers[0];
      const startTime = Date.now();

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/${testSupplier.id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    test('should list suppliers within reasonable time', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const startTime = Date.now();

      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
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
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test('should handle concurrent retrieval requests', async () => {
      if (!authToken || testSuppliers.length < 2) {
        throw new Error('Authentication and multiple test suppliers required for this test');
      }

      const promises = [
        axios.get(`${API_BASE_URL}/suppliers/${testSuppliers[0].id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        axios.get(`${API_BASE_URL}/suppliers/${testSuppliers[1].id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { limit: 10 }
        })
      ];

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify individual responses
      expect(responses[0].data.id).toBe(testSuppliers[0].id);
      expect(responses[1].data.id).toBe(testSuppliers[1].id);
      expect(responses[2].data).toHaveProperty('items');
    });
  });
});