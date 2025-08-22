'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated } = useAuthStore();
  const { sidebarCollapsed } = useAppStore();
  const pathname = usePathname();

  // Check if current route should hide main navigation
  const hideMainNavigation = pathname?.includes('/return');

  if (!isAuthenticated) {
    return (
      <AuthConnectionGuard requireAuth={false} showOfflineAlert={true}>
        {children}
      </AuthConnectionGuard>
    );
  }

  // If on return page, render without main navigation
  if (hideMainNavigation) {
    return (
      <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {children}
        </div>
      </AuthConnectionGuard>
    );
  }

  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <TopBar />
        
          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <div className="h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthConnectionGuard>
  );
}