const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing Detail Page Tabs...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate directly to a known item detail page
    const itemId = '6fb55465-8030-435c-82ea-090224a32a53';
    console.log('📍 Navigating to item detail page...');
    await page.goto(`http://localhost:3000/inventory/items/${itemId}`, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for content to load...');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    // Check for errors first
    const hasErrors = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('.bg-red-50, .bg-red-100, [role="alert"], .text-red-600');
      return Array.from(errorElements).map(el => el.textContent.trim()).filter(text => text.length > 0);
    });
    
    if (hasErrors.length > 0) {
      console.log('❌ Errors found on page:', hasErrors);
    } else {
      console.log('✅ No errors found on detail page');
    }
    
    // Check for main content
    const pageContent = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const tabs = Array.from(document.querySelectorAll('[role="tab"], .tab-trigger')).map(tab => tab.textContent.trim());
      const productInfo = document.querySelector('.space-y-4, .grid');
      
      return {
        title: h1 ? h1.textContent : 'No title found',
        hasTabs: tabs.length > 0,
        tabs: tabs,
        hasProductInfo: !!productInfo,
        url: window.location.href
      };
    });
    
    console.log('📊 Page Content Analysis:');
    console.log('  Title:', pageContent.title);
    console.log('  URL:', pageContent.url);
    console.log('  Has product info:', pageContent.hasProductInfo);
    console.log('  Tabs found:', pageContent.tabs);
    
    // Wait a bit for any async loading
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ Detail page test completed successfully');
    
  } catch (error) {
    console.log('💥 Test failed:', error.message);
  } finally {
    setTimeout(() => browser.close(), 5000); // Give user time to see the page
  }
})();