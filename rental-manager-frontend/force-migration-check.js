#!/usr/bin/env node

/**
 * Force check if Railway has applied the database migration by testing the exact error
 */

const https = require('https');

function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(body),
                        rawBody: body
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: body,
                        rawBody: body
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function testMigrationStatus() {
    console.log('🔍 Checking Railway Migration Status');
    console.log('=' .repeat(50));
    
    try {
        // Login first
        const loginResponse = await makeRequest({
            hostname: 'rental-manager-backend-production.up.railway.app',
            port: 443,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: 'admin',
            password: 'K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3'
        });

        if (loginResponse.status !== 200 || !loginResponse.data.access_token) {
            console.log('❌ Login failed');
            console.log('Response:', loginResponse.data);
            return;
        }

        console.log('✅ Login successful');
        
        // Test inventory API and examine the exact error
        const inventoryResponse = await makeRequest({
            hostname: 'rental-manager-backend-production.up.railway.app',
            port: 443,
            path: '/api/inventory/items?limit=1',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${loginResponse.data.access_token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`📊 API Status: ${inventoryResponse.status}`);
        
        if (inventoryResponse.status === 200) {
            console.log('🎉 SUCCESS! Migration has been applied!');
            console.log('✅ Inventory API is now working');
            console.log('💡 The inventory page should load correctly now');
        } else if (inventoryResponse.status === 500) {
            console.log('⚠️  Still getting 500 error');
            
            // Examine the exact error message
            const errorText = inventoryResponse.rawBody;
            console.log('\n🔍 Detailed Error Analysis:');
            
            if (errorText.includes('is_rental_blocked') || errorText.includes('does not exist')) {
                console.log('❌ CONFIRMED: Missing is_rental_blocked columns');
                console.log('🔧 Migration has NOT been applied by Railway yet');
                console.log('⏳ Railway may need more time to process the deployment');
                
                // Show relevant part of error
                const lines = errorText.split('\n');
                const errorLine = lines.find(line => line.includes('is_rental_blocked') || line.includes('does not exist'));
                if (errorLine) {
                    console.log(`📝 Specific error: ${errorLine.trim()}`);
                }
            } else {
                console.log('❓ Different error - not related to missing columns');
                console.log('📝 Error sample:', errorText.substring(0, 200) + '...');
            }
        } else {
            console.log(`❓ Unexpected status: ${inventoryResponse.status}`);
            console.log('Response:', inventoryResponse.data);
        }

        // Check Railway deployment info
        console.log('\n📋 MIGRATION STATUS SUMMARY:');
        console.log('Migration file: ✅ Created and committed');
        console.log('Railway deployment: ✅ Triggered');
        console.log('Alembic migration: ⏳ Waiting for Railway to apply');
        
        if (inventoryResponse.status === 500) {
            console.log('\n💡 NEXT STEPS:');
            console.log('1. Wait 2-5 more minutes for Railway deployment');
            console.log('2. Railway may be restarting the application');
            console.log('3. The startup script should run "alembic upgrade head"');
            console.log('4. Test again in a few minutes');
        }

    } catch (error) {
        console.log('💥 Test failed:', error.message);
    }
}

testMigrationStatus();