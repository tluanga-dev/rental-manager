/**
 * Inventory State Generator and Validator
 * Generates and validates inventory state based on transactions
 */

class InventoryGenerator {
  constructor(config = {}) {
    this.config = {
      locations: config.locations || ['LOC001', 'LOC002', 'LOC003'],
      conditionGrades: config.conditionGrades || ['A', 'B', 'C', 'D'],
      statusTypes: config.statusTypes || [
        'AVAILABLE', 'RENTED', 'SOLD', 'RESERVED', 
        'MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED'
      ],
      ...config
    };
    
    // State tracking
    this.inventoryState = new Map();
    this.transactionLog = [];
    this.stockLevels = new Map();
  }

  /**
   * Initialize inventory state from units
   */
  initializeInventory(inventoryUnits, items) {
    inventoryUnits.forEach(unit => {
      const item = items.find(i => i.id === unit.itemId);
      
      this.inventoryState.set(unit.id, {
        unitId: unit.id,
        itemId: unit.itemId,
        itemName: item?.name || 'Unknown',
        sku: item?.sku || 'Unknown',
        serialNumber: unit.serialNumber,
        barcode: unit.barcode,
        currentStatus: unit.status,
        previousStatus: null,
        condition: unit.condition,
        location: unit.location,
        lastTransactionId: null,
        lastTransactionDate: null,
        lastTransactionType: null,
        rentalHistory: [],
        saleHistory: [],
        maintenanceHistory: [],
        transferHistory: [],
        currentCustomerId: null,
        reservedUntil: null,
        blockedUntil: null,
        availableFrom: unit.status === 'AVAILABLE' ? new Date() : null,
        purchaseInfo: {
          supplierId: unit.supplierId,
          purchaseDate: unit.purchaseDate,
          purchasePrice: unit.purchasePrice,
          warrantyExpiry: unit.warrantyExpiry
        },
        metrics: {
          totalRentalDays: 0,
          totalRentalRevenue: 0,
          totalRentals: 0,
          utilizationRate: 0,
          daysInCurrentStatus: 0,
          lastMaintenanceDate: unit.lastMaintenanceDate,
          nextMaintenanceDate: unit.nextMaintenanceDate,
          usageHours: unit.usageHours || 0
        }
      });
    });
    
    // Initialize stock levels by item and location
    this.calculateStockLevels(items);
    
    console.log(`✅ Initialized ${this.inventoryState.size} inventory units`);
    return this.inventoryState;
  }

  /**
   * Calculate stock levels by item and location
   */
  calculateStockLevels(items) {
    this.stockLevels.clear();
    
    items.forEach(item => {
      const itemStock = {
        itemId: item.id,
        itemName: item.name,
        totalStock: 0,
        availableStock: 0,
        rentedStock: 0,
        soldStock: 0,
        maintenanceStock: 0,
        reservedStock: 0,
        locationBreakdown: {},
        statusBreakdown: {},
        conditionBreakdown: {}
      };
      
      // Initialize location breakdown
      this.config.locations.forEach(location => {
        itemStock.locationBreakdown[location] = {
          total: 0,
          available: 0,
          rented: 0,
          sold: 0
        };
      });
      
      // Initialize status breakdown
      this.config.statusTypes.forEach(status => {
        itemStock.statusBreakdown[status] = 0;
      });
      
      // Initialize condition breakdown
      this.config.conditionGrades.forEach(grade => {
        itemStock.conditionBreakdown[grade] = 0;
      });
      
      this.stockLevels.set(item.id, itemStock);
    });
    
    // Calculate actual stock from inventory units
    this.inventoryState.forEach(unit => {
      const stock = this.stockLevels.get(unit.itemId);
      if (!stock) return;
      
      stock.totalStock++;
      stock.statusBreakdown[unit.currentStatus]++;
      stock.conditionBreakdown[unit.condition]++;
      
      if (stock.locationBreakdown[unit.location]) {
        stock.locationBreakdown[unit.location].total++;
        
        switch (unit.currentStatus) {
          case 'AVAILABLE':
            stock.availableStock++;
            stock.locationBreakdown[unit.location].available++;
            break;
          case 'RENTED':
            stock.rentedStock++;
            stock.locationBreakdown[unit.location].rented++;
            break;
          case 'SOLD':
            stock.soldStock++;
            stock.locationBreakdown[unit.location].sold++;
            break;
          case 'MAINTENANCE':
            stock.maintenanceStock++;
            break;
          case 'RESERVED':
            stock.reservedStock++;
            break;
        }
      }
    });
    
    return this.stockLevels;
  }

