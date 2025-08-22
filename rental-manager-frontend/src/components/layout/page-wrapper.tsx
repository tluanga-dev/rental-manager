'use client';

import { ReactNode } from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { PermissionType } from '@/types/auth';

interface PageWrapperProps {
  children: ReactNode;
  requireAuth?: boolean;
  showOfflineAlert?: boolean;
  className?: string;
}

/**
 * High-order component that wraps pages with authentication and connectivity checking
 * Use this to quickly add auth and connectivity features to any page
 */
export function PageWrapper({ 
  children, 
  requireAuth = true, 
  showOfflineAlert = true,
  className 
}: PageWrapperProps) {
  return (
    <AuthConnectionGuard requireAuth={requireAuth} showOfflineAlert={showOfflineAlert}>
      <div className={className}>
        {children}
      </div>
    </AuthConnectionGuard>
  );
}

/**
 * Convenience wrapper for protected pages that require authentication
 */
export function ProtectedPageWrapper({ 
  children, 
  className 
}: { 
  children: ReactNode; 
  className?: string; 
}) {
  return (
    <PageWrapper requireAuth={true} showOfflineAlert={true} className={className}>
      {children}
    </PageWrapper>
  );
}

/**
 * Convenience wrapper for public pages that don't require authentication
 * but still need connectivity monitoring
 */
export function PublicPageWrapper({ 
  children, 
  className 
}: { 
  children: ReactNode; 
  className?: string; 
}) {
  return (
    <PageWrapper requireAuth={false} showOfflineAlert={true} className={className}>
      {children}
    </PageWrapper>
  );
}
