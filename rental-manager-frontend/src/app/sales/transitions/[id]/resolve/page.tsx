/**
 * Resolve Conflicts Page
 * 
 * Page for resolving conflicts in a sale transition
 */

'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import ConflictResolutionPanel from '@/components/sale-transitions/ConflictResolutionPanel';

export default function ResolveConflictsPage() {
  const router = useRouter();
  const params = useParams();
  const transitionId = params.id as string;

  const handleResolved = () => {
    // Navigate back to the transitions dashboard
    router.push('/sales/transitions');
  };

  const handleCancel = () => {
    // Navigate back to the transitions dashboard
    router.push('/sales/transitions');
  };

  return (
    <ProtectedRoute requiredPermissions={['SALE_VIEW', 'INVENTORY_VIEW']}>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Transitions
          </button>
        </div>
        
        <ConflictResolutionPanel 
          transitionId={transitionId}
          onResolved={handleResolved}
          onCancel={handleCancel}
        />
      </div>
    </ProtectedRoute>
  );
}