  /**
   * Apply transaction to inventory state
   */
  applyTransaction(transaction) {
    const result = {
      success: true,
      errors: [],
      warnings: [],
      updates: []
    };
    
    switch (transaction.transactionType) {
      case 'RENTAL':
        return this.applyRentalTransaction(transaction);
      case 'SALE':
        return this.applySaleTransaction(transaction);
      case 'PURCHASE':
        return this.applyPurchaseTransaction(transaction);
      case 'RETURN':
        return this.applyReturnTransaction(transaction);
      default:
        result.success = false;
        result.errors.push(`Unknown transaction type: ${transaction.transactionType}`);
        return result;
    }
  }

  /**
   * Apply rental transaction to inventory
   */
  applyRentalTransaction(rental) {
    const result = {
      success: true,
      errors: [],
      warnings: [],
      updates: []
    };
    
    rental.items.forEach(item => {
      const unit = this.inventoryState.get(item.inventoryUnitId);
      
      if (!unit) {
        result.errors.push(`Inventory unit ${item.inventoryUnitId} not found`);
        result.success = false;
        return;
      }
      
      // Validate business rules
      if (unit.currentStatus !== 'AVAILABLE' && unit.currentStatus !== 'RESERVED') {
        result.errors.push(
          `Unit ${item.inventoryUnitId} is not available for rental (status: ${unit.currentStatus})`
        );
        result.success = false;
        return;
      }
      
      // Apply status change
      const previousStatus = unit.currentStatus;
      unit.previousStatus = previousStatus;
      unit.currentStatus = 'RENTED';
      unit.currentCustomerId = rental.customerId;
      unit.lastTransactionId = rental.id;
      unit.lastTransactionDate = rental.transactionDate;
      unit.lastTransactionType = 'RENTAL';
      unit.availableFrom = null;
      
      // Update rental history
      unit.rentalHistory.push({
        transactionId: rental.id,
        customerId: rental.customerId,
        startDate: rental.transactionDate,
        endDate: rental.dueDate,
        returnDate: rental.returnDate,
        rentalRate: item.rentalRate,
        duration: item.duration,
        status: rental.status
      });
      
      // Update metrics
      unit.metrics.totalRentals++;
      unit.metrics.totalRentalDays += item.duration;
      unit.metrics.totalRentalRevenue += item.subtotal;
      
      // Update stock levels
      this.updateStockLevel(unit.itemId, unit.location, previousStatus, 'RENTED');
      
      result.updates.push({
        unitId: item.inventoryUnitId,
        previousStatus,
        newStatus: 'RENTED',
        customerId: rental.customerId
      });
    });
    
    // Log transaction
    if (result.success) {
      this.transactionLog.push({
        transactionId: rental.id,
        type: 'RENTAL',
        timestamp: rental.transactionDate,
        updates: result.updates
      });
    }
    
    return result;
  }

  /**
   * Apply sale transaction to inventory
   */
  applySaleTransaction(sale) {
    const result = {
      success: true,
      errors: [],
      warnings: [],
      updates: []
    };
    
    sale.items.forEach(item => {
      const unit = this.inventoryState.get(item.inventoryUnitId);
      
      if (!unit) {
        result.errors.push(`Inventory unit ${item.inventoryUnitId} not found`);
        result.success = false;
        return;
      }
      
      // Validate business rules
      if (unit.currentStatus !== 'AVAILABLE') {
        result.errors.push(
          `Unit ${item.inventoryUnitId} is not available for sale (status: ${unit.currentStatus})`
        );
        result.success = false;
        return;
      }
      
      // Apply status change
      const previousStatus = unit.currentStatus;
      unit.previousStatus = previousStatus;
      unit.currentStatus = 'SOLD';
      unit.currentCustomerId = sale.customerId;
      unit.lastTransactionId = sale.id;
      unit.lastTransactionDate = sale.transactionDate;
      unit.lastTransactionType = 'SALE';
      unit.availableFrom = null;
      
      // Update sale history
      unit.saleHistory.push({
        transactionId: sale.id,
        customerId: sale.customerId,
        saleDate: sale.transactionDate,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        total: item.total
      });
      
      // Update stock levels
      this.updateStockLevel(unit.itemId, unit.location, previousStatus, 'SOLD');
      
      result.updates.push({
        unitId: item.inventoryUnitId,
        previousStatus,
        newStatus: 'SOLD',
        customerId: sale.customerId
      });
    });
    
    // Log transaction
    if (result.success) {
      this.transactionLog.push({
        transactionId: sale.id,
        type: 'SALE',
        timestamp: sale.transactionDate,
        updates: result.updates
      });
    }
    
    return result;
  }

