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
        const { user, permissions } = get();
        
        // Superuser has all permissions
        if (user?.isSuperuser || user?.userType === 'SUPERADMIN') {
          return true;
        }
        
        if (Array.isArray(permission)) {
          // Require ALL permissions when an array is passed
          return permission.every(p => permissions.includes(p));
        }
        return permissions.includes(permission);
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