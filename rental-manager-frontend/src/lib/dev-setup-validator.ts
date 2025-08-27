/**
 * Development Setup Validator
 * 
 * Validates that the development authentication bypass is properly configured
 * and provides helpful diagnostics when issues are detected
 */

interface ValidationResult {
  isValid: boolean;
  level: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
  fix?: string;
}

interface SetupValidation {
  overall: 'success' | 'warning' | 'error';
  results: ValidationResult[];
}

export class DevSetupValidator {
  private static readonly REQUIRED_ENV_VARS = [
    'NEXT_PUBLIC_DISABLE_AUTH',
    'NEXT_PUBLIC_DEV_MODE'
  ];

  static validateSetup(): SetupValidation {
    const results: ValidationResult[] = [];

    // Check environment
    results.push(...this.validateEnvironment());
    
    // Check configuration
    results.push(...this.validateConfiguration());
    
    // Check backend connectivity
    results.push(...this.validateBackendConfig());
    
    // Check auth store state
    results.push(...this.validateAuthStore());

    // Determine overall status
    const hasErrors = results.some(r => r.level === 'error');
    const hasWarnings = results.some(r => r.level === 'warning');
    
    const overall = hasErrors ? 'error' : hasWarnings ? 'warning' : 'success';

    return { overall, results };
  }

