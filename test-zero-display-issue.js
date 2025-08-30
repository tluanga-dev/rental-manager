/**
 * Puppeteer test to check for unwanted zero displays in ItemForm
 * Tests specifically for zeros after reorder point and rental rate fields
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  headless: false, // Set to true for CI/CD
  slowMo: 100 // Slow down actions for better visibility
};

class ZeroDisplayTester {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
    this.issues = [];
  }

  async initialize() {
    console.log('🚀 Initializing Zero Display Test...');
    
    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      defaultViewport: { width: 1200, height: 800 },
      args: ['--disable-dev-shm-usage', '--no-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Enable console logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });

    await this.page.setDefaultTimeout(this.config.timeout);
  }

  async navigateToItemForm() {
    console.log('📍 Navigating to item creation form...');
    
    try {
      await this.page.goto(`${this.config.baseUrl}/products/items/new`, {
        waitUntil: 'networkidle2'
      });
      
      await this.page.waitForSelector('[data-testid="item-name-input"]', {
        timeout: 10000
      });
      
      console.log('✅ Successfully loaded item form');
      return true;
    } catch (error) {
      console.error('❌ Failed to load item form:', error.message);
      return false;
    }
  }

  async takeScreenshot(filename) {
    const screenshotPath = `test-screenshots/${filename}-${Date.now()}.png`;
    await this.page.screenshot({ 
      path: screenshotPath, 
      fullPage: true 
    });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  async checkFieldValue(fieldId, fieldName) {
    console.log(`🔍 Checking ${fieldName} field (${fieldId})...`);
    
    try {
      const field = await this.page.$(`#${fieldId}`);
      if (!field) {
        console.log(`⚠️  ${fieldName} field not found`);
        return null;
      }

      const value = await field.evaluate(el => el.value);
      const placeholder = await field.evaluate(el => el.placeholder);
      const displayedText = await field.evaluate(el => el.textContent || '');
      
      console.log(`   Value: "${value}"`);
      console.log(`   Placeholder: "${placeholder}"`);
      console.log(`   Displayed text: "${displayedText}"`);

      // Check for problematic zero displays
      if (value === '0' || value === '-0' || displayedText.includes('-0')) {
        this.issues.push({
          field: fieldName,
          fieldId: fieldId,
          issue: `Field shows "${value}" instead of placeholder`,
          value: value,
          placeholder: placeholder
        });
        console.log(`❌ Issue found: ${fieldName} shows "${value}"`);
        return false;
      }

      console.log(`✅ ${fieldName} field looks good`);
      return true;
    } catch (error) {
      console.error(`❌ Error checking ${fieldName}:`, error.message);
      return false;
    }
  }

  async checkForVisibleZeros() {
    console.log('🔍 Checking for visible zeros on the page...');
    
    // Get all text content on the page
    const pageText = await this.page.evaluate(() => {
      return document.body.innerText;
    });

    // Look for problematic patterns
    const problematicPatterns = [
      /-0(\s|$)/g,  // -0 followed by space or end
      /\s0\s/g,     // standalone zeros
      /^0$/g        // exactly zero
    ];

    const foundIssues = [];
    
    problematicPatterns.forEach((pattern, index) => {
      const matches = pageText.match(pattern);
      if (matches) {
        foundIssues.push({
          pattern: pattern.toString(),
          matches: matches,
          count: matches.length
        });
      }
    });

    if (foundIssues.length > 0) {
      console.log('❌ Found problematic zero displays:');
      foundIssues.forEach(issue => {
        console.log(`   Pattern ${issue.pattern}: ${issue.count} matches`);
        issue.matches.forEach(match => {
          console.log(`     - "${match}"`);
        });
      });
    } else {
      console.log('✅ No problematic zero displays found in page text');
    }

    return foundIssues;
  }

  async checkSpecificFields() {
    console.log('🔍 Checking specific form fields for zero displays...');
    
    const fieldsToCheck = [
      { id: 'reorder_point', name: 'Reorder Point' },
      { id: 'rental_rate_per_period', name: 'Rental Rate' },
      { id: 'security_deposit', name: 'Security Deposit' },
      { id: 'sale_price', name: 'Sale Price' },
      { id: 'warranty_period_days', name: 'Warranty Period' },
      { id: 'initial_stock_quantity', name: 'Initial Stock Quantity' }
    ];

    const results = {};
    
    for (const field of fieldsToCheck) {
      const result = await this.checkFieldValue(field.id, field.name);
      results[field.name] = result;
    }

    return results;
  }

  async checkForUnwantedText() {
    console.log('🔍 Checking for unwanted text displays...');
    
    // Check for text that might appear after fields
    const unwantedTexts = await this.page.evaluate(() => {
      const issues = [];
      
      // Look for elements containing just "0" or "-0"
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const text = el.textContent.trim();
        if (text === '0' || text === '-0') {
          // Check if this is actually a form input value we care about
          const isInput = el.tagName === 'INPUT';
          const isInFormContext = el.closest('form') !== null;
          
          if (!isInput && isInFormContext) {
            issues.push({
              text: text,
              element: el.tagName,
              className: el.className,
              id: el.id,
              parentContext: el.parentElement?.tagName || 'unknown'
            });
          }
        }
      });
      
      return issues;
    });

    if (unwantedTexts.length > 0) {
      console.log('❌ Found unwanted text displays:');
      unwantedTexts.forEach(issue => {
        console.log(`   Text: "${issue.text}" in ${issue.element} (class: ${issue.className})`);
        this.issues.push({
          field: 'Unknown',
          fieldId: issue.id || 'unknown',
          issue: `Unwanted text "${issue.text}" displayed`,
          element: issue.element,
          className: issue.className
        });
      });
    } else {
      console.log('✅ No unwanted text displays found');
    }

    return unwantedTexts;
  }

  async runTests() {
    console.log('🧪 Starting Zero Display Tests...');
    console.log('='.repeat(50));
    
    try {
      // Navigate to form
      if (!await this.navigateToItemForm()) {
        throw new Error('Failed to navigate to item form');
      }

      // Take initial screenshot
      await this.takeScreenshot('initial-form-load');

      // Wait for form to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check specific fields
      console.log('\n📋 Checking specific form fields...');
      const fieldResults = await this.checkSpecificFields();

      // Check for visible zeros in page text
      console.log('\n📋 Checking page text for problematic zeros...');
      const textIssues = await this.checkForVisibleZeros();

      // Check for unwanted text displays
      console.log('\n📋 Checking for unwanted text displays...');
      const unwantedTexts = await this.checkForUnwantedText();

      // Take final screenshot
      await this.takeScreenshot('final-form-state');

      // Generate report
      await this.generateReport(fieldResults, textIssues, unwantedTexts);

    } catch (error) {
      console.error('💥 Test failed with error:', error);
      await this.takeScreenshot('error-state');
      throw error;
    }
  }

  async generateReport(fieldResults, textIssues, unwantedTexts) {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));

    // Field results summary
    console.log('🔍 Form Field Results:');
    Object.entries(fieldResults).forEach(([fieldName, result]) => {
      const status = result === true ? '✅ PASS' : (result === false ? '❌ FAIL' : '⚠️  NOT FOUND');
      console.log(`   ${fieldName}: ${status}`);
    });

    // Text issues summary
    console.log('\n📝 Page Text Issues:');
    if (textIssues.length === 0) {
      console.log('   ✅ No problematic text patterns found');
    } else {
      textIssues.forEach(issue => {
        console.log(`   ❌ Pattern ${issue.pattern}: ${issue.count} matches`);
      });
    }

    // Unwanted text summary
    console.log('\n🔍 Unwanted Text Displays:');
    if (unwantedTexts.length === 0) {
      console.log('   ✅ No unwanted text displays found');
    } else {
      unwantedTexts.forEach(issue => {
        console.log(`   ❌ "${issue.text}" in ${issue.element}`);
      });
    }

    // Overall issues summary
    console.log('\n🚨 Issues Found:');
    if (this.issues.length === 0) {
      console.log('   ✅ No issues detected!');
    } else {
      this.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.field} (${issue.fieldId}): ${issue.issue}`);
      });
    }

    // Create detailed report file
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: this.issues.length,
        fieldsChecked: Object.keys(fieldResults).length,
        textIssuesFound: textIssues.length,
        unwantedTextFound: unwantedTexts.length
      },
      fieldResults,
      textIssues,
      unwantedTexts,
      detailedIssues: this.issues
    };

    const fs = require('fs');
    const reportPath = `test-reports/zero-display-test-${Date.now()}.json`;
    
    // Ensure directory exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    return this.issues.length === 0;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const tester = new ZeroDisplayTester(TEST_CONFIG);
  
  try {
    await tester.initialize();
    await tester.runTests();
    
    const success = tester.issues.length === 0;
    console.log(`\n${success ? '✅' : '❌'} Test ${success ? 'PASSED' : 'FAILED'}`);
    
    if (!success) {
      console.log(`Found ${tester.issues.length} issues that need to be fixed.`);
    }
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { ZeroDisplayTester };