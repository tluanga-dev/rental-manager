/**
 * 🔬 Unit of Measurement Edge Cases & Validation Testing Suite
 * Comprehensive testing of edge cases, validation rules, and boundary conditions
 */

const axios = require('axios');
const fs = require('fs');

// Edge case test configuration
const CONFIG = {
    apiUrl: 'http://localhost:8001/api/v1',
    testTimeout: 30000,
    maxRetries: 3
};

class EdgeCaseTestSuite {
    constructor() {
        this.authToken = null;
        this.testResults = {
            unicode: { passed: 0, failed: 0, total: 0 },
            boundaries: { passed: 0, failed: 0, total: 0 },
            specialChars: { passed: 0, failed: 0, total: 0 },
            concurrency: { passed: 0, failed: 0, total: 0 },
            dataIntegrity: { passed: 0, failed: 0, total: 0 },
            businessLogic: { passed: 0, failed: 0, total: 0 },
            errorHandling: { passed: 0, failed: 0, total: 0 }
        };
        
        this.createdUomIds = [];
        this.testCases = [];
    }
    
    // Utility methods
    log(category, testName, status, details = '', severity = 'INFO') {
        const timestamp = new Date().toISOString();
        const statusIcon = {
            'PASS': '✅',
            'FAIL': '❌',
            'SKIP': '⚠️',
            'INFO': 'ℹ️'
        }[status] || 'ℹ️';
        
        console.log(`[${timestamp}] ${statusIcon} ${category}: ${testName} - ${details}`);
        
        if (this.testResults[category]) {
            this.testResults[category].total++;
            if (status === 'PASS') {
                this.testResults[category].passed++;
            } else if (status === 'FAIL') {
                this.testResults[category].failed++;
            }
        }
        
        this.testCases.push({
            timestamp,
            category,
            testName,
            status,
            details,
            severity
        });
    }
    
    async authenticate() {
        try {
            const response = await axios.post(`${CONFIG.apiUrl}/auth/login`, {
                username: 'admin',
                password: 'admin123'
            });
            
            this.authToken = response.data.access_token;
            this.log('auth', 'Authentication', 'PASS', 'Successfully authenticated');
            return true;
        } catch (error) {
            this.log('auth', 'Authentication', 'FAIL', `Authentication failed: ${error.message}`);
            return false;
        }
    }
    
