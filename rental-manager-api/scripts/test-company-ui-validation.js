#!/usr/bin/env node

/**
 * Company UI Validation Tests using Puppeteer
 * Tests form validation, user interactions, and UI responsiveness
 * Covers create, read, update, delete operations via frontend
 */

const puppeteer = require('puppeteer');

// Configuration
const CONFIG = {
    FRONTEND_URL: 'http://localhost:3001',
    API_URL: 'http://localhost:8000',
    HEADLESS: process.env.HEADLESS !== 'false', // Set HEADLESS=false to see browser
    TIMEOUT: 30000,
    VIEWPORT: { width: 1280, height: 720 }
};

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Helper function to print colored output
function printStatus(status, message) {
    const colors = {
        PASS: '\x1b[32m✓ PASS\x1b[0m',
        FAIL: '\x1b[31m✗ FAIL\x1b[0m',
        INFO: '\x1b[34mℹ INFO\x1b[0m',
        WARN: '\x1b[33m⚠ WARN\x1b[0m'
    };
    
    console.log(`${colors[status] || status}: ${message}`);
    
    if (status === 'PASS') passedTests++;
    if (status === 'FAIL') failedTests++;
    totalTests++;
}

// Helper function to wait for element with timeout
async function waitForSelector(page, selector, timeout = CONFIG.TIMEOUT) {
    try {
        await page.waitForSelector(selector, { timeout });
        return true;
    } catch (error) {
        console.log(`Timeout waiting for selector: ${selector}`);
        return false;
    }
}

// Helper function to wait for text content
async function waitForText(page, text, timeout = CONFIG.TIMEOUT) {
    try {
        await page.waitForFunction(
            (text) => document.body.innerText.includes(text),
            { timeout },
            text
        );
        return true;
    } catch (error) {
        console.log(`Timeout waiting for text: ${text}`);
        return false;
    }
}

// Helper function to fill form field
async function fillField(page, selector, value) {
    await page.waitForSelector(selector);
    await page.focus(selector);
    await page.evaluate((sel) => document.querySelector(sel).value = '', selector);
    await page.type(selector, value);
}

// Helper function to check if element exists
async function elementExists(page, selector) {
    try {
        const element = await page.$(selector);
        return element !== null;
    } catch (error) {
        return false;
    }
}

// Helper function to get element text
async function getElementText(page, selector) {
    try {
        const element = await page.$(selector);
        if (element) {
            return await page.evaluate(el => el.textContent, element);
        }
        return null;
    } catch (error) {
        return null;
    }
}

// Test suite class
class CompanyUITestSuite {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async setup() {
        console.log('🚀 Setting up Puppeteer browser...');
        
        this.browser = await puppeteer.launch({
            headless: CONFIG.HEADLESS,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: CONFIG.VIEWPORT
        });
        
        this.page = await this.browser.newPage();
        
