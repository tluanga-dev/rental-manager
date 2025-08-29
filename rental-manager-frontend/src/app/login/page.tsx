'use client';

import { LoginForm } from '@/components/forms/login-form';
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Loading component for Suspense boundary
function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-600"></div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { 
    isAuthenticated, 
    isLoading, 
    isDevelopmentMode, 
    isAuthDisabled,
    bypassAuthentication,
    initializeDevelopmentMode 
  } = useAuthStore();

  useEffect(() => {
    // In development mode with auth disabled, auto-bypass authentication
    if (isDevelopmentMode && isAuthDisabled && !isAuthenticated) {
      console.log('🔓 Development mode detected - bypassing authentication');
      initializeDevelopmentMode();
      // Redirect after a short delay to ensure auth state is updated
      setTimeout(() => {
        router.push('/dashboard/main');
      }, 100);
      return;
    }
    
    // Check if user is already authenticated
    // If authenticated, redirect to dashboard/main
    if (!isLoading && isAuthenticated) {
      console.log('User already authenticated, redirecting to dashboard/main');
      router.push('/dashboard/main');
      // Fallback with window.location if router doesn't work
      setTimeout(() => {
        if (window.location.pathname === '/login') {
          window.location.href = '/dashboard/main';
        }
      }, 500);
    }
  }, [isAuthenticated, isLoading, router, isDevelopmentMode, isAuthDisabled, bypassAuthentication, initializeDevelopmentMode]);

  // Show loading while checking authentication
  if (isLoading) {
    return <LoginLoading />;
  }

  // Show development mode bypass UI
  if (isDevelopmentMode && isAuthDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-yellow-500" />
                <AlertTriangle className="h-6 w-6 text-orange-500 animate-pulse" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Development Mode
                </h2>
                <Badge variant="destructive" className="mt-2">
                  AUTH BYPASS ENABLED
                </Badge>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>Authentication is bypassed in development mode.</p>
                <p>Click below to continue with mock authentication.</p>
              </div>
              <Button 
                onClick={() => {
                  bypassAuthentication();
                  router.push('/dashboard/main');
                }}
                className="w-full"
                variant="default"
              >
                Continue to Dashboard (Dev Mode)
              </Button>
              <div className="pt-4 border-t w-full">
                <p className="text-xs text-gray-500">
                  To disable auth bypass, set NEXT_PUBLIC_DISABLE_AUTH=false in .env.development
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If authenticated, show loading while redirecting
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Rental Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Comprehensive rental and inventory management system
          </p>
        </div>
        <Suspense fallback={<LoginLoading />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}