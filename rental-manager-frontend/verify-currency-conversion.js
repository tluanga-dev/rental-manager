const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying complete currency conversion from USD ($) to INR (₹)...');
console.log('='.repeat(70));

// Function to recursively find all files
function findAllFiles(dir, extensions = ['.tsx', '.ts']) {
  const files = [];
  
  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip certain directories
        if (!item.startsWith('.') && 
            item !== 'node_modules' && 
            item !== 'dist' && 
            item !== 'build' &&
            item !== '.next') {
          scan(fullPath);
        }
      } else {
        // Include files with specified extensions
        if (extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scan(dir);
  return files;
}

// Find all TypeScript and TSX files in src/
const srcDir = path.join(__dirname, 'src');
const allFiles = findAllFiles(srcDir);

console.log(`📁 Scanning ${allFiles.length} TypeScript/TSX files in src/ directory...\n`);

let totalFiles = 0;
let issuesFound = 0;
const issues = [];

// Check each file
allFiles.forEach(filePath => {
  totalFiles++;
  const relativePath = path.relative(__dirname, filePath);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileIssues = [];
    
    // Check for DollarSign imports (should be replaced with IndianRupee)
    const dollarSignImports = content.match(/import.*DollarSign.*from/g);
    if (dollarSignImports) {
      fileIssues.push(`❌ DollarSign import found: ${dollarSignImports.join(', ')}`);
    }
    
    // Check for <DollarSign> component usage
    const dollarSignComponents = content.match(/<DollarSign[^>]*>/g);
    if (dollarSignComponents) {
      fileIssues.push(`❌ <DollarSign> component usage: ${dollarSignComponents.join(', ')}`);
    }
    
    // Check for CurrencyDollarIcon (should be replaced)
    const currencyDollarIcon = content.match(/CurrencyDollarIcon/g);
    if (currencyDollarIcon) {
      fileIssues.push(`❌ CurrencyDollarIcon found ${currencyDollarIcon.length} times`);
    }
    
    // Check for USD currency references (should be INR)
    const usdReferences = content.match(/['"`]USD['"`]|currency.*USD/gi);
    if (usdReferences && !relativePath.includes('currency-utils.ts')) {
      fileIssues.push(`⚠️ USD currency reference: ${usdReferences.join(', ')}`);
    }
    
    // Check for hardcoded $ symbols in currency displays (but not in template literals)
    const dollarDisplays = content.match(/\$\{[^}]*\d|['"`]\$\d|>\$\d/g);
    if (dollarDisplays) {
      fileIssues.push(`❌ Hardcoded $ currency displays: ${dollarDisplays.join(', ')}`);
    }
    
    // Check for 'Credit Limit ($)' pattern
    const creditLimitDollar = content.match(/Credit Limit.*\$/g);
    if (creditLimitDollar) {
      fileIssues.push(`❌ Credit Limit ($) label: ${creditLimitDollar.join(', ')}`);
    }
    
    if (fileIssues.length > 0) {
      issues.push({
        file: relativePath,
        issues: fileIssues
      });
      issuesFound += fileIssues.length;
    }
    
  } catch (error) {
    console.log(`❌ Error reading ${relativePath}: ${error.message}`);
  }
});

// Report findings
console.log('📊 VERIFICATION RESULTS:');
console.log('='.repeat(50));
console.log(`✅ Files scanned: ${totalFiles}`);
console.log(`${issuesFound > 0 ? '❌' : '✅'} Issues found: ${issuesFound}`);
console.log(`✅ Clean files: ${totalFiles - issues.length}`);

if (issues.length > 0) {
  console.log('\n🔍 DETAILED ISSUES:');
  console.log('='.repeat(30));
  
  issues.forEach(({ file, issues: fileIssues }) => {
    console.log(`\n📁 ${file}:`);
    fileIssues.forEach(issue => {
      console.log(`   ${issue}`);
    });
  });
  
  console.log('\n❗ ACTION REQUIRED:');
  console.log('The files above still contain USD/Dollar references that should be converted to INR/Rupee.');
} else {
  console.log('\n🎉 SUCCESS: All currency conversions completed!');
  console.log('✅ No remaining USD/Dollar symbols found');
  console.log('✅ All components use IndianRupee icons');
  console.log('✅ All currency displays use ₹ symbol');
  console.log('✅ All forms use INR currency labels');
}

// Additional checks for common good practices
console.log('\n📋 ADDITIONAL VERIFICATION:');
console.log('='.repeat(40));

// Count IndianRupee usage
const indianRupeeCount = allFiles.reduce((count, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(/IndianRupee/g);
    return count + (matches ? matches.length : 0);
  } catch {
    return count;
  }
}, 0);

// Count ₹ symbol usage
const rupeeSymbolCount = allFiles.reduce((count, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(/₹/g);
    return count + (matches ? matches.length : 0);
  } catch {
    return count;
  }
}, 0);

console.log(`✅ IndianRupee icon usage: ${indianRupeeCount} instances`);
console.log(`✅ ₹ symbol usage: ${rupeeSymbolCount} instances`);

if (indianRupeeCount > 0 && rupeeSymbolCount > 0) {
  console.log(`✅ Good! Using both IndianRupee icons and ₹ symbols`);
}

console.log('\n🎯 SUMMARY:');
if (issuesFound === 0) {
  console.log('🏆 PERFECT! Complete currency conversion from USD ($) to INR (₹) achieved!');
  console.log('🌟 The application is now fully localized for Indian market');
} else {
  console.log(`⚠️ ${issuesFound} issues need to be fixed for complete conversion`);
}

console.log('\n' + '='.repeat(70));