  /**
   * Apply purchase transaction to inventory
   */
  applyPurchaseTransaction(purchase) {
    const result = {
      success: true,
      errors: [],
      warnings: [],
      newUnits: []
    };
    
    // Purchase transactions create new inventory units
    purchase.items.forEach(item => {
      for (let i = 0; i < item.receivedQuantity; i++) {
        const unitId = `UNIT-PUR-${purchase.id}-${item.itemId}-${i}`;
        
        const newUnit = {
          unitId,
          itemId: item.itemId,
          itemName: item.itemName,
          sku: item.sku,
          serialNumber: item.serialNumbers?.[i] || null,
          barcode: `BAR-${unitId}`,
          currentStatus: 'AVAILABLE',
          previousStatus: null,
          condition: 'A', // New items start in excellent condition
          location: purchase.location,
          lastTransactionId: purchase.id,
          lastTransactionDate: purchase.transactionDate,
          lastTransactionType: 'PURCHASE',
          rentalHistory: [],
          saleHistory: [],
          maintenanceHistory: [],
          transferHistory: [],
          currentCustomerId: null,
          reservedUntil: null,
          blockedUntil: null,
          availableFrom: new Date(purchase.transactionDate),
          purchaseInfo: {
            supplierId: purchase.supplierId,
            purchaseDate: purchase.transactionDate,
            purchasePrice: item.unitCost,
            warrantyExpiry: item.expiryDate,
            batchNumber: item.batchNumber
          },
          metrics: {
            totalRentalDays: 0,
            totalRentalRevenue: 0,
            totalRentals: 0,
            utilizationRate: 0,
            daysInCurrentStatus: 0,
            lastMaintenanceDate: null,
            nextMaintenanceDate: null,
            usageHours: 0
          }
        };
        
        this.inventoryState.set(unitId, newUnit);
        result.newUnits.push(unitId);
        
        // Update stock levels
        const stock = this.stockLevels.get(item.itemId);
        if (stock) {
          stock.totalStock++;
          stock.availableStock++;
          stock.statusBreakdown['AVAILABLE']++;
          stock.conditionBreakdown['A']++;
          if (stock.locationBreakdown[purchase.location]) {
            stock.locationBreakdown[purchase.location].total++;
            stock.locationBreakdown[purchase.location].available++;
          }
        }
      }
    });
    
    // Log transaction
    this.transactionLog.push({
      transactionId: purchase.id,
      type: 'PURCHASE',
      timestamp: purchase.transactionDate,
      newUnits: result.newUnits
    });
    
    return result;
  }

