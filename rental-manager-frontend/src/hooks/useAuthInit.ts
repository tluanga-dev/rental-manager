/**
 * Enhanced Authentication Initialization Hook
 * Handles token validation, auto-refresh, and auth state restoration
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { tokenManager } from '@/lib/token-manager';

export function useAuthInit() {
  const { 
    isAuthenticated, 
    isLoading, 
    setIsLoading, 
    setUser, 
    logout, 
    validateTokens,
    needsTokenRefresh,
    scheduleAutoRefresh 
  } = useAuthStore();
  
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    async function initializeAuth() {
      try {
        setIsLoading(true);
        
        // Check if we have stored tokens
        const tokens = tokenManager.getTokens();
        
        if (!tokens) {
          console.log('🔐 No stored tokens found');
          setIsLoading(false);
          return;
        }

        // Validate tokens
        const validation = tokenManager.validateTokens();
        
        if (!validation.isValid) {
          console.log('🔐 Stored tokens are invalid or expired');
          logout();
          setIsLoading(false);
          return;
        }

        // Try to get user info from token
        const userFromToken = tokenManager.getUserFromToken();
        
        if (userFromToken) {
          console.log('🔐 Restored user from token:', userFromToken.username);
          setUser(userFromToken);
        } else {
          // If we can't get user from token, try to fetch from API
          try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
            const response = await fetch(`${baseUrl}/auth/me`, {
              headers: {
                'Authorization': tokenManager.getAuthHeader()!,
              },
            });

            if (response.ok) {
              const userData = await response.json();
              console.log('🔐 Fetched user from API:', userData.username);
              setUser(userData);
            } else {
              console.warn('🔐 Failed to fetch user from API:', response.status);
              logout();
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error('🔐 Error fetching user:', error);
            logout();
            setIsLoading(false);
            return;
          }
        }

        // Check if token needs refresh
        if (validation.needsRefresh) {
          console.log('🔄 Token needs refresh, scheduling immediate refresh');
          const refreshToken = tokenManager.getRefreshToken();
          
          if (refreshToken) {
            try {
              const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
              const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: refreshToken }),
              });

              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                useAuthStore.getState().refreshAuth(refreshData.access_token, refreshData.expires_at);
                console.log('✅ Token refreshed during initialization');
              } else {
                console.warn('⚠️ Failed to refresh token during initialization');
              }
            } catch (refreshError) {
              console.error('❌ Error refreshing token during initialization:', refreshError);
            }
          }
        }

        // Schedule auto refresh for future
        scheduleAutoRefresh();
        
        console.log('✅ Auth initialization completed successfully');

      } catch (error) {
        console.error('❌ Auth initialization failed:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    }

    initializeAuth();
  }, []);

  return {
    isAuthenticated,
    isLoading,
    needsRefresh: needsTokenRefresh(),
    isValid: validateTokens(),
  };
}

/**
 * Hook for checking auth status with token validation
 */
export function useAuthStatus() {
  const { isAuthenticated, user } = useAuthStore();
  
  const tokenValidation = tokenManager.validateTokens();
  
  return {
    isAuthenticated: isAuthenticated && tokenValidation.isValid,
    isTokenExpired: tokenValidation.isExpired,
    needsRefresh: tokenValidation.needsRefresh,
    timeToExpiry: tokenValidation.timeToExpiry,
    user,
  };
}

/**
 * Hook for manual token refresh
 */
export function useTokenRefresh() {
  const { refreshAuth, logout } = useAuthStore();
  
  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshTokenValue = tokenManager.getRefreshToken();
      
      if (!refreshTokenValue) {
        console.warn('⚠️ No refresh token available');
        logout();
        return false;
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });

      if (response.ok) {
        const data = await response.json();
        refreshAuth(data.access_token, data.expires_at);
        console.log('✅ Manual token refresh successful');
        return true;
      } else {
        console.error('❌ Manual token refresh failed:', response.status);
        logout();
        return false;
      }
    } catch (error) {
      console.error('❌ Manual token refresh error:', error);
      logout();
      return false;
    }
  };

  return { refreshToken };
}