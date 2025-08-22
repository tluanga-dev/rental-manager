/**
 * Supplier API Integration Tests
 * Tests for complete supplier workflows combining multiple operations
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('Supplier API Integration Tests', () => {
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

  describe('Complete Supplier Lifecycle', () => {
    test('should create, retrieve, update, and delete a supplier', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      let supplierId = null;

      try {
        // Step 1: Create a new supplier
        const createData = {
          supplier_code: `INTEG${Date.now()}`,
          company_name: 'Integration Test Corp',
          supplier_type: 'MANUFACTURER',
          contact_person: 'Integration Contact',
          email: 'integration@test.com',
          phone: '+1-555-INTEG',
          address: '123 Integration St, Test City, TC 12345',
          payment_terms: 'NET30',
          credit_limit: 25000.00,
          supplier_tier: 'STANDARD'
        };

        const createResponse = await axios.post(
          `${API_BASE_URL}/suppliers/`,
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
        supplierId = createResponse.data.id;

        // Step 2: Retrieve the created supplier by ID
        const getByIdResponse = await axios.get(
          `${API_BASE_URL}/suppliers/${supplierId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(getByIdResponse.status).toBe(200);
        expect(getByIdResponse.data.id).toBe(supplierId);
        expect(getByIdResponse.data.company_name).toBe('Integration Test Corp');

        // Step 3: Retrieve the supplier by code
        const getByCodeResponse = await axios.get(
          `${API_BASE_URL}/suppliers/code/${createData.supplier_code}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(getByCodeResponse.status).toBe(200);
        expect(getByCodeResponse.data.id).toBe(supplierId);

        // Step 4: Update the supplier
        const updateData = {
          company_name: 'Updated Integration Test Corp',
          contact_person: 'Updated Contact',
          supplier_tier: 'PREFERRED'
        };

        const updateResponse = await axios.put(
          `${API_BASE_URL}/suppliers/${supplierId}`,
          updateData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.data.company_name).toBe('Updated Integration Test Corp');
        expect(updateResponse.data.contact_person).toBe('Updated Contact');
        expect(updateResponse.data.supplier_tier).toBe('PREFERRED');

        // Step 5: Verify the update by retrieving again
        const verifyUpdateResponse = await axios.get(
          `${API_BASE_URL}/suppliers/${supplierId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(verifyUpdateResponse.status).toBe(200);
        expect(verifyUpdateResponse.data.company_name).toBe('Updated Integration Test Corp');

        // Step 6: Update supplier status
        const statusUpdateResponse = await axios.patch(
          `${API_BASE_URL}/suppliers/${supplierId}/status`,
          { is_active: false },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        expect(statusUpdateResponse.status).toBe(200);
        expect(statusUpdateResponse.data.is_active).toBe(false);

        // Step 7: Verify inactive supplier is excluded from active listings
        const activeListResponse = await axios.get(
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

        expect(activeListResponse.status).toBe(200);
        const inactiveSupplier = activeListResponse.data.items.find(s => s.id === supplierId);
        expect(inactiveSupplier).toBeUndefined();

        // Step 8: Verify inactive supplier is included when specifically requested
        const inactiveListResponse = await axios.get(
          `${API_BASE_URL}/suppliers/`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            params: {
              is_active: false
            }
          }
        );

        expect(inactiveListResponse.status).toBe(200);
        const foundInactiveSupplier = inactiveListResponse.data.items.find(s => s.id === supplierId);
        expect(foundInactiveSupplier).toBeDefined();
        expect(foundInactiveSupplier.is_active).toBe(false);

        // Step 9: Reactivate the supplier
        const reactivateResponse = await axios.patch(
          `${API_BASE_URL}/suppliers/${supplierId}/status`,
          { is_active: true },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        expect(reactivateResponse.status).toBe(200);
        expect(reactivateResponse.data.is_active).toBe(true);

        // Step 10: Soft delete the supplier
        const deleteResponse = await axios.delete(
          `${API_BASE_URL}/suppliers/${supplierId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(deleteResponse.status).toBe(204);

        // Step 11: Verify supplier is soft deleted (can still be retrieved but marked inactive)
        const afterDeleteResponse = await axios.get(
          `${API_BASE_URL}/suppliers/${supplierId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );

        expect(afterDeleteResponse.status).toBe(200);
        expect(afterDeleteResponse.data.id).toBe(supplierId);
        expect(afterDeleteResponse.data.is_active).toBe(false);

      } catch (error) {
        // Clean up in case of failure
        if (supplierId) {
          try {
            await axios.delete(`${API_BASE_URL}/suppliers/${supplierId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        throw error;
      }
    });
  });

  describe('Bulk Operations Workflow', () => {
    test('should create, list, and delete multiple suppliers', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const supplierIds = [];

      try {
        // Step 1: Create multiple suppliers
        const supplierDataArray = [
          {
            supplier_code: `BULK1${Date.now()}`,
            company_name: 'Bulk Test Manufacturing',
            supplier_type: 'MANUFACTURER',
            supplier_tier: 'PREFERRED'
          },
          {
            supplier_code: `BULK2${Date.now()}`,
            company_name: 'Bulk Test Distribution',
            supplier_type: 'DISTRIBUTOR',
            supplier_tier: 'STANDARD'
          },
          {
            supplier_code: `BULK3${Date.now()}`,
            company_name: 'Bulk Test Services',
            supplier_type: 'SERVICE_PROVIDER',
            supplier_tier: 'RESTRICTED'
          }
        ];

        const createPromises = supplierDataArray.map(data =>
          axios.post(`${API_BASE_URL}/suppliers/`, data, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          })
        );

        const createResponses = await Promise.all(createPromises);
        
        createResponses.forEach((response, index) => {
          expect(response.status).toBe(201);
          expect(response.data.company_name).toBe(supplierDataArray[index].company_name);
          supplierIds.push(response.data.id);
        });

        // Step 2: Verify all suppliers appear in listing
        const listResponse = await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(listResponse.status).toBe(200);
        const foundSuppliers = listResponse.data.items.filter(supplier =>
          supplierIds.includes(supplier.id)
        );
        expect(foundSuppliers.length).toBe(3);

        // Step 3: Filter by different criteria
        const manufacturerResponse = await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { supplier_type: 'MANUFACTURER' }
        });

        expect(manufacturerResponse.status).toBe(200);
        const manufacturerSuppliers = manufacturerResponse.data.items.filter(supplier =>
          supplierIds.includes(supplier.id)
        );
        expect(manufacturerSuppliers.length).toBe(1);
        expect(manufacturerSuppliers[0].supplier_type).toBe('MANUFACTURER');

        // Step 4: Search functionality
        const searchResponse = await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { search: 'Bulk Test' }
        });

        expect(searchResponse.status).toBe(200);
        const searchResults = searchResponse.data.items.filter(supplier =>
          supplierIds.includes(supplier.id)
        );
        expect(searchResults.length).toBe(3);

        // Step 5: Update multiple suppliers
        const updatePromises = supplierIds.map(id =>
          axios.put(`${API_BASE_URL}/suppliers/${id}`, 
            { contact_person: 'Bulk Updated Contact' },
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
          expect(response.data.contact_person).toBe('Bulk Updated Contact');
        });

        // Step 6: Delete all suppliers
        const deletePromises = supplierIds.map(id =>
          axios.delete(`${API_BASE_URL}/suppliers/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );

        const deleteResponses = await Promise.all(deletePromises);
        deleteResponses.forEach(response => {
          expect(response.status).toBe(204);
        });

        // Step 7: Verify suppliers are soft deleted
        const retrievePromises = supplierIds.map(id =>
          axios.get(`${API_BASE_URL}/suppliers/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );

        const retrieveResponses = await Promise.all(retrievePromises);
        retrieveResponses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.data.is_active).toBe(false);
        });

      } catch (error) {
        // Clean up in case of failure
        if (supplierIds.length > 0) {
          const cleanupPromises = supplierIds.map(id =>
            axios.delete(`${API_BASE_URL}/suppliers/${id}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            }).catch(() => {}) // Ignore cleanup errors
          );
          await Promise.all(cleanupPromises);
        }
        throw error;
      }
    });
  });

  describe('Search and Filter Integration', () => {
    test('should combine search with filters effectively', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const supplierIds = [];

      try {
        // Create test suppliers with specific characteristics
        const supplierDataArray = [
          {
            supplier_code: `SEARCH1${Date.now()}`,
            company_name: 'Search Test Manufacturing Corp',
            supplier_type: 'MANUFACTURER',
            supplier_tier: 'PREFERRED',
            payment_terms: 'NET30',
            contact_person: 'John SearchTest'
          },
          {
            supplier_code: `SEARCH2${Date.now()}`,
            company_name: 'Search Test Distribution Inc',
            supplier_type: 'DISTRIBUTOR',
            supplier_tier: 'STANDARD',
            payment_terms: 'NET45',
            contact_person: 'Jane SearchTest'
          },
          {
            supplier_code: `SEARCH3${Date.now()}`,
            company_name: 'Another Manufacturing Corp',
            supplier_type: 'MANUFACTURER',
            supplier_tier: 'PREFERRED',
            payment_terms: 'NET30',
            contact_person: 'Bob Different'
          }
        ];

        const createPromises = supplierDataArray.map(data =>
          axios.post(`${API_BASE_URL}/suppliers/`, data, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          })
        );

        const createResponses = await Promise.all(createPromises);
        supplierIds.push(...createResponses.map(response => response.data.id));

        // Test 1: Search by company name + filter by type
        const searchAndFilterResponse = await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: {
            search: 'Search Test',
            supplier_type: 'MANUFACTURER'
          }
        });

        expect(searchAndFilterResponse.status).toBe(200);
        const matchingSuppliers = searchAndFilterResponse.data.items.filter(supplier =>
          supplierIds.includes(supplier.id)
        );
        
        expect(matchingSuppliers.length).toBe(1);
        expect(matchingSuppliers[0].company_name).toBe('Search Test Manufacturing Corp');
        expect(matchingSuppliers[0].supplier_type).toBe('MANUFACTURER');

        // Test 2: Search + multiple filters
        const multiFilterResponse = await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: {
            search: 'Manufacturing',
            supplier_type: 'MANUFACTURER',
            supplier_tier: 'PREFERRED',
            payment_terms: 'NET30'
          }
        });

        expect(multiFilterResponse.status).toBe(200);
        const multiFilterResults = multiFilterResponse.data.items.filter(supplier =>
          supplierIds.includes(supplier.id)
        );

        // Should find both manufacturing companies
        expect(multiFilterResults.length).toBe(2);
        multiFilterResults.forEach(supplier => {
          expect(supplier.supplier_type).toBe('MANUFACTURER');
          expect(supplier.supplier_tier).toBe('PREFERRED');
          expect(supplier.payment_terms).toBe('NET30');
        });

        // Test 3: Search by contact person + filter
        const contactSearchResponse = await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: {
            search: 'SearchTest',
            supplier_tier: 'STANDARD'
          }
        });

        expect(contactSearchResponse.status).toBe(200);
        const contactResults = contactSearchResponse.data.items.filter(supplier =>
          supplierIds.includes(supplier.id)
        );

        expect(contactResults.length).toBe(1);
        expect(contactResults[0].contact_person).toBe('Jane SearchTest');
        expect(contactResults[0].supplier_tier).toBe('STANDARD');

        // Clean up
        const deletePromises = supplierIds.map(id =>
          axios.delete(`${API_BASE_URL}/suppliers/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );
        await Promise.all(deletePromises);

      } catch (error) {
        // Clean up in case of failure
        if (supplierIds.length > 0) {
          const cleanupPromises = supplierIds.map(id =>
            axios.delete(`${API_BASE_URL}/suppliers/${id}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            }).catch(() => {})
          );
          await Promise.all(cleanupPromises);
        }
        throw error;
      }
    });
  });

  describe('Data Consistency and Validation Workflow', () => {
    test('should maintain data consistency across operations', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      let supplierId = null;

      try {
        // Create supplier with specific data
        const originalData = {
          supplier_code: `CONSIST${Date.now()}`,
          company_name: 'Consistency Test Corp',
          supplier_type: 'MANUFACTURER',
          contact_person: 'Consistency Contact',
          email: 'consistency@test.com',
          phone: '+1-555-CONST',
          address: '123 Consistency St',
          tax_id: 'TAX123CONST',
          payment_terms: 'NET30',
          credit_limit: 50000.00,
          supplier_tier: 'PREFERRED'
        };

        const createResponse = await axios.post(`${API_BASE_URL}/suppliers/`, originalData, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(createResponse.status).toBe(201);
        supplierId = createResponse.data.id;

        // Verify all fields are correctly stored
        expect(createResponse.data.supplier_code).toBe(originalData.supplier_code.toUpperCase());
        expect(createResponse.data.company_name).toBe(originalData.company_name);
        expect(createResponse.data.supplier_type).toBe(originalData.supplier_type);
        expect(parseFloat(createResponse.data.credit_limit)).toBe(originalData.credit_limit);

        // Test partial update preserving other fields
        const partialUpdate = {
          contact_person: 'Updated Contact Person'
        };

        const updateResponse = await axios.put(`${API_BASE_URL}/suppliers/${supplierId}`, partialUpdate, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.data.contact_person).toBe('Updated Contact Person');
        
        // Verify other fields remained unchanged
        expect(updateResponse.data.company_name).toBe(originalData.company_name);
        expect(updateResponse.data.email).toBe(originalData.email);
        expect(updateResponse.data.phone).toBe(originalData.phone);
        expect(parseFloat(updateResponse.data.credit_limit)).toBe(originalData.credit_limit);

        // Test that supplier appears in appropriate filtered lists
        const preferredSuppliersResponse = await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { supplier_tier: 'PREFERRED' }
        });

        expect(preferredSuppliersResponse.status).toBe(200);
        const foundPreferred = preferredSuppliersResponse.data.items.find(s => s.id === supplierId);
        expect(foundPreferred).toBeDefined();

        // Test that supplier doesn't appear in wrong filtered lists
        const restrictedSuppliersResponse = await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { supplier_tier: 'RESTRICTED' }
        });

        expect(restrictedSuppliersResponse.status).toBe(200);
        const foundRestricted = restrictedSuppliersResponse.data.items.find(s => s.id === supplierId);
        expect(foundRestricted).toBeUndefined();

        // Test status update workflow
        await axios.patch(`${API_BASE_URL}/suppliers/${supplierId}/status`, 
          { is_active: false },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Verify inactive supplier doesn't appear in active list
        const activeSuppliersResponse = await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { is_active: true }
        });

        expect(activeSuppliersResponse.status).toBe(200);
        const foundActive = activeSuppliersResponse.data.items.find(s => s.id === supplierId);
        expect(foundActive).toBeUndefined();

        // But appears in inactive list
        const inactiveSuppliersResponse = await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { is_active: false }
        });

        expect(inactiveSuppliersResponse.status).toBe(200);
        const foundInactive = inactiveSuppliersResponse.data.items.find(s => s.id === supplierId);
        expect(foundInactive).toBeDefined();
        expect(foundInactive.is_active).toBe(false);

        // Clean up
        await axios.delete(`${API_BASE_URL}/suppliers/${supplierId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

      } catch (error) {
        // Clean up in case of failure
        if (supplierId) {
          try {
            await axios.delete(`${API_BASE_URL}/suppliers/${supplierId}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        throw error;
      }
    });
  });

  describe('Performance Integration', () => {
    test('should handle complex workflow within reasonable time', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const startTime = Date.now();
      const supplierIds = [];

      try {
        // Create multiple suppliers
        const createPromises = Array.from({ length: 5 }, (_, i) => 
          axios.post(`${API_BASE_URL}/suppliers/`, {
            supplier_code: `PERF${Date.now()}${i}`,
            company_name: `Performance Test Corp ${i}`,
            supplier_type: 'MANUFACTURER',
            supplier_tier: 'STANDARD'
          }, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          })
        );

        const createResponses = await Promise.all(createPromises);
        supplierIds.push(...createResponses.map(r => r.data.id));

        // Perform various operations
        await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        await axios.get(`${API_BASE_URL}/suppliers/`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          params: { supplier_type: 'MANUFACTURER' }
        });

        // Update all suppliers
        const updatePromises = supplierIds.map(id =>
          axios.put(`${API_BASE_URL}/suppliers/${id}`, 
            { contact_person: 'Performance Contact' },
            {
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            }
          )
        );

        await Promise.all(updatePromises);

        // Retrieve all suppliers
        const retrievePromises = supplierIds.map(id =>
          axios.get(`${API_BASE_URL}/suppliers/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );

        await Promise.all(retrievePromises);

        // Delete all suppliers
        const deletePromises = supplierIds.map(id =>
          axios.delete(`${API_BASE_URL}/suppliers/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );

        await Promise.all(deletePromises);

        const endTime = Date.now();
        const totalDuration = endTime - startTime;

        // Complete workflow should finish within reasonable time
        expect(totalDuration).toBeLessThan(15000); // 15 seconds

      } catch (error) {
        // Clean up in case of failure
        if (supplierIds.length > 0) {
          const cleanupPromises = supplierIds.map(id =>
            axios.delete(`${API_BASE_URL}/suppliers/${id}`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            }).catch(() => {})
          );
          await Promise.all(cleanupPromises);
        }
        throw error;
      }
    });
  });
});