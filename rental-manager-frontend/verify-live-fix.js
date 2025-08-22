const puppeteer = require('puppeteer');

async function verifyLiveFix() {
  console.log('🔍 Verifying if rental return fix is live on www.omomrentals.shop...\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable request interception
    await page.setRequestInterception(true);
    
    let capturedPayload = null;
    
    page.on('request', request => {
      // Capture any POST request to return-direct endpoint
      if (request.url().includes('return-direct') && request.method() === 'POST') {
        capturedPayload = request.postData();
        console.log('📡 Captured API request to return-direct endpoint!');
        console.log('Payload structure:', capturedPayload ? JSON.parse(capturedPayload) : 'No payload');
      }
      request.continue();
    });
    
    // Also monitor console logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('return') || text.includes('quantity')) {
        console.log('Console:', text);
      }
    });
    
    // Navigate directly to the site and check page source
    console.log('1️⃣ Fetching main page to get app version...');
    await page.goto('https://www.omomrentals.shop/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Get the page HTML
    const html = await page.content();
    
    // Look for Next.js build ID
    const buildIdMatch = html.match(/buildId":"([^"]+)"/);
    if (buildIdMatch) {
      console.log(`📦 Build ID: ${buildIdMatch[1]}`);
    }
    
    // Check for our specific code patterns in inline scripts
    console.log('\n2️⃣ Checking for fix patterns in page source...');
    
    const patterns = {
      'total_return_quantity': /total_return_quantity/,
      'quantity_good': /quantity_good/,
      'quantity_damaged': /quantity_damaged/,
      'return_quantity (old)': /return_quantity/,
      'MARK_DAMAGED case': /MARK_DAMAGED.*quantityDamaged/
    };
    
    for (const [name, pattern] of Object.entries(patterns)) {
      if (pattern.test(html)) {
        console.log(`✅ Found: ${name}`);
      } else {
        console.log(`❌ Not found: ${name}`);
      }
    }
    
    // Try to navigate to the actual app chunks
    console.log('\n3️⃣ Checking webpack chunks...');
    
    const chunkMatches = html.match(/\/\_next\/static\/chunks\/[\w-]+\.js/g);
    if (chunkMatches) {
      console.log(`Found ${chunkMatches.length} JS chunks`);
      
      // Check the first few chunks for our patterns
      for (let i = 0; i < Math.min(3, chunkMatches.length); i++) {
        const chunkUrl = `https://www.omomrentals.shop${chunkMatches[i]}`;
        try {
          await page.goto(chunkUrl, { timeout: 10000 });
          const chunkContent = await page.content();
          
          if (chunkContent.includes('total_return_quantity')) {
            console.log(`✅ Found 'total_return_quantity' in chunk ${i+1}`);
            break;
          }
          if (chunkContent.includes('quantity_good')) {
            console.log(`✅ Found 'quantity_good' in chunk ${i+1}`);
            break;
          }
        } catch (e) {
          // Ignore errors for individual chunks
        }
      }
    }
    
    console.log('\n📊 VERIFICATION SUMMARY:');
    console.log('------------------------');
    console.log('The fix deployment status will be confirmed based on the patterns found above.');
    console.log('If you see "total_return_quantity" and "quantity_good", the fix is deployed.');
    console.log('If you only see "return_quantity" without the new fields, the fix is not yet deployed.');
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  } finally {
    await browser.close();
  }
}

verifyLiveFix().catch(console.error);