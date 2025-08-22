/**
 * End-to-End Tests for Unified Booking System
 * 
 * Tests booking functionality through browser automation:
 * - Single-item booking creation
 * - Multi-item booking creation
 * - Booking management workflows
 */

const puppeteer = require('puppeteer');

// Configuration
const BASE_URL = 'http://localhost:3000'; // Frontend URL
const API_BASE_URL = 'https://rental-manager-backend-production.up.railway.app/api';

// Test credentials
const LOGIN_CREDENTIALS = {
    username: 'admin',
    password: 'K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3'
};

class BookingE2ETestSuite {
    constructor() {
        this.browser = null;
        this.page = null;
        this.testResults = [];
    }

    async setup() {
        console.log('🚀 Setting up E2E test environment...');
        
        this.browser = await puppeteer.launch({
            headless: false, // Set to true for CI
            defaultViewport: { width: 1200, height: 800 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        
        // Enable console logging from the page
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('🔴 Browser Error:', msg.text());
            }
        });
        
        // Handle page errors
        this.page.on('pageerror', error => {
            console.log('🔴 Page Error:', error.message);
        });
    }

    async teardown() {
        if (this.browser) {
            await this.browser.close();
        }
        
        // Print test summary
        this.printTestSummary();
    }

    logResult(testName, success, message, data = null) {
        const timestamp = new Date().toISOString();
        const result = { testName, success, message, data, timestamp };
        this.testResults.push(result);
        
        const status = success ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${testName}: ${message}`);
    }

    async login() {
        try {
            console.log('🔐 Attempting login...');
            
            // Navigate to login page
            await this.page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
            
            // Fill login form
            await this.page.type('[name="username"]', LOGIN_CREDENTIALS.username);
            await this.page.type('[name="password"]', LOGIN_CREDENTIALS.password);
            
            // Submit login
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle0' }),
                this.page.click('button[type="submit"]')
            ]);
            
            // Check if we're on dashboard/home page
            const currentUrl = this.page.url();
            if (currentUrl.includes('/dashboard') || currentUrl === `${BASE_URL}/`) {
                this.logResult('login', true, 'Successfully logged in');
                return true;
            } else {
                this.logResult('login', false, `Unexpected redirect to: ${currentUrl}`);
                return false;
            }
            
        } catch (error) {
            this.logResult('login', false, `Login failed: ${error.message}`);
            return false;
        }
    }

    async navigateToBookings() {
        try {
            console.log('📋 Navigating to bookings page...');
            
            // Look for bookings navigation link
            const bookingLinkSelectors = [
                'a[href*="booking"]',
                'a[href*="/bookings"]', 
                '[data-testid="bookings-nav"]',
                'nav a:contains("Booking")',
                '.sidebar a:contains("Booking")'
            ];
            
            let navigated = false;
            
            for (const selector of bookingLinkSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    await this.page.click(selector);
                    await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
                    navigated = true;
                    break;
                } catch (e) {
                    // Try next selector
                    continue;
                }
            }
            
            if (!navigated) {
                // Try direct navigation
                await this.page.goto(`${BASE_URL}/bookings`, { waitUntil: 'networkidle0' });
            }
            
            // Verify we're on bookings page
            const currentUrl = this.page.url();
            if (currentUrl.includes('booking')) {
                this.logResult('navigate_to_bookings', true, 'Successfully navigated to bookings page');
                return true;
            } else {
                this.logResult('navigate_to_bookings', false, `Failed to navigate to bookings page: ${currentUrl}`);
                return false;
            }
            
        } catch (error) {
            this.logResult('navigate_to_bookings', false, `Navigation failed: ${error.message}`);
            return false;
        }
    }

    async testCreateSingleItemBooking() {
        try {
            console.log('📝 Testing single-item booking creation...');
            
            // Look for "Create Booking" or "New Booking" button
            const createButtonSelectors = [
                'button:contains("Create Booking")',
                'button:contains("New Booking")',
                '[data-testid="create-booking"]',
                '.create-booking-btn'
            ];
            
            let createButtonFound = false;
            for (const selector of createButtonSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    await this.page.click(selector);
                    createButtonFound = true;
                    break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!createButtonFound) {
                // Try navigating to create booking page directly
                await this.page.goto(`${BASE_URL}/bookings/create`, { waitUntil: 'networkidle0' });
            }
            
            // Wait for booking form
            await this.page.waitForSelector('form, [data-testid="booking-form"]', { timeout: 5000 });
            
            // Fill booking form (adjust selectors based on actual form structure)
            await this.fillBookingForm({
                type: 'single',
                customerName: 'Test Customer',
                startDate: this.formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // Tomorrow
                endDate: this.formatDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 3 days later
                items: [
                    { name: 'Test Item 1', quantity: 2 }
                ]
            });
            
            // Submit form
            await this.page.click('button[type="submit"], .submit-booking');
            
            // Wait for success message or redirect
            await this.page.waitForSelector('.success-message, .booking-confirmation', { timeout: 10000 });
            
            this.logResult('create_single_booking', true, 'Single-item booking created successfully');
            return true;
            
        } catch (error) {
            this.logResult('create_single_booking', false, `Single booking creation failed: ${error.message}`);
            return false;
        }
    }

    async testCreateMultiItemBooking() {
        try {
            console.log('📝 Testing multi-item booking creation...');
            
            // Navigate to create booking page
            await this.page.goto(`${BASE_URL}/bookings/create`, { waitUntil: 'networkidle0' });
            
            // Wait for booking form
            await this.page.waitForSelector('form, [data-testid="booking-form"]', { timeout: 5000 });
            
            // Fill multi-item booking form
            await this.fillBookingForm({
                type: 'multi',
                customerName: 'Test Customer Multi',
                startDate: this.formatDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)), // Day after tomorrow
                endDate: this.formatDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)), // 5 days later
                items: [
                    { name: 'Test Item 1', quantity: 1 },
                    { name: 'Test Item 2', quantity: 2 },
                    { name: 'Test Item 3', quantity: 1 }
                ]
            });
            
            // Submit form
            await this.page.click('button[type="submit"], .submit-booking');
            
            // Wait for success
            await this.page.waitForSelector('.success-message, .booking-confirmation', { timeout: 10000 });
            
            this.logResult('create_multi_booking', true, 'Multi-item booking created successfully');
            return true;
            
        } catch (error) {
            this.logResult('create_multi_booking', false, `Multi booking creation failed: ${error.message}`);
            return false;
        }
    }

    async testBookingsList() {
        try {
            console.log('📋 Testing bookings list...');
            
            // Navigate to bookings list
            await this.page.goto(`${BASE_URL}/bookings`, { waitUntil: 'networkidle0' });
            
            // Wait for bookings table/list
            await this.page.waitForSelector('table, .bookings-list, [data-testid="bookings-table"]', { timeout: 5000 });
            
            // Check if bookings are displayed
            const bookingElements = await this.page.$$('table tbody tr, .booking-item');
            
            if (bookingElements.length > 0) {
                this.logResult('bookings_list', true, `Found ${bookingElements.length} bookings in list`);
                return true;
            } else {
                this.logResult('bookings_list', false, 'No bookings found in list');
                return false;
            }
            
        } catch (error) {
            this.logResult('bookings_list', false, `Bookings list test failed: ${error.message}`);
            return false;
        }
    }

    async testBookingDetails() {
        try {
            console.log('🔍 Testing booking details view...');
            
            // Navigate to bookings list
            await this.page.goto(`${BASE_URL}/bookings`, { waitUntil: 'networkidle0' });
            
            // Find and click first booking
            const firstBookingLink = await this.page.$('table tbody tr:first-child a, .booking-item:first-child a');
            
            if (firstBookingLink) {
                await firstBookingLink.click();
                await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
                
                // Wait for booking details
                await this.page.waitForSelector('.booking-details, [data-testid="booking-details"]', { timeout: 5000 });
                
                this.logResult('booking_details', true, 'Booking details page loaded successfully');
                return true;
            } else {
                this.logResult('booking_details', false, 'No booking links found');
                return false;
            }
            
        } catch (error) {
            this.logResult('booking_details', false, `Booking details test failed: ${error.message}`);
            return false;
        }
    }

    async fillBookingForm(bookingData) {
        // This is a generic form filler - adjust selectors based on actual form structure
        
        // Customer selection
        const customerSelector = 'select[name="customer"], input[name="customer"]';
        if (await this.page.$(customerSelector)) {
            if (await this.page.$('select[name="customer"]')) {
                await this.page.select('select[name="customer"]', '0'); // Select first option
            } else {
                await this.page.type('input[name="customer"]', bookingData.customerName);
            }
        }
        
        // Date inputs
        if (bookingData.startDate) {
            const startDateInput = await this.page.$('input[name="startDate"], input[name="start_date"]');
            if (startDateInput) {
                await startDateInput.click({ clickCount: 3 }); // Select all
                await startDateInput.type(bookingData.startDate);
            }
        }
        
        if (bookingData.endDate) {
            const endDateInput = await this.page.$('input[name="endDate"], input[name="end_date"]');
            if (endDateInput) {
                await endDateInput.click({ clickCount: 3 }); // Select all
                await endDateInput.type(bookingData.endDate);
            }
        }
        
        // Items selection (simplified - actual implementation depends on UI)
        for (let i = 0; i < bookingData.items.length; i++) {
            const item = bookingData.items[i];
            
            // Add item button (for multi-item bookings)
            if (i > 0) {
                const addItemButton = await this.page.$('button:contains("Add Item"), .add-item-btn');
                if (addItemButton) {
                    await addItemButton.click();
                }
            }
            
            // Select item
            const itemSelector = `select[name="items[${i}].item"], select[name="item_${i}"]`;
            if (await this.page.$(itemSelector)) {
                await this.page.select(itemSelector, '0'); // Select first available item
            }
            
            // Set quantity
            const quantityInput = await this.page.$(`input[name="items[${i}].quantity"], input[name="quantity_${i}"]`);
            if (quantityInput) {
                await quantityInput.click({ clickCount: 3 });
                await quantityInput.type(item.quantity.toString());
            }
        }
    }

    formatDate(date) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    printTestSummary() {
        const total = this.testResults.length;
        const passed = this.testResults.filter(r => r.success).length;
        const failed = total - passed;
        
        console.log('\n' + '='.repeat(80));
        console.log('E2E BOOKING TEST RESULTS');
        console.log('='.repeat(80));
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        console.log(`Success Rate: ${((passed/total)*100).toFixed(1)}%`);
        console.log('-'.repeat(80));
        
        this.testResults.forEach(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${result.testName}: ${result.message}`);
        });
        
        console.log('='.repeat(80));
        
        if (failed > 0) {
            console.log('❌ SOME E2E TESTS FAILED');
            process.exit(1);
        } else {
            console.log('✅ ALL E2E TESTS PASSED');
            process.exit(0);
        }
    }
}

async function runE2ETests() {
    const suite = new BookingE2ETestSuite();
    
    try {
        await suite.setup();
        
        console.log('🧪 Starting Booking E2E Tests...');
        
        // Run test suite
        if (await suite.login()) {
            await suite.navigateToBookings();
            await suite.testBookingsList();
            await suite.testCreateSingleItemBooking();
            await suite.testCreateMultiItemBooking();
            await suite.testBookingDetails();
        }
        
    } catch (error) {
        console.error('❌ E2E Test Suite Failed:', error.message);
        process.exit(1);
    } finally {
        await suite.teardown();
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runE2ETests();
}

module.exports = { BookingE2ETestSuite };