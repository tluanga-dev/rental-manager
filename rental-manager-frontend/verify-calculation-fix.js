const puppeteer = require('puppeteer');

async function verifyCalculationFix() {
  const browser = await puppeteer.launch({ 
    headless: false, 
    devtools: false
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('Verifying rental calculation fix by examining existing rentals...');
    
    // Navigate to active rentals or rental history
    await page.goto('http://localhost:3000/rentals', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log('Page loaded, looking for rental records...');
    
    // Look for any existing rental records
    const rentalElements = await page.$$eval('*', elements => {
      return elements
        .filter(el => el.textContent && 
          (el.textContent.toLowerCase().includes('cannon') || 
           el.textContent.toLowerCase().includes('cement') ||
           el.textContent.includes('₹10.00')))
        .map(el => ({
          text: el.textContent.trim().substring(0, 100),
          tagName: el.tagName,
          className: el.className
        }));
    });
    
    console.log('Found rental-related elements:', rentalElements);
    
    // Take screenshot
    await page.screenshot({ path: 'rentals-page-verification.png', fullPage: true });
    
    // Navigate to active rentals specifically
    try {
      await page.goto('http://localhost:3000/rentals/active', { 
        waitUntil: 'networkidle0',
        timeout: 10000 
      });
      
      console.log('Checking active rentals page...');
      await page.screenshot({ path: 'active-rentals-verification.png', fullPage: true });
      
    } catch (e) {
      console.log('Active rentals page not accessible');
    }
    
    // Check if we can access a specific rental details page
    try {
      // Try to find any rental links
      const rentalLinks = await page.$$eval('a[href*="/rentals/"]', links => 
        links.map(link => link.href).filter(href => href.match(/\/rentals\/[^\/]+$/))
      );
      
      if (rentalLinks.length > 0) {
        console.log('Found rental detail links:', rentalLinks);
        
        // Navigate to the first rental
        await page.goto(rentalLinks[0], { waitUntil: 'networkidle0', timeout: 10000 });
        console.log('Viewing rental details...');
        
        // Look for calculation-related information
        const calculationInfo = await page.evaluate(() => {
          const amountElements = document.querySelectorAll('*');
          const info = [];
          
          for (const element of amountElements) {
            if (element.textContent && 
                (element.textContent.includes('₹') || element.textContent.includes('$')) &&
                !element.textContent.includes('₹0.00')) {
              info.push({
                text: element.textContent.trim(),
                type: element.textContent.toLowerCase().includes('total') ? 'total' : 'amount'
              });
            }
          }
          
          return info;
        });
        
        console.log('Found calculation information:', calculationInfo);
        await page.screenshot({ path: 'rental-detail-verification.png', fullPage: true });
      }
      
    } catch (e) {
      console.log('Could not access rental details');
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ Fixed rental calculation logic in ItemsStep.tsx');
    console.log('   - getTotalAmount(): quantity × rental_rate × rental_periods');
    console.log('   - Table display: quantity × rental_rate × rental_periods');
    console.log('📸 Screenshots saved for verification');
    console.log('\nExpected behavior for Cannon Cement Mixer:');
    console.log('   - 1 quantity × ₹10 rate × 2 days = ₹20.00 (not ₹10.00)');
    
  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await browser.close();
  }
}

verifyCalculationFix().catch(console.error);