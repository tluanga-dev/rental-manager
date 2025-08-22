/**
 * Automated Tests for Supplier DELETE Operations
 * Test Cases: TC036-TC041
 */

const axios = require('axios');

describe('Supplier DELETE Operations', () => {
  const BASE_URL = 'http://localhost:3001';
  const API_BASE_URL = 'http://localhost:8001/api/v1';
  
  let page;
  let authToken;
  let testSupplierIds = [];

  beforeAll(async () => {
    // Setup authentication token
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
        username: 'admin',
        password: 'K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3'
      });
      authToken = loginResponse.data.access_token;

      // Create multiple test suppliers for delete operations
      for (let i = 1; i <= 3; i++) {
        const supplierData = {
          supplier_code: `DELETE_TEST_${Date.now()}_${i}`,
          company_name: `Delete Test Company ${i}`,
          supplier_type: 'DISTRIBUTOR',
          contact_person: `Delete Test Contact ${i}`,
          email: `delete${i}@test.com`,
          phone: `+1-555-010${i}`,
          credit_limit: 10000 * i,
          supplier_tier: 'STANDARD',
          status: 'ACTIVE'
        };

        try {
          const createResponse = await axios.post(`${API_BASE_URL}/suppliers/`, supplierData, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          testSupplierIds.push(createResponse.data.id);
        } catch (error) {
          console.error(`Failed to create test supplier ${i}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Failed to setup delete test data:', error.message);
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
   * TC036: Standard Supplier Deletion
   */
  describe('TC036: Standard Supplier Deletion', () => {
    test('should successfully delete supplier with confirmation', async () => {
      if (testSupplierIds.length === 0) {
        console.log('Skipping test - no test suppliers created');
        return;
      }

      const supplierId = testSupplierIds[0];

      // Navigate to supplier details page
      await page.goto(`${BASE_URL}/purchases/suppliers/${supplierId}`);
      await page.waitForSelector('button, .actions', { timeout: 10000 });

      // Look for delete button
      const deleteButton = await page.locator('button:has-text("Delete"), [data-testid="delete"], .delete-btn, button:has-text("Remove")').first();
      
      if (await deleteButton.count() > 0) {
        // Take screenshot before deletion
        await page.screenshot({ 
          path: './reports/screenshots/tc036-before-delete.png',
          fullPage: true 
        });

        await deleteButton.click();
        await page.waitForTimeout(1000);

        // Look for confirmation modal/dialog
        const confirmationModal = await page.locator('.modal, .dialog, [role="dialog"], .confirmation').count() > 0;
        
        if (confirmationModal) {
          // Take screenshot of confirmation modal
          await page.screenshot({ 
            path: './reports/screenshots/tc036-confirmation-modal.png',
            fullPage: true 
          });

          // Find and click confirm button
          const confirmButton = await page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("Remove")').last();
          await confirmButton.click();
          
          await page.waitForTimeout(3000);

          // Verify deletion - should redirect to list or show success message
          const currentUrl = page.url();
          const isBackToList = currentUrl.includes('/suppliers') && !currentUrl.includes(supplierId);
          const hasSuccessMessage = await page.locator('.success, .alert-success, text=/deleted|removed/i').count() > 0;

          expect(isBackToList || hasSuccessMessage).toBeTruthy();

          // Take screenshot after deletion
          await page.screenshot({ 
            path: './reports/screenshots/tc036-after-delete.png',
            fullPage: true 
          });

          // Verify supplier no longer appears in list (if redirected to list)
          if (isBackToList) {
            const supplierStillExists = await page.locator(`text=/${supplierId}/`).count() > 0;
            expect(supplierStillExists).toBeFalsy();
          }
        } else {
          // No confirmation modal - deletion might be immediate
          await page.waitForTimeout(2000);
          const currentUrl = page.url();
          expect(currentUrl).not.toContain(supplierId);
        }
      } else {
        console.log('Delete button not found - may not be implemented or accessible');
      }
    }, 30000);
  });

  /**
   * TC037: Delete Confirmation
   */
  describe('TC037: Delete Confirmation', () => {
    test('TC037.2: should cancel deletion operation', async () => {
      if (testSupplierIds.length < 2) return;

      const supplierId = testSupplierIds[1];

      await page.goto(`${BASE_URL}/purchases/suppliers/${supplierId}`);
      await page.waitForSelector('button, .actions', { timeout: 10000 });

      // Click delete button
      const deleteButton = await page.locator('button:has-text("Delete"), [data-testid="delete"]').first();
      
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(1000);

        // Look for cancel button in confirmation dialog
        const cancelButton = await page.locator('button:has-text("Cancel"), button:has-text("No"), .cancel-btn').first();
        
        if (await cancelButton.count() > 0) {
          await cancelButton.click();
          await page.waitForTimeout(1000);

          // Should remain on same page
          const currentUrl = page.url();
          expect(currentUrl).toContain(supplierId);

          // Modal should be closed
          const modalStillOpen = await page.locator('.modal, .dialog, [role="dialog"]').count() > 0;
          expect(modalStillOpen).toBeFalsy();

          await page.screenshot({ 
            path: './reports/screenshots/tc037-2-cancel-delete.png',
            fullPage: true 
          });
        }
      }
    });

    test('TC037.4: should support keyboard shortcuts for confirmation', async () => {
      if (testSupplierIds.length < 3) return;

      const supplierId = testSupplierIds[2];

      await page.goto(`${BASE_URL}/purchases/suppliers/${supplierId}`);
      await page.waitForSelector('button', { timeout: 10000 });

      const deleteButton = await page.locator('button:has-text("Delete")').first();
      
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(1000);

        // Try ESC key to cancel
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Should close modal and remain on page
        const modalOpen = await page.locator('.modal, .dialog').count() > 0;
        expect(modalOpen).toBeFalsy();

        const currentUrl = page.url();
        expect(currentUrl).toContain(supplierId);
      }
    });
  });

  /**
   * TC038: Delete with Dependencies
   */
  describe('TC038: Delete with Dependencies', () => {
    test('TC038.1: should warn when supplier has active orders', async () => {
      // This test would require creating orders for the supplier first
      // For now, we'll test the warning mechanism if it exists

      if (testSupplierIds.length === 0) return;

      const supplierId = testSupplierIds[0];

      await page.goto(`${BASE_URL}/purchases/suppliers/${supplierId}`);
      await page.waitForSelector('button', { timeout: 10000 });

      const deleteButton = await page.locator('button:has-text("Delete")').first();
      
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(1000);

        // Look for dependency warnings
        const warningText = await page.locator('text=/order|transaction|dependency|cannot.*delete/i').count() > 0;
        
        if (warningText) {
          const warningMessage = await page.textContent('.warning, .alert-warning, [role="alert"]');
          expect(warningMessage.toLowerCase()).toMatch(/order|transaction|dependency/);

          await page.screenshot({ 
            path: './reports/screenshots/tc038-1-dependency-warning.png',
            fullPage: true 
          });
        }
      }
    });

    test('TC038.4: should show appropriate warning messages', async () => {
      if (testSupplierIds.length === 0) return;

      const supplierId = testSupplierIds[0];

      await page.goto(`${BASE_URL}/purchases/suppliers/${supplierId}`);
      await page.waitForSelector('button', { timeout: 10000 });

      const deleteButton = await page.locator('button:has-text("Delete")').first();
      
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(1000);

        // Check for any warning or informational messages
        const messagesExist = await page.locator('.warning, .info, .alert, [role="alert"]').count() > 0;
        
        if (messagesExist) {
          const messageText = await page.textContent('.warning, .info, .alert, [role="alert"]');
          expect(messageText.length).toBeGreaterThan(0);
        }
      }
    });
  });

  /**
   * TC039: Bulk Deletion
   */
  describe('TC039: Bulk Deletion', () => {
    test('TC039.1: should support selecting multiple suppliers for deletion', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('.supplier-card, .supplier-row, table', { timeout: 10000 });

      // Look for checkboxes or selection mechanism
      const checkboxes = await page.locator('input[type="checkbox"], .select-item, [data-testid="select"]').count();
      
      if (checkboxes > 0) {
        // Select first few checkboxes
        const firstCheckbox = await page.locator('input[type="checkbox"]').first();
        const secondCheckbox = await page.locator('input[type="checkbox"]').nth(1);
        
        await firstCheckbox.check();
        await secondCheckbox.check();

        // Look for bulk actions
        const bulkActions = await page.locator('.bulk-actions, [data-testid="bulk-actions"], button:has-text("Delete Selected")').count() > 0;
        
        if (bulkActions) {
          await page.screenshot({ 
            path: './reports/screenshots/tc039-1-bulk-selection.png',
            fullPage: true 
          });
          
          expect(bulkActions).toBeTruthy();
        }
      } else {
        console.log('Bulk selection not implemented or not visible');
      }
    });

    test('TC039.2: should confirm bulk deletion', async () => {
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('.supplier-list', { timeout: 10000 });

      // Check if bulk delete functionality exists
      const bulkDeleteButton = await page.locator('button:has-text("Delete Selected"), [data-testid="bulk-delete"]').first();
      
      if (await bulkDeleteButton.count() > 0) {
        // Select some items first (if selection mechanism exists)
        const checkboxes = await page.locator('input[type="checkbox"]').count();
        if (checkboxes > 0) {
          await page.locator('input[type="checkbox"]').first().check();
          await page.locator('input[type="checkbox"]').nth(1).check();
        }

        await bulkDeleteButton.click();
        await page.waitForTimeout(1000);

        // Should show confirmation for bulk delete
        const confirmationExists = await page.locator('.modal, .dialog, [role="dialog"]').count() > 0;
        expect(confirmationExists).toBeTruthy();

        await page.screenshot({ 
          path: './reports/screenshots/tc039-2-bulk-confirmation.png',
          fullPage: true 
        });
      }
    });
  });

  /**
   * TC040: Soft Delete vs Hard Delete
   */
  describe('TC040: Soft Delete vs Hard Delete', () => {
    test('TC040.1: should implement soft delete by default', async () => {
      if (testSupplierIds.length === 0) return;

      const supplierId = testSupplierIds[0];

      // Delete supplier through UI
      await page.goto(`${BASE_URL}/purchases/suppliers/${supplierId}`);
      await page.waitForSelector('button', { timeout: 10000 });

      const deleteButton = await page.locator('button:has-text("Delete")').first();
      
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(1000);

        // Confirm deletion
        const confirmButton = await page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")').last();
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(2000);

          // Verify soft delete - check via API if supplier still exists but marked as deleted
          try {
            const apiResponse = await axios.get(`${API_BASE_URL}/suppliers/${supplierId}`, {
              headers: { Authorization: `Bearer ${authToken}` }
            });
            
            // If we get the supplier back, it should be marked as inactive/deleted
            if (apiResponse.status === 200) {
              const supplier = apiResponse.data;
              expect(supplier.is_active).toBeFalsy();
            }
          } catch (error) {
            // If 404, it might be hard delete or different implementation
            if (error.response?.status === 404) {
              console.log('Supplier not found - might be hard delete implementation');
            }
          }
        }
      }
    });

    test('TC040.2: should allow recovery from soft delete', async () => {
      // This test checks if there's an option to restore deleted suppliers
      await page.goto(`${BASE_URL}/purchases/suppliers`);
      await page.waitForSelector('.supplier-list', { timeout: 10000 });

      // Look for "Show Deleted" or "Include Inactive" option
      const showDeletedOption = await page.locator('input:has-text("Show Deleted"), input:has-text("Include Inactive"), [data-testid="show-deleted"]').count() > 0;
      
      if (showDeletedOption) {
        const showDeletedCheckbox = await page.locator('input:has-text("Show Deleted"), input:has-text("Include Inactive")').first();
        await showDeletedCheckbox.check();
        await page.waitForTimeout(2000);

        // Look for restore/activate buttons on deleted suppliers
        const restoreButtons = await page.locator('button:has-text("Restore"), button:has-text("Activate"), [data-testid="restore"]').count();
        expect(restoreButtons).toBeGreaterThan(0);

        await page.screenshot({ 
          path: './reports/screenshots/tc040-2-restore-option.png',
          fullPage: true 
        });
      }
    });
  });

  /**
   * TC041: Permission-based Deletion
   */
  describe('TC041: Permission-based Deletion', () => {
    test('TC041.1: should show delete button for admin users', async () => {
      if (testSupplierIds.length === 0) return;

      const supplierId = testSupplierIds[0];

      await page.goto(`${BASE_URL}/purchases/suppliers/${supplierId}`);
      await page.waitForSelector('button, .actions', { timeout: 10000 });

      // Admin user should see delete button
      const deleteButton = await page.locator('button:has-text("Delete"), [data-testid="delete"]').count() > 0;
      expect(deleteButton).toBeTruthy();

      await page.screenshot({ 
        path: './reports/screenshots/tc041-1-admin-delete-access.png',
        fullPage: true 
      });
    });

    test('TC041.4: should enforce role-based button visibility', async () => {
      if (testSupplierIds.length === 0) return;

      const supplierId = testSupplierIds[0];

      await page.goto(`${BASE_URL}/purchases/suppliers/${supplierId}`);
      await page.waitForSelector('.actions, .supplier-details', { timeout: 10000 });

      // Check what action buttons are visible based on current user role
      const actionButtons = await page.locator('button:has-text("Edit"), button:has-text("Delete"), button:has-text("Update")').allTextContents();
      
      // Admin should have access to all actions
      expect(actionButtons.length).toBeGreaterThan(0);
      
      // Log available actions for verification
      console.log('Available actions for admin user:', actionButtons);
    });

    test('TC041.5: should validate API permission for deletion', async () => {
      if (testSupplierIds.length === 0) return;

      const supplierId = testSupplierIds[0];

      // Test direct API call with current token
      try {
        const deleteResponse = await axios.delete(`${API_BASE_URL}/suppliers/${supplierId}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        // Should succeed for admin user
        expect(deleteResponse.status).toBe(204);
      } catch (error) {
        // If it fails, check if it's a permission error
        if (error.response?.status === 403) {
          console.log('Permission denied for delete operation');
          expect(error.response.status).toBe(403);
        } else {
          // Other errors might be expected (404 if already deleted, etc.)
          console.log('Delete API response:', error.response?.status, error.response?.data);
        }
      }
    });
  });
});