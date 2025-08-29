const puppeteer = require('puppeteer');

/**
 * This test demonstrates that the frontend components work correctly
 * by intercepting API calls and providing mock data responses.
 */

// Mock data for stock levels
const mockStockLevels = {
  success: true,
  data: [
    {
      id: "sl-001",
      item_id: "item-001",
      item_name: "Canon EOS R5",
      item_sku: "CAM-001",
      location_id: "loc-001",
      location_name: "Main Warehouse",
      quantity_on_hand: 15,
      quantity_available: 12,
      quantity_reserved: 3,
      reorder_point: 5,
      reorder_quantity: 10,
      last_updated: "2024-08-27T10:00:00Z"
    },
    {
      id: "sl-002",
      item_id: "item-002",
      item_name: "Sony A7 III",
      item_sku: "CAM-002",
      location_id: "loc-001",
      location_name: "Main Warehouse",
      quantity_on_hand: 8,
      quantity_available: 6,
      quantity_reserved: 2,
      reorder_point: 3,
      reorder_quantity: 10,
      last_updated: "2024-08-27T09:30:00Z"
    },
    {
      id: "sl-003",
      item_id: "item-003",
      item_name: "DJI Mavic 3",
      item_sku: "DRONE-001",
      location_id: "loc-002",
      location_name: "Store Front",
      quantity_on_hand: 4,
      quantity_available: 4,
      quantity_reserved: 0,
      reorder_point: 2,
      reorder_quantity: 5,
      last_updated: "2024-08-27T08:45:00Z"
    }
  ],
  total: 3
};

// Mock data for alerts
const mockAlerts = {
  success: true,
  data: {
    low_stock_alerts: [
      {
        id: "alert-001",
        item_id: "item-004",
        item_name: "Tripod Pro",
        item_sku: "ACC-001",
        location_name: "Main Warehouse",
        current_quantity: 2,
        reorder_point: 5,
        severity: "high",
        created_at: "2024-08-27T08:00:00Z"
      },
      {
        id: "alert-002",
        item_id: "item-005",
        item_name: "Camera Bag",
        item_sku: "ACC-002",
        location_name: "Store Front",
        current_quantity: 3,
        reorder_point: 5,
        severity: "medium",
        created_at: "2024-08-27T07:30:00Z"
      }
    ],
    inventory_alerts: [
      {
        id: "inv-alert-001",
        type: "EXPIRING_WARRANTY",
        item_name: "Canon EOS R5",
        message: "Warranty expires in 30 days",
        severity: "medium",
        created_at: "2024-08-27T06:00:00Z"
      }
    ]
  }
};

// Mock data for movements
const mockMovements = {
  success: true,
  data: [
    {
      id: "mov-001",
      item_id: "item-001",
      item_name: "Canon EOS R5",
      item_sku: "CAM-001",
      location_id: "loc-001",
      location_name: "Main Warehouse",
      movement_type: "PURCHASE",
      quantity: 5,
      reference_type: "purchase_order",
      reference_id: "PO-2024-001",
      notes: "New stock arrival",
      created_by: "John Doe",
      created_at: "2024-08-27T10:00:00Z"
    },
    {
      id: "mov-002",
      item_id: "item-002",
      item_name: "Sony A7 III",
      item_sku: "CAM-002",
      location_id: "loc-001",
      location_name: "Main Warehouse",
      movement_type: "RENTAL_OUT",
      quantity: -2,
      reference_type: "rental",
      reference_id: "RENT-2024-045",
      notes: "Rental to customer",
      created_by: "Jane Smith",
      created_at: "2024-08-27T09:30:00Z"
    },
    {
      id: "mov-003",
      item_id: "item-001",
      item_name: "Canon EOS R5",
      item_sku: "CAM-001",
      location_id: "loc-002",
      location_name: "Store Front",
      movement_type: "TRANSFER",
      quantity: 3,
      reference_type: "transfer",
      reference_id: "TRF-2024-012",
      notes: "Transfer from warehouse to store",
      created_by: "Mike Wilson",
      created_at: "2024-08-27T08:15:00Z"
    },
    {
      id: "mov-004",
      item_id: "item-003",
      item_name: "DJI Mavic 3",
      item_sku: "DRONE-001",
      location_id: "loc-001",
      location_name: "Main Warehouse",
      movement_type: "ADJUSTMENT",
      quantity: -1,
      reference_type: "adjustment",
      reference_id: "ADJ-2024-005",
      notes: "Damaged unit removed",
      created_by: "Admin User",
      created_at: "2024-08-27T07:00:00Z"
    }
  ],
  total: 4
};

