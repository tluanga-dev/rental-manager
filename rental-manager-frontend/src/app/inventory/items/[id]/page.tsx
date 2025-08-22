'use client';

import React from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { InventoryItemDetail } from '@/components/inventory/inventory-item-detail';
import { Database } from 'lucide-react';

interface InventoryItemDetailPageProps {
  params: {
    id: string;
  };
}

export default function InventoryItemDetailPage({ params }: InventoryItemDetailPageProps) {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg">
              <Database className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Item Details</h1>
              <p className="text-gray-600">
                View comprehensive information about this inventory item
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <InventoryItemDetail itemId={params.id} />
      </div>
    </AuthConnectionGuard>
  );
}