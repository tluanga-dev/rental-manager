/**
 * Customer Creation Tests
 * Tests for creating customers with various scenarios
 */

const axios = require('axios');

// Test data for creating customers (matching actual API schema)
const testCustomerData = {
  individual: {
    customer_code: 'IND001',
    customer_type: 'INDIVIDUAL',
    first_name: 'John',
    last_name: 'Doe',
    customer_tier: 'BRONZE',
    credit_limit: 1000
  },
  
  business: {
    customer_code: 'BUS001',
    customer_type: 'BUSINESS',
    business_name: 'Acme Corporation',
    tax_id: 'TAX123456789',
    customer_tier: 'SILVER',
    credit_limit: 5000
  }
};

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('Customer Creation Tests', () => {
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

  afterAll(async () => {
    // Clean up created customers
    if (authToken) {
      try {
        console.log('Test cleanup completed');
      } catch (error) {
        console.error('Cleanup failed:', error.message);
      }
    }
  });

  describe('Individual Customer Creation', () => {
    test('should create individual customer with basic information', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const customerData = {
        ...testCustomerData.individual,
        customer_code: `IND${Date.now()}` // Unique code for each test
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

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.customer_code).toBe(customerData.customer_code);
      expect(response.data.customer_type).toBe('INDIVIDUAL');
      expect(response.data.first_name).toBe('John');
      expect(response.data.last_name).toBe('Doe');
      expect(response.data.customer_tier).toBe('BRONZE');
      expect(parseFloat(response.data.credit_limit)).toBe(1000);
      expect(response.data.is_active).toBe(true);
    });

    test('should create individual customer with default tier', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const customerData = {
        customer_code: `IND${Date.now()}`,
        customer_type: 'INDIVIDUAL',
        first_name: 'Jane',
        last_name: 'Smith'
        // No tier specified, should default to BRONZE
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

      expect(response.status).toBe(201);
      expect(response.data.customer_tier).toBe('BRONZE');
      expect(parseFloat(response.data.credit_limit)).toBe(0);
    });

    test('should reject individual customer without required fields', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const invalidData = {
        customer_code: `INV${Date.now()}`,
        customer_type: 'INDIVIDUAL',
        // Missing first_name and last_name
        customer_tier: 'BRONZE',
        credit_limit: 1000
      };

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
        expect([400, 422]).toContain(error.response.status);
        expect(error.response.data.detail).toBeDefined();
      }
    });

    test('should reject individual customer without customer_code', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const invalidData = {
        customer_type: 'INDIVIDUAL',
        first_name: 'Test',
        last_name: 'User'
        // Missing customer_code
      };

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
        expect([400, 422]).toContain(error.response.status);
        expect(error.response.data.detail).toBeDefined();
      }
    });
  });

  describe('Business Customer Creation', () => {
    test('should create business customer with basic information', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const customerData = {
        customer_code: `B${Math.random().toString(36).substr(2, 8)}`, // Shorter unique code
        customer_type: 'BUSINESS',
        business_name: 'Test Corporation',
        tax_id: `TAX${Math.random().toString(36).substr(2, 8)}`,
        customer_tier: 'SILVER',
        credit_limit: 5000
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

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.customer_code).toBe(customerData.customer_code);
      expect(response.data.customer_type).toBe('BUSINESS');
      expect(response.data.business_name).toBe('Test Corporation');
      expect(response.data.tax_id).toBe(customerData.tax_id);
      expect(response.data.customer_tier).toBe('SILVER');
      expect(parseFloat(response.data.credit_limit)).toBe(5000);
      expect(response.data.is_active).toBe(true);
    });

    test('should create business customer without tax_id', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const customerData = {
        customer_code: `BUS${Date.now()}`,
        customer_type: 'BUSINESS',
        business_name: 'Simple Corp',
        customer_tier: 'BRONZE',
        credit_limit: 2000
        // No tax_id (optional field)
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

      expect(response.status).toBe(201);
      expect(response.data.business_name).toBe('Simple Corp');
      expect(response.data.tax_id).toBeNull();
    });

    test('should reject business customer without business name', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const invalidData = {
        customer_code: `INV${Date.now()}`,
        customer_type: 'BUSINESS',
        // Missing business_name
        tax_id: 'TAX123456789',
        customer_tier: 'SILVER',
        credit_limit: 5000
      };

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
        expect([400, 422]).toContain(error.response.status);
        expect(error.response.data.detail).toBeDefined();
      }
    });
  });

  describe('Customer Creation Edge Cases', () => {
    test('should handle invalid customer type', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const invalidData = {
        customer_code: `INV${Date.now()}`,
        customer_type: 'INVALID_TYPE',
        first_name: 'Test',
        last_name: 'User',
        customer_tier: 'BRONZE',
        credit_limit: 1000
      };

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
        expect([400, 422]).toContain(error.response.status);
        expect(error.response.data.detail).toBeDefined();
      }
    });

    test('should handle negative credit limit', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const invalidData = {
        customer_code: `INV${Date.now()}`,
        customer_type: 'INDIVIDUAL',
        first_name: 'Test',
        last_name: 'User',
        customer_tier: 'BRONZE',
        credit_limit: -1000
      };

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
        expect([400, 422]).toContain(error.response.status);
        expect(error.response.data.detail).toBeDefined();
      }
    });

    test('should handle invalid customer tier', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const invalidData = {
        customer_code: `INV${Date.now()}`,
        customer_type: 'INDIVIDUAL',
        first_name: 'Test',
        last_name: 'User',
        customer_tier: 'INVALID_TIER',
        credit_limit: 1000
      };

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
        expect([400, 422]).toContain(error.response.status);
        expect(error.response.data.detail).toBeDefined();
      }
    });

    test('should handle duplicate customer code', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const customerData = {
        customer_code: `DUP${Date.now()}`,
        customer_type: 'INDIVIDUAL',
        first_name: 'First',
        last_name: 'Customer',
        customer_tier: 'BRONZE',
        credit_limit: 1000
      };

      // Create first customer
      await axios.post(
        `${API_BASE_URL}/customers/`,
        customerData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Try to create second customer with same code
      const duplicateData = {
        ...customerData,
        first_name: 'Second',
        last_name: 'Customer'
      };

      try {
        await axios.post(
          `${API_BASE_URL}/customers/`,
          duplicateData,
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
        expect([400, 409, 422]).toContain(error.response.status);
      }
    });

    test('should handle customer_code too long', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const invalidData = {
        customer_code: 'A'.repeat(21), // Too long (max 20 characters)
        customer_type: 'INDIVIDUAL',
        first_name: 'Test',
        last_name: 'User',
        customer_tier: 'BRONZE',
        credit_limit: 1000
      };

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
        expect([400, 422]).toContain(error.response.status);
        expect(error.response.data.detail).toBeDefined();
      }
    });
  });

  describe('Customer Creation Performance', () => {
    test('should create customer within reasonable time', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const customerData = {
        customer_code: `PERF${Date.now()}`,
        customer_type: 'INDIVIDUAL',
        first_name: 'Performance',
        last_name: 'Test',
        customer_tier: 'BRONZE',
        credit_limit: 1000
      };

      const startTime = Date.now();
      
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

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent customer creation', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const timestamp = Date.now();
      
      // Create multiple customers concurrently
      const customerData1 = {
        customer_code: `CON1${timestamp}`,
        customer_type: 'INDIVIDUAL',
        first_name: 'Concurrent1',
        last_name: 'Test',
        customer_tier: 'BRONZE',
        credit_limit: 1000
      };

      const customerData2 = {
        customer_code: `CON2${timestamp}`,
        customer_type: 'INDIVIDUAL',
        first_name: 'Concurrent2',
        last_name: 'Test',
        customer_tier: 'BRONZE',
        credit_limit: 1000
      };

      const promises = [
        axios.post(
          `${API_BASE_URL}/customers/`,
          customerData1,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        axios.post(
          `${API_BASE_URL}/customers/`,
          customerData2,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
      ];

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
      });

      // Verify that both customers have different IDs
      expect(responses[0].data.id).not.toBe(responses[1].data.id);
      expect(responses[0].data.customer_code).not.toBe(responses[1].data.customer_code);
    });
  });
});