  /**
   * Apply return transaction to inventory
   */
  applyReturnTransaction(returnTx) {
    const result = {
      success: true,
      errors: [],
      warnings: [],
      updates: []
    };
    
    if (returnTx.returnType === 'RENTAL_RETURN') {
      returnTx.items.forEach(item => {
        const unit = this.inventoryState.get(item.inventoryUnitId);
        
        if (!unit) {
          result.errors.push(`Inventory unit ${item.inventoryUnitId} not found`);
          result.success = false;
          return;
        }
        
        // Validate business rules
        if (unit.currentStatus !== 'RENTED') {
          result.warnings.push(
            `Unit ${item.inventoryUnitId} is not currently rented (status: ${unit.currentStatus})`
          );
        }
        
        // Apply status change
        const previousStatus = unit.currentStatus;
        unit.previousStatus = previousStatus;
        unit.currentStatus = 'AVAILABLE';
        unit.currentCustomerId = null;
        unit.lastTransactionId = returnTx.id;
        unit.lastTransactionDate = returnTx.transactionDate;
        unit.lastTransactionType = 'RETURN';
        unit.availableFrom = new Date(returnTx.transactionDate);
        
        // Update condition if changed
        if (item.returnCondition && item.returnCondition !== unit.condition) {
          unit.condition = item.returnCondition;
          
          // Update condition breakdown in stock levels
          const stock = this.stockLevels.get(unit.itemId);
          if (stock) {
            stock.conditionBreakdown[item.conditionOnReturn]--;
            stock.conditionBreakdown[item.returnCondition]++;
          }
        }
        
        // Update rental history
        const lastRental = unit.rentalHistory[unit.rentalHistory.length - 1];
        if (lastRental) {
          lastRental.returnDate = returnTx.transactionDate;
          lastRental.status = 'RETURNED';
        }
        
        // Update stock levels
        this.updateStockLevel(unit.itemId, unit.location, previousStatus, 'AVAILABLE');
        
        result.updates.push({
          unitId: item.inventoryUnitId,
          previousStatus,
          newStatus: 'AVAILABLE',
          conditionChange: item.returnCondition !== unit.condition ? 
            { from: unit.condition, to: item.returnCondition } : null
        });
      });
    } else if (returnTx.returnType === 'SALES_RETURN') {
      // Sales returns restore inventory to available
      returnTx.items.forEach(item => {
        if (item.restockable) {
          const unit = this.inventoryState.get(item.inventoryUnitId);
          
          if (unit) {
            const previousStatus = unit.currentStatus;
            unit.previousStatus = previousStatus;
            unit.currentStatus = 'AVAILABLE';
            unit.currentCustomerId = null;
            unit.lastTransactionId = returnTx.id;
            unit.lastTransactionDate = returnTx.transactionDate;
            unit.lastTransactionType = 'RETURN';
            unit.availableFrom = new Date(returnTx.transactionDate);
            unit.condition = item.condition || unit.condition;
            
            // Update stock levels
            this.updateStockLevel(unit.itemId, unit.location, previousStatus, 'AVAILABLE');
            
            result.updates.push({
              unitId: item.inventoryUnitId,
              previousStatus,
              newStatus: 'AVAILABLE',
              restocked: true
            });
          }
        }
      });
    }
    
    // Log transaction
    if (result.success) {
      this.transactionLog.push({
        transactionId: returnTx.id,
        type: 'RETURN',
        returnType: returnTx.returnType,
        timestamp: returnTx.transactionDate,
        updates: result.updates
      });
    }
    
    return result;
  }

  /**
   * Update stock level for status change
   */
  updateStockLevel(itemId, location, fromStatus, toStatus) {
    const stock = this.stockLevels.get(itemId);
    if (!stock) return;
    
    // Update status breakdown
    if (stock.statusBreakdown[fromStatus] !== undefined) {
      stock.statusBreakdown[fromStatus]--;
    }
    if (stock.statusBreakdown[toStatus] !== undefined) {
      stock.statusBreakdown[toStatus]++;
    }
    
    // Update aggregated counts
    const statusGroups = {
      'AVAILABLE': 'availableStock',
      'RENTED': 'rentedStock',
      'SOLD': 'soldStock',
      'MAINTENANCE': 'maintenanceStock',
      'RESERVED': 'reservedStock'
    };
    
    if (statusGroups[fromStatus]) {
      stock[statusGroups[fromStatus]]--;
    }
    if (statusGroups[toStatus]) {
      stock[statusGroups[toStatus]]++;
    }
    
    // Update location breakdown
    if (stock.locationBreakdown[location]) {
      const locStock = stock.locationBreakdown[location];
      
      if (fromStatus === 'AVAILABLE') locStock.available--;
      if (toStatus === 'AVAILABLE') locStock.available++;
      
      if (fromStatus === 'RENTED') locStock.rented--;
      if (toStatus === 'RENTED') locStock.rented++;
      
      if (fromStatus === 'SOLD') locStock.sold--;
      if (toStatus === 'SOLD') locStock.sold++;
    }
  }

