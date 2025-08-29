const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Simple Detail Page Test...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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
    
    console.log('⏳ Waiting for any content...');
    await page.waitForSelector('div', { timeout: 10000 });
    
    // Check what's actually on the page
    const pageAnalysis = await page.evaluate(() => {
      const title = document.title;
      const bodyContent = document.body.textContent.substring(0, 500);
      const hasLoading = !!document.querySelector('.animate-spin');
      const hasError = !!document.querySelector('.bg-red-50, .bg-red-100, [role="alert"]');
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim()).filter(t => t);
      
      return {
        title,
        url: window.location.href,
        hasLoading,
        hasError,
        headings: headings.slice(0, 5), // first 5 headings
        contentPreview: bodyContent.replace(/\s+/g, ' ').trim()
      };
    });
    
    console.log('📊 Page Analysis:');
    console.log('  Title:', pageAnalysis.title);
    console.log('  URL:', pageAnalysis.url);
    console.log('  Has loading spinner:', pageAnalysis.hasLoading);
    console.log('  Has error:', pageAnalysis.hasError);
    console.log('  Headings:', pageAnalysis.headings);
    console.log('  Content preview:', pageAnalysis.contentPreview.substring(0, 200) + '...');
    
    if (pageAnalysis.hasError) {
      console.log('❌ Error detected on page');
    } else if (pageAnalysis.hasLoading) {
      console.log('⏳ Page still loading');
    } else if (pageAnalysis.headings.length > 0) {
      console.log('✅ Page loaded successfully with content');
    } else {
      console.log('⚠️ Page loaded but content unclear');
    }
    
  } catch (error) {
    console.log('💥 Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();