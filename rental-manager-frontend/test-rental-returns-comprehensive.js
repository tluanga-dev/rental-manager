/**
 * Comprehensive Rental Returns Test
 * Tests various return scenarios including full returns, partial returns, damage assessment, and extensions
 */

const puppeteer = require('puppeteer');
const {
  TEST_CONFIG,
  DAMAGE_SCENARIOS,
  login,
  getAuthToken,
  createTestCustomer,
  createTestItems,
  navigateToRentalCreation,
  fillRentalForm,
  verifyRentalCreation,
  processRentalReturn,
  processRentalExtension,
  verifyRentalReturn,
  takeScreenshot,
  cleanupTestData,
  FRONTEND_URL
} = require('./rental-test-utilities');

// Return test scenarios
const RETURN_SCENARIOS = {
  // Full return on time
  full_return_ontime: {
    name: 'Full Return - On Time',
    rental: {
      customer: 'John Doe',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'DAILY'
        }
      ]
    },
    return: {
      items: [
        {
          id: 'item-1',
          quantity: 1,
          damage: null
        }
      ],
      notes: 'Item returned in perfect condition'
    },
    expected: {
      status: 'COMPLETED',
      lateFees: 0,
      damageCharges: 0,
      depositRefund: true
    }
  },
  
  // Late return with fees
  full_return_late: {
    name: 'Full Return - Late with Fees',
    rental: {
      customer: 'Jane Smith',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (overdue)
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 2,
          periodType: 'DAILY'
        },
        {
          name: 'Lens - 24-70mm f/2.8',
          quantity: 2,
          periodType: 'DAILY'
        }
      ]
    },
    return: {
      items: [
        {
          id: 'item-1',
          quantity: 2,
          damage: null
        },
        {
          id: 'item-2',
          quantity: 2,
          damage: null
        }
      ],
      notes: 'Late return due to extended shoot'
    },
    expected: {
      status: 'COMPLETED',
      lateFees: true, // Should have late fees
      damageCharges: 0,
      daysLate: 3
    }
  },
  
  // Partial return
  partial_return: {
    name: 'Partial Return - Multiple Items',
    rental: {
      customer: 'Bob Wilson',
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 3,
          periodType: 'DAILY'
        },
        {
          name: 'Tripod - Professional',
          quantity: 3,
          periodType: 'DAILY'
        }
      ]
    },
    return: {
      items: [
        {
          id: 'item-1',
          quantity: 2, // Return 2 out of 3
          damage: null
        },
        {
          id: 'item-2',
          quantity: 1, // Return 1 out of 3
          damage: null
        }
      ],
      notes: 'Partial return - customer keeping some items longer'
    },
    expected: {
      status: 'PARTIAL_RETURN',
      lateFees: 0,
      damageCharges: 0,
      remainingItems: 3 // 1 camera + 2 tripods
    }
  },
  
  // Return with minor damage
  return_minor_damage: {
    name: 'Return with Minor Damage',
    rental: {
      customer: 'John Doe',
      startDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'DAILY'
        }
      ]
    },
    return: {
      items: [
        {
          id: 'item-1',
          quantity: 1,
          damage: {
            type: DAMAGE_SCENARIOS.MINOR.type,
            severity: DAMAGE_SCENARIOS.MINOR.severity,
            description: DAMAGE_SCENARIOS.MINOR.descriptions[0],
            repairCost: 175 // 5% of $3500
          }
        }
      ],
      notes: 'Minor scratch on camera body'
    },
    expected: {
      status: 'COMPLETED',
      lateFees: 0,
      damageCharges: 175,
      depositRefund: 'partial' // Deposit minus damage charges
    }
  },
  
  // Return with moderate damage
  return_moderate_damage: {
    name: 'Return with Moderate Damage',
    rental: {
      customer: 'Jane Smith',
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      items: [
        {
          name: 'Lens - 24-70mm f/2.8',
          quantity: 1,
          periodType: 'DAILY'
        }
      ]
    },
    return: {
      items: [
        {
          id: 'item-1',
          quantity: 1,
          damage: {
            type: DAMAGE_SCENARIOS.MODERATE.type,
            severity: DAMAGE_SCENARIOS.MODERATE.severity,
            description: DAMAGE_SCENARIOS.MODERATE.descriptions[1],
            repairCost: 400 // 20% of $2000
          }
        }
      ],
      notes: 'Lens has loose components, needs calibration'
    },
    expected: {
      status: 'COMPLETED',
      lateFees: 0,
      damageCharges: 400,
      depositRefund: 'none' // Damage exceeds deposit
    }
  },
  
  // Return with severe damage
  return_severe_damage: {
    name: 'Return with Severe Damage',
    rental: {
      customer: 'Bob Wilson',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      items: [
        {
          name: 'Lighting Kit - Studio',
          quantity: 1,
          periodType: 'DAILY'
        }
      ]
    },
    return: {
      items: [
        {
          id: 'item-1',
          quantity: 1,
          damage: {
            type: DAMAGE_SCENARIOS.SEVERE.type,
            severity: DAMAGE_SCENARIOS.SEVERE.severity,
            description: DAMAGE_SCENARIOS.SEVERE.descriptions[2],
            repairCost: 1250, // 50% of $2500
            photos: ['./test-photos/water-damage.jpg']
          }
        }
      ],
      notes: 'Equipment exposed to water during outdoor shoot'
    },
    expected: {
      status: 'COMPLETED',
      lateFees: 0,
      damageCharges: 1250,
      depositRefund: 'none',
      additionalCharges: true // Customer owes beyond deposit
    }
  },
  
  // Total loss scenario
  return_total_loss: {
    name: 'Return - Total Loss',
    rental: {
      customer: 'John Doe',
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      items: [
        {
          name: 'Tripod - Professional',
          quantity: 1,
          periodType: 'DAILY'
        }
      ]
    },
    return: {
      items: [
        {
          id: 'item-1',
          quantity: 1,
          damage: {
            type: DAMAGE_SCENARIOS.TOTAL_LOSS.type,
            severity: DAMAGE_SCENARIOS.TOTAL_LOSS.severity,
            description: DAMAGE_SCENARIOS.TOTAL_LOSS.descriptions[0],
            repairCost: 500 // 100% replacement value
          }
        }
      ],
      notes: 'Tripod completely destroyed in accident'
    },
    expected: {
      status: 'COMPLETED',
      lateFees: 0,
      damageCharges: 500,
      depositRefund: 'none',
      itemDisposition: 'WRITE_OFF'
    }
  },
  
  // Mixed return - some items damaged, some late
  mixed_return_complex: {
    name: 'Mixed Return - Late + Damaged + Partial',
    rental: {
      customer: 'Jane Smith',
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Overdue
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 2,
          periodType: 'DAILY'
        },
        {
          name: 'Lens - 24-70mm f/2.8',
          quantity: 2,
          periodType: 'DAILY'
        },
        {
          name: 'Tripod - Professional',
          quantity: 2,
          periodType: 'DAILY'
        }
      ]
    },
    return: {
      items: [
        {
          id: 'item-1',
          quantity: 2, // Both cameras returned
          damage: {
            type: DAMAGE_SCENARIOS.MINOR.type,
            severity: DAMAGE_SCENARIOS.MINOR.severity,
            description: 'Surface scratches on one unit',
            repairCost: 175
          }
        },
        {
          id: 'item-2',
          quantity: 1, // Only 1 lens returned (partial)
          damage: null
        },
        {
          id: 'item-3',
          quantity: 2, // Both tripods returned
          damage: null
        }
      ],
      notes: 'Complex return: late, partial, with damage'
    },
    expected: {
      status: 'PARTIAL_RETURN',
      lateFees: true,
      damageCharges: 175,
      remainingItems: 1, // 1 lens still out
      daysLate: 3
    }
  },
  
  // Early return
  early_return: {
    name: 'Early Return with Refund Calculation',
    rental: {
      customer: 'Bob Wilson',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days rental
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'WEEKLY'
        }
      ]
    },
    return: {
      items: [
        {
          id: 'item-1',
          quantity: 1,
          damage: null
        }
      ],
      notes: 'Customer returning early - project cancelled',
      returnDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Return after 3 days
    },
    expected: {
      status: 'COMPLETED',
      lateFees: 0,
      damageCharges: 0,
      refundDue: true, // Should calculate refund for unused days
      depositRefund: true
    }
  }
};

