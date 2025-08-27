'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { DevAuthLogger } from '@/lib/dev-auth-logger';
import { DevSetupValidator } from '@/lib/dev-setup-validator';
import { ProductionSafeguards } from '@/lib/production-safeguards';

export function useAuthInit() {
  const { 
    setIsLoading, 
    isLoading, 
    initializeDevelopmentMode,
    isDevelopmentMode,
    isAuthDisabled
  } = useAuthStore();

  useEffect(() => {
    // Initialize production safeguards immediately (critical for security)
    ProductionSafeguards.initialize();
    
    // Validate development setup first
    if (process.env.NODE_ENV === 'development') {
      DevSetupValidator.logReport();
    }
    
    // Log development mode summary on startup
    DevAuthLogger.startupSummary();
    
    // Initialize development mode if needed
    if (isDevelopmentMode && isAuthDisabled) {
      initializeDevelopmentMode();
    } else if (isDevelopmentMode && !isAuthDisabled) {
      console.warn(
        '⚠️ Development mode detected but authentication bypass is not enabled. ' +
        'Set NEXT_PUBLIC_DISABLE_AUTH=true in .env.development to enable bypass.'
      );
    }

    // Fallback: If hydration hasn't completed after 1 second, force loading to false
    // This handles edge cases where onRehydrateStorage might not fire
    const fallbackTimer = setTimeout(() => {
      if (isLoading) {
        console.warn('Auth store hydration timeout, forcing loading to false');
        setIsLoading(false);
      }
    }, 1000);

    return () => clearTimeout(fallbackTimer);
  }, [setIsLoading, isLoading, initializeDevelopmentMode, isDevelopmentMode, isAuthDisabled]);
}
