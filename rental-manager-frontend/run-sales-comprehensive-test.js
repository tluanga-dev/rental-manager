#!/usr/bin/env node

/**
 * Comprehensive Sales Testing Suite
 * 
 * This script runs a complete test suite for the sales feature including:
 * 1. System setup and data preparation
 * 2. API workflow testing
 * 3. Frontend E2E testing
 * 4. Inventory impact verification
 * 5. Test cleanup and reporting
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    BACKEND_URL: 'http://localhost:8000',
    FRONTEND_URL: 'http://localhost:3000',
    TEST_RESULTS_DIR: './test-results',
    SCREENSHOT_DIR: './test-screenshots',
    TIMEOUT: 300000, // 5 minutes
};

// Test suite definition
const TEST_SUITE = {
    setup: {
        name: 'Test Data Setup',
        script: 'setup-sales-test-data.js',
        required: true,
        timeout: 60000
    },
    api: {
        name: 'Sales API Workflow Test',
        script: 'test-sales-api-workflow.js',
        required: true,
        timeout: 120000
    },
    frontend: {
        name: 'Sales Frontend E2E Test',
        script: 'test-sales-creation-inventory.js',
        required: false,
        timeout: 180000
    }
};

// Utility functions
const utils = {
    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '📝',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            debug: '🔍'
        }[type] || '📝';
        
        console.log(`${prefix} [${timestamp}] ${message}`);
    },

    async checkServices() {
        const fetch = (await import('node-fetch')).default;
        
        console.log('🔍 Checking required services...\n');
        
        // Check backend
        try {
            const backendResponse = await fetch(`${CONFIG.BACKEND_URL}/api/health`, {
                timeout: 5000
            });
            if (backendResponse.ok) {
                utils.log(`Backend service is running at ${CONFIG.BACKEND_URL}`, 'success');
            } else {
                throw new Error(`Backend responded with status: ${backendResponse.status}`);
            }
        } catch (error) {
            utils.log(`Backend service is not available at ${CONFIG.BACKEND_URL}`, 'error');
            utils.log(`Error: ${error.message}`, 'error');
            return false;
        }

        // Check frontend (optional for API-only tests)
        try {
            const frontendResponse = await fetch(CONFIG.FRONTEND_URL, {
                timeout: 5000
            });
            if (frontendResponse.ok) {
                utils.log(`Frontend service is running at ${CONFIG.FRONTEND_URL}`, 'success');
            } else {
                utils.log(`Frontend service responded with status: ${frontendResponse.status}`, 'warning');
            }
        } catch (error) {
            utils.log(`Frontend service is not available at ${CONFIG.FRONTEND_URL}`, 'warning');
            utils.log(`Frontend tests will be skipped`, 'warning');
        }

        return true;
    },

    async runScript(scriptName, testName, timeout = 60000) {
        return new Promise((resolve, reject) => {
            utils.log(`Starting: ${testName}`, 'info');
            
            const scriptPath = path.join(__dirname, scriptName);
            if (!fs.existsSync(scriptPath)) {
                utils.log(`Script not found: ${scriptPath}`, 'error');
                resolve({ success: false, error: 'Script not found' });
                return;
            }

            const child = spawn('node', [scriptPath], {
                stdio: 'inherit',
                cwd: __dirname
            });

            const timer = setTimeout(() => {
                child.kill('SIGTERM');
                utils.log(`Test timed out after ${timeout / 1000}s: ${testName}`, 'error');
                resolve({ success: false, error: 'Timeout' });
            }, timeout);

            child.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0) {
                    utils.log(`Completed successfully: ${testName}`, 'success');
                    resolve({ success: true, code });
                } else {
                    utils.log(`Failed with exit code ${code}: ${testName}`, 'error');
                    resolve({ success: false, code });
                }
            });

            child.on('error', (error) => {
                clearTimeout(timer);
                utils.log(`Script execution error: ${error.message}`, 'error');
                resolve({ success: false, error: error.message });
            });
        });
    },

    createDirectories() {
        const dirs = [CONFIG.TEST_RESULTS_DIR, CONFIG.SCREENSHOT_DIR];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                utils.log(`Created directory: ${dir}`, 'info');
            }
        });
    },

    generateReport(results) {
        const timestamp = new Date().toISOString();
        const reportFile = path.join(CONFIG.TEST_RESULTS_DIR, `sales-test-report-${timestamp.replace(/[:.]/g, '-')}.json`);
        
        const report = {
            timestamp,
            environment: {
                backend_url: CONFIG.BACKEND_URL,
                frontend_url: CONFIG.FRONTEND_URL,
                node_version: process.version,
                platform: process.platform
            },
            summary: {
                total_tests: Object.keys(results).length,
                passed: Object.values(results).filter(r => r.success).length,
                failed: Object.values(results).filter(r => !r.success).length,
                skipped: Object.values(results).filter(r => r.skipped).length
            },
            results
        };

        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        utils.log(`Report saved: ${reportFile}`, 'info');
        
        return report;
    }
};

// Main test execution
async function runComprehensiveTest() {
    let results = {};
    let startTime = Date.now();

    try {
        console.log('🚀 COMPREHENSIVE SALES TESTING SUITE');
        console.log('=' .repeat(60));
        console.log(`Started at: ${new Date().toISOString()}`);
        console.log(`Backend: ${CONFIG.BACKEND_URL}`);
        console.log(`Frontend: ${CONFIG.FRONTEND_URL}`);
        console.log('=' .repeat(60));

        // Setup directories
        utils.createDirectories();

        // Check services
        const servicesOk = await utils.checkServices();
        if (!servicesOk) {
            utils.log('Required services are not available. Exiting.', 'error');
            process.exit(1);
        }

        console.log('\n🧪 Running test suite...\n');

        // Run each test in sequence
        for (const [testKey, testConfig] of Object.entries(TEST_SUITE)) {
            const startTestTime = Date.now();
            
            try {
                if (testKey === 'frontend' && !CONFIG.FRONTEND_URL) {
                    utils.log(`Skipping ${testConfig.name} - Frontend not available`, 'warning');
                    results[testKey] = {
                        name: testConfig.name,
                        success: false,
                        skipped: true,
                        duration: 0,
                        reason: 'Frontend service not available'
                    };
                    continue;
                }

                const result = await utils.runScript(
                    testConfig.script, 
                    testConfig.name, 
                    testConfig.timeout
                );

                const duration = Date.now() - startTestTime;
                results[testKey] = {
                    name: testConfig.name,
                    success: result.success,
                    skipped: false,
                    duration,
                    ...(result.error && { error: result.error }),
                    ...(result.code !== undefined && { exit_code: result.code })
                };

                // Stop if required test fails
                if (!result.success && testConfig.required) {
                    utils.log(`Required test failed: ${testConfig.name}`, 'error');
                    utils.log('Stopping test suite execution', 'error');
                    break;
                }

            } catch (error) {
                const duration = Date.now() - startTestTime;
                utils.log(`Test execution error: ${error.message}`, 'error');
                results[testKey] = {
                    name: testConfig.name,
                    success: false,
                    skipped: false,
                    duration,
                    error: error.message
                };

                if (testConfig.required) {
                    break;
                }
            }

            // Brief pause between tests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

    } catch (error) {
        utils.log(`Critical error during test execution: ${error.message}`, 'error');
        console.error(error);
    }

    // Generate final report
    const totalDuration = Date.now() - startTime;
    const report = utils.generateReport(results);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE SALES TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`📋 Total Tests: ${report.summary.total_tests}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⏭️  Skipped: ${report.summary.skipped}`);
    console.log(`📈 Success Rate: ${report.summary.total_tests > 0 ? ((report.summary.passed / report.summary.total_tests) * 100).toFixed(1) : 0}%`);

    console.log('\n📋 Detailed Results:');
    for (const [key, result] of Object.entries(results)) {
        const status = result.success ? '✅ PASS' : result.skipped ? '⏭️  SKIP' : '❌ FAIL';
        const duration = `${(result.duration / 1000).toFixed(1)}s`;
        console.log(`   ${status} ${result.name} (${duration})`);
        if (result.error) {
            console.log(`      Error: ${result.error}`);
        }
        if (result.reason) {
            console.log(`      Reason: ${result.reason}`);
        }
    }

    // Additional information
    if (fs.existsSync(CONFIG.SCREENSHOT_DIR)) {
        const screenshots = fs.readdirSync(CONFIG.SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
        if (screenshots.length > 0) {
            console.log(`\n📸 Screenshots: ${screenshots.length} files in ${CONFIG.SCREENSHOT_DIR}`);
        }
    }

    console.log(`\n📄 Detailed report: ${path.join(CONFIG.TEST_RESULTS_DIR, 'sales-test-report-*.json')}`);
    console.log('\n🎯 Next Steps:');
    
    if (report.summary.failed > 0) {
        console.log('   1. Review failed test details above');
        console.log('   2. Check application logs for errors');
        console.log('   3. Verify test data setup was successful');
        console.log('   4. Re-run individual tests if needed');
    } else {
        console.log('   1. Sales feature is working correctly! 🎉');
        console.log('   2. Consider running performance tests');
        console.log('   3. Test with larger datasets');
        console.log('   4. Validate in staging environment');
    }

    console.log('\n🏁 Test suite completed at:', new Date().toISOString());

    // Exit with appropriate code
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
}

// Handle script execution
if (require.main === module) {
    // Handle command line arguments
    const args = process.argv.slice(2);
    const helpRequested = args.includes('--help') || args.includes('-h');
    
    if (helpRequested) {
        console.log(`
🧪 Comprehensive Sales Testing Suite

Usage: node run-sales-comprehensive-test.js [options]

Options:
  --help, -h          Show this help message
  --backend-url URL   Backend URL (default: ${CONFIG.BACKEND_URL})
  --frontend-url URL  Frontend URL (default: ${CONFIG.FRONTEND_URL})

Description:
  Runs a comprehensive test suite for the sales feature including:
  
  1. 📋 Test Data Setup
     - Creates test customers, locations, and items
     - Sets up inventory with sufficient stock levels
     - Verifies system readiness
  
  2. 🔧 API Workflow Test
     - Tests sales creation via API
     - Verifies inventory reduction
     - Checks stock movement records
     - Validates transaction details
  
  3. 🖥️  Frontend E2E Test
     - Tests complete UI workflow
     - Creates sales through the web interface
     - Verifies form interactions and calculations
     - Takes screenshots for visual verification

Test Results:
  - Screenshots: ./test-screenshots/
  - Reports: ./test-results/
  - Exit code 0 = all tests passed
  - Exit code 1 = one or more tests failed

Examples:
  node run-sales-comprehensive-test.js
  node run-sales-comprehensive-test.js --backend-url http://staging.api.com:8000
        `);
        process.exit(0);
    }

    // Parse command line arguments
    const backendUrlIndex = args.indexOf('--backend-url');
    if (backendUrlIndex !== -1 && args[backendUrlIndex + 1]) {
        CONFIG.BACKEND_URL = args[backendUrlIndex + 1];
    }

    const frontendUrlIndex = args.indexOf('--frontend-url');
    if (frontendUrlIndex !== -1 && args[frontendUrlIndex + 1]) {
        CONFIG.FRONTEND_URL = args[frontendUrlIndex + 1];
    }

    // Run the test suite
    runComprehensiveTest().catch(error => {
        console.error('💥 Test suite execution failed:', error);
        process.exit(1);
    });
}

module.exports = { runComprehensiveTest, utils, CONFIG };