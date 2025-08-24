/**
 * ⚡ Unit of Measurement Performance Testing Suite
 * Load testing, stress testing, and performance metrics for UoM CRUD operations
 */

const axios = require('axios');
const fs = require('fs');
const { performance } = require('perf_hooks');

// Performance test configuration
const CONFIG = {
    apiUrl: 'http://localhost:8001/api/v1',
    maxConcurrency: 100,
    testDataSize: 10000,
    warmupRequests: 50,
    testDuration: 60000, // 60 seconds
    thresholds: {
        avgResponseTime: 500,    // ms
        maxResponseTime: 2000,   // ms
        errorRate: 0.05,         // 5%
        throughput: 50,          // requests per second
        memoryLeakThreshold: 100, // MB
        cpuThreshold: 80         // %
    }
};

class PerformanceTestSuite {
    constructor() {
        this.authToken = null;
        this.testResults = {
            warmup: { completed: false, avgTime: 0 },
            load: { completed: false, results: {} },
            stress: { completed: false, results: {} },
            endurance: { completed: false, results: {} },
            concurrency: { completed: false, results: {} },
            memory: { completed: false, results: {} },
            database: { completed: false, results: {} }
        };
        
        this.metrics = {
            responseTimes: [],
            throughput: [],
            errorRates: [],
            memoryUsage: [],
            cpuUsage: [],
            dbPerformance: []
        };
        
        this.createdUomIds = [];
        this.testStartTime = null;
    }
    
    // Utility methods
    log(phase, message, status = 'INFO') {
        const timestamp = new Date().toISOString();
        const statusIcon = {
            'INFO': 'ℹ️',
            'SUCCESS': '✅',
            'WARNING': '⚠️',
            'ERROR': '❌',
            'PERFORMANCE': '⚡'
        }[status] || 'ℹ️';
        
        console.log(`[${timestamp}] ${statusIcon} ${phase}: ${message}`);
    }
    
    async authenticate() {
        try {
            const response = await axios.post(`${CONFIG.apiUrl}/auth/login`, {
                username: 'admin',
                password: 'admin123'
            });
            
            this.authToken = response.data.access_token;
            this.log('AUTH', 'Authentication successful', 'SUCCESS');
            return true;
        } catch (error) {
            this.log('AUTH', `Authentication failed: ${error.message}`, 'ERROR');
            return false;
        }
    }
    
