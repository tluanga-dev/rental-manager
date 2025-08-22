/**
 * Performance Testing Runner for Supplier CRUD Operations
 * Tests performance benchmarks and scalability
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class SupplierPerformanceRunner {
  constructor() {
    this.BASE_URL = 'http://localhost:3001';
    this.API_BASE_URL = 'http://localhost:8001/api/v1';
    this.results = [];
    this.authToken = null;
    this.browser = null;
    this.page = null;
  }

  async setup() {
    console.log('🚀 Starting performance test setup...');
    
    // Launch browser
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Set viewport for consistent testing
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // Authenticate
    await this.authenticate();
    
    console.log('✅ Performance test setup complete');
  }

  async authenticate() {
    try {
      const loginResponse = await axios.post(`${this.API_BASE_URL}/auth/login`, {
        username: 'admin',
        password: 'K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3'
      });
      this.authToken = loginResponse.data.access_token;
      
      // Set auth token in browser
      await this.page.goto(this.BASE_URL);
      await this.page.evaluate((token) => {
        localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            accessToken: token,
            isAuthenticated: true,
            user: { id: 1, username: 'admin', userType: 'SUPERADMIN' }
          }
        }));
      }, this.authToken);
      
      console.log('✅ Authentication successful');
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      throw error;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * TC049: Page Load Performance Tests
   */
  async testPageLoadPerformance() {
    console.log('\n📊 Testing Page Load Performance...');
    
    const tests = [
      { name: 'Supplier List Page', url: '/purchases/suppliers' },
      { name: 'Create Supplier Page', url: '/purchases/suppliers/new' },
      { name: 'Supplier Analytics Page', url: '/purchases/suppliers/analytics' }
    ];
    
    for (const test of tests) {
      await this.measurePageLoad(test.name, test.url);
    }
  }

  async measurePageLoad(testName, url) {
    console.log(`  📈 Testing: ${testName}`);
    
    const measurements = [];
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
      // Clear cache for realistic test
      await this.page.setCacheEnabled(false);
      
      const startTime = Date.now();
      
      try {
        await this.page.goto(`${this.BASE_URL}${url}`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // Wait for page to be interactive
        await this.page.waitForSelector('body', { timeout: 10000 });
        
        const loadTime = Date.now() - startTime;
        measurements.push(loadTime);
        
        console.log(`    Iteration ${i + 1}: ${loadTime}ms`);
        
        // Take screenshot for verification
        if (i === 0) {
          await this.page.screenshot({
            path: `./reports/screenshots/perf-${testName.replace(/\s+/g, '-').toLowerCase()}.png`,
            fullPage: true
          });
        }
        
      } catch (error) {
        console.error(`    ❌ Iteration ${i + 1} failed:`, error.message);
        measurements.push(30000); // Timeout value
      }
      
      // Brief pause between iterations
      await this.page.waitForTimeout(1000);
    }
    
    const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const minTime = Math.min(...measurements);
    const maxTime = Math.max(...measurements);
    
    const result = {
      test: testName,
      url: url,
      averageTime: avgTime,
      minTime: minTime,
      maxTime: maxTime,
      measurements: measurements,
      benchmark: 3000, // 3 second benchmark
      passed: avgTime < 3000
    };
    
    this.results.push(result);
    
    console.log(`    📊 Average: ${avgTime.toFixed(0)}ms (min: ${minTime}ms, max: ${maxTime}ms)`);
    console.log(`    ${result.passed ? '✅ PASS' : '❌ FAIL'} - Benchmark: <3000ms`);
  }

  /**
   * TC050: API Response Time Tests
   */
  async testAPIResponseTimes() {
    console.log('\n📊 Testing API Response Times...');
    
    const apiTests = [
      { name: 'List Suppliers', method: 'GET', endpoint: '/suppliers/', benchmark: 2000 },
      { name: 'Create Supplier', method: 'POST', endpoint: '/suppliers/', benchmark: 1000 },
      { name: 'Get Supplier', method: 'GET', endpoint: '/suppliers/{id}', benchmark: 1000 },
      { name: 'Update Supplier', method: 'PUT', endpoint: '/suppliers/{id}', benchmark: 1000 },
      { name: 'Search Suppliers', method: 'GET', endpoint: '/suppliers/search?search_term=test', benchmark: 1000 }
    ];
    
    // Create a test supplier for ID-based tests
    const testSupplier = await this.createTestSupplier();
    const testSupplierId = testSupplier?.id;
    
    for (const test of apiTests) {
      await this.measureAPIResponse(test, testSupplierId);
    }
  }

  async createTestSupplier() {
    try {
      const supplierData = {
        supplier_code: `PERF_${Date.now()}`,
        company_name: 'Performance Test Company',
        supplier_type: 'DISTRIBUTOR',
        contact_person: 'Performance Tester',
        email: 'perf@test.com'
      };
      
      const response = await axios.post(`${this.API_BASE_URL}/suppliers/`, supplierData, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to create test supplier:', error.message);
      return null;
    }
  }

  async measureAPIResponse(test, testSupplierId) {
    console.log(`  📈 Testing API: ${test.name}`);
    
    const measurements = [];
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        let endpoint = test.endpoint.replace('{id}', testSupplierId);
        const url = `${this.API_BASE_URL}${endpoint}`;
        
        let response;
        const config = {
          headers: { Authorization: `Bearer ${this.authToken}` },
          timeout: 10000
        };
        
        switch (test.method) {
          case 'GET':
            response = await axios.get(url, config);
            break;
          case 'POST':
            const createData = {
              supplier_code: `PERF_${Date.now()}_${i}`,
              company_name: `Perf Test ${i}`,
              supplier_type: 'DISTRIBUTOR'
            };
            response = await axios.post(url, createData, config);
            break;
          case 'PUT':
            const updateData = {
              company_name: `Updated Perf Test ${i}`
            };
            response = await axios.put(url, updateData, config);
            break;
        }
        
        const responseTime = Date.now() - startTime;
        measurements.push(responseTime);
        
        if (i < 3) {
          console.log(`    Iteration ${i + 1}: ${responseTime}ms (Status: ${response.status})`);
        }
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        measurements.push(responseTime);
        
        if (i < 3) {
          console.log(`    Iteration ${i + 1}: ${responseTime}ms (Error: ${error.response?.status || 'Network'})`);
        }
      }
    }
    
    const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const minTime = Math.min(...measurements);
    const maxTime = Math.max(...measurements);
    
    const result = {
      test: `API: ${test.name}`,
      method: test.method,
      endpoint: test.endpoint,
      averageTime: avgTime,
      minTime: minTime,
      maxTime: maxTime,
      measurements: measurements,
      benchmark: test.benchmark,
      passed: avgTime < test.benchmark
    };
    
    this.results.push(result);
    
    console.log(`    📊 Average: ${avgTime.toFixed(0)}ms (min: ${minTime}ms, max: ${maxTime}ms)`);
    console.log(`    ${result.passed ? '✅ PASS' : '❌ FAIL'} - Benchmark: <${test.benchmark}ms`);
  }

  /**
   * TC051: Scalability Testing
   */
  async testScalability() {
    console.log('\n📊 Testing Scalability...');
    
    const dataSizes = [100, 500, 1000];
    
    for (const size of dataSizes) {
      await this.testWithDataSize(size);
    }
  }

  async testWithDataSize(supplierCount) {
    console.log(`  📈 Testing with ${supplierCount} suppliers...`);
    
    // Ensure we have enough test data
    await this.ensureTestData(supplierCount);
    
    // Test list page performance
    const startTime = Date.now();
    
    try {
      await this.page.goto(`${this.BASE_URL}/purchases/suppliers`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for suppliers to load
      await this.page.waitForSelector('.supplier-card, .supplier-row, table', { timeout: 15000 });
      
      const loadTime = Date.now() - startTime;
      
      // Count actual suppliers displayed
      const displayedCount = await this.page.locator('.supplier-card, .supplier-row, tr[data-testid="supplier"]').count();
      
      const result = {
        test: `Scalability: ${supplierCount} suppliers`,
        supplierCount: supplierCount,
        displayedCount: displayedCount,
        loadTime: loadTime,
        benchmark: 5000, // 5 second benchmark for large datasets
        passed: loadTime < 5000
      };
      
      this.results.push(result);
      
      console.log(`    📊 Load time: ${loadTime}ms (displayed: ${displayedCount} suppliers)`);
      console.log(`    ${result.passed ? '✅ PASS' : '❌ FAIL'} - Benchmark: <5000ms`);
      
    } catch (error) {
      console.error(`    ❌ Scalability test failed for ${supplierCount} suppliers:`, error.message);
    }
  }

  async ensureTestData(minCount) {
    try {
      // Check current supplier count
      const listResponse = await axios.get(`${this.API_BASE_URL}/suppliers/`, {
        headers: { Authorization: `Bearer ${this.authToken}` },
        params: { limit: 1 }
      });
      
      const currentTotal = listResponse.data.total || listResponse.data.length || 0;
      
      if (currentTotal < minCount) {
        console.log(`    📝 Creating ${minCount - currentTotal} additional suppliers...`);
        
        const promises = [];
        for (let i = currentTotal; i < minCount; i++) {
          const supplierData = {
            supplier_code: `SCALE_${i.toString().padStart(6, '0')}`,
            company_name: `Scale Test Company ${i}`,
            supplier_type: 'DISTRIBUTOR',
            contact_person: `Contact ${i}`,
            email: `scale${i}@test.com`
          };
          
          promises.push(
            axios.post(`${this.API_BASE_URL}/suppliers/`, supplierData, {
              headers: { Authorization: `Bearer ${this.authToken}` }
            })
          );
          
          // Batch requests to avoid overwhelming the server
          if (promises.length >= 10) {
            await Promise.all(promises);
            promises.length = 0;
            await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
          }
        }
        
        if (promises.length > 0) {
          await Promise.all(promises);
        }
        
        console.log(`    ✅ Test data creation complete`);
      }
    } catch (error) {
      console.error('    ❌ Failed to ensure test data:', error.message);
    }
  }

  /**
   * TC052: Memory Usage Testing
   */
  async testMemoryUsage() {
    console.log('\n📊 Testing Memory Usage...');
    
    // Navigate to supplier list
    await this.page.goto(`${this.BASE_URL}/purchases/suppliers`);
    
    // Measure initial memory
    const initialMetrics = await this.page.metrics();
    
    // Perform memory-intensive operations
    await this.performMemoryIntensiveOperations();
    
    // Measure final memory
    const finalMetrics = await this.page.metrics();
    
    const memoryIncrease = finalMetrics.JSHeapUsedSize - initialMetrics.JSHeapUsedSize;
    const memoryIncreaseKB = memoryIncrease / 1024;
    
    const result = {
      test: 'Memory Usage',
      initialMemory: initialMetrics.JSHeapUsedSize,
      finalMemory: finalMetrics.JSHeapUsedSize,
      memoryIncrease: memoryIncrease,
      memoryIncreaseKB: memoryIncreaseKB,
      benchmark: 50 * 1024 * 1024, // 50MB benchmark
      passed: memoryIncrease < 50 * 1024 * 1024
    };
    
    this.results.push(result);
    
    console.log(`    📊 Memory increase: ${memoryIncreaseKB.toFixed(0)}KB`);
    console.log(`    ${result.passed ? '✅ PASS' : '❌ FAIL'} - Benchmark: <50MB increase`);
  }

  async performMemoryIntensiveOperations() {
    // Navigate through multiple pages
    for (let i = 0; i < 5; i++) {
      await this.page.goto(`${this.BASE_URL}/purchases/suppliers/new`);
      await this.page.waitForSelector('form', { timeout: 5000 });
      
      await this.page.goto(`${this.BASE_URL}/purchases/suppliers`);
      await this.page.waitForSelector('.supplier-list, .supplier-card', { timeout: 5000 });
    }
    
    // Simulate search operations
    for (let i = 0; i < 10; i++) {
      const searchInput = await this.page.locator('input[placeholder*="search"]').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill(`search${i}`);
        await this.page.waitForTimeout(500);
        await searchInput.clear();
      }
    }
  }

  /**
   * Generate Performance Report
   */
  generateReport() {
    console.log('\n📊 Generating Performance Report...');
    
    const reportPath = path.join(__dirname, '../reports/performance-report.json');
    const htmlReportPath = path.join(__dirname, '../reports/performance-report.html');
    
    // Generate JSON report
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      results: this.results
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report);
    fs.writeFileSync(htmlReportPath, htmlReport);
    
    console.log(`✅ Performance report saved to: ${reportPath}`);
    console.log(`✅ HTML report saved to: ${htmlReportPath}`);
    
    return report;
  }

  generateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    
    const avgLoadTime = this.results
      .filter(r => r.averageTime)
      .reduce((sum, r) => sum + r.averageTime, 0) / 
      this.results.filter(r => r.averageTime).length;
    
    return {
      totalTests: total,
      passed: passed,
      failed: failed,
      passRate: ((passed / total) * 100).toFixed(1) + '%',
      averageLoadTime: avgLoadTime ? avgLoadTime.toFixed(0) + 'ms' : 'N/A'
    };
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Supplier CRUD Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e9f5ff; padding: 15px; border-radius: 5px; text-align: center; }
        .metric.pass { background: #e8f5e8; }
        .metric.fail { background: #ffe8e8; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f4f4f4; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Supplier CRUD Performance Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div style="font-size: 24px;">${report.summary.totalTests}</div>
        </div>
        <div class="metric pass">
            <h3>Passed</h3>
            <div style="font-size: 24px;">${report.summary.passed}</div>
        </div>
        <div class="metric fail">
            <h3>Failed</h3>
            <div style="font-size: 24px;">${report.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>Pass Rate</h3>
            <div style="font-size: 24px;">${report.summary.passRate}</div>
        </div>
    </div>
    
    <h2>Detailed Results</h2>
    <table>
        <tr>
            <th>Test</th>
            <th>Average Time</th>
            <th>Min Time</th>
            <th>Max Time</th>
            <th>Benchmark</th>
            <th>Result</th>
        </tr>
        ${report.results.map(result => `
        <tr>
            <td>${result.test}</td>
            <td>${result.averageTime ? Math.round(result.averageTime) + 'ms' : 'N/A'}</td>
            <td>${result.minTime ? result.minTime + 'ms' : 'N/A'}</td>
            <td>${result.maxTime ? result.maxTime + 'ms' : 'N/A'}</td>
            <td>${result.benchmark ? '<' + result.benchmark + 'ms' : 'N/A'}</td>
            <td class="${result.passed ? 'pass' : 'fail'}">${result.passed ? 'PASS' : 'FAIL'}</td>
        </tr>
        `).join('')}
    </table>
</body>
</html>
    `;
  }

  /**
   * Run all performance tests
   */
  async runAllTests() {
    try {
      await this.setup();
      
      console.log('🚀 Starting Supplier CRUD Performance Tests...\n');
      
      await this.testPageLoadPerformance();
      await this.testAPIResponseTimes();
      await this.testScalability();
      await this.testMemoryUsage();
      
      const report = this.generateReport();
      
      console.log('\n📊 Performance Test Summary:');
      console.log(`   Total Tests: ${report.summary.totalTests}`);
      console.log(`   Passed: ${report.summary.passed}`);
      console.log(`   Failed: ${report.summary.failed}`);
      console.log(`   Pass Rate: ${report.summary.passRate}`);
      console.log(`   Average Load Time: ${report.summary.averageLoadTime}`);
      
      const overallPass = report.summary.failed === 0;
      console.log(`\n${overallPass ? '✅ ALL PERFORMANCE TESTS PASSED' : '❌ SOME PERFORMANCE TESTS FAILED'}`);
      
      return overallPass;
      
    } catch (error) {
      console.error('❌ Performance testing failed:', error);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// Command line execution
if (require.main === module) {
  const runner = new SupplierPerformanceRunner();
  
  runner.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Performance test execution failed:', error);
      process.exit(1);
    });
}

module.exports = SupplierPerformanceRunner;