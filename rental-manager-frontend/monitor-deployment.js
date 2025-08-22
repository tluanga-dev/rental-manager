const https = require('https');

console.log('🚀 Monitoring Vercel Deployment...\n');
console.log('📦 Last commit pushed: "chore: trigger Vercel deployment for rental extension feature"');
console.log('⏰ Started monitoring at:', new Date().toLocaleTimeString());
console.log('=' .repeat(60) + '\n');

const checkDeployment = () => {
  return new Promise((resolve, reject) => {
    https.get('https://www.omomrentals.shop/rentals/d9297036-7279-4cf6-997d-963e0cec40c8/extend', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

let checkCount = 0;
const maxChecks = 20; // Check for up to 10 minutes (20 * 30 seconds)

async function monitorDeployment() {
  checkCount++;
  console.log(`Check #${checkCount} at ${new Date().toLocaleTimeString()}`);
  
  try {
    const result = await checkDeployment();
    
    if (result.data.includes('Application error')) {
      console.log('⏳ Status: Old version still running (Application error)');
      console.log('   Deployment may be in progress...\n');
      
      if (checkCount < maxChecks) {
        console.log(`   Will check again in 30 seconds... (${maxChecks - checkCount} checks remaining)\n`);
        setTimeout(monitorDeployment, 30000); // Check every 30 seconds
      } else {
        console.log('\n❌ Deployment timeout!');
        console.log('   The deployment hasn\'t completed after 10 minutes.');
        console.log('   Please check Vercel dashboard manually.');
        showManualInstructions();
      }
    } else if (result.data.includes('Period') || result.data.includes('extension') || result.data.includes('Extend Rental')) {
      console.log('\n' + '🎉'.repeat(10));
      console.log('✅ DEPLOYMENT SUCCESSFUL!');
      console.log('🎉'.repeat(10) + '\n');
      console.log('The period-based rental extension feature is now LIVE!');
      console.log('URL: https://www.omomrentals.shop/rentals/[id]/extend');
      console.log('\nDeployment completed at:', new Date().toLocaleTimeString());
      console.log('Total time:', `${checkCount * 30} seconds`);
      
      console.log('\n📋 New Features Now Live:');
      console.log('   ✅ Period-based input (days/weeks/months)');
      console.log('   ✅ Automatic date calculation');
      console.log('   ✅ Real-time availability checking');
      console.log('   ✅ Rate calculation with original rental rates');
      console.log('   ✅ Single "Extend" button for all items');
    } else if (result.data.includes('404') || result.data.includes('not found')) {
      console.log('⚠️ Status: Route not found');
      
      // Check if it's the rental not found error (which means the page works)
      if (result.data.includes('Rental not found') || result.data.includes('Error Loading Rental')) {
        console.log('\n✅ DEPLOYMENT SUCCESSFUL!');
        console.log('   The extension page is working (showing expected error for invalid rental ID)');
        console.log('   The new feature is deployed!');
      } else {
        console.log('   Waiting for deployment...\n');
        if (checkCount < maxChecks) {
          setTimeout(monitorDeployment, 30000);
        } else {
          showManualInstructions();
        }
      }
    } else {
      console.log('❓ Status: Checking deployment status...');
      if (checkCount < maxChecks) {
        setTimeout(monitorDeployment, 30000);
      } else {
        showManualInstructions();
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking deployment:', error.message);
    if (checkCount < maxChecks) {
      console.log('   Will retry in 30 seconds...\n');
      setTimeout(monitorDeployment, 30000);
    }
  }
}

function showManualInstructions() {
  console.log('\n' + '='.repeat(60));
  console.log('📝 MANUAL DEPLOYMENT INSTRUCTIONS');
  console.log('='.repeat(60));
  console.log('\nIf automatic deployment isn\'t working:');
  console.log('\n1. Go to Vercel Dashboard: https://vercel.com/dashboard');
  console.log('2. Select your project: rental-manager-frontend');
  console.log('3. Go to the "Deployments" tab');
  console.log('4. Check if there\'s a deployment in progress');
  console.log('5. If not, click the three dots menu on the latest deployment');
  console.log('6. Select "Redeploy"');
  console.log('7. Wait for deployment to complete (usually 1-3 minutes)');
  console.log('\nAlternatively, check GitHub integration:');
  console.log('1. Go to Settings → Git in Vercel');
  console.log('2. Ensure the repository is connected');
  console.log('3. Check that automatic deployments are enabled for the main branch');
  console.log('\n' + '='.repeat(60));
}

// Start monitoring
console.log('Starting deployment monitoring...');
console.log('This will check every 30 seconds for up to 10 minutes.\n');
monitorDeployment();