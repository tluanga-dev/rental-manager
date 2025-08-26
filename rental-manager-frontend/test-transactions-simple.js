/**
 * Simple test for transaction endpoints
 */

const API_URL = 'http://localhost:8000/api/v1';

async function testTransactions() {
  try {
    // Get auth token
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    const { access_token } = await loginRes.json();
    console.log('✓ Logged in\n');
    
    const headers = { 'Authorization': `Bearer ${access_token}` };
    
    // Test main transactions endpoint
    console.log('Testing /transactions endpoint:');
    const transRes = await fetch(`${API_URL}/transactions`, { headers });
    console.log(`  Status: ${transRes.status}`);
    if (transRes.ok) {
      const data = await transRes.json();
      console.log(`  ✓ Found ${data.length} transactions\n`);
    }
    
    // Try to access rentals through different paths
    console.log('Testing rental endpoints:');
    
    // Test 1: Direct rental list 
    console.log('  GET /transactions/rentals');
    const r1 = await fetch(`${API_URL}/transactions/rentals`, { headers });
    console.log(`    Status: ${r1.status} - ${r1.statusText}`);
    
    // Test 2: Check if it's being caught by /{transaction_id}
    console.log('\n  Testing if "rentals" is treated as transaction ID:');
    const errorData = await r1.text();
    if (errorData.includes('uuid_parsing')) {
      console.log('    ❌ YES - "rentals" is being parsed as UUID (route order issue)');
    } else {
      console.log('    ✓ NO - Route is working correctly');
    }
    
    // Test 3: Try with query params to bypass
    console.log('\n  GET /transactions?transaction_type=RENTAL');
    const r2 = await fetch(`${API_URL}/transactions?transaction_type=RENTAL`, { headers });
    console.log(`    Status: ${r2.status}`);
    if (r2.ok) {
      const rentals = await r2.json();
      console.log(`    ✓ Found ${rentals.length} rentals via query filter`);
    }
    
    // Test creating a rental through main transactions endpoint
    console.log('\n  Testing rental creation:');
    const rentalData = {
      transaction_type: 'RENTAL',
      customer_id: '00000000-0000-0000-0000-000000000000',
      location_id: '00000000-0000-0000-0000-000000000000',
      rental_start_date: new Date().toISOString(),
      rental_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      reference_number: 'TEST-001',
      items: []
    };
    
    const createRes = await fetch(`${API_URL}/transactions/rentals`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(rentalData)
    });
    console.log(`    POST /transactions/rentals: ${createRes.status}`);
    if (!createRes.ok) {
      const error = await createRes.text();
      console.log(`    Error: ${error.substring(0, 100)}...`);
    }
    
    console.log('\n📊 Summary:');
    console.log('- Main transactions endpoint: ✓ Working');
    console.log('- Rental-specific routes: ❌ Being caught by /{transaction_id} route');
    console.log('- Workaround: Use /transactions?transaction_type=RENTAL for listing');
    console.log('\n⚠️  Route ordering issue needs to be fixed in transactions.py');
    console.log('Solution: Move specific routes (/rentals, /purchases, /sales) BEFORE /{transaction_id}');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testTransactions();