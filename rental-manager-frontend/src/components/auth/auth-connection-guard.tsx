'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';
import { RefreshCw } from 'lucide-react';

interface AuthConnectionGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  showOfflineAlert?: boolean;
}

export function AuthConnectionGuard({ 
  children, 
  requireAuth = true, 
  showOfflineAlert = true 
}: AuthConnectionGuardProps) {
  const router = useRouter();
  const { 
    isAuthenticated, 
    isLoading: authLoading, 
    isBackendOnline, 
    checkBackendHealth,
    logout 
  } = useAuthStore();
  const { addNotification } = useAppStore();
  
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);
  const [hasInitialCheck, setHasInitialCheck] = useState(false);

  // Check backend health on mount and periodically
  useEffect(() => {
    const checkBackend = async () => {
      setIsCheckingBackend(true);
      const isOnline = await checkBackendHealth();
      
      // Only show notifications after the initial check is complete
      if (hasInitialCheck) {
        if (!isOnline && showOfflineAlert) {
          addNotification({
            type: 'error',
            title: 'Backend Offline',
            message: 'Unable to connect to the server. Some features may not work properly.',
          });
        } else if (isOnline && !isBackendOnline) {
          // Only show reconnection notification if we were previously offline
          addNotification({
            type: 'success',
            title: 'Backend Online',
            message: 'Connection to server restored.',
          });
        }
      }
      
      if (!hasInitialCheck) {
        setHasInitialCheck(true);
      }
      
      setIsCheckingBackend(false);
    };

    // Initial check
    checkBackend();

    // Check every 30 seconds
    const interval = setInterval(checkBackend, 30000);

    return () => clearInterval(interval);
  }, [checkBackendHealth, addNotification, showOfflineAlert, isBackendOnline]);

  // Redirect to login if authentication is required but user is not authenticated
  useEffect(() => {
    if (requireAuth && !authLoading && !isAuthenticated) {
      addNotification({
        type: 'warning',
        title: 'Authentication Required',
        message: 'Please log in to access this page.',
      });
      router.replace('/login');
    }
  }, [requireAuth, authLoading, isAuthenticated, router, addNotification]);

  // Handle backend offline scenarios
  useEffect(() => {
    if (!isBackendOnline && isAuthenticated) {
      // If backend is offline for too long, consider logging out
      const logoutTimer = setTimeout(() => {
        addNotification({
          type: 'error',
          title: 'Connection Lost',
          message: 'Lost connection to server. Please log in again when connection is restored.',
        });
        logout();
        router.replace('/login');
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearTimeout(logoutTimer);
    }
  }, [isBackendOnline, isAuthenticated, logout, router, addNotification]);

  // Show loading state while checking auth
  if (requireAuth && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  // Don't render children if auth is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
