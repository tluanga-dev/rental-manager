// Global setup for Puppeteer tests
console.log('Setting up Puppeteer tests...');
console.log('Backend API expected at: http://localhost:8000');
console.log('Frontend expected at: http://localhost:3000');

// Add any global configuration here
global.API_BASE_URL = 'http://localhost:8000/api/v1';
global.FRONTEND_URL = 'http://localhost:3000';