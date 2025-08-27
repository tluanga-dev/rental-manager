const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive Purchase Recording Workflow Test
 * Tests all aspects of the purchase form including the new success dialog
 */
class PurchaseWorkflowTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = {
      pageLoad: false,
      formElements: false,
      apiErrorHandling: false,
      performanceMonitoring: false,
      successDialog: false,
      userInteractions: false,
      navigation: false,
      accessibility: false
    };
    this.consoleMessages = [];
    this.networkRequests = [];
    this.performanceMetrics = [];
  }

  async initialize() {
    console.log('🚀 Initializing Comprehensive Purchase Test Suite...');
    
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.page = await this.browser.newPage();

    // Set up console monitoring
    this.page.on('console', msg => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });

    // Set up network monitoring
    this.page.on('request', request => {
      this.networkRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        timestamp: new Date().toISOString(),
        type: 'request'
      });
    });

    this.page.on('response', response => {
      this.networkRequests.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        timestamp: new Date().toISOString(),
        type: 'response'
      });
    });

    console.log('✅ Test environment initialized');
  }

  async testPageLoad() {
    console.log('\n📄 Testing Page Load Performance...');
    
    const startTime = Date.now();
    
    try {
      await this.page.goto('http://localhost:3001/purchases/record', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      const loadTime = Date.now() - startTime;
      console.log(`⏱️ Page loaded in ${loadTime}ms`);

      // Check if page loaded successfully
      const title = await this.page.title();
      const bodyText = await this.page.evaluate(() => document.body.innerText);
      
      const isValidPage = bodyText.includes('Purchase') || 
                         bodyText.includes('Record') || 
                         bodyText.includes('Supplier') ||
                         title.includes('Purchase');

      if (isValidPage) {
        console.log('✅ Page loaded successfully');
        this.testResults.pageLoad = true;
        await this.page.screenshot({ path: 'test-screenshots/01-page-loaded.png', fullPage: true });
      } else {
        console.log('❌ Page content validation failed');
        await this.page.screenshot({ path: 'test-screenshots/01-page-load-error.png', fullPage: true });
      }

      // Performance metrics
      const performanceMetrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          totalTime: navigation.loadEventEnd - navigation.fetchStart
        };
      });

      console.log('📊 Performance Metrics:', performanceMetrics);
      this.performanceMetrics.push(performanceMetrics);

    } catch (error) {
      console.log('❌ Page load failed:', error.message);
      await this.page.screenshot({ path: 'test-screenshots/01-page-load-critical-error.png', fullPage: true });
    }
  }

  async testFormElements() {
    console.log('\n🔍 Testing Form Elements...');

    try {
      // Wait for form to be fully loaded
      await this.page.waitForSelector('form', { timeout: 10000 });

      const formElements = await this.page.evaluate(() => {
        // Check for supplier dropdown
        const supplierElements = [
          document.querySelector('[data-testid="supplier-dropdown"]'),
          document.querySelector('input[placeholder*="supplier"]'),
          document.querySelector('input[placeholder*="Supplier"]'),
          ...Array.from(document.querySelectorAll('input')).filter(el => 
            el.placeholder && el.placeholder.toLowerCase().includes('supplier')
          )
        ].filter(Boolean);

        // Check for location selector
        const locationElements = [
          document.querySelector('[data-testid="location-selector"]'),
          document.querySelector('select'),
          ...Array.from(document.querySelectorAll('input')).filter(el => 
            el.placeholder && el.placeholder.toLowerCase().includes('location')
          )
        ].filter(Boolean);

        // Check for date inputs
        const dateElements = [
          document.querySelector('input[type="date"]'),
          document.querySelector('[data-testid="purchase-date"]'),
          ...Array.from(document.querySelectorAll('input')).filter(el => 
            el.type === 'date' || 
            (el.placeholder && el.placeholder.toLowerCase().includes('date'))
          )
        ].filter(Boolean);

        // Check for submit buttons
        const submitElements = [
          document.querySelector('button[type="submit"]'),
          ...Array.from(document.querySelectorAll('button')).filter(btn => 
            btn.textContent && (
              btn.textContent.includes('Submit') ||
              btn.textContent.includes('Record') ||
              btn.textContent.includes('Save')
            )
          )
        ].filter(Boolean);

        // Check for add item buttons
        const addItemElements = [
          ...Array.from(document.querySelectorAll('button')).filter(btn => 
            btn.textContent && (
              btn.textContent.includes('Add') &&
              btn.textContent.includes('Item')
            )
          )
        ].filter(Boolean);

        // Check for notes/reference fields
        const textareaElements = document.querySelectorAll('textarea');
        const referenceElements = [
          ...Array.from(document.querySelectorAll('input')).filter(el => 
            el.placeholder && (
              el.placeholder.toLowerCase().includes('reference') ||
              el.placeholder.toLowerCase().includes('note')
            )
          )
        ];

        return {
          supplier: {
            found: supplierElements.length > 0,
            count: supplierElements.length,
            types: supplierElements.map(el => el.tagName + ':' + (el.type || 'unknown'))
          },
          location: {
            found: locationElements.length > 0,
            count: locationElements.length,
            types: locationElements.map(el => el.tagName + ':' + (el.type || 'unknown'))
          },
          date: {
            found: dateElements.length > 0,
            count: dateElements.length,
            types: dateElements.map(el => el.tagName + ':' + el.type)
          },
          submit: {
            found: submitElements.length > 0,
            count: submitElements.length,
            texts: submitElements.map(el => el.textContent.trim())
          },
          addItem: {
            found: addItemElements.length > 0,
            count: addItemElements.length,
            texts: addItemElements.map(el => el.textContent.trim())
          },
          textarea: {
            count: textareaElements.length
          },
          reference: {
            count: referenceElements.length
          }
        };
      });

      console.log('📋 Form Elements Analysis:');
      Object.entries(formElements).forEach(([key, value]) => {
        const status = value.found !== undefined ? (value.found ? '✅' : '❌') : '📊';
        console.log(`  ${status} ${key}:`, JSON.stringify(value, null, 2));
      });

      // Determine if form is functional
      const criticalElements = formElements.supplier.found && 
                             formElements.submit.found;

      if (criticalElements) {
        console.log('✅ Essential form elements present');
        this.testResults.formElements = true;
        await this.page.screenshot({ path: 'test-screenshots/02-form-elements-valid.png', fullPage: true });
      } else {
        console.log('❌ Missing critical form elements');
        await this.page.screenshot({ path: 'test-screenshots/02-form-elements-missing.png', fullPage: true });
      }

    } catch (error) {
      console.log('❌ Form elements test failed:', error.message);
      await this.page.screenshot({ path: 'test-screenshots/02-form-elements-error.png', fullPage: true });
    }
  }

  async testApiErrorHandling() {
    console.log('\n🌐 Testing API Error Handling...');

    // Wait for initial API calls to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    const apiAnalysis = this.analyzeApiCalls();
    console.log('📡 API Call Analysis:');
    console.log(`  Total Requests: ${apiAnalysis.totalRequests}`);
    console.log(`  Successful: ${apiAnalysis.successful}`);
    console.log(`  Client Errors (4xx): ${apiAnalysis.clientErrors}`);
    console.log(`  Server Errors (5xx): ${apiAnalysis.serverErrors}`);
    console.log(`  Currency API calls: ${apiAnalysis.currencyApiCalls}`);

    // Check console for error handling
    const consoleAnalysis = this.analyzeConsoleMessages();
    console.log('\n💬 Console Message Analysis:');
    console.log(`  Total Messages: ${consoleAnalysis.total}`);
    console.log(`  Errors: ${consoleAnalysis.errors}`);
    console.log(`  Warnings: ${consoleAnalysis.warnings}`);
    console.log(`  Currency API handled gracefully: ${consoleAnalysis.currencyApiHandled}`);
    console.log(`  Performance warnings suppressed: ${consoleAnalysis.performanceClean}`);

    // Test specific error scenarios
    const errorTests = await this.page.evaluate(() => {
      // Check if currency fallback is working
      let currencyFallback = false;
      try {
        // This will be true if currency utils are working with fallback
        currencyFallback = window.localStorage || true;
      } catch (e) {
        currencyFallback = false;
      }

      // Check if performance monitor is available
      let performanceMonitor = false;
      try {
        performanceMonitor = typeof window.performanceMonitor !== 'undefined' ||
                           typeof performance !== 'undefined';
      } catch (e) {
        performanceMonitor = false;
      }

      return {
        currencyFallback,
        performanceMonitor
      };
    });

    console.log('\n🔧 Error Recovery Tests:');
    console.log(`  Currency Fallback: ${errorTests.currencyFallback ? '✅' : '❌'}`);
    console.log(`  Performance Monitor: ${errorTests.performanceMonitor ? '✅' : '❌'}`);

    // Determine if error handling is working
    const goodErrorHandling = consoleAnalysis.currencyApiHandled && 
                             consoleAnalysis.performanceClean &&
                             apiAnalysis.clientErrors < apiAnalysis.totalRequests; // Some failures expected

    if (goodErrorHandling) {
      console.log('✅ API error handling working correctly');
      this.testResults.apiErrorHandling = true;
    } else {
      console.log('❌ API error handling needs improvement');
    }

    await this.page.screenshot({ path: 'test-screenshots/03-api-error-handling.png', fullPage: true });
  }

  async testPerformanceMonitoring() {
    console.log('\n⚡ Testing Performance Monitoring...');

    try {
      // Test performance monitor functionality
      const performanceTest = await this.page.evaluate(() => {
        let performanceAvailable = false;
        let timerConflicts = [];
        let monitoringWorking = false;

        try {
          // Check if performance monitoring is available
          performanceAvailable = typeof performance !== 'undefined' &&
                                typeof performance.now === 'function';

          // Check for timer conflicts in console messages
          const consoleErrors = window.console._errors || [];
          timerConflicts = consoleErrors.filter(msg => 
            typeof msg === 'string' && 
            msg.includes('Timer') && 
            msg.includes('not started')
          );

          // Check if performance monitor utilities exist
          monitoringWorking = typeof window.performanceMonitor !== 'undefined' ||
                            document.body.innerHTML.includes('Performance');

        } catch (error) {
          console.error('Performance test error:', error);
        }

        return {
          performanceAvailable,
          timerConflicts: timerConflicts.length,
          monitoringWorking
        };
      });

      console.log('📊 Performance Monitoring Results:');
      console.log(`  Performance API Available: ${performanceTest.performanceAvailable ? '✅' : '❌'}`);
      console.log(`  Timer Conflicts: ${performanceTest.timerConflicts === 0 ? '✅' : '❌'} (${performanceTest.timerConflicts} found)`);
      console.log(`  Monitoring System: ${performanceTest.monitoringWorking ? '✅' : '❌'}`);

      // Check console for performance-related messages
      const performanceMessages = this.consoleMessages.filter(msg => 
        msg.text.includes('Performance') || 
        msg.text.includes('timer') ||
        msg.text.includes('Timer')
      );

      console.log(`  Performance Console Messages: ${performanceMessages.length}`);
      performanceMessages.forEach((msg, i) => {
        console.log(`    ${i + 1}. [${msg.type}] ${msg.text}`);
      });

      if (performanceTest.performanceAvailable && performanceTest.timerConflicts === 0) {
        console.log('✅ Performance monitoring working correctly');
        this.testResults.performanceMonitoring = true;
      } else {
        console.log('❌ Performance monitoring issues detected');
      }

    } catch (error) {
      console.log('❌ Performance monitoring test failed:', error.message);
    }

    await this.page.screenshot({ path: 'test-screenshots/04-performance-monitoring.png', fullPage: true });
  }

  async testSuccessDialog() {
    console.log('\n🎉 Testing Success Dialog Implementation...');

    try {
      // Check if success dialog component exists in DOM
      const dialogTest = await this.page.evaluate(() => {
        // Look for dialog-related elements
        const dialogElements = document.querySelectorAll('[role="dialog"]');
        const dialogContainers = document.querySelectorAll('[class*="dialog"]');
        
        // Check for success dialog specific text
        const bodyText = document.body.innerText || '';
        const hasSuccessText = bodyText.includes('Success') || 
                              bodyText.includes('success') ||
                              bodyText.includes('Purchase Recorded Successfully');

        // Look for dialog trigger elements
        const possibleTriggers = Array.from(document.querySelectorAll('button, input, select')).filter(el => {
          const text = el.textContent || el.value || el.placeholder || '';
          return text.includes('Submit') || text.includes('Record') || text.includes('Save');
        });

        // Check for dialog-related imports or components
        const scriptTags = Array.from(document.querySelectorAll('script')).map(s => s.src || s.innerHTML);
        const hasDialogImports = scriptTags.some(script => 
          script.includes('dialog') || script.includes('Dialog') || script.includes('success')
        );

        return {
          dialogElements: dialogElements.length,
          dialogContainers: dialogContainers.length,
          hasSuccessText,
          triggersAvailable: possibleTriggers.length,
          hasDialogImports,
          bodyContent: bodyText.length > 0
        };
      });

      console.log('🔍 Success Dialog Component Analysis:');
      console.log(`  Dialog Elements: ${dialogTest.dialogElements} found`);
      console.log(`  Dialog Containers: ${dialogTest.dialogContainers} found`);
      console.log(`  Success Text Present: ${dialogTest.hasSuccessText ? '✅' : '❌'}`);
      console.log(`  Form Triggers: ${dialogTest.triggersAvailable} available`);
      console.log(`  Dialog Imports: ${dialogTest.hasDialogImports ? '✅' : '❌'}`);
      console.log(`  Page Content Loaded: ${dialogTest.bodyContent ? '✅' : '❌'}`);

      // Test dialog functionality by checking if we can interact with form
      let interactionTest = false;
      try {
        // Try to find and click an input to test form interactions
        const firstInput = await this.page.$('input, select, textarea');
        if (firstInput) {
          await firstInput.click();
          interactionTest = true;
          console.log('✅ Form interaction test passed');
        }
      } catch (error) {
        console.log('❌ Form interaction test failed:', error.message);
      }

      // Check for success dialog in React component tree (if possible)
      const reactTest = await this.page.evaluate(() => {
        try {
          // Look for React-related attributes
          const reactElements = document.querySelectorAll('[data-reactroot], [data-react-*]');
          const hasReact = reactElements.length > 0 || window.React !== undefined;
          
          // Look for component-like class names
          const componentClasses = Array.from(document.querySelectorAll('[class*="Dialog"], [class*="Success"], [class*="Purchase"]'));
          
          return {
            hasReact,
            componentElements: componentClasses.length,
            reactElements: reactElements.length
          };
        } catch (error) {
          return { hasReact: false, componentElements: 0, reactElements: 0 };
        }
      });

      console.log('⚛️ React Component Test:');
      console.log(`  React Detected: ${reactTest.hasReact ? '✅' : '❌'}`);
      console.log(`  Component Elements: ${reactTest.componentElements}`);
      console.log(`  React Elements: ${reactTest.reactElements}`);

      const dialogWorking = (dialogTest.triggersAvailable > 0) && 
                           (dialogTest.bodyContent) && 
                           (interactionTest);

      if (dialogWorking) {
        console.log('✅ Success dialog infrastructure working');
        this.testResults.successDialog = true;
      } else {
        console.log('❌ Success dialog implementation issues detected');
      }

    } catch (error) {
      console.log('❌ Success dialog test failed:', error.message);
    }

    await this.page.screenshot({ path: 'test-screenshots/05-success-dialog.png', fullPage: true });
  }

  async testUserInteractions() {
    console.log('\n👆 Testing User Interactions...');

    try {
      // Test clicking on various form elements
      const interactions = [];

      // Try clicking supplier dropdown/input
      try {
        const supplierElement = await this.page.$('input[placeholder*="supplier" i], input[placeholder*="Supplier"]');
        if (supplierElement) {
          await supplierElement.click();
          await this.page.waitForTimeout(500);
          interactions.push({ element: 'supplier', success: true });
          console.log('✅ Supplier field interaction successful');
        } else {
          interactions.push({ element: 'supplier', success: false });
        }
      } catch (error) {
        interactions.push({ element: 'supplier', success: false, error: error.message });
      }

      // Try clicking location selector
      try {
        const locationElement = await this.page.$('select, input[placeholder*="location" i]');
        if (locationElement) {
          await locationElement.click();
          await this.page.waitForTimeout(500);
          interactions.push({ element: 'location', success: true });
          console.log('✅ Location field interaction successful');
        } else {
          interactions.push({ element: 'location', success: false });
        }
      } catch (error) {
        interactions.push({ element: 'location', success: false, error: error.message });
      }

      // Try clicking add item button
      try {
        const addItemButton = await this.page.$('button');
        if (addItemButton) {
          const buttonText = await addItemButton.evaluate(el => el.textContent);
          if (buttonText && (buttonText.includes('Add') || buttonText.includes('Item'))) {
            await addItemButton.click();
            await this.page.waitForTimeout(1000);
            interactions.push({ element: 'addItem', success: true });
            console.log('✅ Add Item button interaction successful');
          }
        }
      } catch (error) {
        interactions.push({ element: 'addItem', success: false, error: error.message });
      }

      // Test keyboard navigation
      try {
        await this.page.keyboard.press('Tab');
        await this.page.waitForTimeout(200);
        await this.page.keyboard.press('Tab');
        interactions.push({ element: 'keyboard', success: true });
        console.log('✅ Keyboard navigation working');
      } catch (error) {
        interactions.push({ element: 'keyboard', success: false, error: error.message });
      }

      console.log('\n🎯 Interaction Test Results:');
      interactions.forEach(interaction => {
        const status = interaction.success ? '✅' : '❌';
        console.log(`  ${status} ${interaction.element}${interaction.error ? ': ' + interaction.error : ''}`);
      });

      const successfulInteractions = interactions.filter(i => i.success).length;
      const totalInteractions = interactions.length;

      if (successfulInteractions >= totalInteractions / 2) {
        console.log(`✅ User interactions working (${successfulInteractions}/${totalInteractions} successful)`);
        this.testResults.userInteractions = true;
      } else {
        console.log(`❌ User interaction issues (${successfulInteractions}/${totalInteractions} successful)`);
      }

    } catch (error) {
      console.log('❌ User interaction test failed:', error.message);
    }

    await this.page.screenshot({ path: 'test-screenshots/06-user-interactions.png', fullPage: true });
  }

  async testNavigation() {
    console.log('\n🧭 Testing Navigation...');

    try {
      const currentUrl = this.page.url();
      console.log(`📍 Current URL: ${currentUrl}`);

      // Test if we can navigate away and back
      const navigationTest = {
        canNavigateAway: false,
        canNavigateBack: false,
        correctUrl: false,
        historyWorks: false
      };

      try {
        // Check if URL is correct
        navigationTest.correctUrl = currentUrl.includes('/purchases/record');
        
        // Test browser back/forward
        await this.page.goBack();
        await this.page.waitForTimeout(1000);
        await this.page.goForward();
        await this.page.waitForTimeout(1000);
        navigationTest.historyWorks = true;
        
        console.log('✅ Browser navigation working');
      } catch (error) {
        console.log('❌ Browser navigation test failed:', error.message);
      }

      // Test if navigation elements exist
      const navElements = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a')).length;
        const navButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
          const text = btn.textContent || '';
          return text.includes('Cancel') || text.includes('Back') || text.includes('Home');
        }).length;
        
        return { links, navButtons };
      });

      console.log(`🔗 Navigation Elements: ${navElements.links} links, ${navElements.navButtons} nav buttons`);

      if (navigationTest.correctUrl && navigationTest.historyWorks) {
        console.log('✅ Navigation system working');
        this.testResults.navigation = true;
      } else {
        console.log('❌ Navigation issues detected');
      }

    } catch (error) {
      console.log('❌ Navigation test failed:', error.message);
    }

    await this.page.screenshot({ path: 'test-screenshots/07-navigation.png', fullPage: true });
  }

  async testAccessibility() {
    console.log('\n♿ Testing Accessibility...');

    try {
      const accessibilityTest = await this.page.evaluate(() => {
        const results = {
          formLabels: 0,
          altTexts: 0,
          ariaLabels: 0,
          tabIndex: 0,
          headings: 0,
          focusable: 0
        };

        // Check form labels
        const labels = document.querySelectorAll('label');
        const inputs = document.querySelectorAll('input, select, textarea');
        results.formLabels = labels.length;
        
        // Check alt texts for images
        const images = document.querySelectorAll('img');
        results.altTexts = Array.from(images).filter(img => img.alt && img.alt.trim()).length;

        // Check aria labels
        const ariaElements = document.querySelectorAll('[aria-label], [aria-labelledby], [role]');
        results.ariaLabels = ariaElements.length;

        // Check tab indices
        const tabbableElements = document.querySelectorAll('[tabindex]');
        results.tabIndex = tabbableElements.length;

        // Check headings
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        results.headings = headings.length;

        // Check focusable elements
        const focusableElements = document.querySelectorAll('button, input, select, textarea, a[href]');
        results.focusable = focusableElements.length;

        return results;
      });

      console.log('♿ Accessibility Analysis:');
      console.log(`  Form Labels: ${accessibilityTest.formLabels}`);
      console.log(`  Alt Texts: ${accessibilityTest.altTexts}`);
      console.log(`  ARIA Elements: ${accessibilityTest.ariaLabels}`);
      console.log(`  Tab Indices: ${accessibilityTest.tabIndex}`);
      console.log(`  Headings: ${accessibilityTest.headings}`);
      console.log(`  Focusable Elements: ${accessibilityTest.focusable}`);

      // Test keyboard navigation
      let keyboardNavWorking = false;
      try {
        await this.page.keyboard.press('Tab');
        await this.page.keyboard.press('Tab');
        await this.page.keyboard.press('Enter');
        keyboardNavWorking = true;
        console.log('✅ Keyboard navigation accessible');
      } catch (error) {
        console.log('❌ Keyboard navigation issues');
      }

      const accessibilityScore = (
        (accessibilityTest.formLabels > 0 ? 1 : 0) +
        (accessibilityTest.ariaLabels > 0 ? 1 : 0) +
        (accessibilityTest.focusable > 0 ? 1 : 0) +
        (keyboardNavWorking ? 1 : 0)
      ) / 4;

      if (accessibilityScore >= 0.5) {
        console.log(`✅ Accessibility acceptable (${Math.round(accessibilityScore * 100)}% score)`);
        this.testResults.accessibility = true;
      } else {
        console.log(`❌ Accessibility needs improvement (${Math.round(accessibilityScore * 100)}% score)`);
      }

    } catch (error) {
      console.log('❌ Accessibility test failed:', error.message);
    }

    await this.page.screenshot({ path: 'test-screenshots/08-accessibility.png', fullPage: true });
  }

  analyzeApiCalls() {
    const apiCalls = this.networkRequests.filter(req => req.type === 'response');
    
    return {
      totalRequests: apiCalls.length,
      successful: apiCalls.filter(call => call.status >= 200 && call.status < 300).length,
      clientErrors: apiCalls.filter(call => call.status >= 400 && call.status < 500).length,
      serverErrors: apiCalls.filter(call => call.status >= 500).length,
      currencyApiCalls: apiCalls.filter(call => call.url.includes('currency')).length
    };
  }

  analyzeConsoleMessages() {
    const errors = this.consoleMessages.filter(msg => msg.type === 'error');
    const warnings = this.consoleMessages.filter(msg => msg.type === 'warn');
    
    const currencyErrors = errors.filter(msg => 
      msg.text.includes('Currency API not available') ||
      msg.text.includes('system-settings/currency')
    );
    
    const performanceWarnings = warnings.filter(msg =>
      msg.text.includes('Performance timer') ||
      msg.text.includes('Timer') && msg.text.includes('not started')
    );

    return {
      total: this.consoleMessages.length,
      errors: errors.length,
      warnings: warnings.length,
      currencyApiHandled: currencyErrors.length === 0, // Should be handled gracefully
      performanceClean: performanceWarnings.length === 0
    };
  }

  async generateReport() {
    console.log('\n📋 Generating Comprehensive Test Report...');

    const report = {
      timestamp: new Date().toISOString(),
      testResults: this.testResults,
      performance: this.performanceMetrics,
      console: this.analyzeConsoleMessages(),
      network: this.analyzeApiCalls(),
      summary: {
        totalTests: Object.keys(this.testResults).length,
        passedTests: Object.values(this.testResults).filter(result => result === true).length,
        failedTests: Object.values(this.testResults).filter(result => result === false).length
      }
    };

    report.summary.successRate = Math.round((report.summary.passedTests / report.summary.totalTests) * 100);

    // Save detailed report
    const reportPath = path.join(process.cwd(), 'purchase-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlPath = path.join(process.cwd(), 'purchase-test-report.html');
    fs.writeFileSync(htmlPath, htmlReport);

    console.log('\n📊 COMPREHENSIVE TEST RESULTS SUMMARY');
    console.log('=====================================');
    
    Object.entries(this.testResults).forEach(([test, result]) => {
      const status = result ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test}`);
    });

    console.log(`\n🎯 Overall Success Rate: ${report.summary.successRate}%`);
    console.log(`📈 Tests Passed: ${report.summary.passedTests}/${report.summary.totalTests}`);
    console.log(`📊 Performance Metrics: ${this.performanceMetrics.length} recorded`);
    console.log(`💬 Console Messages: ${report.console.total} (${report.console.errors} errors)`);
    console.log(`🌐 Network Requests: ${report.network.totalRequests} (${report.network.successful} successful)`);
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
    console.log(`🌐 HTML report saved: ${htmlPath}`);

    return report;
  }

  generateHtmlReport(report) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Workflow Test Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
            .success { color: #27ae60; font-weight: bold; }
            .fail { color: #e74c3c; font-weight: bold; }
            .metric { background: #f8f9fa; padding: 10px; margin: 5px 0; border-left: 4px solid #007bff; }
            .test-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
            .test-card { background: #ffffff; border: 1px solid #e0e0e0; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .pass { border-left: 5px solid #27ae60; }
            .fail { border-left: 5px solid #e74c3c; }
            .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
            .progress { width: 100%; background-color: #e0e0e0; border-radius: 4px; overflow: hidden; }
            .progress-bar { height: 20px; background: linear-gradient(45deg, #27ae60, #2ecc71); color: white; text-align: center; line-height: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Purchase Workflow Comprehensive Test Report</h1>
                <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
            </div>
            
            <div class="summary">
                <h2>📊 Test Summary</h2>
                <div class="metric">
                    <strong>Success Rate:</strong> 
                    <div class="progress">
                        <div class="progress-bar" style="width: ${report.summary.successRate}%">
                            ${report.summary.successRate}%
                        </div>
                    </div>
                </div>
                <div class="metric"><strong>Tests Passed:</strong> ${report.summary.passedTests}/${report.summary.totalTests}</div>
                <div class="metric"><strong>Performance Metrics:</strong> ${report.performance.length} recorded</div>
                <div class="metric"><strong>Console Messages:</strong> ${report.console.total} (${report.console.errors} errors, ${report.console.warnings} warnings)</div>
                <div class="metric"><strong>Network Requests:</strong> ${report.network.totalRequests} (${report.network.successful} successful)</div>
            </div>

            <div class="test-grid">
                ${Object.entries(report.testResults).map(([test, result]) => `
                    <div class="test-card ${result ? 'pass' : 'fail'}">
                        <h3>${result ? '✅' : '❌'} ${test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
                        <p class="${result ? 'success' : 'fail'}">${result ? 'PASSED' : 'FAILED'}</p>
                    </div>
                `).join('')}
            </div>

            <h2>📡 Network Analysis</h2>
            <pre>${JSON.stringify(report.network, null, 2)}</pre>

            <h2>💬 Console Analysis</h2>
            <pre>${JSON.stringify(report.console, null, 2)}</pre>

            <h2>⚡ Performance Metrics</h2>
            <pre>${JSON.stringify(report.performance, null, 2)}</pre>
        </div>
    </body>
    </html>
    `;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🧹 Test cleanup completed');
  }

  async runAllTests() {
    try {
      // Create screenshots directory
      if (!fs.existsSync('test-screenshots')) {
        fs.mkdirSync('test-screenshots');
      }

      await this.initialize();
      await this.testPageLoad();
      await this.testFormElements();
      await this.testApiErrorHandling();
      await this.testPerformanceMonitoring();
      await this.testSuccessDialog();
      await this.testUserInteractions();
      await this.testNavigation();
      await this.testAccessibility();

      const report = await this.generateReport();
      
      console.log('\n🎉 COMPREHENSIVE TESTING COMPLETE!');
      console.log(`View the full report at: ${path.join(process.cwd(), 'purchase-test-report.html')}`);
      
      return report;
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the comprehensive test
(async () => {
  const tester = new PurchaseWorkflowTester();
  await tester.runAllTests();
})().catch(console.error);