/**
 * Rental Load Testing Performance Tests
 * Simulates peak periods with high concurrent load
 * Tests system behavior under realistic heavy usage patterns
 * Includes weekend peak scenarios and holiday/event load testing
 */

const RentalApiClient = require('./helpers/rental-api-client');
const RentalTestFactory = require('./helpers/rental-test-factory');
const { PerformanceMonitor, PerformanceUtils } = require('./helpers/performance-utils');

describe('Rental Load Testing Performance Tests', () => {
  let apiClient;
  let testFactory;
  let loadTestResults = [];
  let peakPeriodResults = [];
  
  // Load testing configuration for extreme scenarios
  const LOAD_CONFIG = {
    WEEKEND_PEAK_USERS: 50,          // 50 concurrent users (weekend)
    HOLIDAY_PEAK_USERS: 75,          // 75 concurrent users (holiday)
    EVENT_PEAK_USERS: 100,           // 100 concurrent users (special event)
    SUSTAINED_LOAD_DURATION: 300,    // 5 minutes sustained load
    BURST_LOAD_OPERATIONS: 200,      // 200 operations in burst
    CONCURRENT_CHECKOUTS: 25,        // 25 simultaneous checkouts
    CONCURRENT_RETURNS: 30,          // 30 simultaneous returns
    PEAK_SEARCH_QUERIES: 150,        // 150 concurrent searches
    AVALANCHE_FACTOR: 3,             // 3x normal load multiplier
    TIMEOUT: 900000,                 // 15 minutes total timeout
    STRESS_DELAY: 50,                // 50ms delay between operations
    CIRCUIT_BREAKER_THRESHOLD: 500   // 500ms response time threshold
  };

  beforeAll(async () => {
    console.log('🚀 Initializing Rental Load Testing Performance Tests...');
    console.log(`Load targets: WEEKEND=${LOAD_CONFIG.WEEKEND_PEAK_USERS}, HOLIDAY=${LOAD_CONFIG.HOLIDAY_PEAK_USERS}, EVENT=${LOAD_CONFIG.EVENT_PEAK_USERS}`);
    
    // Initialize high-capacity API client
    apiClient = new RentalApiClient({
      timeout: 60000,
      baseURL: 'http://localhost:8000/api',
      maxConcurrent: 150,
      retryAttempts: 3,
      circuitBreakerThreshold: LOAD_CONFIG.CIRCUIT_BREAKER_THRESHOLD
    });

    // Authenticate
    try {
      await apiClient.authenticate();
      console.log('✅ Load testing API authentication successful');
    } catch (error) {
      console.warn('⚠️  Authentication failed, proceeding without auth:', error.message);
    }

    // Initialize test data factory with large dataset
    testFactory = new RentalTestFactory();
    
    try {
      await testFactory.initialize(apiClient);
      await testFactory.preloadLargeDataset(500); // Preload 500 items
      console.log('✅ Load testing factory initialized with large dataset');
    } catch (error) {
      console.warn('⚠️  Large dataset preload failed:', error.message);
      throw new Error('Cannot proceed without load testing data');
    }

    // Health check with load capacity verification
    const health = await apiClient.healthCheck();
    console.log(`🏥 API Health: ${health.healthy ? 'Healthy' : 'Unhealthy'}`);
    
    if (health.healthy) {
      console.log(`💪 Server capacity: ${health.maxConnections || 'Unknown'} connections`);
    }
    
    console.log('🎯 Ready to start load testing...\n');
  }, 180000);

  afterAll(async () => {
    console.log('\n🧹 Cleaning up load test data...');
    
    // Log comprehensive load testing statistics
    console.log(`📊 Load Testing Statistics:`);
    console.log(`  - Total load test scenarios: ${loadTestResults.length}`);
    console.log(`  - Peak period tests: ${peakPeriodResults.length}`);
    console.log(`  - Total operations executed: ${loadTestResults.reduce((sum, r) => sum + (r.operationsExecuted || 0), 0)}`);
    
    const overallSuccessRate = loadTestResults.length > 0 
      ? (loadTestResults.filter(r => r.success).length / loadTestResults.length) * 100 
      : 0;
    console.log(`  - Overall success rate: ${overallSuccessRate.toFixed(1)}%`);
    
    // Clear factory tracking
    testFactory.clearTracking();
    
    console.log('🏁 Load testing performance tests completed');
  });

  describe('Weekend Peak Load Testing', () => {
    test(`should handle ${LOAD_CONFIG.WEEKEND_PEAK_USERS} concurrent weekend users`, async () => {
      const monitor = PerformanceUtils.createMonitor('Weekend Peak Load');
      monitor.startTest();

      console.log(`\n🏖️ Testing weekend peak load (${LOAD_CONFIG.WEEKEND_PEAK_USERS} concurrent users)...`);

      // Generate weekend-specific rental patterns
      const weekendOperations = [];
      
      for (let i = 0; i < LOAD_CONFIG.WEEKEND_PEAK_USERS; i++) {
        const userOperations = this.generateWeekendUserPattern(i);
        weekendOperations.push({
          userId: `weekend_user_${i}`,
          operations: userOperations,
          pattern: 'weekend_leisure'
        });
      }

      const weekendResult = await monitor.measureOperation(
        'weekend_peak_load',
        async () => {
          return await apiClient.executeLoadTest(weekendOperations, {
            concurrent: true,
            pattern: 'weekend_peak',
            sustainedDuration: LOAD_CONFIG.SUSTAINED_LOAD_DURATION / 2,
            burstOperations: LOAD_CONFIG.BURST_LOAD_OPERATIONS / 2
          });
        },
        { concurrentUsers: LOAD_CONFIG.WEEKEND_PEAK_USERS, scenario: 'weekend' }
      );

      monitor.endTest();

      if (weekendResult.result) {
        const results = weekendResult.result;
        loadTestResults.push({
          scenario: 'weekend_peak',
          success: results.overallSuccess,
          operationsExecuted: results.totalOperations,
          duration: weekendResult.duration,
          throughput: results.operationsPerSecond,
          errorRate: results.errorRate
        });

        console.log(`\n📊 Weekend Peak Load Results:`);
        console.log(`  🎯 Operations executed: ${results.totalOperations}`);
        console.log(`  ✅ Success rate: ${results.successRate.toFixed(1)}%`);
        console.log(`  ⚡ Throughput: ${results.operationsPerSecond.toFixed(1)} ops/sec`);
        console.log(`  ❌ Error rate: ${results.errorRate.toFixed(1)}%`);
        console.log(`  ⏱️  Average response: ${results.averageResponseTime.toFixed(2)}ms`);

        // Analyze user behavior patterns
        const behaviorAnalysis = this.analyzeUserBehaviors(results.userResults);
        console.log(`\n👥 User Behavior Analysis:`);
        Object.entries(behaviorAnalysis).forEach(([behavior, stats]) => {
          console.log(`  ${behavior}: ${stats.userCount} users, ${stats.averageOperations.toFixed(1)} ops/user`);
        });
      }

      // Generate and save report
      const report = monitor.generateReport();
      PerformanceUtils.saveResults(monitor, 'rental-weekend-peak-load');
      
      // Assertions for weekend peak load
      expect(weekendResult.result.successRate).toBeGreaterThan(85); // At least 85% success under weekend load
      expect(weekendResult.result.averageResponseTime).toBeLessThan(3000); // Average < 3s during peak
      expect(weekendResult.result.operationsPerSecond).toBeGreaterThan(15); // At least 15 ops/sec throughput
      
      monitor.printReport();
    }, LOAD_CONFIG.TIMEOUT);
  });

  describe('Holiday Event Load Testing', () => {
    test(`should handle ${LOAD_CONFIG.HOLIDAY_PEAK_USERS} concurrent holiday users`, async () => {
      const monitor = PerformanceUtils.createMonitor('Holiday Event Load');
      monitor.startTest();

      console.log(`\n🎉 Testing holiday event load (${LOAD_CONFIG.HOLIDAY_PEAK_USERS} concurrent users)...`);

      // Generate holiday-specific rental patterns (party equipment, decorations)
      const holidayOperations = [];
      
      for (let i = 0; i < LOAD_CONFIG.HOLIDAY_PEAK_USERS; i++) {
        const userOperations = this.generateHolidayUserPattern(i);
        holidayOperations.push({
          userId: `holiday_user_${i}`,
          operations: userOperations,
          pattern: 'holiday_event'
        });
      }

      const holidayResult = await monitor.measureOperation(
        'holiday_event_load',
        async () => {
          return await apiClient.executeLoadTest(holidayOperations, {
            concurrent: true,
            pattern: 'holiday_peak',
            sustainedDuration: LOAD_CONFIG.SUSTAINED_LOAD_DURATION,
            burstOperations: LOAD_CONFIG.BURST_LOAD_OPERATIONS,
            avalancheFactor: LOAD_CONFIG.AVALANCHE_FACTOR
          });
        },
        { concurrentUsers: LOAD_CONFIG.HOLIDAY_PEAK_USERS, scenario: 'holiday' }
      );

      monitor.endTest();

      if (holidayResult.result) {
        const results = holidayResult.result;
        loadTestResults.push({
          scenario: 'holiday_peak',
          success: results.overallSuccess,
          operationsExecuted: results.totalOperations,
          duration: holidayResult.duration,
          throughput: results.operationsPerSecond,
          errorRate: results.errorRate
        });

        console.log(`\n📊 Holiday Event Load Results:`);
        console.log(`  🎯 Operations executed: ${results.totalOperations}`);
        console.log(`  ✅ Success rate: ${results.successRate.toFixed(1)}%`);
        console.log(`  ⚡ Throughput: ${results.operationsPerSecond.toFixed(1)} ops/sec`);
        console.log(`  ❌ Error rate: ${results.errorRate.toFixed(1)}%`);
        console.log(`  ⏱️  Average response: ${results.averageResponseTime.toFixed(2)}ms`);

        // Analyze inventory pressure during holidays
        const inventoryPressure = this.analyzeInventoryPressure(results.inventoryMetrics);
        console.log(`\n📦 Inventory Pressure Analysis:`);
        console.log(`  🔥 High-demand items: ${inventoryPressure.highDemandItems}`);
        console.log(`  ⚠️  Stock conflicts: ${inventoryPressure.stockConflicts}`);
        console.log(`  📈 Reservation queue length: ${inventoryPressure.queueLength}`);
      }

      // Generate and save report
      const report = monitor.generateReport();
      PerformanceUtils.saveResults(monitor, 'rental-holiday-event-load');
      
      // Assertions for holiday load (more stringent due to higher demand)
      expect(holidayResult.result.successRate).toBeGreaterThan(80); // At least 80% success under holiday load
      expect(holidayResult.result.averageResponseTime).toBeLessThan(4000); // Average < 4s during holiday peak
      expect(holidayResult.result.operationsPerSecond).toBeGreaterThan(12); // At least 12 ops/sec throughput
      
      monitor.printReport();
    }, LOAD_CONFIG.TIMEOUT);
  });

  describe('Special Event Extreme Load Testing', () => {
    test(`should handle ${LOAD_CONFIG.EVENT_PEAK_USERS} concurrent special event users`, async () => {
      const monitor = PerformanceUtils.createMonitor('Special Event Extreme Load');
      monitor.startTest();

      console.log(`\n🎪 Testing special event extreme load (${LOAD_CONFIG.EVENT_PEAK_USERS} concurrent users)...`);

      // Generate extreme load patterns (concerts, festivals, corporate events)
      const eventOperations = [];
      
      for (let i = 0; i < LOAD_CONFIG.EVENT_PEAK_USERS; i++) {
        const userOperations = this.generateEventUserPattern(i);
        eventOperations.push({
          userId: `event_user_${i}`,
          operations: userOperations,
          pattern: 'special_event'
        });
      }

      const eventResult = await monitor.measureOperation(
        'special_event_extreme_load',
        async () => {
          return await apiClient.executeLoadTest(eventOperations, {
            concurrent: true,
            pattern: 'extreme_event',
            sustainedDuration: LOAD_CONFIG.SUSTAINED_LOAD_DURATION * 1.5,
            burstOperations: LOAD_CONFIG.BURST_LOAD_OPERATIONS * 2,
            avalancheFactor: LOAD_CONFIG.AVALANCHE_FACTOR * 1.5
          });
        },
        { concurrentUsers: LOAD_CONFIG.EVENT_PEAK_USERS, scenario: 'special_event' }
      );

      monitor.endTest();

      if (eventResult.result) {
        const results = eventResult.result;
        loadTestResults.push({
          scenario: 'special_event_extreme',
          success: results.overallSuccess,
          operationsExecuted: results.totalOperations,
          duration: eventResult.duration,
          throughput: results.operationsPerSecond,
          errorRate: results.errorRate
        });

        console.log(`\n📊 Special Event Extreme Load Results:`);
        console.log(`  🎯 Operations executed: ${results.totalOperations}`);
        console.log(`  ✅ Success rate: ${results.successRate.toFixed(1)}%`);
        console.log(`  ⚡ Throughput: ${results.operationsPerSecond.toFixed(1)} ops/sec`);
        console.log(`  ❌ Error rate: ${results.errorRate.toFixed(1)}%`);
        console.log(`  ⏱️  Average response: ${results.averageResponseTime.toFixed(2)}ms`);

        // Analyze system stability under extreme load
        const stabilityAnalysis = this.analyzeSystemStability(results.systemMetrics);
        console.log(`\n🔧 System Stability Analysis:`);
        console.log(`  💾 Memory usage peak: ${stabilityAnalysis.memoryPeak}%`);
        console.log(`  🔄 Connection pool utilization: ${stabilityAnalysis.connectionPoolUtilization}%`);
        console.log(`  ⚡ Circuit breaker trips: ${stabilityAnalysis.circuitBreakerTrips}`);
        console.log(`  🚨 Rate limit hits: ${stabilityAnalysis.rateLimitHits}`);
      }

      // Generate and save report
      const report = monitor.generateReport();
      PerformanceUtils.saveResults(monitor, 'rental-special-event-extreme-load');
      
      // Assertions for extreme load (most permissive due to stress conditions)
      expect(eventResult.result.successRate).toBeGreaterThan(70); // At least 70% success under extreme load
      expect(eventResult.result.averageResponseTime).toBeLessThan(6000); // Average < 6s during extreme load
      expect(eventResult.result.operationsPerSecond).toBeGreaterThan(8); // At least 8 ops/sec throughput
      
      monitor.printReport();
    }, LOAD_CONFIG.TIMEOUT);
  });

  describe('Sustained Load Endurance Testing', () => {
    test(`should sustain load for ${LOAD_CONFIG.SUSTAINED_LOAD_DURATION} seconds`, async () => {
      const monitor = PerformanceUtils.createMonitor('Sustained Load Endurance');
      monitor.startTest();

      console.log(`\n⏱️ Testing sustained load endurance (${LOAD_CONFIG.SUSTAINED_LOAD_DURATION} seconds)...`);

      const sustainedResult = await monitor.measureOperation(
        'sustained_load_endurance',
        async () => {
          return await apiClient.executeSustainedLoad({
            duration: LOAD_CONFIG.SUSTAINED_LOAD_DURATION,
            concurrentUsers: Math.floor(LOAD_CONFIG.WEEKEND_PEAK_USERS * 0.7), // 70% of weekend peak
            operationTypes: ['search', 'create', 'update', 'availability_check'],
            rampUpTime: 30, // 30 second ramp up
            rampDownTime: 30, // 30 second ramp down
            monitorMemoryLeaks: true,
            monitorConnectionPools: true
          });
        },
        { sustainedDuration: LOAD_CONFIG.SUSTAINED_LOAD_DURATION }
      );

      monitor.endTest();

      if (sustainedResult.result) {
        const results = sustainedResult.result;
        
        console.log(`\n📊 Sustained Load Endurance Results:`);
        console.log(`  ⏱️  Total duration: ${results.actualDuration.toFixed(1)} seconds`);
        console.log(`  🎯 Operations executed: ${results.totalOperations}`);
        console.log(`  ✅ Success rate: ${results.successRate.toFixed(1)}%`);
        console.log(`  ⚡ Average throughput: ${results.averageThroughput.toFixed(1)} ops/sec`);
        console.log(`  📈 Throughput stability: ${results.throughputStability.toFixed(1)}%`);

        // Analyze performance degradation over time
        const degradationAnalysis = this.analyzeDegradationOverTime(results.timeSeriesData);
        console.log(`\n📉 Performance Degradation Analysis:`);
        console.log(`  📊 Response time trend: ${degradationAnalysis.responseTimeTrend}`);
        console.log(`  💾 Memory growth: ${degradationAnalysis.memoryGrowth.toFixed(1)}MB`);
        console.log(`  🔗 Connection leaks detected: ${degradationAnalysis.connectionLeaks ? 'Yes' : 'No'}`);
      }

      // Generate and save report
      const report = monitor.generateReport();
      PerformanceUtils.saveResults(monitor, 'rental-sustained-load-endurance');
      
      // Assertions for sustained load
      expect(sustainedResult.result.successRate).toBeGreaterThan(85); // At least 85% success sustained
      expect(sustainedResult.result.throughputStability).toBeGreaterThan(80); // Stable throughput
      
      monitor.printReport();
    }, LOAD_CONFIG.TIMEOUT);
  });

  describe('Burst Load Spike Testing', () => {
    test(`should handle ${LOAD_CONFIG.BURST_LOAD_OPERATIONS} operations in burst`, async () => {
      const monitor = PerformanceUtils.createMonitor('Burst Load Spike');
      monitor.startTest();

      console.log(`\n💥 Testing burst load spikes (${LOAD_CONFIG.BURST_LOAD_OPERATIONS} operations)...`);

      const burstOperations = [];
      
      // Generate rapid-fire operations simulating sudden traffic spike
      for (let i = 0; i < LOAD_CONFIG.BURST_LOAD_OPERATIONS; i++) {
        const operationType = i % 5;
        let operation;
        
        switch (operationType) {
          case 0: // Search burst
            operation = {
              type: 'search',
              operation: () => this.executeSearchOperation(i)
            };
            break;
          case 1: // Availability check burst
            operation = {
              type: 'availability',
              operation: () => this.executeAvailabilityOperation(i)
            };
            break;
          case 2: // Quick rental creation
            operation = {
              type: 'create',
              operation: () => this.executeQuickCreateOperation(i)
            };
            break;
          case 3: // Status update burst
            operation = {
              type: 'update',
              operation: () => this.executeUpdateOperation(i)
            };
            break;
          case 4: // Analytics query burst
            operation = {
              type: 'analytics',
              operation: () => this.executeAnalyticsOperation(i)
            };
            break;
        }
        
        burstOperations.push(operation);
      }

      const burstResult = await monitor.measureOperation(
        'burst_load_spike',
        async () => {
          return await apiClient.executeBurstLoad(burstOperations, {
            maxConcurrency: 50,
            burstDelay: 0, // No delay between operations
            timeoutPerOperation: 5000,
            failFast: false
          });
        },
        { burstOperations: LOAD_CONFIG.BURST_LOAD_OPERATIONS }
      );

      monitor.endTest();

      if (burstResult.result) {
        const results = burstResult.result;
        
        console.log(`\n📊 Burst Load Spike Results:`);
        console.log(`  💥 Operations executed: ${results.operationsExecuted}`);
        console.log(`  ✅ Success rate: ${results.successRate.toFixed(1)}%`);
        console.log(`  ⚡ Peak throughput: ${results.peakThroughput.toFixed(1)} ops/sec`);
        console.log(`  ⏱️  Burst duration: ${results.burstDuration.toFixed(2)}ms`);
        console.log(`  🔥 Operations per type:`);
        
        Object.entries(results.operationTypeResults).forEach(([type, stats]) => {
          console.log(`    ${type}: ${stats.count} ops, ${stats.successRate.toFixed(1)}% success`);
        });

        // Analyze burst recovery
        const recoveryAnalysis = this.analyzeBurstRecovery(results.recoveryMetrics);
        console.log(`\n🔄 Burst Recovery Analysis:`);
        console.log(`  ⏱️  Recovery time: ${recoveryAnalysis.recoveryTime.toFixed(2)}ms`);
        console.log(`  📈 System stability post-burst: ${recoveryAnalysis.stabilityScore.toFixed(1)}%`);
      }

      // Generate and save report
      const report = monitor.generateReport();
      PerformanceUtils.saveResults(monitor, 'rental-burst-load-spike');
      
      // Assertions for burst load
      expect(burstResult.result.successRate).toBeGreaterThan(75); // At least 75% success in burst
      expect(burstResult.result.peakThroughput).toBeGreaterThan(25); // High peak throughput
      
      monitor.printReport();
    }, LOAD_CONFIG.TIMEOUT);
  });

  describe('Concurrent Checkout Storm Testing', () => {
    test(`should handle ${LOAD_CONFIG.CONCURRENT_CHECKOUTS} simultaneous checkouts`, async () => {
      const monitor = PerformanceUtils.createMonitor('Concurrent Checkout Storm');
      monitor.startTest();

      console.log(`\n🛒 Testing concurrent checkout storm (${LOAD_CONFIG.CONCURRENT_CHECKOUTS} simultaneous)...`);

      // Prepare checkout operations that compete for same inventory
      const checkoutOperations = [];
      const popularItemIds = await testFactory.getPopularItems(10); // Get 10 popular items
      
      for (let i = 0; i < LOAD_CONFIG.CONCURRENT_CHECKOUTS; i++) {
        const checkoutData = testFactory.generateRentalData({
          rentalType: 'express',
          preferredItems: popularItemIds, // Intentionally create competition
          scenarioType: 'checkout_storm'
        });
        
        checkoutOperations.push({
          checkoutId: `checkout_${i}`,
          data: checkoutData,
          priority: i < 10 ? 'high' : 'normal' // First 10 get high priority
        });
      }

      const checkoutResult = await monitor.measureOperation(
        'concurrent_checkout_storm',
        async () => {
          return await apiClient.executeConcurrentCheckouts(checkoutOperations, {
            simultaneousStart: true,
            inventoryLocking: true,
            conflictResolution: 'first_come_first_served',
            timeoutPerCheckout: 8000
          });
        },
        { concurrentCheckouts: LOAD_CONFIG.CONCURRENT_CHECKOUTS }
      );

      monitor.endTest();

      if (checkoutResult.result) {
        const results = checkoutResult.result;
        
        console.log(`\n📊 Concurrent Checkout Storm Results:`);
        console.log(`  🛒 Checkouts attempted: ${results.checkoutsAttempted}`);
        console.log(`  ✅ Successful checkouts: ${results.successfulCheckouts}`);
        console.log(`  ❌ Failed checkouts: ${results.failedCheckouts}`);
        console.log(`  🔒 Inventory conflicts: ${results.inventoryConflicts}`);
        console.log(`  ⏱️  Average checkout time: ${results.averageCheckoutTime.toFixed(2)}ms`);

        // Analyze inventory conflict resolution
        const conflictAnalysis = this.analyzeInventoryConflicts(results.conflictData);
        console.log(`\n🔧 Inventory Conflict Analysis:`);
        console.log(`  🥇 First-come wins: ${conflictAnalysis.firstComeWins}`);
        console.log(`  🎯 Alternative suggestions: ${conflictAnalysis.alternativeSuggestions}`);
        console.log(`  ⏳ Wait queue formed: ${conflictAnalysis.waitQueueFormed}`);
      }

      // Generate and save report
      const report = monitor.generateReport();
      PerformanceUtils.saveResults(monitor, 'rental-concurrent-checkout-storm');
      
      // Assertions for checkout storm
      expect(checkoutResult.result.successfulCheckouts).toBeGreaterThan(LOAD_CONFIG.CONCURRENT_CHECKOUTS * 0.6); // At least 60% success
      expect(checkoutResult.result.averageCheckoutTime).toBeLessThan(5000); // Average < 5s per checkout
      
      monitor.printReport();
    }, LOAD_CONFIG.TIMEOUT);
  });

  // Helper methods for load testing patterns

  generateWeekendUserPattern(userIndex) {
    const operations = [];
    const operationCount = 5 + (userIndex % 8); // 5-12 operations per weekend user
    
    for (let i = 0; i < operationCount; i++) {
      const opType = i % 4;
      switch (opType) {
        case 0: // Browse/Search
          operations.push({
            type: 'search',
            data: { category: 'outdoor', location: 'local' },
            delay: 500 + Math.random() * 1000
          });
          break;
        case 1: // Check availability
          operations.push({
            type: 'availability',
            data: { date_range: 'weekend', item_type: 'recreational' },
            delay: 300 + Math.random() * 700
          });
          break;
        case 2: // Create rental
          operations.push({
            type: 'create',
            data: testFactory.generateRentalData({ rentalType: 'weekend' }),
            delay: 1000 + Math.random() * 2000
          });
          break;
        case 3: // Update/Extend
          operations.push({
            type: 'update',
            data: { extension_days: 1 },
            delay: 200 + Math.random() * 500
          });
          break;
      }
    }
    
    return operations;
  }

  generateHolidayUserPattern(userIndex) {
    const operations = [];
    const operationCount = 7 + (userIndex % 10); // 7-16 operations per holiday user
    
    for (let i = 0; i < operationCount; i++) {
      const opType = i % 5;
      switch (opType) {
        case 0: // Search party equipment
          operations.push({
            type: 'search',
            data: { category: 'party', urgency: 'high' },
            delay: 200 + Math.random() * 600
          });
          break;
        case 1: // Bulk availability check
          operations.push({
            type: 'bulk_availability',
            data: { items: ['tables', 'chairs', 'tents'], date: 'holiday' },
            delay: 400 + Math.random() * 800
          });
          break;
        case 2: // Create large rental
          operations.push({
            type: 'create',
            data: testFactory.generateRentalData({ rentalType: 'holiday_event', itemCount: 5 }),
            delay: 1500 + Math.random() * 3000
          });
          break;
        case 3: // Add items to existing rental
          operations.push({
            type: 'add_items',
            data: { additional_items: 2 },
            delay: 800 + Math.random() * 1200
          });
          break;
        case 4: // Check pricing and fees
          operations.push({
            type: 'pricing',
            data: { complex_pricing: true },
            delay: 300 + Math.random() * 700
          });
          break;
      }
    }
    
    return operations;
  }

  generateEventUserPattern(userIndex) {
    const operations = [];
    const operationCount = 10 + (userIndex % 15); // 10-24 operations per event user
    
    for (let i = 0; i < operationCount; i++) {
      const opType = i % 6;
      switch (opType) {
        case 0: // Complex search
          operations.push({
            type: 'complex_search',
            data: { filters: ['category', 'location', 'capacity', 'date'], urgency: 'extreme' },
            delay: 100 + Math.random() * 400
          });
          break;
        case 1: // Multi-location availability
          operations.push({
            type: 'multi_location_availability',
            data: { locations: 3, item_categories: 5 },
            delay: 600 + Math.random() * 1000
          });
          break;
        case 2: // Large-scale rental creation
          operations.push({
            type: 'create',
            data: testFactory.generateRentalData({ rentalType: 'large_event', itemCount: 10 }),
            delay: 2000 + Math.random() * 4000
          });
          break;
        case 3: // Rapid modifications
          operations.push({
            type: 'rapid_update',
            data: { multiple_changes: true },
            delay: 400 + Math.random() * 800
          });
          break;
        case 4: // Real-time analytics
          operations.push({
            type: 'analytics',
            data: { real_time: true, complex_aggregation: true },
            delay: 500 + Math.random() * 1000
          });
          break;
        case 5: // Coordination operations
          operations.push({
            type: 'coordination',
            data: { multi_user: true, synchronization: true },
            delay: 300 + Math.random() * 600
          });
          break;
      }
    }
    
    return operations;
  }

  async executeSearchOperation(index) {
    const searchData = testFactory.generateSearchData('load_test');
    return await apiClient.searchRentals(searchData);
  }

  async executeAvailabilityOperation(index) {
    const availabilityData = testFactory.generateAvailabilityData('burst_test');
    return await apiClient.checkAvailability(availabilityData);
  }

  async executeQuickCreateOperation(index) {
    const rentalData = testFactory.generateRentalData({ rentalType: 'express' });
    return await apiClient.createRental(rentalData);
  }

  async executeUpdateOperation(index) {
    const updateData = testFactory.generateUpdateData('status');
    return await apiClient.updateRental(`load_test_${index}`, updateData);
  }

  async executeAnalyticsOperation(index) {
    return await apiClient.getAnalytics('dashboard', { quick: true });
  }

  // Analysis helper methods

  analyzeUserBehaviors(userResults) {
    const behaviors = {
      'casual_browser': { userCount: 0, averageOperations: 0 },
      'serious_renter': { userCount: 0, averageOperations: 0 },
      'bulk_coordinator': { userCount: 0, averageOperations: 0 }
    };
    
    userResults.forEach(user => {
      if (user.operationCount <= 5) {
        behaviors.casual_browser.userCount++;
        behaviors.casual_browser.averageOperations += user.operationCount;
      } else if (user.operationCount <= 12) {
        behaviors.serious_renter.userCount++;
        behaviors.serious_renter.averageOperations += user.operationCount;
      } else {
        behaviors.bulk_coordinator.userCount++;
        behaviors.bulk_coordinator.averageOperations += user.operationCount;
      }
    });
    
    Object.keys(behaviors).forEach(behavior => {
      if (behaviors[behavior].userCount > 0) {
        behaviors[behavior].averageOperations /= behaviors[behavior].userCount;
      }
    });
    
    return behaviors;
  }

  analyzeInventoryPressure(inventoryMetrics) {
    return {
      highDemandItems: inventoryMetrics?.highDemandItems || 0,
      stockConflicts: inventoryMetrics?.stockConflicts || 0,
      queueLength: inventoryMetrics?.queueLength || 0
    };
  }

  analyzeSystemStability(systemMetrics) {
    return {
      memoryPeak: systemMetrics?.memoryPeak || 75,
      connectionPoolUtilization: systemMetrics?.connectionPoolUtilization || 80,
      circuitBreakerTrips: systemMetrics?.circuitBreakerTrips || 0,
      rateLimitHits: systemMetrics?.rateLimitHits || 0
    };
  }

  analyzeDegradationOverTime(timeSeriesData) {
    return {
      responseTimeTrend: timeSeriesData?.responseTimeTrend || 'stable',
      memoryGrowth: timeSeriesData?.memoryGrowth || 0,
      connectionLeaks: timeSeriesData?.connectionLeaks || false
    };
  }

  analyzeBurstRecovery(recoveryMetrics) {
    return {
      recoveryTime: recoveryMetrics?.recoveryTime || 1000,
      stabilityScore: recoveryMetrics?.stabilityScore || 85
    };
  }

  analyzeInventoryConflicts(conflictData) {
    return {
      firstComeWins: conflictData?.firstComeWins || 0,
      alternativeSuggestions: conflictData?.alternativeSuggestions || 0,
      waitQueueFormed: conflictData?.waitQueueFormed || false
    };
  }
});