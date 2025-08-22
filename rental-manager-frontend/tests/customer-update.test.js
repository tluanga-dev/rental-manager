/**
 * Customer Update Tests
 * Tests for updating customer information with various scenarios
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:8001/api/v1';

describe('Customer Update Tests', () => {
  let authToken = null;
  let testCustomerId = null;
  let businessCustomerId = null;

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

    // Create test customers for update tests
    if (authToken) {
      try {
        // Create individual customer
        const individualData = {
          customer: {
            customer_type: 'INDIVIDUAL',
            first_name: 'Update',
            last_name: 'Test',
            customer_tier: 'BRONZE',
            credit_limit: 1000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'update.test@email.com',
              is_primary: true,
              opt_in_marketing: true
            }
          ],
          addresses: [
            {
              address_type: 'BOTH',
              address_line1: '123 Update St',
              city: 'Update City',
              state: 'UC',
              country: 'USA',
              postal_code: '12345',
              is_default: true
            }
          ]
        };

        const individualResponse = await axios.post(
          `${API_BASE_URL}/customers/`,
          individualData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        testCustomerId = individualResponse.data.id;

        // Create business customer
        const businessData = {
          customer: {
            customer_type: 'BUSINESS',
            business_name: 'Update Corp',
            tax_id: 'TAX123456789',
            customer_tier: 'SILVER',
            credit_limit: 5000
          },
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'info@updatecorp.com',
              is_primary: true,
              opt_in_marketing: true
            }
          ],
          addresses: [
            {
              address_type: 'BOTH',
              address_line1: '456 Business Ave',
              city: 'Business City',
              state: 'BC',
              country: 'USA',
              postal_code: '67890',
              is_default: true
            }
          ],
          contact_persons: [
            {
              contact_name: 'Business Contact',
              designation: 'Manager',
              department: 'Operations',
              is_primary: true,
              contact_methods: [
                {
                  contact_type: 'EMAIL',
                  contact_value: 'manager@updatecorp.com',
                  is_primary: true
                }
              ]
            }
          ]
        };

        const businessResponse = await axios.post(
          `${API_BASE_URL}/customers/`,
          businessData,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        businessCustomerId = businessResponse.data.id;
      } catch (error) {
        console.error('Failed to create test customers:', error.response?.data || error.message);
      }
    }
  });

  afterAll(async () => {
    // Clean up test customers
    if (authToken) {
      const cleanup = [testCustomerId, businessCustomerId].filter(Boolean);
      for (const id of cleanup) {
        try {
          await axios.delete(
            `${API_BASE_URL}/customers/${id}`,
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
    }
  });

  describe('Basic Customer Information Updates', () => {
    test('should update individual customer basic information', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        customer: {
          first_name: 'Updated',
          last_name: 'Individual',
          customer_tier: 'GOLD',
          credit_limit: 2000
        }
      };

      const response = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.first_name).toBe('Updated');
      expect(response.data.last_name).toBe('Individual');
      expect(response.data.customer_tier).toBe('GOLD');
      expect(response.data.credit_limit).toBe(2000);
      expect(response.data.customer_type).toBe('INDIVIDUAL'); // Should remain unchanged
    });

    test('should update business customer basic information', async () => {
      if (!authToken || !businessCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        customer: {
          business_name: 'Updated Corporation',
          tax_id: 'TAX987654321',
          customer_tier: 'PLATINUM',
          credit_limit: 10000
        }
      };

      const response = await axios.put(
        `${API_BASE_URL}/customers/${businessCustomerId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.business_name).toBe('Updated Corporation');
      expect(response.data.tax_id).toBe('TAX987654321');
      expect(response.data.customer_tier).toBe('PLATINUM');
      expect(response.data.credit_limit).toBe(10000);
      expect(response.data.customer_type).toBe('BUSINESS'); // Should remain unchanged
    });

    test('should not allow changing customer type', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        customer: {
          customer_type: 'BUSINESS', // Attempting to change from INDIVIDUAL to BUSINESS
          first_name: 'Should',
          last_name: 'Fail'
        }
      };

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${testCustomerId}`,
          updateData,
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
      }
    });

    test('should validate required fields for individual customers', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        customer: {
          first_name: '', // Empty required field
          last_name: 'Test'
        }
      };

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${testCustomerId}`,
          updateData,
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
        expect(error.response.status).toBe(422);
      }
    });

    test('should validate required fields for business customers', async () => {
      if (!authToken || !businessCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        customer: {
          business_name: '', // Empty required field
          tax_id: 'TAX123'
        }
      };

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${businessCustomerId}`,
          updateData,
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
        expect(error.response.status).toBe(422);
      }
    });
  });

  describe('Contact Methods Updates', () => {
    test('should update existing contact methods', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        contact_methods: [
          {
            contact_type: 'EMAIL',
            contact_value: 'updated.email@example.com',
            is_primary: true,
            opt_in_marketing: false
          },
          {
            contact_type: 'MOBILE',
            contact_value: '+9876543210',
            is_primary: false,
            opt_in_marketing: true
          }
        ]
      };

      const response = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.contact_methods).toHaveLength(2);
      
      const emailContact = response.data.contact_methods.find(c => c.contact_type === 'EMAIL');
      expect(emailContact.contact_value).toBe('updated.email@example.com');
      expect(emailContact.is_primary).toBe(true);
      expect(emailContact.opt_in_marketing).toBe(false);
      
      const mobileContact = response.data.contact_methods.find(c => c.contact_type === 'MOBILE');
      expect(mobileContact.contact_value).toBe('+9876543210');
      expect(mobileContact.opt_in_marketing).toBe(true);
    });

    test('should add new contact methods', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        contact_methods: [
          {
            contact_type: 'EMAIL',
            contact_value: 'existing@example.com',
            is_primary: true,
            opt_in_marketing: true
          },
          {
            contact_type: 'PHONE',
            contact_value: '+1-800-NEW-PHONE',
            is_primary: false,
            opt_in_marketing: false
          },
          {
            contact_type: 'FAX',
            contact_value: '+1-800-NEW-FAX',
            is_primary: false,
            opt_in_marketing: false
          }
        ]
      };

      const response = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.contact_methods).toHaveLength(3);
      
      const phoneContact = response.data.contact_methods.find(c => c.contact_type === 'PHONE');
      expect(phoneContact).toBeTruthy();
      expect(phoneContact.contact_value).toBe('+1-800-NEW-PHONE');
      
      const faxContact = response.data.contact_methods.find(c => c.contact_type === 'FAX');
      expect(faxContact).toBeTruthy();
      expect(faxContact.contact_value).toBe('+1-800-NEW-FAX');
    });

    test('should remove contact methods when not included in update', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // First, add multiple contact methods
      await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'email@example.com',
              is_primary: true,
              opt_in_marketing: true
            },
            {
              contact_type: 'MOBILE',
              contact_value: '+1234567890',
              is_primary: false,
              opt_in_marketing: false
            },
            {
              contact_type: 'PHONE',
              contact_value: '+1-800-PHONE',
              is_primary: false,
              opt_in_marketing: false
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Now update with only email contact method
      const response = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          contact_methods: [
            {
              contact_type: 'EMAIL',
              contact_value: 'onlyemail@example.com',
              is_primary: true,
              opt_in_marketing: true
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.contact_methods).toHaveLength(1);
      expect(response.data.contact_methods[0].contact_type).toBe('EMAIL');
      expect(response.data.contact_methods[0].contact_value).toBe('onlyemail@example.com');
    });

    test('should validate email format in contact methods', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        contact_methods: [
          {
            contact_type: 'EMAIL',
            contact_value: 'invalid-email-format',
            is_primary: true,
            opt_in_marketing: true
          }
        ]
      };

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${testCustomerId}`,
          updateData,
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
        expect(error.response.status).toBe(422);
      }
    });
  });

  describe('Address Updates', () => {
    test('should update existing addresses', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        addresses: [
          {
            address_type: 'BILLING',
            address_line1: '789 Updated Street',
            address_line2: 'Apt 4B',
            city: 'Updated City',
            state: 'UC',
            country: 'USA',
            postal_code: '54321',
            is_default: true
          }
        ]
      };

      const response = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.addresses).toHaveLength(1);
      
      const address = response.data.addresses[0];
      expect(address.address_type).toBe('BILLING');
      expect(address.address_line1).toBe('789 Updated Street');
      expect(address.address_line2).toBe('Apt 4B');
      expect(address.city).toBe('Updated City');
      expect(address.state).toBe('UC');
      expect(address.postal_code).toBe('54321');
      expect(address.is_default).toBe(true);
    });

    test('should add multiple addresses', async () => {
      if (!authToken || !businessCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        addresses: [
          {
            address_type: 'BILLING',
            address_line1: '123 Billing St',
            city: 'Billing City',
            state: 'BC',
            country: 'USA',
            postal_code: '11111',
            is_default: true
          },
          {
            address_type: 'SHIPPING',
            address_line1: '456 Shipping Ave',
            city: 'Shipping City',
            state: 'SC',
            country: 'USA',
            postal_code: '22222',
            is_default: false
          },
          {
            address_type: 'BOTH',
            address_line1: '789 Both Blvd',
            city: 'Both City',
            state: 'BC',
            country: 'USA',
            postal_code: '33333',
            is_default: false
          }
        ]
      };

      const response = await axios.put(
        `${API_BASE_URL}/customers/${businessCustomerId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.addresses).toHaveLength(3);
      
      const billingAddress = response.data.addresses.find(a => a.address_type === 'BILLING');
      expect(billingAddress.address_line1).toBe('123 Billing St');
      expect(billingAddress.is_default).toBe(true);
      
      const shippingAddress = response.data.addresses.find(a => a.address_type === 'SHIPPING');
      expect(shippingAddress.address_line1).toBe('456 Shipping Ave');
      expect(shippingAddress.is_default).toBe(false);
    });

    test('should validate required address fields', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        addresses: [
          {
            address_type: 'BOTH',
            // Missing required fields: address_line1, city, state, country
            postal_code: '12345',
            is_default: true
          }
        ]
      };

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${testCustomerId}`,
          updateData,
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
        expect(error.response.status).toBe(422);
      }
    });
  });

  describe('Contact Persons Updates (Business Only)', () => {
    test('should update business customer contact persons', async () => {
      if (!authToken || !businessCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        contact_persons: [
          {
            contact_name: 'Updated Manager',
            designation: 'Senior Manager',
            department: 'Updated Operations',
            is_primary: true,
            contact_methods: [
              {
                contact_type: 'EMAIL',
                contact_value: 'updated.manager@updatecorp.com',
                is_primary: true
              },
              {
                contact_type: 'MOBILE',
                contact_value: '+9876543210',
                is_primary: false
              }
            ]
          },
          {
            contact_name: 'New Assistant',
            designation: 'Assistant',
            department: 'Support',
            is_primary: false,
            contact_methods: [
              {
                contact_type: 'EMAIL',
                contact_value: 'assistant@updatecorp.com',
                is_primary: true
              }
            ]
          }
        ]
      };

      const response = await axios.put(
        `${API_BASE_URL}/customers/${businessCustomerId}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.contact_persons).toHaveLength(2);
      
      const primaryContact = response.data.contact_persons.find(cp => cp.is_primary);
      expect(primaryContact.contact_name).toBe('Updated Manager');
      expect(primaryContact.designation).toBe('Senior Manager');
      expect(primaryContact.department).toBe('Updated Operations');
      expect(primaryContact.contact_methods).toHaveLength(2);
      
      const secondaryContact = response.data.contact_persons.find(cp => !cp.is_primary);
      expect(secondaryContact.contact_name).toBe('New Assistant');
      expect(secondaryContact.contact_methods).toHaveLength(1);
    });

    test('should not allow contact persons for individual customers', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const updateData = {
        contact_persons: [
          {
            contact_name: 'Should Not Work',
            designation: 'Any',
            department: 'None',
            is_primary: true,
            contact_methods: [
              {
                contact_type: 'EMAIL',
                contact_value: 'shouldnotwork@example.com',
                is_primary: true
              }
            ]
          }
        ]
      };

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${testCustomerId}`,
          updateData,
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
      }
    });
  });

  describe('Specialized Customer Updates', () => {
    test('should update customer tier independently', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const response = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}/tier`,
        { customer_tier: 'PLATINUM' },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.customer_tier).toBe('PLATINUM');
    });

    test('should update credit limit independently', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const response = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}/credit-limit`,
        { credit_limit: 15000 },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.credit_limit).toBe(15000);
    });

    test('should manage blacklist status', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // Blacklist the customer
      const blacklistResponse = await axios.post(
        `${API_BASE_URL}/customers/${testCustomerId}/blacklist`,
        { action: 'blacklist', reason: 'Test blacklist' },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(blacklistResponse.status).toBe(200);
      expect(blacklistResponse.data.blacklist_status).toBe('BLACKLISTED');

      // Unblacklist the customer
      const unblacklistResponse = await axios.post(
        `${API_BASE_URL}/customers/${testCustomerId}/blacklist`,
        { action: 'unblacklist' },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      expect(unblacklistResponse.status).toBe(200);
      expect(unblacklistResponse.data.blacklist_status).toBe('CLEAR');
    });
  });

  describe('Update Authorization and Edge Cases', () => {
    test('should require authentication for updates', async () => {
      if (!testCustomerId) {
        throw new Error('Test customer required for this test');
      }

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${testCustomerId}`,
          { customer: { first_name: 'Unauthorized' } }
        );
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.response.status).toBe(401);
      }
    });

    test('should handle non-existent customer ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const nonExistentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${nonExistentId}`,
          { customer: { first_name: 'Non-existent' } },
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
        expect(error.response.status).toBe(404);
      }
    });

    test('should handle malformed customer ID', async () => {
      if (!authToken) {
        throw new Error('Authentication required for this test');
      }

      const malformedId = 'invalid-id';

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${malformedId}`,
          { customer: { first_name: 'Malformed' } },
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
      }
    });

    test('should validate negative credit limit', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${testCustomerId}/credit-limit`,
          { credit_limit: -5000 },
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
        expect(error.response.status).toBe(422);
      }
    });

    test('should validate invalid customer tier', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      try {
        await axios.put(
          `${API_BASE_URL}/customers/${testCustomerId}/tier`,
          { customer_tier: 'INVALID_TIER' },
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
        expect(error.response.status).toBe(422);
      }
    });
  });

  describe('Update Performance Tests', () => {
    test('should update customer within reasonable time', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      const startTime = Date.now();
      
      const response = await axios.put(
        `${API_BASE_URL}/customers/${testCustomerId}`,
        {
          customer: {
            first_name: 'Performance',
            last_name: 'Test'
          }
        },
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
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent updates gracefully', async () => {
      if (!authToken || !testCustomerId) {
        throw new Error('Authentication and test customer required for this test');
      }

      // Attempt concurrent updates
      const updatePromises = [
        axios.put(
          `${API_BASE_URL}/customers/${testCustomerId}`,
          { customer: { first_name: 'Concurrent1' } },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        axios.put(
          `${API_BASE_URL}/customers/${testCustomerId}`,
          { customer: { first_name: 'Concurrent2' } },
          {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          }
        )
      ];

      const results = await Promise.allSettled(updatePromises);

      // At least one should succeed
      const successfulResults = results.filter(result => result.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(0);

      // Any failures should be due to concurrency handling, not server errors
      const failedResults = results.filter(result => result.status === 'rejected');
      failedResults.forEach(result => {
        const error = result.reason;
        expect([409, 429]).toContain(error.response?.status);
      });
    });
  });
});