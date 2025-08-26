/**
 * CORS Fix for Purchase Recording
 * Provides utilities to handle CORS issues and browser cache problems
 */

import { apiClient } from './axios';

// Force a hard refresh of CORS preflight cache
export const clearCORSCache = async (): Promise<void> => {
  try {
    // Clear any cached CORS preflight requests by making a unique request
    const timestamp = Date.now();
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/purchases?_cors_cache_bust=${timestamp}`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    }).catch(() => {
      // Ignore errors - this is just to bust the cache
    });
  } catch (error) {
    console.log('CORS cache clear attempt completed');
  }
};

// Enhanced API client with CORS retry logic
export const apiClientWithCORSRetry = {
  async post(url: string, data: any, config?: any): Promise<any> {
    try {
      return await apiClient.post(url, data, config);
    } catch (error: any) {
      // If we get a network error, try clearing CORS cache and retry once
      if (error.code === 'ERR_NETWORK' || error.message?.includes('CORS')) {
        console.log('🔄 CORS/Network error detected, clearing cache and retrying...');
        
        await clearCORSCache();
        
        // Wait a moment for cache to clear
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          // Retry the original request
          return await apiClient.post(url, data, config);
        } catch (retryError) {
          console.log('🚨 Retry also failed:', retryError);
          throw retryError;
        }
      }
      throw error;
    }
  }
};

// Function to check if CORS is working
export const testCORSConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('CORS test failed:', error);
    return false;
  }
};

// Instructions for manual browser cache clearing
export const showCORSFixInstructions = (): void => {
  console.group('🛠️  CORS Fix Instructions');
  console.log('If you\'re experiencing CORS errors, try these steps:');
  console.log('');
  console.log('1. 🔄 Hard Refresh Browser:');
  console.log('   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)');
  console.log('   - Firefox: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)');
  console.log('');
  console.log('2. 🧹 Clear Browser Cache:');
  console.log('   - Chrome: F12 → Network tab → Right-click → "Clear browser cache"');
  console.log('   - Or use Developer Tools → Application → Storage → Clear storage');
  console.log('');
  console.log('3. 🔧 Developer Tools Network Tab:');
  console.log('   - Check "Disable cache" while DevTools is open');
  console.log('   - Look for preflight OPTIONS requests');
  console.log('');
  console.log('4. 🚪 Private/Incognito Window:');
  console.log('   - Test the same functionality in a new private window');
  console.log('');
  console.groupEnd();
};