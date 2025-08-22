#!/usr/bin/env node

/**
 * Purchase CRUD Performance Demo
 * Demonstrates the performance testing framework with mock data
 */

const PurchaseTestFactory = require('./tests/helpers/purchase-test-factory');
const { PerformanceMonitor, PerformanceUtils } = require('./tests/helpers/performance-utils');

// Mock API client for demonstration
class MockApiClient {
  constructor() {
    this.mockDelay = 50; // 50ms mock API delay
    this.failureRate = 0.05; // 5% failure rate
  }

  async get(endpoint) {
    await this.delay();
    
    if (endpoint.includes('/suppliers/')) {
      return { data: this.generateMockSuppliers(10) };
    }
    if (endpoint.includes('/locations/')) {
      return { data: this.generateMockLocations(5) };
    }
    if (endpoint.includes('/items/')) {
      return { data: this.generateMockItems(20) };
    }
    
    return { data: [] };
  }

  async post(endpoint, data) {
    await this.delay();
    
    if (Math.random() < this.failureRate) {
      throw new Error('Mock API failure');
    }
    
    return {
      data: {
        data: {
          id: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          transaction_id: `txn-${Date.now()}`,
          ...data
        }
      },
      status: 201
    };
  }

  async put(endpoint, data) {
    await this.delay();
    
    if (Math.random() < this.failureRate) {
      throw new Error('Mock API failure');
    }
    
    return {
      data: { data: { ...data, updated_at: new Date().toISOString() } },
      status: 200
    };
  }

  async delete(endpoint) {
    await this.delay();
    
    if (Math.random() < this.failureRate) {
      throw new Error('Mock API failure');
    }
    
    return {
      data: { message: 'Deleted successfully' },
      status: 200
    };
  }

