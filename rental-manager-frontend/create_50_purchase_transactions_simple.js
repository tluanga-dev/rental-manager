/**
 * Simplified Purchase Transaction Creator
 * Creates 50 purchase transactions using mock/fallback data when reference data is unavailable
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class SimplePurchaseTransactionCreator {
  constructor() {
    this.baseURL = 'http://localhost:8000/api';
    this.authToken = null;
    this.createdTransactions = [];
    this.errors = [];
    this.startTime = Date.now();
    
    // Create axios client
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        config.metadata = { startTime: performance.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for timing
    this.client.interceptors.response.use(
      (response) => {
        if (response.config.metadata) {
          response.config.metadata.endTime = performance.now();
          response.config.metadata.duration = response.config.metadata.endTime - response.config.metadata.startTime;
        }
        return response;
      },
      (error) => {
        if (error.config && error.config.metadata) {
          error.config.metadata.endTime = performance.now();
          error.config.metadata.duration = error.config.metadata.endTime - error.config.metadata.startTime;
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Authenticate with demo admin credentials
   */
  async authenticate() {
    console.log('🔐 Authenticating with Demo Administrator...');
    
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      try {
        const response = await this.client.post('/auth/login', {
          username: 'admin',
          password: 'YourSecure@Password123!'
        });
        
        this.authToken = response.data.access_token;
        console.log('✅ Authentication successful');
        return true;
      } catch (error) {
        attempts++;
        if (error.response?.data?.detail === 'Rate limit exceeded') {
          const waitTime = 30 + (attempts * 10); // Exponential backoff
          console.log(`⏳ Rate limit hit, waiting ${waitTime}s before retry ${attempts}/${maxAttempts}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        } else {
          console.error('❌ Authentication failed:', error.response?.data || error.message);
          return false;
        }
      }
    }
    
    console.error('❌ Authentication failed after all retries');
    return false;
  }

  /**
   * Try to get reference data, create fallback if needed
   */
  async getOrCreateReferenceData() {
    console.log('📊 Getting reference data...');
    
    let suppliers = [];
    let locations = [];
    let items = [];

    try {
      // Try to get suppliers
      try {
        const suppliersResponse = await this.client.get('/suppliers/');
        suppliers = Array.isArray(suppliersResponse.data) 
          ? suppliersResponse.data 
          : suppliersResponse.data.items || [];
      } catch (error) {
        console.log('⚠️ Could not fetch suppliers, will create fallback');
      }

      // Try to get locations
      try {
        const locationsResponse = await this.client.get('/master-data/locations/');
        locations = Array.isArray(locationsResponse.data) 
          ? locationsResponse.data 
          : locationsResponse.data.items || [];
      } catch (error) {
        console.log('⚠️ Could not fetch locations, will create fallback');
      }

      // Try to get items
      try {
        const itemsResponse = await this.client.get('/inventory/items/');
        items = Array.isArray(itemsResponse.data) 
          ? itemsResponse.data 
          : itemsResponse.data.items || [];
      } catch (error) {
        console.log('⚠️ Could not fetch items, will create fallback');
      }

      // Create fallback data if needed
      if (suppliers.length === 0) {
        console.log('📦 Creating fallback supplier...');
        suppliers = [await this.createFallbackSupplier()];
      }

      if (locations.length === 0) {
        console.log('📍 Creating fallback location...');
        locations = [await this.createFallbackLocation()];
      }

      if (items.length === 0) {
        console.log('📋 Creating fallback items...');
        for (let i = 0; i < 10; i++) {
          items.push(await this.createFallbackItem(i));
        }
      }

      console.log(`✅ Reference data ready: ${suppliers.length} suppliers, ${locations.length} locations, ${items.length} items`);
      
      return { suppliers, locations, items };
    } catch (error) {
      throw new Error(`Failed to get reference data: ${error.message}`);
    }
  }

  /**
   * Create fallback supplier
   */
  async createFallbackSupplier() {
    const supplierData = {
      supplier_code: `FALLBACK-${Date.now()}`,
      company_name: 'Test Supplier Corp',
      supplier_type: 'MANUFACTURER',
      contact_person: 'Test Contact',
      email: 'test@supplier.com',
      phone: '+1-555-TEST',
      address: '123 Test Street, Test City, TC 12345',
      payment_terms: 'NET30',
      credit_limit: 10000.00,
      supplier_tier: 'STANDARD'
    };

    try {
      const response = await this.client.post('/suppliers/', supplierData);
      return response.data;
    } catch (error) {
      // Return mock supplier if creation fails
      return {
        id: uuidv4(),
        ...supplierData
      };
    }
  }

  /**
   * Create fallback location
   */
  async createFallbackLocation() {
    const locationData = {
      location_code: `TESTLOC-${Date.now()}`,
      location_name: 'Test Location',
      location_type: 'WAREHOUSE',
      address: '123 Test Location St',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      postal_code: '12345',
      contact_number: '+1-555-LOCATION',
      email: 'test@location.com',
      is_active: true
    };

    try {
      const response = await this.client.post('/master-data/locations/', locationData);
      return response.data;
    } catch (error) {
      // Return mock location if creation fails
      return {
        id: uuidv4(),
        ...locationData
      };
    }
  }

  /**
   * Create fallback item
   */
  async createFallbackItem(index) {
    const itemData = {
      item_code: `TESTITEM-${Date.now()}-${index}`,
      item_name: `Test Item ${index + 1}`,
      item_type: 'INVENTORY',
      purchase_price: Math.floor(Math.random() * 100) + 10,
      sale_price: Math.floor(Math.random() * 150) + 15,
      rental_rate: Math.floor(Math.random() * 50) + 5,
      minimum_stock_level: 1,
      maximum_stock_level: 100,
      is_active: true
    };

    try {
      const response = await this.client.post('/inventory/items/', itemData);
      return response.data;
    } catch (error) {
      // Return mock item if creation fails
      return {
        id: uuidv4(),
        ...itemData
      };
    }
  }

  /**
   * Generate purchase transaction data
   */
  generatePurchaseData(suppliers, locations, items, index) {
    const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    
    // Generate 5-10 items per transaction
    const itemCount = Math.floor(Math.random() * 6) + 5; // 5-10 items
    const transactionItems = [];
    
    for (let i = 0; i < itemCount; i++) {
      const item = items[Math.floor(Math.random() * items.length)];
      transactionItems.push({
        item_id: item.id,
        quantity: Math.floor(Math.random() * 10) + 1, // 1-10 quantity
        unit_cost: parseFloat((Math.random() * 100 + 10).toFixed(2)), // $10-$110
        condition: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
        notes: `Transaction ${index} - Item ${i + 1}`
      });
    }

    const purchaseDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

    return {
      supplier_id: supplier.id,
      location_id: location.id,
      purchase_date: purchaseDate.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      reference_number: `PO-${Date.now()}-${index.toString().padStart(3, '0')}`,
      notes: `Purchase transaction ${index}/50 with ${itemCount} items - Created ${new Date().toISOString()}`,
      status: 'PENDING',
      items: transactionItems
    };
  }

  /**
   * Create 50 purchase transactions
   */
  async createTransactions() {
    console.log('💫 Creating 50 purchase transactions...');
    
    try {
      // Get reference data
      const { suppliers, locations, items } = await this.getOrCreateReferenceData();
      
      // Create 50 transactions
      for (let i = 1; i <= 50; i++) {
        try {
          console.log(`📝 Creating transaction ${i}/50...`);
          
          const purchaseData = this.generatePurchaseData(suppliers, locations, items, i);
          
          const response = await this.client.post('/transactions/purchases/new', purchaseData);
          
          this.createdTransactions.push({
            index: i,
            id: response.data.id || response.data.transaction_id,
            itemCount: purchaseData.items.length,
            totalAmount: purchaseData.items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0),
            duration: response.config?.metadata?.duration,
            status: 'SUCCESS'
          });
          
          console.log(`✅ Transaction ${i} created successfully`);
          
          // Longer delay to prevent rate limiting
          if (i < 50) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          }
          
        } catch (error) {
          console.error(`❌ Failed to create transaction ${i}:`, error.response?.data || error.message);
          this.errors.push({
            index: i,
            error: error.response?.data || error.message,
            duration: error.config?.metadata?.duration
          });
        }
      }
      
    } catch (error) {
      throw new Error(`Transaction creation failed: ${error.message}`);
    }
  }

  /**
   * Generate and print report
   */
  printReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 PURCHASE TRANSACTIONS CREATION REPORT');
    console.log('='.repeat(80));
    
    console.log('\n📈 SUMMARY:');
    console.log(`  Total Requested: 50`);
    console.log(`  Total Created: ${this.createdTransactions.length}`);
    console.log(`  Total Errors: ${this.errors.length}`);
    console.log(`  Success Rate: ${((this.createdTransactions.length / 50) * 100).toFixed(2)}%`);
    console.log(`  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    
    if (this.createdTransactions.length > 0) {
      const totalItems = this.createdTransactions.reduce((sum, t) => sum + t.itemCount, 0);
      const totalValue = this.createdTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      
      console.log('\n📦 ITEM STATISTICS:');
      console.log(`  Total Items: ${totalItems}`);
      console.log(`  Avg Items/Transaction: ${(totalItems / this.createdTransactions.length).toFixed(2)}`);
      
      console.log('\n💰 FINANCIAL STATISTICS:');
      console.log(`  Total Value: $${totalValue.toFixed(2)}`);
      console.log(`  Avg Value/Transaction: $${(totalValue / this.createdTransactions.length).toFixed(2)}`);
      
      console.log('\n✅ FIRST 5 SUCCESSFUL TRANSACTIONS:');
      this.createdTransactions.slice(0, 5).forEach(t => {
        console.log(`  Transaction ${t.index}: ID=${t.id}, Items=${t.itemCount}, Value=$${t.totalAmount?.toFixed(2)}`);
      });
      if (this.createdTransactions.length > 5) {
        console.log(`  ... and ${this.createdTransactions.length - 5} more`);
      }
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.slice(0, 3).forEach(e => {
        console.log(`  Transaction ${e.index}: ${e.error}`);
      });
      if (this.errors.length > 3) {
        console.log(`  ... and ${this.errors.length - 3} more errors`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
  }

  /**
   * Main execution method
   */
  async run() {
    console.log('🎯 Starting Simplified Purchase Transaction Creation');
    console.log('📋 Goal: Create 50 purchase transactions with 5+ items each\n');
    
    try {
      // Authenticate
      const authenticated = await this.authenticate();
      if (!authenticated) {
        throw new Error('Authentication failed');
      }
      
      // Create transactions
      await this.createTransactions();
      
      // Print report
      this.printReport();
      
      console.log('\n🎉 Purchase transaction creation completed!');
      
      return {
        success: true,
        created: this.createdTransactions.length,
        errors: this.errors.length,
        transactions: this.createdTransactions
      };
      
    } catch (error) {
      console.error('\n💥 Process failed:', error.message);
      throw error;
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const creator = new SimplePurchaseTransactionCreator();
  creator.run().catch(console.error);
}

module.exports = SimplePurchaseTransactionCreator;