'use client';

import { PurchaseHistoryTable } from '@/components/purchases/purchase-history-table';

export default function PurchaseHistoryPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PurchaseHistoryTable />
    </div>
  );
}