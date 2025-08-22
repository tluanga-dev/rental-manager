'use client';

import { use } from 'react';
import { PurchaseDetailView } from '@/components/purchases/purchase-detail-view';

interface PurchaseDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function PurchaseDetailPage({ params }: PurchaseDetailPageProps) {
  const { id } = use(params);
  return (
    <div className="container mx-auto py-6">
      <PurchaseDetailView purchaseId={id} />
    </div>
  );
}