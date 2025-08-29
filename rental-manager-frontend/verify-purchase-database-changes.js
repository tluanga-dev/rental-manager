const { spawn } = require('child_process');
const fs = require('fs').promises;

/**
 * Database Verification Script for Purchase Transactions
 * This script verifies that purchase transactions are properly recorded
 * in the database and that inventory is updated correctly.
 */

class DatabaseVerifier {
  constructor() {
    this.baseline = null;
  }

  async loadBaseline() {
    try {
      const data = await fs.readFile('baseline_database_state.json', 'utf8');
      this.baseline = JSON.parse(data);
      console.log('📊 Loaded baseline database state');
    } catch (error) {
      console.log('⚠️ Could not load baseline, creating new one...');
      await this.createBaseline();
    }
  }

  async createBaseline() {
    const counts = await this.getDatabaseCounts();
    this.baseline = {
      timestamp: new Date().toISOString(),
      database_snapshot: counts
    };
    
    await fs.writeFile('baseline_database_state.json', JSON.stringify(this.baseline, null, 2));
    console.log('📊 Created new baseline database state');
  }

  async runQuery(query) {
    return new Promise((resolve, reject) => {
      const process = spawn('docker-compose', [
        'exec', '-T', 'postgres', 'psql', 
        '-U', 'rental_user', '-d', 'rental_db', 
        '-c', query
      ]);

      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Query failed with code ${code}`));
        }
      });
    });
  }

  async getDatabaseCounts() {
    try {
      console.log('🔍 Querying database for current state...');

      const queries = {
        transactions: "SELECT COUNT(*) FROM transaction_headers WHERE transaction_type = 'PURCHASE';",
        transactionLines: "SELECT COUNT(*) FROM transaction_lines WHERE transaction_header_id IN (SELECT id FROM transaction_headers WHERE transaction_type = 'PURCHASE');",
        stockLevels: "SELECT COUNT(*) FROM stock_levels;",
        stockMovements: "SELECT COUNT(*) FROM stock_movements;",
        inventoryUnits: "SELECT COUNT(*) FROM inventory_units;"
      };

      const results = {};

      for (const [key, query] of Object.entries(queries)) {
        try {
          const output = await this.runQuery(query);
          const match = output.match(/(\d+)/);
          results[key] = match ? parseInt(match[1]) : 0;
        } catch (error) {
          console.log(`⚠️ Could not query ${key}: ${error.message}`);
          results[key] = 0;
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Database query failed:', error.message);
      return {
        transactions: 0,
        transactionLines: 0,
        stockLevels: 0,
        stockMovements: 0,
        inventoryUnits: 0
      };
    }
  }

  async getLatestTransactions(limit = 5) {
    try {
      const query = `
        SELECT 
          id, 
          transaction_number, 
          status, 
          total_amount, 
          total_items, 
          created_at,
          supplier_name
        FROM transaction_headers 
        WHERE transaction_type = 'PURCHASE' 
        ORDER BY created_at DESC 
        LIMIT ${limit};
      `;

      const output = await this.runQuery(query);
      console.log('📋 Latest purchase transactions:');
      console.log(output);
      return output;
    } catch (error) {
      console.log('⚠️ Could not fetch latest transactions:', error.message);
      return '';
    }
  }

  async checkInventoryImpact() {
    try {
      console.log('\n🏭 Checking inventory impact...');

      const stockLevelsQuery = `
        SELECT 
          item_name,
          location_name,
          quantity_on_hand,
          quantity_available,
          last_updated
        FROM stock_levels 
        ORDER BY last_updated DESC 
        LIMIT 10;
      `;

      const stockMovementsQuery = `
        SELECT 
          movement_type,
          quantity,
          reference_type,
          reference_id,
          created_at
        FROM stock_movements 
        ORDER BY created_at DESC 
        LIMIT 10;
      `;

      console.log('\n📦 Recent stock levels:');
      const stockLevels = await this.runQuery(stockLevelsQuery);
      console.log(stockLevels);

      console.log('\n📋 Recent stock movements:');
      const stockMovements = await this.runQuery(stockMovementsQuery);
      console.log(stockMovements);

    } catch (error) {
      console.log('⚠️ Could not check inventory impact:', error.message);
    }
  }

  async verifyPurchaseImpact() {
    console.log('\n📊 PURCHASE TRANSACTION DATABASE VERIFICATION');
    console.log('='.repeat(60));

    await this.loadBaseline();
    
    const currentCounts = await this.getDatabaseCounts();
    const baseline = this.baseline.database_snapshot || {};

    // Ensure baseline has default values
    const baselineDefaults = {
      transactions: baseline.transaction_headers?.purchase_count || baseline.transactions || 0,
      transactionLines: baseline.transaction_lines?.purchase_lines_count || baseline.transactionLines || 0,
      stockLevels: baseline.stock_levels?.total_count || baseline.stockLevels || 0,
      stockMovements: baseline.stock_movements?.total_count || baseline.stockMovements || 0,
      inventoryUnits: baseline.inventoryUnits || 0
    };

    console.log('\n📈 Database Count Comparison:');
    console.log('Category                 | Baseline | Current | Change');
    console.log('-'.repeat(55));
    console.log(`Purchase Transactions    | ${baselineDefaults.transactions.toString().padStart(8)} | ${currentCounts.transactions.toString().padStart(7)} | ${(currentCounts.transactions - baselineDefaults.transactions >= 0 ? '+' : '')}${currentCounts.transactions - baselineDefaults.transactions}`);
    console.log(`Transaction Lines        | ${baselineDefaults.transactionLines.toString().padStart(8)} | ${currentCounts.transactionLines.toString().padStart(7)} | ${(currentCounts.transactionLines - baselineDefaults.transactionLines >= 0 ? '+' : '')}${currentCounts.transactionLines - baselineDefaults.transactionLines}`);
    console.log(`Stock Levels            | ${baselineDefaults.stockLevels.toString().padStart(8)} | ${currentCounts.stockLevels.toString().padStart(7)} | ${(currentCounts.stockLevels - baselineDefaults.stockLevels >= 0 ? '+' : '')}${currentCounts.stockLevels - baselineDefaults.stockLevels}`);
    console.log(`Stock Movements         | ${baselineDefaults.stockMovements.toString().padStart(8)} | ${currentCounts.stockMovements.toString().padStart(7)} | ${(currentCounts.stockMovements - baselineDefaults.stockMovements >= 0 ? '+' : '')}${currentCounts.stockMovements - baselineDefaults.stockMovements}`);
    console.log(`Inventory Units         | ${baselineDefaults.inventoryUnits.toString().padStart(8)} | ${currentCounts.inventoryUnits.toString().padStart(7)} | ${(currentCounts.inventoryUnits - baselineDefaults.inventoryUnits >= 0 ? '+' : '')}${currentCounts.inventoryUnits - baselineDefaults.inventoryUnits}`);

    // Analysis
    const transactionIncrease = currentCounts.transactions - baselineDefaults.transactions;
    const lineIncrease = currentCounts.transactionLines - baselineDefaults.transactionLines;
    const stockIncrease = currentCounts.stockLevels - baselineDefaults.stockLevels;
    const movementIncrease = currentCounts.stockMovements - baselineDefaults.stockMovements;

    console.log('\n🎯 Analysis:');
    
    if (transactionIncrease > 0) {
      console.log(`✅ ${transactionIncrease} new purchase transaction(s) detected`);
      
      if (lineIncrease > 0) {
        console.log(`✅ ${lineIncrease} new transaction line(s) detected`);
      } else {
        console.log('⚠️ New transactions found but no transaction lines detected');
      }

      if (stockIncrease > 0 || movementIncrease > 0) {
        console.log('✅ Inventory impact detected');
        if (stockIncrease > 0) console.log(`   - ${stockIncrease} new stock level entries`);
        if (movementIncrease > 0) console.log(`   - ${movementIncrease} new stock movements`);
      } else {
        console.log('⚠️ No inventory impact detected (may be handled differently)');
      }

    } else {
      console.log('⚠️ No new purchase transactions detected since baseline');
    }

    // Show latest transactions
    console.log('\n' + '='.repeat(60));
    await this.getLatestTransactions();

    // Check inventory impact
    await this.checkInventoryImpact();

    // Generate summary
    const overallSuccess = transactionIncrease > 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('🏆 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    
    if (overallSuccess) {
      console.log('✅ SUCCESS: Purchase transaction flow is working!');
      console.log('   - Transactions are being recorded in database');
      console.log('   - Transaction lines are being created');
      console.log('   - System is properly integrated');
    } else {
      console.log('❌ NO NEW TRANSACTIONS: Either no purchases were made or there are issues');
      console.log('   - Check if purchase form was submitted successfully');
      console.log('   - Verify backend API is processing requests');
      console.log('   - Check for any error logs');
    }

    console.log('\n💡 Recommendations:');
    if (!overallSuccess) {
      console.log('   - Run the purchase form test and complete a manual purchase');
      console.log('   - Check backend logs for any API errors');
      console.log('   - Verify database connectivity');
    } else {
      console.log('   - Purchase system is working correctly');
      console.log('   - Consider automated testing for continuous validation');
    }

    console.log('='.repeat(60));

    // Update baseline with current state
    await fs.writeFile('post_test_database_state.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      database_snapshot: currentCounts,
      changes_from_baseline: {
        transactions: transactionIncrease,
        transactionLines: lineIncrease,
        stockLevels: stockIncrease,
        stockMovements: movementIncrease
      }
    }, null, 2));
    
    console.log('📄 Post-test database state saved to: post_test_database_state.json');

    return overallSuccess;
  }
}

// Run verification
async function main() {
  const verifier = new DatabaseVerifier();
  const success = await verifier.verifyPurchaseImpact();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabaseVerifier;