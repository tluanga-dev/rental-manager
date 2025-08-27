import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  User, 
  AuthState, 
  PermissionType, 
  UserType, 
  USER_TYPE_HIERARCHY,
  canManageUserType 
} from '@/types/auth';
import { tokenManager, type TokenData } from '@/lib/token-manager';
import { DevAuthLogger } from '@/lib/dev-auth-logger';
import { getUserPersonaById, getDefaultPersona } from '@/lib/dev-user-personas';
import { ProductionSafeguards } from '@/lib/production-safeguards';

interface AuthStore extends AuthState {
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string | null, refreshToken: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  login: (user: User, accessToken: string, refreshToken: string, expiresAt?: number) => void;
  logout: () => void;
  refreshAuth: (accessToken: string, expiresAt?: number) => void;
  // Enhanced token methods
  validateTokens: () => boolean;
  needsTokenRefresh: () => boolean;
  scheduleAutoRefresh: () => void;
  hasPermission: (permission: PermissionType | PermissionType[]) => boolean;
  hasRole: (roleName: string) => boolean;
  hasUserType: (userType: UserType) => boolean;
  canManageUser: (targetUserType: UserType) => boolean;
  isSuperuser: () => boolean;
  isAdmin: () => boolean;
  isCustomer: () => boolean;
  getEffectivePermissions: () => string[];
  updatePermissions: () => void;
  // Session management
  setSessionInfo: (sessionId: string, deviceId: string) => void;
  clearSession: () => void;
  // Backend connectivity
  isBackendOnline: boolean;
  lastBackendCheck: Date | null;
  setBackendStatus: (isOnline: boolean) => void;
  checkBackendHealth: () => Promise<boolean>;
  // Development mode authentication bypass
  isDevelopmentMode: boolean;
  isAuthDisabled: boolean;
  initializeDevelopmentMode: () => void;
  bypassAuthentication: () => void;
  switchToPersona: (personaId: string) => void;
  getStoredPersonaId: () => string | null;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true, // Start as true, will be set to false after hydration
      permissions: [],
      sessionId: undefined,
      deviceId: undefined,
      // Backend connectivity state - start as unknown, will be checked on first mount
      isBackendOnline: true, // Default to true to avoid showing error on initial load
      lastBackendCheck: null,
      // Development mode state
      isDevelopmentMode: process.env.NODE_ENV === 'development',
      isAuthDisabled: process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true',

      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
        if (user) {
          get().updatePermissions();
        }
      },

      setTokens: (accessToken, refreshToken) => 
        set({ accessToken, refreshToken }),

      setIsLoading: (isLoading) => set({ isLoading }),

      login: (user, accessToken, refreshToken, expiresAt) => {
        // Get effective permissions from user object (handle both camelCase and snake_case)
        const effectivePermissions = user.effectivePermissions || (user as any).effective_permissions;
        const permissions = effectivePermissions?.all_permissions || effectivePermissions?.allPermissions || [];
        
        // Store tokens using enhanced token manager
        tokenManager.storeTokens({
          accessToken,
          refreshToken,
          expiresAt,
          tokenType: 'Bearer'
        });
        
        set({ 
          user, 
          accessToken, 
          refreshToken, 
          isAuthenticated: true, 
          isLoading: false,
          permissions 
        });
        
        // Schedule auto refresh
        get().scheduleAutoRefresh();
      },

      logout: () => {
        // Clear tokens using enhanced token manager
        tokenManager.clearTokens();
        
        set({ 
          user: null, 
          accessToken: null, 
          refreshToken: null, 
          isAuthenticated: false, 
          isLoading: false,
          permissions: [],
          sessionId: undefined,
          deviceId: undefined,
        });
      },

      refreshAuth: (accessToken, expiresAt) => {
        // Update token using enhanced token manager
        tokenManager.updateAccessToken(accessToken, expiresAt);
        
        set({ accessToken });
        
        // Reschedule auto refresh with new token
        get().scheduleAutoRefresh();
      },

      hasPermission: (permission) => {
        const { user, permissions, isDevelopmentMode, isAuthDisabled } = get();
        
        let result = false;
        let reason = '';
        
        // Superuser has all permissions
        if (user?.isSuperuser || user?.userType === 'SUPERADMIN') {
          result = true;
          reason = 'superuser access';
        } else if (Array.isArray(permission)) {
          // Require ALL permissions when an array is passed
          result = permission.every(p => permissions.includes(p));
          reason = result ? 'all required permissions present' : 'missing some required permissions';
        } else {
          result = permissions.includes(permission);
          reason = result ? 'permission present' : 'permission not found';
        }
        
        // Log permission check in development mode
        if (isDevelopmentMode && isAuthDisabled) {
          DevAuthLogger.logPermissionCheck(permission, result, reason);
        }
        
        return result;
      },

      hasRole: (roleName) => {
        const { user } = get();
        return user?.role?.name === roleName;
      },

      hasUserType: (userType) => {
        const { user } = get();
        return user?.userType === userType;
      },

      canManageUser: (targetUserType) => {
        const { user } = get();
        if (!user) return false;
        return canManageUserType(user.userType, targetUserType);
      },

      isSuperuser: () => {
        const { user } = get();
        return user?.isSuperuser === true || user?.userType === 'SUPERADMIN';
      },

      isAdmin: () => {
        const { user } = get();
        return user?.userType === 'SUPERADMIN' || user?.userType === 'ADMIN';
      },

      isCustomer: () => {
        const { user } = get();
        return user?.userType === 'CUSTOMER';
      },

      getEffectivePermissions: () => {
        const { user, permissions } = get();
        if (!user) return [];
        
        // Superuser gets all permissions conceptually
        if (user.isSuperuser || user.userType === 'SUPERADMIN') {
          return permissions; // In practice, we still use the stored permissions
        }
        
        return permissions;
      },

      updatePermissions: () => {
        const { user } = get();
        if (user) {
          // Use effective permissions from user object (handle both camelCase and snake_case)
          const effectivePermissions = user.effectivePermissions || (user as any).effective_permissions;
          const permissions = effectivePermissions?.all_permissions || effectivePermissions?.allPermissions || [];
          set({ permissions });
        }
      },

      setSessionInfo: (sessionId, deviceId) => {
        set({ sessionId, deviceId });
      },

      clearSession: () => {
        set({ sessionId: undefined, deviceId: undefined });
      },

      setBackendStatus: (isOnline: boolean) => {
        set({ 
          isBackendOnline: isOnline,
          lastBackendCheck: new Date()
        });
      },

      checkBackendHealth: async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          // Try multiple endpoints to determine if backend is online
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
          // Health endpoint is at root level, not under /api
          // Extract base URL and append /health
          const baseUrl = apiBaseUrl.replace(/\/api.*$/, '');
          const healthUrl = `${baseUrl}/health`;
          
          // First try the health endpoint
          let response;
          try {
            response = await fetch(healthUrl, {
              method: 'GET',
              signal: controller.signal,
            });
          } catch (healthError) {
            // If health endpoint fails, try a basic API endpoint that should always exist
            try {
              response = await fetch(`${apiBaseUrl}/auth/me`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                  'Authorization': `Bearer ${get().accessToken || 'dummy'}`
                }
              });
              // For auth/me, we consider 401 as "online" (server responding)
              // Only network errors or 5xx errors indicate server is offline
            } catch (authError) {
              throw authError; // Re-throw if both endpoints fail
            }
          }
          
          clearTimeout(timeoutId);
          
          // Consider the backend online if:
          // 1. Response is ok (2xx)
          // 2. Response is 401 (server is responding, just unauthorized)
          // 3. Response is 4xx (server is responding, client error)
          const isOnline = response.ok || 
                          response.status === 401 || 
                          (response.status >= 400 && response.status < 500);
          
          get().setBackendStatus(isOnline);
          return isOnline;
        } catch (error) {
          console.error('Backend health check failed:', error);
          get().setBackendStatus(false);
          return false;
        }
      },

      // Enhanced token management methods
      validateTokens: () => {
        const validation = tokenManager.validateTokens();
        return validation.isValid;
      },

      needsTokenRefresh: () => {
        const validation = tokenManager.validateTokens();
        return validation.needsRefresh;
      },

      scheduleAutoRefresh: () => {
        // Auto refresh token when needed
        tokenManager.scheduleTokenRefresh(async () => {
          const refreshToken = tokenManager.getRefreshToken();
          if (!refreshToken) {
            console.warn('⚠️ No refresh token available for auto refresh');
            get().logout();
            return;
          }

          try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
            const response = await fetch(`${baseUrl}/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (response.ok) {
              const data = await response.json();
              get().refreshAuth(data.access_token, data.expires_at);
              console.log('✅ Token auto-refreshed successfully');
            } else {
              console.error('❌ Auto refresh failed:', response.status);
              get().logout();
            }
          } catch (error) {
            console.error('❌ Auto refresh error:', error);
            get().logout();
          }
        });
      },

      initializeDevelopmentMode: () => {
        const { isDevelopmentMode, isAuthDisabled } = get();
        if (isDevelopmentMode && isAuthDisabled) {
          // Critical security check: Ensure auth bypass is safe before proceeding
          if (!ProductionSafeguards.isAuthBypassSafe()) {
            console.error('🚨 SECURITY ALERT: Development mode initialization blocked by production safeguards!');
            ProductionSafeguards.showEmergencyAlert();
            return;
          }

          DevAuthLogger.logBypassEnabled();
          
          // Check for stored persona preference
          const storedPersonaId = get().getStoredPersonaId();
          if (storedPersonaId) {
            get().switchToPersona(storedPersonaId);
          } else {
            get().bypassAuthentication();
          }
        }
      },

      bypassAuthentication: () => {
        // Critical security check: Ensure auth bypass is safe
        if (!ProductionSafeguards.isAuthBypassSafe()) {
          console.error('🚨 SECURITY ALERT: Authentication bypass blocked by production safeguards!');
          ProductionSafeguards.showEmergencyAlert();
          return;
        }

        const mockUser: User = {
          id: 'dev-user-1',
          email: 'dev@example.com',
          username: 'dev_user',
          full_name: 'Development User',
          is_active: true,
          is_superuser: true,
          is_verified: true,
          role: { name: 'ADMIN' },
          userType: 'SUPERADMIN',
          isSuperuser: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          effectivePermissions: {
            all_permissions: [
              'read:all', 'write:all', 'delete:all', 'admin:all',
              'manage:users', 'manage:companies', 'manage:customers',
              'manage:suppliers', 'manage:inventory', 'manage:transactions',
              'manage:rentals', 'manage:analytics', 'view:dashboard',
              'export:data', 'SALE_VIEW', 'RENTAL_VIEW', 'DASHBOARD_VIEW',
              'ANALYTICS_VIEW', 'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
              'CUSTOMER_UPDATE', 'CUSTOMER_DELETE', 'INVENTORY_VIEW',
              'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE',
              'SALE_CREATE', 'SALE_UPDATE', 'SALE_DELETE',
              'RENTAL_CREATE', 'RENTAL_UPDATE', 'RENTAL_DELETE',
              'REPORT_VIEW', 'REPORT_CREATE', 'USER_VIEW', 'USER_CREATE',
              'USER_UPDATE', 'USER_DELETE', 'ROLE_VIEW', 'ROLE_CREATE',
              'ROLE_UPDATE', 'ROLE_DELETE', 'AUDIT_VIEW', 'SYSTEM_CONFIG'
            ],
            allPermissions: [
              'read:all', 'write:all', 'delete:all', 'admin:all',
              'manage:users', 'manage:companies', 'manage:customers',
              'manage:suppliers', 'manage:inventory', 'manage:transactions',
              'manage:rentals', 'manage:analytics', 'view:dashboard',
              'export:data', 'SALE_VIEW', 'RENTAL_VIEW', 'DASHBOARD_VIEW',
              'ANALYTICS_VIEW', 'CUSTOMER_VIEW', 'CUSTOMER_CREATE',
              'CUSTOMER_UPDATE', 'CUSTOMER_DELETE', 'INVENTORY_VIEW',
              'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE',
              'SALE_CREATE', 'SALE_UPDATE', 'SALE_DELETE',
              'RENTAL_CREATE', 'RENTAL_UPDATE', 'RENTAL_DELETE',
              'REPORT_VIEW', 'REPORT_CREATE', 'USER_VIEW', 'USER_CREATE',
              'USER_UPDATE', 'USER_DELETE', 'ROLE_VIEW', 'ROLE_CREATE',
              'ROLE_UPDATE', 'ROLE_DELETE', 'AUDIT_VIEW', 'SYSTEM_CONFIG'
            ]
          }
        } as User;

        // Store mock tokens using token manager
        tokenManager.storeTokens({
          accessToken: 'dev-access-token',
          refreshToken: 'dev-refresh-token',
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
          tokenType: 'Bearer'
        });

        set({
          user: mockUser,
          accessToken: 'dev-access-token',
          refreshToken: 'dev-refresh-token',
          isAuthenticated: true,
          isLoading: false,
          permissions: mockUser.effectivePermissions.all_permissions
        });

        DevAuthLogger.logUserCreated(mockUser);
        DevAuthLogger.logAuthStateChange('unauthenticated', 'authenticated (development bypass)', {
          user: mockUser.username,
          role: mockUser.userType,
          permissionsCount: mockUser.effectivePermissions.all_permissions.length
        });
      },

      switchToPersona: (personaId: string) => {
        const { isDevelopmentMode, isAuthDisabled } = get();
        if (!isDevelopmentMode || !isAuthDisabled) return;
        
        const persona = getUserPersonaById(personaId);
        if (!persona) {
          console.warn('Persona not found:', personaId);
          return;
        }
        
        const currentUser = get().user;
        
        // Update store with new persona
        set({
          user: persona.user,
          accessToken: 'dev-access-token',
          refreshToken: 'dev-refresh-token',
          isAuthenticated: true,
          isLoading: false,
          permissions: persona.user.effectivePermissions.all_permissions
        });
        
        // Update token manager
        tokenManager.storeTokens({
          accessToken: 'dev-access-token',
          refreshToken: 'dev-refresh-token',
          expiresAt: Date.now() + (24 * 60 * 60 * 1000),
          tokenType: 'Bearer'
        });
        
        // Log the switch
        DevAuthLogger.logUserSwitch(currentUser, persona.user);
        
        // Store preference
        if (typeof window !== 'undefined') {
          localStorage.setItem('dev-selected-persona', personaId);
        }
      },

      getStoredPersonaId: () => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('dev-selected-persona');
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        permissions: state.permissions,
        sessionId: state.sessionId,
        deviceId: state.deviceId,
      }),
      onRehydrateStorage: () => (state) => {
        // Set loading to false after hydration completes
        try {
          if (state && typeof state.setIsLoading === 'function') {
            state.setIsLoading(false);
          }
        } catch (error) {
          console.warn('Auth store hydration warning:', error);
          // Fallback: just set loading to false directly
          if (state) {
            state.isLoading = false;
          }
        }
      },
    }
  )
);