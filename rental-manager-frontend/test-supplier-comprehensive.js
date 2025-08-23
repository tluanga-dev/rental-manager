const axios = require('axios');
const fs = require('fs');

async function comprehensiveSupplierTest() {
  console.log('🏭 Comprehensive Supplier Test Suite');
  console.log('='.repeat(60));
  
  const testResults = {
    auth: false,
    createTypes: { MANUFACTURER: false, DISTRIBUTOR: false, SERVICE: false },
    createTiers: { PREMIUM: false, STANDARD: false, BASIC: false },
    bulkCreate: false,
    pagination: false,
    filtering: false,
    sorting: false,
    edgeCases: false,
    validation: false,
    performance: false
  };
  
  const metrics = {
    createTimes: [],
    queryTimes: [],
    totalSuppliers: 0
  };
  
  try {
    // Authentication
    console.log('\n📍 Phase 1: Authentication');
    console.log('─'.repeat(50));
    
    const authResponse = await axios.post(
      'http://localhost:8001/api/v1/auth/login',
      { username: 'admin', password: 'admin123' },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    const token = authResponse.data.access_token;
    testResults.auth = true;
    console.log('✅ Authentication successful');
    
    const api = axios.create({
      baseURL: 'http://localhost:8001/api/v1',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    
    // Test different supplier types
    console.log('\n📍 Phase 2: Testing All Supplier Types');
    console.log('─'.repeat(50));
    
    const types = ['MANUFACTURER', 'DISTRIBUTOR', 'SERVICE'];
    for (const type of types) {
      const startTime = Date.now();
      const response = await api.post('/suppliers/', {
        supplier_code: `${type}${Date.now()}`,
        company_name: `Test ${type} Company`,
        supplier_type: type,
        payment_terms: 'NET30',
        supplier_tier: 'STANDARD'
      });
      
      metrics.createTimes.push(Date.now() - startTime);
      if (response.status === 201 || response.status === 200) {
        testResults.createTypes[type] = true;
        console.log(`✅ Created ${type} supplier`);
        metrics.totalSuppliers++;
      }
    }
    
    // Test different tiers
    console.log('\n📍 Phase 3: Testing All Supplier Tiers');
    console.log('─'.repeat(50));
    
    const tiers = ['PREMIUM', 'STANDARD', 'BASIC'];
    for (const tier of tiers) {
      const response = await api.post('/suppliers/', {
        supplier_code: `TIER${tier}${Date.now()}`,
        company_name: `${tier} Tier Supplier`,
        supplier_type: 'MANUFACTURER',
        supplier_tier: tier,
        payment_terms: 'NET30'
      });
      
      if (response.status === 201 || response.status === 200) {
        testResults.createTiers[tier] = true;
        console.log(`✅ Created ${tier} tier supplier`);
        metrics.totalSuppliers++;
      }
    }
    
    // Bulk creation test
    console.log('\n📍 Phase 4: Bulk Creation Performance');
    console.log('─'.repeat(50));
    
    const bulkStartTime = Date.now();
    const bulkPromises = [];
    
    for (let i = 0; i < 10; i++) {
      bulkPromises.push(
        api.post('/suppliers/', {
          supplier_code: `BULK${Date.now()}${i}`,
          company_name: `Bulk Supplier ${i}`,
          supplier_type: 'DISTRIBUTOR',
          payment_terms: 'NET45',
          credit_limit: Math.floor(Math.random() * 100000)
        })
      );
    }
    
    await Promise.all(bulkPromises);
    const bulkTime = Date.now() - bulkStartTime;
    metrics.totalSuppliers += 10;
    
    if (bulkTime < 5000) {
      testResults.bulkCreate = true;
      console.log(`✅ Created 10 suppliers in ${bulkTime}ms`);
    }
    
    // Test pagination
    console.log('\n📍 Phase 5: Pagination & Query Performance');
    console.log('─'.repeat(50));
    
    const queryStart = Date.now();
    const pageResponse = await api.get('/suppliers/', {
      params: { skip: 0, limit: 5 }
    });
    metrics.queryTimes.push(Date.now() - queryStart);
    
    if (pageResponse.data.length <= 5) {
      testResults.pagination = true;
      console.log(`✅ Pagination working (got ${pageResponse.data.length} of max 5)`);
    }
    
    // Test filtering
    console.log('\n📍 Phase 6: Advanced Filtering');
    console.log('─'.repeat(50));
    
    const filterResponse = await api.get('/suppliers/', {
      params: { 
        supplier_type: 'MANUFACTURER',
        supplier_tier: 'PREMIUM'
      }
    });
    
    const allMatch = filterResponse.data.every(s => 
      s.supplier_type === 'MANUFACTURER' && s.supplier_tier === 'PREMIUM'
    );
    
    if (allMatch) {
      testResults.filtering = true;
      console.log(`✅ Filtering working (found ${filterResponse.data.length} matching)`);
    }
    
    // Test edge cases
    console.log('\n📍 Phase 7: Edge Cases & Validation');
    console.log('─'.repeat(50));
    
    // Unicode and special characters
    try {
      const unicodeResponse = await api.post('/suppliers/', {
        supplier_code: `UNI${Date.now()}`,
        company_name: '测试供应商 🏭 Test Ñoño',
        supplier_type: 'SERVICE',
        contact_person: 'José María O\'Connor',
        notes: 'Special chars: & < > " \' / \\ ; :'
      });
      
      if (unicodeResponse.status === 201) {
        testResults.edgeCases = true;
        console.log('✅ Unicode and special characters handled');
      }
    } catch (error) {
      console.log('⚠️  Unicode handling failed');
    }
    
    // Test validation
    try {
      await api.post('/suppliers/', {
        supplier_code: '', // Empty required field
        company_name: 'Test',
        supplier_type: 'INVALID' // Invalid enum
      });
      console.log('❌ Validation not working - invalid data accepted');
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 422) {
        testResults.validation = true;
        console.log('✅ Validation working - invalid data rejected');
      }
    }
    
    // Performance summary
    console.log('\n📍 Phase 8: Performance Analysis');
    console.log('─'.repeat(50));
    
    const avgCreateTime = metrics.createTimes.reduce((a,b) => a+b, 0) / metrics.createTimes.length;
    const avgQueryTime = metrics.queryTimes.reduce((a,b) => a+b, 0) / metrics.queryTimes.length;
    
    console.log(`📊 Average create time: ${avgCreateTime.toFixed(0)}ms`);
    console.log(`📊 Average query time: ${avgQueryTime.toFixed(0)}ms`);
    console.log(`📊 Total suppliers created: ${metrics.totalSuppliers}`);
    
    if (avgCreateTime < 500 && avgQueryTime < 1000) {
      testResults.performance = true;
      console.log('✅ Performance within acceptable limits');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Details:', error.response.data);
    }
  }
  
  // Generate summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPREHENSIVE TEST SUMMARY');
  console.log('='.repeat(60));
  
  let totalTests = 0;
  let passedTests = 0;
  
  // Count all test results
  function countTests(obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'boolean') {
        totalTests++;
        if (value) passedTests++;
      } else if (typeof value === 'object') {
        countTests(value);
      }
    }
  }
  
  countTests(testResults);
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log('\nTest Categories:');
  console.log(`  Authentication: ${testResults.auth ? '✅' : '❌'}`);
  console.log(`  Supplier Types: ${Object.values(testResults.createTypes).filter(v => v).length}/3 ✅`);
  console.log(`  Supplier Tiers: ${Object.values(testResults.createTiers).filter(v => v).length}/3 ✅`);
  console.log(`  Bulk Creation: ${testResults.bulkCreate ? '✅' : '❌'}`);
  console.log(`  Pagination: ${testResults.pagination ? '✅' : '❌'}`);
  console.log(`  Filtering: ${testResults.filtering ? '✅' : '❌'}`);
  console.log(`  Edge Cases: ${testResults.edgeCases ? '✅' : '❌'}`);
  console.log(`  Validation: ${testResults.validation ? '✅' : '❌'}`);
  console.log(`  Performance: ${testResults.performance ? '✅' : '❌'}`);
  
  console.log('\nOverall Statistics:');
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${totalTests - passedTests}`);
  console.log(`  Success Rate: ${successRate}%`);
  console.log(`  Suppliers Created: ${metrics.totalSuppliers}`);
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    results: testResults,
    metrics: metrics,
    summary: {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate
    }
  };
  
  fs.writeFileSync('supplier-comprehensive-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Detailed report saved to supplier-comprehensive-report.json');
  
  if (successRate >= 90) {
    console.log('\n🎉 EXCELLENT! Comprehensive supplier testing successful!');
  } else if (successRate >= 70) {
    console.log('\n✅ Good! Most supplier features working correctly.');
  } else {
    console.log('\n⚠️  Several issues detected. Review the results above.');
  }
}

comprehensiveSupplierTest();