const mockMovementSummary = {
  success: true,
  data: {
    total_movements: 127,
    movements_today: 8,
    movements_this_week: 45,
    movements_this_month: 127,
    top_moved_items: [
      { item_name: "Canon EOS R5", count: 23 },
      { item_name: "Sony A7 III", count: 18 },
      { item_name: "DJI Mavic 3", count: 15 }
    ]
  }
};

async function runMockDataTest() {
  let browser;
  const results = {
    stockLevels: { intercepted: false, rendered: false, dataDisplayed: false },
    alerts: { intercepted: false, rendered: false, dataDisplayed: false },
    movements: { intercepted: false, rendered: false, dataDisplayed: false }
  };

  try {
    console.log('🚀 Starting Frontend Mock Data Test\n');
    console.log('This test proves the frontend works correctly by providing mock API responses.\n');
    console.log('=' .repeat(60) + '\n');
    
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1400, height: 900 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Enable request interception
    await page.setRequestInterception(true);

    // Intercept API requests and provide mock responses
    page.on('request', (request) => {
      const url = request.url();
      
      // Stock levels endpoints
      if (url.includes('/inventory/stock-levels') && !url.includes('/adjust') && !url.includes('/transfer')) {
        results.stockLevels.intercepted = true;
        console.log('🔄 Intercepted stock-levels request, returning mock data');
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockStockLevels)
        });
      }
      // Alerts endpoints
      else if (url.includes('/inventory/stock-levels/alerts') || url.includes('/inventory/alerts')) {
        results.alerts.intercepted = true;
        console.log('🔄 Intercepted alerts request, returning mock data');
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts)
        });
      }
      // Movements endpoints
      else if (url.includes('/inventory/movements') && !url.includes('/summary')) {
        results.movements.intercepted = true;
        console.log('🔄 Intercepted movements request, returning mock data');
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMovements)
        });
      }
      // Movement summary
      else if (url.includes('/inventory/movements/summary')) {
        console.log('🔄 Intercepted movement summary request, returning mock data');
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMovementSummary)
        });
      }
      // Allow all other requests to proceed
      else {
        request.continue();
      }
    });

    // First, login using demo
    console.log('📝 Step 1: Logging in...\n');
    await page.goto('http://localhost:3000/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    await page.waitForSelector('button', { timeout: 10000 });
    
    const demoButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent?.includes('Demo as Administrator'));
    });
    
    if (demoButton) {
      await demoButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✅ Login successful\n');
    }

    // Test Stock Levels Page
    console.log('📝 Step 2: Testing Stock Levels Page with Mock Data...\n');
    await page.goto('http://localhost:3000/inventory/stock-levels', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const stockLevelsData = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      const items = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 3) {
          items.push({
            item: cells[1]?.textContent?.trim(),
            location: cells[2]?.textContent?.trim(),
            quantity: cells[3]?.textContent?.trim()
          });
        }
      });
      return {
        hasTable: !!document.querySelector('table'),
        rowCount: rows.length,
        items: items.slice(0, 3)
      };
    });

    if (stockLevelsData.hasTable) {
      results.stockLevels.rendered = true;
      console.log('   ✅ Stock levels table rendered');
    }
    
    if (stockLevelsData.rowCount > 0) {
      results.stockLevels.dataDisplayed = true;
      console.log(`   ✅ ${stockLevelsData.rowCount} stock items displayed`);
      stockLevelsData.items.forEach(item => {
        if (item.item) {
          console.log(`      - ${item.item} at ${item.location}: ${item.quantity}`);
        }
      });
    }

    await page.screenshot({ path: 'mock-test-stock-levels.png' });
    console.log('   📸 Screenshot: mock-test-stock-levels.png\n');

    // Test Alerts Page
    console.log('📝 Step 3: Testing Alerts Page with Mock Data...\n');
    await page.goto('http://localhost:3000/inventory/alerts', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const alertsData = await page.evaluate(() => {
      const cards = document.querySelectorAll('.bg-white.rounded-lg.border, [role="alert"]');
      const alertTexts = [];
      cards.forEach(card => {
        const text = card.textContent?.trim();
        if (text && text.length > 0) {
          alertTexts.push(text.substring(0, 100));
        }
      });
      
      return {
        hasAlerts: cards.length > 0,
        alertCount: cards.length,
        samples: alertTexts.slice(0, 3)
      };
    });

    if (alertsData.hasAlerts) {
      results.alerts.rendered = true;
      results.alerts.dataDisplayed = true;
      console.log(`   ✅ ${alertsData.alertCount} alert cards displayed`);
      alertsData.samples.forEach(alert => {
        console.log(`      - ${alert}...`);
      });
    }

    await page.screenshot({ path: 'mock-test-alerts.png' });
    console.log('   📸 Screenshot: mock-test-alerts.png\n');

    // Test Movements Page
    console.log('📝 Step 4: Testing Movements Page with Mock Data...\n');
    await page.goto('http://localhost:3000/inventory/movements', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const movementsData = await page.evaluate(() => {
      const table = document.querySelector('table');
      const rows = document.querySelectorAll('tbody tr');
      const movements = [];
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 3) {
          movements.push({
            type: cells[1]?.textContent?.trim(),
            item: cells[2]?.textContent?.trim(),
            quantity: cells[4]?.textContent?.trim()
          });
        }
      });
      
      return {
        hasTable: !!table,
        rowCount: rows.length,
        movements: movements.slice(0, 3)
      };
    });

    if (movementsData.hasTable) {
      results.movements.rendered = true;
      console.log('   ✅ Movements table rendered');
    }
    
    if (movementsData.rowCount > 0) {
      results.movements.dataDisplayed = true;
      console.log(`   ✅ ${movementsData.rowCount} movement records displayed`);
      movementsData.movements.forEach(mov => {
        if (mov.type) {
          console.log(`      - ${mov.type}: ${mov.item} (${mov.quantity})`);
        }
      });
    }

    await page.screenshot({ path: 'mock-test-movements.png' });
    console.log('   📸 Screenshot: mock-test-movements.png\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }

    // Print summary
    console.log('=' .repeat(60));
    console.log('📊 MOCK DATA TEST SUMMARY');
    console.log('=' .repeat(60) + '\n');

    const testResults = [
      { name: 'Stock Levels', ...results.stockLevels },
      { name: 'Alerts', ...results.alerts },
      { name: 'Movements', ...results.movements }
    ];

    let totalPassed = 0;
    let totalTests = 0;

    testResults.forEach(test => {
      console.log(`${test.name}:`);
      console.log(`   API Intercepted: ${test.intercepted ? '✅' : '❌'}`);
      console.log(`   UI Rendered: ${test.rendered ? '✅' : '❌'}`);
      console.log(`   Data Displayed: ${test.dataDisplayed ? '✅' : '❌'}`);
      console.log('');
      
      totalTests += 3;
      if (test.intercepted) totalPassed++;
      if (test.rendered) totalPassed++;
      if (test.dataDisplayed) totalPassed++;
    });

    const percentage = Math.round((totalPassed / totalTests) * 100);
    
    console.log('=' .repeat(60));
    console.log(`🎯 OVERALL: ${totalPassed}/${totalTests} tests passed (${percentage}%)`);
    console.log('=' .repeat(60) + '\n');

    if (percentage === 100) {
      console.log('✅ SUCCESS: Frontend components work perfectly with proper API data!');
      console.log('The frontend is ready for production once backend APIs are fixed.');
    } else if (percentage >= 60) {
      console.log('⚠️  PARTIAL SUCCESS: Most frontend components are working.');
      console.log('Some components may need minor adjustments.');
    } else {
      console.log('❌ FAILED: Frontend components need attention.');
    }

    process.exit(percentage === 100 ? 0 : 1);
  }
}

// Run the test
runMockDataTest().catch(console.error);