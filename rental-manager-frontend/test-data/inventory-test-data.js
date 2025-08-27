/**
 * Inventory Test Data Generator
 * Generates comprehensive test data for inventory feature testing
 */

class InventoryTestDataGenerator {
  constructor() {
    this.categories = [];
    this.brands = [];
    this.locations = [];
    this.items = [];
    this.inventoryUnits = [];
    this.stockLevels = [];
    this.stockMovements = [];
  }

  // Generate test categories
  generateCategories() {
    this.categories = [
      {
        id: 'electronics',
        name: 'Electronics',
        description: 'Electronic equipment and devices',
        parent_id: null
      },
      {
        id: 'cameras',
        name: 'Cameras',
        description: 'Digital and film cameras',
        parent_id: 'electronics'
      },
      {
        id: 'audio',
        name: 'Audio Equipment',
        description: 'Microphones, speakers, audio gear',
        parent_id: 'electronics'
      },
      {
        id: 'furniture',
        name: 'Furniture',
        description: 'Tables, chairs, and furniture items',
        parent_id: null
      },
      {
        id: 'lighting',
        name: 'Lighting',
        description: 'Professional lighting equipment',
        parent_id: 'electronics'
      },
      {
        id: 'computers',
        name: 'Computers',
        description: 'Laptops, desktops, and computer equipment',
        parent_id: 'electronics'
      }
    ];
    return this.categories;
  }

  // Generate test brands
  generateBrands() {
    this.brands = [
      {
        id: 'canon',
        name: 'Canon',
        description: 'Professional camera and imaging equipment',
        website: 'https://canon.com',
        is_active: true
      },
      {
        id: 'sony',
        name: 'Sony',
        description: 'Consumer and professional electronics',
        website: 'https://sony.com',
        is_active: true
      },
      {
        id: 'apple',
        name: 'Apple',
        description: 'Premium consumer electronics',
        website: 'https://apple.com',
        is_active: true
      },
      {
        id: 'bose',
        name: 'Bose',
        description: 'High-quality audio equipment',
        website: 'https://bose.com',
        is_active: true
      },
      {
        id: 'dell',
        name: 'Dell',
        description: 'Computer hardware and laptops',
        website: 'https://dell.com',
        is_active: true
      },
      {
        id: 'manfrotto',
        name: 'Manfrotto',
        description: 'Professional photography accessories',
        website: 'https://manfrotto.com',
        is_active: true
      }
    ];
    return this.brands;
  }

  // Generate test locations
  generateLocations() {
    this.locations = [
      {
        id: 'warehouse-a',
        name: 'Warehouse A',
        address: '123 Storage St, Industrial District',
        type: 'WAREHOUSE',
        is_active: true
      },
      {
        id: 'warehouse-b',
        name: 'Warehouse B',
        address: '456 Inventory Ave, Storage Complex',
        type: 'WAREHOUSE',
        is_active: true
      },
      {
        id: 'showroom',
        name: 'Main Showroom',
        address: '789 Display Rd, Downtown',
        type: 'SHOWROOM',
        is_active: true
      },
      {
        id: 'office',
        name: 'Head Office',
        address: '321 Business Blvd, Corporate Center',
        type: 'OFFICE',
        is_active: true
      },
      {
        id: 'repair-center',
        name: 'Repair Center',
        address: '654 Service St, Tech District',
        type: 'SERVICE',
        is_active: true
      }
    ];
    return this.locations;
  }

