const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Debugging Table Structure...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('📍 Navigating to inventory items page...');
    await page.goto('http://localhost:3000/inventory/items', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for table to load...');
    await page.waitForSelector('table', { timeout: 10000 });
    
    console.log('🔍 Analyzing table structure...');
    const tableInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const viewButtons = buttons.filter(btn => 
        btn.textContent.includes('View') || 
        btn.querySelector('svg[data-lucide="eye"]')
      );
      
      return {
        totalButtons: buttons.length,
        viewButtons: viewButtons.length,
        viewButtonTexts: viewButtons.map(btn => btn.textContent.trim()),
        firstViewButton: viewButtons[0] ? {
          innerHTML: viewButtons[0].innerHTML,
          outerHTML: viewButtons[0].outerHTML.substring(0, 200)
        } : null
      };
    });
    
    console.log('📊 Table Analysis:', JSON.stringify(tableInfo, null, 2));
    
  } catch (error) {
    console.log('💥 Debug failed:', error.message);
  } finally {
    await browser.close();
  }
})();