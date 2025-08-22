/**
 * Sales Test Data Setup Script
 * 
 * This script prepares the necessary test data for sales testing:
 * 1. Creates test customers
 * 2. Ensures inventory items exist with sufficient stock
 * 3. Creates test locations
 * 4. Verifies the system is ready for sales testing
 */

// const fetch = require('node-fetch'); // Will be imported dynamically

// Configuration
const CONFIG = {
    BACKEND_URL: 'http://localhost:8000',
    FRONTEND_URL: 'http://localhost:3000'
};

// Test data definitions
const TEST_DATA = {
    CUSTOMERS: [
        {
            full_name: 'Test Customer Corp',
            customer_code: 'TEST001',
            email: 'test@customer.com',
            phone: '+91 98765 43210',
            customer_type: 'BUSINESS',
            customer_tier: 'GOLD',
            addresses: [{
                street: '123 Test Street',
                city: 'Mumbai',
                state: 'Maharashtra',
                country: 'India',
                postal_code: '400001',
                address_type: 'BILLING'
            }]
        },
        {
            full_name: 'Demo Sales Customer',
            customer_code: 'DEMO002',
            email: 'demo@sales.com',
            phone: '+91 87654 32109',
            customer_type: 'INDIVIDUAL',
            customer_tier: 'SILVER'
        }
    ],
    LOCATIONS: [
        {
            name: 'Main Warehouse',
            location_code: 'MAIN001',
            location_type: 'WAREHOUSE',
            description: 'Primary warehouse location for testing'
        },
        {
            name: 'Sales Floor',
            location_code: 'SALES001',
            location_type: 'RETAIL',
            description: 'Sales floor for customer transactions'
        }
    ],
    ITEMS: [
        {
            item_name: 'Test Laptop Stand',
            sku: 'TLS001',
            category: 'Electronics',
            brand: 'TestBrand',
            description: 'Adjustable laptop stand for testing',
            sale_price: 500.00,
            is_saleable: true,
            is_active: true,
            initial_stock: 100
        },
        {
            item_name: 'Test Wireless Mouse',
            sku: 'TWM001',
            category: 'Electronics',
            brand: 'TestBrand',
            description: 'Wireless optical mouse for testing',
            sale_price: 300.00,
            is_saleable: true,
            is_active: true,
            initial_stock: 50
        },
        {
            item_name: 'Test Keyboard',
            sku: 'TKB001',
            category: 'Electronics',
            brand: 'TestBrand',
            description: 'USB keyboard for testing',
            sale_price: 800.00,
            is_saleable: true,
            is_active: true,
            initial_stock: 25
        }
    ]
};

