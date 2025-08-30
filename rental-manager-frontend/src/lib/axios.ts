import axios, { AxiosResponse, AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth-store';
import { generateUUID } from '@/lib/uuid';
import { tokenManager } from '@/lib/token-manager';
import { getApiUrl, isDebugMode, isProduction } from '@/lib/env';
import { DevAuthLogger } from '@/lib/dev-auth-logger';

// API Response wrapper
interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

// Get and validate API URL
const apiUrl = getApiUrl();

// Log API configuration in debug mode
if (isDebugMode()) {
  console.log('🔌 Axios API Client Configuration:', {
    baseURL: apiUrl,
    environment: process.env.NODE_ENV,
    isProduction: isProduction()
  });
}

const api = axios.create({
  baseURL: apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: isProduction() ? 15000 : 10000, // Longer timeout in production for Railway cold starts
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const isDevelopmentMode = process.env.NODE_ENV === 'development';
    const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';
    
    // Development mode bypass - add mock authorization header
    if (isDevelopmentMode && isAuthDisabled) {
      config.headers.Authorization = 'Bearer dev-access-token';
      DevAuthLogger.logAPIRequest(
        config.method?.toUpperCase() || 'UNKNOWN',
        config.url || '',
        true,
        'Bearer dev-access-token'
      );
    } else {
      // Add auth token using enhanced token manager in production
      const authHeader = tokenManager.getAuthHeader();
      if (authHeader) {
        config.headers.Authorization = authHeader;
      }
      if (isDevelopmentMode) {
        DevAuthLogger.logAPIRequest(
          config.method?.toUpperCase() || 'UNKNOWN',
          config.url || '',
          !!authHeader,
          authHeader
        );
      }
    }
    
    // Add correlation ID for request tracking
    config.headers['X-Request-ID'] = generateUUID();
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Update backend status on successful response
    useAuthStore.getState().setBackendStatus(true);
    
    // Transform response to match our API wrapper format
    if (response.data && typeof response.data === 'object') {
      if (!response.data.hasOwnProperty('success')) {
        return {
          ...response,
          data: {
            success: true,
            data: response.data,
          } as ApiResponse
        };
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Detect CORS errors specifically
    const isCorsError = (
      !error.response && 
      error.message && 
      (error.message.includes('CORS') || 
       error.message.includes('Access-Control-Allow-Origin') ||
       error.message.includes('blocked by CORS policy'))
    );

    // Handle CORS errors
    if (isCorsError) {
      console.error('🚨 CORS Error detected:', error.message);
      console.warn('💡 This is likely a backend CORS configuration issue');
      console.warn('💡 The API may be working but CORS headers are missing');
      
      const errorData: ApiResponse = {
        success: false,
        data: null,
        message: 'CORS policy error - unable to connect to server. The request may have been blocked by browser security.',
        errors: { cors: ['CORS policy blocked the request'] }
      };

      return Promise.reject({
        ...error,
        response: {
          status: 0,
          statusText: 'CORS Error',
          headers: {},
          config: originalRequest,
          data: errorData
        }
      });
    }

    // Handle network errors (backend offline or unreachable)
    if (!error.response) {
      useAuthStore.getState().setBackendStatus(false);
      
      const errorData: ApiResponse = {
        success: false,
        data: null,
        message: 'Unable to connect to the server. Please check your connection.',
        errors: undefined
      };

      return Promise.reject({
        ...error,
        response: {
          ...error.response,
          data: errorData
        }
      });
    }

    // Development mode bypass for 401 errors
    if (process.env.NODE_ENV === 'development' && 
        process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' &&
        error.response?.status === 401) {
      DevAuthLogger.logBypassWarning('Bypassing 401 authentication error', {
        url: originalRequest?.url,
        method: originalRequest?.method
      });
      // In dev mode, treat 401s as successful responses
      return Promise.resolve({
        ...error.response,
        status: 200,
        data: { 
          success: true, 
          data: 'dev-auth-bypass',
          message: 'Authentication bypassed in development mode'
        }
      });
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = tokenManager.getRefreshToken();
      
      if (refreshToken) {
        try {
          const response = await axios.post(`${apiUrl}/auth/refresh`, {
            refresh_token: refreshToken
          });
          
          const { access_token, expires_at } = response.data;
          useAuthStore.getState().refreshAuth(access_token, expires_at);
          
          processQueue(null, access_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    // Enhanced error logging for debugging
    const logErrorDetails = (error: AxiosError, request?: any) => {
      const timestamp = new Date().toISOString();
      const requestId = request?.headers?.['X-Request-ID'] || error.config?.headers?.['X-Request-ID'] || 'unknown';
      
      console.group(`🚨 API Error [${timestamp}]`);
      console.error('Request ID:', requestId);
      console.error('Endpoint:', `${error.config?.method?.toUpperCase()} ${error.config?.url}`);
      console.error('Status Code:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      
      // Log request details
      if (error.config) {
        console.group('📤 Request Details');
        console.log('Headers:', error.config.headers);
        if (error.config.data) {
          console.log('Body:', error.config.data);
        }
        console.groupEnd();
      }
      
      // Log response details
      if (error.response) {
        console.group('📥 Response Details');
        console.error('Response Data:', error.response.data);
        console.error('Response Headers:', error.response.headers);
        console.groupEnd();
      } else {
        console.error('Network Error - No response received');
      }
      
      // Log enhanced error details if available
      if (error.response?.data?.error) {
        console.group('🔍 Enhanced Error Details');
        const errorData = error.response.data.error;
        console.error('Error Code:', errorData.code);
        console.error('Error Message:', errorData.message);
        if (errorData.suggestions) {
          console.warn('💡 Suggestions:', errorData.suggestions);
        }
        if (errorData.details) {
          console.log('📋 Details:', errorData.details);
        }
        if (errorData.stack_trace) {
          console.log('📍 Stack Trace:', errorData.stack_trace);
        }
        console.groupEnd();
      }
      
      console.groupEnd();
    };

    // Log detailed error information
    logErrorDetails(error, originalRequest);

    // Handle specific error responses
    if (error.response?.status === 403) {
      console.error('❌ Access forbidden - insufficient permissions');
      console.warn('💡 Check user permissions or contact administrator');
    }

    if (error.response?.status && error.response.status >= 500) {
      console.error('❌ Server error occurred');
      console.warn('💡 This is likely a backend issue - check server logs');
    }

    // Transform error response to match our API format
    // FastAPI uses 'detail' for validation errors, while some APIs use 'message'
    const errorMessage = error.response?.data && typeof error.response.data === 'object'
      ? (error.response.data as any).detail || (error.response.data as any).message || (error as any).message || 'An error occurred'
      : (error as any).message || 'An error occurred';
    
    const errorErrors = error.response?.data && typeof error.response.data === 'object' && 'errors' in error.response.data
      ? (error.response.data as any).errors
      : undefined;

    const errorData: ApiResponse = {
      success: false,
      data: null,
      message: errorMessage,
      errors: errorErrors
    };

    // Preserve original error response while also providing transformed version
    const preservedError = {
      ...error,
      response: {
        ...error.response,
        data: {
          ...(error.response?.data && typeof error.response.data === 'object' ? error.response.data : {}), // Preserve original data (including detail field)
          ...errorData // Add our transformed data
        }
      }
    };

    return Promise.reject(preservedError);
  }
);

// API helper functions
export const apiClient = {
  get: <T = any>(url: string, config = {}) => 
    api.get<ApiResponse<T>>(url, config),
    
  post: <T = any>(url: string, data = {}, config = {}) => 
    api.post<ApiResponse<T>>(url, data, config),
    
  put: <T = any>(url: string, data = {}, config = {}) => 
    api.put<ApiResponse<T>>(url, data, config),
    
  patch: <T = any>(url: string, data = {}, config = {}) => 
    api.patch<ApiResponse<T>>(url, data, config),
    
  delete: <T = any>(url: string, config = {}) => 
    api.delete<ApiResponse<T>>(url, config),
};

export default api;

// Type definitions for axios config extension
declare module 'axios' {
  interface AxiosRequestConfig {
    _retry?: boolean;
  }
}