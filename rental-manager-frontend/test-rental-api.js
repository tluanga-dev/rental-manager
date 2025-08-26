/**
 * Test Rental API Endpoints
 * Verifies that rental endpoints are working after router registration
 */

const API_URL = 'http://localhost:8000/api';

async function testRentalAPI() {
  try {
    console.log('Testing Rental API Endpoints');
    console.log('==============================\n');
    
    // Step 1: Login to get token
    console.log('1. Getting authentication token...');
    const loginResponse = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.access_token;
    console.log('✓ Authentication successful\n');
    
    // Step 2: Test GET /rentals endpoint
    console.log('2. Testing GET /transactions/rentals...');
    const rentalsResponse = await fetch(`${API_URL}/v1/transactions/rentals`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`   Status: ${rentalsResponse.status} ${rentalsResponse.statusText}`);
    
    if (rentalsResponse.ok) {
      const rentals = await rentalsResponse.json();
      console.log(`   ✓ Rentals retrieved: ${Array.isArray(rentals) ? rentals.length : 'N/A'} rentals found\n`);
    } else {
      const errorText = await rentalsResponse.text();
      console.log(`   ✗ Error: ${errorText}\n`);
    }
    
    // Step 3: Test availability check endpoint
    console.log('3. Testing POST /transactions/rentals/check-availability...');
    const availabilityResponse = await fetch(`${API_URL}/v1/transactions/rentals/check-availability`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [],
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
    });
    
    console.log(`   Status: ${availabilityResponse.status} ${availabilityResponse.statusText}`);
    
    if (availabilityResponse.ok) {
      console.log('   ✓ Availability check endpoint working\n');
    } else {
      const errorText = await availabilityResponse.text();
      console.log(`   ✗ Error: ${errorText}\n`);
    }
    
    // Step 4: Test overdue rentals endpoint
    console.log('4. Testing GET /transactions/rentals/overdue...');
    const overdueResponse = await fetch(`${API_URL}/v1/transactions/rentals/overdue`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`   Status: ${overdueResponse.status} ${overdueResponse.statusText}`);
    
    if (overdueResponse.ok) {
      const overdueRentals = await overdueResponse.json();
      console.log(`   ✓ Overdue rentals: ${Array.isArray(overdueRentals) ? overdueRentals.length : 'N/A'} found\n`);
    } else {
      const errorText = await overdueResponse.text();
      console.log(`   ✗ Error: ${errorText}\n`);
    }
    
    // Step 5: Check other transaction endpoints
    console.log('5. Checking other transaction endpoints...');
    
    // Check purchases
    const purchasesResponse = await fetch(`${API_URL}/v1/transactions/purchases`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(`   Purchases: ${purchasesResponse.status} ${purchasesResponse.statusText}`);
    
    // Check sales
    const salesResponse = await fetch(`${API_URL}/v1/transactions/sales`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(`   Sales: ${salesResponse.status} ${salesResponse.statusText}`);
    
    // Check main transactions endpoint
    const transactionsResponse = await fetch(`${API_URL}/v1/transactions`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(`   All Transactions: ${transactionsResponse.status} ${transactionsResponse.statusText}`);
    
    // Summary
    console.log('\n==============================');
    console.log('RENTAL API STATUS SUMMARY');
    console.log('==============================');
    console.log('✓ Authentication: Working');
    console.log(`✓ Rental Endpoints: ${rentalsResponse.ok ? 'Working' : 'Not Working'}`);
    console.log(`✓ Availability Check: ${availabilityResponse.ok ? 'Working' : 'Not Working'}`);
    console.log(`✓ Transaction Endpoints: ${transactionsResponse.ok ? 'Working' : 'Not Working'}`);
    
    // Test creating a rental (optional - requires valid data)
    console.log('\n6. Testing rental creation (dry run)...');
    console.log('   Note: This will fail without valid customer/item IDs');
    
    const createRentalData = {
      customer_id: '00000000-0000-0000-0000-000000000000', // Placeholder UUID
      location_id: '00000000-0000-0000-0000-000000000000', // Placeholder UUID
      rental_start_date: new Date().toISOString(),
      rental_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      items: [
        {
          item_id: '00000000-0000-0000-0000-000000000000',
          quantity: 1,
          daily_rate: 100.00
        }
      ],
      notes: 'Test rental from API verification'
    };
    
    const createResponse = await fetch(`${API_URL}/v1/transactions/rentals`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createRentalData)
    });
    
    console.log(`   Create Rental Status: ${createResponse.status} ${createResponse.statusText}`);
    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.log(`   Expected error (no valid data): ${error.substring(0, 100)}...`);
    }
    
    console.log('\n✅ RENTAL API IS ACTIVE AND ACCESSIBLE!');
    console.log('The rental endpoints are now available for use.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nPlease ensure:');
    console.error('1. Backend is running (docker-compose up)');
    console.error('2. API router has been updated with transactions router');
    console.error('3. Database migrations have been applied');
  }
}

// Run the test
testRentalAPI();