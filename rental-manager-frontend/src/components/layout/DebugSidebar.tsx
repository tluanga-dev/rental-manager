'use client';

import React from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { usePathname } from 'next/navigation';

export function DebugSidebar() {
  const pathname = usePathname();
  const { user, permissions, hasPermission } = useAuthStore();
  
  // Check specific permissions
  const hasRentalView = hasPermission(['RENTAL_VIEW'] as any);
  const hasRentalCreate = hasPermission(['RENTAL_CREATE'] as any);
  
  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <h3 className="font-bold text-sm mb-2">Debug Info</h3>
      <div className="text-xs space-y-1">
        <div>Path: {pathname}</div>
        <div>User: {user?.username}</div>
        <div>Type: {user?.userType}</div>
        <div>Superuser: {user?.isSuperuser ? 'Yes' : 'No'}</div>
        <div>Permissions: {permissions?.length || 0}</div>
        <div>RENTAL_VIEW: {hasRentalView ? 'Yes' : 'No'}</div>
        <div>RENTAL_CREATE: {hasRentalCreate ? 'Yes' : 'No'}</div>
      </div>
    </div>
  );
}