  // Generate test items with various configurations
  generateItems() {
    this.items = [
      // High-value items
      {
        id: 'canon-5d-mark-iv',
        sku: 'CAM-CAN-5D4-001',
        item_name: 'Canon EOS 5D Mark IV Camera',
        description: 'Professional full-frame DSLR camera with 30.4MP sensor',
        category_id: 'cameras',
        brand_id: 'canon',
        status: 'ACTIVE',
        is_rentable: true,
        is_saleable: true,
        rental_rate_per_period: 150.00,
        rental_period: 'DAY',
        sale_price: 2500.00,
        purchase_price: 2200.00,
        security_deposit: 500.00,
        reorder_point: 5,
        max_stock: 20,
        serial_number_required: true
      },
      {
        id: 'sony-a7r-v',
        sku: 'CAM-SON-A7R5-001',
        item_name: 'Sony Alpha 7R V Mirrorless Camera',
        description: 'High-resolution mirrorless camera with 61MP sensor',
        category_id: 'cameras',
        brand_id: 'sony',
        status: 'ACTIVE',
        is_rentable: true,
        is_saleable: true,
        rental_rate_per_period: 180.00,
        rental_period: 'DAY',
        sale_price: 3800.00,
        purchase_price: 3400.00,
        security_deposit: 750.00,
        reorder_point: 3,
        max_stock: 15,
        serial_number_required: true
      },

      // Mid-range items
      {
        id: 'macbook-pro-16',
        sku: 'COMP-APP-MBP16-001',
        item_name: 'Apple MacBook Pro 16-inch',
        description: '16-inch MacBook Pro with M3 Pro chip, 18GB RAM, 512GB SSD',
        category_id: 'computers',
        brand_id: 'apple',
        status: 'ACTIVE',
        is_rentable: true,
        is_saleable: false,
        rental_rate_per_period: 85.00,
        rental_period: 'DAY',
        sale_price: null,
        purchase_price: 2400.00,
        security_deposit: 500.00,
        reorder_point: 10,
        max_stock: 30,
        serial_number_required: true
      },
      {
        id: 'dell-xps-13',
        sku: 'COMP-DEL-XPS13-001',
        item_name: 'Dell XPS 13 Ultrabook',
        description: '13-inch ultrabook with Intel i7, 16GB RAM, 512GB SSD',
        category_id: 'computers',
        brand_id: 'dell',
        status: 'ACTIVE',
        is_rentable: true,
        is_saleable: true,
        rental_rate_per_period: 65.00,
        rental_period: 'DAY',
        sale_price: 1200.00,
        purchase_price: 1000.00,
        security_deposit: 300.00,
        reorder_point: 8,
        max_stock: 25,
        serial_number_required: true
      },

      // Audio equipment
      {
        id: 'bose-qc45',
        sku: 'AUD-BOS-QC45-001',
        item_name: 'Bose QuietComfort 45 Headphones',
        description: 'Wireless noise-cancelling headphones',
        category_id: 'audio',
        brand_id: 'bose',
        status: 'ACTIVE',
        is_rentable: true,
        is_saleable: true,
        rental_rate_per_period: 25.00,
        rental_period: 'DAY',
        sale_price: 329.00,
        purchase_price: 250.00,
        security_deposit: 100.00,
        reorder_point: 15,
        max_stock: 50,
        serial_number_required: false
      },
      {
        id: 'sony-wh1000xm5',
        sku: 'AUD-SON-WH1000XM5-001',
        item_name: 'Sony WH-1000XM5 Headphones',
        description: 'Premium noise-cancelling wireless headphones',
        category_id: 'audio',
        brand_id: 'sony',
        status: 'ACTIVE',
        is_rentable: true,
        is_saleable: true,
        rental_rate_per_period: 30.00,
        rental_period: 'DAY',
        sale_price: 399.00,
        purchase_price: 300.00,
        security_deposit: 120.00,
        reorder_point: 12,
        max_stock: 40,
        serial_number_required: false
      },

      // Furniture items
      {
        id: 'conference-table-8ft',
        sku: 'FURN-TBL-CONF8-001',
        item_name: '8-Foot Conference Table',
        description: 'Oak conference table seating up to 8 people',
        category_id: 'furniture',
        brand_id: null,
        status: 'ACTIVE',
        is_rentable: true,
        is_saleable: false,
        rental_rate_per_period: 45.00,
        rental_period: 'DAY',
        sale_price: null,
        purchase_price: 800.00,
        security_deposit: 200.00,
        reorder_point: 5,
        max_stock: 15,
        serial_number_required: false
      },

      // Low stock items (for testing alerts)
      {
        id: 'tripod-carbon',
        sku: 'ACC-MAN-TRIPOD-001',
        item_name: 'Manfrotto Carbon Fiber Tripod',
        description: 'Lightweight professional tripod',
        category_id: 'lighting',
        brand_id: 'manfrotto',
        status: 'ACTIVE',
        is_rentable: true,
        is_saleable: true,
        rental_rate_per_period: 20.00,
        rental_period: 'DAY',
        sale_price: 450.00,
        purchase_price: 350.00,
        security_deposit: 100.00,
        reorder_point: 10,
        max_stock: 30,
        serial_number_required: true
      },

      // Out of stock items
      {
        id: 'lighting-kit-pro',
        sku: 'LIGHT-PRO-KIT-001',
        item_name: 'Professional Lighting Kit',
        description: '3-point lighting setup with stands',
        category_id: 'lighting',
        brand_id: null,
        status: 'ACTIVE',
        is_rentable: true,
        is_saleable: true,
        rental_rate_per_period: 75.00,
        rental_period: 'DAY',
        sale_price: 1200.00,
        purchase_price: 950.00,
        security_deposit: 250.00,
        reorder_point: 5,
        max_stock: 20,
        serial_number_required: false
      },

      // Inactive/Discontinued items
      {
        id: 'old-camera-model',
        sku: 'CAM-OLD-MODEL-001',
        item_name: 'Legacy Camera Model',
        description: 'Discontinued camera model',
        category_id: 'cameras',
        brand_id: 'canon',
        status: 'DISCONTINUED',
        is_rentable: false,
        is_saleable: true,
        rental_rate_per_period: null,
        rental_period: null,
        sale_price: 500.00,
        purchase_price: 800.00,
        security_deposit: null,
        reorder_point: 0,
        max_stock: 0,
        serial_number_required: true
      }
    ];
    return this.items;
  }

