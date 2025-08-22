#!/usr/bin/env node

/**
 * Sales Test Suite Runner
 * Executes all sales tests and generates a comprehensive report
 * 
 * Tests included:
 * 1. Comprehensive Sales Test - Overall functionality
 * 2. Validation Errors Test - Field validation and edge cases
 * 3. Inventory Impact Test - Stock synchronization
 * 4. Calculations Test - Financial accuracy
 * 5. Concurrent Sales Test - Race conditions and performance
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    RESULTS_DIR: './test-results',
    SUMMARY_FILE: 'sales-test-summary.json',
    TIMEOUT_PER_TEST: 300000, // 5 minutes per test
    TESTS: [
        {
            name: 'Comprehensive Sales Test',
            file: 'test-sales-production-comprehensive.js',
            description: 'Tests overall sales functionality, UI/UX, and error handling',
            critical: true
        },
        {
            name: 'Validation Errors Test',
            file: 'test-sales-validation-errors.js',
            description: 'Tests field validation and edge cases',
            critical: true
        },
        {
            name: 'Inventory Impact Test',
            file: 'test-sales-inventory-impact.js',
            description: 'Tests inventory synchronization and stock management',
            critical: true
        },
        {
            name: 'Calculations Accuracy Test',
            file: 'test-sales-calculations.js',
            description: 'Tests financial calculations and precision',
            critical: false
        },
        {
            name: 'Concurrent Sales Test',
            file: 'test-sales-concurrent.js',
            description: 'Tests race conditions and concurrent operations',
            critical: false
        }
    ]
};

// Test summary
const testSummary = {
    timestamp: new Date().toISOString(),
    environment: 'production',
    url: 'https://www.omomrentals.shop',
    tests: [],
    overall: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
    },
    bugs: [],
    logicalErrors: [],
    performanceIssues: [],
    securityIssues: []
};

// Helper functions
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const symbols = {
        info: '📝',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        running: '🔄'
    };
    
    console.log(`${symbols[type] || '📝'} [${timestamp}] ${message}`);
}

async function runTest(testConfig) {
    return new Promise((resolve) => {
        const testResult = {
            name: testConfig.name,
            file: testConfig.file,
            description: testConfig.description,
            critical: testConfig.critical,
            startTime: new Date().toISOString(),
            endTime: null,
            duration: null,
            status: 'UNKNOWN',
            exitCode: null,
            output: [],
            errors: []
        };
        
        log(`Running ${testConfig.name}...`, 'running');
        
        const testPath = path.join(__dirname, testConfig.file);
        
        // Check if test file exists
        if (!fs.existsSync(testPath)) {
            log(`Test file not found: ${testConfig.file}`, 'error');
            testResult.status = 'SKIPPED';
            testResult.errors.push('Test file not found');
            resolve(testResult);
            return;
        }
        
        const child = spawn('node', [testPath], {
            cwd: __dirname,
            env: { ...process.env, HEADLESS: 'true' }
        });
        
        const timeout = setTimeout(() => {
            child.kill('SIGTERM');
            log(`Test timed out: ${testConfig.name}`, 'error');
            testResult.status = 'TIMEOUT';
            testResult.errors.push('Test execution timeout');
            resolve(testResult);
        }, CONFIG.TIMEOUT_PER_TEST);
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            
            // Parse for bugs and issues
            if (output.includes('Bug:') || output.includes('BUG')) {
                const bugMatch = output.match(/Bug:\s*(.+)/i);
                if (bugMatch) testSummary.bugs.push(bugMatch[1]);
            }
            
            if (output.includes('Logical Error:') || output.includes('LOGICAL')) {
                const errorMatch = output.match(/Logical Error:\s*(.+)/i);
                if (errorMatch) testSummary.logicalErrors.push(errorMatch[1]);
            }
            
            if (output.includes('Security:') || output.includes('XSS') || output.includes('SQL')) {
                testSummary.securityIssues.push(output.trim());
            }
            
            if (output.includes('Performance:') || output.includes('Slow')) {
                const perfMatch = output.match(/Slow.+:\s*(\d+)ms/i);
                if (perfMatch) testSummary.performanceIssues.push(perfMatch[0]);
            }
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
            testResult.errors.push(data.toString());
        });
        
        child.on('close', (code) => {
            clearTimeout(timeout);
            
            testResult.exitCode = code;
            testResult.endTime = new Date().toISOString();
            testResult.duration = new Date(testResult.endTime) - new Date(testResult.startTime);
            
            // Parse test results from output
            const passMatch = stdout.match(/✅\s*Passed:\s*(\d+)/);
            const failMatch = stdout.match(/❌\s*Failed:\s*(\d+)/);
            const totalMatch = stdout.match(/Total Tests:\s*(\d+)/);
            
            if (passMatch) testResult.passed = parseInt(passMatch[1]);
            if (failMatch) testResult.failed = parseInt(failMatch[1]);
            if (totalMatch) testResult.total = parseInt(totalMatch[1]);
            
            // Determine status
            if (code === 0) {
                testResult.status = 'PASS';
                log(`${testConfig.name}: PASSED`, 'success');
            } else if (code === null) {
                testResult.status = 'KILLED';
                log(`${testConfig.name}: KILLED`, 'error');
            } else {
                testResult.status = 'FAIL';
                log(`${testConfig.name}: FAILED (exit code: ${code})`, 'error');
            }
            
            testResult.output = stdout.split('\n').slice(-50); // Keep last 50 lines
            
            resolve(testResult);
        });
        
        child.on('error', (error) => {
            clearTimeout(timeout);
            log(`Test execution error: ${error.message}`, 'error');
            testResult.status = 'ERROR';
            testResult.errors.push(error.message);
            resolve(testResult);
        });
    });
}

async function generateHTMLReport(summary) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Sales Test Report - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .card { background: white; padding: 15px; border-radius: 5px; flex: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .pass { color: #27ae60; font-weight: bold; }
        .fail { color: #e74c3c; font-weight: bold; }
        .warning { color: #f39c12; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; background: white; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #34495e; color: white; }
        .status-pass { background: #d4edda; color: #155724; }
        .status-fail { background: #f8d7da; color: #721c24; }
        .status-skip { background: #fff3cd; color: #856404; }
        .issues { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .issue-list { list-style: none; padding: 0; }
        .issue-list li { padding: 8px; margin: 5px 0; background: #f8f9fa; border-left: 3px solid #e74c3c; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Sales Transaction Test Report</h1>
        <p>Generated: ${summary.timestamp}</p>
        <p>URL: ${summary.url}</p>
    </div>
    
    <div class="summary">
        <div class="card">
            <h3>Total Tests</h3>
            <h1>${summary.overall.total}</h1>
        </div>
        <div class="card">
            <h3>Passed</h3>
            <h1 class="pass">${summary.overall.passed}</h1>
        </div>
        <div class="card">
            <h3>Failed</h3>
            <h1 class="fail">${summary.overall.failed}</h1>
        </div>
        <div class="card">
            <h3>Success Rate</h3>
            <h1>${summary.overall.total > 0 ? ((summary.overall.passed / summary.overall.total) * 100).toFixed(1) : 0}%</h1>
        </div>
    </div>
    
    <h2>Test Results</h2>
    <table>
        <tr>
            <th>Test Name</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Description</th>
        </tr>
        ${summary.tests.map(test => `
        <tr class="status-${test.status.toLowerCase()}">
            <td>${test.name}</td>
            <td>${test.status}</td>
            <td>${test.duration ? (test.duration / 1000).toFixed(1) + 's' : '-'}</td>
            <td>${test.description}</td>
        </tr>
        `).join('')}
    </table>
    
    ${summary.bugs.length > 0 ? `
    <div class="issues">
        <h2>🐛 Bugs Found (${summary.bugs.length})</h2>
        <ul class="issue-list">
            ${summary.bugs.map(bug => `<li>${bug}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
    
    ${summary.logicalErrors.length > 0 ? `
    <div class="issues">
        <h2>⚠️ Logical Errors (${summary.logicalErrors.length})</h2>
        <ul class="issue-list">
            ${summary.logicalErrors.map(error => `<li>${error}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
    
    ${summary.securityIssues.length > 0 ? `
    <div class="issues">
        <h2>🔒 Security Issues (${summary.securityIssues.length})</h2>
        <ul class="issue-list">
            ${summary.securityIssues.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
    
    ${summary.performanceIssues.length > 0 ? `
    <div class="issues">
        <h2>⚡ Performance Issues (${summary.performanceIssues.length})</h2>
        <ul class="issue-list">
            ${summary.performanceIssues.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>
    `;
    
    const reportPath = path.join(CONFIG.RESULTS_DIR, 'sales-test-report.html');
    fs.writeFileSync(reportPath, html);
    return reportPath;
}

// Main execution
async function runAllTests() {
    const startTime = Date.now();
    
    console.log('🚀 SALES TRANSACTION TEST SUITE');
    console.log('=' .repeat(60));
    console.log(`Started: ${new Date().toISOString()}`);
    console.log(`Tests to run: ${CONFIG.TESTS.length}`);
    console.log('=' .repeat(60));
    
    // Create results directory
    if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
        fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
    }
    
    // Run each test
    for (const testConfig of CONFIG.TESTS) {
        console.log('\n' + '-'.repeat(60));
        const result = await runTest(testConfig);
        testSummary.tests.push(result);
        testSummary.overall.total++;
        
        if (result.status === 'PASS') {
            testSummary.overall.passed++;
        } else if (result.status === 'FAIL' || result.status === 'ERROR' || result.status === 'TIMEOUT') {
            testSummary.overall.failed++;
            
            // Stop if critical test fails
            if (testConfig.critical) {
                log(`Critical test failed: ${testConfig.name}`, 'error');
                log('Stopping test suite execution', 'warning');
                break;
            }
        } else {
            testSummary.overall.skipped++;
        }
        
        // Brief pause between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const totalDuration = Date.now() - startTime;
    
    // Save JSON summary
    const summaryPath = path.join(CONFIG.RESULTS_DIR, CONFIG.SUMMARY_FILE);
    fs.writeFileSync(summaryPath, JSON.stringify(testSummary, null, 2));
    
    // Generate HTML report
    const htmlReport = await generateHTMLReport(testSummary);
    
    // Print final summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 FINAL TEST SUMMARY');
    console.log('=' .repeat(60));
    console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`📋 Total Tests: ${testSummary.overall.total}`);
    console.log(`✅ Passed: ${testSummary.overall.passed}`);
    console.log(`❌ Failed: ${testSummary.overall.failed}`);
    console.log(`⏭️  Skipped: ${testSummary.overall.skipped}`);
    console.log(`📈 Success Rate: ${testSummary.overall.total > 0 ? ((testSummary.overall.passed / testSummary.overall.total) * 100).toFixed(1) : 0}%`);
    
    if (testSummary.bugs.length > 0) {
        console.log(`\n🐛 Bugs Found: ${testSummary.bugs.length}`);
        testSummary.bugs.slice(0, 5).forEach((bug, i) => {
            console.log(`   ${i + 1}. ${bug}`);
        });
        if (testSummary.bugs.length > 5) {
            console.log(`   ... and ${testSummary.bugs.length - 5} more`);
        }
    }
    
    if (testSummary.logicalErrors.length > 0) {
        console.log(`\n⚠️ Logical Errors: ${testSummary.logicalErrors.length}`);
        testSummary.logicalErrors.slice(0, 5).forEach((error, i) => {
            console.log(`   ${i + 1}. ${error}`);
        });
    }
    
    if (testSummary.securityIssues.length > 0) {
        console.log(`\n🔒 Security Issues: ${testSummary.securityIssues.length}`);
        testSummary.securityIssues.slice(0, 3).forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue.substring(0, 100)}...`);
        });
    }
    
    if (testSummary.performanceIssues.length > 0) {
        console.log(`\n⚡ Performance Issues: ${testSummary.performanceIssues.length}`);
        testSummary.performanceIssues.slice(0, 3).forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue}`);
        });
    }
    
    console.log('\n📁 Reports:');
    console.log(`   JSON: ${summaryPath}`);
    console.log(`   HTML: ${htmlReport}`);
    console.log(`   Screenshots: ./test-screenshots/`);
    
    console.log('\n🎯 Recommendations:');
    if (testSummary.overall.failed > 0) {
        console.log('   1. Review failed tests and fix identified bugs');
        console.log('   2. Re-run failed tests individually for detailed debugging');
        console.log('   3. Check server logs for backend errors');
        console.log('   4. Verify test data setup and availability');
    } else {
        console.log('   1. All tests passed! 🎉');
        console.log('   2. Consider running stress tests for production readiness');
        console.log('   3. Monitor performance metrics in production');
        console.log('   4. Schedule regular test runs for regression detection');
    }
    
    console.log('\n🏁 Test suite completed at:', new Date().toISOString());
    
    // Exit with appropriate code
    process.exit(testSummary.overall.failed > 0 ? 1 : 0);
}

// Handle command line arguments
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Sales Test Suite Runner

Usage: node run-all-sales-tests.js [options]

Options:
  --help, -h     Show this help message
  --headless     Run tests in headless mode
  --timeout MS   Set timeout per test (default: 300000ms)

This script runs all sales transaction tests:
  1. Comprehensive functionality test
  2. Validation and edge cases test
  3. Inventory synchronization test
  4. Financial calculations test
  5. Concurrent operations test

Results are saved in:
  - JSON summary: ${CONFIG.RESULTS_DIR}/${CONFIG.SUMMARY_FILE}
  - HTML report: ${CONFIG.RESULTS_DIR}/sales-test-report.html
  - Screenshots: ./test-screenshots/
        `);
        process.exit(0);
    }
    
    if (args.includes('--headless')) {
        process.env.HEADLESS = 'true';
    }
    
    const timeoutIndex = args.indexOf('--timeout');
    if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
        CONFIG.TIMEOUT_PER_TEST = parseInt(args[timeoutIndex + 1]);
    }
    
    runAllTests().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, CONFIG };