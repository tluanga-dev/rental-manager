#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function captureConsoleErrors() {
    console.log('🔍 Capturing Console Errors and Performance Metrics...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Capture all console messages
    const consoleMessages = [];
    page.on('console', msg => {
        consoleMessages.push({
            type: msg.type(),
            text: msg.text(),
            location: msg.location()
        });
    });
    
    // Capture network errors
    const networkErrors = [];
    page.on('requestfailed', request => {
        networkErrors.push({
            url: request.url(),
            error: request.failure().errorText
        });
    });
    
    try {
        // Start performance monitoring
        const startTime = Date.now();
        
        console.log('📍 Navigating to inventory page...');
        await page.goto('http://localhost:3000/inventory', {
            waitUntil: 'networkidle2',
            timeout: 15000
        });
        
        const loadTime = Date.now() - startTime;
        
        // Wait for React to fully render
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get performance metrics
        const performanceMetrics = await page.metrics();
        
        console.log('\n📊 Performance Metrics:');
        console.log(`⏱️  Page Load Time: ${loadTime}ms`);
        console.log(`🧠 JS Heap Used: ${Math.round(performanceMetrics.JSHeapUsedSize / 1024 / 1024)}MB`);
        console.log(`📜 Script Duration: ${Math.round(performanceMetrics.ScriptDuration * 1000)}ms`);
        console.log(`🎨 Layout Duration: ${Math.round(performanceMetrics.LayoutDuration * 1000)}ms`);
        
        console.log('\n📝 Console Messages Summary:');
        const messageTypes = {};
        consoleMessages.forEach(msg => {
            messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;
        });
        
        Object.entries(messageTypes).forEach(([type, count]) => {
            const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '📝';
            console.log(`${icon} ${type}: ${count}`);
        });
        
        console.log('\n❌ Console Errors:');
        const errors = consoleMessages.filter(msg => msg.type === 'error');
        if (errors.length === 0) {
            console.log('✅ No console errors found!');
        } else {
            errors.slice(0, 10).forEach((error, index) => {
                console.log(`${index + 1}. ${error.text}`);
                if (error.location?.url) {
                    console.log(`   📍 ${error.location.url}:${error.location.lineNumber}`);
                }
            });
            
            if (errors.length > 10) {
                console.log(`   ... and ${errors.length - 10} more errors`);
            }
        }
        
        console.log('\n⚠️  Console Warnings:');
        const warnings = consoleMessages.filter(msg => msg.type === 'warning');
        if (warnings.length === 0) {
            console.log('✅ No console warnings found!');
        } else {
            warnings.slice(0, 5).forEach((warning, index) => {
                console.log(`${index + 1}. ${warning.text}`);
            });
            
            if (warnings.length > 5) {
                console.log(`   ... and ${warnings.length - 5} more warnings`);
            }
        }
        
        console.log('\n🌐 Network Errors:');
        if (networkErrors.length === 0) {
            console.log('✅ No network errors found!');
        } else {
            networkErrors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.url} - ${error.error}`);
            });
        }
        
        // Performance recommendations
        console.log('\n💡 Performance Recommendations:');
        if (loadTime > 2000) {
            console.log('⚠️  Page load time > 2s - consider optimizing bundle size');
        }
        if (performanceMetrics.JSHeapUsedSize > 50 * 1024 * 1024) {
            console.log('⚠️  High memory usage - check for memory leaks');
        }
        if (errors.length > 0) {
            console.log('⚠️  Console errors present - fix to improve performance');
        }
        
        if (loadTime < 2000 && errors.length === 0) {
            console.log('✅ Performance looks good!');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    captureConsoleErrors().catch(console.error);
}

module.exports = { captureConsoleErrors };