  // Generate inventory units for testing
  generateInventoryUnits() {
    this.inventoryUnits = [];

    this.items.forEach(item => {
      const unitCount = this.getUnitCountForItem(item.id);
      
      for (let i = 1; i <= unitCount; i++) {
        const unit = {
          id: `${item.id}-unit-${i.toString().padStart(3, '0')}`,
          item_id: item.id,
          unit_code: `${item.sku}-${i.toString().padStart(3, '0')}`,
          serial_number: item.serial_number_required ? `SN${Date.now()}${i}` : null,
          location_id: this.getRandomLocationId(),
          status: this.getRandomUnitStatus(item.status),
          condition: this.getRandomCondition(),
          purchase_date: this.getRandomPastDate(730), // Within last 2 years
          purchase_price: item.purchase_price + (Math.random() * 100 - 50), // Slight variation
          warranty_expiry: this.getRandomFutureDate(365), // Within next year
          rental_rate_per_period: item.rental_rate_per_period,
          notes: this.getRandomNotes(),
          created_at: this.getRandomPastDate(365),
          updated_at: this.getRandomPastDate(30)
        };
        
        this.inventoryUnits.push(unit);
      }
    });

    return this.inventoryUnits;
  }

  // Generate stock levels
  generateStockLevels() {
    this.stockLevels = [];

    this.items.forEach(item => {
      this.locations.forEach(location => {
        if (location.is_active) {
          const unitsAtLocation = this.inventoryUnits.filter(unit => 
            unit.item_id === item.id && unit.location_id === location.id
          );

          if (unitsAtLocation.length > 0) {
            const stockLevel = {
              id: `stock-${item.id}-${location.id}`,
              item_id: item.id,
              location_id: location.id,
              quantity_on_hand: unitsAtLocation.length,
              quantity_available: unitsAtLocation.filter(u => u.status === 'AVAILABLE').length,
              quantity_reserved: unitsAtLocation.filter(u => u.status === 'RESERVED').length,
              quantity_on_rent: unitsAtLocation.filter(u => u.status === 'RENTED').length,
              quantity_maintenance: unitsAtLocation.filter(u => u.status === 'MAINTENANCE').length,
              quantity_damaged: unitsAtLocation.filter(u => u.status === 'DAMAGED').length,
              reorder_point: item.reorder_point,
              max_stock: item.max_stock,
              last_count_date: this.getRandomPastDate(90),
              created_at: this.getRandomPastDate(365),
              updated_at: this.getRandomPastDate(7)
            };

            this.stockLevels.push(stockLevel);
          }
        }
      });
    });

    return this.stockLevels;
  }

