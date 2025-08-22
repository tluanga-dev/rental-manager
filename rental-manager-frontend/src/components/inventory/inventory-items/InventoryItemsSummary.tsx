'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Package, 
  Boxes, 
  DollarSign, 
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import type { InventorySummaryStats } from '@/types/inventory-items';

interface InventoryItemsSummaryProps {
  stats: InventorySummaryStats;
  isLoading?: boolean;
}

export function InventoryItemsSummary({ stats, isLoading }: InventoryItemsSummaryProps) {
  const cards = [
    {
      title: 'Total Products',
      value: stats.total_products,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      format: 'number',
    },
    {
      title: 'Total Units',
      value: stats.total_units,
      icon: Boxes,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      format: 'number',
    },
    {
      title: 'Total Value',
      value: stats.total_value,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      format: 'currency',
    },
    {
      title: 'Stock Health',
      value: stats.stock_health,
      icon: Activity,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      format: 'percentage',
    },
  ];

  const stockStatusCards = [
    {
      label: 'In Stock',
      value: stats.in_stock,
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      label: 'Low Stock',
      value: stats.low_stock,
      icon: AlertTriangle,
      color: 'text-yellow-500',
    },
    {
      label: 'Out of Stock',
      value: stats.out_of_stock,
      icon: TrendingUp,
      color: 'text-red-500',
    },
  ];

  const formatValue = (value: number, format: string) => {
    if (isLoading) return '...';
    
    switch (format) {
      case 'currency':
        if (value === 0) {
          return formatCurrencySync(0) + ' *';
        }
        return formatCurrencySync(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className="space-y-4">
      {/* Main summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </p>
                    <p className="text-2xl font-bold mt-2">
                      {formatValue(card.value, card.format)}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${card.bgColor}`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stock status breakdown */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            {stockStatusCards.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center space-x-3">
                  <Icon className={`h-5 w-5 ${item.color}`} />
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="text-lg font-semibold">
                      {isLoading ? '...' : item.value.toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Note about total value calculation */}
      {stats.total_value === 0 && !isLoading && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p>
            <strong>* Total Value:</strong> Some items may not have pricing data configured. 
            Values are calculated using purchase price, sale price, or estimated rental value when available.
          </p>
        </div>
      )}
    </div>
  );
}