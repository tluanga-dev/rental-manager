'use client';

import React, { use } from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { InventoryUnitsListPage } from '@/components/inventory/inventory-units/InventoryUnitsListPage';

interface InventoryUnitsPageProps {
  params: Promise<{
    sku: string;
  }>;
}

export default function InventoryUnitsPage({ params }: InventoryUnitsPageProps) {
  const { sku } = use(params);

  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        <InventoryUnitsListPage itemSku={sku} />
      </div>
    </AuthConnectionGuard>
  );
}