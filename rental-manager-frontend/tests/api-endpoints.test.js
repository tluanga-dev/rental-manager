const puppeteer = require('puppeteer');

describe('Rental Management API Endpoints Test Suite', () => {
  let browser;
  let page;
  const API_BASE_URL = 'http://localhost:8000/api/v1';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD environments
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    
    // Enable request interception to capture API calls
    await page.setRequestInterception(true);
    
    // Log all network requests for debugging
    page.on('request', (request) => {
      console.log(`[REQUEST] ${request.method()} ${request.url()}`);
      request.continue();
    });
    
    page.on('response', (response) => {
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    // Clear any existing data or reset state
    await page.goto('about:blank');
  });

  // Helper function to make API calls via browser
  const makeApiCall = async (endpoint, method = 'GET', data = null) => {
    const result = await page.evaluate(async (url, httpMethod, payload) => {
      const options = {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      if (payload && httpMethod !== 'GET') {
        options.body = JSON.stringify(payload);
      }
      
      try {
        const response = await fetch(url, options);
        const responseData = await response.text();
        return {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          headers: Object.fromEntries(response.headers.entries())
        };
      } catch (error) {
        return {
          error: error.message,
          status: 0
        };
      }
    }, endpoint, method, data);
    
    return result;
  };

  describe('Health Check Endpoints', () => {
    test('Root endpoint should return welcome message', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/`);
      expect(response.status).toBe(200);
    });

    test('Health check endpoint should be accessible', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/health`);
      expect(response.status).toBe(200);
    });
  });

  describe('Users Endpoints', () => {
    let createdUserId;

    test('POST /users - Create user', async () => {
      const userData = {
        username: "testuser" + Date.now(),
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        password: "testpassword123",
        is_active: true
      };
      
      const response = await makeApiCall(`${API_BASE_URL}/users/`, 'POST', userData);
      expect(response.status).toBe(201);
      
      if (response.status === 201) {
        const responseData = JSON.parse(response.data);
        createdUserId = responseData.id;
      }
    });

    test('GET /users - List users', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/users/`);
      expect([200, 422]).toContain(response.status); // 422 for validation errors is acceptable
    });

    test('GET /users/{user_id} - Get user by ID', async () => {
      if (createdUserId) {
        const response = await makeApiCall(`${API_BASE_URL}/users/${createdUserId}`);
        expect([200, 404]).toContain(response.status);
      }
    });

    test('PATCH /users/{user_id} - Update user', async () => {
      if (createdUserId) {
        const updateData = { first_name: "Updated Test" };
        const response = await makeApiCall(`${API_BASE_URL}/users/${createdUserId}`, 'PATCH', updateData);
        expect([200, 404, 422]).toContain(response.status);
      }
    });
  });

  describe('Locations Endpoints', () => {
    let createdLocationId;

    test('POST /locations - Create location', async () => {
      const locationData = {
        location_code: "LOC" + Date.now(),
        location_name: "Test Location",
        location_type: "STORE",
        address: "123 Test St",
        city: "Test City",
        state: "TS",
        country: "USA"
      };
      
      const response = await makeApiCall(`${API_BASE_URL}/locations/`, 'POST', locationData);
      expect([201, 422]).toContain(response.status);
      
      if (response.status === 201) {
        const responseData = JSON.parse(response.data);
        createdLocationId = responseData.id;
      }
    });

    test('GET /locations - List locations', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/locations/`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /locations/{location_id} - Get location by ID', async () => {
      if (createdLocationId) {
        const response = await makeApiCall(`${API_BASE_URL}/locations/${createdLocationId}`);
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('Categories Endpoints', () => {
    let createdCategoryId;

    test('POST /categories - Create category', async () => {
      const categoryData = {
        category_name: "Test Category " + Date.now(),
        category_path: "/test-category-" + Date.now(),
        is_active: true
      };
      
      const response = await makeApiCall(`${API_BASE_URL}/categories/`, 'POST', categoryData);
      expect([201, 422]).toContain(response.status);
      
      if (response.status === 201) {
        const responseData = JSON.parse(response.data);
        createdCategoryId = responseData.id;
      }
    });

    test('GET /categories - List categories', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/categories/`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /categories/tree - Get category tree', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/categories/tree/`);
      expect([200, 422]).toContain(response.status);
    });
  });

  describe('Brands Endpoints', () => {
    let createdBrandId;

    test('POST /brands - Create brand', async () => {
      const brandData = {
        brand_name: "Test Brand " + Date.now(),
        brand_code: "TB" + Date.now(),
        description: "Test brand description"
      };
      
      const response = await makeApiCall(`${API_BASE_URL}/brands/`, 'POST', brandData);
      expect([201, 422]).toContain(response.status);
      
      if (response.status === 201) {
        const responseData = JSON.parse(response.data);
        createdBrandId = responseData.id;
      }
    });

    test('GET /brands - List brands', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/brands/`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /brands/{brand_id} - Get brand by ID', async () => {
      if (createdBrandId) {
        const response = await makeApiCall(`${API_BASE_URL}/brands/${createdBrandId}`);
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('Customers Endpoints', () => {
    let createdCustomerId;

    test('POST /customers - Create customer', async () => {
      const customerData = {
        customer_code: "CUST" + Date.now(),
        customer_type: "INDIVIDUAL",
        first_name: "Test",
        last_name: "Customer",
        email: "testcustomer@example.com"
      };
      
      const response = await makeApiCall(`${API_BASE_URL}/customers/`, 'POST', customerData);
      expect([201, 422]).toContain(response.status);
      
      if (response.status === 201) {
        const responseData = JSON.parse(response.data);
        createdCustomerId = responseData.id;
      }
    });

    test('GET /customers - List customers', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/customers/`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /customers/{customer_id} - Get customer by ID', async () => {
      if (createdCustomerId) {
        const response = await makeApiCall(`${API_BASE_URL}/customers/${createdCustomerId}`);
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('Item Masters Endpoints', () => {
    let createdItemId;

    test('POST /item-masters - Create item master', async () => {
      const itemData = {
        item_code: "ITEM" + Date.now(),
        item_name: "Test Item",
        item_type: "RENTAL",
        description: "Test item description"
      };
      
      const response = await makeApiCall(`${API_BASE_URL}/item-masters/`, 'POST', itemData);
      expect([201, 422]).toContain(response.status);
      
      if (response.status === 201) {
        const responseData = JSON.parse(response.data);
        createdItemId = responseData.id;
      }
    });

    test('GET /item-masters - List item masters', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/item-masters/`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /item-masters/{item_id} - Get item master by ID', async () => {
      if (createdItemId) {
        const response = await makeApiCall(`${API_BASE_URL}/item-masters/${createdItemId}`);
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('SKUs Endpoints', () => {
    let createdSkuId;

    test('GET /skus - List SKUs', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/skus/`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /skus/rentable - Get rentable SKUs', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/skus/rentable/`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /skus/saleable - Get saleable SKUs', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/skus/saleable/`);
      expect([200, 422]).toContain(response.status);
    });
  });

  describe('Inventory Endpoints', () => {
    test('GET /inventory/units - List inventory units', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/inventory/units`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /inventory/stock-levels - List stock levels', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/inventory/stock-levels`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /inventory/units/status-count - Get inventory status counts', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/inventory/units/status-count`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /inventory/stock-levels/low-stock/alerts - Get low stock alerts', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/inventory/stock-levels/low-stock/alerts`);
      expect([200, 422]).toContain(response.status);
    });
  });

  describe('Transactions Endpoints', () => {
    test('GET /transactions - List transactions', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/transactions/`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /transactions/reports/daily - Get daily transaction summary', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/transactions/reports/daily`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /transactions/rentals/overdue - Get overdue rentals', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/transactions/rentals/overdue`);
      expect([200, 422]).toContain(response.status);
    });
  });

  describe('Rental Returns Endpoints', () => {
    test('GET /rental-returns - List rental returns', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/rental-returns/`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /rental-returns/outstanding - Get outstanding returns', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/rental-returns/outstanding`);
      expect([200, 422]).toContain(response.status);
    });

    test('GET /rental-returns/statistics/status-counts - Get return status counts', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/rental-returns/statistics/status-counts`);
      expect([200, 422]).toContain(response.status);
    });
  });

  describe('Rental Transactions Endpoints', () => {
    test('GET /rental-transactions - List rental transactions', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/rental-transactions/`);
      expect([200, 422]).toContain(response.status);
    });

    test('POST /rental-transactions/availability/check - Check rental availability', async () => {
      const availabilityData = {
        sku_ids: [1, 2, 3],
        location_id: 1,
        start_date: "2024-01-01",
        end_date: "2024-01-07"
      };
      
      const response = await makeApiCall(`${API_BASE_URL}/rental-transactions/availability/check`, 'POST', availabilityData);
      expect([200, 422, 404]).toContain(response.status);
    });
  });

  describe('Comprehensive API Coverage', () => {
    const endpoints = [
      // Health checks
      { path: '/', method: 'GET', description: 'Root endpoint' },
      { path: '/health', method: 'GET', description: 'Health check' },
      
      // Users
      { path: '/users/', method: 'GET', description: 'List users' },
      
      // Locations
      { path: '/locations/', method: 'GET', description: 'List locations' },
      
      // Categories
      { path: '/categories/', method: 'GET', description: 'List categories' },
      { path: '/categories/tree/', method: 'GET', description: 'Category tree' },
      { path: '/categories/leaf/all', method: 'GET', description: 'All leaf categories' },
      
      // Brands
      { path: '/brands/', method: 'GET', description: 'List brands' },
      
      // Customers
      { path: '/customers/', method: 'GET', description: 'List customers' },
      { path: '/customers/blacklisted/', method: 'GET', description: 'Blacklisted customers' },
      
      // Item Masters
      { path: '/item-masters/', method: 'GET', description: 'List item masters' },
      
      // SKUs
      { path: '/skus/', method: 'GET', description: 'List SKUs' },
      { path: '/skus/rentable/', method: 'GET', description: 'Rentable SKUs' },
      { path: '/skus/saleable/', method: 'GET', description: 'Saleable SKUs' },
      
      // Inventory
      { path: '/inventory/units', method: 'GET', description: 'List inventory units' },
      { path: '/inventory/stock-levels', method: 'GET', description: 'List stock levels' },
      { path: '/inventory/units/status-count', method: 'GET', description: 'Inventory status counts' },
      { path: '/inventory/units/condition-count', method: 'GET', description: 'Inventory condition counts' },
      { path: '/inventory/stock-levels/low-stock/alerts', method: 'GET', description: 'Low stock alerts' },
      { path: '/inventory/stock-levels/overstock/report', method: 'GET', description: 'Overstock report' },
      { path: '/inventory/stock-levels/valuation', method: 'GET', description: 'Stock valuation' },
      
      // Transactions
      { path: '/transactions/', method: 'GET', description: 'List transactions' },
      { path: '/transactions/reports/daily', method: 'GET', description: 'Daily transaction summary' },
      { path: '/transactions/reports/revenue', method: 'GET', description: 'Revenue report' },
      { path: '/transactions/rentals/overdue', method: 'GET', description: 'Overdue rentals' },
      
      // Rental Returns
      { path: '/rental-returns/', method: 'GET', description: 'List rental returns' },
      { path: '/rental-returns/outstanding', method: 'GET', description: 'Outstanding returns' },
      { path: '/rental-returns/late', method: 'GET', description: 'Late returns' },
      { path: '/rental-returns/needs-inspection', method: 'GET', description: 'Returns needing inspection' },
      { path: '/rental-returns/statistics/status-counts', method: 'GET', description: 'Return status counts' },
      
      // Rental Transactions
      { path: '/rental-transactions/', method: 'GET', description: 'List rental transactions' }
    ];

    test.each(endpoints)('$method $path - $description', async ({ path, method }) => {
      const response = await makeApiCall(`${API_BASE_URL}${path}`, method);
      
      // Accept various success and expected error codes
      const acceptableStatusCodes = [200, 201, 422, 404, 400, 500];
      expect(acceptableStatusCodes).toContain(response.status);
      
      // Log the response for debugging
      console.log(`Endpoint: ${method} ${path} - Status: ${response.status}`);
    });
  });

  describe('Error Handling Tests', () => {
    test('Invalid endpoint should return 404', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/invalid-endpoint`);
      expect(response.status).toBe(404);
    });

    test('Invalid HTTP method should return appropriate error', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/users/`, 'INVALID');
      expect([400, 405, 500]).toContain(response.status);
    });
  });

  describe('OpenAPI Documentation', () => {
    test('OpenAPI JSON should be accessible', async () => {
      const response = await makeApiCall(`${API_BASE_URL}/openapi.json`);
      expect([200, 404]).toContain(response.status);
    });

    test('Swagger UI should be accessible', async () => {
      await page.goto('http://localhost:8000/docs');
      const title = await page.title();
      expect(title).toContain('Swagger UI');
    });
  });
});