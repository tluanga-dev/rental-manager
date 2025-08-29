'use client';

import React, { use } from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { InventoryItemDetail } from '@/components/inventory/inventory-item-detail/InventoryItemDetail';
import { Database } from 'lucide-react';

interface InventoryItemDetailPageProps {
  params: Promise<{
    sku: string;
  }>;
}

export default function InventoryItemDetailPage({ params }: InventoryItemDetailPageProps) {
  const { sku } = use(params);

  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        {/* Main Content - Full Width */}
        <InventoryItemDetail itemSku={sku} />
      </div>
    </AuthConnectionGuard>
  );
}