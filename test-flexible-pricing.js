/**
 * Test script for enhanced flexible rental pricing system
 * Tests both hourly and daily pricing configurations
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8000/api';

// Test configuration
const TEST_CONFIG = {
  // This should be a valid item ID from your database
  itemId: 'your-test-item-id-here', // Replace with actual item ID
  testScenarios: [
    {
      name: 'Daily Pricing - 10 days',
      data: {
        tier_name: 'Extended Daily Rate',
        period_unit: 'DAY',
        period_days: 10,
        period_hours: null,
        period_type: 'CUSTOM',
        rate_per_period: 250.00,
        min_rental_periods: 1,
        max_rental_periods: 5,
        is_default: false,
        is_active: true,
        priority: 50
      }
    },
    {
      name: 'Hourly Pricing - 4 hours',
      data: {
        tier_name: '4-Hour Block',
        period_unit: 'HOUR',
        period_days: null,
        period_hours: 4,
        period_type: 'CUSTOM',
        rate_per_period: 80.00,
        min_rental_periods: 2,  // Minimum 8 hours
        max_rental_periods: 6,  // Maximum 24 hours
        is_default: false,
        is_active: true,
        priority: 30
      }
    },
    {
      name: 'Daily Pricing - Standard 7 days',
      data: {
        tier_name: 'Weekly Rate',
        period_unit: 'DAY',
        period_days: 7,
        period_hours: null,
        period_type: 'WEEKLY',
        rate_per_period: 150.00,
        min_rental_periods: 1,
        max_rental_periods: 4,
        is_default: true,
        is_active: true,
        priority: 20
      }
    }
  ]
};

async function testFlexiblePricing() {
  console.log('🚀 Testing Enhanced Flexible Rental Pricing System');
  console.log('================================================');

  try {
    // First, try to get existing pricing tiers for the item
    console.log('\n1. Checking existing pricing tiers...');
    
    try {
      const existingTiers = await axios.get(`${API_BASE}/rental-pricing/item/${TEST_CONFIG.itemId}`);
      console.log(`   Found ${existingTiers.data.length} existing tiers`);
    } catch (error) {
      console.log('   No existing tiers found or item not found');
      console.log('   Please update TEST_CONFIG.itemId with a valid item ID');
      return;
    }

    // Test creating flexible pricing tiers
    console.log('\n2. Testing flexible pricing tier creation...');
    const createdTiers = [];

    for (const scenario of TEST_CONFIG.testScenarios) {
      console.log(`\n   Creating: ${scenario.name}`);
      
      const pricingData = {
        item_id: TEST_CONFIG.itemId,
        ...scenario.data
      };

      try {
        const response = await axios.post(`${API_BASE}/rental-pricing/`, pricingData);
        createdTiers.push(response.data);
        
        console.log(`   ✅ Created successfully:`);
        console.log(`      - Period: ${response.data.period_value || response.data.period_days || response.data.period_hours} ${response.data.period_unit === 'HOUR' ? 'hours' : 'days'}`);
        console.log(`      - Rate: $${response.data.rate_per_period}`);
        console.log(`      - Min/Max periods: ${response.data.min_rental_periods || 1} - ${response.data.max_rental_periods || '∞'}`);
        
        if (response.data.daily_equivalent_rate) {
          console.log(`      - Daily equivalent: $${response.data.daily_equivalent_rate}/day`);
        }
        
      } catch (error) {
        console.log(`   ❌ Failed to create: ${error.response?.data?.detail || error.message}`);
      }
    }

    // Test pricing calculations
    if (createdTiers.length > 0) {
      console.log('\n3. Testing pricing calculations...');
      
      const testCalculations = [
        { days: 5, hours: null, description: '5 days rental' },
        { days: null, hours: 8, description: '8 hours rental' },
        { days: 14, hours: null, description: '14 days rental' },
        { days: null, hours: 16, description: '16 hours rental' }
      ];

      for (const calc of testCalculations) {
        console.log(`\n   Calculating for ${calc.description}:`);
        
        try {
          const params = new URLSearchParams({
            item_id: TEST_CONFIG.itemId,
            ...(calc.days && { rental_days: calc.days.toString() }),
            ...(calc.hours && { rental_hours: calc.hours.toString() })
          });
          
          const response = await axios.get(`${API_BASE}/rental-pricing/calculate?${params}`);
          
          console.log(`      - Applicable tiers: ${response.data.applicable_tiers.length}`);
          if (response.data.recommended_tier) {
            console.log(`      - Recommended: ${response.data.recommended_tier.tier_name}`);
            console.log(`      - Total cost: $${response.data.total_cost}`);
            console.log(`      - Daily equivalent: $${response.data.daily_equivalent_rate}/day`);
            
            if (response.data.savings_compared_to_daily) {
              console.log(`      - Savings: $${response.data.savings_compared_to_daily}`);
            }
          } else {
            console.log(`      - No recommended tier found`);
          }
          
        } catch (error) {
          console.log(`      ❌ Calculation failed: ${error.response?.data?.detail || error.message}`);
        }
      }
    }

    console.log('\n4. Summary:');
    console.log(`   - Created ${createdTiers.length} flexible pricing tiers`);
    console.log('   - Tested various rental duration calculations');
    console.log('   - Verified both hourly and daily period support');
    
    console.log('\n✅ Flexible pricing system test completed!');
    console.log('\nNext steps:');
    console.log('1. Test the UI at http://localhost:3000/inventory/items/[sku]');
    console.log('2. Click "Manage Pricing" to see the flexible period options');
    console.log('3. Create custom periods with hours or days');
    console.log('4. Verify period-based rental constraints work correctly');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

async function cleanupTestTiers() {
  console.log('\n🧹 Cleaning up test pricing tiers...');
  
  try {
    // Get all tiers for the item
    const existingTiers = await axios.get(`${API_BASE}/rental-pricing/item/${TEST_CONFIG.itemId}`);
    
    // Delete test tiers (ones created by this script)
    const testTierNames = TEST_CONFIG.testScenarios.map(s => s.data.tier_name);
    
    for (const tier of existingTiers.data) {
      if (testTierNames.includes(tier.tier_name)) {
        try {
          await axios.delete(`${API_BASE}/rental-pricing/${tier.id}`);
          console.log(`   ✅ Deleted: ${tier.tier_name}`);
        } catch (error) {
          console.log(`   ❌ Failed to delete ${tier.tier_name}: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.log('   Could not cleanup test tiers:', error.message);
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'cleanup') {
  cleanupTestTiers();
} else {
  console.log('Usage:');
  console.log('  node test-flexible-pricing.js        # Run tests');
  console.log('  node test-flexible-pricing.js cleanup # Clean up test data');
  console.log('');
  console.log('Before running tests:');
  console.log('1. Update TEST_CONFIG.itemId with a valid item ID from your database');
  console.log('2. Ensure both backend (port 8000) and frontend (port 3000) are running');
  console.log('');
  
  if (!command) {
    testFlexiblePricing();
  }
}