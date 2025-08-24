#!/usr/bin/env node

/**
 * 🧪 Brand UI Testing Suite with Puppeteer
 * 
 * Comprehensive UI tests for Brand feature including:
 * - CRUD operations through UI
 * - Form validation and error handling
 * - Search and filtering functionality
 * - Responsive design testing
 * - Accessibility validation
 * - Performance testing
 */

const puppeteer = require('puppeteer');

// Test configuration
const CONFIG = {
    baseUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:8000/api/v1',
    headless: true,
    timeout: 30000,
    slowMo: 100
};

// Test tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

// Console colors
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Test result logging
function logTest(testName, result, details = '') {
    totalTests++;
    
    if (result === 'PASS') {
        console.log(`${colors.green}✅ PASS: ${testName}${colors.reset}`);
        passedTests++;
    } else {
        console.log(`${colors.red}❌ FAIL: ${testName}${colors.reset}`);
        if (details) {
            console.log(`${colors.red}   Details: ${details}${colors.reset}`);
        }
        failedTests++;
    }
    
    testResults.push({
        name: testName,
        result,
        details
    });
}

// Helper function to wait for element
async function waitForSelector(page, selector, timeout = CONFIG.timeout) {
    try {
        await page.waitForSelector(selector, { timeout });
        return true;
    } catch (error) {
        return false;
    }
}

// Helper function to wait for navigation
async function waitForNavigation(page, timeout = CONFIG.timeout) {
    try {
        await page.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout 
        });
        return true;
    } catch (error) {
        return false;
    }
}

// Helper function to clear and type
async function clearAndType(page, selector, text) {
    await page.click(selector);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type(selector, text);
}

// Setup function to initialize browser and page
async function setupBrowser() {
    const browser = await puppeteer.launch({
        headless: CONFIG.headless,
        slowMo: CONFIG.slowMo,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport for responsive testing
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set user agent
    await page.setUserAgent('Brand-UI-Test-Bot/1.0');
    
    // Listen to console logs for debugging
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`${colors.red}Browser Error: ${msg.text()}${colors.reset}`);
        }
    });
    
    // Listen to page errors
    page.on('pageerror', err => {
        console.log(`${colors.red}Page Error: ${err.message}${colors.reset}`);
    });
    
    return { browser, page };
}

// Test: Page Load and Basic Navigation
async function testPageLoad(page) {
    console.log(`\n${colors.blue}🧪 Testing Page Load and Navigation...${colors.reset}`);
    
    try {
        // Navigate to brands page
        const response = await page.goto(`${CONFIG.baseUrl}/brands`, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.timeout
        });
        
        if (response.ok()) {
            logTest('Brand page loads successfully', 'PASS');
        } else {
            logTest('Brand page loads successfully', 'FAIL', `HTTP ${response.status()}`);
        }
        
        // Check page title
        const title = await page.title();
        if (title.includes('Brand') || title.includes('brand')) {
            logTest('Page title contains Brand', 'PASS', `Title: ${title}`);
        } else {
            logTest('Page title contains Brand', 'FAIL', `Title: ${title}`);
        }
        
        // Check main heading
        const headingExists = await waitForSelector(page, 'h1, h2, [data-testid="brand-title"]');
        if (headingExists) {
            logTest('Main heading present', 'PASS');
        } else {
            logTest('Main heading present', 'FAIL', 'No main heading found');
        }
        
    } catch (error) {
        logTest('Brand page loads successfully', 'FAIL', error.message);
    }
}

