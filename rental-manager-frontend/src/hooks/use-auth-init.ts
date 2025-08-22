'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';

export function useAuthInit() {
  const { setIsLoading, isLoading } = useAuthStore();

  useEffect(() => {
    // Fallback: If hydration hasn't completed after 1 second, force loading to false
    // This handles edge cases where onRehydrateStorage might not fire
    const fallbackTimer = setTimeout(() => {
      if (isLoading) {
        console.warn('Auth store hydration timeout, forcing loading to false');
        setIsLoading(false);
      }
    }, 1000);

    return () => clearTimeout(fallbackTimer);
  }, [setIsLoading, isLoading]);
}
