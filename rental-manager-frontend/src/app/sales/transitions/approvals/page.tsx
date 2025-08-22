/**
 * Approval Management Page
 * 
 * Page for managers to review and approve sale transitions
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ShieldIcon } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import ApprovalManagementPanel from '@/components/sale-transitions/ApprovalManagementPanel';

export default function ApprovalManagementPage() {
  const router = useRouter();

  const handleApproved = () => {
    // Optionally refresh the main dashboard
    router.refresh();
  };

  const handleRejected = () => {
    // Optionally refresh the main dashboard
    router.refresh();
  };

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
              <ShieldIcon className="w-5 h-5 text-orange-500" />
              <h1 className="text-xl font-semibold text-gray-900">Approval Management</h1>
            </div>
          </div>
        </div>
        
        <ApprovalManagementPanel 
          onApproved={handleApproved}
          onRejected={handleRejected}
        />
      </div>
    </ProtectedRoute>
  );
}