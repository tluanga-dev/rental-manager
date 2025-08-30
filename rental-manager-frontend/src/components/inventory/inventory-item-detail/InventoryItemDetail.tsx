'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Download, 
  Edit, 
  RefreshCw,
  AlertCircle,
  Eye 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ProductInfoCard } from './ProductInfoCard';
import { StockSummaryCards } from './StockSummaryCards';
import { InventoryUnitsTabs } from './InventoryUnitsTabs';
import { PricingInfoCard } from './PricingInfoCard';
import { RentalStatusBlock } from './RentalStatusBlock';
import { PricingManagementModal } from '@/components/rental-pricing/PricingManagementModal';
import { inventoryItemsApi } from '@/services/api/inventory-items';
import type { 
  InventoryUnitDetail, 
  StockMovementDetail, 
  InventoryAnalytics 
} from '@/types/inventory-items';

interface InventoryItemDetailProps {
  itemId?: string;
  itemSku?: string;
}

export function InventoryItemDetail({ itemId, itemSku }: InventoryItemDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('units');
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [currentItem, setCurrentItem] = useState<InventoryItemDetail | null>(null);

  // Use SKU if provided, otherwise fall back to ID
  const identifier = itemSku || itemId || '';

  // Fetch item details
  const {
    data: item,
    isLoading: isLoadingItem,
    isError: isItemError,
    error: itemError,
    refetch: refetchItem,
  } = useQuery({
    queryKey: ['inventory-item', identifier],
    queryFn: async () => {
      const result = await inventoryItemsApi.getItemDetail(identifier);
      console.log('📊 Item detail fetched:', result);
      console.log('📊 Stock summary:', result?.stock_summary);
      setCurrentItem(result);
      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!identifier,
  });

  // Fetch units
  const {
    data: units = [],
    isLoading: isLoadingUnits,
    refetch: refetchUnits,
    error: unitsError,
  } = useQuery({
    queryKey: ['inventory-item-units', identifier],
    queryFn: async () => {
      console.log('🔄 Fetching units for item:', identifier);
      const result = await inventoryItemsApi.getItemUnits(identifier);
      console.log('🔄 Query function returned:', result?.length || 0, 'units');
      return result;
    },
    enabled: !!identifier,
    staleTime: 0, // Disable cache for debugging
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    gcTime: 0, // Don't keep in cache after unmount
  });
  
  // Debug logging
  console.log('🎯 InventoryItemDetail - units state:', units?.length || 0, 'units');
  console.log('🎯 Units loading:', isLoadingUnits);
  console.log('🎯 Units error:', unitsError);

  // Fetch movements
  const {
    data: movements = [],
    isLoading: isLoadingMovements,
    refetch: refetchMovements,
  } = useQuery({
    queryKey: ['inventory-item-movements', identifier],
    queryFn: () => inventoryItemsApi.getItemMovements(identifier, { limit: 100 }),
    enabled: !!identifier && activeTab === 'movements',
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch analytics
  const {
    data: analytics,
    isLoading: isLoadingAnalytics,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ['inventory-item-analytics', identifier],
    queryFn: () => inventoryItemsApi.getItemAnalytics(identifier),
    enabled: !!identifier && activeTab === 'analytics',
    staleTime: 1000 * 60 * 5, // 5 minutes
  });


  const handleBack = () => {
    router.push('/inventory/items');
  };

  const handleViewProductDetails = () => {
    // Navigate to product details page using SKU
    const sku = item?.item?.sku || item?.sku;
    console.log('🔍 View Product Details clicked');
    console.log('Item data:', item);
    console.log('SKU found:', sku);
    if (sku) {
      router.push(`/products/items/sku/${sku}`);
    } else {
      console.warn('⚠️ No SKU found in item data');
    }
  };

  const handleEdit = () => {
    // TODO: Implement edit functionality
    console.log('Edit item:', itemId);
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export item data:', itemId);
  };

  const handleRefresh = () => {
    refetchItem();
    refetchUnits();
    if (activeTab === 'movements') refetchMovements();
    if (activeTab === 'analytics') refetchAnalytics();
  };

  const handleItemUpdate = (updatedItem: InventoryItemDetail) => {
    setCurrentItem(updatedItem);
    // Force refetch to ensure all data is synchronized
    refetchItem();
  };

  if (isLoadingItem) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading item details...</p>
        </div>
      </div>
    );
  }

  if (isItemError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading item details: {itemError instanceof Error ? itemError.message : 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!item) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Item not found</AlertDescription>
      </Alert>
    );
  }

  // Default analytics if not loaded
  const defaultAnalytics: InventoryAnalytics = analytics || {
    total_movements: 0,
    average_daily_movement: 0,
    turnover_rate: 0,
    stock_health_score: 0,
    days_of_stock: undefined,
    last_restock_date: undefined,
    last_sale_date: undefined,
    trend: 'STABLE',
  };

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
                <BreadcrumbLink href="/inventory/items">Inventory Items</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{item.item_name}</BreadcrumbPage>
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
              onClick={handleViewProductDetails}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View Product Details
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

        {/* Item Header Info - Compact */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">{item.item?.item_name || item.item_name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>SKU: <span className="font-medium">{item.item?.sku || item.sku}</span></span>
                <span>•</span>
                <span>Category: <span className="font-medium">{item.item?.category?.name || item.category?.name || 'N/A'}</span></span>
                <span>•</span>
                <span>Brand: <span className="font-medium">{item.item?.brand?.name || item.brand?.name || 'N/A'}</span></span>
              </div>
            </div>
            <ProductInfoCard item={item} compact={true} />
          </div>
        </div>
      </div>

      {/* Stock Summary Cards - Horizontal Strip */}
      <StockSummaryCards item={item} />

      {/* Rental Status Block */}
      <RentalStatusBlock 
        item={currentItem || item}
        onManagePricing={() => setShowPricingModal(true)}
        onManageRental={() => {
          // TODO: Add rental management functionality
          console.log('Manage rental clicked for item:', item.item_id);
        }}
      />

      {/* Pricing Information Card */}
      <PricingInfoCard 
        item={currentItem || item} 
        onManagePricing={() => setShowPricingModal(true)}
        onItemUpdate={handleItemUpdate}
      />

      {/* Full Width Tabs for All Content */}
      <InventoryUnitsTabs
        units={units}
        movements={movements}
        analytics={defaultAnalytics}
        isLoadingUnits={isLoadingUnits}
        isLoadingMovements={isLoadingMovements}
        isLoadingAnalytics={isLoadingAnalytics}
        itemName={item.item_name}
        item={item}
        fullWidth={true}
      />

      {/* Pricing Management Modal */}
      {(currentItem || item).is_rentable && (
        <PricingManagementModal
          isOpen={showPricingModal}
          onClose={() => setShowPricingModal(false)}
          itemId={item.item_id}
          itemName={item.item_name}
          currentDailyRate={item.rental_rate}
          onPricingUpdated={() => {
            // Refresh item data to pick up updated pricing
            refetchItem();
          }}
        />
      )}
    </div>
  );
}