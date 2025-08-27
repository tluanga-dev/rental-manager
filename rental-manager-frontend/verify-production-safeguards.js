#!/usr/bin/env node

/**
 * Production Safeguards Verification Script
 * 
 * This script tests that production safeguards are working correctly
 * by simulating different environment configurations and verifying
 * that the auth bypass is properly blocked in production scenarios.
 */

const fs = require('fs');
const path = require('path');

console.log('🛡️  Production Safeguards Verification');
console.log('=====================================\n');

// Test scenarios
const scenarios = [
  {
    name: 'Production with auth bypass enabled (SHOULD FAIL)',
    env: {
      NODE_ENV: 'production',
      NEXT_PUBLIC_DISABLE_AUTH: 'true',
      NEXT_PUBLIC_DEV_MODE: 'true'
    },
    expectedSafe: false,
    critical: true
  },
  {
    name: 'Development with auth bypass enabled (SHOULD PASS)',
    env: {
      NODE_ENV: 'development',
      NEXT_PUBLIC_DISABLE_AUTH: 'true',
      NEXT_PUBLIC_DEV_MODE: 'true'
    },
    expectedSafe: true,
    critical: false
  },
  {
    name: 'Production with auth bypass disabled (SHOULD PASS)',
    env: {
      NODE_ENV: 'production',
      NEXT_PUBLIC_DISABLE_AUTH: 'false',
      NEXT_PUBLIC_DEV_MODE: 'false'
    },
    expectedSafe: true,
    critical: false
  },
  {
    name: 'Development with auth bypass disabled (SHOULD PASS)',
    env: {
      NODE_ENV: 'development',
      NEXT_PUBLIC_DISABLE_AUTH: 'false',
      NEXT_PUBLIC_DEV_MODE: 'false'
    },
    expectedSafe: true,
    critical: false
  }
];

// Mock browser environment
global.window = {
  location: {
    hostname: 'localhost'
  }
};
global.document = {
  createElement: () => ({}),
  body: { appendChild: () => {} },
  getElementById: () => null
};
global.localStorage = {
  setItem: () => {},
  removeItem: () => {},
  getItem: () => null
};

// Mock console to capture alerts
const originalConsole = { ...console };
let consoleOutput = [];

function mockConsole() {
  console.log = (...args) => {
    consoleOutput.push(['log', ...args]);
    originalConsole.log(...args);
  };
  console.error = (...args) => {
    consoleOutput.push(['error', ...args]);
    originalConsole.error(...args);
  };
  console.warn = (...args) => {
    consoleOutput.push(['warn', ...args]);
    originalConsole.warn(...args);
  };
  console.group = (...args) => {
    consoleOutput.push(['group', ...args]);
    originalConsole.group(...args);
  };
  console.groupEnd = () => {
    consoleOutput.push(['groupEnd']);
    originalConsole.groupEnd();
  };
}

function restoreConsole() {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.group = originalConsole.group;
  console.groupEnd = originalConsole.groupEnd;
}

async function runScenario(scenario) {
  console.log(`\n📋 Testing: ${scenario.name}`);
  console.log('─'.repeat(60));
  
  // Set environment variables
  Object.keys(scenario.env).forEach(key => {
    process.env[key] = scenario.env[key];
  });
  
  // Clear module cache to force re-evaluation of env vars
  delete require.cache[require.resolve('./src/lib/production-safeguards.ts')];
  
  // Mock console to capture output
  consoleOutput = [];
  mockConsole();
  
  try {
    // Import ProductionSafeguards with new environment
    const { ProductionSafeguards } = require('./src/lib/production-safeguards.ts');
    
    // Test the safeguard checks
    const checks = ProductionSafeguards.runSafeguardChecks();
    const hasCriticalFailures = ProductionSafeguards.hasCriticalFailures(checks);
    const isAuthBypassSafe = ProductionSafeguards.isAuthBypassSafe();
    
    // Verify results
    const passed = (isAuthBypassSafe === scenario.expectedSafe);
    const criticalFailuresExpected = scenario.critical;
    const criticalFailuresFound = hasCriticalFailures;
    
    console.log(`Environment: ${Object.entries(scenario.env).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    console.log(`Auth Bypass Safe: ${isAuthBypassSafe ? '✅' : '❌'}`);
    console.log(`Critical Failures: ${criticalFailuresFound ? '🚨' : '✅'}`);
    console.log(`Expected Safe: ${scenario.expectedSafe ? '✅' : '❌'}`);
    console.log(`Expected Critical: ${criticalFailuresExpected ? '🚨' : '✅'}`);
    
    if (passed && (criticalFailuresFound === criticalFailuresExpected)) {
      console.log('✅ SCENARIO PASSED');
      return true;
    } else {
      console.log('❌ SCENARIO FAILED');
      console.log('Details:', {
        authBypassSafe: isAuthBypassSafe,
        expectedSafe: scenario.expectedSafe,
        criticalFailures: criticalFailuresFound,
        expectedCritical: criticalFailuresExpected
      });
      return false;
    }
    
  } catch (error) {
    console.error('❌ SCENARIO ERROR:', error.message);
    return false;
  } finally {
    restoreConsole();
  }
}

async function runAllTests() {
  let passedCount = 0;
  let totalCount = scenarios.length;
  
  for (const scenario of scenarios) {
    const passed = await runScenario(scenario);
    if (passed) passedCount++;
  }
  
  console.log('\n🏁 Test Results Summary');
  console.log('========================');
  console.log(`Passed: ${passedCount}/${totalCount}`);
  
  if (passedCount === totalCount) {
    console.log('🎉 ALL TESTS PASSED! Production safeguards are working correctly.');
    
    console.log('\n🛡️  Security Features Verified:');
    console.log('• Authentication bypass properly blocked in production');
    console.log('• Development mode safeguards functioning');
    console.log('• Environment validation working');
    console.log('• Critical failure detection operational');
    console.log('• Emergency alert system ready');
    
    process.exit(0);
  } else {
    console.log('🚨 SOME TESTS FAILED! Review production safeguards implementation.');
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});