// Extension scenarios
const EXTENSION_SCENARIOS = {
  simple_extension: {
    name: 'Simple Extension - 3 Extra Days',
    rental: {
      customer: 'John Doe',
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      items: [
        {
          name: 'Camera - Canon EOS R5',
          quantity: 1,
          periodType: 'DAILY'
        }
      ]
    },
    extension: {
      newEndDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 3 extra days
      reason: 'Project extended - need equipment longer'
    },
    expected: {
      status: 'EXTENDED',
      additionalDays: 3,
      additionalCharges: true
    }
  },
  
  multiple_extensions: {
    name: 'Multiple Extensions Test',
    rental: {
      customer: 'Jane Smith',
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      items: [
        {
          name: 'Lens - 24-70mm f/2.8',
          quantity: 1,
          periodType: 'DAILY'
        }
      ]
    },
    extensions: [
      {
        newEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        reason: 'First extension - 2 days'
      },
      {
        newEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        reason: 'Second extension - 3 more days'
      }
    ],
    expected: {
      status: 'EXTENDED',
      extensionCount: 2,
      totalAdditionalDays: 5
    }
  }
};

// Main test function
async function runRentalReturnTests() {
  let browser;
  let page;
  let authToken;
  const testResults = [];
  const createdData = {
    rentals: [],
    customers: [],
    items: []
  };
  
  try {
    console.log('Starting Comprehensive Rental Return Tests');
    console.log('==========================================\n');
    
    // Setup browser
    browser = await puppeteer.launch({
      headless: TEST_CONFIG.headless,
      slowMo: TEST_CONFIG.slowMo,
      devtools: TEST_CONFIG.devtools,
      defaultViewport: TEST_CONFIG.viewport,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    
    // Set up console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
    
    // Get auth token
    authToken = await getAuthToken('admin');
    console.log('Auth token obtained\n');
    
    // Create test data
    console.log('Setting up test data...');
    const customers = await Promise.all([
      createTestCustomer(authToken, { name: 'John Doe', email: 'john.doe@test.com' }),
      createTestCustomer(authToken, { name: 'Jane Smith', email: 'jane.smith@test.com' }),
      createTestCustomer(authToken, { name: 'Bob Wilson', email: 'bob.wilson@test.com' })
    ]);
    createdData.customers = customers.map(c => c.id);
    
    const items = await createTestItems(authToken);
    createdData.items = items.map(i => i.id);
    console.log('Test data created\n');
    
    // Login to frontend
    await login(page, 'admin');
    
    // Run return scenarios
    console.log('RETURN SCENARIOS');
    console.log('================\n');
    
    for (const [key, scenario] of Object.entries(RETURN_SCENARIOS)) {
      console.log(`Test: ${scenario.name}`);
      console.log('-'.repeat(50));
      
      try {
        // Create rental first
        await navigateToRentalCreation(page);
        await fillRentalForm(page, scenario.rental);
        await page.click('[data-testid="submit-rental"]');
        const rentalId = await verifyRentalCreation(page, { status: 'PENDING' });
        createdData.rentals.push(rentalId);
        
        console.log(`  Created rental: ${rentalId}`);
        
        // Process pickup (required before return)
        await page.goto(`${FRONTEND_URL}/rentals/${rentalId}`);
        await page.waitForSelector('[data-testid="pickup-button"]', { timeout: 5000 });
        await page.click('[data-testid="pickup-button"]');
        await page.waitForSelector('[data-testid="pickup-success"]', { timeout: 5000 });
        console.log('  Pickup processed');
        
        // Process return
        const returnData = {
          ...scenario.return,
          rentalId: rentalId
        };
        await processRentalReturn(page, returnData);
        
        // Take screenshot
        await takeScreenshot(page, `rental-return-${key}`);
        
        // Verify return
        await verifyRentalReturn(page, scenario.expected);
        
        // Record success
        testResults.push({
          scenario: scenario.name,
          status: 'PASSED',
          rentalId: rentalId,
          returnStatus: scenario.expected.status
        });
        
        console.log(`✓ Return test passed\n`);
        
      } catch (error) {
        console.error(`✗ Return test failed: ${error.message}\n`);
        await takeScreenshot(page, `rental-return-${key}-error`);
        
        testResults.push({
          scenario: scenario.name,
          status: 'FAILED',
          error: error.message
        });
      }
      
      await page.waitForTimeout(1000);
    }
    
    // Run extension scenarios
    console.log('\nEXTENSION SCENARIOS');
    console.log('===================\n');
    
    for (const [key, scenario] of Object.entries(EXTENSION_SCENARIOS)) {
      console.log(`Test: ${scenario.name}`);
      console.log('-'.repeat(50));
      
      try {
        // Create rental
        await navigateToRentalCreation(page);
        await fillRentalForm(page, scenario.rental);
        await page.click('[data-testid="submit-rental"]');
        const rentalId = await verifyRentalCreation(page, { status: 'PENDING' });
        createdData.rentals.push(rentalId);
        
        console.log(`  Created rental: ${rentalId}`);
        
        // Process pickup
        await page.goto(`${FRONTEND_URL}/rentals/${rentalId}`);
        await page.click('[data-testid="pickup-button"]');
        await page.waitForSelector('[data-testid="pickup-success"]', { timeout: 5000 });
        
        // Process extension(s)
        if (scenario.extensions) {
          // Multiple extensions
          for (let i = 0; i < scenario.extensions.length; i++) {
            const extensionData = {
              rentalId: rentalId,
              ...scenario.extensions[i]
            };
            await processRentalExtension(page, extensionData);
            console.log(`  Extension ${i + 1} processed`);
            await page.waitForTimeout(1000);
          }
        } else {
          // Single extension
          const extensionData = {
            rentalId: rentalId,
            ...scenario.extension
          };
          await processRentalExtension(page, extensionData);
          console.log('  Extension processed');
        }
        
        // Take screenshot
        await takeScreenshot(page, `rental-extension-${key}`);
        
        // Verify extension
        const extensionStatus = await page.$eval('[data-testid="rental-status"]', el => el.textContent);
        if (!extensionStatus.includes('EXTENDED')) {
          throw new Error('Extension not reflected in status');
        }
        
        testResults.push({
          scenario: scenario.name,
          status: 'PASSED',
          rentalId: rentalId
        });
        
        console.log(`✓ Extension test passed\n`);
        
      } catch (error) {
        console.error(`✗ Extension test failed: ${error.message}\n`);
        await takeScreenshot(page, `rental-extension-${key}-error`);
        
        testResults.push({
          scenario: scenario.name,
          status: 'FAILED',
          error: error.message
        });
      }
      
      await page.waitForTimeout(1000);
    }
    
    // Test special cases
    console.log('\nSPECIAL CASES');
    console.log('=============\n');
    
    // Test: Sequential partial returns
    console.log('Test: Sequential Partial Returns');
    try {
      // Create rental with multiple items
      await navigateToRentalCreation(page);
      const rentalData = {
        customer: 'Bob Wilson',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        items: [
          { name: 'Camera - Canon EOS R5', quantity: 3, periodType: 'DAILY' },
          { name: 'Lens - 24-70mm f/2.8', quantity: 3, periodType: 'DAILY' }
        ]
      };
      
      await fillRentalForm(page, rentalData);
      await page.click('[data-testid="submit-rental"]');
      const rentalId = await verifyRentalCreation(page, { status: 'PENDING' });
      createdData.rentals.push(rentalId);
      
      // Process pickup
      await page.goto(`${FRONTEND_URL}/rentals/${rentalId}`);
      await page.click('[data-testid="pickup-button"]');
      await page.waitForSelector('[data-testid="pickup-success"]');
      
      // First partial return
      await processRentalReturn(page, {
        rentalId: rentalId,
        items: [
          { id: 'item-1', quantity: 1 },
          { id: 'item-2', quantity: 1 }
        ],
        notes: 'First partial return'
      });
      
      console.log('  First partial return processed');
      await page.waitForTimeout(2000);
      
      // Second partial return
      await processRentalReturn(page, {
        rentalId: rentalId,
        items: [
          { id: 'item-1', quantity: 1 },
          { id: 'item-2', quantity: 1 }
        ],
        notes: 'Second partial return'
      });
      
      console.log('  Second partial return processed');
      
      // Verify rental still has outstanding items
      const status = await page.$eval('[data-testid="rental-status"]', el => el.textContent);
      if (status === 'COMPLETED') {
        throw new Error('Rental should not be completed yet');
      }
      
      console.log('✓ Sequential partial returns working correctly\n');
      
    } catch (error) {
      console.error('✗ Sequential partial returns test failed:', error.message);
    }
    
    // Print test summary
    console.log('\n\nTEST SUMMARY');
    console.log('============');
    console.log(`Total tests run: ${testResults.length}`);
    console.log(`Passed: ${testResults.filter(r => r.status === 'PASSED').length}`);
    console.log(`Failed: ${testResults.filter(r => r.status === 'FAILED').length}`);
    
    console.log('\nDetailed Results:');
    testResults.forEach(result => {
      const icon = result.status === 'PASSED' ? '✓' : '✗';
      console.log(`${icon} ${result.scenario}: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    // Save test report
    const reportData = {
      timestamp: new Date().toISOString(),
      totalTests: testResults.length,
      passed: testResults.filter(r => r.status === 'PASSED').length,
      failed: testResults.filter(r => r.status === 'FAILED').length,
      results: testResults
    };
    
    console.log('\n\nTest Report:');
    console.log(JSON.stringify(reportData, null, 2));
    
  } catch (error) {
    console.error('Test suite failed:', error);
    if (page) {
      await takeScreenshot(page, 'rental-return-suite-error');
    }
    
  } finally {
    // Cleanup
    console.log('\nCleaning up test data...');
    if (authToken) {
      await cleanupTestData(authToken, createdData);
    }
    
    if (browser) {
      await browser.close();
    }
    
    console.log('Test suite completed');
  }
}

// Run the tests
runRentalReturnTests().catch(console.error);