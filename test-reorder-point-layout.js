/**
 * Puppeteer test to verify the new layout with reorder point in first row
 * Tests that Sale Price, Initial Stock Quantity, and Reorder Point are in the same row with equal sizes
 */

const puppeteer = require('puppeteer');

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  headless: false,
  slowMo: 100
};

class ReorderPointLayoutTester {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    console.log('🚀 Initializing Reorder Point Layout Test...');
    
    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      defaultViewport: { width: 1200, height: 800 },
      args: ['--disable-dev-shm-usage', '--no-sandbox']
    });
    
    this.page = await this.browser.newPage();
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

  async verifyFieldLayout() {
    console.log('🔍 Verifying new field layout...');
    
    try {
      // Get the positions and sizes of the three fields in first row
      const firstRowFields = await this.page.evaluate(() => {
        const salePriceField = document.querySelector('#sale_price');
        const stockQuantityField = document.querySelector('#initial_stock_quantity');
        const reorderPointField = document.querySelector('#reorder_point');
        
        if (!salePriceField || !stockQuantityField || !reorderPointField) {
          return null;
        }
        
        const getSizeAndPosition = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
            top: rect.top,
            left: rect.left
          };
        };
        
        return {
          salePrice: getSizeAndPosition(salePriceField),
          stockQuantity: getSizeAndPosition(stockQuantityField),
          reorderPoint: getSizeAndPosition(reorderPointField)
        };
      });
      
      if (!firstRowFields) {
        throw new Error('Could not find all three fields in first row');
      }
      
      console.log('📊 First Row Field positions:');
      console.log('   Sale Price:', firstRowFields.salePrice);
      console.log('   Stock Quantity:', firstRowFields.stockQuantity);
      console.log('   Reorder Point:', firstRowFields.reorderPoint);
      
      // Check if fields are in the same row
      const yTolerance = 10;
      const sameRow = Math.abs(firstRowFields.salePrice.y - firstRowFields.stockQuantity.y) < yTolerance &&
                      Math.abs(firstRowFields.salePrice.y - firstRowFields.reorderPoint.y) < yTolerance;
      
      // Check similar sizes
      const widthTolerance = 20;
      const widthDiff1 = Math.abs(firstRowFields.salePrice.width - firstRowFields.stockQuantity.width);
      const widthDiff2 = Math.abs(firstRowFields.salePrice.width - firstRowFields.reorderPoint.width);
      const widthDiff3 = Math.abs(firstRowFields.stockQuantity.width - firstRowFields.reorderPoint.width);
      
      const similarSizes = widthDiff1 < widthTolerance && 
                          widthDiff2 < widthTolerance && 
                          widthDiff3 < widthTolerance;
      
      // Check correct order: Sale Price -> Stock Quantity -> Reorder Point
      const correctOrder = firstRowFields.salePrice.left < firstRowFields.stockQuantity.left &&
                          firstRowFields.stockQuantity.left < firstRowFields.reorderPoint.left;
      
      return {
        sameRow,
        similarSizes,
        correctOrder,
        widthDifferences: [widthDiff1, widthDiff2, widthDiff3],
        firstRowFields
      };
      
    } catch (error) {
      console.error('❌ Error verifying layout:', error.message);
      return null;
    }
  }

  async verifyRentalRatePosition() {
    console.log('🔍 Verifying rental rate is in rental section...');
    
    try {
      const rentalSectionFields = await this.page.evaluate(() => {
        const rentalRateField = document.querySelector('#rental_rate_per_period');
        const rentalPeriodField = document.querySelector('#rental_period');
        const securityDepositField = document.querySelector('#security_deposit');
        
        if (!rentalRateField || !rentalPeriodField || !securityDepositField) {
          return null;
        }
        
        const getSizeAndPosition = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
            top: rect.top,
            left: rect.left
          };
        };
        
        return {
          rentalRate: getSizeAndPosition(rentalRateField),
          rentalPeriod: getSizeAndPosition(rentalPeriodField),
          securityDeposit: getSizeAndPosition(securityDepositField)
        };
      });
      
      if (!rentalSectionFields) {
        console.log('⚠️  Could not find all rental section fields');
        return false;
      }
      
      console.log('📊 Rental Section Field positions:');
      console.log('   Rental Rate:', rentalSectionFields.rentalRate);
      console.log('   Rental Period:', rentalSectionFields.rentalPeriod);
      console.log('   Security Deposit:', rentalSectionFields.securityDeposit);
      
      // Check if rental fields are in the same row
      const yTolerance = 10;
      const rentalSameRow = Math.abs(rentalSectionFields.rentalRate.y - rentalSectionFields.rentalPeriod.y) < yTolerance &&
                           Math.abs(rentalSectionFields.rentalRate.y - rentalSectionFields.securityDeposit.y) < yTolerance;
      
      // Check correct order: Rental Rate -> Rental Period -> Security Deposit
      const rentalCorrectOrder = rentalSectionFields.rentalRate.left < rentalSectionFields.rentalPeriod.left &&
                                rentalSectionFields.rentalPeriod.left < rentalSectionFields.securityDeposit.left;
      
      return {
        rentalSameRow,
        rentalCorrectOrder,
        rentalSectionFields
      };
      
    } catch (error) {
      console.error('❌ Error verifying rental section:', error.message);
      return null;
    }
  }

  async runTests() {
    console.log('🧪 Starting Reorder Point Layout Tests...');
    console.log('='.repeat(50));
    
    try {
      // Navigate to form
      if (!await this.navigateToItemForm()) {
        throw new Error('Failed to navigate to item form');
      }

      // Take screenshot
      await this.takeScreenshot('reorder-point-layout-verification');

      // Wait for form to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify first row layout
      console.log('\n📋 Verifying first row layout...');
      const firstRowResults = await this.verifyFieldLayout();

      // Verify rental section layout
      console.log('\n📋 Verifying rental section layout...');
      const rentalResults = await this.verifyRentalRatePosition();

      // Generate report
      const firstRowSuccess = firstRowResults?.sameRow && 
                             firstRowResults?.similarSizes && 
                             firstRowResults?.correctOrder;
      
      const rentalSuccess = rentalResults?.rentalSameRow && rentalResults?.rentalCorrectOrder;
      
      console.log('\n📊 FINAL RESULTS:');
      console.log('='.repeat(30));
      console.log('FIRST ROW (Sale Price, Stock Qty, Reorder Point):');
      console.log(`   Same Row: ${firstRowResults?.sameRow ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Similar Sizes: ${firstRowResults?.similarSizes ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Correct Order: ${firstRowResults?.correctOrder ? '✅ PASS' : '❌ FAIL'}`);
      
      console.log('\nRENTAL SECTION (Rental Rate, Period, Security):');
      console.log(`   Same Row: ${rentalResults?.rentalSameRow ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Correct Order: ${rentalResults?.rentalCorrectOrder ? '✅ PASS' : '❌ FAIL'}`);
      
      const overallSuccess = firstRowSuccess && rentalSuccess;
      console.log(`\nOverall: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (firstRowResults?.widthDifferences) {
        console.log(`First Row Width Differences: ${firstRowResults.widthDifferences.join('px, ')}px`);
      }

      return overallSuccess;
      
    } catch (error) {
      console.error('💥 Test failed with error:', error);
      await this.takeScreenshot('reorder-point-layout-error');
      throw error;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const tester = new ReorderPointLayoutTester(TEST_CONFIG);
  
  try {
    await tester.initialize();
    const success = await tester.runTests();
    
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

module.exports = { ReorderPointLayoutTester };