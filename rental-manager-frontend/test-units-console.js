const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false, 
    defaultViewport: { width: 1400, height: 900 } 
  });
  
  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🔍') || text.includes('📦')) {
      console.log(text);
    }
  });
  
  await page.goto('http://localhost:3000/inventory/items/6fb55465-8030-435c-82ea-090224a32a53', {
    waitUntil: 'networkidle0'
  });
  
  // Wait and then click Units Only tab
  await new Promise(r => setTimeout(r, 2000));
  
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const unitsTab = tabs.find(tab => tab.textContent.includes('Units Only'));
    if (unitsTab) unitsTab.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();