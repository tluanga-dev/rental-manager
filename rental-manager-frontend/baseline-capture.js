#!/usr/bin/env node

/**
 * Phase 2: Baseline Establishment
 * Captures current inventory state before purchase testing
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class BaselineCapture {
    constructor() {
        this.baseline = {};
        this.testData = {
            supplier_id: 'b128a522-2923-4535-98fa-0f04db881ab4',
            location_id: '70b8dc79-846b-47be-9450-507401a27494',
            item_id: 'bb2c8224-755d-4005-8868-b0683944364f'
        };
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

    async log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : '📊';
        console.log(`${icon} [${timestamp}] ${message}`);
    }

    async captureTableCounts() {
        await this.log('Capturing baseline table counts...');
        
        const queries = [
            { name: 'inventory_units', query: 'SELECT COUNT(*) FROM inventory_units' },
            { name: 'stock_levels', query: 'SELECT COUNT(*) FROM stock_levels' },
            { name: 'stock_movements', query: 'SELECT COUNT(*) FROM stock_movements' },
            { name: 'purchase_transactions', query: 'SELECT COUNT(*) FROM transaction_headers WHERE transaction_type = \'PURCHASE\'' },
            { name: 'completed_purchases', query: 'SELECT COUNT(*) FROM transaction_headers WHERE transaction_type = \'PURCHASE\' AND status = \'COMPLETED\'' },
            { name: 'transaction_lines', query: 'SELECT COUNT(*) FROM transaction_lines' }
        ];

        for (const { name, query } of queries) {
            try {
                const result = await this.executeQuery(query);
                const lines = result.split('\n');
                const count = parseInt(lines[2]?.trim() || '0');
                this.baseline[name] = count;
                await this.log(`${name}: ${count} records`);
            } catch (error) {
                await this.log(`Failed to capture ${name}: ${error.message}`, 'error');
                this.baseline[name] = 0;
            }
        }
    }

    async validateTestData() {
        await this.log('Validating test data existence...');
        
        const validations = [
            { 
                name: 'supplier', 
                query: `SELECT id, company_name FROM suppliers WHERE id = '${this.testData.supplier_id}' AND is_active = true`,
                field: 'company_name'
            },
            { 
                name: 'location', 
                query: `SELECT id, location_name FROM locations WHERE id = '${this.testData.location_id}' AND is_active = true`,
                field: 'location_name'
            },
            { 
                name: 'item', 
                query: `SELECT id, item_name FROM items WHERE id = '${this.testData.item_id}' AND is_active = true`,
                field: 'item_name'
            }
        ];

        const testDataStatus = {};
        
        for (const { name, query, field } of validations) {
            try {
                const result = await this.executeQuery(query);
                if (result.includes(this.testData[`${name}_id`])) {
                    const lines = result.split('\n');
                    const dataLine = lines.find(line => line.includes('|')) || '';
                    const parts = dataLine.split('|');
                    const displayName = parts[1]?.trim() || 'Unknown';
                    testDataStatus[name] = { exists: true, name: displayName };
                    await this.log(`${name} exists: ${displayName}`, 'success');
                } else {
                    testDataStatus[name] = { exists: false, error: 'Not found or inactive' };
                    await this.log(`${name} not found or inactive`, 'error');
                }
            } catch (error) {
                testDataStatus[name] = { exists: false, error: error.message };
                await this.log(`${name} validation failed: ${error.message}`, 'error');
            }
        }
        
        this.baseline.testDataStatus = testDataStatus;
        return testDataStatus;
    }

    async captureItemSpecificStock() {
        await this.log('Capturing item-specific stock levels...');
        
        try {
            const stockQuery = `
                SELECT 
                    sl.item_id,
                    sl.location_id, 
                    sl.quantity_on_hand,
                    sl.quantity_available,
                    sl.average_cost,
                    i.item_name
                FROM stock_levels sl 
                JOIN items i ON sl.item_id = i.id 
                WHERE sl.item_id = '${this.testData.item_id}' 
                  AND sl.location_id = '${this.testData.location_id}'
            `;
            
            const result = await this.executeQuery(stockQuery);
            
            if (result.includes(this.testData.item_id)) {
                const lines = result.split('\n');
                const dataLine = lines.find(line => line.includes('|') && !line.includes('item_id')) || '';
                
                if (dataLine) {
                    const parts = dataLine.split('|').map(p => p.trim());
                    this.baseline.itemStock = {
                        exists: true,
                        quantity_on_hand: parseFloat(parts[2] || '0'),
                        quantity_available: parseFloat(parts[3] || '0'),
                        average_cost: parseFloat(parts[4] || '0'),
                        item_name: parts[5] || 'Unknown'
                    };
                    
                    await this.log(`Item stock found - On Hand: ${this.baseline.itemStock.quantity_on_hand}, Available: ${this.baseline.itemStock.quantity_available}`, 'success');
                } else {
                    this.baseline.itemStock = { exists: false, reason: 'Data parsing failed' };
                }
            } else {
                this.baseline.itemStock = { exists: false, reason: 'No stock record found' };
                await this.log('No existing stock record for test item at test location');
            }
        } catch (error) {
            this.baseline.itemStock = { exists: false, error: error.message };
            await this.log(`Item stock capture failed: ${error.message}`, 'error');
        }
    }

    async captureInventoryUnits() {
        await this.log('Capturing existing inventory units...');
        
        try {
            const unitsQuery = `
                SELECT COUNT(*) as unit_count
                FROM inventory_units 
                WHERE item_id = '${this.testData.item_id}' 
                  AND location_id = '${this.testData.location_id}'
            `;
            
            const result = await this.executeQuery(unitsQuery);
            const lines = result.split('\n');
            const count = parseInt(lines[2]?.trim() || '0');
            
            this.baseline.existingUnits = count;
            await this.log(`Existing inventory units for test item: ${count}`);
        } catch (error) {
            this.baseline.existingUnits = 0;
            await this.log(`Inventory units capture failed: ${error.message}`, 'error');
        }
    }

    async captureStockMovements() {
        await this.log('Capturing recent stock movements...');
        
        try {
            const movementQuery = `
                SELECT COUNT(*) as movement_count
                FROM stock_movements 
                WHERE item_id = '${this.testData.item_id}' 
                  AND location_id = '${this.testData.location_id}'
                  AND movement_type LIKE '%PURCHASE%'
            `;
            
            const result = await this.executeQuery(movementQuery);
            const lines = result.split('\n');
            const count = parseInt(lines[2]?.trim() || '0');
            
            this.baseline.purchaseMovements = count;
            await this.log(`Existing purchase movements for test item: ${count}`);
        } catch (error) {
            this.baseline.purchaseMovements = 0;
            await this.log(`Stock movements capture failed: ${error.message}`, 'error');
        }
    }

    async checkDatabaseConnectivity() {
        await this.log('Checking database connectivity...');
        
        try {
            const result = await this.executeQuery('SELECT current_database(), current_user, now()');
            if (result.includes('rental_db') && result.includes('rental_user')) {
                await this.log('Database connectivity confirmed', 'success');
                return true;
            } else {
                await this.log('Database connectivity issues detected', 'error');
                return false;
            }
        } catch (error) {
            await this.log(`Database connectivity failed: ${error.message}`, 'error');
            return false;
        }
    }

    async checkAPIHealth() {
        await this.log('Checking API health...');
        
        try {
            const { exec } = require('child_process');
            const { stdout } = await execPromise('curl -s http://localhost:8000/health');
            
            if (stdout.includes('healthy') || stdout.includes('ok') || stdout.includes('{')) {
                await this.log('API health check passed', 'success');
                return true;
            } else {
                await this.log('API health check failed or unexpected response', 'error');
                return false;
            }
        } catch (error) {
            await this.log(`API health check failed: ${error.message}`, 'error');
            return false;
        }
    }

    async generateBaselineReport() {
        const timestamp = new Date().toISOString();
        
        console.log('\n📊 BASELINE CAPTURE REPORT');
        console.log('=========================');
        console.log(`Timestamp: ${timestamp}`);
        console.log(`Test Environment: Docker Development Setup`);
        
        console.log('\n📋 Database Table Counts:');
        console.log(`   inventory_units: ${this.baseline.inventory_units}`);
        console.log(`   stock_levels: ${this.baseline.stock_levels}`);
        console.log(`   stock_movements: ${this.baseline.stock_movements}`);
        console.log(`   purchase_transactions: ${this.baseline.purchase_transactions}`);
        console.log(`   completed_purchases: ${this.baseline.completed_purchases}`);
        console.log(`   transaction_lines: ${this.baseline.transaction_lines}`);
        
        console.log('\n🧪 Test Data Validation:');
        Object.entries(this.baseline.testDataStatus || {}).forEach(([key, status]) => {
            const icon = status.exists ? '✅' : '❌';
            const detail = status.exists ? status.name : status.error;
            console.log(`   ${icon} ${key}: ${detail}`);
        });
        
        console.log('\n📦 Item-Specific Baseline:');
        if (this.baseline.itemStock?.exists) {
            console.log(`   ✅ Stock Level Exists`);
            console.log(`   📊 Quantity On Hand: ${this.baseline.itemStock.quantity_on_hand}`);
            console.log(`   📊 Quantity Available: ${this.baseline.itemStock.quantity_available}`);
            console.log(`   💰 Average Cost: ${this.baseline.itemStock.average_cost}`);
        } else {
            console.log(`   📝 No existing stock level (will be created)`);
        }
        
        console.log(`   📦 Existing Inventory Units: ${this.baseline.existingUnits}`);
        console.log(`   📊 Purchase Movements: ${this.baseline.purchaseMovements}`);
        
        console.log('\n🔍 Environment Status:');
        console.log(`   Database: ${this.baseline.dbConnectivity ? '✅ Connected' : '❌ Issues'}`);
        console.log(`   API: ${this.baseline.apiHealth ? '✅ Healthy' : '❌ Issues'}`);
        
        console.log('\n📝 Test Data Configuration:');
        console.log(`   Supplier ID: ${this.testData.supplier_id}`);
        console.log(`   Location ID: ${this.testData.location_id}`);
        console.log(`   Item ID: ${this.testData.item_id}`);
        
        // Save baseline to file for later comparison
        const baselineData = {
            timestamp,
            baseline: this.baseline,
            testData: this.testData
        };
        
        require('fs').writeFileSync(
            '/Users/tluanga/current_work/rental-manager/rental-manager-frontend/baseline-data.json',
            JSON.stringify(baselineData, null, 2)
        );
        
        await this.log('Baseline data saved to baseline-data.json', 'success');
        
        return this.baseline;
    }

    async run() {
        try {
            await this.log('🚀 Starting Baseline Capture Process...');
            
            // Check environment
            this.baseline.dbConnectivity = await this.checkDatabaseConnectivity();
            this.baseline.apiHealth = await this.checkAPIHealth();
            
            if (!this.baseline.dbConnectivity) {
                throw new Error('Database connectivity required for baseline capture');
            }
            
            // Capture baseline data
            await this.captureTableCounts();
            await this.validateTestData();
            await this.captureItemSpecificStock();
            await this.captureInventoryUnits();
            await this.captureStockMovements();
            
            // Generate report
            const baselineReport = await this.generateBaselineReport();
            
            await this.log('✅ Baseline capture completed successfully', 'success');
            
            return baselineReport;
            
        } catch (error) {
            await this.log(`❌ Baseline capture failed: ${error.message}`, 'error');
            throw error;
        }
    }
}

// Execute baseline capture
async function runBaselineCapture() {
    const capture = new BaselineCapture();
    
    try {
        const baseline = await capture.run();
        process.exit(0);
    } catch (error) {
        console.error('Baseline capture failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runBaselineCapture().catch(console.error);
}

module.exports = { BaselineCapture };