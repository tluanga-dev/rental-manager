'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { SalesHistoryTable } from '@/components/sales/SalesHistoryTable';
import { usePaginatedSales } from '@/hooks/use-sales';
import type { SaleFilters } from '@/types/sales';

function SalesHistoryContent() {
  const [filters, setFilters] = useState<SaleFilters>({
    skip: 0,
    limit: 100,
    transaction_type: 'SALE'
  });

  const {
    transactions,
    total,
    isLoading,
    error,
    refetch,
    updateFilters
  } = usePaginatedSales(filters);

  const handleFiltersChange = (newFilters: SaleFilters) => {
    setFilters(newFilters);
    updateFilters(newFilters);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="p-6">
      <SalesHistoryTable
        transactions={transactions}
        isLoading={isLoading}
        error={error}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onRefresh={handleRefresh}
        total={total}
        showFilters={true}
      />
    </div>
  );
}

export default function SalesHistoryPage() {
  return (
    <ProtectedRoute requiredPermissions={['SALE_VIEW']}>
      <SalesHistoryContent />
    </ProtectedRoute>
  );
}