/**
 * ItemMaster Update Tests
 * Tests for updating item master information and related functionality
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('ItemMaster Update Tests', () => {
  let authToken = null;
  let testItemMasterId = null;
  let testCategoryId = null;
  let testBrandId = null;
  let alternateCategoryId = null;
  let alternateBrandId = null;

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

    // Create test categories and brands, then create an item master for update tests
    if (authToken) {
      try {
        // Create primary test category
        const categoryResponse = await axios.post(
          `${API_BASE_URL}/categories/`,
          {
            category_name: 'Original Update Test Category',
            description: 'Original test category for updates',
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

        // Create alternate test category
        const altCategoryResponse = await axios.post(
          `${API_BASE_URL}/categories/`,
          {
            category_name: 'Alternate Update Test Category',
            description: 'Alternate test category for updates',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        alternateCategoryId = altCategoryResponse.data.id;

        // Create primary test brand
        const brandResponse = await axios.post(
          `${API_BASE_URL}/brands/`,
          {
            brand_name: 'Original Update Test Brand',
            description: 'Original test brand for updates',
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

        // Create alternate test brand
        const altBrandResponse = await axios.post(
          `${API_BASE_URL}/brands/`,
          {
            brand_name: 'Alternate Update Test Brand',
            description: 'Alternate test brand for updates',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        alternateBrandId = altBrandResponse.data.id;

        // Create test item master
        const itemData = {
          item_code: `UPD${Date.now()}`,
          item_name: 'Original Update Test Item Master',
          item_type: 'PRODUCT',
          category_id: testCategoryId,
          brand_id: testBrandId,
          description: 'Original test item for updates',
          is_serialized: true,
          specifications: {
            color: 'Black',
            material: 'Metal'
          }
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
        console.error('Failed to create test data:', error.response?.data || error.message);
      }
    }
  });

  afterAll(async () => {
    // Clean up test data
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
        if (alternateCategoryId) {
          await axios.delete(`${API_BASE_URL}/categories/${alternateCategoryId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
        }
        if (testBrandId) {
          await axios.delete(`${API_BASE_URL}/brands/${testBrandId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
        }
        if (alternateBrandId) {
          await axios.delete(`${API_BASE_URL}/brands/${alternateBrandId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Basic ItemMaster Updates', () => {
    test('should update item master name', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const updateData = {
        item_name: 'Updated Item Master Name'
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.item_name).toBe('Updated Item Master Name');
      expect(response.data.id).toBe(testItemMasterId);
    });

    test('should update item master description', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const updateData = {
        description: 'Updated test item description with more details'
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.description).toBe('Updated test item description with more details');
    });

    test('should update item master category', async () => {
      if (!authToken || !testItemMasterId || !alternateCategoryId) {
        throw new Error('Authentication, test item master, and alternate category required for this test');
      }

      const updateData = {
        category_id: alternateCategoryId
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.category_id).toBe(alternateCategoryId);
    });

    test('should update item master brand', async () => {
      if (!authToken || !testItemMasterId || !alternateBrandId) {
        throw new Error('Authentication, test item master, and alternate brand required for this test');
      }

      const updateData = {
        brand_id: alternateBrandId
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.brand_id).toBe(alternateBrandId);
    });

    test('should update item master specifications', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const updateData = {
        specifications: {
          color: 'White',
          material: 'Plastic',
          weight: '2.5kg',
          dimensions: '30x20x5cm'
        }
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.specifications).toBeDefined();
      if (response.data.specifications) {
        expect(response.data.specifications.color).toBe('White');
        expect(response.data.specifications.material).toBe('Plastic');
        expect(response.data.specifications.weight).toBe('2.5kg');
      }
    });
  });

  describe('Serialization Updates', () => {
    test('should update serialization setting using dedicated endpoint', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const updateData = {
        is_serialized: false
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}/serialization`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.is_serialized).toBe(false);
    });

    test('should enable serialization for product items', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const updateData = {
        is_serialized: true
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}/serialization`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.is_serialized).toBe(true);
    });

    test('should reject serialization for service items', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      // Create a service item first
      const serviceData = {
        item_code: `SRVSER${Date.now()}`,
        item_name: 'Service Item for Serialization Test',
        item_type: 'SERVICE',
        category_id: testCategoryId,
        is_serialized: false
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/item-masters/`,
        serviceData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const serviceId = createResponse.data.id;

      try {
        // Try to enable serialization for service item
        const updateData = {
          is_serialized: true
        };

        await axios.put(
          `${API_BASE_URL}/item-masters/${serviceId}/serialization`,
          updateData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      } finally {
        // Clean up
        await axios.delete(`${API_BASE_URL}/item-masters/${serviceId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
    });
  });

  describe('Comprehensive Updates', () => {
    test('should update multiple fields at once', async () => {
      if (!authToken || !testItemMasterId || !alternateCategoryId || !alternateBrandId) {
        throw new Error('Authentication, test item master, alternate category, and alternate brand required for this test');
      }

      const updateData = {
        item_name: 'Comprehensive Update Test Item',
        description: 'Comprehensive update test description',
        category_id: alternateCategoryId,
        brand_id: alternateBrandId,
        specifications: {
          color: 'Blue',
          material: 'Carbon Fiber',
          weight: '1.8kg',
          dimensions: '25x15x3cm',
          warranty: '2 years'
        }
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.item_name).toBe('Comprehensive Update Test Item');
      expect(response.data.description).toBe('Comprehensive update test description');
      expect(response.data.category_id).toBe(alternateCategoryId);
      expect(response.data.brand_id).toBe(alternateBrandId);
      
      if (response.data.specifications) {
        expect(response.data.specifications.color).toBe('Blue');
        expect(response.data.specifications.material).toBe('Carbon Fiber');
        expect(response.data.specifications.warranty).toBe('2 years');
      }
    });

    test('should preserve unchanged fields during update', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      // Get current item master data
      const getCurrentResponse = await axios.get(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const originalData = getCurrentResponse.data;

      // Update only one field
      const updateData = {
        item_name: 'Partial Update Test Item'
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.item_name).toBe('Partial Update Test Item');
      
      // Verify other fields remain unchanged
      expect(response.data.item_type).toBe(originalData.item_type);
      expect(response.data.item_code).toBe(originalData.item_code);
      expect(response.data.is_serialized).toBe(originalData.is_serialized);
    });
  });

  describe('Update Validation Tests', () => {
    test('should reject update with invalid category ID', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const invalidData = {
        category_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' // Non-existent category
      };

      try {
        await axios.put(
          `${API_BASE_URL}/item-masters/${testItemMasterId}`,
          invalidData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 404, 422]).toContain(error.response.status);
      }
    });

    test('should reject update with invalid brand ID', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const invalidData = {
        brand_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' // Non-existent brand
      };

      try {
        await axios.put(
          `${API_BASE_URL}/item-masters/${testItemMasterId}`,
          invalidData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 404, 422]).toContain(error.response.status);
      }
    });

    test('should reject update with empty item name', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const invalidData = {
        item_name: ''
      };

      try {
        await axios.put(
          `${API_BASE_URL}/item-masters/${testItemMasterId}`,
          invalidData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
        expect(error.response.data.detail).toBeDefined();
      }
    });

    test('should reject update with item name too long', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const invalidData = {
        item_name: 'A'.repeat(256) // Too long (max 255 characters)
      };

      try {
        await axios.put(
          `${API_BASE_URL}/item-masters/${testItemMasterId}`,
          invalidData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
        expect(error.response.data.detail).toBeDefined();
      }
    });

    test('should reject update that would create duplicate item code', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      let firstItemId = null;
      let secondItemId = null;

      try {
        // Create first item
        const firstItemData = {
          item_code: `FIRST${Date.now()}`,
          item_name: 'First Item for Duplicate Test',
          item_type: 'PRODUCT',
          category_id: testCategoryId
        };

        const firstResponse = await axios.post(
          `${API_BASE_URL}/item-masters/`,
          firstItemData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        firstItemId = firstResponse.data.id;

        // Create second item
        const secondItemData = {
          item_code: `SECOND${Date.now()}`,
          item_name: 'Second Item for Duplicate Test',
          item_type: 'PRODUCT',
          category_id: testCategoryId
        };

        const secondResponse = await axios.post(
          `${API_BASE_URL}/item-masters/`,
          secondItemData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        secondItemId = secondResponse.data.id;

        // Try to update second item to have same code as first
        const duplicateUpdate = {
          item_code: firstItemData.item_code
        };

        await axios.put(
          `${API_BASE_URL}/item-masters/${secondItemId}`,
          duplicateUpdate,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect([400, 409, 422]).toContain(error.response.status);
      } finally {
        // Clean up
        if (firstItemId) {
          await axios.delete(`${API_BASE_URL}/item-masters/${firstItemId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          }).catch(() => {});
        }
        if (secondItemId) {
          await axios.delete(`${API_BASE_URL}/item-masters/${secondItemId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          }).catch(() => {});
        }
      }
    });
  });

  describe('Update Authorization and Permissions', () => {
    test('should require authentication for update', async () => {
      if (!testItemMasterId) {
        throw new Error('Test item master required for this test');
      }

      const updateData = {
        item_name: 'Unauthorized Update'
      };

      try {
        await axios.put(
          `${API_BASE_URL}/item-masters/${testItemMasterId}`,
          updateData,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should reject update for non-existent item master', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const updateData = {
        item_name: 'Non-Existent Update'
      };

      try {
        await axios.put(
          `${API_BASE_URL}/item-masters/${nonExistentId}`,
          updateData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(404);
      }
    });

    test('should reject update with malformed item master ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const malformedId = 'invalid-id';
      const updateData = {
        item_name: 'Malformed ID Update'
      };

      try {
        await axios.put(
          `${API_BASE_URL}/item-masters/${malformedId}`,
          updateData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        expect(true).toBe(false);
      } catch (error) {
        expect([400, 422]).toContain(error.response.status);
      }
    });
  });

  describe('Update Performance', () => {
    test('should update item master within reasonable time', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const updateData = {
        item_name: 'Performance Update Test Item',
        description: 'Performance update test description'
      };

      const startTime = Date.now();

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test('should handle concurrent updates to different item masters', async () => {
      if (!authToken || !testCategoryId) {
        throw new Error('Authentication and test category required for this test');
      }

      const createdIds = [];

      try {
        // Create two test item masters for concurrent updates
        const item1Data = {
          item_code: `CONC1${Date.now()}`,
          item_name: 'Concurrent Test Item 1',
          item_type: 'PRODUCT',
          category_id: testCategoryId
        };

        const item2Data = {
          item_code: `CONC2${Date.now()}`,
          item_name: 'Concurrent Test Item 2',
          item_type: 'SERVICE',
          category_id: testCategoryId
        };

        const createPromises = [
          axios.post(`${API_BASE_URL}/item-masters/`, item1Data, {
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
          }),
          axios.post(`${API_BASE_URL}/item-masters/`, item2Data, {
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
          })
        ];

        const createResponses = await Promise.all(createPromises);
        const item1Id = createResponses[0].data.id;
        const item2Id = createResponses[1].data.id;
        createdIds.push(item1Id, item2Id);

        // Update both item masters concurrently
        const updatePromises = [
          axios.put(`${API_BASE_URL}/item-masters/${item1Id}`, 
            { item_name: 'Updated Concurrent Item 1' },
            { headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } }
          ),
          axios.put(`${API_BASE_URL}/item-masters/${item2Id}`, 
            { item_name: 'Updated Concurrent Item 2' },
            { headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } }
          )
        ];

        const updateResponses = await Promise.all(updatePromises);

        updateResponses.forEach(response => {
          expect(response.status).toBe(200);
        });

        expect(updateResponses[0].data.item_name).toBe('Updated Concurrent Item 1');
        expect(updateResponses[1].data.item_name).toBe('Updated Concurrent Item 2');
      } finally {
        // Cleanup
        const cleanupPromises = createdIds.map(id =>
          axios.delete(`${API_BASE_URL}/item-masters/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          }).catch(() => {})
        );

        await Promise.all(cleanupPromises);
      }
    });
  });

  describe('Edge Cases and Special Scenarios', () => {
    test('should handle partial specification updates', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      // First, set some initial specifications
      const initialUpdate = {
        specifications: {
          color: 'Red',
          material: 'Steel',
          weight: '3kg'
        }
      };

      await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        initialUpdate,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Then update only part of the specifications
      const partialUpdate = {
        specifications: {
          color: 'Green',
          dimensions: '40x30x10cm'
        }
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        partialUpdate,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      if (response.data.specifications) {
        expect(response.data.specifications.color).toBe('Green');
        expect(response.data.specifications.dimensions).toBe('40x30x10cm');
        // Note: Behavior for partial updates may vary - some systems merge, others replace
      }
    });

    test('should handle clearing optional fields', async () => {
      if (!authToken || !testItemMasterId) {
        throw new Error('Authentication and test item master required for this test');
      }

      const updateData = {
        description: null,
        brand_id: null,
        specifications: null
      };

      const response = await axios.put(
        `${API_BASE_URL}/item-masters/${testItemMasterId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      // Verify that optional fields can be cleared
      expect(response.data.description).toBeFalsy();
      expect(response.data.brand_id).toBeFalsy();
    });
  });
});