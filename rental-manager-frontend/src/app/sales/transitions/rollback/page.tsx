/**
 * Rollback Management Page
 * 
 * Page for managing and executing rollbacks of sale transitions
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, RotateCcwIcon } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import RollbackManagementPanel from '@/components/sale-transitions/RollbackManagementPanel';

export default function RollbackManagementPage() {
  const router = useRouter();

  return (
    <ProtectedRoute requiredPermissions={['SALE_VIEW', 'INVENTORY_VIEW']}>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/sales/transitions')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Transitions
            </button>
            
            <div className="flex items-center gap-2">
              <RotateCcwIcon className="w-5 h-5 text-purple-500" />
              <h1 className="text-xl font-semibold text-gray-900">Rollback Management</h1>
            </div>
          </div>
        </div>
        
        <RollbackManagementPanel />
      </div>
    </ProtectedRoute>
  );
}