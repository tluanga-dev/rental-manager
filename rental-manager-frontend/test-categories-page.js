const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Testing categories page...\n');
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });
    
    // Monitor network requests
    const apiRequests = [];
    page.on('response', response => {
      if (response.url().includes('/v1/categories')) {
        apiRequests.push({
          url: response.url(),
          status: response.status()
        });
      }
    });
    
    // Navigate to categories page
    console.log('📄 Loading /products/categories page...');
    await page.goto('http://localhost:3005/products/categories', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait a moment for data to load
    await page.waitForTimeout(2000);
    
    // Check if categories loaded
    const pageContent = await page.evaluate(() => {
      const stats = {
        totalCategories: document.querySelector('[class*="CardContent"] .text-2xl')?.textContent || '0',
        hasTreeContent: document.querySelector('[class*="CategoryTree"]') !== null,
        hasTableRows: document.querySelectorAll('tbody tr').length,
        errorMessages: Array.from(document.querySelectorAll('*')).filter(el => 
          el.textContent && el.textContent.includes('Failed to load categories')
        ).length
      };
      return stats;
    });
    
    console.log('\n📊 Page Analysis:');
    console.log('   Total Categories:', pageContent.totalCategories);
    console.log('   Has Tree Component:', pageContent.hasTreeContent);
    console.log('   Table Rows:', pageContent.hasTableRows);
    console.log('   Error Messages:', pageContent.errorMessages);
    
    console.log('\n📡 API Requests Made:');
    apiRequests.forEach(req => {
      console.log(`   ${req.status === 200 ? '✅' : '❌'} ${req.url} - Status: ${req.status}`);
    });
    
    // Check specific elements
    const hasCategories = await page.evaluate(() => {
      // Check if "Construction" or "Machinery" categories are visible
      const elements = Array.from(document.querySelectorAll('*'));
      const hasConstruction = elements.some(el => 
        el.textContent && el.textContent.includes('Construction')
      );
      const hasMachinery = elements.some(el => 
        el.textContent && el.textContent.includes('Machinery')
      );
      const hasCatering = elements.some(el => 
        el.textContent && el.textContent.includes('Catering')
      );
      
      return { hasConstruction, hasMachinery, hasCatering };
    });
    
    console.log('\n📋 Categories Found:');
    console.log('   Construction:', hasCategories.hasConstruction ? '✅ Yes' : '❌ No');
    console.log('   Machinery:', hasCategories.hasMachinery ? '✅ Yes' : '❌ No');
    console.log('   Catering:', hasCategories.hasCatering ? '✅ Yes' : '❌ No');
    
    // Final verdict
    if (pageContent.errorMessages > 0) {
      console.log('\n❌ Categories page has errors - Failed to load categories');
    } else if (pageContent.hasTableRows > 0 || hasCategories.hasConstruction) {
      console.log('\n✅ Categories page is working correctly!');
      console.log('✅ Categories are displaying properly.');
    } else {
      console.log('\n⚠️ Categories page loaded but no categories are displayed');
      console.log('   This might be because there are no categories in the database');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Test completed');
  }
})();