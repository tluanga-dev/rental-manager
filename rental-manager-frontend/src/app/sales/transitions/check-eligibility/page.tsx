/**
 * Check Eligibility Page
 * 
 * Page for checking if items are eligible for sale transition
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import SaleEligibilityCheck from '@/components/sale-transitions/SaleEligibilityCheck';

export default function CheckEligibilityPage() {
  const router = useRouter();

  const handleTransitionInitiated = (transitionId: string) => {
    // Navigate to the conflict resolution page for the new transition
    router.push(`/sales/transitions/${transitionId}/resolve`);
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
        
        <SaleEligibilityCheck onTransitionInitiated={handleTransitionInitiated} />
      </div>
    </ProtectedRoute>
  );
}