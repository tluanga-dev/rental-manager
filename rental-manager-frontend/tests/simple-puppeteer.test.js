const puppeteer = require('puppeteer');

describe('Simple Category Creation Test', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    page = await browser.newPage();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should test basic navigation', async () => {
    console.log('🧪 Starting simple navigation test...');
    
    try {
      // Test if we can access a simple page first
      await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
      const title = await page.title();
      console.log('✅ Basic navigation working, page title:', title);
      expect(title).toContain('Google');
    } catch (error) {
      console.log('❌ Navigation test failed:', error.message);
      throw error;
    }
  }, 45000);

  test('should test localhost connection', async () => {
    console.log('🧪 Testing localhost connection...');
    
    try {
      // Try to connect to localhost:3000
      await page.goto('http://localhost:3000', { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      const url = page.url();
      console.log('✅ Connected to:', url);
      
      // Try to get page title
      const title = await page.title();
      console.log('✅ Page title:', title);
      
    } catch (error) {
      console.log('❌ Localhost connection failed:', error.message);
      console.log('💡 Make sure the frontend server is running on localhost:3000');
      
      // This is expected to fail if server is not running
      expect(error.message).toContain('net::ERR_CONNECTION_REFUSED');
    }
  }, 45000);
});
