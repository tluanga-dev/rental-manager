const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Final Check: Categories Page\n');
    
    // Monitor API responses
    let apiSuccess = false;
    page.on('response', response => {
      if (response.url().includes('/categories/') && response.url().includes('api')) {
        console.log(`📡 API Response: ${response.status()} - ${response.url()}`);
        if (response.status() === 200) {
          apiSuccess = true;
        }
      }
    });
    
    // Navigate to categories page
    console.log('📄 Loading /products/categories...');
    await page.goto('http://localhost:3005/products/categories', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for data to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check page content
    const pageData = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      
      // Get stats
      const statsElements = document.querySelectorAll('.text-2xl');
      const totalCategories = statsElements[0]?.textContent || '0';
      
      // Check for categories
      const hasConstruction = bodyText.includes('Construction');
      const hasMachinery = bodyText.includes('Machinery');
      const hasCatering = bodyText.includes('Catering');
      const hasNoCategories = bodyText.includes('No categories found');
      
      // Count table rows
      const tableRows = document.querySelectorAll('tbody tr').length;
      
      return {
        totalCategories,
        hasConstruction,
        hasMachinery,
        hasCatering,
        hasNoCategories,
        tableRows
      };
    });
    
    console.log('\n📊 Results:');
    console.log('   API Call:', apiSuccess ? '✅ Success' : '❌ Failed');
    console.log('   Total Categories:', pageData.totalCategories);
    console.log('   Table Rows:', pageData.tableRows);
    console.log('   Shows "No categories":', pageData.hasNoCategories ? 'Yes' : 'No');
    
    console.log('\n📋 Categories Visible:');
    console.log('   Construction:', pageData.hasConstruction ? '✅ Yes' : '❌ No');
    console.log('   Machinery:', pageData.hasMachinery ? '✅ Yes' : '❌ No');
    console.log('   Catering:', pageData.hasCatering ? '✅ Yes' : '❌ No');
    
    // Final verdict
    if (apiSuccess && (pageData.hasConstruction || pageData.hasMachinery || pageData.hasCatering)) {
      console.log('\n✅ SUCCESS: Categories page is now working correctly!');
      console.log('✅ The CORS issue has been fixed.');
      console.log('✅ Categories are displaying properly.');
    } else if (!apiSuccess) {
      console.log('\n❌ FAILED: API call still failing (likely CORS issue)');
    } else {
      console.log('\n⚠️ WARNING: API succeeded but no categories visible');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
})();