'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { RentalCreationWizard } from '@/components/rentals/wizard/RentalCreationWizard';

function CompactCreateRentalContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <RentalCreationWizard />
      </div>
    </div>
  );
}

export default function CompactCreateRentalPage() {
  return (
    <ProtectedRoute requiredPermissions={['RENTAL_CREATE']}>
      <CompactCreateRentalContent />
    </ProtectedRoute>
  );
}
