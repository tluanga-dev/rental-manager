'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Activity, 
  BarChart3,
  Layers
} from 'lucide-react';
import { UnitsTable } from './UnitsTable';
import { AllInventoryTable } from './AllInventoryTable';
import { MovementsTable } from './MovementsTable';
import { StockAnalytics } from './StockAnalytics';
import { ItemDetailsTab } from './ItemDetailsTab';
import type { 
  InventoryUnitDetail, 
  StockMovementDetail, 
  InventoryAnalytics,
  InventoryItemDetail,
  AllInventoryLocation
} from '@/types/inventory-items';

interface InventoryUnitsTabsProps {
  units: InventoryUnitDetail[];
  movements: StockMovementDetail[];
  analytics: InventoryAnalytics;
  allInventory?: AllInventoryLocation[]; // New comprehensive inventory data
  isLoadingUnits?: boolean;
  isLoadingMovements?: boolean;
  isLoadingAnalytics?: boolean;
  isLoadingAllInventory?: boolean;
  itemName?: string; // Item name for rental blocking context
  item?: InventoryItemDetail; // Full item data for stock information
  fullWidth?: boolean; // Use full width layout
}

export function InventoryUnitsTabs({
  units,
  movements,
  analytics,
  allInventory = [],
  isLoadingUnits,
  isLoadingMovements,
  isLoadingAnalytics,
  isLoadingAllInventory,
  itemName,
  item,
  fullWidth = false,
}: InventoryUnitsTabsProps) {
  const [activeTab, setActiveTab] = useState('item-details');

  const tabs = [
    {
      id: 'item-details',
      label: 'Item Details',
      icon: Package,
      content: (
        <ItemDetailsTab 
          item={item!} 
          isLoading={false}
        />
      ),
    },
    {
      id: 'all-inventory',
      label: 'All Inventory',
      icon: Layers,
      count: allInventory.reduce((sum, loc) => sum + (loc.serialized_units?.length || 0) + ((loc.bulk_stock?.total_quantity || 0) > 0 ? 1 : 0), 0),
      content: (
        <AllInventoryTable 
          locations={allInventory} 
          isLoading={isLoadingAllInventory}
          itemName={itemName}
        />
      ),
    },
    {
      id: 'units',
      label: 'Units Only',
      icon: Package,
      count: units.length,
      content: (
        <UnitsTable 
          units={units} 
          isLoading={isLoadingUnits}
          itemName={itemName}
          item={item}
        />
      ),
    },
    {
      id: 'movements',
      label: 'Stock Movements',
      icon: Activity,
      count: movements.length,
      content: (
        <MovementsTable 
          movements={movements} 
          isLoading={isLoadingMovements}
        />
      ),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      content: (
        <StockAnalytics 
          analytics={analytics} 
          isLoading={isLoadingAnalytics}
        />
      ),
    },
  ];

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <Badge 
                  variant="secondary" 
                  className="ml-2 h-5 px-1.5 text-xs"
                >
                  {tab.count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          className="mt-6"
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}