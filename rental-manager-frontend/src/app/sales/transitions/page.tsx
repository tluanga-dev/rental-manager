/**
 * Sale Transitions Page
 * 
 * Main page for managing sale transitions
 */

'use client';

import React from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import SaleTransitionDashboard from '@/components/sale-transitions/SaleTransitionDashboard';

export default function SaleTransitionsPage() {
  return (
    <ProtectedRoute requiredPermissions={['SALE_VIEW', 'INVENTORY_VIEW']}>
      <div className="container mx-auto px-4 py-6">
        <SaleTransitionDashboard />
      </div>
    </ProtectedRoute>
  );
}