'use client';

import React from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { StockLevelsManagement } from '@/components/inventory/stock-levels';
import { BarChart3, TrendingUp, TrendingDown, Package } from 'lucide-react';

export default function StockLevelsPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Stock Levels Management</h1>
                <p className="text-gray-600">
                  Monitor and manage inventory stock levels across all locations
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-xl font-semibold text-gray-900">-</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">In Stock</p>
                <p className="text-xl font-semibold text-green-600">-</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <TrendingDown className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-xl font-semibold text-yellow-600">-</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Package className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Out of Stock</p>
                <p className="text-xl font-semibold text-red-600">-</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <StockLevelsManagement />
      </div>
    </AuthConnectionGuard>
  );
}