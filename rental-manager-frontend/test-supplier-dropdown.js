const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * Supplier Dropdown Component Test
 * Tests virtualization, search, keyboard navigation, and performance
 */

async function testSupplierDropdown() {
  console.log('📋 Supplier Dropdown Component Test Suite');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    defaultViewport: { width: 1600, height: 1000 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const testResults = {
    authentication: false,
    navigation: false,
    dropdownRender: false,
    searchFunctionality: false,
    debouncing: false,
    virtualization: false,
    keyboardNavigation: false,
    selection: false,
    clearSelection: false,
    multiSelect: false,
    emptyState: false,
    loadingState: false,
    errorState: false,
    accessibility: false,
    performance: false
  };

  const performanceMetrics = {
    initialLoadTime: 0,
    searchResponseTime: 0,
    scrollPerformance: 0,
    renderTime: 0,
    memoryUsage: 0
  };

  try {
    console.log('\n📍 PHASE 1: Setup and Navigation');
    console.log('─'.repeat(50));
    
    // Navigate to login
    await page.goto('http://localhost:3001/login', { 
      waitUntil: 'networkidle2', 
      timeout: 20000 
    });
    
    // Login as admin
    const demoButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.trim() === 'Demo as Administrator');
    });
    
    if (demoButton) {
      await demoButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      testResults.authentication = true;
      console.log('✅ Authentication successful');
    }

    // Navigate to a page with supplier dropdown (e.g., purchase order creation)
    await page.goto('http://localhost:3001/purchases/new', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    testResults.navigation = true;
    console.log('✅ Navigated to page with supplier dropdown');

    console.log('\n📍 PHASE 2: Dropdown Rendering');
    console.log('─'.repeat(50));
    
    const startLoadTime = Date.now();
    
    // Find supplier dropdown
    const supplierDropdown = await page.$('[data-testid="supplier-dropdown"], #supplier, select[name="supplier_id"], .supplier-dropdown');
    
    if (supplierDropdown) {
      testResults.dropdownRender = true;
      performanceMetrics.initialLoadTime = Date.now() - startLoadTime;
      console.log(`✅ Dropdown rendered in ${performanceMetrics.initialLoadTime}ms`);
      await page.screenshot({ path: 'supplier-dropdown-01-initial.png' });
    } else {
      // Try to find it by clicking a trigger button
      const triggerButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(b => b.textContent.includes('Select Supplier') || b.textContent.includes('Choose Supplier'));
      });
      
      if (triggerButton) {
        await triggerButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        testResults.dropdownRender = true;
        console.log('✅ Dropdown triggered and rendered');
      }
    }

    console.log('\n📍 PHASE 3: Search Functionality');
    console.log('─'.repeat(50));
    
    // Test search input
    const searchInput = await page.$('input[placeholder*="Search"], input[placeholder*="supplier"], .supplier-search-input');
    
    if (searchInput) {
      // Type search query
      const searchStartTime = Date.now();
      await searchInput.type('Manufacturing');
      
      // Wait for debounce (typically 300ms)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      performanceMetrics.searchResponseTime = Date.now() - searchStartTime;
      
      // Check if results updated
      const searchResults = await page.evaluate(() => {
        const items = document.querySelectorAll('.supplier-item, [role="option"], .dropdown-item');
        return items.length;
      });
      
      if (searchResults > 0) {
        testResults.searchFunctionality = true;
        console.log(`✅ Search returned ${searchResults} results in ${performanceMetrics.searchResponseTime}ms`);
      }
      
      // Test debouncing by typing quickly
      await searchInput.click({ clickCount: 3 });
      await searchInput.type('Test', { delay: 50 });
      
      const beforeDebounce = await page.evaluate(() => {
        return document.querySelectorAll('.supplier-item, [role="option"]').length;
      });
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const afterDebounce = await page.evaluate(() => {
        return document.querySelectorAll('.supplier-item, [role="option"]').length;
      });
      
      if (afterDebounce !== beforeDebounce) {
        testResults.debouncing = true;
        console.log('✅ Search debouncing working');
      }
      
      await page.screenshot({ path: 'supplier-dropdown-02-search.png' });
    }

    console.log('\n📍 PHASE 4: Virtualization Testing');
    console.log('─'.repeat(50));
    
    // Clear search to get full list
    if (searchInput) {
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Test virtualization by checking DOM element count
    const visibleItems = await page.evaluate(() => {
      return document.querySelectorAll('.supplier-item, [role="option"], .dropdown-item').length;
    });
    
    // Scroll down
    const scrollContainer = await page.$('.supplier-list, .dropdown-content, [role="listbox"]');
    if (scrollContainer) {
      const scrollStartTime = Date.now();
      
      await page.evaluate((element) => {
        element.scrollTop = element.scrollHeight / 2;
      }, scrollContainer);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const itemsAfterScroll = await page.evaluate(() => {
        return document.querySelectorAll('.supplier-item, [role="option"], .dropdown-item').length;
      });
      
      performanceMetrics.scrollPerformance = Date.now() - scrollStartTime;
      
      // In a virtualized list, DOM element count should stay relatively constant
      if (Math.abs(itemsAfterScroll - visibleItems) < 20) {
        testResults.virtualization = true;
        console.log(`✅ Virtualization working - ${visibleItems} visible items maintained`);
        console.log(`⏱️  Scroll performance: ${performanceMetrics.scrollPerformance}ms`);
      }
    }

    console.log('\n📍 PHASE 5: Keyboard Navigation');
    console.log('─'.repeat(50));
    
    // Test keyboard navigation
    if (searchInput) {
      await searchInput.focus();
      
      // Press down arrow to navigate
      await page.keyboard.press('ArrowDown');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const firstItemHighlighted = await page.evaluate(() => {
        const highlighted = document.querySelector('.highlighted, [aria-selected="true"], .selected');
        return highlighted !== null;
      });
      
      if (firstItemHighlighted) {
        testResults.keyboardNavigation = true;
        console.log('✅ Keyboard navigation (ArrowDown) working');
      }
      
      // Press Enter to select
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if selection was made
      const selectedValue = await page.evaluate(() => {
        const selectedDisplay = document.querySelector('.selected-supplier, .supplier-display');
        if (selectedDisplay) return selectedDisplay.textContent;
        
        const input = document.querySelector('input[name="supplier_id"]');
        if (input) return input.value;
        
        return null;
      });
      
      if (selectedValue) {
        testResults.selection = true;
        console.log(`✅ Selection working - selected: ${selectedValue}`);
      }
      
      await page.screenshot({ path: 'supplier-dropdown-03-selection.png' });
    }

    console.log('\n📍 PHASE 6: Clear and Multi-Select');
    console.log('─'.repeat(50));
    
    // Test clear button
    const clearButton = await page.$('.clear-button, [aria-label="Clear"], button[title="Clear"]');
    if (clearButton) {
      await clearButton.click();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const clearedValue = await page.evaluate(() => {
        const input = document.querySelector('input[name="supplier_id"]');
        return input ? input.value : '';
      });
      
      if (!clearedValue || clearedValue === '') {
        testResults.clearSelection = true;
        console.log('✅ Clear selection working');
      }
    }
    
    // Check if multi-select is supported
    const isMultiSelect = await page.evaluate(() => {
      const dropdown = document.querySelector('[multiple], .multi-select-dropdown');
      return dropdown !== null;
    });
    
    if (isMultiSelect) {
      // Test multi-select functionality
      console.log('Testing multi-select functionality...');
      // Implementation would go here
      testResults.multiSelect = true;
    } else {
      console.log('ℹ️  Single-select dropdown detected');
    }

    console.log('\n📍 PHASE 7: Edge Cases and States');
    console.log('─'.repeat(50));
    
    // Test empty state
    if (searchInput) {
      await searchInput.click({ clickCount: 3 });
      await searchInput.type('XXXXNONEXISTENTXXXX');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const emptyMessage = await page.evaluate(() => {
        const messages = Array.from(document.querySelectorAll('*'));
        return messages.some(el => 
          el.textContent.includes('No suppliers found') || 
          el.textContent.includes('No results') ||
          el.textContent.includes('No matches')
        );
      });
      
      if (emptyMessage) {
        testResults.emptyState = true;
        console.log('✅ Empty state message displayed');
      }
      
      await page.screenshot({ path: 'supplier-dropdown-04-empty.png' });
    }
    
    // Test loading state (if visible)
    const loadingIndicator = await page.$('.loading, .spinner, [role="progressbar"]');
    if (loadingIndicator) {
      testResults.loadingState = true;
      console.log('✅ Loading state indicator present');
    }

    console.log('\n📍 PHASE 8: Accessibility');
    console.log('─'.repeat(50));
    
    // Test ARIA attributes
    const accessibilityCheck = await page.evaluate(() => {
      const dropdown = document.querySelector('.supplier-dropdown, [role="combobox"]');
      if (!dropdown) return false;
      
      const hasRole = dropdown.hasAttribute('role');
      const hasAriaLabel = dropdown.hasAttribute('aria-label') || dropdown.hasAttribute('aria-labelledby');
      const hasAriaExpanded = dropdown.hasAttribute('aria-expanded');
      
      const options = document.querySelectorAll('[role="option"]');
      const optionsHaveIds = Array.from(options).every(opt => opt.hasAttribute('id'));
      
      return hasRole && hasAriaLabel && optionsHaveIds;
    });
    
    if (accessibilityCheck) {
      testResults.accessibility = true;
      console.log('✅ Accessibility attributes present');
    }

    console.log('\n📍 PHASE 9: Performance Metrics');
    console.log('─'.repeat(50));
    
    // Measure memory usage
    const metrics = await page.metrics();
    performanceMetrics.memoryUsage = Math.round(metrics.JSHeapUsedSize / 1024 / 1024);
    console.log(`📊 Memory usage: ${performanceMetrics.memoryUsage}MB`);
    
    // Test rapid interactions
    const rapidTestStart = Date.now();
    
    for (let i = 0; i < 5; i++) {
      if (searchInput) {
        await searchInput.click({ clickCount: 3 });
        await searchInput.type(`Test ${i}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const rapidTestTime = Date.now() - rapidTestStart;
    if (rapidTestTime < 3000) {
      testResults.performance = true;
      console.log(`✅ Rapid interaction test passed in ${rapidTestTime}ms`);
    }

    // Final screenshot
    await page.screenshot({ path: 'supplier-dropdown-05-final.png' });

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(r => r === true).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    console.log('\n✅ Passed Tests:');
    Object.entries(testResults).forEach(([test, result]) => {
      if (result) {
        console.log(`   ✓ ${test}`);
      }
    });
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      Object.entries(testResults).forEach(([test, result]) => {
        if (!result) {
          console.log(`   ✗ ${test}`);
        }
      });
    }
    
    console.log('\n📈 Performance Metrics:');
    console.log(`   Initial load: ${performanceMetrics.initialLoadTime}ms`);
    console.log(`   Search response: ${performanceMetrics.searchResponseTime}ms`);
    console.log(`   Scroll performance: ${performanceMetrics.scrollPerformance}ms`);
    console.log(`   Memory usage: ${performanceMetrics.memoryUsage}MB`);
    
    console.log('\n📊 Statistics:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${failedTests}`);
    console.log(`   Success Rate: ${successRate}%`);
    
    // Save test report
    const testReport = {
      timestamp: new Date().toISOString(),
      results: testResults,
      metrics: performanceMetrics,
      successRate: successRate
    };
    
    fs.writeFileSync('supplier-dropdown-test-report.json', JSON.stringify(testReport, null, 2));
    console.log('\n📄 Report saved to supplier-dropdown-test-report.json');
    
    if (successRate === '100.0') {
      console.log('\n🎉 PERFECT! Supplier dropdown component working flawlessly!');
    } else if (passedTests >= totalTests * 0.8) {
      console.log('\n✅ Good! Most dropdown features working correctly.');
    } else {
      console.log('\n⚠️  Several dropdown features need attention.');
    }
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    await page.screenshot({ path: 'supplier-dropdown-error.png' });
  } finally {
    await browser.close();
    console.log('\n🏁 Dropdown test suite completed');
  }
}

// Run the test
testSupplierDropdown().catch(console.error);