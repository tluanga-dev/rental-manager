/**
 * Puppeteer test to verify the new layout of ItemForm
 * Tests that Sale Price, Initial Stock Quantity, and Rental Rate are in the same row with equal sizes
 */

const puppeteer = require('puppeteer');

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  headless: false, // Set to true for CI/CD
  slowMo: 100
};

class LayoutTester {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    console.log('🚀 Initializing Layout Verification Test...');
    
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
    console.log('🔍 Verifying field layout...');
    
    try {
      // Get the positions and sizes of the three main fields
      const fieldPositions = await this.page.evaluate(() => {
        const salePriceField = document.querySelector('#sale_price');
        const stockQuantityField = document.querySelector('#initial_stock_quantity');
        const rentalRateField = document.querySelector('#rental_rate_per_period');
        
        if (!salePriceField || !stockQuantityField || !rentalRateField) {
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
          rentalRate: getSizeAndPosition(rentalRateField)
        };
      });
      
      if (!fieldPositions) {
        throw new Error('Could not find all three fields');
      }
      
      console.log('📊 Field positions and sizes:');
      console.log('   Sale Price:', fieldPositions.salePrice);
      console.log('   Stock Quantity:', fieldPositions.stockQuantity);
      console.log('   Rental Rate:', fieldPositions.rentalRate);
      
      // Check if fields are in the same row (similar Y positions)
      const yTolerance = 10; // pixels
      const sameRow = Math.abs(fieldPositions.salePrice.y - fieldPositions.stockQuantity.y) < yTolerance &&
                      Math.abs(fieldPositions.salePrice.y - fieldPositions.rentalRate.y) < yTolerance;
      
      // Check if fields have similar widths (equal sizes)
      const widthTolerance = 20; // pixels
      const widthDiff1 = Math.abs(fieldPositions.salePrice.width - fieldPositions.stockQuantity.width);
      const widthDiff2 = Math.abs(fieldPositions.salePrice.width - fieldPositions.rentalRate.width);
      const widthDiff3 = Math.abs(fieldPositions.stockQuantity.width - fieldPositions.rentalRate.width);
      
      const similarSizes = widthDiff1 < widthTolerance && 
                          widthDiff2 < widthTolerance && 
                          widthDiff3 < widthTolerance;
      
      // Check left-to-right order
      const correctOrder = fieldPositions.salePrice.left < fieldPositions.stockQuantity.left &&
                          fieldPositions.stockQuantity.left < fieldPositions.rentalRate.left;
      
      console.log('\n✅ Layout Analysis:');
      console.log(`   Fields in same row: ${sameRow ? '✅' : '❌'}`);
      console.log(`   Fields have similar sizes: ${similarSizes ? '✅' : '❌'}`);
      console.log(`   Correct left-to-right order: ${correctOrder ? '✅' : '❌'}`);
      console.log(`   Width differences: ${widthDiff1}px, ${widthDiff2}px, ${widthDiff3}px`);
      
      return {
        sameRow,
        similarSizes,
        correctOrder,
        widthDifferences: [widthDiff1, widthDiff2, widthDiff3],
        fieldPositions
      };
      
    } catch (error) {
      console.error('❌ Error verifying layout:', error.message);
      return null;
    }
  }

  async checkGridStructure() {
    console.log('🔍 Checking grid structure...');
    
    try {
      const gridInfo = await this.page.evaluate(() => {
        // Find the container with the three fields
        const containers = document.querySelectorAll('.grid');
        let targetContainer = null;
        
        for (let container of containers) {
          const salePriceInside = container.querySelector('#sale_price');
          const stockQuantityInside = container.querySelector('#initial_stock_quantity');
          const rentalRateInside = container.querySelector('#rental_rate_per_period');
          
          if (salePriceInside && stockQuantityInside && rentalRateInside) {
            targetContainer = container;
            break;
          }
        }
        
        if (!targetContainer) {
          return null;
        }
        
        const classes = Array.from(targetContainer.classList);
        const hasThreeColumns = classes.includes('md:grid-cols-3');
        const hasOneColumn = classes.includes('grid-cols-1');
        
        return {
          classes: classes,
          hasThreeColumns,
          hasOneColumn,
          innerHTML: targetContainer.outerHTML.substring(0, 200) + '...' // First 200 chars for debugging
        };
      });
      
      if (!gridInfo) {
        console.log('⚠️  Could not find target grid container');
        return false;
      }
      
      console.log('📋 Grid Structure:');
      console.log(`   Classes: ${gridInfo.classes.join(' ')}`);
      console.log(`   Has 3 columns on md: ${gridInfo.hasThreeColumns ? '✅' : '❌'}`);
      console.log(`   Has 1 column on small: ${gridInfo.hasOneColumn ? '✅' : '❌'}`);
      
      return gridInfo.hasThreeColumns && gridInfo.hasOneColumn;
      
    } catch (error) {
      console.error('❌ Error checking grid structure:', error.message);
      return false;
    }
  }

  async runTests() {
    console.log('🧪 Starting Layout Verification Tests...');
    console.log('='.repeat(50));
    
    try {
      // Navigate to form
      if (!await this.navigateToItemForm()) {
        throw new Error('Failed to navigate to item form');
      }

      // Take initial screenshot
      await this.takeScreenshot('new-layout-verification');

      // Wait for form to be fully rendered
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check grid structure
      console.log('\n📋 Checking CSS grid structure...');
      const gridCorrect = await this.checkGridStructure();

      // Verify field layout
      console.log('\n📋 Verifying field positioning and sizes...');
      const layoutResults = await this.verifyFieldLayout();

      // Generate report
      const success = gridCorrect && 
                     layoutResults?.sameRow && 
                     layoutResults?.similarSizes && 
                     layoutResults?.correctOrder;
      
      console.log('\n📊 FINAL RESULTS:');
      console.log('='.repeat(30));
      console.log(`Grid Structure: ${gridCorrect ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Same Row: ${layoutResults?.sameRow ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Similar Sizes: ${layoutResults?.similarSizes ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Correct Order: ${layoutResults?.correctOrder ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Overall: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (layoutResults?.widthDifferences) {
        console.log(`Width Differences: ${layoutResults.widthDifferences.join('px, ')}px`);
      }

      return success;
      
    } catch (error) {
      console.error('💥 Test failed with error:', error);
      await this.takeScreenshot('layout-test-error');
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
  const tester = new LayoutTester(TEST_CONFIG);
  
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

module.exports = { LayoutTester };