#!/usr/bin/env node

/**
 * Purchase CRUD Performance Test Runner
 * Executes comprehensive performance tests and generates reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Purchase CRUD Performance Tests...\n');

// Configuration
const config = {
  testFile: 'tests/purchase-crud-performance.test.js',
  timeout: 600000, // 10 minutes
  resultsDir: path.join(__dirname, 'tests', 'performance-results'),
  outputFile: path.join(__dirname, 'purchase-performance-results.txt')
};

// Ensure results directory exists
if (!fs.existsSync(config.resultsDir)) {
  fs.mkdirSync(config.resultsDir, { recursive: true });
  console.log(`📁 Created results directory: ${config.resultsDir}`);
}

// Pre-flight checks
async function preflightChecks() {
  console.log('🔍 Running pre-flight checks...');
  
  try {
    // Check if API is running
    const { default: fetch } = await import('node-fetch');
    const healthResponse = await fetch('http://localhost:8000/health');
    console.log(`✅ API Health Check: ${healthResponse.status === 200 ? 'Healthy' : 'Unhealthy'}`);
  } catch (error) {
    console.warn('⚠️  API health check failed:', error.message);
    console.log('📝 Make sure the backend API is running on http://localhost:8000');
  }
  
  // Check test dependencies
  const requiredFiles = [
    'tests/helpers/purchase-test-factory.js',
    'tests/helpers/performance-utils.js',
    'tests/helpers/purchase-api-client.js',
    'tests/purchase-crud-performance.test.js'
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(__dirname, file)));
  
  if (missingFiles.length > 0) {
    console.error('❌ Missing required test files:');
    missingFiles.forEach(file => console.error(`  - ${file}`));
    process.exit(1);
  }
  
  console.log('✅ All required test files found');
  console.log('✅ Pre-flight checks completed\n');
}

// Run the performance tests
function runPerformanceTests() {
  console.log('🧪 Executing Purchase CRUD Performance Tests...\n');
  
  const startTime = Date.now();
  
  try {
    // Run Jest with specific test file
    const command = `npm test -- ${config.testFile} --verbose --runInBand --detectOpenHandles --forceExit`;
    
    console.log(`🔧 Command: ${command}\n`);
    
    const output = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: config.timeout,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    console.log('\n✅ Performance tests completed successfully!');
    console.log(`⏱️  Total execution time: ${(totalDuration / 1000).toFixed(2)} seconds`);
    
    // Save output to file
    const fullOutput = `
PURCHASE CRUD PERFORMANCE TEST RESULTS
======================================
Execution Time: ${new Date().toISOString()}
Total Duration: ${(totalDuration / 1000).toFixed(2)} seconds

${output}

======================================
Test completed at: ${new Date().toISOString()}
`;
    
    fs.writeFileSync(config.outputFile, fullOutput);
    console.log(`📄 Full test output saved to: ${config.outputFile}`);
    
    return { success: true, output, duration: totalDuration };
    
  } catch (error) {
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    console.error('\n❌ Performance tests failed!');
    console.error(`⏱️  Execution time: ${(totalDuration / 1000).toFixed(2)} seconds`);
    console.error('Error:', error.message);
    
    // Save error output
    const errorOutput = `
PURCHASE CRUD PERFORMANCE TEST RESULTS (FAILED)
===============================================
Execution Time: ${new Date().toISOString()}
Total Duration: ${(totalDuration / 1000).toFixed(2)} seconds
Status: FAILED

ERROR OUTPUT:
${error.stdout || error.message}

STDERR:
${error.stderr || 'No stderr output'}

===============================================
Test failed at: ${new Date().toISOString()}
`;
    
    fs.writeFileSync(config.outputFile, errorOutput);
    console.log(`📄 Error output saved to: ${config.outputFile}`);
    
    return { success: false, error, duration: totalDuration };
  }
}

// Generate summary report
function generateSummaryReport() {
  console.log('\n📊 Generating summary report...');
  
  try {
    // Check for performance results
    if (!fs.existsSync(config.resultsDir)) {
      console.log('📁 No performance results directory found');
      return;
    }
    
    const resultFiles = fs.readdirSync(config.resultsDir)
      .filter(file => file.includes('purchase') && file.endsWith('.json'))
      .sort();
    
    if (resultFiles.length === 0) {
      console.log('📄 No performance result files found');
      return;
    }
    
    console.log(`📊 Found ${resultFiles.length} performance result files:`);
    
    const summaryData = {
      testSuite: 'Purchase CRUD Performance Tests',
      timestamp: new Date().toISOString(),
      totalFiles: resultFiles.length,
      files: [],
      aggregateStats: {
        totalOperations: 0,
        averageSuccessRate: 0,
        averageResponseTime: 0,
        totalTestDuration: 0
      }
    };
    
    let totalSuccessRates = 0;
    let totalResponseTimes = 0;
    let validFiles = 0;
    
    resultFiles.forEach(file => {
      try {
        const filePath = path.join(config.resultsDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        const fileInfo = {
          filename: file,
          testName: data.testName || 'Unknown',
          timestamp: data.timestamp || 'Unknown',
          operations: data.report?.overview?.totalOperations || 0,
          successRate: parseFloat(data.report?.overview?.successRate || 0),
          avgResponseTime: parseFloat(data.report?.timingAnalysis?.average || 0),
          duration: parseFloat(data.report?.overview?.totalDuration || 0)
        };
        
        summaryData.files.push(fileInfo);
        summaryData.aggregateStats.totalOperations += fileInfo.operations;
        summaryData.aggregateStats.totalTestDuration += fileInfo.duration;
        
        if (fileInfo.successRate > 0) {
          totalSuccessRates += fileInfo.successRate;
          validFiles++;
        }
        
        if (fileInfo.avgResponseTime > 0) {
          totalResponseTimes += fileInfo.avgResponseTime;
        }
        
        console.log(`  ✅ ${file}: ${fileInfo.operations} ops, ${fileInfo.successRate}% success, ${fileInfo.avgResponseTime}ms avg`);
        
      } catch (parseError) {
        console.warn(`  ⚠️  Could not parse ${file}:`, parseError.message);
      }
    });
    
    // Calculate aggregates
    if (validFiles > 0) {
      summaryData.aggregateStats.averageSuccessRate = (totalSuccessRates / validFiles).toFixed(1);
      summaryData.aggregateStats.averageResponseTime = (totalResponseTimes / validFiles).toFixed(2);
    }
    
    // Save summary
    const summaryFile = path.join(config.resultsDir, `purchase-performance-summary-${Date.now()}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2));
    
    console.log(`\n📊 PERFORMANCE SUMMARY:`);
    console.log(`  🔢 Total Operations: ${summaryData.aggregateStats.totalOperations}`);
    console.log(`  ✅ Average Success Rate: ${summaryData.aggregateStats.averageSuccessRate}%`);
    console.log(`  ⏱️  Average Response Time: ${summaryData.aggregateStats.averageResponseTime}ms`);
    console.log(`  🕐 Total Test Duration: ${(summaryData.aggregateStats.totalTestDuration / 1000).toFixed(2)}s`);
    console.log(`\n💾 Summary saved: ${summaryFile}`);
    
  } catch (error) {
    console.error('❌ Failed to generate summary report:', error.message);
  }
}

// Main execution
async function main() {
  try {
    console.log('🎯 Purchase CRUD Performance Test Suite');
    console.log('=====================================\n');
    
    await preflightChecks();
    
    const result = runPerformanceTests();
    
    if (result.success) {
      generateSummaryReport();
      
      console.log('\n🎉 All performance tests completed successfully!');
      console.log('📊 Check the performance-results directory for detailed reports');
      console.log(`📄 Full output available in: ${config.outputFile}`);
    } else {
      console.log('\n💥 Performance tests failed. Check the error output for details.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Fatal error during test execution:', error.message);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main, config };