  // Generate stock movements
  generateStockMovements() {
    this.stockMovements = [];

    this.inventoryUnits.forEach(unit => {
      // Initial purchase movement
      this.stockMovements.push({
        id: `movement-${unit.id}-purchase`,
        item_id: unit.item_id,
        location_id: unit.location_id,
        inventory_unit_id: unit.id,
        movement_type: 'PURCHASE',
        quantity_change: 1,
        unit_cost: unit.purchase_price,
        reference_type: 'PURCHASE_ORDER',
        reference_id: `PO-${Math.floor(Math.random() * 10000)}`,
        reason: 'Initial purchase',
        performed_by: 'system',
        created_at: unit.created_at
      });

      // Random additional movements
      const movementCount = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < movementCount; i++) {
        const movementType = this.getRandomMovementType();
        
        this.stockMovements.push({
          id: `movement-${unit.id}-${movementType.toLowerCase()}-${i}`,
          item_id: unit.item_id,
          location_id: unit.location_id,
          inventory_unit_id: unit.id,
          movement_type: movementType,
          quantity_change: movementType.includes('OUT') ? -1 : 1,
          unit_cost: movementType === 'PURCHASE' ? unit.purchase_price : null,
          reference_type: this.getMovementReferenceType(movementType),
          reference_id: this.generateReferenceId(movementType),
          reason: this.getMovementReason(movementType),
          performed_by: this.getRandomUser(),
          created_at: this.getRandomPastDate(180)
        });
      }
    });