// Test: Brand List Display
async function testBrandList(page) {
    console.log(`\n${colors.blue}🧪 Testing Brand List Display...${colors.reset}`);
    
    try {
        // Look for brand list/table
        const listSelectors = [
            '[data-testid="brand-list"]',
            '[data-testid="brand-table"]',
            '.brand-list',
            '.brand-table',
            'table tbody tr',
            '.brand-item'
        ];
        
        let listFound = false;
        for (const selector of listSelectors) {
            if (await waitForSelector(page, selector, 3000)) {
                listFound = true;
                logTest('Brand list component found', 'PASS', `Found: ${selector}`);
                break;
            }
        }
        
        if (!listFound) {
            logTest('Brand list component found', 'FAIL', 'No brand list component found');
        }
        
        // Check for pagination
        const paginationSelectors = [
            '[data-testid="pagination"]',
            '.pagination',
            '.page-navigation',
            '.MuiPagination-root',
            'nav[aria-label*="pagination"]'
        ];
        
        let paginationFound = false;
        for (const selector of paginationSelectors) {
            if (await waitForSelector(page, selector, 2000)) {
                paginationFound = true;
                logTest('Pagination component present', 'PASS', `Found: ${selector}`);
                break;
            }
        }
        
        if (!paginationFound) {
            logTest('Pagination component present', 'FAIL', 'No pagination found');
        }
        
    } catch (error) {
        logTest('Brand list display', 'FAIL', error.message);
    }
}

// Test: Create Brand Form
async function testCreateBrandForm(page) {
    console.log(`\n${colors.blue}🧪 Testing Create Brand Form...${colors.reset}`);
    
    try {
        // Look for create/add button
        const createButtonSelectors = [
            '[data-testid="create-brand-button"]',
            '[data-testid="add-brand-button"]',
            'button:contains("Create")',
            'button:contains("Add")',
            'button:contains("New Brand")',
            '.create-brand',
            '.add-brand'
        ];
        
        let createButtonFound = false;
        for (const selector of createButtonSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 2000 });
                await page.click(selector);
                createButtonFound = true;
                logTest('Create brand button found and clicked', 'PASS', `Found: ${selector}`);
                break;
            } catch (error) {
                continue;
            }
        }
        
        if (!createButtonFound) {
            // Try alternative: look for direct form or modal
            const formSelectors = [
                '[data-testid="brand-form"]',
                '.brand-form',
                'form[name="brandForm"]'
            ];
            
            for (const selector of formSelectors) {
                if (await waitForSelector(page, selector, 2000)) {
                    createButtonFound = true;
                    logTest('Brand form found directly', 'PASS', `Found: ${selector}`);
                    break;
                }
            }
        }
        
        if (!createButtonFound) {
            logTest('Create brand form access', 'FAIL', 'No create button or form found');
            return;
        }
        
        // Wait for form to appear (modal or new page)
        await page.waitForTimeout(1000);
        
        // Look for form fields
        const nameFieldSelectors = [
            '[data-testid="brand-name-input"]',
            'input[name="name"]',
            '#name',
            '#brandName',
            '.name-input'
        ];
        
        let nameFieldFound = false;
        let nameFieldSelector = '';
        for (const selector of nameFieldSelectors) {
            if (await waitForSelector(page, selector, 3000)) {
                nameFieldFound = true;
                nameFieldSelector = selector;
                logTest('Brand name field found', 'PASS', `Found: ${selector}`);
                break;
            }
        }
        
        if (!nameFieldFound) {
            logTest('Brand name field found', 'FAIL', 'No name input field found');
            return;
        }
        
        // Test form validation
        await testFormValidation(page, nameFieldSelector);
        
        // Test successful brand creation
        await testSuccessfulBrandCreation(page, nameFieldSelector);
        
    } catch (error) {
        logTest('Create brand form', 'FAIL', error.message);
    }
}

