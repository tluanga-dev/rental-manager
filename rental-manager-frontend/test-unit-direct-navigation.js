const puppeteer = require('puppeteer');

async function testUnitDirectNavigation() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('[DEV-AUTH]') && !text.includes('Permission Check')) {
        console.log('PAGE LOG:', text);
      }
    });
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    // Test with a dummy unit ID
    const unitId = '123';
    const testUrl = `http://localhost:3002/inventory/units/${unitId}?itemId=1&itemName=Test%20Item`;
    
    console.log('1. Navigating directly to unit detail page...');
    console.log('   URL:', testUrl);
    
    await page.goto(testUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if we're on the unit detail page
    const currentUrl = page.url();
    console.log('2. Current URL:', currentUrl);
    
    // Check for page elements
    const pageContent = await page.evaluate(() => {
      const breadcrumb = document.querySelector('[aria-label="Breadcrumb"]');
      const h1 = document.querySelector('h1');
      const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map(t => t.textContent);
      
      return {
        hasBreadcrumb: !!breadcrumb,
        breadcrumbText: breadcrumb ? breadcrumb.textContent : null,
        h1Text: h1 ? h1.textContent : null,
        tabs: tabs,
        hasBackButton: !!document.querySelector('button:has-text("Back")'),
        hasRefreshButton: !!document.querySelector('button:has-text("Refresh")'),
        hasExportButton: !!document.querySelector('button:has-text("Export")'),
        hasEditButton: !!document.querySelector('button:has-text("Edit")')
      };
    }).catch(err => {
      console.log('Error evaluating page:', err);
      return null;
    });
    
    if (pageContent) {
      console.log('\n3. Page Analysis:');
      console.log('   Has Breadcrumb:', pageContent.hasBreadcrumb);
      if (pageContent.breadcrumbText) {
        console.log('   Breadcrumb:', pageContent.breadcrumbText);
      }
      console.log('   Page Title:', pageContent.h1Text);
      console.log('   Available Tabs:', pageContent.tabs);
      console.log('   Action Buttons:');
      console.log('     - Back:', pageContent.hasBackButton);
      console.log('     - Refresh:', pageContent.hasRefreshButton);
      console.log('     - Export:', pageContent.hasExportButton);
      console.log('     - Edit:', pageContent.hasEditButton);
      
      if (pageContent.tabs && pageContent.tabs.length > 0) {
        console.log('\n4. Testing tab navigation...');
        
        for (const tabName of pageContent.tabs) {
          if (tabName && tabName !== 'Unit Details') {
            console.log(`   Clicking on "${tabName}" tab...`);
            
            // Try to click the tab
            const clicked = await page.evaluate((name) => {
              const tab = Array.from(document.querySelectorAll('[role="tab"]'))
                .find(t => t.textContent && t.textContent.includes(name));
              if (tab) {
                tab.click();
                return true;
              }
              return false;
            }, tabName).catch(() => false);
            
            if (clicked) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              console.log(`   ✓ ${tabName} tab clicked`);
            }
          }
        }
      }
      
      // Check for error messages
      const errorMessage = await page.$eval('[role="alert"]', el => el.textContent).catch(() => null);
      if (errorMessage) {
        console.log('\n⚠️ Alert/Error on page:', errorMessage);
      }
      
      console.log('\n✅ Unit detail page loaded successfully!');
    } else {
      console.log('❌ Could not analyze page content');
    }
    
    console.log('\nTest completed. Browser will close in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

testUnitDirectNavigation().catch(console.error);