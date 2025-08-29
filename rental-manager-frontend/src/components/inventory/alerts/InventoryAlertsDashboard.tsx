'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stockLevelsApi } from '@/services/api/stock-levels';
import { inventoryAlertsApi, type InventoryAlert } from '@/services/api/inventory-alerts';
import { AlertsTable } from './AlertsTable';
import { AlertsFilters } from './AlertsFilters';
import { AlertsSummary } from './AlertsSummary';
import { RefreshCw, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AlertsFilterState {
  search: string;
  location_id: string;
  alert_type: string;
  severity: string;
}

interface AlertsSortConfig {
  field: string;
  order: 'asc' | 'desc';
}

export function InventoryAlertsDashboard() {
  const [filters, setFilters] = useState<AlertsFilterState>({
    search: '',
    location_id: '',
    alert_type: 'all',
    severity: 'all',
  });

  const [sortConfig, setSortConfig] = useState<AlertsSortConfig>({
    field: 'severity',
    order: 'desc', // Show high severity first
  });

  // Fetch low stock alerts
  const {
    data: lowStockAlerts = [],
    isLoading: isLoadingLowStock,
    refetch: refetchLowStock,
  } = useQuery({
    queryKey: ['low-stock-alerts'],
    queryFn: () => stockLevelsApi.getLowStockAlerts(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch inventory alerts (maintenance, warranty, etc.)
  const {
    data: inventoryAlerts = [],
    isLoading: isLoadingInventory,
    refetch: refetchInventory,
  } = useQuery({
    queryKey: ['inventory-alerts', filters.location_id],
    queryFn: () => inventoryAlertsApi.getAlerts(filters.location_id || undefined),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isLoading = isLoadingLowStock || isLoadingInventory;

  // Combine and filter alerts
  const allAlerts: InventoryAlert[] = React.useMemo(() => {
    // Convert low stock alerts to standard alert format
    const lowStockAlertItems: InventoryAlert[] = lowStockAlerts.map(alert => ({
      id: `low-stock-${alert.item_id}-${alert.location_id}`,
      alert_type: alert.alert_type,
      severity: alert.severity,
      title: `Low Stock: ${alert.item_name}`,
      message: `Only ${alert.current_stock} units remaining (reorder point: ${alert.reorder_point})`,
      item_id: alert.item_id,
      item_name: alert.item_name,
      item_sku: alert.item_sku,
      location_id: alert.location_id,
      location_name: alert.location_name,
      created_at: new Date().toISOString(),
      data: {
        current_stock: alert.current_stock,
        reorder_point: alert.reorder_point,
        shortage: alert.shortage,
      },
    }));

    // Combine all alerts
    const combined = [...lowStockAlertItems, ...inventoryAlerts];

    // Apply filters
    return combined.filter(alert => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!alert.item_name?.toLowerCase().includes(searchLower) &&
            !alert.item_sku?.toLowerCase().includes(searchLower) &&
            !alert.title.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      if (filters.location_id && alert.location_id !== filters.location_id) {
        return false;
      }

      if (filters.alert_type !== 'all' && alert.alert_type !== filters.alert_type) {
        return false;
      }

      if (filters.severity !== 'all' && alert.severity !== filters.severity) {
        return false;
      }

      return true;
    });
  }, [lowStockAlerts, inventoryAlerts, filters]);

  // Sort alerts
  const sortedAlerts = React.useMemo(() => {
    const sorted = [...allAlerts];
    
    sorted.sort((a, b) => {
      let aValue: any = a[sortConfig.field as keyof InventoryAlert];
      let bValue: any = b[sortConfig.field as keyof InventoryAlert];

      // Handle severity sorting
      if (sortConfig.field === 'severity') {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        aValue = severityOrder[a.severity as keyof typeof severityOrder] || 0;
        bValue = severityOrder[b.severity as keyof typeof severityOrder] || 0;
      }

      // Handle date sorting
      if (sortConfig.field === 'created_at') {
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
      }

      if (aValue < bValue) {
        return sortConfig.order === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.order === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [allAlerts, sortConfig]);

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleFilterChange = (newFilters: AlertsFilterState) => {
    setFilters(newFilters);
  };

  const handleRefresh = () => {
    refetchLowStock();
    refetchInventory();
  };

  const handleExportAlerts = () => {
    // Create CSV content
    const csvContent = [
      ['Type', 'Severity', 'Title', 'Item', 'SKU', 'Location', 'Date'].join(','),
      ...sortedAlerts.map(alert => [
        alert.alert_type,
        alert.severity,
        `"${alert.title}"`,
        `"${alert.item_name || ''}"`,
        alert.item_sku || '',
        `"${alert.location_name || ''}"`,
        new Date(alert.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-alerts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading && sortedAlerts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-6">
                <div className="h-4 bg-gray-200 rounded mb-3"></div>
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg border p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <AlertsSummary alerts={sortedAlerts} />

      {/* Filters and Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <AlertsFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          isLoading={isLoading}
        />
        
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExportAlerts} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Active Alerts ({sortedAlerts.length})
            </h3>
          </div>
        </div>

        <AlertsTable
          alerts={sortedAlerts}
          sortConfig={sortConfig}
          onSort={handleSort}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}