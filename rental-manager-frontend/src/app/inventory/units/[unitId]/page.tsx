'use client';

import React, { use } from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { InventoryUnitDetail } from '@/components/inventory/inventory-unit-detail/InventoryUnitDetail';

interface InventoryUnitDetailPageProps {
  params: Promise<{
    unitId: string;
  }>;
  searchParams?: Promise<{
    itemId?: string;
    itemName?: string;
  }>;
}

export default function InventoryUnitDetailPage({ 
  params, 
  searchParams 
}: InventoryUnitDetailPageProps) {
  const { unitId } = use(params);
  const queryParams = use(searchParams || Promise.resolve({}));
  
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        <InventoryUnitDetail 
          unitId={unitId} 
          itemId={queryParams.itemId}
          itemName={queryParams.itemName}
        />
      </div>
    </AuthConnectionGuard>
  );
}