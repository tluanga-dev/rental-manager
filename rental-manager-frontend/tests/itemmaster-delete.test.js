/**
 * ItemMaster Deletion Tests
 * Tests for soft deleting item masters and related functionality
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('ItemMaster Deletion Tests', () => {
  let authToken = null;
  let testItemMasterId = null;
  let testCategoryId = null;

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

    // Create a test category and item master for deletion tests
    if (authToken) {
      try {
        // Create test category
        const categoryResponse = await axios.post(
          `${API_BASE_URL}/categories/`,
          {
            category_name: 'Delete Test Category',
            description: 'Test category for deletion tests',
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

        // Create test item master
        const itemData = {
          item_code: `DEL${Date.now()}`,
          item_name: 'Delete Test Item Master',
          item_type: 'PRODUCT',
          category_id: testCategoryId,
          description: 'Test item master for deletion tests',
          is_serialized: true
        };

        const itemResponse = await axios.post(
          `${API_BASE_URL}/item-masters/`,
          itemData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        testItemMasterId = itemResponse.data.id;
      } catch (error) {
        console.error('Failed to create test item master:', error.response?.data || error.message);
      }
    }
  });

  afterAll(async () => {
    // Clean up any remaining test data
    if (authToken) {
      try {
        if (testItemMasterId) {
          await axios.delete(`${API_BASE_URL}/item-masters/${testItemMasterId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
        }
        if (testCategoryId) {
          await axios.delete(`${API_BASE_URL}/categories/${testCategoryId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Soft Delete Functionality', () => {
    test('should soft delete an item master successfully', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const response = await axios.delete(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(204);
    });

    test('should mark item master as inactive after soft delete', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      // Create a new item master for this test
      const itemData = {
        item_code: `DELTEST${Date.now()}`,
        item_name: 'Soft Delete Test Item',
        item_type: 'PRODUCT',
        category_id: testCategoryId
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/item-masters/`,
        itemData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const itemId = createResponse.data.id;

      try {
        // Soft delete the item master
        await axios.delete(
          `${API_BASE_URL}/item-masters/${itemId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        // Retrieve the item master to verify it's marked as inactive
        const response = await axios.get(
          `${API_BASE_URL}/item-masters/${itemId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.is_active).toBe(false);
      } finally {
        // Cleanup is handled by soft delete
      }
    });

    test('should exclude soft deleted item masters from regular listing', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      // Create and delete an item master
      const itemData = {
        item_code: `EXCLUDE${Date.now()}`,
        item_name: 'Exclude Test Item',
        item_type: 'PRODUCT',
        category_id: testCategoryId
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/item-masters/`,
        itemData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const itemId = createResponse.data.id;

      // Soft delete the item master
      await axios.delete(
        `${API_BASE_URL}/item-masters/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Get item master list with default parameters (should exclude deleted items)
      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      const deletedItem = response.data.items.find(item => item.id === itemId);
      expect(deletedItem).toBeUndefined();
    });

    test('should include soft deleted item masters when specifically requested', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      // Create and delete an item master
      const itemData = {
        item_code: `INCLUDE${Date.now()}`,
        item_name: 'Include Test Item',
        item_type: 'PRODUCT',
        category_id: testCategoryId
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/item-masters/`,
        itemData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const itemId = createResponse.data.id;

      // Soft delete the item master
      await axios.delete(
        `${API_BASE_URL}/item-masters/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Get item master list including inactive items
      const response = await axios.get(
        `${API_BASE_URL}/item-masters/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          params: {
            is_active: false
          }
        }
      );

      expect(response.status).toBe(200);
      const deletedItem = response.data.items.find(item => item.id === itemId);
      expect(deletedItem).toBeDefined();
      expect(deletedItem.is_active).toBe(false);
    });
  });

  describe('Delete Permission and Authorization', () => {
    test('should require authentication for deletion', async () => {
      if (!testItemMasterId) {
        throw new Error('Test item master required for this test');
      }

      try {
        await axios.delete(`${API_BASE_URL}/item-masters/${testItemMasterId}`);
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should require valid item master ID for deletion', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

      try {
        await axios.delete(
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
      }
    });

    test('should handle malformed item master ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const malformedId = 'invalid-id';

      try {
        await axios.delete(
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
  });

  describe('Business Rules for Deletion', () => {
    test('should prevent deletion of item master with active SKUs', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      let itemId = null;
      let skuId = null;

      try {
        // Create item master
        const itemData = {
          item_code: `SKUTEST${Date.now()}`,
          item_name: 'Item Master with SKU',
          item_type: 'PRODUCT',
          category_id: testCategoryId
        };

        const itemResponse = await axios.post(
          `${API_BASE_URL}/item-masters/`,
          itemData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        itemId = itemResponse.data.id;

        // Create SKU for this item master
        const skuData = {
          sku_code: `SKU${Date.now()}`,
          sku_name: 'Test SKU',
          item_id: itemId,
          is_rentable: true,
          is_saleable: false,
          min_rental_days: 1,
          rental_base_price: 100.00
        };

        const skuResponse = await axios.post(
          `${API_BASE_URL}/skus/`,
          skuData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        skuId = skuResponse.data.id;

        // Try to delete item master with active SKU
        try {
          await axios.delete(
            `${API_BASE_URL}/item-masters/${itemId}`,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            }
          );
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect([400, 409]).toContain(error.response.status);
          expect(error.response.data.detail).toContain('SKU');
        }

      } finally {
        // Clean up SKU first, then item master
        if (skuId) {
          try {
            await axios.delete(`${API_BASE_URL}/skus/${skuId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
        if (itemId) {
          try {
            await axios.delete(`${API_BASE_URL}/item-masters/${itemId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    });

    test('should allow deletion of item master after SKUs are deleted', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      let itemId = null;
      let skuId = null;

      try {
        // Create item master
        const itemData = {
          item_code: `ALLOWED${Date.now()}`,
          item_name: 'Item Master Deletion Allowed',
          item_type: 'PRODUCT',
          category_id: testCategoryId
        };

        const itemResponse = await axios.post(
          `${API_BASE_URL}/item-masters/`,
          itemData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        itemId = itemResponse.data.id;

        // Create and delete SKU
        const skuData = {
          sku_code: `SKUDEL${Date.now()}`,
          sku_name: 'SKU to be deleted',
          item_id: itemId,
          is_rentable: true,
          is_saleable: false,
          min_rental_days: 1,
          rental_base_price: 100.00
        };

        const skuResponse = await axios.post(
          `${API_BASE_URL}/skus/`,
          skuData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        skuId = skuResponse.data.id;

        // Delete the SKU first
        await axios.delete(`${API_BASE_URL}/skus/${skuId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // Now item master deletion should succeed
        const deleteResponse = await axios.delete(
          `${API_BASE_URL}/item-masters/${itemId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(deleteResponse.status).toBe(204);

      } finally {
        // Cleanup handled by test logic
      }
    });

    test('should preserve item master relationships after soft deletion', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      // Create item master
      const itemData = {
        item_code: `PRESERVE${Date.now()}`,
        item_name: 'Preserve Relationships Test',
        item_type: 'PRODUCT',
        category_id: testCategoryId,
        description: 'Test item for relationship preservation'
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/item-masters/`,
        itemData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const itemId = createResponse.data.id;

      // Soft delete the item master
      await axios.delete(
        `${API_BASE_URL}/item-masters/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Verify item master can still be retrieved (showing soft delete preserves data)
      const response = await axios.get(
        `${API_BASE_URL}/item-masters/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(itemId);
      expect(response.data.is_active).toBe(false);
      expect(response.data.category_id).toBe(testCategoryId);
      expect(response.data.description).toBe('Test item for relationship preservation');
    });
  });

  describe('Bulk Deletion Operations', () => {
    let bulkTestItemIds = [];

    beforeEach(async () => {
      if (!authToken || !testCategoryId) return;

      // Create multiple test item masters for bulk operations
      const itemPromises = [];
      for (let i = 0; i < 3; i++) {
        const itemData = {
          item_code: `BULK${Date.now()}${i}${Math.random().toString(36).substr(2, 3)}`,
          item_name: `Bulk Test Item Master ${i}`,
          item_type: 'PRODUCT',
          category_id: testCategoryId,
          description: `Bulk test item ${i}`
        };

        itemPromises.push(
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
      }

      try {
        const responses = await Promise.all(itemPromises);
        bulkTestItemIds = responses.map(response => response.data.id);
      } catch (error) {
        console.error('Failed to create bulk test item masters:', error.response?.data || error.message);
      }
    });

    afterEach(async () => {
      if (authToken && bulkTestItemIds.length > 0) {
        // Clean up bulk test item masters
        const deletePromises = bulkTestItemIds.map(id =>
          axios.delete(
            `${API_BASE_URL}/item-masters/${id}`,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            }
          ).catch(() => {}) // Ignore cleanup errors
        );

        await Promise.all(deletePromises);
        bulkTestItemIds = [];
      }
    });

    test('should handle multiple individual deletions', async () => {
      if (!authToken || bulkTestItemIds.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      // Delete each item master individually
      const deletePromises = bulkTestItemIds.map(id =>
        axios.delete(
          `${API_BASE_URL}/item-masters/${id}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        )
      );

      const responses = await Promise.all(deletePromises);

      responses.forEach(response => {
        expect(response.status).toBe(204);
      });
    });

    test('should handle deletion of already deleted item master', async () => {
      if (!authToken || bulkTestItemIds.length === 0) {
        throw new Error('Authentication and test item masters required for this test');
      }

      const itemId = bulkTestItemIds[0];

      // Delete the item master first time
      const firstResponse = await axios.delete(
        `${API_BASE_URL}/item-masters/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(firstResponse.status).toBe(204);

      // Try to delete the same item master again
      try {
        await axios.delete(
          `${API_BASE_URL}/item-masters/${itemId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        // Some implementations might succeed with idempotent behavior
        // or fail with a specific error - both are valid
      } catch (error) {
        // If it fails, it should be with a meaningful error message
        expect([400, 404, 409]).toContain(error.response.status);
      }
    });
  });

  describe('Deletion Performance and Reliability', () => {
    test('should delete item master within reasonable time', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      // Create an item master for performance test
      const itemData = {
        item_code: `PERF${Date.now()}`,
        item_name: 'Performance Delete Test Item',
        item_type: 'PRODUCT',
        category_id: testCategoryId
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/item-masters/`,
        itemData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const itemId = createResponse.data.id;

      const startTime = Date.now();
      
      const response = await axios.delete(
        `${API_BASE_URL}/item-masters/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(204);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test('should handle concurrent deletion attempts', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      // Create an item master for concurrent deletion test
      const itemData = {
        item_code: `CONC${Date.now()}`,
        item_name: 'Concurrent Delete Test Item',
        item_type: 'PRODUCT',
        category_id: testCategoryId
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/item-masters/`,
        itemData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const itemId = createResponse.data.id;

      // Attempt concurrent deletions
      const deletePromises = [
        axios.delete(
          `${API_BASE_URL}/item-masters/${itemId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        ),
        axios.delete(
          `${API_BASE_URL}/item-masters/${itemId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        )
      ];

      const results = await Promise.allSettled(deletePromises);

      // At least one should succeed, and the system should handle the concurrency gracefully
      const successfulResults = results.filter(result => result.status === 'fulfilled');
      const failedResults = results.filter(result => result.status === 'rejected');

      expect(successfulResults.length).toBeGreaterThan(0);
      
      // If any failed, they should fail with appropriate error codes
      failedResults.forEach(result => {
        const error = result.reason;
        expect([400, 404, 409]).toContain(error.response?.status);
      });
    });
  });

  describe('Category Relationship Impact', () => {
    test('should handle item master deletion when category still exists', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      // Create item master
      const itemData = {
        item_code: `CATREL${Date.now()}`,
        item_name: 'Category Relationship Test',
        item_type: 'PRODUCT',
        category_id: testCategoryId
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/item-masters/`,
        itemData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const itemId = createResponse.data.id;

      // Delete item master
      const deleteResponse = await axios.delete(
        `${API_BASE_URL}/item-masters/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(deleteResponse.status).toBe(204);

      // Verify category still exists and is accessible
      const categoryResponse = await axios.get(
        `${API_BASE_URL}/categories/${testCategoryId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(categoryResponse.status).toBe(200);
      expect(categoryResponse.data.id).toBe(testCategoryId);
    });
  });
});