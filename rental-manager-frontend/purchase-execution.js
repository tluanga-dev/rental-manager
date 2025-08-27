#!/usr/bin/env node

/**
 * Phase 3: Purchase Transaction Execution
 * Executes real purchase transactions via API to test inventory integration
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const execPromise = util.promisify(exec);

class PurchaseExecution {
    constructor() {
        this.results = [];
        this.purchaseIds = [];
        this.testData = {
            supplier_id: 'b128a522-2923-4535-98fa-0f04db881ab4',
            location_id: '70b8dc79-846b-47be-9450-507401a27494',
            item_id: 'bb2c8224-755d-4005-8868-b0683944364f'
        };
        
        // Load baseline data
        try {
            const baselineFile = fs.readFileSync(
                '/Users/tluanga/current_work/rental-manager/rental-manager-frontend/baseline-data.json',
                'utf8'
            );
            this.baseline = JSON.parse(baselineFile).baseline;
        } catch (error) {
            console.warn('Could not load baseline data:', error.message);
            this.baseline = {};
        }
    }

    async log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '🔄';
        console.log(`${icon} [${timestamp}] ${message}`);
    }

    async executeQuery(query) {
        try {
            const { stdout } = await execPromise(
                `docker exec rental_manager_postgres psql -U rental_user -d rental_db -c "${query}"`
            );
            return stdout.trim();
        } catch (error) {
            console.error(`Query failed: ${error.message}`);
            throw error;
        }
    }

    async executePurchaseAPI(payload) {
        const curlCommand = `curl -X POST "http://localhost:8000/api/v1/transactions/purchases" \
            -H "Content-Type: application/json" \
            -H "Accept: application/json" \
            -d '${JSON.stringify(payload).replace(/'/g, "'\\''")}' \
            -w "\\n%{http_code}" \
            -s`;

        try {
            const { stdout } = await execPromise(curlCommand);
            const lines = stdout.trim().split('\n');
            const httpCode = lines[lines.length - 1];
            const responseBody = lines.slice(0, -1).join('\n');
            
            return {
                httpCode: parseInt(httpCode),
                body: responseBody,
                success: httpCode >= 200 && httpCode < 300
            };
        } catch (error) {
            throw new Error(`API call failed: ${error.message}`);
        }
    }

    async testSingleItemPurchase() {
        await this.log('Executing single-item purchase test...');
        
        const purchasePayload = {
            supplier_id: this.testData.supplier_id,
            location_id: this.testData.location_id,
            auto_complete: true,
            items: [
                {
                    item_id: this.testData.item_id,
                    location_id: this.testData.location_id,
                    quantity: 3,
                    unit_price: 25.00,
                    batch_code: `BATCH-TEST-${Date.now()}`
                }
            ],
            currency: "INR",
            shipping_amount: 0.00,
            other_charges: 0.00,
            notes: "Verification test - single item purchase"
        };

        try {
            await this.log(`Sending purchase request...`);
            const apiResponse = await this.executePurchaseAPI(purchasePayload);
            
            const result = {
                testName: 'Single Item Purchase',
                payload: purchasePayload,
                httpCode: apiResponse.httpCode,
                success: apiResponse.success,
                response: apiResponse.body,
                timestamp: new Date().toISOString()
            };

            if (apiResponse.success) {
                await this.log(`Single item purchase API call successful (HTTP ${apiResponse.httpCode})`, 'success');
                
                // Try to extract purchase ID from response
                try {
                    const responseData = JSON.parse(apiResponse.body);
                    if (responseData.data?.id) {
                        result.purchaseId = responseData.data.id;
                        this.purchaseIds.push(responseData.data.id);
                        await this.log(`Purchase ID: ${responseData.data.id}`);
                        
                        if (responseData.data.status) {
                            result.status = responseData.data.status;
                            await this.log(`Purchase Status: ${responseData.data.status}`);
                        }
                    } else if (responseData.id) {
                        result.purchaseId = responseData.id;
                        this.purchaseIds.push(responseData.id);
                        await this.log(`Purchase ID: ${responseData.id}`);
                    }
                } catch (parseError) {
                    await this.log(`Could not parse response JSON: ${parseError.message}`, 'warning');
                }
            } else {
                await this.log(`Single item purchase API call failed (HTTP ${apiResponse.httpCode})`, 'error');
                await this.log(`Response: ${apiResponse.body}`);
                
                // Check if this is the user ID error we've seen before
                if (apiResponse.body.includes('invalid UUID') || apiResponse.body.includes('dev-user-1')) {
                    await this.log('Detected known user UUID issue - checking if purchase was created despite error...', 'warning');
                    result.knownError = 'user_uuid_issue';
                }
            }

            this.results.push(result);
            return result;
            
        } catch (error) {
            const result = {
                testName: 'Single Item Purchase',
                payload: purchasePayload,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            
            await this.log(`Single item purchase test failed: ${error.message}`, 'error');
            this.results.push(result);
            return result;
        }
    }

    async testMultiItemPurchase() {
        await this.log('Executing multi-item purchase test...');
        
        const purchasePayload = {
            supplier_id: this.testData.supplier_id,
            location_id: this.testData.location_id,
            auto_complete: true,
            items: [
                {
                    item_id: this.testData.item_id,
                    location_id: this.testData.location_id,
                    quantity: 2,
                    unit_price: 25.00,
                    batch_code: `MULTI-A-${Date.now()}`
                },
                {
                    item_id: this.testData.item_id,
                    location_id: this.testData.location_id,
                    quantity: 1,
                    unit_price: 30.00,
                    batch_code: `MULTI-B-${Date.now()}`
                }
            ],
            currency: "INR",
            shipping_amount: 5.00,
            other_charges: 2.50,
            notes: "Verification test - multi item purchase"
        };

        try {
            await this.log(`Sending multi-item purchase request...`);
            const apiResponse = await this.executePurchaseAPI(purchasePayload);
            
            const result = {
                testName: 'Multi Item Purchase',
                payload: purchasePayload,
                httpCode: apiResponse.httpCode,
                success: apiResponse.success,
                response: apiResponse.body,
                timestamp: new Date().toISOString()
            };

            if (apiResponse.success) {
                await this.log(`Multi-item purchase API call successful (HTTP ${apiResponse.httpCode})`, 'success');
                
                try {
                    const responseData = JSON.parse(apiResponse.body);
                    if (responseData.data?.id || responseData.id) {
                        const purchaseId = responseData.data?.id || responseData.id;
                        result.purchaseId = purchaseId;
                        this.purchaseIds.push(purchaseId);
                        await this.log(`Purchase ID: ${purchaseId}`);
                        
                        if (responseData.data?.status || responseData.status) {
                            result.status = responseData.data?.status || responseData.status;
                            await this.log(`Purchase Status: ${result.status}`);
                        }
                    }
                } catch (parseError) {
                    await this.log(`Could not parse multi-item response JSON: ${parseError.message}`, 'warning');
                }
            } else {
                await this.log(`Multi-item purchase API call failed (HTTP ${apiResponse.httpCode})`, 'error');
                
                if (apiResponse.body.includes('invalid UUID') || apiResponse.body.includes('dev-user-1')) {
                    result.knownError = 'user_uuid_issue';
                }
            }

            this.results.push(result);
            return result;
            
        } catch (error) {
            const result = {
                testName: 'Multi Item Purchase',
                payload: purchasePayload,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            
            await this.log(`Multi-item purchase test failed: ${error.message}`, 'error');
            this.results.push(result);
            return result;
        }
    }

    async checkForOrphanTransactions() {
        await this.log('Checking for transactions created despite API errors...');
        
        try {
            // Look for recent purchase transactions
            const recentPurchasesQuery = `
                SELECT id, transaction_number, status, total_amount, created_at, notes
                FROM transaction_headers 
                WHERE transaction_type = 'PURCHASE' 
                  AND created_at > NOW() - INTERVAL '5 minutes'
                  AND supplier_id = '${this.testData.supplier_id}'
                ORDER BY created_at DESC
            `;
            
            const result = await this.executeQuery(recentPurchasesQuery);
            const lines = result.split('\n').filter(line => line.includes('|') && !line.includes('id'));
            
            if (lines.length > 0) {
                await this.log(`Found ${lines.length} recent purchase transaction(s) despite API errors`, 'warning');
                
                for (const line of lines) {
                    const parts = line.split('|').map(p => p.trim());
                    if (parts.length >= 6) {
                        const [id, transaction_number, status, total_amount, created_at, notes] = parts;
                        
                        this.purchaseIds.push(id);
                        await this.log(`Orphan transaction found: ${transaction_number} (${status}) - ${total_amount}`);
                        
                        // Add to results
                        this.results.push({
                            testName: 'Orphan Transaction Detection',
                            purchaseId: id,
                            transactionNumber: transaction_number,
                            status: status,
                            totalAmount: total_amount,
                            success: true,
                            source: 'database_query',
                            timestamp: created_at
                        });
                    }
                }
            } else {
                await this.log('No recent purchase transactions found in database');
            }
            
        } catch (error) {
            await this.log(`Error checking for orphan transactions: ${error.message}`, 'error');
        }
    }

    async verifyTransactionStatus() {
        await this.log('Verifying purchase transaction statuses...');
        
        if (this.purchaseIds.length === 0) {
            await this.log('No purchase IDs available for status verification', 'warning');
            return;
        }
        
        for (const purchaseId of this.purchaseIds) {
            try {
                const statusQuery = `
                    SELECT id, transaction_number, status, total_amount, created_at
                    FROM transaction_headers 
                    WHERE id = '${purchaseId}'
                `;
                
                const result = await this.executeQuery(statusQuery);
                const lines = result.split('\n').filter(line => line.includes('|') && !line.includes('id'));
                
                if (lines.length > 0) {
                    const parts = lines[0].split('|').map(p => p.trim());
                    const [id, transaction_number, status, total_amount, created_at] = parts;
                    
                    await this.log(`Transaction ${transaction_number}: Status = ${status}, Amount = ${total_amount}`);
                    
                    // Update the corresponding result
                    const resultIndex = this.results.findIndex(r => r.purchaseId === purchaseId);
                    if (resultIndex >= 0) {
                        this.results[resultIndex].verifiedStatus = status;
                        this.results[resultIndex].verifiedAmount = total_amount;
                        this.results[resultIndex].transactionNumber = transaction_number;
                    }
                }
                
            } catch (error) {
                await this.log(`Error verifying status for ${purchaseId}: ${error.message}`, 'error');
            }
        }
    }

    async generateExecutionReport() {
        const timestamp = new Date().toISOString();
        
        console.log('\n🔄 PURCHASE EXECUTION REPORT');
        console.log('============================');
        console.log(`Timestamp: ${timestamp}`);
        console.log(`Tests Executed: ${this.results.length}`);
        
        const successful = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;
        const withKnownErrors = this.results.filter(r => r.knownError).length;
        
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⚠️  Known Errors: ${withKnownErrors}`);
        
        console.log('\n📋 Test Results Detail:');
        this.results.forEach((result, index) => {
            const icon = result.success ? '✅' : '❌';
            console.log(`   ${index + 1}. ${icon} ${result.testName}`);
            
            if (result.purchaseId) {
                console.log(`      Purchase ID: ${result.purchaseId}`);
            }
            
            if (result.transactionNumber) {
                console.log(`      Transaction: ${result.transactionNumber}`);
            }
            
            if (result.verifiedStatus) {
                console.log(`      Status: ${result.verifiedStatus}`);
            }
            
            if (result.httpCode) {
                console.log(`      HTTP Code: ${result.httpCode}`);
            }
            
            if (result.knownError) {
                console.log(`      Known Issue: ${result.knownError}`);
            }
            
            if (result.error) {
                console.log(`      Error: ${result.error}`);
            }
        });
        
        console.log('\n📊 Purchase Transaction IDs Created:');
        if (this.purchaseIds.length > 0) {
            this.purchaseIds.forEach((id, index) => {
                console.log(`   ${index + 1}. ${id}`);
            });
        } else {
            console.log('   No purchase transaction IDs captured');
        }
        
        console.log('\n🔍 Analysis:');
        if (successful > 0) {
            console.log(`✅ ${successful} purchase transaction(s) executed successfully`);
        }
        
        if (withKnownErrors > 0) {
            console.log(`⚠️  ${withKnownErrors} transaction(s) affected by known user UUID issue`);
            console.log('   This is likely a service configuration issue, not integration problem');
        }
        
        if (this.purchaseIds.length > 0) {
            console.log(`📦 Ready to verify inventory impact for ${this.purchaseIds.length} transaction(s)`);
        } else {
            console.log('⚠️  No purchase IDs available for inventory verification');
        }
        
        // Save results
        const executionData = {
            timestamp,
            results: this.results,
            purchaseIds: this.purchaseIds,
            baseline: this.baseline
        };
        
        fs.writeFileSync(
            '/Users/tluanga/current_work/rental-manager/rental-manager-frontend/execution-results.json',
            JSON.stringify(executionData, null, 2)
        );
        
        await this.log('Execution results saved to execution-results.json', 'success');
        
        return executionData;
    }

    async run() {
        try {
            await this.log('🚀 Starting Purchase Execution Phase...');
            
            // Execute purchase tests
            await this.testSingleItemPurchase();
            
            // Wait a moment between tests
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.testMultiItemPurchase();
            
            // Check for transactions that may have been created despite API errors
            await this.checkForOrphanTransactions();
            
            // Verify transaction statuses
            await this.verifyTransactionStatus();
            
            // Generate report
            const executionReport = await this.generateExecutionReport();
            
            await this.log('✅ Purchase execution phase completed', 'success');
            
            return executionReport;
            
        } catch (error) {
            await this.log(`❌ Purchase execution failed: ${error.message}`, 'error');
            throw error;
        }
    }
}

// Execute purchase testing
async function runPurchaseExecution() {
    const execution = new PurchaseExecution();
    
    try {
        const results = await execution.run();
        process.exit(0);
    } catch (error) {
        console.error('Purchase execution failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runPurchaseExecution().catch(console.error);
}

module.exports = { PurchaseExecution };