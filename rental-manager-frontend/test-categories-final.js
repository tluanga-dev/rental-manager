const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,  // Set to false to see the browser
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    console.log('🔍 Testing Categories Page...\n');
    
    // Navigate to categories page
    console.log('📄 Loading /products/categories page...');
    await page.goto('http://localhost:3005/products/categories', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for data to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check page content
    const pageData = await page.evaluate(() => {
      // Get all text content to search for categories
      const bodyText = document.body.innerText;
      
      // Get stats from the cards
      const cards = Array.from(document.querySelectorAll('.text-2xl'));
      const stats = cards.map(el => el.textContent);
      
      // Check for error messages
      const hasError = bodyText.includes('Failed to load categories');
      
      // Check for specific categories
      const hasConstruction = bodyText.includes('Construction');
      const hasMachinery = bodyText.includes('Machinery');
      const hasCatering = bodyText.includes('Catering');
      
      // Check table rows
      const tableRows = document.querySelectorAll('tbody tr').length;
      
      return {
        stats,
        hasError,
        hasConstruction,
        hasMachinery,
        hasCatering,
        tableRows,
        pageTitle: document.querySelector('h1')?.textContent
      };
    });
    
    console.log('\n📊 Page Analysis:');
    console.log('   Page Title:', pageData.pageTitle);
    console.log('   Stats Values:', pageData.stats);
    console.log('   Has Error:', pageData.hasError ? '❌ Yes' : '✅ No');
    console.log('   Table Rows:', pageData.tableRows);
    
    console.log('\n📋 Categories Found:');
    console.log('   Construction:', pageData.hasConstruction ? '✅ Found' : '❌ Not Found');
    console.log('   Machinery:', pageData.hasMachinery ? '✅ Found' : '❌ Not Found');  
    console.log('   Catering:', pageData.hasCatering ? '✅ Found' : '❌ Not Found');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'categories-page.png', fullPage: true });
    console.log('\n📸 Screenshot saved as categories-page.png');
    
    // Final verdict
    if (!pageData.hasError && (pageData.hasConstruction || pageData.hasMachinery || pageData.hasCatering)) {
      console.log('\n✅ SUCCESS: Categories page is working correctly!');
      console.log('✅ Categories are displaying as expected.');
    } else if (pageData.hasError) {
      console.log('\n❌ FAILED: Categories page shows error message');
    } else {
      console.log('\n⚠️ WARNING: Page loaded but no categories are visible');
      console.log('   Check the screenshot for more details');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    console.log('\n👀 Browser will remain open for manual inspection.');
    console.log('   Close the browser window when done.');
    // Keep browser open for manual inspection
  }
})();