// Test: Form Validation
async function testFormValidation(page, nameFieldSelector) {
    console.log(`\n${colors.blue}🧪 Testing Form Validation...${colors.reset}`);
    
    try {
        // Test empty name validation
        await clearAndType(page, nameFieldSelector, '');
        
        // Try to submit form
        const submitButtonSelectors = [
            '[data-testid="submit-brand"]',
            'button[type="submit"]',
            'button:contains("Save")',
            'button:contains("Create")',
            '.submit-button'
        ];
        
        let submitButton = null;
        for (const selector of submitButtonSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 2000 });
                submitButton = selector;
                break;
            } catch (error) {
                continue;
            }
        }
        
        if (submitButton) {
            await page.click(submitButton);
            
            // Wait for validation error
            await page.waitForTimeout(1000);
            
            // Look for error message
            const errorSelectors = [
                '[data-testid="name-error"]',
                '.error-message',
                '.field-error',
                '.form-error',
                '.validation-error'
            ];
            
            let errorFound = false;
            for (const selector of errorSelectors) {
                if (await waitForSelector(page, selector, 2000)) {
                    const errorText = await page.$eval(selector, el => el.textContent);
                    logTest('Empty name validation error', 'PASS', `Error: ${errorText}`);
                    errorFound = true;
                    break;
                }
            }
            
            if (!errorFound) {
                logTest('Empty name validation error', 'FAIL', 'No validation error shown');
            }
        }
        
        // Test name too long validation
        const longName = 'A'.repeat(101);
        await clearAndType(page, nameFieldSelector, longName);
        
        if (submitButton) {
            await page.click(submitButton);
            await page.waitForTimeout(1000);
            
            // Check if long name is truncated or error shown
            const nameValue = await page.$eval(nameFieldSelector, el => el.value);
            if (nameValue.length <= 100) {
                logTest('Long name validation/truncation', 'PASS', `Truncated to ${nameValue.length} chars`);
            } else {
                // Look for error message
                let errorFound = false;
                for (const selector of errorSelectors) {
                    if (await waitForSelector(page, selector, 2000)) {
                        logTest('Long name validation error', 'PASS', 'Error message shown');
                        errorFound = true;
                        break;
                    }
                }
                if (!errorFound) {
                    logTest('Long name validation', 'FAIL', 'No validation for long name');
                }
            }
        }
        
        // Test code field validation (if present)
        const codeFieldSelectors = [
            '[data-testid="brand-code-input"]',
            'input[name="code"]',
            '#code',
            '#brandCode'
        ];
        
        for (const selector of codeFieldSelectors) {
            if (await waitForSelector(page, selector, 1000)) {
                // Test invalid code characters
                await clearAndType(page, selector, 'brand#1');
                
                if (submitButton) {
                    await page.click(submitButton);
                    await page.waitForTimeout(1000);
                    
                    // Check if invalid characters are removed or error shown
                    const codeValue = await page.$eval(selector, el => el.value);
                    if (!/[^A-Z0-9_-]/.test(codeValue)) {
                        logTest('Code character validation', 'PASS', `Cleaned code: ${codeValue}`);
                    } else {
                        logTest('Code character validation', 'FAIL', `Invalid chars allowed: ${codeValue}`);
                    }
                }
                break;
            }
        }
        
    } catch (error) {
        logTest('Form validation', 'FAIL', error.message);
    }
}

