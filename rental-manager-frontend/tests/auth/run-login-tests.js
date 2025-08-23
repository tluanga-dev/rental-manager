#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

console.log('🚀 Login Tests Runner');
console.log('====================');

const config = {
  frontendUrl: 'http://localhost:3000',
  backendUrl: 'http://localhost:8000',
  testTimeout: 120000, // 2 minutes
  maxRetries: 3
};

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, '../screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  console.log('📁 Created screenshots directory');
}

// Helper function to check if service is running
function checkService(url, name) {
  return new Promise((resolve) => {
    const request = http.get(url, (res) => {
      console.log(`✅ ${name} is running (Status: ${res.statusCode})`);
      resolve(true);
    });
    
    request.on('error', () => {
      console.log(`❌ ${name} is not running at ${url}`);
      resolve(false);
    });
    
    request.setTimeout(5000, () => {
      console.log(`⏰ ${name} check timed out`);
      request.destroy();
      resolve(false);
    });
  });
}

// Function to run tests with Jest
function runTests(testFile, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Running tests: ${testFile}`);
    console.log('─'.repeat(50));
    
    const jestArgs = [
      '--testTimeout', config.testTimeout.toString(),
      '--verbose',
      '--no-cache',
      testFile
    ];
    
    // Add environment variables
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      HEADLESS: options.headless || 'false',
      DEBUG: options.debug || 'false'
    };
    
    const jestProcess = spawn('npx', ['jest', ...jestArgs], {
      cwd: path.join(__dirname, '../../'),
      env,
      stdio: 'inherit'
    });
    
    jestProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Tests passed: ${testFile}`);
        resolve(code);
      } else {
        console.log(`❌ Tests failed: ${testFile} (Exit code: ${code})`);
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });
    
    jestProcess.on('error', (error) => {
      console.error(`❌ Failed to start test process: ${error.message}`);
      reject(error);
    });
  });
}

// Function to run Puppeteer tests directly
function runPuppeteerTest(testFile, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n🎭 Running Puppeteer test: ${testFile}`);
    console.log('─'.repeat(50));
    
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      HEADLESS: options.headless || 'false',
      DEBUG: options.debug || 'false'
    };
    
    const nodeProcess = spawn('node', [testFile], {
      cwd: path.join(__dirname, '../../'),
      env,
      stdio: 'inherit'
    });
    
    nodeProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Puppeteer test passed: ${testFile}`);
        resolve(code);
      } else {
        console.log(`❌ Puppeteer test failed: ${testFile} (Exit code: ${code})`);
        reject(new Error(`Test failed with exit code ${code}`));
      }
    });
    
    nodeProcess.on('error', (error) => {
      console.error(`❌ Failed to start Puppeteer test: ${error.message}`);
      reject(error);
    });
  });
}

// Main execution function
async function runLoginTests() {
  const startTime = Date.now();
  
  try {
    // Check if services are running
    console.log('\n🔍 Checking service availability...');
    const frontendRunning = await checkService(config.frontendUrl, 'Frontend');
    const backendRunning = await checkService(config.backendUrl, 'Backend API');
    
    if (!frontendRunning) {
      console.log('\n⚠️  Frontend is not running!');
      console.log('   Please start the frontend server:');
      console.log('   cd rental-manager-frontend && npm run dev');
      process.exit(1);
    }
    
    if (!backendRunning) {
      console.log('\n⚠️  Backend API is not running!');
      console.log('   Please start the backend server:');
      console.log('   cd rental-manager-api && make dev');
      console.log('   or use Docker: docker-compose up -d');
    }
    
    console.log('\n✅ All required services are running!');
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {
      headless: args.includes('--headless'),
      debug: args.includes('--debug'),
      visual: args.includes('--visual'),
      quick: args.includes('--quick')
    };
    
    console.log('\n⚙️  Test Configuration:');
    console.log(`   Headless mode: ${options.headless}`);
    console.log(`   Debug mode: ${options.debug}`);
    console.log(`   Include visual tests: ${options.visual}`);
    console.log(`   Quick mode: ${options.quick}`);
    
    const testResults = [];
    
    // Run main login tests
    try {
      await runTests('tests/auth/login-puppeteer.test.js', options);
      testResults.push({ test: 'login-puppeteer', status: 'passed' });
    } catch (error) {
      testResults.push({ test: 'login-puppeteer', status: 'failed', error: error.message });
    }
    
    // Run visual tests if requested
    if (options.visual && fs.existsSync('tests/auth/login-visual.test.js')) {
      try {
        await runTests('tests/auth/login-visual.test.js', options);
        testResults.push({ test: 'login-visual', status: 'passed' });
      } catch (error) {
        testResults.push({ test: 'login-visual', status: 'failed', error: error.message });
      }
    }
    
    // Generate test report
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n📊 Test Results Summary');
    console.log('═'.repeat(50));
    
    const passedTests = testResults.filter(r => r.status === 'passed').length;
    const failedTests = testResults.filter(r => r.status === 'failed').length;
    
    testResults.forEach(result => {
      const emoji = result.status === 'passed' ? '✅' : '❌';
      console.log(`${emoji} ${result.test}: ${result.status.toUpperCase()}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\n📈 Statistics:');
    console.log(`   Total tests: ${testResults.length}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${failedTests}`);
    console.log(`   Duration: ${duration}s`);
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      duration: duration,
      results: testResults,
      config: options,
      services: {
        frontend: frontendRunning,
        backend: backendRunning
      }
    };
    
    const reportPath = path.join(__dirname, `../reports/login-test-report-${Date.now()}.json`);
    const reportsDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
    
    if (failedTests > 0) {
      console.log(`\n❌ ${failedTests} test(s) failed!`);
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Fatal error running tests:', error.message);
    process.exit(1);
  }
}

// Show usage information
function showUsage() {
  console.log('\nUsage: node run-login-tests.js [options]');
  console.log('\nOptions:');
  console.log('  --headless    Run tests in headless mode');
  console.log('  --debug       Enable debug mode (slow motion)');
  console.log('  --visual      Include visual regression tests');
  console.log('  --quick       Skip optional tests');
  console.log('  --help        Show this help message');
  console.log('\nExamples:');
  console.log('  node run-login-tests.js');
  console.log('  node run-login-tests.js --headless');
  console.log('  node run-login-tests.js --debug --visual');
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  showUsage();
  process.exit(0);
}

// Run the tests
console.log('🎯 Starting Login Tests...\n');
runLoginTests().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});