    getApiClient() {
        return axios.create({
            baseURL: CONFIG.apiUrl,
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
    }
    
    async measureOperation(operation, operationName = 'unknown') {
        const startTime = performance.now();
        const startMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        
        try {
            const result = await operation();
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
            const duration = endTime - startTime;
            
            return {
                success: true,
                duration,
                memoryDelta: endMemory - startMemory,
                result
            };
        } catch (error) {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            return {
                success: false,
                duration,
                error: error.message,
                statusCode: error.response?.status || 0
            };
        }
    }
    
    calculateStats(measurements) {
        if (!measurements.length) return {};
        
        const durations = measurements.map(m => m.duration).sort((a, b) => a - b);
        const successfulRequests = measurements.filter(m => m.success);
        const failedRequests = measurements.filter(m => !m.success);
        
        return {
            count: measurements.length,
            successCount: successfulRequests.length,
            failureCount: failedRequests.length,
            errorRate: (failedRequests.length / measurements.length) * 100,
            avgResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
            minResponseTime: durations[0],
            maxResponseTime: durations[durations.length - 1],
            p50: durations[Math.floor(durations.length * 0.5)],
            p90: durations[Math.floor(durations.length * 0.9)],
            p95: durations[Math.floor(durations.length * 0.95)],
            p99: durations[Math.floor(durations.length * 0.99)],
            throughput: measurements.length / (measurements[measurements.length - 1]?.timestamp - measurements[0]?.timestamp) * 1000
        };
    }
    
    // Phase 1: Warmup
    async runWarmup() {
        this.log('WARMUP', `Starting warmup with ${CONFIG.warmupRequests} requests`, 'PERFORMANCE');
        
        const api = this.getApiClient();
        const measurements = [];
        
        for (let i = 0; i < CONFIG.warmupRequests; i++) {
            const measurement = await this.measureOperation(async () => {
                return await api.get('/unit-of-measurement/?page=1&page_size=10');
            }, 'warmup-read');
            
            measurement.timestamp = performance.now();
            measurements.push(measurement);
            
            if (i % 10 === 0) {
                this.log('WARMUP', `Completed ${i + 1}/${CONFIG.warmupRequests} warmup requests`);
            }
        }
        
        const stats = this.calculateStats(measurements);
        this.testResults.warmup = {
            completed: true,
            avgTime: stats.avgResponseTime,
            stats
        };
        
        this.log('WARMUP', `Completed - Avg: ${stats.avgResponseTime.toFixed(2)}ms`, 'SUCCESS');
        return true;
    }
    
    // Phase 2: Load Testing
    async runLoadTest() {
        this.log('LOAD_TEST', 'Starting load testing phase', 'PERFORMANCE');
        
        const api = this.getApiClient();
        const measurements = [];
        const testOperations = [
            { name: 'create', weight: 0.2 },
            { name: 'read', weight: 0.4 },
            { name: 'update', weight: 0.2 },
            { name: 'list', weight: 0.2 }
        ];
        
        const testDuration = 30000; // 30 seconds
        const startTime = performance.now();
        let operationCount = 0;
        
        while (performance.now() - startTime < testDuration) {
            // Select random operation based on weights
            const rand = Math.random();
            let cumulativeWeight = 0;
            let selectedOperation;
            
            for (const op of testOperations) {
                cumulativeWeight += op.weight;
                if (rand <= cumulativeWeight) {
                    selectedOperation = op.name;
                    break;
                }
            }
            
            const measurement = await this.performOperation(api, selectedOperation);
            measurement.timestamp = performance.now();
            measurement.operation = selectedOperation;
            measurements.push(measurement);
            
            operationCount++;
            
            if (operationCount % 100 === 0) {
                this.log('LOAD_TEST', `Completed ${operationCount} operations`);
            }
        }
        
        const stats = this.calculateStats(measurements);
        
        // Analyze by operation type
        const operationStats = {};
        for (const op of testOperations) {
            const opMeasurements = measurements.filter(m => m.operation === op.name);
            if (opMeasurements.length > 0) {
                operationStats[op.name] = this.calculateStats(opMeasurements);
            }
        }
        
        this.testResults.load = {
            completed: true,
            duration: testDuration / 1000,
            totalOperations: operationCount,
            overallStats: stats,
            operationStats
        };
        
        // Check against thresholds
        const passedThresholds = {
            avgResponseTime: stats.avgResponseTime <= CONFIG.thresholds.avgResponseTime,
            maxResponseTime: stats.maxResponseTime <= CONFIG.thresholds.maxResponseTime,
            errorRate: stats.errorRate <= CONFIG.thresholds.errorRate * 100,
            throughput: stats.throughput >= CONFIG.thresholds.throughput
        };
        
        this.log('LOAD_TEST', `Completed - Ops/sec: ${stats.throughput.toFixed(2)}, Avg: ${stats.avgResponseTime.toFixed(2)}ms, Errors: ${stats.errorRate.toFixed(2)}%`, 'SUCCESS');
        
        return passedThresholds;
    }
    
    // Phase 3: Stress Testing
    async runStressTest() {
        this.log('STRESS_TEST', 'Starting stress testing with high concurrency', 'PERFORMANCE');
        
        const api = this.getApiClient();
        const concurrencyLevels = [10, 25, 50, 100];
        const results = {};
        
        for (const concurrency of concurrencyLevels) {
            this.log('STRESS_TEST', `Testing concurrency level: ${concurrency}`);
            
            const promises = [];
            const measurements = [];
            
            for (let i = 0; i < concurrency; i++) {
                const promise = (async () => {
                    const batchMeasurements = [];
                    
                    // Each concurrent user performs 10 operations
                    for (let j = 0; j < 10; j++) {
                        const measurement = await this.performOperation(api, 'read');
                        measurement.timestamp = performance.now();
                        measurement.concurrency = concurrency;
                        measurement.userId = i;
                        batchMeasurements.push(measurement);
                    }
                    
                    return batchMeasurements;
                })();
                
                promises.push(promise);
            }
            
            try {
                const batchResults = await Promise.all(promises);
                const allMeasurements = batchResults.flat();
                const stats = this.calculateStats(allMeasurements);
                
                results[concurrency] = stats;
                
                this.log('STRESS_TEST', `Concurrency ${concurrency} - Avg: ${stats.avgResponseTime.toFixed(2)}ms, Errors: ${stats.errorRate.toFixed(2)}%`);
                
            } catch (error) {
                this.log('STRESS_TEST', `Concurrency ${concurrency} failed: ${error.message}`, 'ERROR');
                results[concurrency] = { error: error.message };
            }
        }
        
        this.testResults.stress = {
            completed: true,
            results
        };
        
        return true;
    }
    
    // Phase 4: Endurance Testing
    async runEnduranceTest() {
        this.log('ENDURANCE_TEST', `Starting endurance test for ${CONFIG.testDuration / 1000}s`, 'PERFORMANCE');
        
        const api = this.getApiClient();
        const measurements = [];
        const memoryMeasurements = [];
        
        const startTime = performance.now();
        let operationCount = 0;
        
        // Memory monitoring interval
        const memoryInterval = setInterval(() => {
            const usage = process.memoryUsage();
            memoryMeasurements.push({
                timestamp: performance.now() - startTime,
                heapUsed: usage.heapUsed / 1024 / 1024, // MB
                heapTotal: usage.heapTotal / 1024 / 1024, // MB
                external: usage.external / 1024 / 1024, // MB
                rss: usage.rss / 1024 / 1024 // MB
            });
        }, 5000); // Every 5 seconds
        
        while (performance.now() - startTime < CONFIG.testDuration) {
            const measurement = await this.performOperation(api, 'read');
            measurement.timestamp = performance.now() - startTime;
            measurements.push(measurement);
            
            operationCount++;
            
            if (operationCount % 500 === 0) {
                const elapsed = (performance.now() - startTime) / 1000;
                this.log('ENDURANCE_TEST', `Completed ${operationCount} operations in ${elapsed.toFixed(1)}s`);
            }
            
            // Small delay to prevent overwhelming
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        clearInterval(memoryInterval);
        
        const stats = this.calculateStats(measurements);
        
        // Analyze memory trend
        const initialMemory = memoryMeasurements[0]?.heapUsed || 0;
        const finalMemory = memoryMeasurements[memoryMeasurements.length - 1]?.heapUsed || 0;
        const memoryGrowth = finalMemory - initialMemory;
        
        this.testResults.endurance = {
            completed: true,
            duration: CONFIG.testDuration / 1000,
            totalOperations: operationCount,
            stats,
            memoryAnalysis: {
                initialMemory,
                finalMemory,
                memoryGrowth,
                measurements: memoryMeasurements
            }
        };
        
        const hasPossibleLeak = memoryGrowth > CONFIG.thresholds.memoryLeakThreshold;
        
        this.log('ENDURANCE_TEST', `Completed - Memory growth: ${memoryGrowth.toFixed(2)}MB ${hasPossibleLeak ? '(POTENTIAL LEAK!)' : '(OK)'}`, 
            hasPossibleLeak ? 'WARNING' : 'SUCCESS');
        
        return !hasPossibleLeak;
    }
    
    // Phase 5: Database Performance Testing
    async runDatabasePerformanceTest() {
        this.log('DB_PERFORMANCE', 'Starting database performance testing', 'PERFORMANCE');
        
        const api = this.getApiClient();
        const tests = [
            { name: 'pagination', operation: () => api.get('/unit-of-measurement/?page=1&page_size=100') },
            { name: 'search', operation: () => api.get('/unit-of-measurement/search/?q=test&limit=50') },
            { name: 'filtering', operation: () => api.get('/unit-of-measurement/?name=test&code=T') },
            { name: 'sorting', operation: () => api.get('/unit-of-measurement/?sort_field=name&sort_direction=desc') },
            { name: 'statistics', operation: () => api.get('/unit-of-measurement/stats/') },
            { name: 'bulk_read', operation: () => api.get('/unit-of-measurement/?page_size=1000') }
        ];
        
        const results = {};
        
        for (const test of tests) {
            this.log('DB_PERFORMANCE', `Testing ${test.name}`);
            
            const measurements = [];
            
            // Run each test 20 times
            for (let i = 0; i < 20; i++) {
                const measurement = await this.measureOperation(test.operation, test.name);
                measurement.timestamp = performance.now();
                measurements.push(measurement);
            }
            
            const stats = this.calculateStats(measurements);
            results[test.name] = stats;
            
            this.log('DB_PERFORMANCE', `${test.name} - Avg: ${stats.avgResponseTime.toFixed(2)}ms, P95: ${stats.p95.toFixed(2)}ms`);
        }
        
        this.testResults.database = {
            completed: true,
            results
        };
        
        return true;
    }
    
    // Helper method to perform different operations
    async performOperation(api, operationType) {
        switch (operationType) {
            case 'create':
                return await this.measureOperation(async () => {
                    const response = await api.post('/unit-of-measurement/', {
                        name: `Perf Test Unit ${Date.now()}`,
                        code: `PT${Math.floor(Math.random() * 10000)}`,
                        description: 'Performance test unit'
                    });
                    this.createdUomIds.push(response.data.id);
                    return response;
                }, 'create');
                
            case 'read':
                return await this.measureOperation(async () => {
                    if (this.createdUomIds.length > 0) {
                        const randomId = this.createdUomIds[Math.floor(Math.random() * this.createdUomIds.length)];
                        return await api.get(`/unit-of-measurement/${randomId}`);
                    } else {
                        return await api.get('/unit-of-measurement/?page=1&page_size=1');
                    }
                }, 'read');
                
            case 'update':
                return await this.measureOperation(async () => {
                    if (this.createdUomIds.length > 0) {
                        const randomId = this.createdUomIds[Math.floor(Math.random() * this.createdUomIds.length)];
                        return await api.put(`/unit-of-measurement/${randomId}`, {
                            name: `Updated Perf Test ${Date.now()}`,
                            description: 'Updated performance test unit'
                        });
                    } else {
                        // Create first if none exist
                        const response = await api.post('/unit-of-measurement/', {
                            name: `First Perf Test Unit ${Date.now()}`,
                            code: `FPT${Math.floor(Math.random() * 10000)}`
                        });
                        this.createdUomIds.push(response.data.id);
                        return response;
                    }
                }, 'update');
                
            case 'list':
                return await this.measureOperation(async () => {
                    const page = Math.floor(Math.random() * 10) + 1;
                    return await api.get(`/unit-of-measurement/?page=${page}&page_size=20`);
                }, 'list');
                
            default:
                return await this.measureOperation(async () => {
                    return await api.get('/unit-of-measurement/stats/');
                }, 'default');
        }
    }
    
    // Cleanup created test data
    async cleanup() {
        this.log('CLEANUP', `Cleaning up ${this.createdUomIds.length} test units`);
        
        const api = this.getApiClient();
        let cleanedCount = 0;
        
        for (const uomId of this.createdUomIds) {
            try {
                await api.delete(`/unit-of-measurement/${uomId}`);
                cleanedCount++;
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        
        this.log('CLEANUP', `Cleaned up ${cleanedCount} units`, 'SUCCESS');
    }
    
    // Generate comprehensive report
    generateReport() {
        const report = {
            testConfiguration: CONFIG,
            testResults: this.testResults,
            summary: {
                allTestsCompleted: Object.values(this.testResults).every(t => t.completed),
                timestamp: new Date().toISOString(),
                duration: this.testStartTime ? (Date.now() - this.testStartTime) / 1000 : 0
            },
            recommendations: this.generateRecommendations()
        };
        
        // Save to file
        fs.writeFileSync('uom_performance_report.json', JSON.stringify(report, null, 2));
        
        // Generate summary
        console.log('\n⚡ PERFORMANCE TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        if (this.testResults.warmup.completed) {
            console.log(`🔥 Warmup: Avg ${this.testResults.warmup.avgTime.toFixed(2)}ms`);
        }
        
        if (this.testResults.load.completed) {
            const loadStats = this.testResults.load.overallStats;
            console.log(`📊 Load Test: ${loadStats.throughput.toFixed(2)} ops/sec, ${loadStats.avgResponseTime.toFixed(2)}ms avg, ${loadStats.errorRate.toFixed(2)}% errors`);
        }
        
        if (this.testResults.stress.completed) {
            console.log('💪 Stress Test Results:');
            Object.entries(this.testResults.stress.results).forEach(([concurrency, stats]) => {
                if (stats.avgResponseTime) {
                    console.log(`   ${concurrency} concurrent: ${stats.avgResponseTime.toFixed(2)}ms avg`);
                }
            });
        }
        
        if (this.testResults.endurance.completed) {
            const endurance = this.testResults.endurance;
            console.log(`⏱️  Endurance: ${endurance.totalOperations} ops over ${endurance.duration}s, Memory growth: ${endurance.memoryAnalysis.memoryGrowth.toFixed(2)}MB`);
        }
        
        if (this.testResults.database.completed) {
            console.log('🗄️  Database Performance:');
            Object.entries(this.testResults.database.results).forEach(([test, stats]) => {
                console.log(`   ${test}: ${stats.avgResponseTime.toFixed(2)}ms avg (P95: ${stats.p95.toFixed(2)}ms)`);
            });
        }
        
        console.log('\n📄 Full report saved to: uom_performance_report.json');
        
        return report;
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        // Load test recommendations
        if (this.testResults.load.completed) {
            const stats = this.testResults.load.overallStats;
            
            if (stats.avgResponseTime > CONFIG.thresholds.avgResponseTime) {
                recommendations.push({
                    type: 'PERFORMANCE',
                    priority: 'HIGH',
                    issue: 'High average response time',
                    recommendation: 'Consider optimizing database queries, adding caching, or scaling infrastructure'
                });
            }
            
            if (stats.errorRate > CONFIG.thresholds.errorRate * 100) {
                recommendations.push({
                    type: 'RELIABILITY',
                    priority: 'HIGH',
                    issue: 'High error rate under load',
                    recommendation: 'Investigate error causes, improve error handling, and consider circuit breakers'
                });
            }
            
            if (stats.throughput < CONFIG.thresholds.throughput) {
                recommendations.push({
                    type: 'SCALABILITY',
                    priority: 'MEDIUM',
                    issue: 'Low throughput',
                    recommendation: 'Consider horizontal scaling, connection pooling, or async processing'
                });
            }
        }
        
        // Memory recommendations
        if (this.testResults.endurance.completed) {
            const memoryGrowth = this.testResults.endurance.memoryAnalysis.memoryGrowth;
            
            if (memoryGrowth > CONFIG.thresholds.memoryLeakThreshold) {
                recommendations.push({
                    type: 'MEMORY',
                    priority: 'HIGH',
                    issue: 'Potential memory leak detected',
                    recommendation: 'Profile application for memory leaks, check for unclosed resources'
                });
            }
        }
        
        // Database recommendations
        if (this.testResults.database.completed) {
            const dbResults = this.testResults.database.results;
            
            if (dbResults.bulk_read?.avgResponseTime > 1000) {
                recommendations.push({
                    type: 'DATABASE',
                    priority: 'MEDIUM',
                    issue: 'Slow bulk read operations',
                    recommendation: 'Consider database indexing improvements and query optimization'
                });
            }
            
            if (dbResults.search?.avgResponseTime > 500) {
                recommendations.push({
                    type: 'DATABASE',
                    priority: 'MEDIUM',
                    issue: 'Slow search performance',
                    recommendation: 'Consider full-text search indexing or search service implementation'
                });
            }
        }
        
        return recommendations;
    }
    
    // Main execution method
    async run() {
        this.testStartTime = Date.now();
        
        console.log('⚡ UNIT OF MEASUREMENT PERFORMANCE TEST SUITE');
        console.log('='.repeat(60));
        console.log(`Started: ${new Date().toISOString()}`);
        console.log(`Target API: ${CONFIG.apiUrl}`);
        console.log('');
        
        try {
            // Authentication
            const authenticated = await this.authenticate();
            if (!authenticated) {
                throw new Error('Authentication failed');
            }
            
            // Run all test phases
            await this.runWarmup();
            await this.runLoadTest();
            await this.runStressTest();
            await this.runEnduranceTest();
            await this.runDatabasePerformanceTest();
            
            // Cleanup
            await this.cleanup();
            
            // Generate report
            const report = this.generateReport();
            
            // Determine overall success
            const hasHighPriorityIssues = report.recommendations.some(r => r.priority === 'HIGH');
            
            console.log('\n🎯 Performance Testing Complete!');
            
            if (hasHighPriorityIssues) {
                console.log('⚠️  High priority performance issues detected - review recommendations');
                return false;
            } else {
                console.log('✅ Performance tests passed - system meets performance criteria');
                return true;
            }
            
        } catch (error) {
            this.log('SUITE', `Performance test suite failed: ${error.message}`, 'ERROR');
            return false;
        }
    }
}

// Execute if run directly
if (require.main === module) {
    const suite = new PerformanceTestSuite();
    
    suite.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Performance test suite crashed:', error);
        process.exit(1);
    });
}

module.exports = PerformanceTestSuite;