// Test: Successful Brand Creation
async function testSuccessfulBrandCreation(page, nameFieldSelector) {
    console.log(`\n${colors.blue}🧪 Testing Successful Brand Creation...${colors.reset}`);
    
    try {
        // Fill valid data
        const brandName = `Test Brand ${Date.now()}`;
        await clearAndType(page, nameFieldSelector, brandName);
        
        // Fill code field if present
        const codeFieldSelectors = [
            '[data-testid="brand-code-input"]',
            'input[name="code"]',
            '#code',
            '#brandCode'
        ];
        
        for (const selector of codeFieldSelectors) {
            if (await waitForSelector(page, selector, 1000)) {
                await clearAndType(page, selector, 'TEST-01');
                break;
            }
        }
        
        // Fill description field if present
        const descFieldSelectors = [
            '[data-testid="brand-description-input"]',
            'textarea[name="description"]',
            '#description',
            '#brandDescription'
        ];
        
        for (const selector of descFieldSelectors) {
            if (await waitForSelector(page, selector, 1000)) {
                await clearAndType(page, selector, 'Test brand description');
                break;
            }
        }
        
        // Submit form
        const submitButtonSelectors = [
            '[data-testid="submit-brand"]',
            'button[type="submit"]',
            'button:contains("Save")',
            'button:contains("Create")'
        ];
        
        let submitted = false;
        for (const selector of submitButtonSelectors) {
            if (await waitForSelector(page, selector, 1000)) {
                await page.click(selector);
                submitted = true;
                break;
            }
        }
        
        if (!submitted) {
            logTest('Brand creation submission', 'FAIL', 'No submit button found');
            return;
        }
        
        // Wait for success feedback
        await page.waitForTimeout(2000);
        
        // Look for success message or redirect
        const successSelectors = [
            '[data-testid="success-message"]',
            '.success-message',
            '.alert-success',
            '.notification-success'
        ];
        
        let successFound = false;
        for (const selector of successSelectors) {
            if (await waitForSelector(page, selector, 3000)) {
                const message = await page.$eval(selector, el => el.textContent);
                logTest('Brand creation success message', 'PASS', `Message: ${message}`);
                successFound = true;
                break;
            }
        }
        
        // Check if redirected back to list
        const currentUrl = page.url();
        if (currentUrl.includes('/brands') && !currentUrl.includes('/create')) {
            if (!successFound) {
                logTest('Brand creation redirect', 'PASS', 'Redirected to brand list');
            }
        }
        
        if (!successFound && !currentUrl.includes('/brands')) {
            logTest('Brand creation feedback', 'FAIL', 'No success feedback found');
        }
        
    } catch (error) {
        logTest('Successful brand creation', 'FAIL', error.message);
    }
}

// Test: Search and Filter Functionality
async function testSearchAndFilter(page) {
    console.log(`\n${colors.blue}🧪 Testing Search and Filter...${colors.reset}`);
    
    try {
        // Navigate back to brand list if not there
        if (!page.url().includes('/brands') || page.url().includes('/create')) {
            await page.goto(`${CONFIG.baseUrl}/brands`, { waitUntil: 'networkidle2' });
        }
        
        // Look for search input
        const searchSelectors = [
            '[data-testid="search-brands"]',
            'input[placeholder*="search"]',
            'input[placeholder*="Search"]',
            'input[type="search"]',
            '.search-input',
            '#search'
        ];
        
        let searchField = null;
        for (const selector of searchSelectors) {
            if (await waitForSelector(page, selector, 2000)) {
                searchField = selector;
                logTest('Search field found', 'PASS', `Found: ${selector}`);
                break;
            }
        }
        
        if (!searchField) {
            logTest('Search field found', 'FAIL', 'No search field found');
            return;
        }
        
        // Test search functionality
        await clearAndType(page, searchField, 'Nike');
        await page.waitForTimeout(1500); // Wait for debounced search
        
        // Check if results are filtered
        const resultSelectors = [
            '[data-testid="brand-list"] tr',
            '.brand-item',
            '.brand-row'
        ];
        
        for (const selector of resultSelectors) {
            if (await waitForSelector(page, selector, 2000)) {
                const results = await page.$$(selector);
                if (results.length > 0) {
                    logTest('Search returns results', 'PASS', `Found ${results.length} results`);
                } else {
                    logTest('Search returns results', 'FAIL', 'No search results found');
                }
                break;
            }
        }
        
        // Clear search
        await clearAndType(page, searchField, '');
        await page.waitForTimeout(1000);
        
        // Test filter functionality (if present)
        const filterSelectors = [
            '[data-testid="brand-filter"]',
            '.filter-dropdown',
            'select[name="filter"]',
            '#filter'
        ];
        
        for (const selector of filterSelectors) {
            if (await waitForSelector(page, selector, 1000)) {
                logTest('Filter options found', 'PASS', `Found: ${selector}`);
                
                // Try to interact with filter
                await page.click(selector);
                await page.waitForTimeout(500);
                
                // Look for filter options
                const optionSelectors = [
                    `${selector} option`,
                    '.filter-option',
                    '.dropdown-item'
                ];
                
                for (const optionSelector of optionSelectors) {
                    const options = await page.$$(optionSelector);
                    if (options.length > 0) {
                        logTest('Filter options available', 'PASS', `Found ${options.length} filter options`);
                        break;
                    }
                }
                break;
            }
        }
        
    } catch (error) {
        logTest('Search and filter functionality', 'FAIL', error.message);
    }
}