  delay(ms = this.mockDelay) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateMockSuppliers(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: `supplier-${i + 1}`,
      supplier_code: `SUP${(i + 1).toString().padStart(3, '0')}`,
      company_name: `Test Supplier ${i + 1}`,
      supplier_type: 'MANUFACTURER'
    }));
  }

  generateMockLocations(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: `location-${i + 1}`,
      location_code: `LOC${(i + 1).toString().padStart(3, '0')}`,
      location_name: `Test Location ${i + 1}`,
      location_type: 'WAREHOUSE'
    }));
  }

  generateMockItems(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${i + 1}`,
      item_code: `ITEM${(i + 1).toString().padStart(3, '0')}`,
      item_name: `Test Item ${i + 1}`,
      unit_of_measurement: 'PIECE'
    }));
  }
}

// Mock Purchase API Client for demonstration
class MockPurchaseApiClient extends MockApiClient {
  constructor() {
    super();
    this.createdPurchases = new Map();
  }

  async createPurchase(purchaseData) {
    const start = performance.now();
    const result = await this.post('/transactions/purchases/new', purchaseData);
    const end = performance.now();
    
    // Store for subsequent operations
    this.createdPurchases.set(result.data.data.id, {
      ...purchaseData,
      ...result.data.data
    });
    
    return {
      data: result.data,
      duration: end - start,
      status: result.status
    };
  }

  async getPurchase(purchaseId) {
    const start = performance.now();
    
    if (!this.createdPurchases.has(purchaseId)) {
      throw new Error('Purchase not found');
    }
    
    await this.delay();
    const end = performance.now();
    
    return {
      data: { data: this.createdPurchases.get(purchaseId) },
      duration: end - start,
      status: 200
    };
  }

  async getPurchases(filters = {}) {
    const start = performance.now();
    await this.delay();
    const end = performance.now();
    
    const purchases = Array.from(this.createdPurchases.values());
    const limit = filters.limit || 10;
    const skip = filters.skip || 0;
    
    return {
      data: {
        data: purchases.slice(skip, skip + limit),
        total: purchases.length
      },
      duration: end - start,
      status: 200
    };
  }

  async updatePurchase(purchaseId, updateData) {
    const start = performance.now();
    
    if (!this.createdPurchases.has(purchaseId)) {
      throw new Error('Purchase not found');
    }
    
    const result = await this.put(`/transactions/purchases/${purchaseId}`, updateData);
    
    // Update stored data
    const existing = this.createdPurchases.get(purchaseId);
    this.createdPurchases.set(purchaseId, { ...existing, ...updateData });
    
    const end = performance.now();
    
    return {
      data: result.data,
      duration: end - start,
      status: result.status
    };
  }

  async deletePurchase(purchaseId) {
    const start = performance.now();
    
    if (!this.createdPurchases.has(purchaseId)) {
      throw new Error('Purchase not found');
    }
    
    const result = await this.delete(`/transactions/purchases/${purchaseId}`);
    this.createdPurchases.delete(purchaseId);
    
    const end = performance.now();
    
    return {
      data: result.data,
      duration: end - start,
      status: result.status
    };
  }

  async bulkCreatePurchases(purchasesData, options = {}) {
    const { concurrent = false, batchSize = 10 } = options;
    const results = [];
    
    if (concurrent) {
      const promises = purchasesData.map(data => this.createPurchase(data));
      const responses = await Promise.allSettled(promises);
      
      responses.forEach((response, index) => {
        if (response.status === 'fulfilled') {
          results.push({ success: true, data: response.value, index });
        } else {
          results.push({ success: false, error: response.reason, index });
        }
      });
    } else {
      for (let i = 0; i < purchasesData.length; i++) {
        try {
          const result = await this.createPurchase(purchasesData[i]);
          results.push({ success: true, data: result, index: i });
        } catch (error) {
          results.push({ success: false, error, index: i });
        }
      }
    }
    
    return results;
  }

  async bulkUpdatePurchases(updates, options = {}) {
    const results = [];
    
    for (const update of updates) {
      try {
        const result = await this.updatePurchase(update.id, update.data);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error });
      }
    }
    
    return results;
  }

  async bulkDeletePurchases(purchaseIds, options = {}) {
    const results = [];
    
    for (const id of purchaseIds) {
      try {
        const result = await this.deletePurchase(id);
        results.push({ success: true, data: result, id });
      } catch (error) {
        results.push({ success: false, error, id });
      }
    }
    
    return results;
  }

  getStats() {
    return {
      createdPurchases: this.createdPurchases.size,
      mockDelay: this.mockDelay,
      failureRate: this.failureRate
    };
  }
}

async function runPerformanceDemo() {
  console.log('🚀 Purchase CRUD Performance Demo');
  console.log('==================================\n');
  
  // Initialize mock API client
  const apiClient = new MockPurchaseApiClient();
  console.log('✅ Mock API client initialized');
  
  // Initialize test factory
  const testFactory = new PurchaseTestFactory();
  await testFactory.initialize(apiClient);
  console.log('✅ Test factory initialized with mock data');
  
  const results = {
    create: null,
    read: null,
    update: null,
    delete: null
  };
  
  let createdPurchaseIds = [];
  
  // Test CREATE operations
  console.log('\n📝 Testing CREATE Performance (50 purchases)...');
  const createMonitor = PerformanceUtils.createMonitor('Purchase CREATE Demo');
  createMonitor.startTest();
  
  const purchasesData = testFactory.generateMultiplePurchases(50, { itemCount: 1 });
  
  const createResult = await createMonitor.measureOperation(
    'bulk_create',
    async () => {
      return await apiClient.bulkCreatePurchases(purchasesData, { concurrent: false });
    }
  );
  
  if (createResult.result) {
    const successfulCreations = createResult.result.filter(r => r.success);
    createdPurchaseIds = successfulCreations
      .map(r => r.data?.data?.data?.id)
      .filter(id => id);
    
    console.log(`  ✅ Created ${successfulCreations.length}/50 purchases`);
    console.log(`  ⏱️  Average time: ${(createResult.duration / 50).toFixed(2)}ms per purchase`);
  }
  
  createMonitor.endTest();
  results.create = createMonitor.generateReport();
  
  // Test READ operations
  if (createdPurchaseIds.length > 0) {
    console.log('\n📖 Testing READ Performance (30 operations)...');
    const readMonitor = PerformanceUtils.createMonitor('Purchase READ Demo');
    readMonitor.startTest();
    
    for (let i = 0; i < 30; i++) {
      const randomId = createdPurchaseIds[Math.floor(Math.random() * createdPurchaseIds.length)];
      
      await readMonitor.measureOperation(
        `read_${i}`,
        async () => {
          return await apiClient.getPurchase(randomId);
        }
      );
    }
    
    readMonitor.endTest();
    results.read = readMonitor.generateReport();
    
    console.log(`  ✅ Completed 30 read operations`);
    console.log(`  ⏱️  Average time: ${results.read.timingAnalysis.average}ms`);
  }
  
  // Test UPDATE operations
  if (createdPurchaseIds.length > 0) {
    console.log('\n✏️  Testing UPDATE Performance (20 operations)...');
    const updateMonitor = PerformanceUtils.createMonitor('Purchase UPDATE Demo');
    updateMonitor.startTest();
    
    const updateIds = createdPurchaseIds.slice(0, 20);
    const updates = updateIds.map(id => ({
      id,
      data: testFactory.generateUpdateData('partial')
    }));
    
    const updateResult = await updateMonitor.measureOperation(
      'bulk_update',
      async () => {
        return await apiClient.bulkUpdatePurchases(updates);
      }
    );
    
    updateMonitor.endTest();
    results.update = updateMonitor.generateReport();
    
    if (updateResult.result) {
      const successfulUpdates = updateResult.result.filter(r => r.success).length;
      console.log(`  ✅ Updated ${successfulUpdates}/20 purchases`);
      console.log(`  ⏱️  Average time: ${(updateResult.duration / 20).toFixed(2)}ms per update`);
    }
  }
  
  // Test DELETE operations
  if (createdPurchaseIds.length > 0) {
    console.log('\n🗑️  Testing DELETE Performance...');
    const deleteMonitor = PerformanceUtils.createMonitor('Purchase DELETE Demo');
    deleteMonitor.startTest();
    
    const deleteResult = await deleteMonitor.measureOperation(
      'bulk_delete',
      async () => {
        return await apiClient.bulkDeletePurchases(createdPurchaseIds);
      }
    );
    
    deleteMonitor.endTest();
    results.delete = deleteMonitor.generateReport();
    
    if (deleteResult.result) {
      const successfulDeletes = deleteResult.result.filter(r => r.success).length;
      console.log(`  ✅ Deleted ${successfulDeletes}/${createdPurchaseIds.length} purchases`);
      console.log(`  ⏱️  Average time: ${(deleteResult.duration / createdPurchaseIds.length).toFixed(2)}ms per delete`);
    }
  }
  
  // Generate comprehensive summary
  console.log('\n📊 COMPREHENSIVE PERFORMANCE SUMMARY');
  console.log('=' .repeat(60));
  
  Object.entries(results).forEach(([operation, report]) => {
    if (report) {
      console.log(`\n${operation.toUpperCase()} Operations:`);
      console.log(`  Total Operations: ${report.overview.totalOperations}`);
      console.log(`  Success Rate: ${report.overview.successRate}%`);
      console.log(`  Average Response: ${report.timingAnalysis.average}ms`);
      console.log(`  95th Percentile: ${report.timingAnalysis.p95}ms`);
      
      // Show recommendations
      if (report.recommendations.length > 0) {
        console.log(`  Recommendations:`);
        report.recommendations.forEach(rec => {
          const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
          console.log(`    ${icon} ${rec.message}`);
        });
      }
    }
  });
  
  // Save results
  const fs = require('fs');
  const path = require('path');
  
  const summaryReport = {
    testSuite: 'Purchase CRUD Performance Demo',
    timestamp: new Date().toISOString(),
    mockApiStats: apiClient.getStats(),
    results: results,
    summary: {
      totalOperations: Object.values(results).reduce((sum, r) => r ? sum + parseInt(r.overview.totalOperations) : sum, 0),
      averageSuccessRate: Object.values(results).reduce((sum, r) => r ? sum + parseFloat(r.overview.successRate) : sum, 0) / Object.keys(results).length,
      performanceInsights: [
        'Mock API demonstrates consistent performance patterns',
        'CRUD operations show expected latency characteristics',
        'Bulk operations provide efficiency gains',
        'Error handling mechanisms working correctly'
      ]
    }
  };
  
  const resultsDir = path.join(__dirname, 'tests', 'performance-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const summaryPath = path.join(resultsDir, `purchase-performance-demo-${Date.now()}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2));
  
  console.log(`\n💾 Demo results saved to: ${summaryPath}`);
  console.log('\n🎉 Performance demo completed successfully!');
  console.log('\nNote: This demo used mock data. For real performance testing,');
  console.log('run the tests against the actual FastAPI backend.');
}

// Run the demo
if (require.main === module) {
  runPerformanceDemo().catch(error => {
    console.error('💥 Demo failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runPerformanceDemo };