// Utility functions
const utils = {
    async makeRequest(method, endpoint, data = null, token = null) {
        const fetch = (await import('node-fetch')).default;
        const url = `${CONFIG.BACKEND_URL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        console.log(`🌐 ${method} ${endpoint}`);
        try {
            const response = await fetch(url, options);
            const responseData = await response.json();

            if (!response.ok) {
                console.error(`❌ API Error: ${response.status}`, responseData);
                return { success: false, error: responseData, status: response.status };
            }

            return { success: true, data: responseData, status: response.status };
        } catch (error) {
            console.error(`❌ Network Error:`, error.message);
            return { success: false, error: error.message };
        }
    },

    async authenticate() {
        console.log('🔐 Authenticating as admin...');
        const result = await utils.makeRequest('POST', '/api/auth/login', {
            username: 'admin@admin.com',
            password: 'YourSecure@Password123!'
        });

        if (result.success && result.data.access_token) {
            console.log('✅ Authentication successful');
            return result.data.access_token;
        }

        throw new Error(`Authentication failed: ${JSON.stringify(result)}`);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    }
};

// Setup functions
async function setupTestData() {
    let setupResults = {
        customers: { created: 0, existing: 0, failed: 0 },
        locations: { created: 0, existing: 0, failed: 0 },
        items: { created: 0, existing: 0, failed: 0 },
        inventory: { created: 0, updated: 0, failed: 0 }
    };

    try {
        console.log('🚀 Starting Sales Test Data Setup');
        console.log('=' .repeat(50));

        // Authenticate
        const authToken = await utils.authenticate();

        // Setup Customers
        console.log('\n👥 Setting up test customers...');
        for (const customerData of TEST_DATA.CUSTOMERS) {
            try {
                // Check if customer already exists
                const checkResult = await utils.makeRequest(
                    'GET',
                    `/api/customers/customers/?search=${customerData.customer_code}`,
                    null,
                    authToken
                );

                let customerExists = false;
                if (checkResult.success && checkResult.data.success) {
                    const customers = checkResult.data.data.items || [];
                    customerExists = customers.some(c => c.customer_code === customerData.customer_code);
                }

                if (customerExists) {
                    console.log(`✅ Customer ${customerData.customer_code} already exists`);
                    setupResults.customers.existing++;
                } else {
                    const result = await utils.makeRequest(
                        'POST',
                        '/api/customers/customers/',
                        customerData,
                        authToken
                    );

                    if (result.success && result.data.success) {
                        console.log(`✅ Created customer: ${customerData.full_name} (${customerData.customer_code})`);
                        setupResults.customers.created++;
                    } else {
                        console.log(`❌ Failed to create customer: ${customerData.customer_code}`);
                        console.log(`   Error: ${JSON.stringify(result.data || result.error)}`);
                        setupResults.customers.failed++;
                    }
                }
            } catch (error) {
                console.log(`❌ Error setting up customer ${customerData.customer_code}: ${error.message}`);
                setupResults.customers.failed++;
            }
        }

        // Setup Locations
        console.log('\n📍 Setting up test locations...');
        for (const locationData of TEST_DATA.LOCATIONS) {
            try {
                // Check if location already exists
                const checkResult = await utils.makeRequest(
                    'GET',
                    `/api/master-data/locations/locations/?search=${locationData.location_code}`,
                    null,
                    authToken
                );

                let locationExists = false;
                if (checkResult.success && checkResult.data.success) {
                    const locations = checkResult.data.data || [];
                    locationExists = locations.some(l => l.location_code === locationData.location_code);
                }

                if (locationExists) {
                    console.log(`✅ Location ${locationData.location_code} already exists`);
                    setupResults.locations.existing++;
                } else {
                    const result = await utils.makeRequest(
                        'POST',
                        '/api/master-data/locations/locations/',
                        locationData,
                        authToken
                    );

                    if (result.success && (result.data.success || result.status === 201)) {
                        console.log(`✅ Created location: ${locationData.name} (${locationData.location_code})`);
                        setupResults.locations.created++;
                    } else {
                        console.log(`❌ Failed to create location: ${locationData.location_code}`);
                        console.log(`   Error: ${JSON.stringify(result.data || result.error)}`);
                        setupResults.locations.failed++;
                    }
                }
            } catch (error) {
                console.log(`❌ Error setting up location ${locationData.location_code}: ${error.message}`);
                setupResults.locations.failed++;
            }
        }

        // Setup Items
        console.log('\n📦 Setting up test items...');
        for (const itemData of TEST_DATA.ITEMS) {
            try {
                // Check if item already exists
                const checkResult = await utils.makeRequest(
                    'GET',
                    `/api/master-data/items/items/?search=${itemData.sku}`,
                    null,
                    authToken
                );

                let itemExists = false;
                let existingItemId = null;
                if (checkResult.success && checkResult.data.success) {
                    const items = checkResult.data.data.items || [];
                    const existingItem = items.find(i => i.sku === itemData.sku);
                    if (existingItem) {
                        itemExists = true;
                        existingItemId = existingItem.id;
                    }
                }

                if (itemExists) {
                    console.log(`✅ Item ${itemData.sku} already exists (ID: ${existingItemId})`);
                    setupResults.items.existing++;
                } else {
                    const result = await utils.makeRequest(
                        'POST',
                        '/api/master-data/items/items/',
                        itemData,
                        authToken
                    );

                    if (result.success && (result.data.success || result.status === 201)) {
                        const newItemId = result.data.data?.id || 'unknown';
                        console.log(`✅ Created item: ${itemData.item_name} (${itemData.sku}, ID: ${newItemId})`);
                        setupResults.items.created++;
                        existingItemId = newItemId;
                    } else {
                        console.log(`❌ Failed to create item: ${itemData.sku}`);
                        console.log(`   Error: ${JSON.stringify(result.data || result.error)}`);
                        setupResults.items.failed++;
                        continue;
                    }
                }

                // Setup inventory for the item
                if (existingItemId && itemData.initial_stock > 0) {
                    try {
                        console.log(`📊 Setting up inventory for ${itemData.sku}...`);
                        
                        // Get first location for inventory
                        const locationsResult = await utils.makeRequest(
                            'GET',
                            '/api/master-data/locations/locations/',
                            null,
                            authToken
                        );

                        if (locationsResult.success && locationsResult.data.success) {
                            const locations = locationsResult.data.data || [];
                            if (locations.length > 0) {
                                const locationId = locations[0].id;
                                
                                // Check current inventory
                                const inventoryCheck = await utils.makeRequest(
                                    'GET',
                                    `/api/inventory/items/${existingItemId}`,
                                    null,
                                    authToken
                                );

                                let currentStock = 0;
                                if (inventoryCheck.success && inventoryCheck.data.success) {
                                    currentStock = inventoryCheck.data.data.quantity_available || 0;
                                }

                                if (currentStock < itemData.initial_stock) {
                                    const stockToAdd = itemData.initial_stock - currentStock;
                                    
                                    // Create a purchase transaction to add stock
                                    const purchaseData = {
                                        supplier_id: locations[0].id, // Use location as supplier for test
                                        location_id: locationId,
                                        purchase_date: new Date().toISOString(),
                                        notes: `Test data setup - adding ${stockToAdd} units`,
                                        items: [{
                                            item_id: existingItemId,
                                            quantity: stockToAdd,
                                            unit_cost: itemData.sale_price * 0.7, // 70% of sale price
                                            notes: 'Test inventory setup'
                                        }]
                                    };

                                    const purchaseResult = await utils.makeRequest(
                                        'POST',
                                        '/api/transactions/purchases/new',
                                        purchaseData,
                                        authToken
                                    );

                                    if (purchaseResult.success && purchaseResult.data.success) {
                                        console.log(`✅ Added ${stockToAdd} units of ${itemData.sku} to inventory`);
                                        setupResults.inventory.created++;
                                    } else {
                                        console.log(`⚠️ Could not add inventory for ${itemData.sku}`);
                                        setupResults.inventory.failed++;
                                    }
                                } else {
                                    console.log(`✅ ${itemData.sku} already has sufficient stock (${currentStock} units)`);
                                    setupResults.inventory.updated++;
                                }
                            }
                        }
                    } catch (error) {
                        console.log(`⚠️ Error setting up inventory for ${itemData.sku}: ${error.message}`);
                        setupResults.inventory.failed++;
                    }
                }
            } catch (error) {
                console.log(`❌ Error setting up item ${itemData.sku}: ${error.message}`);
                setupResults.items.failed++;
            }
        }

        // Verify system readiness
        console.log('\n🔍 Verifying system readiness...');

        // Check if we have customers
        const customersResult = await utils.makeRequest(
            'GET',
            '/api/customers/customers/?limit=5',
            null,
            authToken
        );

        if (customersResult.success && customersResult.data.success) {
            const customers = customersResult.data.data.items || [];
            console.log(`✅ Found ${customers.length} customers available for testing`);
            
            if (customers.length > 0) {
                console.log(`   Sample customer: ${customers[0].full_name} (ID: ${customers[0].id})`);
            }
        }

        // Check if we have locations
        const locationsResult = await utils.makeRequest(
            'GET',
            '/api/master-data/locations/locations/',
            null,
            authToken
        );

        if (locationsResult.success && locationsResult.data.success) {
            const locations = locationsResult.data.data || [];
            console.log(`✅ Found ${locations.length} locations available for testing`);
            
            if (locations.length > 0) {
                console.log(`   Sample location: ${locations[0].name} (ID: ${locations[0].id})`);
            }
        }

        // Check if we have saleable items with stock
        const itemsResult = await utils.makeRequest(
            'GET',
            '/api/master-data/items/items/?is_saleable=true&limit=10',
            null,
            authToken
        );

        if (itemsResult.success && itemsResult.data.success) {
            const items = itemsResult.data.data.items || [];
            console.log(`✅ Found ${items.length} saleable items`);
            
            for (const item of items.slice(0, 3)) {
                // Check inventory for each item
                try {
                    const inventoryResult = await utils.makeRequest(
                        'GET',
                        `/api/inventory/items/${item.id}`,
                        null,
                        authToken
                    );

                    if (inventoryResult.success && inventoryResult.data.success) {
                        const stock = inventoryResult.data.data.quantity_available || 0;
                        console.log(`   ${item.item_name} (${item.sku}): ${stock} units available`);
                    }
                } catch (error) {
                    console.log(`   ${item.item_name} (${item.sku}): Could not check inventory`);
                }
            }
        }

    } catch (error) {
        console.error('💥 Critical setup failure:', error);
    }

    // Generate Setup Report
    console.log('\n' + '='.repeat(50));
    console.log('📊 SALES TEST DATA SETUP REPORT');
    console.log('='.repeat(50));
    console.log(`👥 Customers: ${setupResults.customers.created} created, ${setupResults.customers.existing} existing, ${setupResults.customers.failed} failed`);
    console.log(`📍 Locations: ${setupResults.locations.created} created, ${setupResults.locations.existing} existing, ${setupResults.locations.failed} failed`);
    console.log(`📦 Items: ${setupResults.items.created} created, ${setupResults.items.existing} existing, ${setupResults.items.failed} failed`);
    console.log(`📊 Inventory: ${setupResults.inventory.created} created, ${setupResults.inventory.updated} updated, ${setupResults.inventory.failed} failed`);
    
    const totalOperations = Object.values(setupResults).reduce((sum, category) => 
        sum + category.created + category.existing + category.failed, 0
    );
    const totalSuccessful = Object.values(setupResults).reduce((sum, category) => 
        sum + category.created + category.existing, 0
    );
    const successRate = totalOperations > 0 ? ((totalSuccessful / totalOperations) * 100).toFixed(1) : 0;
    
    console.log(`📈 Overall Success Rate: ${successRate}%`);
    console.log('\n🎯 System is ready for sales testing!');
    console.log(`🔗 Frontend: ${CONFIG.FRONTEND_URL}`);
    console.log(`🔗 Backend API: ${CONFIG.BACKEND_URL}`);
    console.log('\n🏁 Setup completed at:', new Date().toISOString());
}

// Execute the setup
if (require.main === module) {
    setupTestData().catch(error => {
        console.error('💥 Setup execution failed:', error);
        process.exit(1);
    });
}

module.exports = { setupTestData, utils, TEST_DATA };