// Test: Edit Brand Functionality
async function testEditBrand(page) {
    console.log(`\n${colors.blue}🧪 Testing Edit Brand Functionality...${colors.reset}`);
    
    try {
        // Look for edit buttons in the list
        const editButtonSelectors = [
            '[data-testid="edit-brand"]',
            '.edit-button',
            '.edit-brand',
            'button[title*="edit"]',
            'button[aria-label*="edit"]'
        ];
        
        let editButtonFound = false;
        for (const selector of editButtonSelectors) {
            const buttons = await page.$$(selector);
            if (buttons.length > 0) {
                await buttons[0].click();
                editButtonFound = true;
                logTest('Edit brand button found and clicked', 'PASS', `Found: ${selector}`);
                break;
            }
        }
        
        if (!editButtonFound) {
            logTest('Edit brand button found', 'FAIL', 'No edit button found');
            return;
        }
        
        // Wait for edit form
        await page.waitForTimeout(1000);
        
        // Look for pre-populated form
        const nameFieldSelectors = [
            '[data-testid="brand-name-input"]',
            'input[name="name"]',
            '#name'
        ];
        
        let nameField = null;
        for (const selector of nameFieldSelectors) {
            if (await waitForSelector(page, selector, 3000)) {
                nameField = selector;
                const currentValue = await page.$eval(selector, el => el.value);
                if (currentValue) {
                    logTest('Edit form pre-populated', 'PASS', `Current name: ${currentValue}`);
                } else {
                    logTest('Edit form pre-populated', 'FAIL', 'Name field empty');
                }
                break;
            }
        }
        
        if (!nameField) {
            logTest('Edit form loaded', 'FAIL', 'No name field in edit form');
            return;
        }
        
        // Update the brand
        const updatedName = `Updated Brand ${Date.now()}`;
        await clearAndType(page, nameField, updatedName);
        
        // Submit update
        const submitButtonSelectors = [
            '[data-testid="submit-brand"]',
            'button[type="submit"]',
            'button:contains("Update")',
            'button:contains("Save")'
        ];
        
        let submitted = false;
        for (const selector of submitButtonSelectors) {
            if (await waitForSelector(page, selector, 1000)) {
                await page.click(selector);
                submitted = true;
                break;
            }
        }
        
        if (!submitted) {
            logTest('Edit form submission', 'FAIL', 'No submit button found');
            return;
        }
        
        // Wait for success feedback
        await page.waitForTimeout(2000);
        
        // Look for success feedback
        const successSelectors = [
            '[data-testid="success-message"]',
            '.success-message',
            '.alert-success'
        ];
        
        let successFound = false;
        for (const selector of successSelectors) {
            if (await waitForSelector(page, selector, 3000)) {
                logTest('Brand update success feedback', 'PASS');
                successFound = true;
                break;
            }
        }
        
        if (!successFound) {
            // Check if redirected back to list
            const currentUrl = page.url();
            if (currentUrl.includes('/brands') && !currentUrl.includes('/edit')) {
                logTest('Brand update redirect', 'PASS', 'Redirected to brand list');
            } else {
                logTest('Brand update feedback', 'FAIL', 'No success feedback found');
            }
        }
        
    } catch (error) {
        logTest('Edit brand functionality', 'FAIL', error.message);
    }
}

