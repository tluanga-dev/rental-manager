const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false, 
    defaultViewport: { width: 1400, height: 900 },
    devtools: true 
  });
  
  const page = await browser.newPage();
  
  // Capture all console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    
    // Print specific debug messages
    if (text.includes('🔍') || text.includes('📦') || text.includes('✅') || text.includes('🎯')) {
      console.log(text);
    }
  });
  
  console.log('🌐 Navigating to inventory detail page...');
  await page.goto('http://localhost:3000/inventory/items/6fb55465-8030-435c-82ea-090224a32a53', {
    waitUntil: 'networkidle0'
  });
  
  // Wait for React to render
  await new Promise(r => setTimeout(r, 3000));
  
  // Click Units Only tab
  console.log('\n📊 Clicking Units Only tab...');
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const unitsTab = tabs.find(tab => tab.textContent.includes('Units Only'));
    if (unitsTab) {
      unitsTab.click();
      return true;
    }
    return false;
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Check table content
  const tableInfo = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const firstRow = rows[0];
    if (firstRow) {
      const cells = firstRow.querySelectorAll('td');
      return {
        rowCount: rows.length,
        firstRowText: firstRow.textContent,
        cellCount: cells.length,
        firstCellText: cells[0]?.textContent
      };
    }
    return { rowCount: rows.length };
  });
  
  console.log('\n📊 Table Info:', JSON.stringify(tableInfo, null, 2));
  
  // Print summary of logs
  console.log('\n📋 Debug Log Summary:');
  const debugLogs = logs.filter(l => 
    l.includes('🔍') || l.includes('📦') || l.includes('✅') || l.includes('🎯')
  );
  
  if (debugLogs.length === 0) {
    console.log('  ⚠️ No debug logs found - changes may not be loaded');
  } else {
    debugLogs.forEach(log => console.log('  ', log));
  }
  
  await browser.close();
})();