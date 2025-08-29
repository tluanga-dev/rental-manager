'use client';

import React from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { InventoryAlertsDashboard } from '@/components/inventory/alerts';
import { AlertTriangle, Bell, TrendingDown, Wrench } from 'lucide-react';

export default function InventoryAlertsPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Bell className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Alerts</h1>
              <p className="text-gray-600">
                Monitor critical inventory issues requiring attention
              </p>
            </div>
          </div>
        </div>

        {/* Alert Categories */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg border border-red-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-red-600 font-medium">High Priority</p>
                <p className="text-xl font-bold text-red-700">-</p>
                <p className="text-xs text-red-600">Out of stock items</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-yellow-600 font-medium">Medium Priority</p>
                <p className="text-xl font-bold text-yellow-700">-</p>
                <p className="text-xs text-yellow-600">Low stock alerts</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wrench className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">Maintenance</p>
                <p className="text-xl font-bold text-blue-700">-</p>
                <p className="text-xs text-blue-600">Units needing service</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Bell className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-purple-600 font-medium">Other Alerts</p>
                <p className="text-xl font-bold text-purple-700">-</p>
                <p className="text-xs text-purple-600">Warranty & expiry</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard */}
        <InventoryAlertsDashboard />
      </div>
    </AuthConnectionGuard>
  );
}