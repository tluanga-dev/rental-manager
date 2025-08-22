'use client';

import React from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { InventoryItemsList } from '@/components/inventory/inventory-items';
import { Database, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InventoryItemsPage() {
  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export inventory items');
  };

  const handleImport = () => {
    // TODO: Implement import functionality
    console.log('Import inventory items');
  };

  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg">
                <Database className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Inventory Items</h1>
                <p className="text-gray-600">
                  Manage your complete product inventory with detailed stock information
                </p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImport}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <InventoryItemsList />
      </div>
    </AuthConnectionGuard>
  );
}