  private static validateEnvironment(): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Check NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv !== 'development') {
      results.push({
        isValid: false,
        level: 'error',
        message: 'Invalid NODE_ENV',
        details: `NODE_ENV is "${nodeEnv}" but should be "development"`,
        fix: 'Run "npm run dev" to start in development mode'
      });
    } else {
      results.push({
        isValid: true,
        level: 'success',
        message: 'NODE_ENV is correctly set to development'
      });
    }

    // Check required environment variables
    this.REQUIRED_ENV_VARS.forEach(envVar => {
      const value = process.env[envVar];
      if (!value) {
        results.push({
          isValid: false,
          level: 'error',
          message: `Missing environment variable: ${envVar}`,
          details: `${envVar} is not set in environment`,
          fix: `Add ${envVar}=true to your .env.development file`
        });
      } else {
        results.push({
          isValid: true,
          level: 'success',
          message: `${envVar} is set to "${value}"`
        });
      }
    });

    // Check API URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      results.push({
        isValid: false,
        level: 'warning',
        message: 'Missing API URL configuration',
        details: 'NEXT_PUBLIC_API_URL is not set',
        fix: 'Add NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 to your .env.development file'
      });
    } else if (!apiUrl.includes('localhost') && !apiUrl.includes('127.0.0.1')) {
      results.push({
        isValid: false,
        level: 'warning',
        message: 'API URL may not be for local development',
        details: `API URL is ${apiUrl}`,
        fix: 'Ensure you are using a local development backend URL'
      });
    } else {
      results.push({
        isValid: true,
        level: 'success',
        message: `API URL configured: ${apiUrl}`
      });
    }

    return results;
  }

  private static validateConfiguration(): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Check auth disable flag
    const authDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    if (!authDisabled) {
      results.push({
        isValid: false,
        level: 'error',
        message: 'Authentication bypass is not enabled',
        details: 'NEXT_PUBLIC_DISABLE_AUTH is not set to "true"',
        fix: 'Set NEXT_PUBLIC_DISABLE_AUTH=true in your .env.development file'
      });
    } else {
      results.push({
        isValid: true,
        level: 'success',
        message: 'Authentication bypass is enabled'
      });
    }

    // Check dev mode flag
    const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
    if (!devMode) {
      results.push({
        isValid: false,
        level: 'warning',
        message: 'Development mode flag is not set',
        details: 'NEXT_PUBLIC_DEV_MODE is not set to "true"',
        fix: 'Set NEXT_PUBLIC_DEV_MODE=true in your .env.development file'
      });
    } else {
      results.push({
        isValid: true,
        level: 'success',
        message: 'Development mode is enabled'
      });
    }

    // Check RBAC bypass
    const rbacBypass = process.env.NEXT_PUBLIC_BYPASS_RBAC === 'true';
    if (!rbacBypass) {
      results.push({
        isValid: false,
        level: 'warning',
        message: 'RBAC bypass is not enabled',
        details: 'NEXT_PUBLIC_BYPASS_RBAC is not set to "true"',
        fix: 'Set NEXT_PUBLIC_BYPASS_RBAC=true in your .env.development file for complete bypass'
      });
    } else {
      results.push({
        isValid: true,
        level: 'success',
        message: 'RBAC bypass is enabled'
      });
    }

    return results;
  }

  private static validateBackendConfig(): ValidationResult[] {
    const results: ValidationResult[] = [];

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      // Check if URL is accessible (basic format check)
      try {
        new URL(apiUrl);
        results.push({
          isValid: true,
          level: 'success',
          message: 'API URL format is valid'
        });
      } catch {
        results.push({
          isValid: false,
          level: 'error',
          message: 'Invalid API URL format',
          details: `"${apiUrl}" is not a valid URL`,
          fix: 'Check your NEXT_PUBLIC_API_URL format (e.g., http://localhost:8000/api/v1)'
        });
      }

      // Check for HTTPS in development (warning)
      if (apiUrl.startsWith('https://localhost') || apiUrl.startsWith('https://127.0.0.1')) {
        results.push({
          isValid: true,
          level: 'warning',
          message: 'Using HTTPS for local development',
          details: 'HTTPS is uncommon for local development',
          fix: 'Consider using HTTP for local development unless specifically needed'
        });
      }
    }

    return results;
  }

  private static validateAuthStore(): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Check if running in browser environment
    if (typeof window === 'undefined') {
      results.push({
        isValid: true,
        level: 'warning',
        message: 'Server-side rendering detected',
        details: 'Auth store validation skipped during SSR'
      });
      return results;
    }

    try {
      // Check localStorage availability
      const testKey = 'dev-setup-test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      
      results.push({
        isValid: true,
        level: 'success',
        message: 'Local storage is available for session persistence'
      });
    } catch {
      results.push({
        isValid: false,
        level: 'warning',
        message: 'Local storage is not available',
        details: 'User preferences and session data may not persist',
        fix: 'Check browser settings or use incognito/private mode'
      });
    }

    return results;
  }

  static generateReport(): string {
    const validation = this.validateSetup();
    
    let report = '🔧 Development Setup Validation Report\n';
    report += '=' .repeat(50) + '\n\n';
    
    // Overall status
    const statusEmoji = validation.overall === 'success' ? '✅' : 
                       validation.overall === 'warning' ? '⚠️' : '❌';
    
    report += `Overall Status: ${statusEmoji} ${validation.overall.toUpperCase()}\n\n`;

    // Group results by level
    const successes = validation.results.filter(r => r.level === 'success');
    const warnings = validation.results.filter(r => r.level === 'warning');
    const errors = validation.results.filter(r => r.level === 'error');

    if (errors.length > 0) {
      report += '❌ ERRORS (Must Fix):\n';
      errors.forEach(error => {
        report += `  • ${error.message}\n`;
        if (error.details) report += `    Details: ${error.details}\n`;
        if (error.fix) report += `    Fix: ${error.fix}\n`;
        report += '\n';
      });
    }

    if (warnings.length > 0) {
      report += '⚠️  WARNINGS (Recommended):\n';
      warnings.forEach(warning => {
        report += `  • ${warning.message}\n`;
        if (warning.details) report += `    Details: ${warning.details}\n`;
        if (warning.fix) report += `    Fix: ${warning.fix}\n`;
        report += '\n';
      });
    }

    if (successes.length > 0) {
      report += '✅ SUCCESS:\n';
      successes.forEach(success => {
        report += `  • ${success.message}\n`;
      });
      report += '\n';
    }

    // Add helpful tips
    report += '💡 QUICK FIXES:\n';
    report += '  1. Ensure .env.development file exists with required variables\n';
    report += '  2. Restart development server after changing environment variables\n';
    report += '  3. Check that backend is running on the configured API URL\n';
    report += '  4. Clear browser cache if experiencing issues\n\n';

    report += '📖 For detailed setup instructions, see: FRONTEND_AUTH_BYPASS_GUIDE.md\n';

    return report;
  }

  static logReport(): void {
    const validation = this.validateSetup();
    
    console.group('🔧 Development Setup Validation');
    
    validation.results.forEach(result => {
      const emoji = result.level === 'success' ? '✅' : 
                   result.level === 'warning' ? '⚠️' : '❌';
      const style = result.level === 'success' ? 'color: #10b981;' : 
                   result.level === 'warning' ? 'color: #f59e0b;' : 'color: #ef4444;';
      
      console.log(`%c${emoji} ${result.message}`, `${style} font-weight: bold;`);
      
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
      if (result.fix) {
        console.log(`   Fix: ${result.fix}`);
      }
    });
    
    console.groupEnd();
    
    // Log overall status
    const statusEmoji = validation.overall === 'success' ? '✅' : 
                       validation.overall === 'warning' ? '⚠️' : '❌';
    const statusStyle = validation.overall === 'success' ? 'color: #10b981;' : 
                       validation.overall === 'warning' ? 'color: #f59e0b;' : 'color: #ef4444;';
    
    console.log(
      `%c${statusEmoji} Setup validation: ${validation.overall.toUpperCase()}`,
      `${statusStyle} font-weight: bold; font-size: 14px;`
    );
  }

  static isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  static isAuthBypassEnabled(): boolean {
    return this.isDevelopmentMode() && 
           process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
  }

  static shouldShowDevTools(): boolean {
    return this.isAuthBypassEnabled() && 
           process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  }
}

export default DevSetupValidator;