  /**
   * Validate inventory consistency
   */
  validateInventoryConsistency() {
    const validationResults = {
      passed: true,
      errors: [],
      warnings: [],
      statistics: {}
    };
    
    // Rule 1: Check for invalid status transitions
    this.transactionLog.forEach(log => {
      log.updates?.forEach(update => {
        const invalidTransitions = [
          { from: 'SOLD', to: 'AVAILABLE' },
          { from: 'SOLD', to: 'RENTED' },
          { from: 'LOST', to: 'AVAILABLE' }
        ];
        
        const invalid = invalidTransitions.find(
          t => t.from === update.previousStatus && t.to === update.newStatus
        );
        
        if (invalid) {
          validationResults.errors.push(
            `Invalid status transition: ${invalid.from} → ${invalid.to} in transaction ${log.transactionId}`
          );
          validationResults.passed = false;
        }
      });
    });
    
    // Rule 2: Check stock level consistency
    this.stockLevels.forEach((stock, itemId) => {
      const calculatedTotal = 
        stock.availableStock + 
        stock.rentedStock + 
        stock.soldStock + 
        stock.maintenanceStock + 
        stock.reservedStock;
      
      if (calculatedTotal !== stock.totalStock) {
        validationResults.errors.push(
          `Stock level mismatch for item ${itemId}: calculated ${calculatedTotal}, actual ${stock.totalStock}`
        );
        validationResults.passed = false;
      }
      
      // Check location totals
      let locationTotal = 0;
      Object.values(stock.locationBreakdown).forEach(loc => {
        locationTotal += loc.total;
      });
      
      if (locationTotal !== stock.totalStock) {
        validationResults.warnings.push(
          `Location total mismatch for item ${itemId}: ${locationTotal} vs ${stock.totalStock}`
        );
      }
    });
    
    // Rule 3: Check for duplicate serial numbers
    const serialNumbers = new Set();
    const duplicates = [];
    
    this.inventoryState.forEach(unit => {
      if (unit.serialNumber) {
        if (serialNumbers.has(unit.serialNumber)) {
          duplicates.push(unit.serialNumber);
        }
        serialNumbers.add(unit.serialNumber);
      }
    });
    
    if (duplicates.length > 0) {
      validationResults.errors.push(
        `Duplicate serial numbers found: ${duplicates.join(', ')}`
      );
      validationResults.passed = false;
    }
    
    // Rule 4: Check for units in multiple locations
    this.inventoryState.forEach(unit => {
      if (!this.config.locations.includes(unit.location)) {
        validationResults.errors.push(
          `Unit ${unit.unitId} has invalid location: ${unit.location}`
        );
        validationResults.passed = false;
      }
    });
    
    // Rule 5: Check rental status consistency
    this.inventoryState.forEach(unit => {
      if (unit.currentStatus === 'RENTED' && !unit.currentCustomerId) {
        validationResults.errors.push(
          `Unit ${unit.unitId} is RENTED but has no customer assigned`
        );
        validationResults.passed = false;
      }
      
      if (unit.currentStatus === 'AVAILABLE' && unit.currentCustomerId) {
        validationResults.warnings.push(
          `Unit ${unit.unitId} is AVAILABLE but still has customer ${unit.currentCustomerId} assigned`
        );
      }
    });
    
    // Calculate statistics
    validationResults.statistics = {
      totalUnits: this.inventoryState.size,
      totalItems: this.stockLevels.size,
      totalTransactions: this.transactionLog.length,
      statusDistribution: {},
      conditionDistribution: {},
      locationDistribution: {}
    };
    
    // Calculate distributions
    this.inventoryState.forEach(unit => {
      // Status distribution
      validationResults.statistics.statusDistribution[unit.currentStatus] = 
        (validationResults.statistics.statusDistribution[unit.currentStatus] || 0) + 1;
      
      // Condition distribution
      validationResults.statistics.conditionDistribution[unit.condition] = 
        (validationResults.statistics.conditionDistribution[unit.condition] || 0) + 1;
      
      // Location distribution
      validationResults.statistics.locationDistribution[unit.location] = 
        (validationResults.statistics.locationDistribution[unit.location] || 0) + 1;
    });
    
    return validationResults;
  }

