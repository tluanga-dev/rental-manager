/**
 * Development Authentication Logger
 * 
 * Enhanced logging utilities for development authentication bypass
 */

import type { User, PermissionType } from '@/types/auth';

export class DevAuthLogger {
  private static readonly PREFIX = '🚨 [DEV-AUTH]';
  private static readonly STYLES = {
    header: 'color: #ff6b35; font-weight: bold; font-size: 14px;',
    success: 'color: #10b981; font-weight: bold;',
    warning: 'color: #f59e0b; font-weight: bold;',
    error: 'color: #ef4444; font-weight: bold;',
    info: 'color: #3b82f6;',
    muted: 'color: #6b7280;',
    data: 'background: #f3f4f6; padding: 8px; border-radius: 4px; font-family: monospace;'
  };

  static logBypassEnabled() {
    if (!this.isDevelopmentMode()) return;
    
    console.group(`%c${this.PREFIX} Authentication Bypass Enabled`, this.STYLES.header);
    console.log('%c⚠️  All authentication checks are bypassed', this.STYLES.warning);
    console.log('%c🔓 All API requests will use mock authentication', this.STYLES.info);
    console.log('%c👤 Mock superuser will be created automatically', this.STYLES.info);
    console.log('%c🛡️  All permissions are granted in development mode', this.STYLES.success);
    console.log('%c📍 Environment:', this.STYLES.muted, {
      NODE_ENV: process.env.NODE_ENV,
      DISABLE_AUTH: process.env.NEXT_PUBLIC_DISABLE_AUTH,
      DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE
    });
    console.groupEnd();
  }

  static logUserCreated(user: User) {
    if (!this.isDevelopmentMode()) return;
    
    console.group(`%c${this.PREFIX} Mock User Created`, this.STYLES.success);
    console.log('%c👤 User Details:', this.STYLES.info);
    console.log('%c' + JSON.stringify({
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      userType: user.userType,
      is_superuser: user.is_superuser,
      is_active: user.is_active,
      role: user.role
    }, null, 2), this.STYLES.data);
    
    if (user.effectivePermissions?.all_permissions) {
      console.log(`%c🛡️  Permissions (${user.effectivePermissions.all_permissions.length}):`, this.STYLES.info);
      this.logPermissions(user.effectivePermissions.all_permissions);
    }
    
    console.groupEnd();
  }

  static logPermissionCheck(permission: PermissionType | PermissionType[], result: boolean, reason?: string) {
    if (!this.isDevelopmentMode()) return;
    
    const permissionStr = Array.isArray(permission) ? permission.join(', ') : permission;
    const resultIcon = result ? '✅' : '❌';
    const resultStyle = result ? this.STYLES.success : this.STYLES.error;
    
    console.log(
      `%c${this.PREFIX} Permission Check ${resultIcon}`,
      resultStyle,
      `Permission: ${permissionStr}`,
      reason ? `Reason: ${reason}` : ''
    );
  }

  static logAuthStateChange(from: string, to: string, data?: any) {
    if (!this.isDevelopmentMode()) return;
    
    console.group(`%c${this.PREFIX} Auth State Change`, this.STYLES.info);
    console.log(`%c📊 ${from} → ${to}`, this.STYLES.info);
    if (data) {
      console.log('%cData:', this.STYLES.muted, data);
    }
    console.log('%c⏰ Timestamp:', this.STYLES.muted, new Date().toISOString());
    console.groupEnd();
  }

  static logAPIRequest(method: string, url: string, hasAuth: boolean, authHeader?: string) {
    if (!this.isDevelopmentMode()) return;
    
    const authIcon = hasAuth ? '🔐' : '🔓';
    const authStyle = hasAuth ? this.STYLES.success : this.STYLES.warning;
    
    console.log(
      `%c${this.PREFIX} API Request ${authIcon}`,
      authStyle,
      `${method.toUpperCase()} ${url}`,
      hasAuth ? `Auth: ${authHeader?.substring(0, 20)}...` : 'No Auth'
    );
  }

  static logTokenRefresh(success: boolean, error?: any) {
    if (!this.isDevelopmentMode()) return;
    
    if (success) {
      console.log(`%c${this.PREFIX} Token Refresh ✅`, this.STYLES.success, 'Mock token refreshed');
    } else {
      console.warn(`%c${this.PREFIX} Token Refresh ❌`, this.STYLES.error, error);
    }
  }

  static logBypassWarning(message: string, data?: any) {
    if (!this.isDevelopmentMode()) return;
    
    console.warn(
      `%c${this.PREFIX} ⚠️  ${message}`,
      this.STYLES.warning,
      data ? data : ''
    );
  }

  static logError(message: string, error: any) {
    if (!this.isDevelopmentMode()) return;
    
    console.error(`%c${this.PREFIX} ❌ ${message}`, this.STYLES.error, error);
  }

  static logUserSwitch(fromUser: User | null, toUser: User) {
    if (!this.isDevelopmentMode()) return;
    
    console.group(`%c${this.PREFIX} User Switch`, this.STYLES.info);
    console.log('%cFrom:', this.STYLES.muted, fromUser ? fromUser.username : 'None');
    console.log('%cTo:', this.STYLES.muted, toUser.username);
    console.log('%cNew Role:', this.STYLES.info, toUser.userType || toUser.role?.name);
    console.log('%cNew Permissions:', this.STYLES.info, toUser.effectivePermissions?.all_permissions?.length || 0);
    console.groupEnd();
  }

  private static logPermissions(permissions: string[]) {
    if (!this.isDevelopmentMode()) return;
    
    // Group permissions by category
    const grouped = permissions.reduce((acc, perm) => {
      const category = perm.split('_')[0] || 'OTHER';
      if (!acc[category]) acc[category] = [];
      acc[category].push(perm);
      return acc;
    }, {} as Record<string, string[]>);

    Object.entries(grouped).forEach(([category, perms]) => {
      console.log(`%c  ${category}:`, this.STYLES.info, perms.join(', '));
    });
  }

  static startupSummary() {
    if (!this.isDevelopmentMode()) return;
    
    const isDevelopmentMode = process.env.NODE_ENV === 'development';
    const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
    
    console.group(`%c${this.PREFIX} Development Mode Summary`, this.STYLES.header);
    console.log('%c🚀 Application Starting in Development Mode', this.STYLES.success);
    console.table({
      'Node Environment': process.env.NODE_ENV,
      'Auth Disabled': isAuthDisabled ? '✅ YES' : '❌ NO',
      'Dev Mode': isDevMode ? '✅ YES' : '❌ NO',
      'Backend URL': process.env.NEXT_PUBLIC_API_URL,
      'Debug Mode': process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' ? '✅ YES' : '❌ NO'
    });
    
    if (isDevelopmentMode && isAuthDisabled) {
      console.log('%c🎯 Authentication bypass is ACTIVE', this.STYLES.success);
      console.log('%c🔓 All API requests will be authenticated as mock superuser', this.STYLES.info);
      console.log('%c🛡️  All permissions granted for development testing', this.STYLES.info);
    } else {
      console.log('%c🔐 Authentication bypass is INACTIVE', this.STYLES.warning);
      console.log('%c✅ Normal authentication flow will be used', this.STYLES.info);
    }
    
    console.groupEnd();
  }

  private static isDevelopmentMode(): boolean {
    return process.env.NODE_ENV === 'development' && 
           process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
  }
}

export default DevAuthLogger;