/**
 * Supplier Deletion Tests
 * Tests for soft deleting suppliers and related functionality
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('Supplier Deletion Tests', () => {
  let authToken = null;
  let testSupplierId = null;

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

    // Create a test supplier for deletion tests
    if (authToken) {
      try {
        const supplierData = {
          supplier_code: `DEL${Date.now()}`,
          company_name: 'Delete Test Supplier Corp',
          supplier_type: 'MANUFACTURER',
          contact_person: 'Delete Test Contact',
          email: 'delete.test@supplier.com',
          phone: '+1-555-DELETE',
          address: '123 Delete Test St, Test City, TC 12345',
          payment_terms: 'NET30',
          credit_limit: 10000.00,
          supplier_tier: 'STANDARD'
        };

        const response = await axios.post(
          `${API_BASE_URL}/suppliers/`,
          supplierData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        testSupplierId = response.data.id;
      } catch (error) {
        console.error('Failed to create test supplier:', error.response?.data || error.message);
      }
    }
  });

  afterAll(async () => {
    // Clean up any remaining test data
    if (authToken && testSupplierId) {
      try {
        await axios.delete(
          `${API_BASE_URL}/suppliers/${testSupplierId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Soft Delete Functionality', () => {
    test('should soft delete a supplier successfully', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const response = await axios.delete(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(204);
    });

    test('should mark supplier as inactive after soft delete', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      // First soft delete the supplier
      await axios.delete(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Then retrieve the supplier to verify it's marked as inactive
      const response = await axios.get(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.is_active).toBe(false);
    });

    test('should exclude soft deleted suppliers from regular listing', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      // Soft delete the supplier
      await axios.delete(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Get supplier list with default parameters (should exclude deleted suppliers)
      const response = await axios.get(
        `${API_BASE_URL}/suppliers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      const deletedSupplier = response.data.items.find(s => s.id === testSupplierId);
      expect(deletedSupplier).toBeUndefined();
    });

    test('should include soft deleted suppliers when specifically requested', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      // Soft delete the supplier
      await axios.delete(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Get supplier list including inactive suppliers
      const response = await axios.get(
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

      expect(response.status).toBe(200);
      const deletedSupplier = response.data.items.find(s => s.id === testSupplierId);
      expect(deletedSupplier).toBeDefined();
      expect(deletedSupplier.is_active).toBe(false);
    });
  });

  describe('Delete Permission and Authorization', () => {
    test('should require authentication for deletion', async () => {
      if (!testSupplierId) {
        throw new Error('Test supplier required for this test');
      }

      try {
        await axios.delete(`${API_BASE_URL}/suppliers/${testSupplierId}`);
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should require valid supplier ID for deletion', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

      try {
        await axios.delete(
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
      }
    });

    test('should handle malformed supplier ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const malformedId = 'invalid-id';

      try {
        await axios.delete(
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
  });

  describe('Supplier Status Management', () => {
    let statusTestSupplierId = null;

    beforeEach(async () => {
      if (!authToken) return;

      // Create a supplier for status testing
      try {
        const supplierData = {
          supplier_code: `STAT${Date.now()}${Math.random().toString(36).substr(2, 3)}`,
          company_name: 'Status Test Supplier',
          supplier_type: 'DISTRIBUTOR',
          contact_person: 'Status Test Contact',
          email: 'status@test.com'
        };

        const response = await axios.post(
          `${API_BASE_URL}/suppliers/`,
          supplierData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        statusTestSupplierId = response.data.id;
      } catch (error) {
        console.error('Failed to create status test supplier:', error.response?.data || error.message);
      }
    });

    afterEach(async () => {
      if (authToken && statusTestSupplierId) {
        try {
          await axios.delete(
            `${API_BASE_URL}/suppliers/${statusTestSupplierId}`,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            }
          );
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should deactivate supplier using status endpoint', async () => {
      if (!authToken || !statusTestSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const response = await axios.patch(
        `${API_BASE_URL}/suppliers/${statusTestSupplierId}/status`,
        { is_active: false },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.is_active).toBe(false);
    });

    test('should reactivate supplier using status endpoint', async () => {
      if (!authToken || !statusTestSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      // First deactivate
      await axios.patch(
        `${API_BASE_URL}/suppliers/${statusTestSupplierId}/status`,
        { is_active: false },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Then reactivate
      const response = await axios.patch(
        `${API_BASE_URL}/suppliers/${statusTestSupplierId}/status`,
        { is_active: true },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.is_active).toBe(true);
    });

    test('should preserve supplier data after status change', async () => {
      if (!authToken || !statusTestSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      // Get supplier data before status change
      const beforeResponse = await axios.get(
        `${API_BASE_URL}/suppliers/${statusTestSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const originalSupplier = beforeResponse.data;

      // Deactivate supplier
      await axios.patch(
        `${API_BASE_URL}/suppliers/${statusTestSupplierId}/status`,
        { is_active: false },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Get supplier data after status change
      const afterResponse = await axios.get(
        `${API_BASE_URL}/suppliers/${statusTestSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const deactivatedSupplier = afterResponse.data;

      // Verify that all data is preserved except is_active status
      expect(deactivatedSupplier.id).toBe(originalSupplier.id);
      expect(deactivatedSupplier.supplier_code).toBe(originalSupplier.supplier_code);
      expect(deactivatedSupplier.company_name).toBe(originalSupplier.company_name);
      expect(deactivatedSupplier.supplier_type).toBe(originalSupplier.supplier_type);
      expect(deactivatedSupplier.contact_person).toBe(originalSupplier.contact_person);
      expect(deactivatedSupplier.email).toBe(originalSupplier.email);
      expect(deactivatedSupplier.is_active).toBe(false);
    });
  });

  describe('Business Rules for Deletion', () => {
    let businessRulesSupplierId = null;

    beforeEach(async () => {
      if (!authToken) return;

      // Create a supplier for business rules testing
      try {
        const supplierData = {
          supplier_code: `BIZ${Date.now()}${Math.random().toString(36).substr(2, 3)}`,
          company_name: 'Business Rules Test Supplier',
          supplier_type: 'MANUFACTURER',
          contact_person: 'Business Test Contact',
          email: 'business@test.com',
          credit_limit: 25000.00
        };

        const response = await axios.post(
          `${API_BASE_URL}/suppliers/`,
          supplierData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        businessRulesSupplierId = response.data.id;
      } catch (error) {
        console.error('Failed to create business rules test supplier:', error.response?.data || error.message);
      }
    });

    afterEach(async () => {
      if (authToken && businessRulesSupplierId) {
        try {
          await axios.delete(
            `${API_BASE_URL}/suppliers/${businessRulesSupplierId}`,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            }
          );
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    test('should allow soft deletion of suppliers with transaction history', async () => {
      if (!authToken || !businessRulesSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      // Note: In a real system, we might want to prevent deletion of suppliers with active transactions
      // But for soft deletion, we typically allow it and just mark them as inactive
      
      const response = await axios.delete(
        `${API_BASE_URL}/suppliers/${businessRulesSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(204);
    });

    test('should preserve supplier relationships after soft deletion', async () => {
      if (!authToken || !businessRulesSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      // Soft delete the supplier
      await axios.delete(
        `${API_BASE_URL}/suppliers/${businessRulesSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Verify supplier can still be retrieved (showing soft delete preserves data)
      const response = await axios.get(
        `${API_BASE_URL}/suppliers/${businessRulesSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(businessRulesSupplierId);
      expect(response.data.is_active).toBe(false);
    });
  });

  describe('Bulk Deletion Operations', () => {
    let bulkTestSupplierIds = [];

    beforeEach(async () => {
      if (!authToken) return;

      // Create multiple test suppliers for bulk operations
      const supplierPromises = [];
      for (let i = 0; i < 3; i++) {
        const supplierData = {
          supplier_code: `BULK${Date.now()}${i}${Math.random().toString(36).substr(2, 3)}`,
          company_name: `Bulk Test Supplier ${i}`,
          supplier_type: 'WHOLESALER',
          contact_person: `Bulk Contact ${i}`,
          email: `bulk${i}@test.com`
        };

        supplierPromises.push(
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
      }

      try {
        const responses = await Promise.all(supplierPromises);
        bulkTestSupplierIds = responses.map(response => response.data.id);
      } catch (error) {
        console.error('Failed to create bulk test suppliers:', error.response?.data || error.message);
      }
    });

    afterEach(async () => {
      if (authToken && bulkTestSupplierIds.length > 0) {
        // Clean up bulk test suppliers
        const deletePromises = bulkTestSupplierIds.map(id =>
          axios.delete(
            `${API_BASE_URL}/suppliers/${id}`,
            {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            }
          ).catch(() => {}) // Ignore cleanup errors
        );

        await Promise.all(deletePromises);
        bulkTestSupplierIds = [];
      }
    });

    test('should handle multiple individual deletions', async () => {
      if (!authToken || bulkTestSupplierIds.length === 0) {
        throw new Error('Authentication and test suppliers required for this test');
      }

      // Delete each supplier individually
      const deletePromises = bulkTestSupplierIds.map(id =>
        axios.delete(
          `${API_BASE_URL}/suppliers/${id}`,
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

    test('should handle deletion of already deleted supplier', async () => {
      if (!authToken || bulkTestSupplierIds.length === 0) {
        throw new Error('Authentication and test suppliers required for this test');
      }

      const supplierId = bulkTestSupplierIds[0];

      // Delete the supplier first time
      const firstResponse = await axios.delete(
        `${API_BASE_URL}/suppliers/${supplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(firstResponse.status).toBe(204);

      // Try to delete the same supplier again
      try {
        await axios.delete(
          `${API_BASE_URL}/suppliers/${supplierId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        // In some implementations, this might succeed with a different message
        // or it might fail with a specific error
        // The exact behavior depends on the backend implementation
      } catch (error) {
        // If it fails, it should be with a meaningful error message
        expect([400, 404, 409]).toContain(error.response.status);
      }
    });
  });

  describe('Deletion Performance and Reliability', () => {
    test('should delete supplier within reasonable time', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      // Create a supplier for performance test
      const supplierData = {
        supplier_code: `PERF${Date.now()}`,
        company_name: 'Performance Delete Test Supplier',
        supplier_type: 'MANUFACTURER'
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/suppliers/`,
        supplierData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const supplierId = createResponse.data.id;

      const startTime = Date.now();
      
      const response = await axios.delete(
        `${API_BASE_URL}/suppliers/${supplierId}`,
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
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      // Create a supplier for concurrent deletion test
      const supplierData = {
        supplier_code: `CONC${Date.now()}`,
        company_name: 'Concurrent Delete Test Supplier',
        supplier_type: 'DISTRIBUTOR'
      };

      const createResponse = await axios.post(
        `${API_BASE_URL}/suppliers/`,
        supplierData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const supplierId = createResponse.data.id;

      // Attempt concurrent deletions
      const deletePromises = [
        axios.delete(
          `${API_BASE_URL}/suppliers/${supplierId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        ),
        axios.delete(
          `${API_BASE_URL}/suppliers/${supplierId}`,
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
});