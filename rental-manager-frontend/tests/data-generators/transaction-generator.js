/**
 * Transaction Test Data Generator
 * Generates realistic transaction data for comprehensive testing
 */

const faker = require('@faker-js/faker').faker;

class TransactionGenerator {
  constructor(config = {}) {
    this.config = {
      seed: config.seed || 12345,
      startDate: config.startDate || new Date('2024-01-01'),
      endDate: config.endDate || new Date(),
      locations: config.locations || ['LOC001', 'LOC002', 'LOC003'],
      ...config
    };
    
    // Set seed for reproducible results
    faker.seed(this.config.seed);
    
    // Cache for generated data
    this.customers = [];
    this.suppliers = [];
    this.items = [];
    this.inventoryUnits = [];
  }

  /**
   * Generate base customer data
   */
  generateCustomers(count = 100) {
    this.customers = Array.from({ length: count }, (_, i) => ({
      id: `CUST${String(i + 1).padStart(5, '0')}`,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      creditLimit: faker.number.int({ min: 1000, max: 50000 }),
      currentBalance: faker.number.float({ min: 0, max: 5000, precision: 0.01 }),
      status: faker.helpers.arrayElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'SUSPENDED']),
      registrationDate: faker.date.between({ 
        from: this.config.startDate, 
        to: this.config.endDate 
      }),
      type: faker.helpers.arrayElement(['REGULAR', 'PREMIUM', 'VIP']),
      maxActiveRentals: faker.number.int({ min: 1, max: 10 }),
      isBlacklisted: faker.datatype.boolean(0.05) // 5% chance
    }));
    
    return this.customers;
  }

  /**
   * Generate supplier data
   */
  generateSuppliers(count = 20) {
    this.suppliers = Array.from({ length: count }, (_, i) => ({
      id: `SUPP${String(i + 1).padStart(4, '0')}`,
      name: faker.company.name(),
      contactPerson: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      address: faker.location.streetAddress(),
      taxId: faker.string.alphanumeric(10).toUpperCase(),
      paymentTerms: faker.helpers.arrayElement(['NET30', 'NET60', 'COD', 'NET15']),
      status: faker.helpers.arrayElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE']),
      rating: faker.number.int({ min: 1, max: 5 }),
      category: faker.helpers.arrayElement(['EQUIPMENT', 'TOOLS', 'VEHICLES', 'FURNITURE'])
    }));
    
    return this.suppliers;
  }

  /**
   * Generate inventory items
   */
  generateItems(count = 200) {
    const categories = ['TOOLS', 'EQUIPMENT', 'VEHICLES', 'FURNITURE', 'ELECTRONICS'];
    const brands = ['DeWalt', 'Bosch', 'Makita', 'Caterpillar', 'Honda', 'Samsung'];
    
    this.items = Array.from({ length: count }, (_, i) => {
      const category = faker.helpers.arrayElement(categories);
      const brand = faker.helpers.arrayElement(brands);
      const isRentable = faker.datatype.boolean(0.8); // 80% rentable
      const isSaleable = !isRentable || faker.datatype.boolean(0.3); // 30% both
      
      return {
        id: `ITEM${String(i + 1).padStart(5, '0')}`,
        sku: `${category.substring(0, 3)}-${brand.substring(0, 3)}-${faker.string.alphanumeric(6).toUpperCase()}`,
        name: `${brand} ${faker.commerce.productName()}`,
        category,
        brand,
        description: faker.commerce.productDescription(),
        specifications: faker.lorem.sentence(),
        modelNumber: faker.string.alphanumeric(8).toUpperCase(),
        isRentable,
        isSaleable,
        rentalRateDaily: isRentable ? faker.number.float({ min: 10, max: 500, precision: 0.01 }) : null,
        rentalRateWeekly: isRentable ? faker.number.float({ min: 50, max: 2000, precision: 0.01 }) : null,
        rentalRateMonthly: isRentable ? faker.number.float({ min: 150, max: 5000, precision: 0.01 }) : null,
        salePrice: isSaleable ? faker.number.float({ min: 100, max: 10000, precision: 0.01 }) : null,
        purchasePrice: faker.number.float({ min: 50, max: 8000, precision: 0.01 }),
        securityDeposit: isRentable ? faker.number.float({ min: 50, max: 1000, precision: 0.01 }) : 0,
        maxRentalDuration: isRentable ? faker.number.int({ min: 7, max: 365 }) : null,
        minRentalDuration: isRentable ? faker.number.int({ min: 1, max: 7 }) : null,
        requiresSerialNumber: faker.datatype.boolean(0.6),
        warrantyDays: faker.number.int({ min: 0, max: 730 }),
        reorderPoint: faker.number.int({ min: 1, max: 20 }),
        maxStock: faker.number.int({ min: 10, max: 100 }),
        weight: faker.number.float({ min: 0.1, max: 500, precision: 0.1 }),
        dimensions: `${faker.number.int({ min: 10, max: 200 })}x${faker.number.int({ min: 10, max: 200 })}x${faker.number.int({ min: 10, max: 200 })}`,
        status: faker.helpers.arrayElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'DISCONTINUED'])
      };
    });
    
    return this.items;
  }

  /**
   * Generate inventory units for items
   */
  generateInventoryUnits() {
    this.inventoryUnits = [];
    let unitId = 1;
    
    this.items.forEach(item => {
      const unitCount = faker.number.int({ min: 1, max: 20 });
      
      for (let i = 0; i < unitCount; i++) {
        const purchaseDate = faker.date.between({ 
          from: this.config.startDate, 
          to: new Date() 
        });
        
        this.inventoryUnits.push({
          id: `UNIT${String(unitId++).padStart(6, '0')}`,
          itemId: item.id,
          serialNumber: item.requiresSerialNumber ? faker.string.alphanumeric(12).toUpperCase() : null,
          barcode: faker.string.numeric(13),
          status: faker.helpers.arrayElement(
            Array.from({ length: 60 }, () => 'AVAILABLE')
            .concat(Array.from({ length: 20 }, () => 'RENTED'))
            .concat(Array.from({ length: 10 }, () => 'SOLD'))
            .concat(Array.from({ length: 5 }, () => 'MAINTENANCE'))
            .concat(Array.from({ length: 3 }, () => 'RESERVED'))
            .concat(Array.from({ length: 2 }, () => 'DAMAGED'))
          ),
          condition: faker.helpers.arrayElement(
            Array.from({ length: 40 }, () => 'A')
            .concat(Array.from({ length: 35 }, () => 'B'))
            .concat(Array.from({ length: 20 }, () => 'C'))
            .concat(Array.from({ length: 5 }, () => 'D'))
          ),
          location: faker.helpers.arrayElement(this.config.locations),
          purchaseDate,
          purchasePrice: item.purchasePrice,
          supplierId: faker.helpers.arrayElement(this.suppliers).id,
          warrantyExpiry: new Date(purchaseDate.getTime() + (item.warrantyDays * 24 * 60 * 60 * 1000)),
          lastMaintenanceDate: faker.date.recent({ days: 90 }),
          nextMaintenanceDate: faker.date.soon({ days: 90 }),
          usageHours: faker.number.int({ min: 0, max: 1000 }),
          notes: faker.datatype.boolean(0.2) ? faker.lorem.sentence() : null
        });
      }
    });
    
    return this.inventoryUnits;
  }

  /**
   * Generate rental transactions
   */
  generateRentalTransactions(count = 250) {
    const rentals = [];
    const activeCustomers = this.customers.filter(c => c.status === 'ACTIVE' && !c.isBlacklisted);
    const rentableUnits = this.inventoryUnits.filter(u => {
      const item = this.items.find(i => i.id === u.itemId);
      return item?.isRentable && u.status === 'AVAILABLE';
    });
    
    for (let i = 0; i < count && i < rentableUnits.length; i++) {
      const customer = faker.helpers.arrayElement(activeCustomers);
      const unit = rentableUnits[i];
      const item = this.items.find(it => it.id === unit.itemId);
      
      const rentalDate = faker.date.between({
        from: this.config.startDate,
        to: new Date()
      });
      
      const rentalDuration = faker.number.int({ 
        min: item.minRentalDuration || 1, 
        max: Math.min(item.maxRentalDuration || 30, 30) 
      });
      
      const dueDate = new Date(rentalDate.getTime() + (rentalDuration * 24 * 60 * 60 * 1000));
      const isReturned = faker.datatype.boolean(0.7); // 70% returned
      const returnDate = isReturned ? faker.date.between({ from: rentalDate, to: new Date() }) : null;
      
      rentals.push({
        id: `RENT${String(i + 1).padStart(6, '0')}`,
        transactionType: 'RENTAL',
        customerId: customer.id,
        customerName: customer.name,
        transactionDate: rentalDate.toISOString(),
        dueDate: dueDate.toISOString(),
        returnDate: returnDate?.toISOString() || null,
        status: isReturned ? 'COMPLETED' : 
                returnDate > new Date() ? 'OVERDUE' : 'ACTIVE',
        items: [{
          inventoryUnitId: unit.id,
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          quantity: 1,
          rentalRate: item.rentalRateDaily,
          rentalPeriod: 'DAILY',
          duration: rentalDuration,
          subtotal: item.rentalRateDaily * rentalDuration,
          securityDeposit: item.securityDeposit,
          condition: unit.condition,
          conditionOnReturn: isReturned ? 
            faker.helpers.arrayElement(['A', 'B', 'C', 'D']) : null
        }],
        totalAmount: item.rentalRateDaily * rentalDuration,
        securityDeposit: item.securityDeposit,
        totalPaid: isReturned ? item.rentalRateDaily * rentalDuration : 
                   faker.number.float({ min: 0, max: item.rentalRateDaily * rentalDuration, precision: 0.01 }),
        paymentStatus: isReturned ? 'PAID' : faker.helpers.arrayElement(['PENDING', 'PARTIAL', 'PAID']),
        location: unit.location,
        notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
        createdBy: 'TEST_USER',
        createdAt: rentalDate.toISOString(),
        updatedAt: (returnDate || new Date()).toISOString()
      });
    }
    
    return rentals;
  }

  /**
   * Generate sales transactions
   */
  generateSalesTransactions(count = 250) {
    const sales = [];
    const activeCustomers = this.customers.filter(c => c.status === 'ACTIVE');
    const saleableUnits = this.inventoryUnits.filter(u => {
      const item = this.items.find(i => i.id === u.itemId);
      return item?.isSaleable && u.status === 'AVAILABLE';
    });
    
    for (let i = 0; i < count && i < saleableUnits.length; i++) {
      const customer = faker.helpers.arrayElement(activeCustomers);
      const numItems = faker.number.int({ min: 1, max: 5 });
      const selectedUnits = faker.helpers.arrayElements(saleableUnits, numItems);
      
      const saleDate = faker.date.between({
        from: this.config.startDate,
        to: new Date()
      });
      
      const items = selectedUnits.map(unit => {
        const item = this.items.find(it => it.id === unit.itemId);
        const quantity = faker.number.int({ min: 1, max: 3 });
        const discount = faker.number.float({ min: 0, max: 0.2, precision: 0.01 });
        
        return {
          inventoryUnitId: unit.id,
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          quantity,
          unitPrice: item.salePrice,
          discount: discount * 100, // Percentage
          discountAmount: item.salePrice * quantity * discount,
          subtotal: item.salePrice * quantity * (1 - discount),
          tax: item.salePrice * quantity * (1 - discount) * 0.08, // 8% tax
          total: item.salePrice * quantity * (1 - discount) * 1.08
        };
      });
      
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
      
      sales.push({
        id: `SALE${String(i + 1).padStart(6, '0')}`,
        transactionType: 'SALE',
        invoiceNumber: `INV-${saleDate.getFullYear()}-${String(i + 1).padStart(5, '0')}`,
        customerId: customer.id,
        customerName: customer.name,
        transactionDate: saleDate.toISOString(),
        status: faker.helpers.arrayElement([
          ...Array(80).fill('COMPLETED'),
          ...Array(10).fill('PENDING'),
          ...Array(5).fill('CANCELLED'),
          ...Array(5).fill('REFUNDED')
        ]),
        items,
        subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
        discountTotal: items.reduce((sum, item) => sum + item.discountAmount, 0),
        taxTotal: items.reduce((sum, item) => sum + item.tax, 0),
        totalAmount,
        totalPaid: faker.helpers.arrayElement([
          ...Array(70).fill(totalAmount),
          ...Array(20).fill(0),
          ...Array(10).fill(totalAmount * 0.5)
        ]),
        paymentMethod: faker.helpers.arrayElement(['CASH', 'CARD', 'TRANSFER', 'CHECK']),
        paymentStatus: faker.helpers.arrayElement(['PAID', 'PENDING', 'PARTIAL']),
        location: faker.helpers.arrayElement(this.config.locations),
        salesperson: faker.person.fullName(),
        notes: faker.datatype.boolean(0.2) ? faker.lorem.sentence() : null,
        createdBy: 'TEST_USER',
        createdAt: saleDate.toISOString(),
        updatedAt: saleDate.toISOString()
      });
    }
    
    return sales;
  }

  /**
   * Generate purchase transactions
   */
  generatePurchaseTransactions(count = 250) {
    const purchases = [];
    
    for (let i = 0; i < count; i++) {
      const supplier = faker.helpers.arrayElement(this.suppliers);
      const numItems = faker.number.int({ min: 1, max: 10 });
      const selectedItems = faker.helpers.arrayElements(this.items, numItems);
      
      const purchaseDate = faker.date.between({
        from: this.config.startDate,
        to: new Date()
      });
      
      const orderDate = faker.date.recent({ days: 30, refDate: purchaseDate });
      const deliveryDate = faker.date.soon({ days: 14, refDate: orderDate });
      
      const items = selectedItems.map(item => {
        const quantity = faker.number.int({ min: 1, max: 20 });
        const unitCost = item.purchasePrice * faker.number.float({ min: 0.8, max: 1.2, precision: 0.01 });
        
        return {
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          quantity,
          orderedQuantity: quantity,
          receivedQuantity: faker.helpers.arrayElement([
            ...Array(80).fill(quantity),
            ...Array(10).fill(quantity - 1),
            ...Array(10).fill(0)
          ]),
          unitCost,
          discount: faker.number.float({ min: 0, max: 0.15, precision: 0.01 }) * 100,
          subtotal: unitCost * quantity,
          tax: unitCost * quantity * 0.08,
          total: unitCost * quantity * 1.08,
          serialNumbers: item.requiresSerialNumber ? 
            Array.from({ length: quantity }, () => faker.string.alphanumeric(12).toUpperCase()) : [],
          batchNumber: faker.string.alphanumeric(8).toUpperCase(),
          expiryDate: faker.date.future({ years: 2 }).toISOString()
        };
      });
      
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
      
      purchases.push({
        id: `PURCH${String(i + 1).padStart(6, '0')}`,
        transactionType: 'PURCHASE',
        purchaseOrderNumber: `PO-${orderDate.getFullYear()}-${String(i + 1).padStart(5, '0')}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        orderDate: orderDate.toISOString(),
        expectedDeliveryDate: deliveryDate.toISOString(),
        actualDeliveryDate: faker.datatype.boolean(0.8) ? deliveryDate.toISOString() : null,
        transactionDate: purchaseDate.toISOString(),
        status: faker.helpers.arrayElement([
          ...Array(60).fill('RECEIVED'),
          ...Array(20).fill('PENDING'),
          ...Array(10).fill('PARTIAL'),
          ...Array(5).fill('CANCELLED'),
          ...Array(5).fill('RETURNED')
        ]),
        items,
        subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
        discountTotal: items.reduce((sum, item) => sum + (item.subtotal * item.discount / 100), 0),
        taxTotal: items.reduce((sum, item) => sum + item.tax, 0),
        shippingCost: faker.number.float({ min: 0, max: 500, precision: 0.01 }),
        totalAmount,
        totalPaid: faker.helpers.arrayElement([
          ...Array(50).fill(totalAmount),
          ...Array(30).fill(0),
          ...Array(20).fill(totalAmount * 0.5)
        ]),
        paymentStatus: faker.helpers.arrayElement(['PAID', 'PENDING', 'PARTIAL']),
        paymentTerms: supplier.paymentTerms,
        paymentDueDate: new Date(purchaseDate.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
        location: faker.helpers.arrayElement(this.config.locations),
        receivedBy: faker.person.fullName(),
        invoiceNumber: `SI-${supplier.id}-${String(i + 1).padStart(5, '0')}`,
        notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
        createdBy: 'TEST_USER',
        createdAt: orderDate.toISOString(),
        updatedAt: purchaseDate.toISOString()
      });
    }
    
    return purchases;
  }

  /**
   * Generate return transactions (from rentals and sales)
   */
  generateReturnTransactions(rentals, sales) {
    const returns = [];
    let returnId = 1;
    
    // Generate rental returns
    const completedRentals = rentals.filter(r => r.status === 'COMPLETED').slice(0, 125);
    completedRentals.forEach(rental => {
      const returnDate = new Date(rental.returnDate);
      const isLate = returnDate > new Date(rental.dueDate);
      const lateDays = isLate ? Math.ceil((returnDate - new Date(rental.dueDate)) / (24 * 60 * 60 * 1000)) : 0;
      
      returns.push({
        id: `RET${String(returnId++).padStart(6, '0')}`,
        transactionType: 'RETURN',
        returnType: 'RENTAL_RETURN',
        originalTransactionId: rental.id,
        customerId: rental.customerId,
        customerName: rental.customerName,
        transactionDate: returnDate.toISOString(),
        items: rental.items.map(item => ({
          ...item,
          returnCondition: item.conditionOnReturn,
          damageNotes: faker.datatype.boolean(0.1) ? faker.lorem.sentence() : null,
          damageCharge: faker.datatype.boolean(0.1) ? 
            faker.number.float({ min: 50, max: 500, precision: 0.01 }) : 0
        })),
        isLateReturn: isLate,
        lateDays,
        lateFee: lateDays * faker.number.float({ min: 10, max: 50, precision: 0.01 }),
        securityDepositReturned: rental.securityDeposit * 
          (faker.datatype.boolean(0.9) ? 1 : faker.number.float({ min: 0, max: 1, precision: 0.01 })),
        totalCharges: lateDays * faker.number.float({ min: 10, max: 50, precision: 0.01 }),
        status: 'COMPLETED',
        processedBy: faker.person.fullName(),
        notes: faker.datatype.boolean(0.2) ? faker.lorem.sentence() : null,
        createdBy: 'TEST_USER',
        createdAt: returnDate.toISOString(),
        updatedAt: returnDate.toISOString()
      });
    });
    
    // Generate sales returns/refunds
    const refundableSales = sales.filter(s => s.status === 'COMPLETED').slice(0, 125);
    refundableSales.forEach(sale => {
      const returnDate = faker.date.soon({ 
        days: 30, 
        refDate: new Date(sale.transactionDate) 
      });
      
      const returnItems = faker.helpers.arrayElements(
        sale.items, 
        faker.number.int({ min: 1, max: sale.items.length })
      );
      
      returns.push({
        id: `RET${String(returnId++).padStart(6, '0')}`,
        transactionType: 'RETURN',
        returnType: 'SALES_RETURN',
        originalTransactionId: sale.id,
        customerId: sale.customerId,
        customerName: sale.customerName,
        transactionDate: returnDate.toISOString(),
        items: returnItems.map(item => ({
          ...item,
          returnQuantity: faker.number.int({ min: 1, max: item.quantity }),
          returnReason: faker.helpers.arrayElement([
            'DEFECTIVE', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 
            'DAMAGED_IN_SHIPPING', 'WRONG_ITEM'
          ]),
          condition: faker.helpers.arrayElement(['A', 'B', 'C', 'D']),
          restockable: faker.datatype.boolean(0.8),
          restockingFee: faker.datatype.boolean(0.2) ? 
            item.unitPrice * 0.15 : 0
        })),
        refundAmount: returnItems.reduce((sum, item) => sum + item.total, 0) * 0.95,
        refundMethod: sale.paymentMethod,
        status: faker.helpers.arrayElement(['COMPLETED', 'PENDING', 'APPROVED']),
        approvedBy: faker.person.fullName(),
        processedBy: faker.person.fullName(),
        notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : null,
        createdBy: 'TEST_USER',
        createdAt: returnDate.toISOString(),
        updatedAt: returnDate.toISOString()
      });
    });
    
    return returns;
  }

  /**
   * Generate complete test dataset
   */
  generateCompleteDataset() {
    console.log('🔄 Generating test data...');
    
    // Generate base data
    this.generateCustomers(100);
    console.log(`✅ Generated ${this.customers.length} customers`);
    
    this.generateSuppliers(20);
    console.log(`✅ Generated ${this.suppliers.length} suppliers`);
    
    this.generateItems(200);
    console.log(`✅ Generated ${this.items.length} items`);
    
    this.generateInventoryUnits();
    console.log(`✅ Generated ${this.inventoryUnits.length} inventory units`);
    
    // Generate transactions
    const rentals = this.generateRentalTransactions(250);
    console.log(`✅ Generated ${rentals.length} rental transactions`);
    
    const sales = this.generateSalesTransactions(250);
    console.log(`✅ Generated ${sales.length} sales transactions`);
    
    const purchases = this.generatePurchaseTransactions(250);
    console.log(`✅ Generated ${purchases.length} purchase transactions`);
    
    const returns = this.generateReturnTransactions(rentals, sales);
    console.log(`✅ Generated ${returns.length} return transactions`);
    
    // Combine all transactions
    const allTransactions = [...rentals, ...sales, ...purchases, ...returns];
    
    return {
      customers: this.customers,
      suppliers: this.suppliers,
      items: this.items,
      inventoryUnits: this.inventoryUnits,
      transactions: {
        all: allTransactions,
        rentals,
        sales,
        purchases,
        returns
      },
      summary: {
        totalTransactions: allTransactions.length,
        totalCustomers: this.customers.length,
        totalSuppliers: this.suppliers.length,
        totalItems: this.items.length,
        totalInventoryUnits: this.inventoryUnits.length,
        transactionBreakdown: {
          rentals: rentals.length,
          sales: sales.length,
          purchases: purchases.length,
          returns: returns.length
        }
      }
    };
  }

  /**
   * Generate edge cases for testing
   */
  generateEdgeCases() {
    return {
      // Maximum values
      maxQuantityTransaction: {
        type: 'SALE',
        items: Array.from({ length: 100 }, (_, i) => ({
          itemId: `ITEM${String(i + 1).padStart(5, '0')}`,
          quantity: 999,
          unitPrice: 99999.99
        }))
      },
      
      // Minimum values
      minValueTransaction: {
        type: 'RENTAL',
        items: [{
          itemId: 'ITEM00001',
          quantity: 1,
          rentalRate: 0.01,
          duration: 1
        }]
      },
      
      // Date boundaries
      futureDatedTransaction: {
        type: 'RENTAL',
        transactionDate: new Date('2030-12-31').toISOString(),
        dueDate: new Date('2031-01-31').toISOString()
      },
      
      // Concurrent transactions
      concurrentTransactions: Array.from({ length: 50 }, (_, i) => ({
        type: 'RENTAL',
        customerId: 'CUST00001',
        itemId: 'ITEM00001',
        transactionDate: new Date().toISOString(),
        timestamp: Date.now() + i // Millisecond apart
      })),
      
      // Invalid status transitions
      invalidStatusChanges: [
        { from: 'SOLD', to: 'AVAILABLE' },
        { from: 'RENTED', to: 'SOLD' },
        { from: 'DAMAGED', to: 'RENTED' }
      ],
      
      // Overlapping rentals
      overlappingRentals: [
        {
          customerId: 'CUST00001',
          itemId: 'ITEM00001',
          startDate: '2024-06-01',
          endDate: '2024-06-15'
        },
        {
          customerId: 'CUST00002',
          itemId: 'ITEM00001',
          startDate: '2024-06-10',
          endDate: '2024-06-20'
        }
      ],
      
      // Zero and negative values
      zeroValueCases: [
        { field: 'quantity', value: 0 },
        { field: 'price', value: -100 },
        { field: 'discount', value: 150 } // Over 100%
      ]
    };
  }

  /**
   * Export data to JSON files
   */
  exportToFiles(data, outputDir = './test-data') {
    const fs = require('fs');
    const path = require('path');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Export each data type to separate file
    const exports = [
      { name: 'customers', data: data.customers },
      { name: 'suppliers', data: data.suppliers },
      { name: 'items', data: data.items },
      { name: 'inventory-units', data: data.inventoryUnits },
      { name: 'transactions-all', data: data.transactions.all },
      { name: 'transactions-rentals', data: data.transactions.rentals },
      { name: 'transactions-sales', data: data.transactions.sales },
      { name: 'transactions-purchases', data: data.transactions.purchases },
      { name: 'transactions-returns', data: data.transactions.returns },
      { name: 'summary', data: data.summary },
      { name: 'edge-cases', data: this.generateEdgeCases() }
    ];
    
    exports.forEach(({ name, data }) => {
      const filePath = path.join(outputDir, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`📁 Exported ${name} to ${filePath}`);
    });
    
    // Create a manifest file
    const manifest = {
      generatedAt: new Date().toISOString(),
      config: this.config,
      files: exports.map(e => `${e.name}.json`),
      statistics: data.summary
    };
    
    fs.writeFileSync(
      path.join(outputDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    console.log('✅ All test data exported successfully');
  }
}

// Export for use in other modules
module.exports = TransactionGenerator;

// Run directly if called as script
if (require.main === module) {
  const generator = new TransactionGenerator({
    seed: process.env.SEED || 12345,
    startDate: new Date('2024-01-01'),
    endDate: new Date()
  });
  
  const testData = generator.generateCompleteDataset();
  generator.exportToFiles(testData);
  
  console.log('\n📊 Test Data Generation Complete!');
  console.log('=====================================');
  console.log(`Total Transactions: ${testData.summary.totalTransactions}`);
  console.log(`- Rentals: ${testData.summary.transactionBreakdown.rentals}`);
  console.log(`- Sales: ${testData.summary.transactionBreakdown.sales}`);
  console.log(`- Purchases: ${testData.summary.transactionBreakdown.purchases}`);
  console.log(`- Returns: ${testData.summary.transactionBreakdown.returns}`);
}