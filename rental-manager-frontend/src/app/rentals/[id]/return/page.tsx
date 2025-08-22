'use client';

import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import RentalReturnPage from '@/components/RentalReturnPage';
import { ErrorBoundary, NetworkStatus } from '@/components/ErrorComponents';

function RentalReturnContent() {
  const params = useParams();
  const rentalId = params.id as string;

  console.log('🎯 Return Page Loading...');
  console.log('🎯 Rental ID:', rentalId);

  if (!rentalId || typeof rentalId !== 'string') {
    return (
      <>
        <NetworkStatus />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading return page...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <NetworkStatus />
      <RentalReturnPage rentalId={rentalId} />
    </ErrorBoundary>
  );
}

export default function RentalReturnPageWrapper() {
  return (
    <ProtectedRoute requiredPermissions={['RENTAL_RETURN']}>
      <RentalReturnContent />
    </ProtectedRoute>
  );
}