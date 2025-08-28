'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  Wrench,
  AlertTriangle,
  MapPin,
  TrendingUp
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { cn } from '@/lib/utils';
import type { InventoryItemDetail, LocationStock } from '@/types/inventory-items';

interface StockSummaryCardsProps {
  item: InventoryItemDetail;
}

export function StockSummaryCards({ item }: StockSummaryCardsProps) {
  const { stock_summary, location_breakdown, total_value } = item;
  
  const getStockHealthColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-50';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const stockHealthPercentage = stock_summary.total > 0 
    ? (stock_summary.available / stock_summary.total) * 100 
    : 0;

  const cards = [
    {
      title: 'Total Units',
      value: stock_summary.total,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      subtitle: `${location_breakdown?.length || 0} locations`,
    },
    {
      title: 'Available',
      value: stock_summary.available,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      percentage: stock_summary.total > 0 
        ? ((stock_summary.available / stock_summary.total) * 100).toFixed(1) 
        : '0',
    },
    {
      title: 'Reserved/Rented',
      value: stock_summary.reserved + stock_summary.rented,
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      breakdown: {
        reserved: stock_summary.reserved,
        rented: stock_summary.rented,
      },
    },
    {
      title: 'Total Value',
      value: total_value,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      format: 'currency',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Main Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {card.title}
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {card.format === 'currency' 
                        ? formatCurrencySync((card.value as number) || 0)
                        : (card.value || 0).toLocaleString()
                      }
                    </p>
                    {card.subtitle && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {card.subtitle}
                      </p>
                    )}
                    {card.percentage && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {card.percentage}% of total
                      </p>
                    )}
                    {card.breakdown && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-1">
                        <div>Reserved: {card.breakdown.reserved}</div>
                        <div>Rented: {card.breakdown.rented}</div>
                      </div>
                    )}
                  </div>
                  <div className={cn('p-2 rounded-lg', card.bgColor)}>
                    <Icon className={cn('h-5 w-5', card.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stock Health Card */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Stock Health Overview</h3>
              <Badge 
                variant="outline" 
                className={cn(
                  'font-semibold',
                  getStockHealthColor(stockHealthPercentage)
                )}
              >
                {stockHealthPercentage.toFixed(1)}% Available
              </Badge>
            </div>
            
            <Progress value={stockHealthPercentage} className="h-3" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              {stock_summary.in_maintenance > 0 && (
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Maintenance</p>
                    <p className="font-medium">{stock_summary.in_maintenance}</p>
                  </div>
                </div>
              )}
              
              {stock_summary.damaged > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Damaged</p>
                    <p className="font-medium">{stock_summary.damaged}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Rented</p>
                  <p className="font-medium">{stock_summary.rented}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Reserved</p>
                  <p className="font-medium">{stock_summary.reserved}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Breakdown */}
      {(location_breakdown?.length || 0) > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Location Breakdown</h3>
              </div>
              
              <div className="space-y-3">
                {location_breakdown.map((location: LocationStock) => (
                  <div key={location.location_id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{location.location_name}</span>
                      <Badge variant="outline">
                        {location.total_units} units
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-medium">{location.total_units}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Available: </span>
                        <span className="font-medium text-green-600">
                          {location.available_units}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Reserved: </span>
                        <span className="font-medium text-purple-600">
                          {location.reserved_units}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rented: </span>
                        <span className="font-medium text-blue-600">
                          {location.rented_units}
                        </span>
                      </div>
                    </div>
                    
                    <Progress 
                      value={(location.available_units / location.total_units) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}