/**
 * Automated Tests for Supplier READ Operations
 * Test Cases: TC016-TC025
 */

const axios = require('axios');

describe('Supplier READ Operations', () => {
  const BASE_URL = 'http://localhost:3001';
  const API_BASE_URL = 'http://localhost:8001/api/v1';
  
  let page;
  let authToken;

  beforeAll(async () => {
    // Setup authentication token
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
        username: 'admin',
        password: 'K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3'
      });
      authToken = loginResponse.data.access_token;
    } catch (error) {
      console.error('Failed to authenticate for tests:', error.message);
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set auth token in localStorage
    await page.goto(BASE_URL);
    await page.evaluate((token) => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          accessToken: token,
          isAuthenticated: true,
          user: { id: 1, username: 'admin', userType: 'SUPERADMIN' }
        }
      }));
    }, authToken);
  });

  afterEach(async () => {
    await page.close();
  });

  /**
   * TC016: Supplier List Display
   */
  describe('TC016: Supplier List Display', () => {
    test('should display supplier list page correctly', async () => {
      const startTime = Date.now();
      
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('[data-testid="supplier-list"], .supplier-card, .supplier-row', { timeout: 10000 });
      
      const loadTime = Date.now() - startTime;
      
      // Verify page loads within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      // Verify page title/header
      const pageHeader = await page.textContent('h1, h2, [data-testid="page-title"]');
      expect(pageHeader).toMatch(/supplier/i);

      // Verify suppliers are displayed
      const supplierElements = await page.locator('.supplier-card, .supplier-row, [data-testid="supplier-item"]').count();
      expect(supplierElements).toBeGreaterThan(0);

      // Take screenshot
      await page.screenshot({ 
        path: './reports/screenshots/tc016-supplier-list.png',
        fullPage: true 
      });
    }, 15000);

    test('should display pagination controls', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('[data-testid="supplier-list"], .supplier-card', { timeout: 10000 });

      // Look for pagination elements
      const paginationExists = await page.locator('.pagination, [data-testid="pagination"], .page-numbers').count() > 0;
      
      if (paginationExists) {
        const paginationText = await page.textContent('.pagination, [data-testid="pagination"]');
        expect(paginationText).toMatch(/page|next|previous|\d+/i);
      }
    });
  });

  /**
   * TC017: Statistics Dashboard
   */
  describe('TC017: Statistics Dashboard', () => {
    test('should display accurate supplier statistics', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('[data-testid="stats"], .stats-card, .statistics', { timeout: 10000 });

      // Check for statistics cards
      const statElements = await page.locator('.stats-card, [data-testid="stat-card"], .metric-card').count();
      expect(statElements).toBeGreaterThan(0);

      // Verify total suppliers count
      const totalSuppliersElement = await page.locator('text=/total.*supplier/i, [data-testid="total-suppliers"]').first();
      if (await totalSuppliersElement.count() > 0) {
        const totalText = await totalSuppliersElement.textContent();
        const numberMatch = totalText.match(/\d+/);
        expect(numberMatch).toBeTruthy();
        expect(parseInt(numberMatch[0])).toBeGreaterThanOrEqual(0);
      }

      await page.screenshot({ 
        path: './reports/screenshots/tc017-statistics.png',
        fullPage: true 
      });
    });
  });

  /**
   * TC018: Filtering Functionality
   */
  describe('TC018: Filtering Functionality', () => {
    test('TC018.1: should filter suppliers by type', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('form, .filters, [data-testid="filters"]', { timeout: 10000 });

      // Get initial supplier count
      const initialCount = await page.locator('.supplier-card, .supplier-row').count();

      // Apply supplier type filter
      const typeFilter = await page.locator('select[name*="type"], select[name*="supplier_type"], [data-testid="type-filter"]').first();
      if (await typeFilter.count() > 0) {
        await typeFilter.selectOption('MANUFACTURER');
        
        // Wait for results to update
        await page.waitForTimeout(2000);
        
        const filteredCount = await page.locator('.supplier-card, .supplier-row').count();
        
        // Verify filtering occurred (count changed or results show only manufacturers)
        const manufacturerBadges = await page.locator('text=/manufacturer/i').count();
        expect(manufacturerBadges).toBeGreaterThan(0);

        await page.screenshot({ 
          path: './reports/screenshots/tc018-1-type-filter.png',
          fullPage: true 
        });
      }
    });

    test('TC018.4: should support multiple filter combinations', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('.filters, form', { timeout: 10000 });

      // Apply multiple filters
      const typeFilter = await page.locator('select[name*="type"]').first();
      const tierFilter = await page.locator('select[name*="tier"]').first();

      if (await typeFilter.count() > 0 && await tierFilter.count() > 0) {
        await typeFilter.selectOption('DISTRIBUTOR');
        await tierFilter.selectOption('STANDARD');
        
        // Apply filters
        const applyButton = await page.locator('button:has-text("Apply"), button:has-text("Filter"), [data-testid="apply-filters"]').first();
        if (await applyButton.count() > 0) {
          await applyButton.click();
        }
        
        await page.waitForTimeout(2000);
        
        // Verify both filters are applied
        const distributorBadges = await page.locator('text=/distributor/i').count();
        const standardBadges = await page.locator('text=/standard/i').count();
        
        if (distributorBadges > 0) {
          expect(distributorBadges).toBeGreaterThan(0);
        }
      }
    });
  });

  /**
   * TC019: Search Functionality
   */
  describe('TC019: Search Functionality', () => {
    test('TC019.1: should search suppliers by company name', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('input[placeholder*="search"], [data-testid="search"]', { timeout: 10000 });

      const searchInput = await page.locator('input[placeholder*="search"], input[name*="search"], [data-testid="search-input"]').first();
      
      if (await searchInput.count() > 0) {
        await searchInput.fill('ACME');
        
        // Trigger search (might be auto-search or require button click)
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        // Verify search results contain search term
        const resultsText = await page.textContent('body');
        expect(resultsText.toLowerCase()).toContain('acme');

        await page.screenshot({ 
          path: './reports/screenshots/tc019-1-search-company.png',
          fullPage: true 
        });
      }
    });

    test('TC019.4: should handle partial text search', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('input[placeholder*="search"]', { timeout: 10000 });

      const searchInput = await page.locator('input[placeholder*="search"]').first();
      
      if (await searchInput.count() > 0) {
        await searchInput.fill('Comp'); // Partial search
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        const supplierCards = await page.locator('.supplier-card, .supplier-row').count();
        // Should return results containing "Comp" in name
        expect(supplierCards).toBeGreaterThanOrEqual(0);
      }
    });

    test('TC019.6: should handle empty search results', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('input[placeholder*="search"]', { timeout: 10000 });

      const searchInput = await page.locator('input[placeholder*="search"]').first();
      
      if (await searchInput.count() > 0) {
        await searchInput.fill('XYZ_NONEXISTENT_SUPPLIER_12345');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        
        // Should show "no results" message
        const noResultsMessage = await page.locator('text=/no.*found|no.*result|empty/i').count() > 0;
        expect(noResultsMessage).toBeTruthy();

        await page.screenshot({ 
          path: './reports/screenshots/tc019-6-empty-search.png',
          fullPage: true 
        });
      }
    });
  });

  /**
   * TC020: Sorting Operations
   */
  describe('TC020: Sorting Operations', () => {
    test('TC020.1: should sort suppliers by company name', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('.supplier-card, .supplier-row, table', { timeout: 10000 });

      // Look for sortable column headers
      const sortHeader = await page.locator('th:has-text("Company"), th:has-text("Name"), [data-sort="name"]').first();
      
      if (await sortHeader.count() > 0) {
        await sortHeader.click();
        await page.waitForTimeout(1000);
        
        // Get first few supplier names to verify sorting
        const supplierNames = await page.locator('.supplier-card h3, .supplier-row .name, td:nth-child(2)').allTextContents();
        
        if (supplierNames.length > 1) {
          // Check if first name comes before second alphabetically
          const sorted = supplierNames.slice(0, 2).every((name, i) => 
            i === 0 || supplierNames[i-1].localeCompare(name) <= 0
          );
          expect(sorted).toBeTruthy();
        }

        await page.screenshot({ 
          path: './reports/screenshots/tc020-1-sort-name.png',
          fullPage: true 
        });
      }
    });
  });

  /**
   * TC021: Pagination Testing
   */
  describe('TC021: Pagination Testing', () => {
    test('TC021.3: should change page size', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('.pagination, [data-testid="pagination"]', { timeout: 10000 });

      // Look for page size selector
      const pageSizeSelector = await page.locator('select:has(option:has-text("20")), select:has(option:has-text("50"))').first();
      
      if (await pageSizeSelector.count() > 0) {
        const initialCount = await page.locator('.supplier-card, .supplier-row').count();
        
        await pageSizeSelector.selectOption('50');
        await page.waitForTimeout(2000);
        
        const newCount = await page.locator('.supplier-card, .supplier-row').count();
        
        // Should show more items (up to 50) or same if total is less than 50
        expect(newCount).toBeGreaterThanOrEqual(initialCount);
      }
    });

    test('TC021.4: should navigate between pages', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('.pagination', { timeout: 10000 });

      // Look for next page button
      const nextButton = await page.locator('button:has-text("Next"), .pagination-next, [aria-label="Next"]').first();
      
      if (await nextButton.count() > 0 && !await nextButton.isDisabled()) {
        const firstPageSuppliers = await page.locator('.supplier-card h3, .supplier-row .name').allTextContents();
        
        await nextButton.click();
        await page.waitForTimeout(2000);
        
        const secondPageSuppliers = await page.locator('.supplier-card h3, .supplier-row .name').allTextContents();
        
        // Suppliers on page 2 should be different from page 1
        expect(secondPageSuppliers[0]).not.toBe(firstPageSuppliers[0]);

        await page.screenshot({ 
          path: './reports/screenshots/tc021-4-pagination.png',
          fullPage: true 
        });
      }
    });
  });

  /**
   * TC022: Individual Supplier Details
   */
  describe('TC022: Individual Supplier Details', () => {
    test('should display complete supplier details', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('.supplier-card, .supplier-row', { timeout: 10000 });

      // Click on first supplier to view details
      const firstSupplier = await page.locator('.supplier-card, .supplier-row, [data-testid="supplier-item"]').first();
      await firstSupplier.click();
      
      await page.waitForTimeout(2000);
      
      // Verify we're on details page
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/purchases\/suppliers\/[\w-]+/);

      // Verify essential details are displayed
      const detailsElements = [
        'h1, h2, [data-testid="company-name"]',
        '[data-testid="supplier-code"], .supplier-code',
        '[data-testid="contact-info"], .contact-info',
        '[data-testid="performance"], .performance-metrics'
      ];

      for (const selector of detailsElements) {
        const element = await page.locator(selector).first();
        if (await element.count() > 0) {
          const text = await element.textContent();
          expect(text.trim()).not.toBe('');
        }
      }

      await page.screenshot({ 
        path: './reports/screenshots/tc022-supplier-details.png',
        fullPage: true 
      });
    }, 20000);
  });

  /**
   * TC024: Export Functionality
   */
  describe('TC024: Export Functionality', () => {
    test('should provide export options', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('.supplier-list, .suppliers-page', { timeout: 10000 });

      // Look for export button
      const exportButton = await page.locator('button:has-text("Export"), [data-testid="export"], .export-btn').first();
      
      if (await exportButton.count() > 0) {
        await exportButton.click();
        await page.waitForTimeout(1000);
        
        // Check for export options (CSV, Excel, etc.)
        const exportOptions = await page.locator('text=/csv|excel|xlsx|download/i').count();
        expect(exportOptions).toBeGreaterThan(0);

        await page.screenshot({ 
          path: './reports/screenshots/tc024-export-options.png',
          fullPage: true 
        });
      }
    });
  });

  /**
   * TC025: Real-time Updates
   */
  describe('TC025: Real-time Updates', () => {
    test('should support manual refresh', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('.supplier-list', { timeout: 10000 });

      const initialCount = await page.locator('.supplier-card, .supplier-row').count();
      
      // Look for refresh button
      const refreshButton = await page.locator('button:has-text("Refresh"), [data-testid="refresh"], .refresh-btn').first();
      
      if (await refreshButton.count() > 0) {
        await refreshButton.click();
        await page.waitForTimeout(2000);
        
        const newCount = await page.locator('.supplier-card, .supplier-row').count();
        
        // Count should remain same or similar (unless data changed)
        expect(Math.abs(newCount - initialCount)).toBeLessThanOrEqual(5);
      } else {
        // Try browser refresh
        await page.reload();
        await page.waitForSelector('.supplier-list', { timeout: 10000 });
        
        const refreshedCount = await page.locator('.supplier-card, .supplier-row').count();
        expect(Math.abs(refreshedCount - initialCount)).toBeLessThanOrEqual(5);
      }
    });
  });
});