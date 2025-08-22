'use client';

import { Suspense } from 'react';
import { PurchaseReturnForm } from '@/components/purchases/purchase-return-form';

export default function NewPurchaseReturnPage() {
  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<div>Loading...</div>}>
        <PurchaseReturnForm />
      </Suspense>
    </div>
  );
}