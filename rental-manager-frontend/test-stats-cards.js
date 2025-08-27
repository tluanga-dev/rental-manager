const puppeteer = require('puppeteer');

async function testStatsCards() {
  const browser = await puppeteer.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/inventory/locations', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for different card selectors
    const cardSelectors = [
      '.card',
      '[class*="card"]', 
      '.grid > div',
      '[class*="grid"] > div',
      '.space-y-6 > div:first-child > div',
      '.container .grid > div'
    ];
    
    for (const selector of cardSelectors) {
      const cards = await page.$$(selector);
      if (cards.length > 0) {
        console.log(`📊 Found ${cards.length} cards with selector: ${selector}`);
        
        // Get text content of first few cards
        for (let i = 0; i < Math.min(4, cards.length); i++) {
          const text = await cards[i].evaluate(el => el.textContent?.trim());
          console.log(`   Card ${i + 1}: ${text?.substring(0, 100)}...`);
        }
        break;
      }
    }
    
    await page.screenshot({ path: 'stats-cards-test.png', fullPage: true });
    console.log('Screenshot saved');
    
  } finally {
    await browser.close();
  }
}

testStatsCards().catch(console.error);