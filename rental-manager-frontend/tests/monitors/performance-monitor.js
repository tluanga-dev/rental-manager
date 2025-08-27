/**
 * Performance Monitoring Framework
 * Tracks and analyzes performance metrics during test execution
 */

const { performance } = require('perf_hooks');

class PerformanceMonitor {
  constructor(config = {}) {
    this.config = {
      memoryCheckInterval: config.memoryCheckInterval || 1000, // Check every second
      memoryThresholdMB: config.memoryThresholdMB || 500,
      responseTimeThresholdMs: config.responseTimeThresholdMs || 5000,
      enableDetailedLogging: config.enableDetailedLogging || false,
      ...config
    };
    
    // Metrics storage
    this.metrics = {
      operations: [],
      memory: [],
      queries: [],
      errors: [],
      summary: {}
    };
    
    // Memory monitoring
    this.memoryMonitor = null;
    this.startMemory = process.memoryUsage();
    this.peakMemory = { ...this.startMemory };
    
    // Operation tracking
    this.activeOperations = new Map();
    this.operationCounter = 0;
  }

  /**
   * Start monitoring
   */
  start() {
    console.log('🚀 Performance monitoring started');
    
    // Record start time
    this.startTime = Date.now();
    this.metrics.startTime = new Date().toISOString();
    
    // Start memory monitoring
    this.startMemoryMonitoring();
    
    // Reset metrics
    this.metrics.operations = [];
    this.metrics.memory = [];
    this.metrics.queries = [];
    this.metrics.errors = [];
    
    return this;
  }

  /**
   * Stop monitoring and generate report
   */
  stop() {
    console.log('⏹️  Performance monitoring stopped');
    
    // Stop memory monitoring
    this.stopMemoryMonitoring();
    
    // Calculate summary statistics
    this.calculateSummary();
    
    // Record end time
    this.endTime = Date.now();
    this.metrics.endTime = new Date().toISOString();
    this.metrics.totalDuration = this.endTime - this.startTime;
    
    return this.generateReport();
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    this.memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const timestamp = Date.now();
      
      const memorySnapshot = {
        timestamp,
        elapsed: timestamp - this.startTime,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        rssMB: (memUsage.rss / 1024 / 1024).toFixed(2)
      };
      
      this.metrics.memory.push(memorySnapshot);
      
      // Update peak memory
      if (memUsage.heapUsed > this.peakMemory.heapUsed) {
        this.peakMemory = memUsage;
      }
      
      // Check threshold
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > this.config.memoryThresholdMB) {
        console.warn(`⚠️  Memory usage exceeded threshold: ${heapUsedMB.toFixed(2)} MB`);
        this.metrics.errors.push({
          type: 'MEMORY_THRESHOLD_EXCEEDED',
          timestamp,
          value: heapUsedMB,
          threshold: this.config.memoryThresholdMB
        });
      }
      
