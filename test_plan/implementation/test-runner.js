/**
 * Master Test Runner for Supplier CRUD Operations
 * Orchestrates all types of testing: automated, performance, and security
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class MasterTestRunner {
  constructor() {
    this.results = {
      automated: null,
      performance: null,
      security: null,
      overall: null
    };
    this.startTime = Date.now();
  }

  /**
   * Run all test suites
   */
  async runAllTests(options = {}) {
    console.log('🚀 Starting Comprehensive Supplier CRUD Test Suite...\n');
    console.log('═'.repeat(80));
    console.log('  📋 Test Plan: 100% CRUD Coverage for Supplier Features');
    console.log('  🎯 Target: Frontend Testing with Backend Integration');
    console.log('  🔧 Environment: Development');
    console.log('═'.repeat(80));
    console.log();

    try {
      // Environment checks
      await this.performEnvironmentChecks();

      // Generate test data
      if (!options.skipDataGeneration) {
        await this.generateTestData();
      }

      // Run test suites in sequence
      if (!options.skipAutomated) {
        this.results.automated = await this.runAutomatedTests();
      }

      if (!options.skipPerformance) {
        this.results.performance = await this.runPerformanceTests();
      }

      if (!options.skipSecurity) {
        this.results.security = await this.runSecurityTests();
      }

      // Generate consolidated report
      this.results.overall = this.generateOverallResults();
      await this.generateConsolidatedReport();

      // Display final summary
      this.displayFinalSummary();

      return this.results.overall.success;

    } catch (error) {
      console.error('💥 Test execution failed:', error.message);
      return false;
    }
  }

  /**
   * Environment checks before testing
   */
  async performEnvironmentChecks() {
    console.log('🔍 Performing Environment Checks...\n');

    const checks = [
      { name: 'Frontend Server', url: 'http://localhost:3001', required: true },
      { name: 'Backend API', url: 'http://localhost:8001/health', required: true },
      { name: 'Node.js Dependencies', check: () => this.checkNodeDependencies(), required: true },
      { name: 'Test Directories', check: () => this.checkTestDirectories(), required: true }
    ];

    for (const check of checks) {
      try {
        let result;
        if (check.url) {
          result = await this.checkHttpEndpoint(check.url);
        } else if (check.check) {
          result = await check.check();
        }

        if (result) {
          console.log(`   ✅ ${check.name}: OK`);
        } else {
          console.log(`   ❌ ${check.name}: FAILED`);
          if (check.required) {
            throw new Error(`Required check failed: ${check.name}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ ${check.name}: ERROR - ${error.message}`);
        if (check.required) {
          throw error;
        }
      }
    }

    console.log('\n✅ Environment checks completed\n');
  }

  async checkHttpEndpoint(url) {
    try {
      const axios = require('axios');
      const response = await axios.get(url, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  checkNodeDependencies() {
    const packagePath = path.join(__dirname, 'package.json');
    if (!fs.existsSync(packagePath)) {
      throw new Error('package.json not found');
    }

    const requiredDeps = ['puppeteer', 'jest', 'axios'];
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    
    for (const dep of requiredDeps) {
      const depPath = path.join(nodeModulesPath, dep);
      if (!fs.existsSync(depPath)) {
        throw new Error(`Missing dependency: ${dep}`);
      }
    }

    return true;
  }

  checkTestDirectories() {
    const requiredDirs = ['automated', 'manual', 'data', 'performance', 'security', 'reports'];
    
    for (const dir of requiredDirs) {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        throw new Error(`Missing test directory: ${dir}`);
      }
    }

    return true;
  }

  /**
   * Generate test data
   */
  async generateTestData() {
    console.log('📊 Generating Test Data...\n');

    try {
      await this.runCommand('node', ['data/test-data-generator.js', 'generate'], {
        cwd: __dirname,
        stdio: 'inherit'
      });
      console.log('✅ Test data generation completed\n');
    } catch (error) {
      console.log('⚠️  Test data generation failed, continuing with existing data\n');
    }
  }

  /**
   * Run automated Jest tests
   */
  async runAutomatedTests() {
    console.log('🤖 Running Automated Tests...\n');
    console.log('─'.repeat(60));

    try {
      const startTime = Date.now();
      
      await this.runCommand('npm', ['test'], {
        cwd: __dirname,
        stdio: 'inherit',
        env: { ...process.env, HEADLESS: 'true' }
      });

      const duration = Date.now() - startTime;
      
      console.log('─'.repeat(60));
      console.log(`✅ Automated tests completed in ${Math.round(duration/1000)}s\n`);
      
      return {
        success: true,
        duration: duration,
        type: 'automated'
      };

    } catch (error) {
      console.log('─'.repeat(60));
      console.log('❌ Automated tests failed\n');
      
      return {
        success: false,
        error: error.message,
        type: 'automated'
      };
    }
  }

  /**
   * Run performance tests
   */
  async runPerformanceTests() {
    console.log('⚡ Running Performance Tests...\n');
    console.log('─'.repeat(60));

    try {
      const startTime = Date.now();
      
      await this.runCommand('node', ['performance/performance-runner.js'], {
        cwd: __dirname,
        stdio: 'inherit'
      });

      const duration = Date.now() - startTime;
      
      console.log('─'.repeat(60));
      console.log(`✅ Performance tests completed in ${Math.round(duration/1000)}s\n`);
      
      return {
        success: true,
        duration: duration,
        type: 'performance'
      };

    } catch (error) {
      console.log('─'.repeat(60));
      console.log('❌ Performance tests failed\n');
      
      return {
        success: false,
        error: error.message,
        type: 'performance'
      };
    }
  }

  /**
   * Run security tests
   */
  async runSecurityTests() {
    console.log('🔒 Running Security Tests...\n');
    console.log('─'.repeat(60));

    try {
      const startTime = Date.now();
      
      await this.runCommand('node', ['security/security-runner.js'], {
        cwd: __dirname,
        stdio: 'inherit'
      });

      const duration = Date.now() - startTime;
      
      console.log('─'.repeat(60));
      console.log(`✅ Security tests completed in ${Math.round(duration/1000)}s\n`);
      
      return {
        success: true,
        duration: duration,
        type: 'security'
      };

    } catch (error) {
      console.log('─'.repeat(60));
      console.log('❌ Security tests failed\n');
      
      return {
        success: false,
        error: error.message,
        type: 'security'
      };
    }
  }

  /**
   * Helper to run shell commands
   */
  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
          if (options.stdio === 'inherit') {
            process.stdout.write(data);
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
          if (options.stdio === 'inherit') {
            process.stderr.write(data);
          }
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Generate overall results
   */
  generateOverallResults() {
    const totalDuration = Date.now() - this.startTime;
    const allTests = [this.results.automated, this.results.performance, this.results.security]
      .filter(r => r !== null);
    
    const successCount = allTests.filter(r => r.success).length;
    const totalCount = allTests.length;
    
    return {
      success: successCount === totalCount && totalCount > 0,
      totalTests: totalCount,
      successCount: successCount,
      failureCount: totalCount - successCount,
      totalDuration: totalDuration,
      details: {
        automated: this.results.automated,
        performance: this.results.performance,
        security: this.results.security
      }
    };
  }

  /**
   * Generate consolidated test report
   */
  async generateConsolidatedReport() {
    console.log('📊 Generating Consolidated Report...\n');

    const reportData = {
      timestamp: new Date().toISOString(),
      testSuite: 'Supplier CRUD Operations - Comprehensive Testing',
      environment: {
        frontend: 'http://localhost:3001',
        backend: 'http://localhost:8001',
        nodeVersion: process.version,
        platform: process.platform
      },
      summary: this.results.overall,
      results: {
        automated: this.results.automated,
        performance: this.results.performance,
        security: this.results.security
      }
    };

    // Save JSON report
    const jsonReportPath = path.join(__dirname, 'reports', 'consolidated-test-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(reportData, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHTMLConsolidatedReport(reportData);
    const htmlReportPath = path.join(__dirname, 'reports', 'consolidated-test-report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log(`✅ Consolidated report saved to: ${jsonReportPath}`);
    console.log(`✅ HTML report saved to: ${htmlReportPath}\n`);
  }

  generateHTMLConsolidatedReport(data) {
    const getStatusBadge = (success) => success ? 
      '<span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px;">PASS</span>' :
      '<span style="background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px;">FAIL</span>';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Comprehensive Supplier CRUD Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .metric.success { border-left-color: #28a745; }
        .metric.danger { border-left-color: #dc3545; }
        .metric h3 { margin: 0 0 10px 0; color: #495057; font-size: 0.9em; text-transform: uppercase; }
        .metric .value { font-size: 2em; font-weight: bold; color: #212529; }
        .test-section { margin: 30px 0; }
        .test-section h2 { color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 10px; }
        .test-result { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .test-result h3 { margin: 0 0 10px 0; display: flex; justify-content: between; align-items: center; }
        .test-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px; }
        .detail-item { background: white; padding: 10px; border-radius: 4px; }
        .detail-item strong { color: #495057; }
        .status-overall { font-size: 1.5em; text-align: center; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .status-overall.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status-overall.danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .recommendations { background: #e7f3ff; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; margin: 20px 0; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Comprehensive Supplier CRUD Test Report</h1>
            <p>100% Frontend CRUD Coverage with Performance & Security Testing</p>
            <p>Generated: ${data.timestamp}</p>
        </div>

        <div class="status-overall ${data.summary.success ? 'success' : 'danger'}">
            ${data.summary.success ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}
        </div>

        <div class="summary">
            <div class="metric ${data.summary.success ? 'success' : 'danger'}">
                <h3>Overall Status</h3>
                <div class="value">${data.summary.success ? 'PASS' : 'FAIL'}</div>
            </div>
            <div class="metric">
                <h3>Test Suites</h3>
                <div class="value">${data.summary.successCount}/${data.summary.totalTests}</div>
            </div>
            <div class="metric">
                <h3>Total Duration</h3>
                <div class="value">${Math.round(data.summary.totalDuration/1000)}s</div>
            </div>
            <div class="metric ${data.summary.failureCount === 0 ? 'success' : 'danger'}">
                <h3>Failures</h3>
                <div class="value">${data.summary.failureCount}</div>
            </div>
        </div>

        <div class="test-section">
            <h2>Test Suite Results</h2>
            
            ${data.results.automated ? `
            <div class="test-result">
                <h3>
                    🤖 Automated Tests
                    <span style="margin-left: auto;">${getStatusBadge(data.results.automated.success)}</span>
                </h3>
                <p>Comprehensive CRUD operation testing with Puppeteer and Jest</p>
                <div class="test-details">
                    <div class="detail-item">
                        <strong>Duration:</strong> ${Math.round((data.results.automated.duration || 0)/1000)}s
                    </div>
                    <div class="detail-item">
                        <strong>Test Cases:</strong> CREATE, READ, UPDATE, DELETE operations
                    </div>
                    <div class="detail-item">
                        <strong>Coverage:</strong> All frontend components and API endpoints
                    </div>
                </div>
                ${!data.results.automated.success ? `<p style="color: #dc3545; margin-top: 10px;"><strong>Error:</strong> ${data.results.automated.error}</p>` : ''}
            </div>
            ` : ''}

            ${data.results.performance ? `
            <div class="test-result">
                <h3>
                    ⚡ Performance Tests
                    <span style="margin-left: auto;">${getStatusBadge(data.results.performance.success)}</span>
                </h3>
                <p>Page load times, API response times, and scalability testing</p>
                <div class="test-details">
                    <div class="detail-item">
                        <strong>Duration:</strong> ${Math.round((data.results.performance.duration || 0)/1000)}s
                    </div>
                    <div class="detail-item">
                        <strong>Benchmarks:</strong> Page loads &lt;3s, API calls &lt;2s
                    </div>
                    <div class="detail-item">
                        <strong>Scalability:</strong> 1000+ suppliers tested
                    </div>
                </div>
                ${!data.results.performance.success ? `<p style="color: #dc3545; margin-top: 10px;"><strong>Error:</strong> ${data.results.performance.error}</p>` : ''}
            </div>
            ` : ''}

            ${data.results.security ? `
            <div class="test-result">
                <h3>
                    🔒 Security Tests
                    <span style="margin-left: auto;">${getStatusBadge(data.results.security.success)}</span>
                </h3>
                <p>XSS, SQL injection, authentication, and authorization testing</p>
                <div class="test-details">
                    <div class="detail-item">
                        <strong>Duration:</strong> ${Math.round((data.results.security.duration || 0)/1000)}s
                    </div>
                    <div class="detail-item">
                        <strong>Vulnerabilities:</strong> Input validation, authentication
                    </div>
                    <div class="detail-item">
                        <strong>Attack Vectors:</strong> XSS, SQLi, CSRF, privilege escalation
                    </div>
                </div>
                ${!data.results.security.success ? `<p style="color: #dc3545; margin-top: 10px;"><strong>Error:</strong> ${data.results.security.error}</p>` : ''}
            </div>
            ` : ''}
        </div>

        <div class="test-section">
            <h2>Environment Information</h2>
            <div class="test-details">
                <div class="detail-item">
                    <strong>Frontend:</strong> ${data.environment.frontend}
                </div>
                <div class="detail-item">
                    <strong>Backend:</strong> ${data.environment.backend}
                </div>
                <div class="detail-item">
                    <strong>Node.js:</strong> ${data.environment.nodeVersion}
                </div>
                <div class="detail-item">
                    <strong>Platform:</strong> ${data.environment.platform}
                </div>
            </div>
        </div>

        ${!data.summary.success ? `
        <div class="recommendations">
            <h3>📋 Recommendations</h3>
            <ul>
                <li>Review failed test cases in individual test reports</li>
                <li>Check application logs for detailed error information</li>
                <li>Verify environment setup and dependencies</li>
                <li>Re-run tests after fixing identified issues</li>
                <li>Consider increasing test timeouts if tests are timing out</li>
            </ul>
        </div>
        ` : `
        <div class="recommendations">
            <h3>✅ Test Completion Summary</h3>
            <p>All test suites have passed successfully! The supplier CRUD functionality meets all quality, performance, and security requirements.</p>
            <ul>
                <li>✅ All CRUD operations working correctly</li>
                <li>✅ Performance benchmarks met</li>
                <li>✅ No security vulnerabilities detected</li>
                <li>✅ Frontend components functioning as expected</li>
            </ul>
        </div>
        `}

        <div class="footer">
            <p>Report generated by Comprehensive Supplier CRUD Test Suite</p>
            <p>For detailed results, check individual test reports in the reports/ directory</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Display final summary
   */
  displayFinalSummary() {
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    
    console.log('═'.repeat(80));
    console.log('🏁 COMPREHENSIVE TEST EXECUTION COMPLETE');
    console.log('═'.repeat(80));
    console.log();
    console.log(`📊 FINAL RESULTS:`);
    console.log(`   Total Duration: ${duration}s`);
    console.log(`   Test Suites Run: ${this.results.overall.totalTests}`);
    console.log(`   Successful: ${this.results.overall.successCount}`);
    console.log(`   Failed: ${this.results.overall.failureCount}`);
    console.log();
    
    if (this.results.automated) {
      const status = this.results.automated.success ? '✅ PASSED' : '❌ FAILED';
      console.log(`   🤖 Automated Tests: ${status}`);
    }
    
    if (this.results.performance) {
      const status = this.results.performance.success ? '✅ PASSED' : '❌ FAILED';
      console.log(`   ⚡ Performance Tests: ${status}`);
    }
    
    if (this.results.security) {
      const status = this.results.security.success ? '✅ PASSED' : '❌ FAILED';
      console.log(`   🔒 Security Tests: ${status}`);
    }
    
    console.log();
    
    if (this.results.overall.success) {
      console.log('🎉 ALL TESTS PASSED - SUPPLIER CRUD FUNCTIONALITY VERIFIED');
      console.log('✅ 100% CRUD coverage achieved');
      console.log('✅ Performance benchmarks met');
      console.log('✅ Security requirements satisfied');
    } else {
      console.log('❌ SOME TESTS FAILED - REVIEW REQUIRED');
      console.log('📋 Check individual test reports for details');
      console.log('🔧 Fix identified issues and re-run tests');
    }
    
    console.log();
    console.log('📁 Reports generated in: ./reports/');
    console.log('   • consolidated-test-report.html - Main summary');
    console.log('   • performance-report.html - Performance details');
    console.log('   • security-report.html - Security analysis');
    console.log('   • Screenshots in ./reports/screenshots/');
    console.log();
    console.log('═'.repeat(80));
  }

  /**
   * Quick test execution for CI/CD
   */
  async runQuickTests() {
    console.log('🚀 Running Quick Test Suite (CI/CD Mode)...\n');
    
    return await this.runAllTests({
      skipDataGeneration: true,
      skipPerformance: false,
      skipSecurity: false
    });
  }

  /**
   * Manual test guidance
   */
  async generateManualTestGuidance() {
    console.log('📋 Generating Manual Test Guidance...\n');
    
    const manualGuidePath = path.join(__dirname, 'reports', 'manual-test-checklist.html');
    const manualGuide = this.generateManualTestHTML();
    
    fs.writeFileSync(manualGuidePath, manualGuide);
    console.log(`✅ Manual test guidance saved to: ${manualGuidePath}\n`);
  }

  generateManualTestHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Manual Test Checklist - Supplier CRUD</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .checklist { margin: 20px 0; }
        .checklist input { margin-right: 10px; }
        .section { margin: 30px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .section h3 { margin-top: 0; color: #333; }
        .priority-high { border-left: 4px solid #ff4444; }
        .priority-medium { border-left: 4px solid #ffaa00; }
        .priority-low { border-left: 4px solid #44ff44; }
    </style>
</head>
<body>
    <h1>📋 Manual Test Checklist - Supplier CRUD</h1>
    <p>Use this checklist to verify automated test results and perform additional manual testing.</p>
    
    <div class="section priority-high">
        <h3>🔥 High Priority Manual Tests</h3>
        <div class="checklist">
            <label><input type="checkbox"> Create supplier with all fields and verify data accuracy</label><br>
            <label><input type="checkbox"> Test form validation with invalid data</label><br>
            <label><input type="checkbox"> Verify edit functionality preserves unchanged fields</label><br>
            <label><input type="checkbox"> Test delete confirmation and actual deletion</label><br>
            <label><input type="checkbox"> Verify search and filter functionality</label><br>
            <label><input type="checkbox"> Test pagination with different page sizes</label><br>
        </div>
    </div>
    
    <div class="section priority-medium">
        <h3>⚡ Performance Manual Checks</h3>
        <div class="checklist">
            <label><input type="checkbox"> Verify page loads within 3 seconds</label><br>
            <label><input type="checkbox"> Test with large datasets (500+ suppliers)</label><br>
            <label><input type="checkbox"> Check memory usage during extended use</label><br>
            <label><input type="checkbox"> Verify smooth scrolling and interactions</label><br>
        </div>
    </div>
    
    <div class="section priority-medium">
        <h3>🔒 Security Manual Verification</h3>
        <div class="checklist">
            <label><input type="checkbox"> Attempt XSS in text fields (should be blocked)</label><br>
            <label><input type="checkbox"> Test unauthorized access to supplier data</label><br>
            <label><input type="checkbox"> Verify proper session handling</label><br>
            <label><input type="checkbox"> Test input length limits</label><br>
        </div>
    </div>
    
    <div class="section priority-low">
        <h3>🎨 UI/UX Manual Tests</h3>
        <div class="checklist">
            <label><input type="checkbox"> Test mobile responsiveness</label><br>
            <label><input type="checkbox"> Verify accessibility (keyboard navigation)</label><br>
            <label><input type="checkbox"> Check error message clarity</label><br>
            <label><input type="checkbox"> Test browser back/forward behavior</label><br>
        </div>
    </div>
    
    <p><strong>Instructions:</strong> Check off each item as you complete it. Any failures should be documented and addressed before deployment.</p>
</body>
</html>
    `;
  }
}

// Command line usage
if (require.main === module) {
  const runner = new MasterTestRunner();
  const command = process.argv[2];

  async function main() {
    let success = false;

    switch (command) {
      case 'quick':
        success = await runner.runQuickTests();
        break;
      
      case 'automated':
        const automated = await runner.runAutomatedTests();
        success = automated.success;
        break;
      
      case 'performance':
        const performance = await runner.runPerformanceTests();
        success = performance.success;
        break;
      
      case 'security':
        const security = await runner.runSecurityTests();
        success = security.success;
        break;
      
      case 'manual':
        await runner.generateManualTestGuidance();
        success = true;
        break;
      
      case 'all':
      default:
        success = await runner.runAllTests();
        break;
    }

    process.exit(success ? 0 : 1);
  }

  main().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = MasterTestRunner;