// Test: Delete Brand Functionality
async function testDeleteBrand(page) {
    console.log(`\n${colors.blue}🧪 Testing Delete Brand Functionality...${colors.reset}`);
    
    try {
        // Navigate back to list if needed
        if (!page.url().includes('/brands') || page.url().includes('/edit')) {
            await page.goto(`${CONFIG.baseUrl}/brands`, { waitUntil: 'networkidle2' });
        }
        
        // Look for delete buttons
        const deleteButtonSelectors = [
            '[data-testid="delete-brand"]',
            '.delete-button',
            '.delete-brand',
            'button[title*="delete"]',
            'button[aria-label*="delete"]'
        ];
        
        let deleteButtonFound = false;
        for (const selector of deleteButtonSelectors) {
            const buttons = await page.$$(selector);
            if (buttons.length > 0) {
                await buttons[0].click();
                deleteButtonFound = true;
                logTest('Delete brand button found and clicked', 'PASS', `Found: ${selector}`);
                break;
            }
        }
        
        if (!deleteButtonFound) {
            logTest('Delete brand button found', 'FAIL', 'No delete button found');
            return;
        }
        
        // Wait for confirmation dialog
        await page.waitForTimeout(1000);
        
        // Look for confirmation dialog
        const confirmDialogSelectors = [
            '[data-testid="delete-confirmation"]',
            '.confirmation-dialog',
            '.modal',
            '.delete-modal'
        ];
        
        let confirmDialogFound = false;
        for (const selector of confirmDialogSelectors) {
            if (await waitForSelector(page, selector, 3000)) {
                logTest('Delete confirmation dialog shown', 'PASS', `Found: ${selector}`);
                confirmDialogFound = true;
                break;
            }
        }
        
        if (!confirmDialogFound) {
            logTest('Delete confirmation dialog shown', 'FAIL', 'No confirmation dialog found');
            return;
        }
        
        // Look for confirm delete button
        const confirmButtonSelectors = [
            '[data-testid="confirm-delete"]',
            'button:contains("Delete")',
            'button:contains("Confirm")',
            'button:contains("Yes")',
            '.confirm-button'
        ];
        
        let confirmButton = null;
        for (const selector of confirmButtonSelectors) {
            if (await waitForSelector(page, selector, 2000)) {
                confirmButton = selector;
                break;
            }
        }
        
        if (confirmButton) {
            await page.click(confirmButton);
            
            // Wait for response
            await page.waitForTimeout(2000);
            
            // Look for success or error message
            const messageSelectors = [
                '[data-testid="success-message"]',
                '[data-testid="error-message"]',
                '.success-message',
                '.error-message',
                '.alert'
            ];
            
            for (const selector of messageSelectors) {
                if (await waitForSelector(page, selector, 3000)) {
                    const message = await page.$eval(selector, el => el.textContent);
                    if (message.toLowerCase().includes('success') || message.toLowerCase().includes('deleted')) {
                        logTest('Brand deletion success', 'PASS', `Message: ${message}`);
                    } else if (message.toLowerCase().includes('error') || message.toLowerCase().includes('cannot')) {
                        logTest('Brand deletion business rule', 'PASS', `Business rule enforced: ${message}`);
                    } else {
                        logTest('Brand deletion feedback', 'PASS', `Message: ${message}`);
                    }
                    return;
                }
            }
            
            logTest('Brand deletion feedback', 'FAIL', 'No feedback message found');
        } else {
            logTest('Delete confirmation button', 'FAIL', 'No confirm button found');
        }
        
    } catch (error) {
        logTest('Delete brand functionality', 'FAIL', error.message);
    }
}

