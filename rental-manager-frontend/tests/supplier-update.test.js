/**
 * Supplier Update Tests
 * Tests for updating supplier information and related functionality
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('Supplier Update Tests', () => {
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

    // Create a test supplier for update tests
    if (authToken) {
      try {
        const supplierData = {
          supplier_code: `UPD${Date.now()}`,
          company_name: 'Original Update Test Supplier Corp',
          supplier_type: 'MANUFACTURER',
          contact_person: 'Original Contact',
          email: 'original@updatetest.com',
          phone: '+1-555-ORIGINAL',
          address: '123 Original St, Test City, TC 12345',
          payment_terms: 'NET30',
          credit_limit: 15000.00,
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
    // Clean up test supplier
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

  describe('Basic Supplier Updates', () => {
    test('should update supplier company name', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        company_name: 'Updated Company Name Corp'
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.company_name).toBe('Updated Company Name Corp');
      expect(response.data.id).toBe(testSupplierId);
    });

    test('should update supplier contact information', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        contact_person: 'Updated Contact Person',
        email: 'updated.contact@test.com',
        phone: '+1-555-UPDATED'
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.contact_person).toBe('Updated Contact Person');
      expect(response.data.email).toBe('updated.contact@test.com');
      expect(response.data.phone).toBe('+1-555-UPDATED');
    });

    test('should update supplier address', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        address: '456 Updated Avenue, New City, NC 54321'
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.address).toBe('456 Updated Avenue, New City, NC 54321');
    });

    test('should update supplier type', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        supplier_type: 'DISTRIBUTOR'
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.supplier_type).toBe('DISTRIBUTOR');
    });

    test('should update supplier tax ID', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        tax_id: 'TAX987654321UPDATED'
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.tax_id).toBe('TAX987654321UPDATED');
    });
  });

  describe('Payment and Credit Updates', () => {
    test('should update payment terms', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        payment_terms: 'NET45'
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.payment_terms).toBe('NET45');
    });

    test('should update credit limit', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        credit_limit: 75000.00
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(parseFloat(response.data.credit_limit)).toBe(75000.00);
    });

    test('should update payment terms and credit limit together', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        payment_terms: 'COD',
        credit_limit: 0.00
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.payment_terms).toBe('COD');
      expect(parseFloat(response.data.credit_limit)).toBe(0.00);
    });

    test('should update supplier tier', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        supplier_tier: 'PREFERRED'
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.supplier_tier).toBe('PREFERRED');
    });
  });

  describe('Comprehensive Updates', () => {
    test('should update multiple fields at once', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        company_name: 'Comprehensive Update Corp',
        supplier_type: 'SERVICE_PROVIDER',
        contact_person: 'Comprehensive Contact',
        email: 'comprehensive@update.com',
        phone: '+1-555-COMP',
        address: '789 Comprehensive St, Update City, UC 98765',
        tax_id: 'TAX123COMP789',
        payment_terms: 'PREPAID',
        credit_limit: 100000.00,
        supplier_tier: 'RESTRICTED'
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.company_name).toBe('Comprehensive Update Corp');
      expect(response.data.supplier_type).toBe('SERVICE_PROVIDER');
      expect(response.data.contact_person).toBe('Comprehensive Contact');
      expect(response.data.email).toBe('comprehensive@update.com');
      expect(response.data.phone).toBe('+1-555-COMP');
      expect(response.data.address).toBe('789 Comprehensive St, Update City, UC 98765');
      expect(response.data.tax_id).toBe('TAX123COMP789');
      expect(response.data.payment_terms).toBe('PREPAID');
      expect(parseFloat(response.data.credit_limit)).toBe(100000.00);
      expect(response.data.supplier_tier).toBe('RESTRICTED');
    });

    test('should preserve unchanged fields during update', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      // Get current supplier data
      const getCurrentResponse = await axios.get(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const originalData = getCurrentResponse.data;

      // Update only one field
      const updateData = {
        company_name: 'Partial Update Test Corp'
      };

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.company_name).toBe('Partial Update Test Corp');
      
      // Verify other fields remain unchanged
      expect(response.data.supplier_type).toBe(originalData.supplier_type);
      expect(response.data.contact_person).toBe(originalData.contact_person);
      expect(response.data.email).toBe(originalData.email);
      expect(response.data.phone).toBe(originalData.phone);
    });
  });

  describe('Update Validation Tests', () => {
    test('should reject update with invalid supplier type', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const invalidData = {
        supplier_type: 'INVALID_TYPE'
      };

      try {
        await axios.put(
          `${API_BASE_URL}/suppliers/${testSupplierId}`,
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

    test('should reject update with invalid payment terms', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const invalidData = {
        payment_terms: 'INVALID_TERMS'
      };

      try {
        await axios.put(
          `${API_BASE_URL}/suppliers/${testSupplierId}`,
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

    test('should reject update with invalid supplier tier', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const invalidData = {
        supplier_tier: 'INVALID_TIER'
      };

      try {
        await axios.put(
          `${API_BASE_URL}/suppliers/${testSupplierId}`,
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

    test('should reject update with negative credit limit', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const invalidData = {
        credit_limit: -1000.00
      };

      try {
        await axios.put(
          `${API_BASE_URL}/suppliers/${testSupplierId}`,
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

    test('should reject update with invalid email format', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const invalidData = {
        email: 'invalid-email-format'
      };

      try {
        await axios.put(
          `${API_BASE_URL}/suppliers/${testSupplierId}`,
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

    test('should reject update with empty company name', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const invalidData = {
        company_name: ''
      };

      try {
        await axios.put(
          `${API_BASE_URL}/suppliers/${testSupplierId}`,
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

    test('should reject update with company name too long', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const invalidData = {
        company_name: 'A'.repeat(256) // Too long (max 255 characters)
      };

      try {
        await axios.put(
          `${API_BASE_URL}/suppliers/${testSupplierId}`,
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
  });

  describe('Update Authorization and Permissions', () => {
    test('should require authentication for update', async () => {
      if (!testSupplierId) {
        throw new Error('Test supplier required for this test');
      }

      const updateData = {
        company_name: 'Unauthorized Update'
      };

      try {
        await axios.put(
          `${API_BASE_URL}/suppliers/${testSupplierId}`,
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

    test('should reject update for non-existent supplier', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const updateData = {
        company_name: 'Non-Existent Update'
      };

      try {
        await axios.put(
          `${API_BASE_URL}/suppliers/${nonExistentId}`,
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

    test('should reject update with malformed supplier ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const malformedId = 'invalid-id';
      const updateData = {
        company_name: 'Malformed ID Update'
      };

      try {
        await axios.put(
          `${API_BASE_URL}/suppliers/${malformedId}`,
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

  describe('Status Updates', () => {
    let statusTestSupplierId = null;

    beforeEach(async () => {
      if (!authToken) return;

      // Create a supplier for status testing
      try {
        const supplierData = {
          supplier_code: `STAT${Date.now()}${Math.random().toString(36).substr(2, 3)}`,
          company_name: 'Status Update Test Supplier',
          supplier_type: 'MANUFACTURER',
          contact_person: 'Status Test Contact',
          email: 'status@updatetest.com'
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

    test('should preserve other data during status update', async () => {
      if (!authToken || !statusTestSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      // Get original data
      const originalResponse = await axios.get(
        `${API_BASE_URL}/suppliers/${statusTestSupplierId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const originalData = originalResponse.data;

      // Update status
      const statusResponse = await axios.patch(
        `${API_BASE_URL}/suppliers/${statusTestSupplierId}/status`,
        { is_active: false },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Verify other data is preserved
      expect(statusResponse.data.company_name).toBe(originalData.company_name);
      expect(statusResponse.data.supplier_type).toBe(originalData.supplier_type);
      expect(statusResponse.data.contact_person).toBe(originalData.contact_person);
      expect(statusResponse.data.email).toBe(originalData.email);
      expect(statusResponse.data.is_active).toBe(false); // Only this should change
    });
  });

  describe('Update Performance', () => {
    test('should update supplier within reasonable time', async () => {
      if (!authToken || !testSupplierId) {
        throw new Error('Authentication and test supplier required for this test');
      }

      const updateData = {
        company_name: 'Performance Update Test Corp',
        contact_person: 'Performance Contact'
      };

      const startTime = Date.now();

      const response = await axios.put(
        `${API_BASE_URL}/suppliers/${testSupplierId}`,
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

    test('should handle concurrent updates to different suppliers', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      // Create two test suppliers for concurrent updates
      const supplier1Data = {
        supplier_code: `CONC1${Date.now()}`,
        company_name: 'Concurrent Test Supplier 1',
        supplier_type: 'MANUFACTURER'
      };

      const supplier2Data = {
        supplier_code: `CONC2${Date.now()}`,
        company_name: 'Concurrent Test Supplier 2',
        supplier_type: 'DISTRIBUTOR'
      };

      const createPromises = [
        axios.post(`${API_BASE_URL}/suppliers/`, supplier1Data, {
          headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        }),
        axios.post(`${API_BASE_URL}/suppliers/`, supplier2Data, {
          headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        })
      ];

      const createResponses = await Promise.all(createPromises);
      const supplier1Id = createResponses[0].data.id;
      const supplier2Id = createResponses[1].data.id;

      try {
        // Update both suppliers concurrently
        const updatePromises = [
          axios.put(`${API_BASE_URL}/suppliers/${supplier1Id}`, 
            { company_name: 'Updated Concurrent Supplier 1' },
            { headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } }
          ),
          axios.put(`${API_BASE_URL}/suppliers/${supplier2Id}`, 
            { company_name: 'Updated Concurrent Supplier 2' },
            { headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } }
          )
        ];

        const updateResponses = await Promise.all(updatePromises);

        updateResponses.forEach(response => {
          expect(response.status).toBe(200);
        });

        expect(updateResponses[0].data.company_name).toBe('Updated Concurrent Supplier 1');
        expect(updateResponses[1].data.company_name).toBe('Updated Concurrent Supplier 2');
      } finally {
        // Cleanup
        const cleanupPromises = [
          axios.delete(`${API_BASE_URL}/suppliers/${supplier1Id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          }).catch(() => {}),
          axios.delete(`${API_BASE_URL}/suppliers/${supplier2Id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          }).catch(() => {})
        ];

        await Promise.all(cleanupPromises);
      }
    });
  });
});