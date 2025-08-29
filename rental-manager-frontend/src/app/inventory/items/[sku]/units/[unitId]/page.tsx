'use client';

import React, { use } from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { InventoryUnitDetail } from '@/components/inventory/inventory-unit-detail/InventoryUnitDetail';

interface InventoryUnitDetailPageProps {
  params: Promise<{
    sku: string;
    unitId: string;
  }>;
}

export default function InventoryUnitDetailPage({ params }: InventoryUnitDetailPageProps) {
  const { sku, unitId } = use(params);

  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        <InventoryUnitDetail unitId={unitId} itemSku={sku} />
      </div>
    </AuthConnectionGuard>
  );
}