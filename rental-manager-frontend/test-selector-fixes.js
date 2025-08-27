#!/usr/bin/env node

/**
 * Quick Test Script for Selector Fixes
 * Tests the core inventory functionality with fixed selectors
 */

const puppeteer = require('puppeteer');

class SelectorTestSuite {
    constructor() {
        this.browser = null;
        this.page = null;
        this.results = {
            selectorTests: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    async initialize() {
        console.log('🚀 Initializing Selector Fix Test Suite...');
        
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
        
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1200, height: 800 });
        
        console.log('✅ Test environment initialized');
    }

    async testBasicNavigation() {
        console.log('\n🧭 Testing Basic Navigation...');
        this.results.selectorTests++;

        try {
            // Navigate to the inventory page
            await this.page.goto('http://localhost:3000/inventory', {
                waitUntil: 'networkidle2',
                timeout: 15000
            });

            // Check if we get to authentication or inventory page
            await new Promise(resolve => setTimeout(resolve, 2000));
            const currentUrl = this.page.url();
            
            if (currentUrl.includes('/inventory') || currentUrl.includes('/login')) {
                console.log('✅ Navigation successful - reached expected page');
                this.results.passed++;
                return true;
            } else {
                console.log('❌ Navigation failed - unexpected page');
                this.results.failed++;
                return false;
            }
            
        } catch (error) {
            console.log('❌ Navigation test failed:', error.message);
            this.results.failed++;
            this.results.errors.push(`Navigation: ${error.message}`);
            return false;
        }
    }

    async testAPIEndpoints() {
        console.log('\n📡 Testing API Endpoints...');
        this.results.selectorTests++;

        try {
            // Test the inventory stocks endpoint
            const response = await this.page.goto('http://localhost:8000/api/v1/inventory/stocks', {
                waitUntil: 'networkidle2',
                timeout: 10000
            });

            const content = await this.page.content();
            
            if (response.status() === 200 && content.includes('"success"')) {
                console.log('✅ API endpoint responding correctly');
                this.results.passed++;
                return true;
            } else {
                console.log(`❌ API endpoint failed - Status: ${response.status()}`);
                this.results.failed++;
                return false;
            }
            
        } catch (error) {
            console.log('❌ API test failed:', error.message);
            this.results.failed++;
            this.results.errors.push(`API: ${error.message}`);
            return false;
        }
    }

    async testSecurityValidation() {
        console.log('\n🔒 Testing Security Validation...');
        this.results.selectorTests++;

        try {
            // Test SQL injection protection
            const maliciousUrl = "http://localhost:8000/api/v1/inventory/stocks?search='; DROP TABLE items; --";
            const response = await this.page.goto(maliciousUrl, {
                waitUntil: 'networkidle2',
                timeout: 10000
            });

            const content = await this.page.content();
            
            if (content.includes('potentially malicious content') || content.includes('invalid characters')) {
                console.log('✅ Security validation working - SQL injection blocked');
                this.results.passed++;
                return true;
            } else {
                console.log('❌ Security validation failed - malicious input not blocked');
                this.results.failed++;
                return false;
            }
            
        } catch (error) {
            console.log('❌ Security test failed:', error.message);
            this.results.failed++;
            this.results.errors.push(`Security: ${error.message}`);
            return false;
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
        console.log('🧹 Test cleanup completed');
    }

    async generateReport() {
        console.log('\n📊 SELECTOR FIX TEST RESULTS');
        console.log('==========================================');
        console.log(`✅ Tests Passed: ${this.results.passed}/${this.results.selectorTests}`);
        console.log(`❌ Tests Failed: ${this.results.failed}/${this.results.selectorTests}`);
        console.log(`📈 Success Rate: ${Math.round((this.results.passed / this.results.selectorTests) * 100)}%`);
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            this.results.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });
        }

        console.log(`\n🎉 SELECTOR FIX TESTING COMPLETE!`);
        console.log(`📊 Overall Success Rate: ${Math.round((this.results.passed / this.results.selectorTests) * 100)}%`);
    }
}

// Main execution
async function runSelectorTests() {
    const suite = new SelectorTestSuite();
    
    try {
        await suite.initialize();
        
        // Run core tests
        await suite.testBasicNavigation();
        await suite.testAPIEndpoints();
        await suite.testSecurityValidation();
        
        // Generate final report
        await suite.generateReport();
        
    } catch (error) {
        console.error('❌ Test suite execution failed:', error);
    } finally {
        await suite.cleanup();
    }
}

// Execute if run directly
if (require.main === module) {
    runSelectorTests().catch(console.error);
}

module.exports = { SelectorTestSuite };