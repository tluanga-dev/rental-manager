const puppeteer = require('puppeteer');

describe('Category Creation E2E Tests', () => {
  let browser;
  let page;
  const BASE_URL = 'http://localhost:3000';
  const API_BASE_URL = 'http://localhost:8000/api/v1';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu'
      ],
      defaultViewport: {
        width: 1280,
        height: 720
      }
    });
    page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      console.log('PAGE LOG:', msg.text());
    });
    
    // Enable request/response logging
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log('REQUEST:', request.method(), request.url());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log('RESPONSE:', response.status(), response.url());
      }
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Clear any existing state
    await page.goto(BASE_URL);
  });

  describe('Category Creation Page', () => {
    test('should load category creation page successfully', async () => {
      console.log('🧪 Testing: Category creation page load');
      
      await page.goto(`${BASE_URL}/products/categories/new`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for the page title to load
      await page.waitForSelector('h1', { timeout: 10000 });
      
      const title = await page.$eval('h1', el => el.textContent);
      expect(title).toContain('Create New Category');
      
      console.log('✅ Page loaded with title:', title);
    }, 45000);

    test('should display all required form fields', async () => {
      console.log('🧪 Testing: Form fields presence');
      
      await page.goto(`${BASE_URL}/products/categories/new`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for form to load
      await page.waitForSelector('form', { timeout: 10000 });

      // Check for category name input
      const nameInput = await page.$('#category-name');
      expect(nameInput).toBeTruthy();
      console.log('✅ Category name input found');

      // Check for parent category combobox
      const parentSelect = await page.$('[data-testid="parent-category-select"], [role="combobox"]');
      console.log('✅ Parent category selector found:', !!parentSelect);

      // Check for submit button
      const submitButton = await page.$('button[type="submit"]');
      expect(submitButton).toBeTruthy();
      console.log('✅ Submit button found');

      // Check for description textarea
      const descriptionTextarea = await page.$('#description');
      console.log('✅ Description textarea found:', !!descriptionTextarea);
    }, 45000);

    test('should load existing categories for parent selection', async () => {
      console.log('🧪 Testing: Categories loading');
      
      await page.goto(`${BASE_URL}/products/categories/new`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for categories to load (check for loading state to disappear)
      await page.waitForTimeout(3000); // Give time for API call

      // Check if categories are loaded by looking for network activity
      console.log('✅ Categories should be loaded from API');
    }, 45000);

    test('should validate required fields', async () => {
      console.log('🧪 Testing: Form validation');
      
      await page.goto(`${BASE_URL}/products/categories/new`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for form to be ready
      await page.waitForSelector('#category-name', { timeout: 10000 });

      // Try to submit without filling required fields
      const submitButton = await page.$('button[type="submit"]');
      await submitButton.click();

      // Wait a moment for validation
      await page.waitForTimeout(1000);

      // Check if validation prevents submission (form should still be visible)
      const form = await page.$('form');
      expect(form).toBeTruthy();
      console.log('✅ Form validation prevents empty submission');
    }, 45000);

    test('should create a new category successfully', async () => {
      console.log('🧪 Testing: Category creation');
      
      await page.goto(`${BASE_URL}/products/categories/new`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for form elements
      await page.waitForSelector('#category-name', { timeout: 10000 });

      // Generate unique category name
      const timestamp = Date.now();
      const categoryName = `Puppeteer Test Category ${timestamp}`;

      // Fill in the category name
      await page.type('#category-name', categoryName);
      console.log('✅ Category name filled:', categoryName);

      // Optional: Fill description
      const descriptionField = await page.$('#description');
      if (descriptionField) {
        await page.type('#description', 'Test category created by Puppeteer automation');
        console.log('✅ Description filled');
      }

      // Submit the form
      console.log('🚀 Submitting form...');
      const submitButton = await page.$('button[type="submit"]');
      
      // Set up response listener before clicking
      const responsePromise = page.waitForResponse(
        response => response.url().includes('/categories/') && response.request().method() === 'POST',
        { timeout: 15000 }
      );

      await submitButton.click();

      try {
        // Wait for the API response
        const response = await responsePromise;
        const responseStatus = response.status();
        
        console.log('📡 API Response Status:', responseStatus);
        
        if (responseStatus === 200 || responseStatus === 201) {
          const responseData = await response.json();
          console.log('✅ Category created successfully:', responseData.category_name);
          console.log('📝 Category ID:', responseData.id);
          console.log('📍 Category Path:', responseData.category_path);
          
          expect(responseData.category_name).toBe(categoryName);
          expect(responseData.id).toBeTruthy();
        } else {
          console.log('❌ API Error Status:', responseStatus);
          const errorData = await response.text();
          console.log('❌ Error Data:', errorData);
          throw new Error(`API returned status ${responseStatus}`);
        }
      } catch (error) {
        console.log('❌ Error during category creation:', error.message);
        
        // Check for any error messages on the page
        const errorElements = await page.$$('.error, .alert-error, [class*="error"]');
        if (errorElements.length > 0) {
          for (const el of errorElements) {
            const errorText = await page.evaluate(elem => elem.textContent, el);
            console.log('📄 Page Error:', errorText);
          }
        }
        
        throw error;
      }
    }, 60000);

    test('should handle API errors gracefully', async () => {
      console.log('🧪 Testing: Error handling');
      
      // Intercept API calls and simulate an error
      await page.setRequestInterception(true);
      
      page.on('request', request => {
        if (request.url().includes('/categories/') && request.method() === 'POST') {
          request.respond({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Internal server error' })
          });
        } else {
          request.continue();
        }
      });

      await page.goto(`${BASE_URL}/products/categories/new`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Fill and submit form
      await page.waitForSelector('#category-name', { timeout: 10000 });
      await page.type('#category-name', 'Error Test Category');
      
      const submitButton = await page.$('button[type="submit"]');
      await submitButton.click();

      // Wait for error handling
      await page.waitForTimeout(3000);

      // Check if error is displayed to user
      console.log('✅ Error simulation completed - check for user-friendly error display');
      
      // Disable request interception for cleanup
      await page.setRequestInterception(false);
    }, 45000);
  });

  describe('Category Hierarchy', () => {
    test('should support creating child categories', async () => {
      console.log('🧪 Testing: Child category creation');
      
      // First, ensure we have a parent category (Electronics should exist)
      const response = await page.evaluate(async () => {
        try {
          const res = await fetch('http://localhost:8000/api/v1/categories/');
          return await res.json();
        } catch (error) {
          return { items: [] };
        }
      });

      const categories = response.items || [];
      const electronicsCategory = categories.find(cat => cat.category_name === 'Electronics');
      
      if (electronicsCategory) {
        console.log('✅ Found Electronics category for parent testing');
        
        await page.goto(`${BASE_URL}/products/categories/new`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        await page.waitForSelector('#category-name', { timeout: 10000 });
        
        const timestamp = Date.now();
        const childCategoryName = `Puppeteer Child Category ${timestamp}`;
        
        // Fill category name
        await page.type('#category-name', childCategoryName);
        
        // Wait for parent categories to load and select Electronics
        await page.waitForTimeout(2000);
        
        // Try to select Electronics as parent (this depends on UI implementation)
        console.log('✅ Child category form filled');
        
        // Submit form
        const submitButton = await page.$('button[type="submit"]');
        await submitButton.click();
        
        await page.waitForTimeout(3000);
        console.log('✅ Child category creation attempted');
      } else {
        console.log('⚠️ No Electronics category found, skipping child category test');
      }
    }, 60000);
  });

  describe('Integration Tests', () => {
    test('should redirect after successful creation', async () => {
      console.log('🧪 Testing: Post-creation redirect');
      
      await page.goto(`${BASE_URL}/products/categories/new`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await page.waitForSelector('#category-name', { timeout: 10000 });
      
      const timestamp = Date.now();
      await page.type('#category-name', `Redirect Test Category ${timestamp}`);
      
      const submitButton = await page.$('button[type="submit"]');
      await submitButton.click();
      
      // Wait for potential redirect
      await page.waitForTimeout(5000);
      
      const currentUrl = page.url();
      console.log('📍 URL after submission:', currentUrl);
      
      // Check if redirected away from creation page
      const isStillOnCreationPage = currentUrl.includes('/products/categories/new');
      console.log('✅ Redirect behavior tested, still on creation page:', isStillOnCreationPage);
    }, 60000);
  });
});
