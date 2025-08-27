const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Inventory Performance Test Suite
 * Tests inventory feature performance under various load conditions
 */
class InventoryPerformanceTestSuite {
  constructor() {
    this.browsers = [];
    this.pages = [];
    this.performanceMetrics = [];
    this.concurrentUsers = 5;
    this.testDuration = 60000; // 1 minute
    this.baseUrl = 'http://localhost:3000';
  }

  async initialize() {
    console.log('🚀 Initializing Inventory Performance Test Suite...');
    console.log(`   👥 Concurrent Users: ${this.concurrentUsers}`);
    console.log(`   ⏰ Test Duration: ${this.testDuration / 1000} seconds`);
    
    // Create multiple browser instances for concurrent testing
    for (let i = 0; i < this.concurrentUsers; i++) {
      const browser = await puppeteer.launch({
        headless: true, // Run headless for performance testing
        defaultViewport: { width: 1280, height: 720 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security'
        ]
      });

      const page = await browser.newPage();
      
      // Set up performance monitoring for this page
      await this.setupPerformanceMonitoring(page, i);
      
      this.browsers.push(browser);
      this.pages.push(page);
    }

    console.log(`✅ Initialized ${this.concurrentUsers} browser instances`);
  }

  async setupPerformanceMonitoring(page, userId) {
    const userMetrics = {
      userId,
      requests: [],
      responses: [],
      pageLoads: [],
      errors: [],
      consoleMessages: []
    };

    // Monitor network requests
    page.on('request', request => {
      userMetrics.requests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now(),
        resourceType: request.resourceType()
      });
    });

    page.on('response', response => {
      userMetrics.responses.push({
        url: response.url(),
        status: response.status(),
        timestamp: Date.now(),
        fromCache: response.fromCache(),
        fromServiceWorker: response.fromServiceWorker()
      });
    });

    // Monitor console messages and errors
    page.on('console', msg => {
      userMetrics.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      });
    });

    page.on('pageerror', error => {
      userMetrics.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });

    this.performanceMetrics.push(userMetrics);
  }

  async testConcurrentStockPageLoad() {
    console.log('\n📊 Testing Concurrent Stock Page Load Performance...');
    
    const loadPromises = this.pages.map(async (page, index) => {
      const startTime = Date.now();
      
      try {
        // Navigate to login page first
        await page.goto(`${this.baseUrl}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Perform login
        await page.type('input[type="email"], input[name="email"]', 'admin@rentalmanager.com');
        await page.type('input[type="password"], input[name="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });

        // Navigate to stock page
        const pageLoadStart = Date.now();
        await page.goto(`${this.baseUrl}/inventory/stock`, { 
          waitUntil: 'networkidle0', 
          timeout: 30000 
        });
        const pageLoadEnd = Date.now();

        // Measure performance metrics
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          return navigation ? {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            totalTime: navigation.loadEventEnd - navigation.fetchStart,
            firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime,
            firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime
          } : null;
        });

        const totalTime = Date.now() - startTime;
        const pageLoadTime = pageLoadEnd - pageLoadStart;

        this.performanceMetrics[index].pageLoads.push({
          testType: 'concurrent_stock_load',
          totalTime,
          pageLoadTime,
          navigationMetrics: metrics,
          timestamp: Date.now()
        });

        console.log(`  👤 User ${index + 1}: ${pageLoadTime}ms (total: ${totalTime}ms)`);
        return { userId: index, success: true, loadTime: pageLoadTime };

      } catch (error) {
        console.log(`  ❌ User ${index + 1}: Failed - ${error.message}`);
        this.performanceMetrics[index].errors.push({
          testType: 'concurrent_stock_load',
          error: error.message,
          timestamp: Date.now()
        });
        return { userId: index, success: false, error: error.message };
      }
    });

    const results = await Promise.all(loadPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n📈 Concurrent Load Results:`);
    console.log(`   ✅ Successful: ${successful.length}/${this.concurrentUsers}`);
    console.log(`   ❌ Failed: ${failed.length}/${this.concurrentUsers}`);

    if (successful.length > 0) {
      const avgLoadTime = successful.reduce((sum, r) => sum + r.loadTime, 0) / successful.length;
      const minLoadTime = Math.min(...successful.map(r => r.loadTime));
      const maxLoadTime = Math.max(...successful.map(r => r.loadTime));
      
      console.log(`   📊 Average Load Time: ${Math.round(avgLoadTime)}ms`);
      console.log(`   ⚡ Fastest Load: ${minLoadTime}ms`);
      console.log(`   🐌 Slowest Load: ${maxLoadTime}ms`);

      return {
        success: true,
        avgLoadTime,
        minLoadTime,
        maxLoadTime,
        successRate: successful.length / this.concurrentUsers
      };
    }

    return { success: false, successRate: 0 };
  }

  async testFilterPerformanceUnderLoad() {
    console.log('\n🔍 Testing Filter Performance Under Load...');
    
    const filterTests = [
      { type: 'search', value: 'Camera' },
      { type: 'search', value: 'Laptop' },
      { type: 'search', value: 'Canon' },
      { type: 'search', value: 'Sony' },
      { type: 'search', value: 'MacBook' }
    ];

    const filterPromises = this.pages.map(async (page, userIndex) => {
      const userResults = [];
      
      try {
        for (let testIndex = 0; testIndex < filterTests.length; testIndex++) {
          const filter = filterTests[testIndex];
          const startTime = Date.now();

          // Find and use search input
          const searchInput = await page.$('input[placeholder*="search" i], input[type="search"]');
          if (searchInput) {
            await searchInput.click({ clickCount: 3 });
            await page.keyboard.press('Delete');
            await searchInput.type(filter.value);
            
            // Wait for search to complete (debounced)
            await page.waitForTimeout(1000);
            
            const endTime = Date.now();
            const filterTime = endTime - startTime;

            userResults.push({
              userId: userIndex,
              testIndex,
              filterType: filter.type,
              filterValue: filter.value,
              responseTime: filterTime,
              success: true,
              timestamp: Date.now()
            });

            console.log(`    👤 User ${userIndex + 1} - ${filter.value}: ${filterTime}ms`);
          } else {
            userResults.push({
              userId: userIndex,
              testIndex,
              filterType: filter.type,
              filterValue: filter.value,
              success: false,
              error: 'Search input not found',
              timestamp: Date.now()
            });
          }

          // Small delay between filters
          await page.waitForTimeout(500);
        }
      } catch (error) {
        console.log(`  ❌ User ${userIndex + 1} filter test failed:`, error.message);
      }

      return userResults;
    });

    const allResults = (await Promise.all(filterPromises)).flat();
    const successful = allResults.filter(r => r.success);
    const failed = allResults.filter(r => !r.success);

    console.log(`\n📈 Filter Performance Results:`);
    console.log(`   ✅ Successful: ${successful.length}/${allResults.length}`);
    console.log(`   ❌ Failed: ${failed.length}/${allResults.length}`);

    if (successful.length > 0) {
      const avgResponseTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
      const minResponseTime = Math.min(...successful.map(r => r.responseTime));
      const maxResponseTime = Math.max(...successful.map(r => r.responseTime));

      console.log(`   📊 Average Response Time: ${Math.round(avgResponseTime)}ms`);
      console.log(`   ⚡ Fastest Response: ${minResponseTime}ms`);
      console.log(`   🐌 Slowest Response: ${maxResponseTime}ms`);

      // Store results in performance metrics
      this.performanceMetrics.forEach((userMetrics, index) => {
        const userFilterResults = successful.filter(r => r.userId === index);
        userMetrics.filterPerformance = userFilterResults;
      });

      return {
        success: true,
        avgResponseTime,
        minResponseTime,
        maxResponseTime,
        successRate: successful.length / allResults.length
      };
    }

    return { success: false, successRate: 0 };
  }

  async testMemoryUsage() {
    console.log('\n🧠 Testing Memory Usage...');
    
    const memoryPromises = this.pages.map(async (page, index) => {
      try {
        // Get initial memory usage
        const initialMetrics = await page.metrics();
        
        // Perform intensive operations
        await page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
        
        // Perform multiple searches to simulate heavy usage
        const searchTerms = ['Camera', 'Laptop', 'Speaker', 'Microphone', 'Projector'];
        for (const term of searchTerms) {
          const searchInput = await page.$('input[placeholder*="search" i]');
          if (searchInput) {
            await searchInput.click({ clickCount: 3 });
            await searchInput.type(term);
            await page.waitForTimeout(1000);
          }
        }

        // Get final memory usage
        const finalMetrics = await page.metrics();

        const memoryUsage = {
          userId: index,
          initial: {
            jsHeapUsedSize: initialMetrics.JSHeapUsedSize,
            jsHeapTotalSize: initialMetrics.JSHeapTotalSize,
            timestamp: Date.now()
          },
          final: {
            jsHeapUsedSize: finalMetrics.JSHeapUsedSize,
            jsHeapTotalSize: finalMetrics.JSHeapTotalSize,
            timestamp: Date.now()
          },
          memoryIncrease: finalMetrics.JSHeapUsedSize - initialMetrics.JSHeapUsedSize
        };

        this.performanceMetrics[index].memoryUsage = memoryUsage;

        console.log(`  👤 User ${index + 1}: Memory increase: ${Math.round(memoryUsage.memoryIncrease / 1024 / 1024)}MB`);
        
        return memoryUsage;

      } catch (error) {
        console.log(`  ❌ User ${index + 1} memory test failed:`, error.message);
        return null;
      }
    });

    const results = await Promise.all(memoryPromises);
    const validResults = results.filter(r => r !== null);

    if (validResults.length > 0) {
      const totalMemoryIncrease = validResults.reduce((sum, r) => sum + r.memoryIncrease, 0);
      const avgMemoryIncrease = totalMemoryIncrease / validResults.length;

      console.log(`📊 Average Memory Increase: ${Math.round(avgMemoryIncrease / 1024 / 1024)}MB per user`);
      console.log(`📊 Total Memory Usage: ${Math.round(totalMemoryIncrease / 1024 / 1024)}MB across all users`);

      return {
        success: true,
        avgMemoryIncrease,
        totalMemoryIncrease,
        userCount: validResults.length
      };
    }

    return { success: false };
  }

  async testNetworkPerformance() {
    console.log('\n📡 Testing Network Performance...');
    
    const networkResults = this.performanceMetrics.map((userMetrics, index) => {
      const requests = userMetrics.requests;
      const responses = userMetrics.responses;

      const inventoryRequests = requests.filter(r => r.url.includes('/inventory') || r.url.includes('/api'));
      const inventoryResponses = responses.filter(r => r.url.includes('/inventory') || r.url.includes('/api'));

      const responseTimes = inventoryResponses.map(response => {
        const matchingRequest = inventoryRequests.find(req => req.url === response.url);
        return matchingRequest ? response.timestamp - matchingRequest.timestamp : null;
      }).filter(time => time !== null);

      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0;

      const errorCount = responses.filter(r => r.status >= 400).length;
      const cacheHitRate = responses.filter(r => r.fromCache).length / responses.length;

      console.log(`  👤 User ${index + 1}:`);
      console.log(`     Requests: ${requests.length}, Responses: ${responses.length}`);
      console.log(`     Avg Response Time: ${Math.round(avgResponseTime)}ms`);
      console.log(`     Errors: ${errorCount}, Cache Hit Rate: ${Math.round(cacheHitRate * 100)}%`);

      return {
        userId: index,
        totalRequests: requests.length,
        totalResponses: responses.length,
        inventoryRequests: inventoryRequests.length,
        inventoryResponses: inventoryResponses.length,
        avgResponseTime,
        errorCount,
        cacheHitRate,
        successRate: (responses.length - errorCount) / responses.length
      };
    });

    const overallStats = {
      totalRequests: networkResults.reduce((sum, r) => sum + r.totalRequests, 0),
      totalResponses: networkResults.reduce((sum, r) => sum + r.totalResponses, 0),
      avgResponseTime: networkResults.reduce((sum, r) => sum + r.avgResponseTime, 0) / networkResults.length,
      totalErrors: networkResults.reduce((sum, r) => sum + r.errorCount, 0),
      avgCacheHitRate: networkResults.reduce((sum, r) => sum + r.cacheHitRate, 0) / networkResults.length,
      avgSuccessRate: networkResults.reduce((sum, r) => sum + r.successRate, 0) / networkResults.length
    };

    console.log(`📊 Overall Network Performance:`);
    console.log(`   Total Requests: ${overallStats.totalRequests}`);
    console.log(`   Average Response Time: ${Math.round(overallStats.avgResponseTime)}ms`);
    console.log(`   Total Errors: ${overallStats.totalErrors}`);
    console.log(`   Cache Hit Rate: ${Math.round(overallStats.avgCacheHitRate * 100)}%`);
    console.log(`   Success Rate: ${Math.round(overallStats.avgSuccessRate * 100)}%`);

    return { success: true, networkResults, overallStats };
  }

  async generatePerformanceReport() {
    console.log('\n📋 Generating Performance Report...');

    const report = {
      testSuite: 'Inventory Performance Test',
      timestamp: new Date().toISOString(),
      configuration: {
        concurrentUsers: this.concurrentUsers,
        testDuration: this.testDuration,
        baseUrl: this.baseUrl
      },
      results: {
        pageLoad: this.pageLoadResults || {},
        filterPerformance: this.filterPerformanceResults || {},
        memoryUsage: this.memoryUsageResults || {},
        networkPerformance: this.networkPerformanceResults || {}
      },
      userMetrics: this.performanceMetrics,
      summary: {
        totalUsers: this.concurrentUsers,
        totalRequests: this.performanceMetrics.reduce((sum, user) => sum + user.requests.length, 0),
        totalResponses: this.performanceMetrics.reduce((sum, user) => sum + user.responses.length, 0),
        totalErrors: this.performanceMetrics.reduce((sum, user) => sum + user.errors.length, 0),
        totalConsoleMessages: this.performanceMetrics.reduce((sum, user) => sum + user.consoleMessages.length, 0)
      }
    };

    // Save JSON report
    const jsonReportPath = path.join(__dirname, 'inventory-performance-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlReportPath = path.join(__dirname, 'inventory-performance-report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log(`📄 JSON Report: ${jsonReportPath}`);
    console.log(`🌐 HTML Report: ${htmlReportPath}`);

    return report;
  }

  generateHtmlReport(report) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inventory Performance Test Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
            .header { background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%); color: white; padding: 20px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
            .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
            .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 5px solid #007bff; }
            .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
            .metric-label { color: #666; font-size: 0.9em; }
            .section { margin: 30px 0; }
            .chart-placeholder { height: 200px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
            pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚡ Inventory Performance Test Report</h1>
                <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
                <p>${report.configuration.concurrentUsers} concurrent users testing inventory features</p>
            </div>
            
            <div class="section">
                <h2>📊 Key Performance Metrics</h2>
                <div class="metric-grid">
                    <div class="metric-card">
                        <div class="metric-value">${report.configuration.concurrentUsers}</div>
                        <div class="metric-label">Concurrent Users</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${report.summary.totalRequests}</div>
                        <div class="metric-label">Total Requests</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${report.summary.totalResponses}</div>
                        <div class="metric-label">Total Responses</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${report.summary.totalErrors}</div>
                        <div class="metric-label">Total Errors</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>📈 Performance Results</h2>
                
                <h3>Page Load Performance</h3>
                <div class="chart-placeholder">
                    Page Load Metrics Chart
                    <br>
                    ${report.results.pageLoad.avgLoadTime ? 
                      `Avg: ${Math.round(report.results.pageLoad.avgLoadTime)}ms, ` +
                      `Min: ${report.results.pageLoad.minLoadTime}ms, ` +
                      `Max: ${report.results.pageLoad.maxLoadTime}ms` : 'No data available'}
                </div>

                <h3>Filter Performance</h3>
                <div class="chart-placeholder">
                    Filter Response Time Chart
                    <br>
                    ${report.results.filterPerformance.avgResponseTime ? 
                      `Avg: ${Math.round(report.results.filterPerformance.avgResponseTime)}ms` : 'No data available'}
                </div>

                <h3>Memory Usage</h3>
                <div class="chart-placeholder">
                    Memory Usage Chart
                    <br>
                    ${report.results.memoryUsage.avgMemoryIncrease ? 
                      `Avg Increase: ${Math.round(report.results.memoryUsage.avgMemoryIncrease / 1024 / 1024)}MB` : 'No data available'}
                </div>

                <h3>Network Performance</h3>
                <div class="chart-placeholder">
                    Network Performance Chart
                    <br>
                    ${report.results.networkPerformance.overallStats ? 
                      `Avg Response: ${Math.round(report.results.networkPerformance.overallStats.avgResponseTime)}ms, ` +
                      `Success Rate: ${Math.round(report.results.networkPerformance.overallStats.avgSuccessRate * 100)}%` : 'No data available'}
                </div>
            </div>

            <div class="section">
                <h2>📋 Detailed Metrics</h2>
                <pre>${JSON.stringify(report.results, null, 2)}</pre>
            </div>

            <div style="margin-top: 40px; text-align: center; color: #666;">
                <p>⚡ Inventory Performance Testing Complete</p>
                <p>Report generated by Puppeteer Performance Suite</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async cleanup() {
    console.log('🧹 Cleaning up performance test resources...');
    
    for (const browser of this.browsers) {
      await browser.close();
    }
    
    console.log('✅ Performance test cleanup completed');
  }

  async runPerformanceTestSuite() {
    try {
      await this.initialize();

      console.log('\n🎬 Starting Inventory Performance Test Suite...\n');

      // Run performance tests
      this.pageLoadResults = await this.testConcurrentStockPageLoad();
      this.filterPerformanceResults = await this.testFilterPerformanceUnderLoad();
      this.memoryUsageResults = await this.testMemoryUsage();
      this.networkPerformanceResults = await this.testNetworkPerformance();

      // Generate comprehensive report
      const report = await this.generatePerformanceReport();

      console.log('\n🎉 INVENTORY PERFORMANCE TESTING COMPLETE!');
      console.log(`📊 View detailed report: ${path.join(__dirname, 'inventory-performance-report.html')}`);

      return report;

    } catch (error) {
      console.error('❌ Performance test suite failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the performance test suite
if (require.main === module) {
  (async () => {
    const performanceTestSuite = new InventoryPerformanceTestSuite();
    await performanceTestSuite.runPerformanceTestSuite();
  })().catch(console.error);
}

module.exports = InventoryPerformanceTestSuite;