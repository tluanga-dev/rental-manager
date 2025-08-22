/**
 * Customer Deletion Tests
 * Tests for soft deleting customers and related functionality
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('Customer Deletion Tests', () => {
  let authToken = null;
  let testCustomerId = null;

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

    // Create a test customer for deletion tests
    if (authToken) {
      try {
        const customerData = {
          customer: {
            customer_type: 'INDIVIDUAL',
            first_name: 'Delete',
            last_name: 'Test',
            customer_tier: 'BRONZE',
            credit_limit: 1000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'delete.test@email.com',
              is_primary: true,
              opt_in_marketing: true
            }
          ],
          addresses: [
            {
              address_type: 'BOTH',
              address_line1: '123 Delete St',
              city: 'Test City',
              state: 'TS',
              country: 'USA',
              postal_code: '12345',
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
      } catch (error) {
        console.error('Failed to create test customer:', error.response?.data || error.message);
      }
    }
  });

  afterAll(async () => {
    // Clean up any remaining test data
    if (authToken && testCustomerId) {
      try {
        await axios.delete(
          `${API_BASE_URL}/customers/${testCustomerId}`,
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
    test('should soft delete a customer successfully', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const response = await axios.delete(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Customer soft deleted successfully');
      expect(response.data.customer_id).toBe(testCustomerId);
    });

    test('should mark customer as inactive after soft delete', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // First soft delete the customer
      await axios.delete(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Then retrieve the customer to verify it's marked as inactive
      const response = await axios.get(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.is_active).toBe(false);
    });

    test('should exclude soft deleted customers from regular listing', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // Soft delete the customer
      await axios.delete(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Get customer list with default parameters (should exclude deleted customers)
      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      const deletedCustomer = response.data.customers.find(c => c.id === testCustomerId);
      expect(deletedCustomer).toBeUndefined();
    });

    test('should include soft deleted customers when specifically requested', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // Soft delete the customer
      await axios.delete(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Get customer list including inactive customers
      const response = await axios.get(
        `${API_BASE_URL}/customers/`,
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
      const deletedCustomer = response.data.customers.find(c => c.id === testCustomerId);
      expect(deletedCustomer).toBeDefined();
      expect(deletedCustomer.is_active).toBe(false);
    });
  });

  describe('Delete Permission and Authorization', () => {
    test('should require authentication for deletion', async () => {
      if (!testCustomerId) {
        throw new Error('Test customer required for this test');
      }

      try {
        await axios.delete(`${API_BASE_URL}/customers/${testCustomerId}`);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should require valid customer ID for deletion', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

      try {
        await axios.delete(
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
        await axios.delete(
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
  });

  describe('Business Rules for Deletion', () => {
    let customerWithTransactionsId = null;

    beforeEach(async () => {
      if (!authToken) return;

      // Create a customer that might have transactions
      try {
        const customerData = {
          customer: {
            customer_type: 'INDIVIDUAL',
            first_name: 'Transaction',
            last_name: 'Customer',
            customer_tier: 'BRONZE',
            credit_limit: 1000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'transaction.customer@email.com',
              is_primary: true,
              opt_in_marketing: true
            }
          ],
          addresses: [
            {
              address_type: 'BOTH',
              address_line1: '123 Transaction St',
              city: 'Test City',
              state: 'TS',
              country: 'USA',
              postal_code: '12345',
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

        customerWithTransactionsId = response.data.id;
      } catch (error) {
        console.error('Failed to create customer with transactions:', error.response?.data || error.message);
      }
    });

    afterEach(async () => {
      if (authToken && customerWithTransactionsId) {
        try {
          await axios.delete(
            `${API_BASE_URL}/customers/${customerWithTransactionsId}`,
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

    test('should allow soft deletion of customers with transaction history', async () => {
      if (!authToken || !customerWithTransactionsId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // Note: In a real system, we might want to prevent deletion of customers with active transactions
      // But for soft deletion, we typically allow it and just mark them as inactive
      
      const response = await axios.delete(
        `${API_BASE_URL}/customers/${customerWithTransactionsId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.message).toBe('Customer soft deleted successfully');
    });

    test('should preserve customer data after soft deletion', async () => {
      if (!authToken || !customerWithTransactionsId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // Get customer data before deletion
      const beforeResponse = await axios.get(
        `${API_BASE_URL}/customers/${customerWithTransactionsId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const originalCustomer = beforeResponse.data;

      // Soft delete the customer
      await axios.delete(
        `${API_BASE_URL}/customers/${customerWithTransactionsId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      // Get customer data after deletion
      const afterResponse = await axios.get(
        `${API_BASE_URL}/customers/${customerWithTransactionsId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const deletedCustomer = afterResponse.data;

      // Verify that all data is preserved except is_active status
      expect(deletedCustomer.id).toBe(originalCustomer.id);
      expect(deletedCustomer.first_name).toBe(originalCustomer.first_name);
      expect(deletedCustomer.last_name).toBe(originalCustomer.last_name);
      expect(deletedCustomer.contact_methods).toEqual(originalCustomer.contact_methods);
      expect(deletedCustomer.addresses).toEqual(originalCustomer.addresses);
      expect(deletedCustomer.is_active).toBe(false);
    });
  });

  describe('Bulk Deletion Operations', () => {
    let bulkTestCustomerIds = [];

    beforeEach(async () => {
      if (!authToken) return;

      // Create multiple test customers for bulk operations
      const customerPromises = [];
      for (let i = 0; i < 3; i++) {
        const customerData = {
          customer: {
            customer_type: 'INDIVIDUAL',
            first_name: `Bulk${i}`,
            last_name: 'Test',
            customer_tier: 'BRONZE',
            credit_limit: 1000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: `bulk${i}.test@email.com`,
              is_primary: true,
              opt_in_marketing: true
            }
          ],
          addresses: [
            {
              address_type: 'BOTH',
              address_line1: `${i} Bulk St`,
              city: 'Test City',
              state: 'TS',
              country: 'USA',
              postal_code: '12345',
              is_default: true
            }
          ]
        };

        customerPromises.push(
          axios.post(
            `${API_BASE_URL}/customers/`,
            customerData,
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
        const responses = await Promise.all(customerPromises);
        bulkTestCustomerIds = responses.map(response => response.data.id);
      } catch (error) {
        console.error('Failed to create bulk test customers:', error.response?.data || error.message);
      }
    });

    afterEach(async () => {
      if (authToken && bulkTestCustomerIds.length > 0) {
        // Clean up bulk test customers
        const deletePromises = bulkTestCustomerIds.map(id =>
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
        bulkTestCustomerIds = [];
      }
    });

    test('should handle multiple individual deletions', async () => {
      if (!authToken || bulkTestCustomerIds.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      // Delete each customer individually
      const deletePromises = bulkTestCustomerIds.map(id =>
        axios.delete(
          `${API_BASE_URL}/customers/${id}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        )
      );

      const responses = await Promise.all(deletePromises);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.data.message).toBe('Customer soft deleted successfully');
        expect(response.data.customer_id).toBe(bulkTestCustomerIds[index]);
      });
    });

    test('should handle deletion of already deleted customer', async () => {
      if (!authToken || bulkTestCustomerIds.length === 0) {
        throw new Error('Authentication and test customers required for this test');
      }

      const customerId = bulkTestCustomerIds[0];

      // Delete the customer first time
      const firstResponse = await axios.delete(
        `${API_BASE_URL}/customers/${customerId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      expect(firstResponse.status).toBe(200);

      // Try to delete the same customer again
      try {
        await axios.delete(
          `${API_BASE_URL}/customers/${customerId}`,
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
    test('should delete customer within reasonable time', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const startTime = Date.now();
      
      const response = await axios.delete(
        `${API_BASE_URL}/customers/${testCustomerId}`,
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

    test('should handle concurrent deletion attempts', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      // Create a customer for concurrent deletion test
      const customerData = {
        customer: {
          customer_type: 'INDIVIDUAL',
          first_name: 'Concurrent',
          last_name: 'Delete',
          customer_tier: 'BRONZE',
          credit_limit: 1000
        },
        contact_methods: [
          {
            contact_type: 'EMAIL',
            contact_value: 'concurrent.delete@email.com',
            is_primary: true,
            opt_in_marketing: true
          }
        ],
        addresses: [
          {
            address_type: 'BOTH',
            address_line1: '123 Concurrent St',
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
        customerData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const customerId = createResponse.data.id;

      // Attempt concurrent deletions
      const deletePromises = [
        axios.delete(
          `${API_BASE_URL}/customers/${customerId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        ),
        axios.delete(
          `${API_BASE_URL}/customers/${customerId}`,
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