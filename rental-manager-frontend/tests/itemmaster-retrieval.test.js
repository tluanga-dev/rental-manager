/**
 * ItemMaster Retrieval Tests
 * Tests for retrieving item master information using various endpoints and filters
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('ItemMaster Retrieval Tests', () => {
  let authToken = null;
  let testItemMasters = []; // Store multiple test item masters for comprehensive testing
  let testCategoryId = null;
  let testBrandId = null;

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

    // Create test category and brand, then create multiple test item masters for retrieval testing
    if (authToken) {
      try {
        // Create test category
        const categoryResponse = await axios.post(
          `${API_BASE_URL}/categories/`,
          {
            category_name: 'Retrieval Test Electronics',
            description: 'Test category for retrieval tests',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        testCategoryId = categoryResponse.data.id;

        // Create test brand
        const brandResponse = await axios.post(
          `${API_BASE_URL}/brands/`,
          {
            brand_name: 'Retrieval Test Tech Brand',
            description: 'Test brand for retrieval tests',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        testBrandId = brandResponse.data.id;

        // Create multiple test item masters with different characteristics
        const itemDataArray = [
          {
            item_code: `RETR1${Date.now()}`,
            item_name: 'Retrieval Test Laptop Computer',
            item_type: 'PRODUCT',
            category_id: testCategoryId,
            brand_id: testBrandId,
            description: 'High-performance laptop for business use',
            is_serialized: true,
            specifications: {
              processor: 'Intel i7',
              ram: '16GB',
              storage: '512GB SSD'
            }
          },
          {
            item_code: `RETR2${Date.now()}`,
            item_name: 'Retrieval Test Maintenance Service',
            item_type: 'SERVICE',
            category_id: testCategoryId,
            description: 'Professional equipment maintenance service',
            is_serialized: false
          },
          {
            item_code: `RETR3${Date.now()}`,
            item_name: 'Retrieval Test Office Bundle',
            item_type: 'BUNDLE',
            category_id: testCategoryId,
            brand_id: testBrandId,
            description: 'Complete office equipment bundle',
            is_serialized: false,
            specifications: {
              items_included: 'Laptop, Monitor, Keyboard, Mouse',
              warranty: '1 year'
            }
          },
          {
            item_code: `RETR4${Date.now()}`,
            item_name: 'Retrieval Test Desktop Workstation',
            item_type: 'PRODUCT',
            category_id: testCategoryId,
            brand_id: testBrandId,
            description: 'Professional desktop workstation',
            is_serialized: true,
            specifications: {
              processor: 'Intel i9',
              ram: '32GB',
              storage: '1TB NVMe'
            }
          },
          {
            item_code: `RETR5${Date.now()}`,
            item_name: 'Retrieval Test Installation Service',
            item_type: 'SERVICE',
            category_id: testCategoryId,
            description: 'Professional equipment installation service',
            is_serialized: false
          }
        ];

        const createPromises = itemDataArray.map(itemData =>
          axios.post(
            `${API_BASE_URL}/item-masters/`,
            itemData,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          )
        );

        const responses = await Promise.all(createPromises);
        testItemMasters = responses.map((response, index) => ({
          ...response.data,
          originalData: itemDataArray[index]
        }));
      } catch (error) {
        console.error('Failed to create test item masters:', error.response?.data || error.message);
      }
    }
  });

  afterAll(async () => {
    // Clean up test item masters, category, and brand
    if (authToken) {
      try {
        if (testItemMasters.length > 0) {
          const deletePromises = testItemMasters.map(item =>
            axios.delete(`${API_BASE_URL}/item-masters/${item.id}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            }).catch(() => {}) // Ignore cleanup errors
          );
          await Promise.all(deletePromises);
        }

        if (testCategoryId) {
          await axios.delete(`${API_BASE_URL}/categories/${testCategoryId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
        }

        if (testBrandId) {
          await axios.delete(`${API_BASE_URL}/brands/${testBrandId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Get ItemMaster by ID', () => {
    test('should retrieve item master by valid ID', async () => {
      if (!authToken || testItemMasters.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const testItem = testItemMasters[0];
      const response = await axios.get(
        `${API_BASE_URL}/item-masters/${testItem.id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(testItem.id);
      expect(response.data.item_name).toBe(testItem.item_name);
      expect(response.data.item_type).toBe(testItem.item_type);
      expect(response.data.item_code).toBe(testItem.item_code);
      expect(response.data.category_id).toBe(testItem.category_id);
    });

    test('should return 404 for non-existent item master ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

      try {
        await axios.get(
          `${API_BASE_URL}/item-masters/${nonExistentId}`,
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

    test('should return 400 for malformed item master ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const malformedId = 'invalid-uuid';

      try {
        await axios.get(
          `${API_BASE_URL}/item-masters/${malformedId}`,
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
      if (testItemMasters.length === 0) {
        throw new Error('Test item masters required for this test');
      }

      const testItem = testItemMasters[0];

      try {
        await axios.get(`${API_BASE_URL}/item-masters/${testItem.id}`);
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Get ItemMaster by Code', () => {
    test('should retrieve item master by valid code', async () => {
      if (!authToken || testItemMasters.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const testItem = testItemMasters[0];
      const response = await axios.get(
        `${API_BASE_URL}/item-masters/code/${testItem.item_code}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(testItem.id);
      expect(response.data.item_code).toBe(testItem.item_code);
      expect(response.data.item_name).toBe(testItem.item_name);
    });

    test('should return 404 for non-existent item master code', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentCode = 'NONEXIST999';

      try {
        await axios.get(
          `${API_BASE_URL}/item-masters/code/${nonExistentCode}`,
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

    test('should handle case-insensitive item code lookup', async () => {
      if (!authToken || testItemMasters.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const testItem = testItemMasters[0];
      const lowercaseCode = testItem.item_code.toLowerCase();

      try {
        const response = await axios.get(
          `${API_BASE_URL}/item-masters/code/${lowercaseCode}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(testItem.id);
      } catch (error) {
        // If case-insensitive lookup is not supported, expect 404
        expect(error.response.status).toBe(404);
      }
    });
  });

  describe('List ItemMasters with Pagination', () => {
    test('should list item masters with default pagination', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
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
      expect(response.data.total).toBeGreaterThanOrEqual(testItemMasters.length);
    });

    test('should list item masters with custom pagination', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
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
        `${API_BASE_URL}/item-masters/`,
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
        `${API_BASE_URL}/item-masters/`,
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
      
      // Verify different items on different pages (if there are enough item masters)
      if (firstPageResponse.data.total > 2) {
        const firstPageIds = firstPageResponse.data.items.map(item => item.id);
        const secondPageIds = secondPageResponse.data.items.map(item => item.id);
        
        // Should have no overlapping IDs
        const intersection = firstPageIds.filter(id => secondPageIds.includes(id));
        expect(intersection.length).toBe(0);
      }
    });
  });

  describe('List ItemMasters with Filters', () => {
    test('should filter item masters by item type', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            item_type: 'PRODUCT'
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(item => {
        expect(item.item_type).toBe('PRODUCT');
      });
    });

    test('should filter item masters by category', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            category_id: testCategoryId
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(item => {
        expect(item.category_id).toBe(testCategoryId);
      });
    });

    test('should filter item masters by brand', async () => {
      if (!authToken || !testBrandId) {
        throw new Error('Authentication and test brand required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            brand_id: testBrandId
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(item => {
        expect(item.brand_id).toBe(testBrandId);
      });
    });

    test('should filter item masters by serialization status', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            is_serialized: true
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(item => {
        expect(item.is_serialized).toBe(true);
      });
    });

    test('should filter item masters by active status', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
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
      response.data.items.forEach(item => {
        expect(item.is_active).toBe(true);
      });
    });

    test('should combine multiple filters', async () => {
      if (!authToken || !testCategoryId || !testBrandId) {
        throw new Error('Authentication, test category, and test brand required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            item_type: 'PRODUCT',
            category_id: testCategoryId,
            brand_id: testBrandId,
            is_active: true
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(item => {
        expect(item.item_type).toBe('PRODUCT');
        expect(item.category_id).toBe(testCategoryId);
        expect(item.brand_id).toBe(testBrandId);
        expect(item.is_active).toBe(true);
      });
    });
  });

  describe('Search ItemMasters', () => {
    test('should search item masters by item name', async () => {
      if (!authToken || testItemMasters.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const searchTerm = 'Retrieval Test';
      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
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
      // All our test item masters should match this search term
      const matchingItems = response.data.items.filter(item =>
        item.item_name.includes(searchTerm)
      );
      expect(matchingItems.length).toBeGreaterThan(0);
    });

    test('should search item masters by description', async () => {
      if (!authToken || testItemMasters.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const searchTerm = 'Professional';
      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
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
      // Should find item masters with "Professional" in description
      const matchingItems = response.data.items.filter(item =>
        item.description && item.description.includes(searchTerm)
      );
      expect(matchingItems.length).toBeGreaterThan(0);
    });

    test('should search item masters by item code', async () => {
      if (!authToken || testItemMasters.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const testItem = testItemMasters[0];
      const searchTerm = testItem.item_code.substring(0, 5); // Partial code search

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
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
      // Should find item masters matching the partial code
      const matchingItems = response.data.items.filter(item =>
        item.item_code.includes(searchTerm)
      );
      expect(matchingItems.length).toBeGreaterThan(0);
    });

    test('should return empty results for non-matching search', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonMatchingSearch = 'ZZZ_NONEXISTENT_SEARCH_TERM_XYZ';
      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
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

    test('should combine search with filters', async () => {
      if (!authToken || testItemMasters.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const searchTerm = 'Test';
      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: searchTerm,
            item_type: 'PRODUCT',
            is_active: true
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(item => {
        expect(item.item_type).toBe('PRODUCT');
        expect(item.is_active).toBe(true);
        expect(
          item.item_name.includes(searchTerm) ||
          (item.description && item.description.includes(searchTerm)) ||
          item.item_code.includes(searchTerm)
        ).toBe(true);
      });
    });
  });

  describe('Advanced Filtering and Retrieval', () => {
    test('should retrieve only serialized items', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            is_serialized: true
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(item => {
        expect(item.is_serialized).toBe(true);
        expect(item.item_type).toBe('PRODUCT'); // Only products can be serialized
      });
    });

    test('should retrieve only non-serialized items', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            is_serialized: false
          }
        }
      );

      expect(response.status).toBe(200);
      response.data.items.forEach(item => {
        expect(item.is_serialized).toBe(false);
      });
    });

    test('should retrieve items by specific item types', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const itemTypes = ['PRODUCT', 'SERVICE', 'BUNDLE'];
      
      for (const itemType of itemTypes) {
        const response = await axios.get(
          `${API_BASE_URL}/item-masters/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              item_type: itemType
            }
          }
        );

        expect(response.status).toBe(200);
        response.data.items.forEach(item => {
          expect(item.item_type).toBe(itemType);
        });
      }
    });

    test('should handle empty category filter gracefully', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentCategoryId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            category_id: nonExistentCategoryId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.items.length).toBe(0);
    });
  });

  describe('Retrieval Error Handling', () => {
    test('should handle invalid item type filter', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      try {
        await axios.get(
          `${API_BASE_URL}/item-masters/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              item_type: 'INVALID_TYPE'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });

    test('should handle invalid category ID filter', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      try {
        await axios.get(
          `${API_BASE_URL}/item-masters/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              category_id: 'invalid-uuid'
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
          `${API_BASE_URL}/item-masters/`,
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
          `${API_BASE_URL}/item-masters/`,
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
  });

  describe('Retrieval Performance', () => {
    test('should retrieve item master by ID within reasonable time', async () => {
      if (!authToken || testItemMasters.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const testItem = testItemMasters[0];
      const startTime = Date.now();

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/${testItem.id}`,
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

    test('should list item masters within reasonable time', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const startTime = Date.now();

      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
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
      if (!authToken || testItemMasters.length < 2) {
        throw new Error('Authentication and multiple test item masters required for this test');
      }

      const promises = [
        axios.get(`${API_BASE_URL}/item-masters/${testItemMasters[0].id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        axios.get(`${API_BASE_URL}/item-masters/${testItemMasters[1].id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { limit: 10 }
        })
      ];

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify individual responses
      expect(responses[0].data.id).toBe(testItemMasters[0].id);
      expect(responses[1].data.id).toBe(testItemMasters[1].id);
      expect(responses[2].data).toHaveProperty('items');
    });
  });

  describe('Data Integrity and Consistency', () => {
    test('should return consistent data format across different retrieval methods', async () => {
      if (!authToken || testItemMasters.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const testItem = testItemMasters[0];

      // Get by ID
      const getByIdResponse = await axios.get(
        `${API_BASE_URL}/item-masters/${testItem.id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Get by code
      const getByCodeResponse = await axios.get(
        `${API_BASE_URL}/item-masters/code/${testItem.item_code}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Get from list
      const listResponse = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            search: testItem.item_code
          }
        }
      );

      const itemFromList = listResponse.data.items.find(item => item.id === testItem.id);

      // All three should return the same data
      expect(getByIdResponse.data.id).toBe(getByCodeResponse.data.id);
      expect(getByIdResponse.data.id).toBe(itemFromList.id);
      expect(getByIdResponse.data.item_name).toBe(getByCodeResponse.data.item_name);
      expect(getByIdResponse.data.item_name).toBe(itemFromList.item_name);
    });

    test('should include all expected fields in retrieval response', async () => {
      if (!authToken || testItemMasters.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const testItem = testItemMasters[0];
      const response = await axios.get(
        `${API_BASE_URL}/item-masters/${testItem.id}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      
      // Verify all expected fields are present
      const requiredFields = ['id', 'item_code', 'item_name', 'item_type', 'category_id', 'is_serialized', 'is_active'];
      requiredFields.forEach(field => {
        expect(response.data).toHaveProperty(field);
      });

      // Verify optional fields when present
      if (testItem.brand_id) {
        expect(response.data).toHaveProperty('brand_id');
      }
      if (testItem.description) {
        expect(response.data).toHaveProperty('description');
      }
      if (testItem.specifications) {
        expect(response.data).toHaveProperty('specifications');
      }
    });
  });
});