    return this.stockMovements;
  }

  // Helper methods
  getUnitCountForItem(itemId) {
    const countMap = {
      'canon-5d-mark-iv': 15,
      'sony-a7r-v': 12,
      'macbook-pro-16': 25,
      'dell-xps-13': 20,
      'bose-qc45': 35,
      'sony-wh1000xm5': 30,
      'conference-table-8ft': 8,
      'tripod-carbon': 5, // Low stock
      'lighting-kit-pro': 0, // Out of stock
      'old-camera-model': 3
    };
    return countMap[itemId] || Math.floor(Math.random() * 15) + 5;
  }

  getRandomLocationId() {
    const locationIds = this.locations.map(l => l.id);
    return locationIds[Math.floor(Math.random() * locationIds.length)];
  }

  getRandomUnitStatus(itemStatus) {
    if (itemStatus === 'DISCONTINUED') {
      return ['AVAILABLE', 'SOLD', 'RETIRED'][Math.floor(Math.random() * 3)];
    }
    
    const statuses = ['AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'DAMAGED'];
    const weights = [60, 10, 20, 5, 5]; // Weighted probability
    
    let random = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < statuses.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return statuses[i];
      }
    }
    
    return 'AVAILABLE';
  }

  getRandomCondition() {
    const conditions = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'];
    const weights = [40, 35, 20, 5];
    
    let random = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < conditions.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return conditions[i];
      }
    }
    
    return 'GOOD';
  }

  getRandomMovementType() {
    const types = ['PURCHASE', 'RENTAL_OUT', 'RENTAL_IN', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'SALE', 'MAINTENANCE_OUT', 'MAINTENANCE_IN'];
    return types[Math.floor(Math.random() * types.length)];
  }

  getMovementReferenceType(movementType) {
    const referenceMap = {
      'PURCHASE': 'PURCHASE_ORDER',
      'RENTAL_OUT': 'RENTAL',
      'RENTAL_IN': 'RENTAL',
      'TRANSFER_OUT': 'TRANSFER',
      'TRANSFER_IN': 'TRANSFER',
      'ADJUSTMENT': 'STOCK_ADJUSTMENT',
      'SALE': 'SALE',
      'MAINTENANCE_OUT': 'MAINTENANCE',
      'MAINTENANCE_IN': 'MAINTENANCE'
    };
    return referenceMap[movementType] || 'OTHER';
  }

  generateReferenceId(movementType) {
    const prefixMap = {
      'PURCHASE': 'PO',
      'RENTAL_OUT': 'RNT',
      'RENTAL_IN': 'RNT',
      'TRANSFER_OUT': 'TRN',
      'TRANSFER_IN': 'TRN',
      'ADJUSTMENT': 'ADJ',
      'SALE': 'SAL',
      'MAINTENANCE_OUT': 'MNT',
      'MAINTENANCE_IN': 'MNT'
    };
    
    const prefix = prefixMap[movementType] || 'REF';
    return `${prefix}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
  }

  getMovementReason(movementType) {
    const reasonMap = {
      'PURCHASE': 'New inventory received',
      'RENTAL_OUT': 'Item rented to customer',
      'RENTAL_IN': 'Item returned from rental',
      'TRANSFER_OUT': 'Transferred to another location',
      'TRANSFER_IN': 'Received from another location',
      'ADJUSTMENT': 'Stock count adjustment',
      'SALE': 'Item sold to customer',
      'MAINTENANCE_OUT': 'Sent for maintenance',
      'MAINTENANCE_IN': 'Returned from maintenance'
    };
    return reasonMap[movementType] || 'General movement';
  }

  getRandomUser() {
    const users = ['admin', 'manager', 'staff1', 'staff2', 'system'];
    return users[Math.floor(Math.random() * users.length)];
  }

  getRandomNotes() {
    const notes = [
      'Item in excellent condition',
      'Minor cosmetic wear',
      'Recently serviced',
      'Battery replaced',
      'Software updated',
      'Cleaned and tested',
      'Ready for rental',
      ''
    ];
    return notes[Math.floor(Math.random() * notes.length)];
  }

  getRandomPastDate(maxDaysAgo) {
    const daysAgo = Math.floor(Math.random() * maxDaysAgo);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  }

  getRandomFutureDate(maxDaysAhead) {
    const daysAhead = Math.floor(Math.random() * maxDaysAhead);
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString();
  }

  // Generate all test data
  generateAllTestData() {
    console.log('🏗️ Generating comprehensive inventory test data...');
    
    const data = {
      categories: this.generateCategories(),
      brands: this.generateBrands(),
      locations: this.generateLocations(),
      items: this.generateItems(),
      inventoryUnits: this.generateInventoryUnits(),
      stockLevels: this.generateStockLevels(),
      stockMovements: this.generateStockMovements()
    };

    console.log(`✅ Generated test data:`);
    console.log(`   📁 Categories: ${data.categories.length}`);
    console.log(`   🏷️ Brands: ${data.brands.length}`);
    console.log(`   📍 Locations: ${data.locations.length}`);
    console.log(`   📦 Items: ${data.items.length}`);
    console.log(`   🔢 Inventory Units: ${data.inventoryUnits.length}`);
    console.log(`   📊 Stock Levels: ${data.stockLevels.length}`);
    console.log(`   📈 Stock Movements: ${data.stockMovements.length}`);

    return data;
  }

  // Export data for API seeding
  exportForAPISeeding() {
    const data = this.generateAllTestData();
    
    // Create API-compatible format
    return {
      seed_categories: data.categories,
      seed_brands: data.brands,
      seed_locations: data.locations,
      seed_items: data.items,
      seed_inventory_units: data.inventoryUnits,
      seed_stock_levels: data.stockLevels,
      seed_stock_movements: data.stockMovements
    };
  }
}

module.exports = InventoryTestDataGenerator;