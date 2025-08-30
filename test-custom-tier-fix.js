/**
 * Test script to verify custom tier creation fix
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8000/api';

// You need to get a valid item ID from your database
// You can find one from the inventory items page
const TEST_ITEM_ID = 'MAC201-00001'; // Replace with actual item ID

async function testCustomTierCreation() {
  console.log('🧪 Testing Custom Tier Creation Fix');
  console.log('=====================================\n');

  try {
    // Test 1: Create a custom 10-day period tier
    console.log('Test 1: Creating 10-day custom period tier...');
    const dayTier = {
      item_id: TEST_ITEM_ID,
      tier_name: 'Custom 10-Day Rate',
      period_unit: 'DAY',
      period_type: 'CUSTOM',
      period_days: 10,
      period_hours: null,
      rate_per_period: 500.00,
      min_rental_periods: 1,
      max_rental_periods: 5,
      is_default: false,
      is_active: true,
      priority: 50
    };

    console.log('Sending data:', JSON.stringify(dayTier, null, 2));
    
    try {
      const response1 = await axios.post(`${API_BASE}/rental-pricing/`, dayTier);
      console.log('✅ Success! Created tier with ID:', response1.data.id);
      console.log('   Period:', response1.data.period_value || response1.data.period_days, 'days');
      console.log('   Rate:', response1.data.rate_per_period);
      console.log('   Daily equivalent:', response1.data.daily_equivalent_rate);
    } catch (error) {
      console.log('❌ Failed:', error.response?.data?.detail || error.message);
      if (error.response?.data) {
        console.log('Response data:', JSON.stringify(error.response.data, null, 2));
      }
    }

    console.log('\n-----------------------------------\n');

    // Test 2: Create a custom 4-hour period tier
    console.log('Test 2: Creating 4-hour custom period tier...');
    const hourTier = {
      item_id: TEST_ITEM_ID,
      tier_name: 'Custom 4-Hour Block',
      period_unit: 'HOUR',
      period_type: 'CUSTOM',
      period_days: null,
      period_hours: 4,
      rate_per_period: 100.00,
      min_rental_periods: 2,
      max_rental_periods: 6,
      is_default: false,
      is_active: true,
      priority: 40
    };

    console.log('Sending data:', JSON.stringify(hourTier, null, 2));
    
    try {
      const response2 = await axios.post(`${API_BASE}/rental-pricing/`, hourTier);
      console.log('✅ Success! Created tier with ID:', response2.data.id);
      console.log('   Period:', response2.data.period_value || response2.data.period_hours, 'hours');
      console.log('   Rate:', response2.data.rate_per_period);
      console.log('   Daily equivalent:', response2.data.daily_equivalent_rate);
    } catch (error) {
      console.log('❌ Failed:', error.response?.data?.detail || error.message);
      if (error.response?.data) {
        console.log('Response data:', JSON.stringify(error.response.data, null, 2));
      }
    }

    console.log('\n-----------------------------------\n');

    // Test 3: Get all tiers for the item
    console.log('Test 3: Fetching all tiers for the item...');
    try {
      const response3 = await axios.get(`${API_BASE}/rental-pricing/item/${TEST_ITEM_ID}`);
      console.log(`✅ Found ${response3.data.length} tiers:`);
      response3.data.forEach(tier => {
        const periodValue = tier.period_value || tier.period_days || tier.period_hours || 1;
        const unit = tier.period_unit === 'HOUR' ? 'hours' : 'days';
        console.log(`   - ${tier.tier_name}: ${periodValue} ${unit} @ $${tier.rate_per_period}`);
        if (tier.min_rental_periods || tier.max_rental_periods) {
          console.log(`     Rental periods: ${tier.min_rental_periods || 1} - ${tier.max_rental_periods || '∞'}`);
        }
      });
    } catch (error) {
      console.log('❌ Failed to fetch tiers:', error.response?.data?.detail || error.message);
    }

    console.log('\n=====================================');
    console.log('✅ Test completed!');
    console.log('\nNext steps:');
    console.log('1. Open http://localhost:3000/inventory/items/' + TEST_ITEM_ID);
    console.log('2. Click "Manage Pricing"');
    console.log('3. You should see the newly created custom tiers');
    console.log('4. Try creating more tiers through the UI');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

async function cleanupTestTiers() {
  console.log('🧹 Cleaning up test tiers...\n');
  
  try {
    const response = await axios.get(`${API_BASE}/rental-pricing/item/${TEST_ITEM_ID}`);
    const testTierNames = ['Custom 10-Day Rate', 'Custom 4-Hour Block'];
    
    for (const tier of response.data) {
      if (testTierNames.includes(tier.tier_name)) {
        try {
          await axios.delete(`${API_BASE}/rental-pricing/${tier.id}`);
          console.log(`✅ Deleted: ${tier.tier_name}`);
        } catch (error) {
          console.log(`❌ Failed to delete ${tier.tier_name}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Cleanup completed!');
  } catch (error) {
    console.log('❌ Cleanup failed:', error.message);
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'cleanup') {
  cleanupTestTiers();
} else {
  console.log('Usage:');
  console.log('  node test-custom-tier-fix.js         # Run tests');
  console.log('  node test-custom-tier-fix.js cleanup # Clean up test data');
  console.log('');
  console.log('⚠️  Important: Update TEST_ITEM_ID with a valid item ID from your database');
  console.log('');
  
  if (!command) {
    testCustomTierCreation();
  }
}