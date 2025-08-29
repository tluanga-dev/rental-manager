const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(msg.text());
  });
  
  // Navigate and force refresh
  await page.goto('http://localhost:3000/inventory/items/6fb55465-8030-435c-82ea-090224a32a53');
  await page.reload({ waitUntil: 'networkidle0' });
  
  // Wait for data to load
  await new Promise(r => setTimeout(r, 3000));
  
  // Click Units Only tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const unitsTab = tabs.find(tab => tab.textContent.includes('Units Only'));
    if (unitsTab) unitsTab.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Check table content
  const tableContent = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    return rows.length;
  });
  
  console.log(`\n📊 Table rows found: ${tableContent}`);
  
  await browser.close();
})();