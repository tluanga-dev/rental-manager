// Jest setup for performance testing framework

// Global test configuration
global.console = {
  ...console,
  // Reduce console noise during tests unless verbose
  log: process.env.VERBOSE_TESTS ? console.log : jest.fn(),
  debug: process.env.VERBOSE_TESTS ? console.debug : jest.fn(),
  info: process.env.VERBOSE_TESTS ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Performance testing globals
global.PERFORMANCE_TEST_CONFIG = {
  API_BASE_URL: process.env.API_URL || 'http://localhost:8000/api',
  FRONTEND_BASE_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  TEST_TIMEOUT: parseInt(process.env.TEST_TIMEOUT) || 600000,
  LOAD_TEST_SCALE: parseFloat(process.env.LOAD_TEST_SCALE) || 1.0,
  PERFORMANCE_THRESHOLD: process.env.PERFORMANCE_THRESHOLD || 'normal',
  ENABLE_SCREENSHOTS: process.env.ENABLE_SCREENSHOTS === 'true',
  HEADLESS_BROWSER: process.env.HEADLESS_BROWSER !== 'false'
};

// Mock implementations for unavailable services
if (!process.env.SKIP_MOCKS) {
  // Mock fetch for API calls when backend is not available
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: { id: 1, message: 'Mock response' }
      }),
    })
  );

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  global.localStorage = localStorageMock;

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  global.sessionStorage = sessionStorageMock;
}

// Performance monitoring utilities
global.performanceUtils = {
  markStart: (name) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${name}-start`);
    }
  },
  markEnd: (name) => {
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }
  },
  getDuration: (name) => {
    if (typeof performance !== 'undefined' && performance.getEntriesByName) {
      const measures = performance.getEntriesByName(name);
      return measures.length > 0 ? measures[0].duration : 0;
    }
    return 0;
  }
};

// Enhanced error handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Test environment setup
beforeAll(() => {
  // Set longer timeout for performance tests
  jest.setTimeout(global.PERFORMANCE_TEST_CONFIG.TEST_TIMEOUT);
});

afterEach(() => {
  // Clean up after each test
  if (global.gc) {
    global.gc();
  }
});

// Export for use in tests
module.exports = {
  PERFORMANCE_TEST_CONFIG: global.PERFORMANCE_TEST_CONFIG,
  performanceUtils: global.performanceUtils
};