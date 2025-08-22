/**
 * ItemMaster API Integration Tests
 * Tests for complete itemmaster workflows combining multiple operations
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('ItemMaster API Integration Tests', () => {
  let authToken = null;

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

  describe('Complete ItemMaster Lifecycle', () => {
    test('should create, retrieve, update, and delete an item master', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      let itemMasterId = null;
      let categoryId = null;
      let brandId = null;

      try {
        // Step 1: Create necessary dependencies (category and brand)
        const categoryData = {
          category_name: 'Integration Test Category',
          description: 'Test category for integration tests',
          is_active: true
        };

        const categoryResponse = await axios.post(
          `${API_BASE_URL}/categories/`,
          categoryData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        categoryId = categoryResponse.data.id;

        const brandData = {
          brand_name: 'Integration Test Brand',
          description: 'Test brand for integration tests',
          is_active: true
        };

        const brandResponse = await axios.post(
          `${API_BASE_URL}/brands/`,
          brandData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        brandId = brandResponse.data.id;

        // Step 2: Create a new item master
        const createData = {
          item_code: `INTEG${Date.now()}`,
          item_name: 'Integration Test Item Master',
          item_type: 'PRODUCT',
          category_id: categoryId,
          brand_id: brandId,
          description: 'Test item master for integration tests',
          is_serialized: true,
          specifications: {
            color: 'Black',
            material: 'Metal',
            weight: '2.5kg'
          }
        };

        const createResponse = await axios.post(
          `${API_BASE_URL}/item-masters/`,
          createData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        expect(createResponse.status).toBe(201);
        expect(createResponse.data).toHaveProperty('id');
        itemMasterId = createResponse.data.id;

        // Step 3: Retrieve the created item master by ID
        const getByIdResponse = await axios.get(
          `${API_BASE_URL}/item-masters/${itemMasterId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(getByIdResponse.status).toBe(200);
        expect(getByIdResponse.data.id).toBe(itemMasterId);
        expect(getByIdResponse.data.item_name).toBe('Integration Test Item Master');

        // Step 4: Retrieve the item master by code
        const getByCodeResponse = await axios.get(
          `${API_BASE_URL}/item-masters/code/${createData.item_code}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(getByCodeResponse.status).toBe(200);
        expect(getByCodeResponse.data.id).toBe(itemMasterId);

        // Step 5: Update the item master
        const updateData = {
          item_name: 'Updated Integration Test Item Master',
          description: 'Updated test item master description',
          specifications: {
            color: 'White',
            material: 'Plastic',
            weight: '1.8kg',
            dimensions: '30x20x5cm'
          }
        };

        const updateResponse = await axios.put(
          `${API_BASE_URL}/item-masters/${itemMasterId}`,
          updateData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.data.item_name).toBe('Updated Integration Test Item Master');
        expect(updateResponse.data.description).toBe('Updated test item master description');

        // Step 6: Verify the update by retrieving again
        const verifyUpdateResponse = await axios.get(
          `${API_BASE_URL}/item-masters/${itemMasterId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(verifyUpdateResponse.status).toBe(200);
        expect(verifyUpdateResponse.data.item_name).toBe('Updated Integration Test Item Master');

        // Step 7: Update serialization setting
        const serializationUpdateResponse = await axios.put(
          `${API_BASE_URL}/item-masters/${itemMasterId}/serialization`,
          { is_serialized: false },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        expect(serializationUpdateResponse.status).toBe(200);
        expect(serializationUpdateResponse.data.is_serialized).toBe(false);

        // Step 8: Verify item master appears in filtered lists
        const filteredListResponse = await axios.get(
          `${API_BASE_URL}/item-masters/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              category_id: categoryId,
              item_type: 'PRODUCT'
            }
          }
        );

        expect(filteredListResponse.status).toBe(200);
        const foundItem = filteredListResponse.data.items.find(item => item.id === itemMasterId);
        expect(foundItem).toBeDefined();

        // Step 9: Soft delete the item master
        const deleteResponse = await axios.delete(
          `${API_BASE_URL}/item-masters/${itemMasterId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(deleteResponse.status).toBe(204);

        // Step 10: Verify item master is soft deleted (can still be retrieved but marked inactive)
        const afterDeleteResponse = await axios.get(
          `${API_BASE_URL}/item-masters/${itemMasterId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(afterDeleteResponse.status).toBe(200);
        expect(afterDeleteResponse.data.id).toBe(itemMasterId);
        expect(afterDeleteResponse.data.is_active).toBe(false);

        // Step 11: Verify item master is excluded from active listings
        const activeListResponse = await axios.get(
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

        expect(activeListResponse.status).toBe(200);
        const deletedItem = activeListResponse.data.items.find(item => item.id === itemMasterId);
        expect(deletedItem).toBeUndefined();

      } finally {
        // Clean up dependencies
        if (categoryId) {
          try {
            await axios.delete(`${API_BASE_URL}/categories/${categoryId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
        if (brandId) {
          try {
            await axios.delete(`${API_BASE_URL}/brands/${brandId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    });
  });

  describe('Bulk Operations Workflow', () => {
    test('should create, list, filter, and delete multiple item masters', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      let categoryId = null;
      let brandId = null;
      const itemMasterIds = [];

      try {
        // Step 1: Create test category and brand
        const categoryResponse = await axios.post(
          `${API_BASE_URL}/categories/`,
          {
            category_name: 'Bulk Test Category',
            description: 'Test category for bulk operations',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        categoryId = categoryResponse.data.id;

        const brandResponse = await axios.post(
          `${API_BASE_URL}/brands/`,
          {
            brand_name: 'Bulk Test Brand',
            description: 'Test brand for bulk operations',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        brandId = brandResponse.data.id;

        // Step 2: Create multiple item masters
        const itemDataArray = [
          {
            item_code: `BULK1${Date.now()}`,
            item_name: 'Bulk Test Product Item',
            item_type: 'PRODUCT',
            category_id: categoryId,
            brand_id: brandId,
            is_serialized: true
          },
          {
            item_code: `BULK2${Date.now()}`,
            item_name: 'Bulk Test Service Item',
            item_type: 'SERVICE',
            category_id: categoryId,
            is_serialized: false
          },
          {
            item_code: `BULK3${Date.now()}`,
            item_name: 'Bulk Test Bundle Item',
            item_type: 'BUNDLE',
            category_id: categoryId,
            brand_id: brandId,
            is_serialized: false
          }
        ];

        const createPromises = itemDataArray.map(data =>
          axios.post(`${API_BASE_URL}/item-masters/`, data, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          })
        );

        const createResponses = await Promise.all(createPromises);
        
        createResponses.forEach((response, index) => {
          expect(response.status).toBe(201);
          expect(response.data.item_name).toBe(itemDataArray[index].item_name);
          itemMasterIds.push(response.data.id);
        });

        // Step 3: Verify all item masters appear in listing
        const listResponse = await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(listResponse.status).toBe(200);
        const foundItems = listResponse.data.items.filter(item =>
          itemMasterIds.includes(item.id)
        );
        expect(foundItems.length).toBe(3);

        // Step 4: Filter by different criteria
        const productResponse = await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { item_type: 'PRODUCT' }
        });

        expect(productResponse.status).toBe(200);
        const productItems = productResponse.data.items.filter(item =>
          itemMasterIds.includes(item.id)
        );
        expect(productItems.length).toBe(1);
        expect(productItems[0].item_type).toBe('PRODUCT');

        // Step 5: Filter by serialization status
        const serializedResponse = await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { is_serialized: true }
        });

        expect(serializedResponse.status).toBe(200);
        const serializedItems = serializedResponse.data.items.filter(item =>
          itemMasterIds.includes(item.id)
        );
        expect(serializedItems.length).toBe(1);
        expect(serializedItems[0].is_serialized).toBe(true);

        // Step 6: Search functionality
        const searchResponse = await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { search: 'Bulk Test' }
        });

        expect(searchResponse.status).toBe(200);
        const searchResults = searchResponse.data.items.filter(item =>
          itemMasterIds.includes(item.id)
        );
        expect(searchResults.length).toBe(3);

        // Step 7: Update multiple item masters
        const updatePromises = itemMasterIds.map(id =>
          axios.put(`${API_BASE_URL}/item-masters/${id}`, 
            { description: 'Bulk updated description' },
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          )
        );

        const updateResponses = await Promise.all(updatePromises);
        updateResponses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.data.description).toBe('Bulk updated description');
        });

        // Step 8: Delete all item masters
        const deletePromises = itemMasterIds.map(id =>
          axios.delete(`${API_BASE_URL}/item-masters/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );

        const deleteResponses = await Promise.all(deletePromises);
        deleteResponses.forEach(response => {
          expect(response.status).toBe(204);
        });

        // Step 9: Verify item masters are soft deleted
        const retrievePromises = itemMasterIds.map(id =>
          axios.get(`${API_BASE_URL}/item-masters/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );

        const retrieveResponses = await Promise.all(retrievePromises);
        retrieveResponses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.data.is_active).toBe(false);
        });

      } finally {
        // Clean up dependencies
        if (categoryId) {
          try {
            await axios.delete(`${API_BASE_URL}/categories/${categoryId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
        if (brandId) {
          try {
            await axios.delete(`${API_BASE_URL}/brands/${brandId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    });
  });

  describe('Search and Filter Integration', () => {
    test('should combine search with filters effectively', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      let categoryId = null;
      let brandId = null;
      const itemMasterIds = [];

      try {
        // Create test dependencies
        const categoryResponse = await axios.post(
          `${API_BASE_URL}/categories/`,
          {
            category_name: 'Search Filter Test Category',
            description: 'Test category for search and filter tests',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        categoryId = categoryResponse.data.id;

        const brandResponse = await axios.post(
          `${API_BASE_URL}/brands/`,
          {
            brand_name: 'Search Filter Test Brand',
            description: 'Test brand for search and filter tests',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        brandId = brandResponse.data.id;

        // Create test item masters with specific characteristics
        const itemDataArray = [
          {
            item_code: `SEARCH1${Date.now()}`,
            item_name: 'Search Test Laptop Computer',
            item_type: 'PRODUCT',
            category_id: categoryId,
            brand_id: brandId,
            description: 'Professional laptop for business',
            is_serialized: true
          },
          {
            item_code: `SEARCH2${Date.now()}`,
            item_name: 'Search Test Maintenance Service',
            item_type: 'SERVICE',
            category_id: categoryId,
            description: 'Professional maintenance service',
            is_serialized: false
          },
          {
            item_code: `SEARCH3${Date.now()}`,
            item_name: 'Different Product Item',
            item_type: 'PRODUCT',
            category_id: categoryId,
            brand_id: brandId,
            description: 'Another product item',
            is_serialized: true
          }
        ];

        const createPromises = itemDataArray.map(data =>
          axios.post(`${API_BASE_URL}/item-masters/`, data, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          })
        );

        const createResponses = await Promise.all(createPromises);
        itemMasterIds.push(...createResponses.map(response => response.data.id));

        // Test 1: Search by name + filter by type
        const searchAndFilterResponse = await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: {
            search: 'Search Test',
            item_type: 'PRODUCT'
          }
        });

        expect(searchAndFilterResponse.status).toBe(200);
        const matchingItems = searchAndFilterResponse.data.items.filter(item =>
          itemMasterIds.includes(item.id)
        );
        
        expect(matchingItems.length).toBe(1);
        expect(matchingItems[0].item_name).toBe('Search Test Laptop Computer');
        expect(matchingItems[0].item_type).toBe('PRODUCT');

        // Test 2: Search + multiple filters
        const multiFilterResponse = await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: {
            search: 'Product',
            item_type: 'PRODUCT',
            category_id: categoryId,
            is_serialized: true
          }
        });

        expect(multiFilterResponse.status).toBe(200);
        const multiFilterResults = multiFilterResponse.data.items.filter(item =>
          itemMasterIds.includes(item.id)
        );

        // Should find both product items
        expect(multiFilterResults.length).toBe(2);
        multiFilterResults.forEach(item => {
          expect(item.item_type).toBe('PRODUCT');
          expect(item.category_id).toBe(categoryId);
          expect(item.is_serialized).toBe(true);
        });

        // Test 3: Search by description + filter
        const descriptionSearchResponse = await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: {
            search: 'Professional',
            item_type: 'SERVICE'
          }
        });

        expect(descriptionSearchResponse.status).toBe(200);
        const descriptionResults = descriptionSearchResponse.data.items.filter(item =>
          itemMasterIds.includes(item.id)
        );

        expect(descriptionResults.length).toBe(1);
        expect(descriptionResults[0].item_name).toBe('Search Test Maintenance Service');
        expect(descriptionResults[0].item_type).toBe('SERVICE');

        // Clean up
        const deletePromises = itemMasterIds.map(id =>
          axios.delete(`${API_BASE_URL}/item-masters/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );
        await Promise.all(deletePromises);

      } finally {
        // Clean up dependencies
        if (categoryId) {
          try {
            await axios.delete(`${API_BASE_URL}/categories/${categoryId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
        if (brandId) {
          try {
            await axios.delete(`${API_BASE_URL}/brands/${brandId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    });
  });

  describe('Data Consistency and Validation Workflow', () => {
    test('should maintain data consistency across operations', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      let itemMasterId = null;
      let categoryId = null;
      let brandId = null;

      try {
        // Create dependencies
        const categoryResponse = await axios.post(
          `${API_BASE_URL}/categories/`,
          {
            category_name: 'Consistency Test Category',
            description: 'Test category for consistency tests',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        categoryId = categoryResponse.data.id;

        const brandResponse = await axios.post(
          `${API_BASE_URL}/brands/`,
          {
            brand_name: 'Consistency Test Brand',
            description: 'Test brand for consistency tests',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        brandId = brandResponse.data.id;

        // Create item master with specific data
        const originalData = {
          item_code: `CONSIST${Date.now()}`,
          item_name: 'Consistency Test Item Master',
          item_type: 'PRODUCT',
          category_id: categoryId,
          brand_id: brandId,
          description: 'Test item for consistency validation',
          is_serialized: true,
          specifications: {
            color: 'Black',
            material: 'Metal',
            weight: '2.5kg'
          }
        };

        const createResponse = await axios.post(`${API_BASE_URL}/item-masters/`, originalData, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(createResponse.status).toBe(201);
        itemMasterId = createResponse.data.id;

        // Verify all fields are correctly stored
        expect(createResponse.data.item_code).toBe(originalData.item_code.toUpperCase());
        expect(createResponse.data.item_name).toBe(originalData.item_name);
        expect(createResponse.data.item_type).toBe(originalData.item_type);
        expect(createResponse.data.category_id).toBe(originalData.category_id);
        expect(createResponse.data.brand_id).toBe(originalData.brand_id);

        // Test partial update preserving other fields
        const partialUpdate = {
          description: 'Updated consistency test description'
        };

        const updateResponse = await axios.put(`${API_BASE_URL}/item-masters/${itemMasterId}`, partialUpdate, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.data.description).toBe('Updated consistency test description');
        
        // Verify other fields remained unchanged
        expect(updateResponse.data.item_name).toBe(originalData.item_name);
        expect(updateResponse.data.item_type).toBe(originalData.item_type);
        expect(updateResponse.data.category_id).toBe(originalData.category_id);
        expect(updateResponse.data.brand_id).toBe(originalData.brand_id);

        // Test that item master appears in appropriate filtered lists
        const productItemsResponse = await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { item_type: 'PRODUCT' }
        });

        expect(productItemsResponse.status).toBe(200);
        const foundProduct = productItemsResponse.data.items.find(item => item.id === itemMasterId);
        expect(foundProduct).toBeDefined();

        // Test that item master doesn't appear in wrong filtered lists
        const serviceItemsResponse = await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { item_type: 'SERVICE' }
        });

        expect(serviceItemsResponse.status).toBe(200);
        const foundService = serviceItemsResponse.data.items.find(item => item.id === itemMasterId);
        expect(foundService).toBeUndefined();

        // Test serialization update workflow
        await axios.put(`${API_BASE_URL}/item-masters/${itemMasterId}/serialization`, 
          { is_serialized: false },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Verify serialization status updated in retrievals
        const afterSerializationResponse = await axios.get(`${API_BASE_URL}/item-masters/${itemMasterId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(afterSerializationResponse.status).toBe(200);
        expect(afterSerializationResponse.data.is_serialized).toBe(false);

        // Clean up
        await axios.delete(`${API_BASE_URL}/item-masters/${itemMasterId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

      } finally {
        // Clean up dependencies
        if (categoryId) {
          try {
            await axios.delete(`${API_BASE_URL}/categories/${categoryId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
        if (brandId) {
          try {
            await axios.delete(`${API_BASE_URL}/brands/${brandId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    });
  });

  describe('Business Rules Integration', () => {
    test('should enforce serialization business rules across operations', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      let categoryId = null;
      let productId = null;
      let serviceId = null;
      let bundleId = null;

      try {
        // Create test category
        const categoryResponse = await axios.post(
          `${API_BASE_URL}/categories/`,
          {
            category_name: 'Business Rules Test Category',
            description: 'Test category for business rules',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        categoryId = categoryResponse.data.id;

        // Test 1: Products can be serialized
        const productData = {
          item_code: `PROD${Date.now()}`,
          item_name: 'Serializable Product',
          item_type: 'PRODUCT',
          category_id: categoryId,
          is_serialized: true
        };

        const productResponse = await axios.post(`${API_BASE_URL}/item-masters/`, productData, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(productResponse.status).toBe(201);
        expect(productResponse.data.is_serialized).toBe(true);
        productId = productResponse.data.id;

        // Test 2: Services cannot be serialized
        const serviceData = {
          item_code: `SRV${Date.now()}`,
          item_name: 'Non-Serializable Service',
          item_type: 'SERVICE',
          category_id: categoryId,
          is_serialized: false
        };

        const serviceResponse = await axios.post(`${API_BASE_URL}/item-masters/`, serviceData, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(serviceResponse.status).toBe(201);
        expect(serviceResponse.data.is_serialized).toBe(false);
        serviceId = serviceResponse.data.id;

        // Try to enable serialization for service (should fail)
        try {
          await axios.put(`${API_BASE_URL}/item-masters/${serviceId}/serialization`, 
            { is_serialized: true },
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
        }

        // Test 3: Bundles cannot be serialized
        const bundleData = {
          item_code: `BUN${Date.now()}`,
          item_name: 'Non-Serializable Bundle',
          item_type: 'BUNDLE',
          category_id: categoryId,
          is_serialized: false
        };

        const bundleResponse = await axios.post(`${API_BASE_URL}/item-masters/`, bundleData, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(bundleResponse.status).toBe(201);
        expect(bundleResponse.data.is_serialized).toBe(false);
        bundleId = bundleResponse.data.id;

        // Try to enable serialization for bundle (should fail)
        try {
          await axios.put(`${API_BASE_URL}/item-masters/${bundleId}/serialization`, 
            { is_serialized: true },
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
        }

        // Test 4: Verify filtering by serialization status works correctly
        const serializedResponse = await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { is_serialized: true }
        });

        expect(serializedResponse.status).toBe(200);
        const serializedItems = serializedResponse.data.items.filter(item =>
          [productId, serviceId, bundleId].includes(item.id)
        );
        
        expect(serializedItems.length).toBe(1);
        expect(serializedItems[0].id).toBe(productId);
        expect(serializedItems[0].item_type).toBe('PRODUCT');

      } finally {
        // Clean up
        const cleanupPromises = [];
        if (productId) {
          cleanupPromises.push(
            axios.delete(`${API_BASE_URL}/item-masters/${productId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            }).catch(() => {})
          );
        }
        if (serviceId) {
          cleanupPromises.push(
            axios.delete(`${API_BASE_URL}/item-masters/${serviceId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            }).catch(() => {})
          );
        }
        if (bundleId) {
          cleanupPromises.push(
            axios.delete(`${API_BASE_URL}/item-masters/${bundleId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            }).catch(() => {})
          );
        }
        if (categoryId) {
          cleanupPromises.push(
            axios.delete(`${API_BASE_URL}/categories/${categoryId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            }).catch(() => {})
          );
        }

        await Promise.all(cleanupPromises);
      }
    });
  });

  describe('Performance Integration', () => {
    test('should handle complex workflow within reasonable time', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const startTime = Date.now();
      let categoryId = null;
      const itemMasterIds = [];

      try {
        // Create test category
        const categoryResponse = await axios.post(
          `${API_BASE_URL}/categories/`,
          {
            category_name: 'Performance Test Category',
            description: 'Test category for performance tests',
            is_active: true
          },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        categoryId = categoryResponse.data.id;

        // Create multiple item masters
        const createPromises = Array.from({ length: 5 }, (_, i) => 
          axios.post(`${API_BASE_URL}/item-masters/`, {
            item_code: `PERF${Date.now()}${i}`,
            item_name: `Performance Test Item ${i}`,
            item_type: 'PRODUCT',
            category_id: categoryId,
            is_serialized: i % 2 === 0
          }, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          })
        );

        const createResponses = await Promise.all(createPromises);
        itemMasterIds.push(...createResponses.map(r => r.data.id));

        // Perform various operations
        await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        await axios.get(`${API_BASE_URL}/item-masters/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { item_type: 'PRODUCT' }
        });

        // Update all item masters
        const updatePromises = itemMasterIds.map(id =>
          axios.put(`${API_BASE_URL}/item-masters/${id}`, 
            { description: 'Performance test description' },
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          )
        );

        await Promise.all(updatePromises);

        // Retrieve all item masters
        const retrievePromises = itemMasterIds.map(id =>
          axios.get(`${API_BASE_URL}/item-masters/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );

        await Promise.all(retrievePromises);

        // Delete all item masters
        const deletePromises = itemMasterIds.map(id =>
          axios.delete(`${API_BASE_URL}/item-masters/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );

        await Promise.all(deletePromises);

        const endTime = Date.now();
        const totalDuration = endTime - startTime;

        // Complete workflow should finish within reasonable time
        expect(totalDuration).toBeLessThan(20000); // 20 seconds

      } finally {
        // Clean up
        if (categoryId) {
          try {
            await axios.delete(`${API_BASE_URL}/categories/${categoryId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    });
  });
});