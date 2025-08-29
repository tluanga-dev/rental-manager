'use client';

import React from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { StockMovementsManagement } from '@/components/inventory/movements';
import { Activity, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react';

export default function StockMovementsPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
              <p className="text-gray-600">
                Track and analyze all inventory movement history across your organization
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Movements</p>
                <p className="text-xl font-semibold text-gray-900">-</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Stock In</p>
                <p className="text-xl font-semibold text-green-600">-</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Stock Out</p>
                <p className="text-xl font-semibold text-red-600">-</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <RotateCcw className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Net Change</p>
                <p className="text-xl font-semibold text-purple-600">-</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <StockMovementsManagement />
      </div>
    </AuthConnectionGuard>
  );
}