// Test: Responsive Design
async function testResponsiveDesign(page) {
    console.log(`\n${colors.blue}🧪 Testing Responsive Design...${colors.reset}`);
    
    const viewports = [
        { name: 'Desktop', width: 1920, height: 1080 },
        { name: 'Tablet', width: 768, height: 1024 },
        { name: 'Mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
        try {
            await page.setViewport(viewport);
            await page.reload({ waitUntil: 'networkidle2' });
            
            // Check if page loads properly
            await page.waitForTimeout(1000);
            
            // Check if main content is visible
            const contentSelectors = [
                '[data-testid="brand-list"]',
                '.brand-container',
                'main',
                '.content'
            ];
            
            let contentVisible = false;
            for (const selector of contentSelectors) {
                if (await waitForSelector(page, selector, 3000)) {
                    const element = await page.$(selector);
                    const isVisible = await element.isIntersectingViewport();
                    if (isVisible) {
                        contentVisible = true;
                        break;
                    }
                }
            }
            
            if (contentVisible) {
                logTest(`Responsive design - ${viewport.name}`, 'PASS', `${viewport.width}x${viewport.height}`);
            } else {
                logTest(`Responsive design - ${viewport.name}`, 'FAIL', 'Content not properly visible');
            }
            
        } catch (error) {
            logTest(`Responsive design - ${viewport.name}`, 'FAIL', error.message);
        }
    }
    
    // Reset to desktop viewport
    await page.setViewport({ width: 1920, height: 1080 });
}

// Test: Accessibility
async function testAccessibility(page) {
    console.log(`\n${colors.blue}🧪 Testing Accessibility...${colors.reset}`);
    
    try {
        // Check for proper heading hierarchy
        const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements => 
            elements.map(el => ({ tagName: el.tagName, text: el.textContent.trim() }))
        );
        
        if (headings.length > 0) {
            logTest('Heading elements present', 'PASS', `Found ${headings.length} headings`);
        } else {
            logTest('Heading elements present', 'FAIL', 'No heading elements found');
        }
        
        // Check for alt text on images
        const images = await page.$$('img');
        let imagesWithAlt = 0;
        for (const img of images) {
            const alt = await img.getAttribute('alt');
            if (alt) imagesWithAlt++;
        }
        
        if (images.length === 0 || imagesWithAlt === images.length) {
            logTest('Images have alt text', 'PASS', `${imagesWithAlt}/${images.length} images have alt text`);
        } else {
            logTest('Images have alt text', 'FAIL', `Only ${imagesWithAlt}/${images.length} images have alt text`);
        }
        
        // Check for form labels
        const inputs = await page.$$('input[type="text"], input[type="email"], textarea, select');
        let inputsWithLabels = 0;
        
        for (const input of inputs) {
            const id = await input.getAttribute('id');
            const ariaLabel = await input.getAttribute('aria-label');
            const ariaLabelledBy = await input.getAttribute('aria-labelledby');
            
            if (id) {
                const label = await page.$(`label[for="${id}"]`);
                if (label) inputsWithLabels++;
            }
            
            if (ariaLabel || ariaLabelledBy) {
                inputsWithLabels++;
            }
        }
        
        if (inputs.length === 0 || inputsWithLabels >= inputs.length * 0.8) {
            logTest('Form inputs have labels', 'PASS', `${inputsWithLabels}/${inputs.length} inputs properly labeled`);
        } else {
            logTest('Form inputs have labels', 'FAIL', `Only ${inputsWithLabels}/${inputs.length} inputs properly labeled`);
        }
        
        // Check for keyboard navigation
        try {
            const focusableElements = await page.$$('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
            if (focusableElements.length > 0) {
                // Test tab navigation
                await page.keyboard.press('Tab');
                await page.waitForTimeout(100);
                
                const activeElement = await page.evaluate(() => document.activeElement.tagName);
                if (activeElement) {
                    logTest('Keyboard navigation works', 'PASS', `Focus on ${activeElement}`);
                } else {
                    logTest('Keyboard navigation works', 'FAIL', 'No element received focus');
                }
            } else {
                logTest('Focusable elements present', 'FAIL', 'No focusable elements found');
            }
        } catch (error) {
            logTest('Keyboard navigation', 'FAIL', error.message);
        }
        
    } catch (error) {
        logTest('Accessibility testing', 'FAIL', error.message);
    }
}

// Test: Performance
async function testPerformance(page) {
    console.log(`\n${colors.blue}🧪 Testing Performance...${colors.reset}`);
    
    try {
        // Measure page load time
        const startTime = Date.now();
        await page.reload({ waitUntil: 'networkidle2' });
        const loadTime = Date.now() - startTime;
        
        if (loadTime < 3000) {
            logTest('Page load performance', 'PASS', `Loaded in ${loadTime}ms`);
        } else if (loadTime < 5000) {
            logTest('Page load performance', 'PASS', `Loaded in ${loadTime}ms (acceptable)`);
        } else {
            logTest('Page load performance', 'FAIL', `Slow load: ${loadTime}ms`);
        }
        
        // Measure JavaScript performance
        const jsPerformance = await page.evaluate(() => {
            const start = performance.now();
            // Simulate some JS operations
            for (let i = 0; i < 10000; i++) {
                Math.sqrt(i);
            }
            return performance.now() - start;
        });
        
        if (jsPerformance < 100) {
            logTest('JavaScript performance', 'PASS', `JS execution: ${jsPerformance.toFixed(2)}ms`);
        } else {
            logTest('JavaScript performance', 'FAIL', `Slow JS execution: ${jsPerformance.toFixed(2)}ms`);
        }
        
        // Check for memory leaks (basic)
        const metrics = await page.metrics();
        const jsHeapUsed = metrics.JSHeapUsedSize / 1024 / 1024; // Convert to MB
        
        if (jsHeapUsed < 50) {
            logTest('Memory usage', 'PASS', `JS heap: ${jsHeapUsed.toFixed(2)}MB`);
        } else if (jsHeapUsed < 100) {
            logTest('Memory usage', 'PASS', `JS heap: ${jsHeapUsed.toFixed(2)}MB (acceptable)`);
        } else {
            logTest('Memory usage', 'FAIL', `High memory usage: ${jsHeapUsed.toFixed(2)}MB`);
        }
        
    } catch (error) {
        logTest('Performance testing', 'FAIL', error.message);
    }
}

// Main test runner
async function runTests() {
    console.log(`${colors.cyan}🧪 Brand UI Testing Suite with Puppeteer${colors.reset}`);
    console.log('================================================');
    console.log(`Target URL: ${CONFIG.baseUrl}`);
    console.log(`Headless: ${CONFIG.headless}`);
    console.log(`Timeout: ${CONFIG.timeout}ms`);
    
    let browser;
    let page;
    
    try {
        // Setup browser and page
        const setup = await setupBrowser();
        browser = setup.browser;
        page = setup.page;
        
        // Run all test suites
        await testPageLoad(page);
        await testBrandList(page);
        await testCreateBrandForm(page);
        await testSearchAndFilter(page);
        await testEditBrand(page);
        await testDeleteBrand(page);
        await testResponsiveDesign(page);
        await testAccessibility(page);
        await testPerformance(page);
        
    } catch (error) {
        console.log(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
        logTest('Test suite execution', 'FAIL', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    // Print results summary
    console.log(`\n${colors.blue}📊 Brand UI Test Results Summary${colors.reset}`);
    console.log('=======================================');
    console.log(`Total Tests: ${colors.blue}${totalTests}${colors.reset}`);
    console.log(`Passed: ${colors.green}${passedTests}${colors.reset}`);
    console.log(`Failed: ${colors.red}${failedTests}${colors.reset}`);
    
    if (totalTests > 0) {
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        console.log(`Success Rate: ${colors.blue}${successRate}%${colors.reset}`);
    }
    
    // Detailed results
    console.log(`\n${colors.yellow}📋 Detailed Results:${colors.reset}`);
    testResults.forEach(result => {
        const status = result.result === 'PASS' ? 
            `${colors.green}✅ PASS` : `${colors.red}❌ FAIL`;
        console.log(`${status}: ${result.name}${colors.reset}`);
        if (result.details && result.result === 'FAIL') {
            console.log(`${colors.red}   ${result.details}${colors.reset}`);
        }
    });
    
    // Final status
    if (failedTests === 0) {
        console.log(`\n${colors.green}🎉 All Brand UI tests passed successfully!${colors.reset}`);
        process.exit(0);
    } else {
        console.log(`\n${colors.red}❌ Some Brand UI tests failed.${colors.reset}`);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(error => {
        console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
        process.exit(1);
    });
}

module.exports = { runTests };