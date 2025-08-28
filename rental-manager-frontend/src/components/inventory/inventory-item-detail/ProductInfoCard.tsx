'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Package, 
  Tag, 
  Grid3X3, 
  DollarSign,
  ShoppingCart,
  RefreshCw,
  Info
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { cn } from '@/lib/utils';
import type { InventoryItemDetail } from '@/types/inventory-items';

interface ProductInfoCardProps {
  item: InventoryItemDetail;
  compact?: boolean;
}

const ITEM_STATUS_CONFIG = {
  ACTIVE: {
    label: 'Active',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  INACTIVE: {
    label: 'Inactive',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  DISCONTINUED: {
    label: 'Discontinued',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
};

export function ProductInfoCard({ item, compact = false }: ProductInfoCardProps) {
  // Handle nested item structure from API
  const actualItem = item.item || item;
  const statusConfig = ITEM_STATUS_CONFIG[actualItem.item_status as keyof typeof ITEM_STATUS_CONFIG];

  // Compact mode - just show status badge
  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className={cn('text-sm', statusConfig?.className || 'bg-gray-100 text-gray-800 border-gray-200')}
      >
        {statusConfig?.label || 'Unknown'}
      </Badge>
    );
  }

  // Full card mode
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 rounded-lg">
              <Package className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <CardTitle className="text-xl">{item.item_name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">SKU: {item.sku}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn('ml-2', statusConfig?.className)}
          >
            {statusConfig?.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Info className="h-4 w-4" />
            Basic Information
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-medium">{item.category?.name || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">Code: {item.category?.code || 'N/A'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Brand</p>
                <p className="font-medium">{item.brand?.name || 'N/A'}</p>
              </div>
            </div>
          </div>

          {item.description && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{item.description}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Pricing Information */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pricing Information
          </h3>
          
          <div className="grid grid-cols-3 gap-4">
            {item.purchase_price !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Purchase Price</p>
                <p className="font-semibold text-lg">
                  {formatCurrencySync(item.purchase_price)}
                </p>
              </div>
            )}
            
            {item.sale_price !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Sale Price</p>
                <p className="font-semibold text-lg text-green-600">
                  {formatCurrencySync(item.sale_price)}
                </p>
              </div>
            )}
            
            {item.rental_rate !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Rental Rate</p>
                <p className="font-semibold text-lg text-blue-600">
                  {formatCurrencySync(item.rental_rate)}
                  <span className="text-xs text-muted-foreground">/day</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Attributes */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Attributes</h3>
          
          <div className="flex gap-3">
            {item.is_rentable && (
              <Badge variant="outline" className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Rentable
              </Badge>
            )}
            {item.is_saleable && (
              <Badge variant="outline" className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                Saleable
              </Badge>
            )}
            {!item.is_rentable && !item.is_saleable && (
              <Badge variant="outline" className="text-muted-foreground">
                Internal Use Only
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Stock Levels */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Stock Levels</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {item.min_stock_level !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Minimum Stock</p>
                <p className="font-medium">{item.min_stock_level} units</p>
              </div>
            )}
            
            {item.max_stock_level !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Maximum Stock</p>
                <p className="font-medium">{item.max_stock_level} units</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Timestamps */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Created:</span>
            <span>{new Date(item.created_at).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Last Updated:</span>
            <span>{new Date(item.updated_at).toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}