'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Download, 
  Edit, 
  RefreshCw,
  Package,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { InventoryUnitTabs } from './InventoryUnitTabs';
import { inventoryUnitsApi } from '@/services/api/inventory-units';
import { cn } from '@/lib/utils';
import type { InventoryUnitDetail as InventoryUnitDetailType, InventoryUnitStatus } from '@/types/inventory-items';

interface InventoryUnitDetailProps {
  unitId: string;
  itemId?: string;
  itemName?: string;
  itemSku?: string;
}

const UNIT_STATUS_CONFIG: Record<InventoryUnitStatus, {
  label: string;
  className: string;
  icon?: React.ComponentType<{ className?: string }>;
}> = {
  AVAILABLE: {
    label: 'Available',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
  },
  RESERVED: {
    label: 'Reserved',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  RENTED: {
    label: 'Rented',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  IN_TRANSIT: {
    label: 'In Transit',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  INSPECTION: {
    label: 'Inspection',
    className: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },
  DAMAGED: {
    label: 'Damaged',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertCircle,
  },
  LOST: {
    label: 'Lost',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  SOLD: {
    label: 'Sold',
    className: 'bg-slate-100 text-slate-800 border-slate-200',
  },
};

export function InventoryUnitDetail({ unitId, itemId, itemName, itemSku }: InventoryUnitDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('details');

  // Fetch unit details
  const {
    data: unit,
    isLoading: isLoadingUnit,
    isError: isUnitError,
    error: unitError,
    refetch: refetchUnit,
  } = useQuery({
    queryKey: ['inventory-unit', unitId],
    queryFn: async () => {
      const result = await inventoryUnitsApi.getUnitDetail(unitId);
      console.log('📦 Unit detail fetched:', result);
      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleBack = () => {
    if (itemId) {
      router.push(`/inventory/items/${itemId}`);
    } else {
      router.push('/inventory/items');
    }
  };

  const handleEdit = () => {
    console.log('Edit unit:', unitId);
  };

  const handleExport = () => {
    console.log('Export unit data:', unitId);
  };

  const handleRefresh = () => {
    refetchUnit();
  };

  if (isLoadingUnit) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading unit details...</p>
        </div>
      </div>
    );
  }

  if (isUnitError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading unit details: {unitError instanceof Error ? unitError.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!unit) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Unit not found</AlertDescription>
      </Alert>
    );
  }

  const statusConfig = UNIT_STATUS_CONFIG[unit.status as InventoryUnitStatus] || {
    label: unit.status,
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-4">
      {/* Header with Breadcrumb and Actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/inventory">Inventory</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/inventory/items">Items</BreadcrumbLink>
              </BreadcrumbItem>
              {itemId && itemName && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href={`/inventory/items/${itemId}`}>
                      {itemName}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Unit {unit.unit_identifier}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
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
              onClick={handleEdit}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Unit Header Info */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-2xl font-bold text-gray-900">
                  Unit {unit.unit_identifier}
                </h1>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {unit.serial_number && (
                  <>
                    <span>Serial: <span className="font-medium font-mono">{unit.serial_number}</span></span>
                    <span>•</span>
                  </>
                )}
                <span>Location: <span className="font-medium">{unit.location_name}</span></span>
                {unit.acquisition_date && (
                  <>
                    <span>•</span>
                    <span>Acquired: <span className="font-medium">
                      {new Date(unit.acquisition_date).toLocaleDateString()}
                    </span></span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn('flex items-center gap-1', statusConfig.className)}
              >
                {StatusIcon && <StatusIcon className="h-3 w-3" />}
                {statusConfig.label}
              </Badge>
              {unit.condition && (
                <Badge variant="outline">
                  Condition: {unit.condition}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for Unit Content */}
      <InventoryUnitTabs
        unit={unit}
        unitId={unitId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}