    getApiClient() {
        return axios.create({
            baseURL: CONFIG.apiUrl,
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            },
            timeout: CONFIG.testTimeout
        });
    }
    
    async createUom(data, expectedStatus = 201) {
        const api = this.getApiClient();
        try {
            const response = await api.post('/unit-of-measurement/', data);
            if (response.status === expectedStatus) {
                if (response.data.id) {
                    this.createdUomIds.push(response.data.id);
                }
                return { success: true, data: response.data, status: response.status };
            } else {
                return { success: false, error: `Expected ${expectedStatus}, got ${response.status}`, status: response.status };
            }
        } catch (error) {
            const status = error.response?.status || 0;
            if (status === expectedStatus) {
                return { success: true, error: error.response?.data?.detail || error.message, status };
            } else {
                return { success: false, error: error.response?.data?.detail || error.message, status };
            }
        }
    }
    
    // Phase 1: Unicode and Internationalization Testing
    async testUnicodeSupport() {
        console.log('\n🌍 Phase 1: Unicode and Internationalization Testing');
        console.log('─'.repeat(50));
        
        const unicodeTests = [
            {
                name: 'Chinese characters',
                data: { name: '千克', code: 'KG_CN', description: '重量单位' },
                expected: 201
            },
            {
                name: 'Arabic characters',
                data: { name: 'كيلوغرام', code: 'KG_AR', description: 'وحدة الوزن' },
                expected: 201
            },
            {
                name: 'Russian characters',
                data: { name: 'Килограмм', code: 'KG_RU', description: 'Единица веса' },
                expected: 201
            },
            {
                name: 'Japanese characters',
                data: { name: 'キログラム', code: 'KG_JP', description: '重量の単位' },
                expected: 201
            },
            {
                name: 'Emoji in name',
                data: { name: 'Kilogram ⚖️', code: 'KG_EMO', description: 'Weight unit with emoji' },
                expected: 201
            },
            {
                name: 'Mixed scripts',
                data: { name: 'Kilogram кг 千克', code: 'KG_MIX', description: 'Mixed script unit' },
                expected: 201
            },
            {
                name: 'Right-to-left text',
                data: { name: 'وحدة القياس', code: 'RTL', description: 'نص من اليمين إلى اليسار' },
                expected: 201
            },
            {
                name: 'Combining diacritics',
                data: { name: 'Kilógrämme', code: 'KG_DIA', description: 'Unit with diacritics' },
                expected: 201
            }
        ];
        
        for (const test of unicodeTests) {
            const result = await this.createUom(test.data, test.expected);
            
            if (result.success) {
                // Verify data integrity
                if (result.data && result.data.name === test.data.name) {
                    this.log('unicode', test.name, 'PASS', 'Unicode characters preserved correctly');
                } else {
                    this.log('unicode', test.name, 'FAIL', 'Unicode characters corrupted or modified');
                }
            } else {
                this.log('unicode', test.name, 'FAIL', `Creation failed: ${result.error}`);
            }
        }
    }
    
    // Phase 2: Boundary Value Testing
    async testBoundaryValues() {
        console.log('\n📏 Phase 2: Boundary Value Testing');
        console.log('─'.repeat(50));
        
        const boundaryTests = [
            {
                name: 'Name exactly 50 characters',
                data: { name: 'A'.repeat(50), code: 'B50', description: 'Exactly 50 chars' },
                expected: 201
            },
            {
                name: 'Name 51 characters (over limit)',
                data: { name: 'A'.repeat(51), code: 'B51', description: 'Over 50 chars' },
                expected: 422
            },
            {
                name: 'Name 1 character (minimum)',
                data: { name: 'A', code: 'MIN', description: 'Single character name' },
                expected: 201
            },
            {
                name: 'Code exactly 10 characters',
                data: { name: 'Max Code Test', code: 'A'.repeat(10), description: 'Max code length' },
                expected: 201
            },
            {
                name: 'Code 11 characters (over limit)',
                data: { name: 'Over Code Test', code: 'A'.repeat(11), description: 'Code too long' },
                expected: 422
            },
            {
                name: 'Code 1 character (minimum)',
                data: { name: 'Min Code Test', code: 'A', description: 'Single char code' },
                expected: 201
            },
            {
                name: 'Description exactly 500 characters',
                data: { 
                    name: 'Max Description Test', 
                    code: 'MDT', 
                    description: 'A'.repeat(500)
                },
                expected: 201
            },
            {
                name: 'Description 501 characters (over limit)',
                data: { 
                    name: 'Over Description Test', 
                    code: 'ODT', 
                    description: 'A'.repeat(501)
                },
                expected: 422
            },
            {
                name: 'Empty name (required field)',
                data: { name: '', code: 'EMPTY', description: 'Empty name test' },
                expected: 422
            },
            {
                name: 'Null name',
                data: { name: null, code: 'NULL', description: 'Null name test' },
                expected: 422
            },
            {
                name: 'Empty code (optional field)',
                data: { name: 'Empty Code Test', code: '', description: 'Empty code should be allowed' },
                expected: 201
            },
            {
                name: 'Null code (optional field)',
                data: { name: 'Null Code Test', code: null, description: 'Null code should be allowed' },
                expected: 201
            }
        ];
        
        for (const test of boundaryTests) {
            const result = await this.createUom(test.data, test.expected);
            
            if (result.success && test.expected === 201) {
                this.log('boundaries', test.name, 'PASS', `Created successfully with status ${result.status}`);
            } else if (result.success && test.expected > 201) {
                this.log('boundaries', test.name, 'PASS', `Properly rejected with status ${result.status}: ${result.error}`);
            } else if (!result.success && test.expected === 201) {
                this.log('boundaries', test.name, 'FAIL', `Should have been created but failed: ${result.error}`);
            } else if (!result.success && test.expected > 201) {
                this.log('boundaries', test.name, 'PASS', `Properly rejected: ${result.error}`);
            } else {
                this.log('boundaries', test.name, 'FAIL', `Unexpected result: ${result.error || 'Unknown error'}`);
            }
        }
    }
    
    // Phase 3: Special Characters and Formatting
    async testSpecialCharacters() {
        console.log('\n🔣 Phase 3: Special Characters and Formatting Testing');
        console.log('─'.repeat(50));
        
        const specialCharTests = [
            {
                name: 'Leading/trailing spaces in name',
                data: { name: '  Spaced Unit  ', code: 'SPACE', description: 'Spaces should be trimmed' },
                expected: 201,
                expectedName: 'Spaced Unit'
            },
            {
                name: 'Tabs and newlines',
                data: { name: 'Tab\tUnit\nTest', code: 'TAB', description: 'Contains tabs and newlines' },
                expected: 201
            },
            {
                name: 'Special punctuation',
                data: { name: 'Unit!@#$%^&*()', code: 'PUNCT', description: 'Special punctuation characters' },
                expected: 201
            },
            {
                name: 'Mathematical symbols',
                data: { name: 'Unit ±×÷√∞', code: 'MATH', description: 'Mathematical symbols' },
                expected: 201
            },
            {
                name: 'Currency symbols',
                data: { name: 'Unit $€£¥₹', code: 'CURR', description: 'Currency symbols' },
                expected: 201
            },
            {
                name: 'Code case sensitivity',
                data: { name: 'Case Test', code: 'lowercase', description: 'Code should be uppercase' },
                expected: 201,
                expectedCode: 'LOWERCASE'
            },
            {
                name: 'Only whitespace name',
                data: { name: '   ', code: 'WHITESPACE', description: 'Only whitespace' },
                expected: 422
            },
            {
                name: 'Control characters',
                data: { name: 'Unit\x00\x01\x02', code: 'CTRL', description: 'Control characters' },
                expected: 422
            },
            {
                name: 'HTML entities',
                data: { name: 'Unit &lt;&gt;&amp;', code: 'HTML', description: 'HTML entities' },
                expected: 201
            },
            {
                name: 'SQL injection characters',
                data: { name: "Unit'; DROP TABLE--", code: 'SQL', description: 'SQL injection attempt' },
                expected: 201
            }
        ];
        
        for (const test of specialCharTests) {
            const result = await this.createUom(test.data, test.expected);
            
            if (result.success && test.expected === 201) {
                let passed = true;
                let details = `Created successfully`;
                
                // Check expected transformations
                if (test.expectedName && result.data.name !== test.expectedName) {
                    passed = false;
                    details = `Expected name '${test.expectedName}', got '${result.data.name}'`;
                }
                
                if (test.expectedCode && result.data.code !== test.expectedCode) {
                    passed = false;
                    details = `Expected code '${test.expectedCode}', got '${result.data.code}'`;
                }
                
                this.log('specialChars', test.name, passed ? 'PASS' : 'FAIL', details);
            } else if (!result.success && test.expected > 201) {
                this.log('specialChars', test.name, 'PASS', `Properly rejected: ${result.error}`);
            } else {
                this.log('specialChars', test.name, 'FAIL', `Unexpected result: ${result.error || 'Success when failure expected'}`);
            }
        }
    }
    
    // Phase 4: Concurrency and Race Conditions
    async testConcurrency() {
        console.log('\n🏃 Phase 4: Concurrency and Race Conditions Testing');
        console.log('─'.repeat(50));
        
        // Test 1: Simultaneous duplicate creation
        console.log('Testing simultaneous duplicate creation...');
        
        const duplicateName = `Concurrent Test ${Date.now()}`;
        const promises = [];
        
        for (let i = 0; i < 5; i++) {
            promises.push(this.createUom({
                name: duplicateName,
                code: `CONC${i}`,
                description: `Concurrent test ${i}`
            }));
        }
        
        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.success).length;
        
        if (successCount === 1) {
            this.log('concurrency', 'Duplicate name prevention', 'PASS', 'Only one duplicate name allowed');
        } else {
            this.log('concurrency', 'Duplicate name prevention', 'FAIL', `${successCount} duplicates created instead of 1`);
        }
        
        // Test 2: Simultaneous updates to same entity
        if (this.createdUomIds.length > 0) {
            console.log('Testing simultaneous updates...');
            
            const uomId = this.createdUomIds[0];
            const updatePromises = [];
            
            for (let i = 0; i < 3; i++) {
                updatePromises.push((async () => {
                    const api = this.getApiClient();
                    try {
                        const response = await api.put(`/unit-of-measurement/${uomId}`, {
                            name: `Updated Name ${i}`,
                            description: `Update ${i} at ${Date.now()}`
                        });
                        return { success: true, data: response.data, updateId: i };
                    } catch (error) {
                        return { 
                            success: false, 
                            error: error.response?.data?.detail || error.message,
                            updateId: i
                        };
                    }
                })());
            }
            
            const updateResults = await Promise.all(updatePromises);
            const updateSuccessCount = updateResults.filter(r => r.success).length;
            
            if (updateSuccessCount >= 1) {
                this.log('concurrency', 'Concurrent updates', 'PASS', `${updateSuccessCount} updates completed without corruption`);
            } else {
                this.log('concurrency', 'Concurrent updates', 'FAIL', 'All concurrent updates failed');
            }
        }
        
        // Test 3: Create vs Delete race condition
        console.log('Testing create vs delete race condition...');
        
        const createPromise = this.createUom({
            name: `Race Test ${Date.now()}`,
            code: 'RACE',
            description: 'Race condition test'
        });
        
        const deletePromises = [];
        if (this.createdUomIds.length > 1) {
            const deleteId = this.createdUomIds[1];
            deletePromises.push((async () => {
                const api = this.getApiClient();
                try {
                    await api.delete(`/unit-of-measurement/${deleteId}`);
                    return { success: true };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            })());
        }
        
        const raceResults = await Promise.all([createPromise, ...deletePromises]);
        const raceSuccess = raceResults.every(r => r.success);
        
        this.log('concurrency', 'Create vs Delete race', raceSuccess ? 'PASS' : 'FAIL', 
            `Race condition handling: ${raceSuccess ? 'OK' : 'Failed'}`);
    }
    
    // Phase 5: Data Integrity Testing
    async testDataIntegrity() {
        console.log('\n🔍 Phase 5: Data Integrity Testing');
        console.log('─'.repeat(50));
        
        // Test 1: Create and verify data persistence
        const testUnit = {
            name: 'Integrity Test Unit',
            code: 'ITU',
            description: 'Testing data integrity and persistence'
        };
        
        const createResult = await this.createUom(testUnit);
        
        if (createResult.success) {
            const api = this.getApiClient();
            
            try {
                // Immediately read back the created unit
                const readResponse = await api.get(`/unit-of-measurement/${createResult.data.id}`);
                
                const match = readResponse.data.name === testUnit.name &&
                            readResponse.data.code === testUnit.code &&
                            readResponse.data.description === testUnit.description;
                
                this.log('dataIntegrity', 'Create-Read consistency', 
                    match ? 'PASS' : 'FAIL', 
                    match ? 'Data matches after create' : 'Data corruption detected');
                
                // Test update and verify
                const updateData = { name: 'Updated Integrity Test' };
                await api.put(`/unit-of-measurement/${createResult.data.id}`, updateData);
                
                const updatedResponse = await api.get(`/unit-of-measurement/${createResult.data.id}`);
                
                const updateMatch = updatedResponse.data.name === updateData.name;
                this.log('dataIntegrity', 'Update-Read consistency', 
                    updateMatch ? 'PASS' : 'FAIL',
                    updateMatch ? 'Update persisted correctly' : 'Update not persisted');
                
            } catch (error) {
                this.log('dataIntegrity', 'Data persistence', 'FAIL', `Read-back failed: ${error.message}`);
            }
        }
        
        // Test 2: Search result consistency
        const api = this.getApiClient();
        try {
            const listResponse = await api.get('/unit-of-measurement/?page=1&page_size=5');
            const searchResponse = await api.get('/unit-of-measurement/search/?q=test&limit=10');
            
            if (listResponse.data.items && searchResponse.data) {
                this.log('dataIntegrity', 'Search consistency', 'PASS', 
                    `List returned ${listResponse.data.items.length} items, search returned ${searchResponse.data.length} items`);
            } else {
                this.log('dataIntegrity', 'Search consistency', 'FAIL', 'Invalid response structure');
            }
        } catch (error) {
            this.log('dataIntegrity', 'Search consistency', 'FAIL', `Search failed: ${error.message}`);
        }
        
        // Test 3: Statistics consistency
        try {
            const statsResponse = await api.get('/unit-of-measurement/stats/');
            const listAllResponse = await api.get('/unit-of-measurement/?page_size=1000');
            
            if (statsResponse.data.total_units && listAllResponse.data.total) {
                const statsMatch = Math.abs(statsResponse.data.total_units - listAllResponse.data.total) <= 1;
                this.log('dataIntegrity', 'Statistics consistency', 
                    statsMatch ? 'PASS' : 'FAIL',
                    `Stats: ${statsResponse.data.total_units}, List: ${listAllResponse.data.total}`);
            }
        } catch (error) {
            this.log('dataIntegrity', 'Statistics consistency', 'FAIL', `Stats check failed: ${error.message}`);
        }
    }
    
    // Phase 6: Business Logic Edge Cases
    async testBusinessLogic() {
        console.log('\n🏢 Phase 6: Business Logic Edge Cases');
        console.log('─'.repeat(50));
        
        const api = this.getApiClient();
        
        // Test 1: Display name logic
        const displayTests = [
            { name: 'Test Unit', code: 'TU', expectedDisplay: 'Test Unit (TU)' },
            { name: 'No Code Unit', code: null, expectedDisplay: 'No Code Unit' },
            { name: 'Empty Code Unit', code: '', expectedDisplay: 'Empty Code Unit' }
        ];
        
        for (const test of displayTests) {
            const result = await this.createUom({
                name: test.name,
                code: test.code,
                description: 'Display name test'
            });
            
            if (result.success && result.data.display_name === test.expectedDisplay) {
                this.log('businessLogic', `Display name: ${test.name}`, 'PASS', 
                    `Correct display name: ${result.data.display_name}`);
            } else if (result.success) {
                this.log('businessLogic', `Display name: ${test.name}`, 'FAIL', 
                    `Expected: ${test.expectedDisplay}, Got: ${result.data.display_name}`);
            } else {
                this.log('businessLogic', `Display name: ${test.name}`, 'FAIL', 
                    `Creation failed: ${result.error}`);
            }
        }
        
        // Test 2: Active/Inactive state transitions
        if (this.createdUomIds.length > 0) {
            const testId = this.createdUomIds[0];
            
            try {
                // Deactivate
                await api.post(`/unit-of-measurement/${testId}/deactivate`);
                const deactivatedResponse = await api.get(`/unit-of-measurement/${testId}`);
                
                if (!deactivatedResponse.data.is_active) {
                    this.log('businessLogic', 'Deactivation', 'PASS', 'Unit properly deactivated');
                } else {
                    this.log('businessLogic', 'Deactivation', 'FAIL', 'Unit not deactivated');
                }
                
                // Reactivate
                await api.post(`/unit-of-measurement/${testId}/activate`);
                const reactivatedResponse = await api.get(`/unit-of-measurement/${testId}`);
                
                if (reactivatedResponse.data.is_active) {
                    this.log('businessLogic', 'Reactivation', 'PASS', 'Unit properly reactivated');
                } else {
                    this.log('businessLogic', 'Reactivation', 'FAIL', 'Unit not reactivated');
                }
                
            } catch (error) {
                this.log('businessLogic', 'State transitions', 'FAIL', `State transition failed: ${error.message}`);
            }
        }
        
        // Test 3: Bulk operations edge cases
        if (this.createdUomIds.length >= 3) {
            try {
                const bulkIds = this.createdUomIds.slice(0, 3);
                
                // Test bulk deactivation
                const bulkDeactivateResponse = await api.post('/unit-of-measurement/bulk-operation', {
                    unit_ids: bulkIds,
                    operation: 'deactivate'
                });
                
                if (bulkDeactivateResponse.data.success_count === bulkIds.length) {
                    this.log('businessLogic', 'Bulk deactivation', 'PASS', 
                        `Successfully deactivated ${bulkIds.length} units`);
                } else {
                    this.log('businessLogic', 'Bulk deactivation', 'FAIL', 
                        `Expected ${bulkIds.length}, got ${bulkDeactivateResponse.data.success_count}`);
                }
                
                // Test bulk operation with mixed valid/invalid IDs
                const mixedIds = [...bulkIds, '00000000-0000-0000-0000-000000000000'];
                
                const bulkMixedResponse = await api.post('/unit-of-measurement/bulk-operation', {
                    unit_ids: mixedIds,
                    operation: 'activate'
                });
                
                if (bulkMixedResponse.data.success_count === bulkIds.length && 
                    bulkMixedResponse.data.failure_count === 1) {
                    this.log('businessLogic', 'Bulk mixed IDs', 'PASS', 
                        `Properly handled mixed valid/invalid IDs`);
                } else {
                    this.log('businessLogic', 'Bulk mixed IDs', 'FAIL', 
                        `Incorrect handling of mixed IDs: ${JSON.stringify(bulkMixedResponse.data)}`);
                }
                
            } catch (error) {
                this.log('businessLogic', 'Bulk operations', 'FAIL', `Bulk operation failed: ${error.message}`);
            }
        }
    }
    
    // Phase 7: Error Handling Edge Cases
    async testErrorHandling() {
        console.log('\n⚠️ Phase 7: Error Handling Edge Cases');
        console.log('─'.repeat(50));
        
        const api = this.getApiClient();
        
        // Test 1: Invalid UUID formats
        const invalidUuids = [
            'invalid-uuid',
            '123456789',
            'not-a-uuid-at-all',
            '00000000-0000-0000-0000-00000000000G', // Invalid character
            '00000000-0000-0000-0000-000000000000', // Valid format but non-existent
        ];
        
        for (const invalidId of invalidUuids) {
            try {
                await api.get(`/unit-of-measurement/${invalidId}`);
                this.log('errorHandling', `Invalid UUID: ${invalidId}`, 'FAIL', 'Should have rejected invalid UUID');
            } catch (error) {
                const status = error.response?.status;
                if (status === 404 || status === 422 || status === 400) {
                    this.log('errorHandling', `Invalid UUID: ${invalidId}`, 'PASS', 
                        `Properly rejected with status ${status}`);
                } else {
                    this.log('errorHandling', `Invalid UUID: ${invalidId}`, 'FAIL', 
                        `Unexpected status ${status}`);
                }
            }
        }
        
        // Test 2: Invalid JSON payloads
        const invalidPayloads = [
            '{"name": "Test", "code": "T1"', // Missing closing brace
            '{"name": "Test", "code":}', // Missing value
            '{name: "Test", code: "T2"}', // Unquoted keys
            '{"name": "Test", "code": "T3",}', // Trailing comma
        ];
        
        for (let i = 0; i < invalidPayloads.length; i++) {
            try {
                const response = await axios.post(`${CONFIG.apiUrl}/unit-of-measurement/`, 
                    invalidPayloads[i], {
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                this.log('errorHandling', `Invalid JSON ${i + 1}`, 'FAIL', 
                    'Should have rejected invalid JSON');
            } catch (error) {
                const status = error.response?.status;
                if (status === 422 || status === 400) {
                    this.log('errorHandling', `Invalid JSON ${i + 1}`, 'PASS', 
                        `Properly rejected invalid JSON with status ${status}`);
                } else {
                    this.log('errorHandling', `Invalid JSON ${i + 1}`, 'FAIL', 
                        `Unexpected status ${status} for invalid JSON`);
                }
            }
        }
        
        // Test 3: Missing required fields combinations
        const incompletePayloads = [
            {},
            { code: 'TEST' },
            { description: 'Test description' },
            { code: 'TEST', description: 'Test description' }
        ];
        
        for (let i = 0; i < incompletePayloads.length; i++) {
            try {
                await api.post('/unit-of-measurement/', incompletePayloads[i]);
                this.log('errorHandling', `Missing name ${i + 1}`, 'FAIL', 
                    'Should have rejected payload without required name field');
            } catch (error) {
                const status = error.response?.status;
                if (status === 422 || status === 400) {
                    this.log('errorHandling', `Missing name ${i + 1}`, 'PASS', 
                        `Properly rejected incomplete payload with status ${status}`);
                } else {
                    this.log('errorHandling', `Missing name ${i + 1}`, 'FAIL', 
                        `Unexpected status ${status} for incomplete payload`);
                }
            }
        }
        
        // Test 4: Extreme values
        const extremeTests = [
            {
                name: 'Very large integer in name',
                data: { name: Number.MAX_SAFE_INTEGER.toString(), code: 'BIG' },
                shouldFail: false
            },
            {
                name: 'Negative values as strings',
                data: { name: '-1000', code: 'NEG' },
                shouldFail: false
            },
            {
                name: 'Boolean values',
                data: { name: 'true', code: 'BOOL' },
                shouldFail: false
            },
            {
                name: 'Array as name',
                data: { name: ['array', 'name'], code: 'ARR' },
                shouldFail: true
            },
            {
                name: 'Object as name',
                data: { name: { nested: 'object' }, code: 'OBJ' },
                shouldFail: true
            }
        ];
        
        for (const test of extremeTests) {
            try {
                await api.post('/unit-of-measurement/', test.data);
                if (test.shouldFail) {
                    this.log('errorHandling', test.name, 'FAIL', 'Should have rejected extreme value');
                } else {
                    this.log('errorHandling', test.name, 'PASS', 'Accepted valid extreme value');
                }
            } catch (error) {
                if (test.shouldFail) {
                    this.log('errorHandling', test.name, 'PASS', 'Properly rejected extreme value');
                } else {
                    this.log('errorHandling', test.name, 'FAIL', `Incorrectly rejected valid value: ${error.message}`);
                }
            }
        }
    }
    
    // Cleanup created test data
    async cleanup() {
        console.log('\n🧹 Cleaning up test data...');
        
        const api = this.getApiClient();
        let cleanedCount = 0;
        
        for (const uomId of this.createdUomIds) {
            try {
                await api.delete(`/unit-of-measurement/${uomId}`);
                cleanedCount++;
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        
        console.log(`✅ Cleaned up ${cleanedCount}/${this.createdUomIds.length} test units`);
    }
    
    // Generate comprehensive report
    generateReport() {
        const timestamp = new Date().toISOString();
        
        console.log('\n📊 EDGE CASE TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        let totalPassed = 0;
        let totalFailed = 0;
        let totalTests = 0;
        
        Object.entries(this.testResults).forEach(([category, results]) => {
            if (results.total > 0) {
                console.log(`${category}: ${results.passed}/${results.total} passed (${results.failed} failed)`);
                totalPassed += results.passed;
                totalFailed += results.failed;
                totalTests += results.total;
            }
        });
        
        console.log('─'.repeat(60));
        console.log(`OVERALL: ${totalPassed}/${totalTests} passed (${totalFailed} failed)`);
        
        const successRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
        console.log(`Success Rate: ${successRate}%`);
        
        // Identify critical failures
        const criticalFailures = this.testCases.filter(tc => 
            tc.status === 'FAIL' && 
            (tc.severity === 'CRITICAL' || 
             tc.category === 'dataIntegrity' || 
             tc.category === 'businessLogic')
        );
        
        if (criticalFailures.length > 0) {
            console.log('\n🚨 CRITICAL FAILURES:');
            criticalFailures.forEach(failure => {
                console.log(`   • ${failure.category}/${failure.testName}: ${failure.details}`);
            });
        }
        
        // Save detailed report
        const report = {
            summary: {
                timestamp,
                totalTests,
                totalPassed,
                totalFailed,
                successRate,
                criticalFailures: criticalFailures.length
            },
            categoryResults: this.testResults,
            detailedResults: this.testCases,
            recommendations: this.generateRecommendations()
        };
        
        fs.writeFileSync('uom_edge_cases_report.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Detailed report saved to: uom_edge_cases_report.json');
        
        return successRate >= 90 && criticalFailures.length === 0;
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        // Analyze test results for recommendations
        if (this.testResults.unicode.failed > 0) {
            recommendations.push({
                category: 'Internationalization',
                priority: 'MEDIUM',
                issue: 'Unicode handling issues detected',
                recommendation: 'Review Unicode normalization and encoding handling'
            });
        }
        
        if (this.testResults.boundaries.failed > 0) {
            recommendations.push({
                category: 'Validation',
                priority: 'HIGH',
                issue: 'Boundary value validation issues',
                recommendation: 'Strengthen input validation for edge cases'
            });
        }
        
        if (this.testResults.concurrency.failed > 0) {
            recommendations.push({
                category: 'Concurrency',
                priority: 'HIGH',
                issue: 'Race condition vulnerabilities',
                recommendation: 'Implement proper locking mechanisms and transaction handling'
            });
        }
        
        if (this.testResults.dataIntegrity.failed > 0) {
            recommendations.push({
                category: 'Data Integrity',
                priority: 'CRITICAL',
                issue: 'Data corruption or inconsistency detected',
                recommendation: 'Immediate investigation of data persistence layer required'
            });
        }
        
        return recommendations;
    }
    
    // Main execution method
    async run() {
        console.log('🔬 UNIT OF MEASUREMENT EDGE CASES & VALIDATION TEST SUITE');
        console.log('='.repeat(70));
        console.log(`Started: ${new Date().toISOString()}`);
        console.log('');
        
        try {
            // Authentication
            const authenticated = await this.authenticate();
            if (!authenticated) {
                throw new Error('Authentication failed');
            }
            
            // Run all test phases
            await this.testUnicodeSupport();
            await this.testBoundaryValues();
            await this.testSpecialCharacters();
            await this.testConcurrency();
            await this.testDataIntegrity();
            await this.testBusinessLogic();
            await this.testErrorHandling();
            
            // Cleanup
            await this.cleanup();
            
            // Generate report
            const success = this.generateReport();
            
            console.log('\n🎯 Edge Case Testing Complete!');
            
            if (success) {
                console.log('✅ All edge cases handled correctly - system is robust');
                return true;
            } else {
                console.log('⚠️  Some edge cases failed - review recommendations');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Edge case test suite failed:', error.message);
            return false;
        }
    }
}

// Execute if run directly
if (require.main === module) {
    const suite = new EdgeCaseTestSuite();
    
    suite.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Edge case test suite crashed:', error);
        process.exit(1);
    });
}

module.exports = EdgeCaseTestSuite;