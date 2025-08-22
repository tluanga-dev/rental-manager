'use client';

import { LoginForm } from '@/components/forms/login-form';
import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

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
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
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
  }, [isAuthenticated, isLoading, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return <LoginLoading />;
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