  /**
   * Generate inventory report
   */
  generateInventoryReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalUnits: this.inventoryState.size,
        totalItems: this.stockLevels.size,
        totalTransactions: this.transactionLog.length
      },
      stockLevels: {},
      utilizationMetrics: {},
      conditionAnalysis: {},
      locationAnalysis: {}
    };
    
    // Stock level analysis
    this.stockLevels.forEach((stock, itemId) => {
      report.stockLevels[itemId] = {
        itemName: stock.itemName,
        totalStock: stock.totalStock,
        availableStock: stock.availableStock,
        availabilityRate: stock.totalStock > 0 ? 
          (stock.availableStock / stock.totalStock * 100).toFixed(2) + '%' : '0%',
        rentedStock: stock.rentedStock,
        utilizationRate: stock.totalStock > 0 ? 
          (stock.rentedStock / stock.totalStock * 100).toFixed(2) + '%' : '0%',
        soldStock: stock.soldStock,
        maintenanceStock: stock.maintenanceStock,
        locationBreakdown: stock.locationBreakdown
      };
    });
    
    // Utilization metrics
    let totalRentalDays = 0;
    let totalRentalRevenue = 0;
    let totalRentals = 0;
    
    this.inventoryState.forEach(unit => {
      totalRentalDays += unit.metrics.totalRentalDays;
      totalRentalRevenue += unit.metrics.totalRentalRevenue;
      totalRentals += unit.metrics.totalRentals;
    });
    
    report.utilizationMetrics = {
      totalRentalDays,
      totalRentalRevenue,
      totalRentals,
      averageRentalDuration: totalRentals > 0 ? 
        (totalRentalDays / totalRentals).toFixed(2) : 0,
      averageRentalValue: totalRentals > 0 ? 
        (totalRentalRevenue / totalRentals).toFixed(2) : 0
    };
    
    // Condition analysis
    const conditionCounts = {};
    this.inventoryState.forEach(unit => {
      conditionCounts[unit.condition] = (conditionCounts[unit.condition] || 0) + 1;
    });
    
    report.conditionAnalysis = {
      distribution: conditionCounts,
      percentages: {}
    };
    
    Object.entries(conditionCounts).forEach(([grade, count]) => {
      report.conditionAnalysis.percentages[grade] = 
        ((count / this.inventoryState.size) * 100).toFixed(2) + '%';
    });
    
    // Location analysis
    const locationCounts = {};
    this.inventoryState.forEach(unit => {
      locationCounts[unit.location] = (locationCounts[unit.location] || 0) + 1;
    });
    
    report.locationAnalysis = {
      distribution: locationCounts,
      utilizationByLocation: {}
    };
    
    this.config.locations.forEach(location => {
      const unitsAtLocation = Array.from(this.inventoryState.values())
        .filter(u => u.location === location);
      
      const rentedAtLocation = unitsAtLocation.filter(u => u.currentStatus === 'RENTED').length;
      
      report.locationAnalysis.utilizationByLocation[location] = {
        totalUnits: unitsAtLocation.length,
        rentedUnits: rentedAtLocation,
        utilizationRate: unitsAtLocation.length > 0 ? 
          ((rentedAtLocation / unitsAtLocation.length) * 100).toFixed(2) + '%' : '0%'
      };
    });
    
    return report;
  }
}

// Export for use in other modules
module.exports = InventoryGenerator;

// Run directly if called as script
if (require.main === module) {
  const TransactionGenerator = require('./transaction-generator');
  
  // Generate test data
  const txGenerator = new TransactionGenerator();
  const testData = txGenerator.generateCompleteDataset();
  
  // Initialize inventory
  const invGenerator = new InventoryGenerator();
  invGenerator.initializeInventory(testData.inventoryUnits, testData.items);
  
  // Apply all transactions
  console.log('\n📋 Applying transactions to inventory...');
  let successCount = 0;
  let errorCount = 0;
  
  testData.transactions.all.forEach(transaction => {
    const result = invGenerator.applyTransaction(transaction);
    if (result.success) {
      successCount++;
    } else {
      errorCount++;
      console.error(`Failed to apply transaction ${transaction.id}:`, result.errors);
    }
  });
  
  console.log(`✅ Successfully applied ${successCount} transactions`);
  console.log(`❌ Failed to apply ${errorCount} transactions`);
  
  // Validate consistency
  console.log('\n🔍 Validating inventory consistency...');
  const validation = invGenerator.validateInventoryConsistency();
  
  if (validation.passed) {
    console.log('✅ All validation checks passed!');
  } else {
    console.log('❌ Validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
  }
  
  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  // Generate report
  console.log('\n📊 Generating inventory report...');
  const report = invGenerator.generateInventoryReport();
  
  console.log('\nInventory Report Summary:');
  console.log('========================');
  console.log(`Total Units: ${report.summary.totalUnits}`);
  console.log(`Total Items: ${report.summary.totalItems}`);
  console.log(`Total Transactions: ${report.summary.totalTransactions}`);
  console.log(`\nUtilization Metrics:`);
  console.log(`- Total Rental Days: ${report.utilizationMetrics.totalRentalDays}`);
  console.log(`- Total Rental Revenue: $${report.utilizationMetrics.totalRentalRevenue.toFixed(2)}`);
  console.log(`- Average Rental Duration: ${report.utilizationMetrics.averageRentalDuration} days`);
  console.log(`\nCondition Distribution:`);
  Object.entries(report.conditionAnalysis.percentages).forEach(([grade, pct]) => {
    console.log(`- Grade ${grade}: ${pct}`);
  });
  
  // Save report
  const fs = require('fs');
  fs.writeFileSync(
    './test-data/inventory-report.json',
    JSON.stringify(report, null, 2)
  );
  console.log('\n📁 Full report saved to ./test-data/inventory-report.json');
}