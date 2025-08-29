const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();

  try {
    // Navigate to the unit detail page
    console.log('📍 Navigating to unit detail page...');
    await page.goto('http://localhost:3000/inventory/items/MAC201-00001/units/3a4f8f4b-f180-4d10-9d9b-dc19a20ba04c', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for the page to load
    await new Promise(r => setTimeout(r, 2000));

    // Click on the Analytics tab
    console.log('📊 Clicking on Analytics tab...');
    // Analytics is the 4th tab (index 3)
    const tabs = await page.$$('button[role="tab"]');
    if (tabs[3]) { 
      await tabs[3].click();
      console.log('✓ Clicked on Analytics tab');
    } else {
      console.log('⚠️ Could not find Analytics tab');
    }

    // Wait for analytics to load
    await new Promise(r => setTimeout(r, 2000));

    // Check if analytics are displayed
    const analyticsContent = await page.evaluate(() => {
      // Look for the metric cards by searching for text content
      const hasText = (element, text) => {
        return element.textContent && element.textContent.includes(text);
      };
      
      const allElements = document.querySelectorAll('*');
      let revenueCard = false;
      let utilizationCard = false;
      let rentalsCard = false;
      
      allElements.forEach(el => {
        if (hasText(el, 'Total Revenue')) revenueCard = true;
        if (hasText(el, 'Utilization Rate')) utilizationCard = true;
        if (hasText(el, 'Total Rentals')) rentalsCard = true;
      });
      
      // Get the metric values
      const cards = document.querySelectorAll('.text-2xl.font-bold');
      const values = [];
      cards.forEach(card => {
        values.push(card.textContent);
      });
      
      // Check for error message
      let hasError = false;
      allElements.forEach(el => {
        if (hasText(el, 'Analytics data unavailable')) hasError = true;
      });
      
      return {
        hasRevenueCard: revenueCard,
        hasUtilizationCard: utilizationCard,
        hasRentalsCard: rentalsCard,
        cardValues: values,
        hasError: hasError
      };
    });

    console.log('📈 Analytics Display:', analyticsContent);

    // Take a screenshot
    await page.screenshot({ 
      path: 'unit-analytics-display.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved as unit-analytics-display.png');

    // Check console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console error:', msg.text());
      }
    });

    await new Promise(r => setTimeout(r, 3000));

    console.log('✅ Analytics tab test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-analytics.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();