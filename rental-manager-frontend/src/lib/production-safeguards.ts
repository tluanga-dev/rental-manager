/**
 * Production Safeguards
 * 
 * Additional safety mechanisms to prevent authentication bypass from being
 * accidentally enabled in production environments
 */

interface SafeguardCheck {
  name: string;
  passed: boolean;
  critical: boolean;
  message: string;
}

export class ProductionSafeguards {
  private static readonly CRITICAL_CHECKS = [
    'environment',
    'auth_bypass',
    'domain_check'
  ];

  /**
   * Run all production safeguard checks
   */
  static runSafeguardChecks(): SafeguardCheck[] {
    const checks: SafeguardCheck[] = [];

    // Environment check
    checks.push(this.checkEnvironment());
    
    // Auth bypass check
    checks.push(this.checkAuthBypass());
    
    // Domain/URL check
    checks.push(this.checkDomain());
    
    // Debug mode check
    checks.push(this.checkDebugMode());
    
    // Dev tools check
    checks.push(this.checkDevTools());

    return checks;
  }

  /**
   * Check if we're in production environment
   */
  private static checkEnvironment(): SafeguardCheck {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      name: 'environment',
      passed: isProduction || process.env.NODE_ENV === 'development',
      critical: true,
      message: isProduction 
        ? 'Running in production environment - auth bypass disabled'
        : `Running in ${process.env.NODE_ENV} environment`
    };
  }

  /**
   * Check if auth bypass is disabled in production
   */
  private static checkAuthBypass(): SafeguardCheck {
    const isProduction = process.env.NODE_ENV === 'production';
    const authBypassEnabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    
    const passed = !isProduction || !authBypassEnabled;
    
    return {
      name: 'auth_bypass',
      passed,
      critical: true,
      message: passed
        ? 'Authentication bypass is properly disabled in production'
        : '🚨 CRITICAL: Authentication bypass is ENABLED in production!'
    };
  }

  /**
   * Check if running on production-like domain
   */
  private static checkDomain(): SafeguardCheck {
    if (typeof window === 'undefined') {
      return {
        name: 'domain_check',
        passed: true,
        critical: false,
        message: 'Domain check skipped (server-side)'
      };
    }

    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || 
                       hostname === '127.0.0.1' || 
                       hostname.startsWith('192.168.') ||
                       hostname.endsWith('.local');
    
    const isProduction = process.env.NODE_ENV === 'production';
    const authBypassEnabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    
    // Critical if auth bypass is enabled on non-localhost domain
    const passed = !authBypassEnabled || isLocalhost;
    
    return {
      name: 'domain_check',
      passed,
      critical: !isLocalhost && authBypassEnabled,
      message: passed
        ? `Domain check passed: ${hostname}`
        : `🚨 CRITICAL: Auth bypass enabled on production domain: ${hostname}`
    };
  }

  /**
   * Check debug mode settings
   */
  private static checkDebugMode(): SafeguardCheck {
    const isProduction = process.env.NODE_ENV === 'production';
    const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
    
    const shouldWarn = isProduction && debugEnabled;
    
    return {
      name: 'debug_mode',
      passed: !shouldWarn,
      critical: false,
      message: shouldWarn
        ? 'Warning: Debug mode is enabled in production'
        : debugEnabled 
          ? 'Debug mode enabled (development)'
          : 'Debug mode disabled'
    };
  }

  /**
   * Check if dev tools are exposed
   */
  private static checkDevTools(): SafeguardCheck {
    const isProduction = process.env.NODE_ENV === 'production';
    const devModeEnabled = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
    
    const shouldWarn = isProduction && devModeEnabled;
    
    return {
      name: 'dev_tools',
      passed: !shouldWarn,
      critical: false,
      message: shouldWarn
        ? 'Warning: Development tools exposed in production'
        : devModeEnabled
          ? 'Development tools enabled (development)'
          : 'Development tools disabled'
    };
  }

  /**
   * Check if any critical safeguards have failed
   */
  static hasCriticalFailures(checks?: SafeguardCheck[]): boolean {
    const checksToUse = checks || this.runSafeguardChecks();
    return checksToUse.some(check => check.critical && !check.passed);
  }

  /**
   * Log safeguard results to console
   */
  static logSafeguards(): void {
    const checks = this.runSafeguardChecks();
    const hasCritical = this.hasCriticalFailures(checks);
    
    if (hasCritical) {
      console.group('🚨 CRITICAL SECURITY ALERT');
      console.error(
        '%cAuthentication bypass may be enabled in production!',
        'color: #ef4444; font-weight: bold; font-size: 16px; background: #fee2e2; padding: 8px;'
      );
    } else {
      console.group('🛡️ Production Safeguards');
    }

    checks.forEach(check => {
      const emoji = check.passed ? '✅' : (check.critical ? '🚨' : '⚠️');
      const style = check.passed 
        ? 'color: #10b981;' 
        : check.critical 
          ? 'color: #ef4444; font-weight: bold;' 
          : 'color: #f59e0b;';

      console.log(`%c${emoji} ${check.message}`, style);
    });

    console.groupEnd();

    // Additional warning for critical failures
    if (hasCritical) {
      console.error(
        '%c⚠️ IMMEDIATE ACTION REQUIRED ⚠️',
        'color: #ef4444; font-weight: bold; font-size: 14px; background: #fee2e2; padding: 4px;'
      );
      console.error('Disable authentication bypass immediately:');
      console.error('1. Set NEXT_PUBLIC_DISABLE_AUTH=false or remove the variable');
      console.error('2. Set NODE_ENV=production');
      console.error('3. Restart the application');
    }
  }

  /**
   * Show emergency alert if critical failures detected
   */
  static showEmergencyAlert(): void {
    if (typeof window === 'undefined') return;
    
    const checks = this.runSafeguardChecks();
    if (this.hasCriticalFailures(checks)) {
      // Create emergency alert overlay
      const alertOverlay = document.createElement('div');
      alertOverlay.id = 'emergency-security-alert';
      alertOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(239, 68, 68, 0.95);
        color: white;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 18px;
        font-weight: bold;
        text-align: center;
        padding: 20px;
      `;

      alertOverlay.innerHTML = `
        <div>
          <h1 style="font-size: 36px; margin-bottom: 20px;">🚨 SECURITY ALERT 🚨</h1>
          <p style="font-size: 24px; margin-bottom: 20px;">AUTHENTICATION BYPASS IS ENABLED IN PRODUCTION!</p>
          <p style="font-size: 18px; margin-bottom: 30px;">This is a critical security vulnerability.</p>
          <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin-bottom: 10px;"><strong>IMMEDIATE ACTIONS REQUIRED:</strong></p>
            <p>1. Set NEXT_PUBLIC_DISABLE_AUTH=false</p>
            <p>2. Set NODE_ENV=production</p>
            <p>3. Restart the application</p>
          </div>
          <button id="close-alert" style="
            background: white;
            color: #ef4444;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
          ">I UNDERSTAND - CLOSE ALERT</button>
        </div>
      `;

      // Add click handler to close alert
      alertOverlay.addEventListener('click', (e) => {
        if (e.target && (e.target as HTMLElement).id === 'close-alert') {
          alertOverlay.remove();
        }
      });

      document.body.appendChild(alertOverlay);
      
      // Auto-remove after 30 seconds (fallback)
      setTimeout(() => {
        if (document.getElementById('emergency-security-alert')) {
          alertOverlay.remove();
        }
      }, 30000);
    }
  }

  /**
   * Initialize production safeguards
   */
  static initialize(): void {
    // Run checks and log results
    this.logSafeguards();
    
    // Show emergency alert if critical issues detected
    this.showEmergencyAlert();
    
    // Set up periodic checks (every 30 seconds)
    if (typeof window !== 'undefined') {
      setInterval(() => {
        const checks = this.runSafeguardChecks();
        if (this.hasCriticalFailures(checks)) {
          console.error('🚨 ONGOING SECURITY ALERT: Authentication bypass still enabled!');
        }
      }, 30000);
    }
  }

  /**
   * Utility to check if auth bypass should be allowed
   */
  static isAuthBypassSafe(): boolean {
    const checks = this.runSafeguardChecks();
    return !this.hasCriticalFailures(checks);
  }
}

export default ProductionSafeguards;