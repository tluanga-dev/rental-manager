'use client';

import { ImprovedPurchaseRecordingForm } from '@/components/purchases/ImprovedPurchaseRecordingForm';

export default function CreatePurchasePage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Create Purchase Transaction</h1>
        <p className="text-muted-foreground">
          Record a new purchase transaction with items, quantities, and costs.
        </p>
      </div>
      
      <ImprovedPurchaseRecordingForm />
    </div>
  );
}