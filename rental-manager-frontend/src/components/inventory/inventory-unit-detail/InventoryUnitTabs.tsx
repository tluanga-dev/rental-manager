'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Activity, 
  Calendar,
  BarChart3,
  Wrench
} from 'lucide-react';
import { UnitDetailsTab } from './UnitDetailsTab';
import { UnitMovementsTab } from './UnitMovementsTab';
import { UnitRentalHistoryTab } from './UnitRentalHistoryTab';
import { UnitAnalyticsTab } from './UnitAnalyticsTab';
import { UnitMaintenanceTab } from './UnitMaintenanceTab';
import type { InventoryUnitDetail } from '@/types/inventory-items';

interface InventoryUnitTabsProps {
  unit: InventoryUnitDetail;
  unitId: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function InventoryUnitTabs({ 
  unit, 
  unitId, 
  activeTab, 
  onTabChange 
}: InventoryUnitTabsProps) {
  
  const tabs = [
    {
      id: 'details',
      label: 'Unit Details',
      icon: Package,
      content: <UnitDetailsTab unit={unit} />,
    },
    {
      id: 'movements',
      label: 'Stock Movements',
      icon: Activity,
      content: <UnitMovementsTab unitId={unitId} />,
    },
    {
      id: 'rental-history',
      label: 'Rental History',
      icon: Calendar,
      content: <UnitRentalHistoryTab unitId={unitId} />,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      content: <UnitAnalyticsTab unitId={unitId} />,
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: Wrench,
      content: <UnitMaintenanceTab unitId={unitId} />,
    },
  ];

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
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