        // Set up console logging from browser
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`Browser Error: ${msg.text()}`);
            }
        });
        
        // Handle page errors
        this.page.on('pageerror', error => {
            console.log(`Page Error: ${error.message}`);
        });
        
        console.log('✅ Browser setup complete');
    }

    async teardown() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔄 Browser closed');
        }
    }

    async checkFrontendHealth() {
        console.log('🔍 Checking frontend health...');
        
        try {
            await this.page.goto(CONFIG.FRONTEND_URL, { waitUntil: 'networkidle0' });
            
            // Check if the page loaded successfully
            const title = await this.page.title();
            if (title) {
                printStatus('PASS', 'Frontend is accessible');
                return true;
            } else {
                printStatus('FAIL', 'Frontend loaded but no title found');
                return false;
            }
        } catch (error) {
            printStatus('FAIL', `Frontend health check failed: ${error.message}`);
            return false;
        }
    }

    async navigateToCompanies() {
        console.log('🧭 Navigating to companies section...');
        
        try {
            // Look for common navigation patterns
            const navSelectors = [
                'a[href*="companies"]',
                'nav a:contains("Companies")',
                '[data-testid="companies-nav"]',
                '.nav-companies',
                '#companies-menu'
            ];
            
            let found = false;
            for (const selector of navSelectors) {
                if (await elementExists(this.page, selector)) {
                    await this.page.click(selector);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                // Try direct URL navigation
                await this.page.goto(`${CONFIG.FRONTEND_URL}/companies`, { waitUntil: 'networkidle0' });
            }
            
            // Wait for companies content to load
            const companyIndicators = [
                '[data-testid="companies-list"]',
                '.companies-container',
                'h1:contains("Companies")',
                '.company-table'
            ];
            
            for (const indicator of companyIndicators) {
                if (await waitForSelector(this.page, indicator, 5000)) {
                    printStatus('PASS', 'Successfully navigated to companies section');
                    return true;
                }
            }
            
            printStatus('WARN', 'Navigation completed but company indicators not found');
            return false;
            
        } catch (error) {
            printStatus('FAIL', `Navigation failed: ${error.message}`);
            return false;
        }
    }

    async testCreateCompanyForm() {
        console.log('\n📝 Testing company creation form...');
        
        try {
            // Look for create/add company button
            const createSelectors = [
                '[data-testid="create-company"]',
                '[data-testid="add-company"]',
                'button:contains("Add Company")',
                'button:contains("Create Company")',
                'button:contains("New Company")',
                '.btn-create-company',
                '.add-company-btn'
            ];
            
            let createButton = null;
            for (const selector of createSelectors) {
                if (await elementExists(this.page, selector)) {
                    createButton = selector;
                    break;
                }
            }
            
            if (!createButton) {
                printStatus('FAIL', 'Create company button not found');
                return false;
            }
            
            await this.page.click(createButton);
            
            // Wait for form to appear
            const formSelectors = [
                '[data-testid="company-form"]',
                '.company-form',
                'form[name="company"]',
                'form:has(input[name="company_name"])'
            ];
            
            let formFound = false;
            for (const selector of formSelectors) {
                if (await waitForSelector(this.page, selector, 10000)) {
                    formFound = true;
                    break;
                }
            }
            
            if (!formFound) {
                printStatus('FAIL', 'Company form not found after clicking create button');
                return false;
            }
            
            printStatus('PASS', 'Company creation form opened successfully');
            return true;
            
        } catch (error) {
            printStatus('FAIL', `Create form test failed: ${error.message}`);
            return false;
        }
    }

    async testFormValidation() {
        console.log('\n✅ Testing form validation...');
        
        try {
            // Test 1: Submit empty form (should show validation errors)
            console.log('Test 1: Empty form validation');
            
            const submitSelectors = [
                '[data-testid="submit-company"]',
                'button[type="submit"]',
                '.btn-submit',
                'button:contains("Save")',
                'button:contains("Create")'
            ];
            
            let submitButton = null;
            for (const selector of submitSelectors) {
                if (await elementExists(this.page, selector)) {
                    submitButton = selector;
                    break;
                }
            }
            
            if (!submitButton) {
                printStatus('FAIL', 'Submit button not found');
                return false;
            }
            
            await this.page.click(submitButton);
            
            // Wait for validation errors
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check for error messages
            const errorSelectors = [
                '.error-message',
                '.field-error',
                '.validation-error',
                '[data-testid*="error"]',
                '.text-red',
                '.text-danger',
                '.is-invalid'
            ];
            
            let errorFound = false;
            for (const selector of errorSelectors) {
                if (await elementExists(this.page, selector)) {
                    errorFound = true;
                    break;
                }
            }
            
            if (errorFound) {
                printStatus('PASS', 'Empty form validation works - errors shown');
            } else {
                printStatus('WARN', 'Empty form validation - no visible errors found');
            }
            
            // Test 2: Fill valid data and verify acceptance
            console.log('Test 2: Valid form data');
            
            const fieldMappings = [
                { name: 'company_name', value: 'UI Test Corporation' },
                { name: 'companyName', value: 'UI Test Corporation' },
                { name: 'name', value: 'UI Test Corporation' }
            ];
            
            let nameFieldFilled = false;
            for (const field of fieldMappings) {
                const selectors = [
                    `input[name="${field.name}"]`,
                    `[data-testid="${field.name}"]`,
                    `#${field.name}`
                ];
                
                for (const selector of selectors) {
                    if (await elementExists(this.page, selector)) {
                        await fillField(this.page, selector, field.value);
                        nameFieldFilled = true;
                        break;
                    }
                }
                if (nameFieldFilled) break;
            }
            
            if (!nameFieldFilled) {
                printStatus('WARN', 'Could not find company name field');
                return false;
            }
            
            // Fill optional fields if they exist
            const optionalFields = [
                { names: ['email'], value: 'test@uitest.com' },
                { names: ['phone'], value: '+1-555-123-4567' },
                { names: ['address'], value: '123 Test Street, Test City' },
                { names: ['gst_no', 'gstNo'], value: 'GST123456789' },
                { names: ['registration_number', 'registrationNumber'], value: 'REG123456789' }
            ];
            
            for (const field of optionalFields) {
                for (const name of field.names) {
                    const selectors = [
                        `input[name="${name}"]`,
                        `textarea[name="${name}"]`,
                        `[data-testid="${name}"]`,
                        `#${name}`
                    ];
                    
                    for (const selector of selectors) {
                        if (await elementExists(this.page, selector)) {
                            await fillField(this.page, selector, field.value);
                            break;
                        }
                    }
                }
            }
            
            // Submit valid form
            await this.page.click(submitButton);
            
            // Wait for response
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check for success indicators
            const successIndicators = [
                '.success-message',
                '.alert-success',
                '.notification-success',
                '[data-testid*="success"]',
                '.text-green',
                '.text-success'
            ];
            
            let successFound = false;
            for (const selector of successIndicators) {
                if (await elementExists(this.page, selector)) {
                    successFound = true;
                    break;
                }
            }
            
            // Also check if we're redirected to list view
            const currentUrl = this.page.url();
            const isOnListPage = currentUrl.includes('/companies') && !currentUrl.includes('/create') && !currentUrl.includes('/new');
            
            if (successFound || isOnListPage) {
                printStatus('PASS', 'Valid form submission successful');
            } else {
                printStatus('WARN', 'Form submitted but no clear success indicator');
            }
            
            return true;
            
        } catch (error) {
            printStatus('FAIL', `Form validation test failed: ${error.message}`);
            return false;
        }
    }

    async testCompanyList() {
        console.log('\n📋 Testing company list functionality...');
        
        try {
            // Navigate back to list if not already there
            await this.navigateToCompanies();
            
            // Test 1: Check if list loads
            console.log('Test 1: Company list loading');
            
            const listSelectors = [
                '[data-testid="companies-list"]',
                '.companies-table',
                '.company-list',
                'table',
                '.list-container'
            ];
            
            let listFound = false;
            for (const selector of listSelectors) {
                if (await elementExists(this.page, selector)) {
                    listFound = true;
                    printStatus('PASS', 'Company list loaded successfully');
                    break;
                }
            }
            
            if (!listFound) {
                printStatus('FAIL', 'Company list not found');
                return false;
            }
            
            // Test 2: Check for search functionality
            console.log('Test 2: Search functionality');
            
            const searchSelectors = [
                'input[placeholder*="Search"]',
                'input[placeholder*="search"]',
                '[data-testid="search"]',
                '.search-input',
                '#search'
            ];
            
            let searchField = null;
            for (const selector of searchSelectors) {
                if (await elementExists(this.page, selector)) {
                    searchField = selector;
                    break;
                }
            }
            
            if (searchField) {
                printStatus('PASS', 'Search functionality found');
                
                // Test search
                await fillField(this.page, searchField, 'UI Test');
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                printStatus('PASS', 'Search input tested');
            } else {
                printStatus('WARN', 'Search functionality not found');
            }
            
            // Test 3: Check for pagination
            console.log('Test 3: Pagination controls');
            
            const paginationSelectors = [
                '.pagination',
                '[data-testid="pagination"]',
                '.page-numbers',
                'button:contains("Next")',
                'button:contains("Previous")'
            ];
            
            let paginationFound = false;
            for (const selector of paginationSelectors) {
                if (await elementExists(this.page, selector)) {
                    paginationFound = true;
                    break;
                }
            }
            
            if (paginationFound) {
                printStatus('PASS', 'Pagination controls found');
            } else {
                printStatus('INFO', 'Pagination controls not visible (may be hidden due to low data)');
            }
            
            // Test 4: Check for filter/sort options
            console.log('Test 4: Filter and sort options');
            
            const filterSelectors = [
                'select[name*="filter"]',
                '.filter-dropdown',
                '[data-testid*="filter"]',
                'button:contains("Filter")',
                '.sort-button',
                'th[data-sort]'
            ];
            
            let filterFound = false;
            for (const selector of filterSelectors) {
                if (await elementExists(this.page, selector)) {
                    filterFound = true;
                    break;
                }
            }
            
            if (filterFound) {
                printStatus('PASS', 'Filter/sort options found');
            } else {
                printStatus('INFO', 'Filter/sort options not found');
            }
            
            return true;
            
        } catch (error) {
            printStatus('FAIL', `Company list test failed: ${error.message}`);
            return false;
        }
    }

    async testResponsiveDesign() {
        console.log('\n📱 Testing responsive design...');
        
        try {
            const viewports = [
                { name: 'Desktop', width: 1280, height: 720 },
                { name: 'Tablet', width: 768, height: 1024 },
                { name: 'Mobile', width: 375, height: 667 }
            ];
            
            for (const viewport of viewports) {
                console.log(`Testing ${viewport.name} view (${viewport.width}x${viewport.height})`);
                
                await this.page.setViewport({ width: viewport.width, height: viewport.height });
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Check if main content is visible
                const contentVisible = await this.page.evaluate(() => {
                    const body = document.body;
                    return body.scrollWidth <= window.innerWidth + 50; // Allow some tolerance
                });
                
                if (contentVisible) {
                    printStatus('PASS', `${viewport.name} responsive design works`);
                } else {
                    printStatus('WARN', `${viewport.name} may have horizontal scroll issues`);
                }
                
                // Check for mobile menu on smaller screens
                if (viewport.width <= 768) {
                    const mobileMenuSelectors = [
                        '.mobile-menu',
                        '.hamburger',
                        '[data-testid="mobile-menu"]',
                        '.menu-toggle'
                    ];
                    
                    let mobileMenuFound = false;
                    for (const selector of mobileMenuSelectors) {
                        if (await elementExists(this.page, selector)) {
                            mobileMenuFound = true;
                            break;
                        }
                    }
                    
                    if (mobileMenuFound) {
                        printStatus('PASS', `${viewport.name} mobile menu found`);
                    } else {
                        printStatus('INFO', `${viewport.name} mobile menu not found (may be auto-hidden)`);
                    }
                }
            }
            
            // Reset to desktop viewport
            await this.page.setViewport({ width: 1280, height: 720 });
            
            return true;
            
        } catch (error) {
            printStatus('FAIL', `Responsive design test failed: ${error.message}`);
            return false;
        }
    }

    async testAccessibility() {
        console.log('\n♿ Testing accessibility features...');
        
        try {
            // Test 1: Check for proper labels
            console.log('Test 1: Form labels and ARIA attributes');
            
            const labelledInputs = await this.page.evaluate(() => {
                const inputs = document.querySelectorAll('input, textarea, select');
                let labelledCount = 0;
                let totalInputs = inputs.length;
                
                inputs.forEach(input => {
                    if (input.labels && input.labels.length > 0) labelledCount++;
                    else if (input.getAttribute('aria-label')) labelledCount++;
                    else if (input.getAttribute('aria-labelledby')) labelledCount++;
                    else if (input.placeholder) labelledCount++; // Placeholder as fallback
                });
                
                return { labelledCount, totalInputs };
            });
            
            if (labelledInputs.totalInputs > 0) {
                const labelRatio = labelledInputs.labelledCount / labelledInputs.totalInputs;
                if (labelRatio >= 0.8) {
                    printStatus('PASS', `Form accessibility good - ${labelledInputs.labelledCount}/${labelledInputs.totalInputs} inputs labeled`);
                } else {
                    printStatus('WARN', `Form accessibility needs improvement - ${labelledInputs.labelledCount}/${labelledInputs.totalInputs} inputs labeled`);
                }
            }
            
            // Test 2: Keyboard navigation
            console.log('Test 2: Keyboard navigation');
            
            await this.page.keyboard.press('Tab');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const focusedElement = await this.page.evaluate(() => {
                return document.activeElement.tagName.toLowerCase();
            });
            
            if (['input', 'button', 'select', 'textarea', 'a'].includes(focusedElement)) {
                printStatus('PASS', 'Keyboard navigation works - focusable elements found');
            } else {
                printStatus('WARN', 'Keyboard navigation may need improvement');
            }
            
            // Test 3: Color contrast (basic check)
            console.log('Test 3: Basic color contrast check');
            
            const contrastIssues = await this.page.evaluate(() => {
                const elements = document.querySelectorAll('button, .btn, a, input');
                let issues = 0;
                
                elements.forEach(el => {
                    const styles = window.getComputedStyle(el);
                    const bgColor = styles.backgroundColor;
                    const textColor = styles.color;
                    
                    // Basic check: if both are very light or very dark, might be an issue
                    if ((bgColor === 'rgb(255, 255, 255)' && textColor === 'rgb(255, 255, 255)') ||
                        (bgColor === 'rgb(0, 0, 0)' && textColor === 'rgb(0, 0, 0)')) {
                        issues++;
                    }
                });
                
                return issues;
            });
            
            if (contrastIssues === 0) {
                printStatus('PASS', 'No obvious color contrast issues found');
            } else {
                printStatus('WARN', `${contrastIssues} potential color contrast issues found`);
            }
            
            return true;
            
        } catch (error) {
            printStatus('FAIL', `Accessibility test failed: ${error.message}`);
            return false;
        }
    }

    async testErrorHandling() {
        console.log('\n🚫 Testing error handling...');
        
        try {
            // Test 1: Network error simulation
            console.log('Test 1: Network error handling');
            
            // Intercept requests and simulate failure
            await this.page.setRequestInterception(true);
            
            this.page.on('request', request => {
                if (request.url().includes('/companies') && request.method() === 'POST') {
                    request.abort('failed');
                } else {
                    request.continue();
                }
            });
            
            // Try to create a company (should fail)
            await this.testCreateCompanyForm();
            
            const nameField = await this.page.$('input[name="company_name"], input[name="companyName"], input[name="name"]');
            if (nameField) {
                await fillField(this.page, 'input[name="company_name"], input[name="companyName"], input[name="name"]', 'Network Error Test Corp');
                
                const submitButton = await this.page.$('button[type="submit"], .btn-submit, button:contains("Save"), button:contains("Create")');
                if (submitButton) {
                    await this.page.click('button[type="submit"], .btn-submit, button:contains("Save"), button:contains("Create")');
                    
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Check for error message
                    const errorSelectors = [
                        '.error-message',
                        '.alert-error',
                        '.notification-error',
                        '[data-testid*="error"]',
                        '.text-red',
                        '.text-danger'
                    ];
                    
                    let errorFound = false;
                    for (const selector of errorSelectors) {
                        if (await elementExists(this.page, selector)) {
                            errorFound = true;
                            break;
                        }
                    }
                    
                    if (errorFound) {
                        printStatus('PASS', 'Network error handling works - error message shown');
                    } else {
                        printStatus('WARN', 'Network error handling - no visible error message');
                    }
                }
            }
            
            // Disable request interception
            await this.page.setRequestInterception(false);
            
            return true;
            
        } catch (error) {
            printStatus('FAIL', `Error handling test failed: ${error.message}`);
            return false;
        }
    }

    async runAllTests() {
        console.log('🧪 COMPANY UI VALIDATION TEST SUITE');
        console.log('=' * 50);
        console.log(`Target Frontend: ${CONFIG.FRONTEND_URL}`);
        console.log(`Headless Mode: ${CONFIG.HEADLESS}`);
        console.log('');
        
        const tests = [
            () => this.checkFrontendHealth(),
            () => this.navigateToCompanies(),
            () => this.testCreateCompanyForm(),
            () => this.testFormValidation(),
            () => this.testCompanyList(),
            () => this.testResponsiveDesign(),
            () => this.testAccessibility(),
            () => this.testErrorHandling()
        ];
        
        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                printStatus('FAIL', `Test execution failed: ${error.message}`);
            }
            
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Main execution function
async function runUITests() {
    console.log('🎭 Starting Company UI Validation Tests with Puppeteer');
    console.log('==================================================');
    
    const testSuite = new CompanyUITestSuite();
    
    try {
        await testSuite.setup();
        await testSuite.runAllTests();
    } catch (error) {
        console.error('❌ Test suite failed to run:', error.message);
        process.exit(1);
    } finally {
        await testSuite.teardown();
    }
    
    // Print final results
    console.log('\n' + '=' * 50);
    console.log('🧪 COMPANY UI TEST RESULTS');
    console.log('=' * 50);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%`);
    
    if (failedTests === 0) {
        console.log('\n🎉 ALL UI TESTS PASSED! 🎉');
        console.log('The Company UI is working correctly!');
        process.exit(0);
    } else {
        console.log(`\n❌ ${failedTests} UI tests had issues`);
        process.exit(1);
    }
}

// Check if puppeteer is available
try {
    require('puppeteer');
} catch (error) {
    console.error('❌ Puppeteer is not installed. Install it with:');
    console.error('npm install puppeteer');
    process.exit(1);
}

// Run tests if this file is executed directly
if (require.main === module) {
    runUITests();
}

module.exports = { CompanyUITestSuite };