      if (this.config.enableDetailedLogging) {
        console.log(`📊 Memory: Heap ${heapUsedMB.toFixed(2)} MB, RSS ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
      }
    }, this.config.memoryCheckInterval);
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring() {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }
  }

  /**
   * Start tracking an operation
   */
  startOperation(name, metadata = {}) {
    const operationId = `op_${++this.operationCounter}_${Date.now()}`;
    
    const operation = {
      id: operationId,
      name,
      metadata,
      startTime: Date.now(),
      startMark: `${operationId}_start`,
      endMark: `${operationId}_end`,
      measureName: `${operationId}_duration`,
      memoryAtStart: process.memoryUsage().heapUsed
    };
    
    this.activeOperations.set(operationId, operation);
    performance.mark(operation.startMark);
    
    if (this.config.enableDetailedLogging) {
      console.log(`▶️  Started: ${name} [${operationId}]`);
    }
    
    return operationId;
  }

  /**
   * End tracking an operation
   */
  endOperation(operationId, result = {}) {
    const operation = this.activeOperations.get(operationId);
    
    if (!operation) {
      console.warn(`Operation ${operationId} not found`);
      return null;
    }
    
    const endTime = Date.now();
    const memoryAtEnd = process.memoryUsage().heapUsed;
    
    performance.mark(operation.endMark);
    performance.measure(
      operation.measureName,
      operation.startMark,
      operation.endMark
    );
    
    const measure = performance.getEntriesByName(operation.measureName)[0];
    const duration = endTime - operation.startTime;
    
    const completedOperation = {
      ...operation,
      endTime,
      duration,
      performanceDuration: measure ? measure.duration : duration,
      memoryAtEnd,
      memoryDelta: memoryAtEnd - operation.memoryAtStart,
      memoryDeltaMB: ((memoryAtEnd - operation.memoryAtStart) / 1024 / 1024).toFixed(2),
      result: result.success !== undefined ? result : { success: true, ...result },
      status: duration > this.config.responseTimeThresholdMs ? 'SLOW' : 'OK'
    };
    
    this.metrics.operations.push(completedOperation);
    this.activeOperations.delete(operationId);
    
    // Clean up performance marks
    performance.clearMarks(operation.startMark);
    performance.clearMarks(operation.endMark);
    performance.clearMeasures(operation.measureName);
    
    if (this.config.enableDetailedLogging) {
      console.log(`✅ Completed: ${operation.name} in ${duration}ms [${operationId}]`);
    }
    
    // Check threshold
    if (duration > this.config.responseTimeThresholdMs) {
      console.warn(`⚠️  Operation exceeded time threshold: ${operation.name} took ${duration}ms`);
      this.metrics.errors.push({
        type: 'RESPONSE_TIME_EXCEEDED',
        operationId,
        operationName: operation.name,
        duration,
        threshold: this.config.responseTimeThresholdMs
      });
    }
    
    return completedOperation;
  }

  /**
   * Track a database query
   */
  trackQuery(queryName, query, duration, rowCount = null) {
    const queryMetric = {
      name: queryName,
      query: this.config.enableDetailedLogging ? query : query.substring(0, 100),
      timestamp: Date.now(),
      duration,
      rowCount,
      status: duration > 1000 ? 'SLOW' : 'OK'
    };
    
    this.metrics.queries.push(queryMetric);
    
    if (duration > 1000) {
      console.warn(`⚠️  Slow query detected: ${queryName} took ${duration}ms`);
    }
    
    return queryMetric;
  }

  /**
   * Track an error
   */
  trackError(error, context = {}) {
    const errorMetric = {
      timestamp: Date.now(),
      message: error.message || error,
      stack: error.stack,
      context,
      type: error.name || 'Error'
    };
    
    this.metrics.errors.push(errorMetric);
    
    console.error(`❌ Error tracked: ${errorMetric.message}`);
    
    return errorMetric;
  }

  /**
   * Mark a checkpoint
   */
  checkpoint(name, data = {}) {
    const checkpoint = {
      name,
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      data
    };
    
    if (!this.metrics.checkpoints) {
      this.metrics.checkpoints = [];
    }
    
    this.metrics.checkpoints.push(checkpoint);
    
    console.log(`🏁 Checkpoint: ${name} at ${checkpoint.elapsed}ms`);
    
    return checkpoint;
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary() {
    const operations = this.metrics.operations;
    
    if (operations.length === 0) {
      this.metrics.summary = { noOperations: true };
      return;
    }
    
    // Operation statistics
    const durations = operations.map(op => op.duration);
    const sortedDurations = durations.sort((a, b) => a - b);
    
    this.metrics.summary = {
      operations: {
        total: operations.length,
        successful: operations.filter(op => op.result?.success !== false).length,
        failed: operations.filter(op => op.result?.success === false).length,
        slow: operations.filter(op => op.status === 'SLOW').length,
        averageDuration: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2),
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        medianDuration: this.calculateMedian(sortedDurations),
        p95Duration: this.calculatePercentile(sortedDurations, 95),
        p99Duration: this.calculatePercentile(sortedDurations, 99)
      }
    };
    
    // Memory statistics
    if (this.metrics.memory.length > 0) {
      const heapUsages = this.metrics.memory.map(m => m.heapUsed);
      
      this.metrics.summary.memory = {
        startHeapMB: (this.startMemory.heapUsed / 1024 / 1024).toFixed(2),
        peakHeapMB: (this.peakMemory.heapUsed / 1024 / 1024).toFixed(2),
        endHeapMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        averageHeapMB: (heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length / 1024 / 1024).toFixed(2),
        maxRssMB: (Math.max(...this.metrics.memory.map(m => m.rss)) / 1024 / 1024).toFixed(2),
        samples: this.metrics.memory.length
      };
    }
    
    // Query statistics
    if (this.metrics.queries.length > 0) {
      const queryDurations = this.metrics.queries.map(q => q.duration);
      
      this.metrics.summary.queries = {
        total: this.metrics.queries.length,
        slow: this.metrics.queries.filter(q => q.status === 'SLOW').length,
        averageDuration: (queryDurations.reduce((a, b) => a + b, 0) / queryDurations.length).toFixed(2),
        maxDuration: Math.max(...queryDurations),
        totalDuration: queryDurations.reduce((a, b) => a + b, 0)
      };
    }
    
    // Error statistics
    this.metrics.summary.errors = {
      total: this.metrics.errors.length,
      types: {}
    };
    
    this.metrics.errors.forEach(error => {
      this.metrics.summary.errors.types[error.type] = 
        (this.metrics.summary.errors.types[error.type] || 0) + 1;
    });
    
    // Operation type breakdown
    this.metrics.summary.operationTypes = {};
    operations.forEach(op => {
      this.metrics.summary.operationTypes[op.name] = 
        (this.metrics.summary.operationTypes[op.name] || 0) + 1;
    });
  }

  /**
   * Calculate median value
   */
  calculateMedian(sortedArray) {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0 ?
      (sortedArray[mid - 1] + sortedArray[mid]) / 2 :
      sortedArray[mid];
  }

  /**
   * Calculate percentile value
   */
  calculatePercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const report = {
      metadata: {
        startTime: this.metrics.startTime,
        endTime: this.metrics.endTime,
        totalDuration: this.metrics.totalDuration,
        config: this.config
      },
      summary: this.metrics.summary,
      details: {
        operations: this.config.enableDetailedLogging ? this.metrics.operations : 
          this.metrics.operations.slice(0, 100), // Limit to first 100 for brevity
        memory: this.metrics.memory.length > 100 ? 
          this.sampleArray(this.metrics.memory, 100) : this.metrics.memory,
        queries: this.metrics.queries.slice(0, 50),
        errors: this.metrics.errors,
        checkpoints: this.metrics.checkpoints
      },
      analysis: this.analyzePerformance()
    };
    
    return report;
  }

  /**
   * Analyze performance and provide recommendations
   */
  analyzePerformance() {
    const analysis = {
      status: 'OK',
      issues: [],
      recommendations: [],
      score: 100
    };
    
    // Check for memory issues
    const peakMemoryMB = this.peakMemory.heapUsed / 1024 / 1024;
    if (peakMemoryMB > this.config.memoryThresholdMB) {
      analysis.issues.push(`Peak memory usage (${peakMemoryMB.toFixed(2)} MB) exceeded threshold`);
      analysis.recommendations.push('Consider optimizing memory usage or increasing threshold');
      analysis.score -= 20;
    }
    
    // Check for memory leaks
    const memoryGrowth = (process.memoryUsage().heapUsed - this.startMemory.heapUsed) / 1024 / 1024;
    if (memoryGrowth > 100) {
      analysis.issues.push(`Significant memory growth detected: ${memoryGrowth.toFixed(2)} MB`);
      analysis.recommendations.push('Check for memory leaks in long-running operations');
      analysis.score -= 15;
    }
    
    // Check for slow operations
    if (this.metrics.summary.operations) {
      const slowOpsPercentage = (this.metrics.summary.operations.slow / this.metrics.summary.operations.total) * 100;
      if (slowOpsPercentage > 10) {
        analysis.issues.push(`${slowOpsPercentage.toFixed(1)}% of operations exceeded time threshold`);
        analysis.recommendations.push('Optimize slow operations or adjust threshold');
        analysis.score -= 25;
      }
    }
    
    // Check for errors
    if (this.metrics.errors.length > 0) {
      analysis.issues.push(`${this.metrics.errors.length} errors occurred during execution`);
      analysis.recommendations.push('Review and fix errors before production');
      analysis.score -= (this.metrics.errors.length * 5);
    }
    
    // Check query performance
    if (this.metrics.summary.queries && this.metrics.summary.queries.slow > 0) {
      analysis.issues.push(`${this.metrics.summary.queries.slow} slow queries detected`);
      analysis.recommendations.push('Optimize database queries and add indexes');
      analysis.score -= 10;
    }
    
    // Determine overall status
    if (analysis.score >= 80) {
      analysis.status = 'GOOD';
    } else if (analysis.score >= 60) {
      analysis.status = 'WARNING';
    } else {
      analysis.status = 'CRITICAL';
    }
    
    analysis.score = Math.max(0, analysis.score);
    
    return analysis;
  }

  /**
   * Sample array evenly
   */
  sampleArray(array, sampleSize) {
    if (array.length <= sampleSize) return array;
    
    const sampled = [];
    const step = Math.floor(array.length / sampleSize);
    
    for (let i = 0; i < array.length; i += step) {
      sampled.push(array[i]);
    }
    
    // Always include last element
    if (sampled[sampled.length - 1] !== array[array.length - 1]) {
      sampled.push(array[array.length - 1]);
    }
    
    return sampled;
  }

  /**
   * Export report to file
   */
  exportReport(report, filepath = './performance-report.json') {
    const fs = require('fs');
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`📊 Performance report saved to ${filepath}`);
    
    // Also create a summary text file
    const summaryPath = filepath.replace('.json', '-summary.txt');
    const summaryText = this.generateSummaryText(report);
    
    fs.writeFileSync(summaryPath, summaryText);
    console.log(`📄 Summary saved to ${summaryPath}`);
  }

  /**
   * Generate human-readable summary text
   */
  generateSummaryText(report) {
    let text = 'PERFORMANCE TEST REPORT\n';
    text += '=======================\n\n';
    
    text += `Test Duration: ${(report.metadata.totalDuration / 1000).toFixed(2)} seconds\n`;
    text += `Start Time: ${report.metadata.startTime}\n`;
    text += `End Time: ${report.metadata.endTime}\n\n`;
    
    if (report.summary.operations) {
      text += 'OPERATION STATISTICS\n';
      text += '-------------------\n';
      text += `Total Operations: ${report.summary.operations.total}\n`;
      text += `Successful: ${report.summary.operations.successful}\n`;
      text += `Failed: ${report.summary.operations.failed}\n`;
      text += `Slow: ${report.summary.operations.slow}\n`;
      text += `Average Duration: ${report.summary.operations.averageDuration} ms\n`;
      text += `Median Duration: ${report.summary.operations.medianDuration} ms\n`;
      text += `95th Percentile: ${report.summary.operations.p95Duration} ms\n`;
      text += `99th Percentile: ${report.summary.operations.p99Duration} ms\n\n`;
    }
    
    if (report.summary.memory) {
      text += 'MEMORY STATISTICS\n';
      text += '----------------\n';
      text += `Start Heap: ${report.summary.memory.startHeapMB} MB\n`;
      text += `Peak Heap: ${report.summary.memory.peakHeapMB} MB\n`;
      text += `End Heap: ${report.summary.memory.endHeapMB} MB\n`;
      text += `Average Heap: ${report.summary.memory.averageHeapMB} MB\n`;
      text += `Max RSS: ${report.summary.memory.maxRssMB} MB\n\n`;
    }
    
    if (report.analysis) {
      text += 'PERFORMANCE ANALYSIS\n';
      text += '-------------------\n';
      text += `Overall Status: ${report.analysis.status}\n`;
      text += `Performance Score: ${report.analysis.score}/100\n\n`;
      
      if (report.analysis.issues.length > 0) {
        text += 'Issues Detected:\n';
        report.analysis.issues.forEach(issue => {
          text += `- ${issue}\n`;
        });
        text += '\n';
      }
      
      if (report.analysis.recommendations.length > 0) {
        text += 'Recommendations:\n';
        report.analysis.recommendations.forEach(rec => {
          text += `- ${rec}\n`;
        });
        text += '\n';
      }
    }
    
    return text;
  }
}

// Export for use in other modules
module.exports = PerformanceMonitor;

// Run directly if called as script for testing
if (require.main === module) {
  console.log('Testing PerformanceMonitor...\n');
  
  const monitor = new PerformanceMonitor({
    memoryThresholdMB: 100,
    responseTimeThresholdMs: 1000,
    enableDetailedLogging: true
  });
  
  monitor.start();
  
  // Simulate some operations
  setTimeout(() => {
    const op1 = monitor.startOperation('test-operation-1', { type: 'database' });
    setTimeout(() => {
      monitor.endOperation(op1, { success: true, rows: 100 });
    }, 500);
    
    const op2 = monitor.startOperation('test-operation-2', { type: 'api' });
    setTimeout(() => {
      monitor.endOperation(op2, { success: true });
    }, 1500); // This will be marked as slow
    
    // Track a query
    monitor.trackQuery('SELECT * FROM users', 'SELECT * FROM users WHERE active = true', 250, 50);
    
    // Track an error
    monitor.trackError(new Error('Test error'), { operation: 'test' });
    
    // Add checkpoint
    monitor.checkpoint('midpoint');
    
    // Stop and generate report
    setTimeout(() => {
      const report = monitor.stop();
      console.log('\n📊 Report Summary:');
      console.log(JSON.stringify(report.summary, null, 2));
      console.log('\n🔍 Analysis:');
      console.log(JSON.stringify(report.analysis, null, 2));
      
      // Export report
      monitor.exportReport(report, './test-performance-report.json');
    }, 3000);
  }, 100);
}