'use client';

import React from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { ItemInventoryTable } from '@/components/inventory/ItemInventoryTable';
import { Package } from 'lucide-react';

export default function InventoryPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-slate-50 rounded-lg">
              <Package className="h-6 w-6 text-slate-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Item Inventory</h1>
          </div>
          <p className="text-gray-600">
            Monitor and manage your inventory items, stock levels, and availability.
          </p>
        </div>

      <ItemInventoryTable />
      </div>
    </AuthConnectionGuard>
  );
}