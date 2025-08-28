'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Package, 
  Tag, 
  DollarSign,
  Calendar,
  User,
  FileText,
  Settings,
  Info
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import type { InventoryItemDetail } from '@/types/inventory-items';

interface ItemDetailsTabProps {
  item: InventoryItemDetail;
  isLoading?: boolean;
}

export function ItemDetailsTab({ item, isLoading }: ItemDetailsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Item Name</p>
            <p className="font-medium">{item.item_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">SKU</p>
            <p className="font-medium">{item.sku}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge className="mt-1">{item.item_status || 'Active'}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Category</p>
            <p className="font-medium">{item.category?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Brand</p>
            <p className="font-medium">{item.brand?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Unit of Measurement</p>
            <p className="font-medium">{item.unit_of_measurement || 'Unit'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Unit Price</p>
            <p className="font-medium text-lg">{formatCurrencySync(item.unit_price || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sale Price</p>
            <p className="font-medium text-lg">{formatCurrencySync(item.sale_price || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rental Rate</p>
            <p className="font-medium text-lg">{formatCurrencySync(item.rental_rate || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="font-medium text-lg text-green-600">
              {formatCurrencySync(item.total_value || 0)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stock Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Stock Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Min Stock Level</p>
            <p className="font-medium">{item.min_stock_level || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Max Stock Level</p>
            <p className="font-medium">{item.max_stock_level || 'Unlimited'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Reorder Point</p>
            <p className="font-medium">{item.reorder_point || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Reorder Quantity</p>
            <p className="font-medium">{item.reorder_quantity || 0}</p>
          </div>
        </CardContent>
      </Card>

      {/* Additional Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Additional Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-sm">{item.description || 'No description available'}</p>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Barcode</p>
              <p className="font-medium font-mono">{item.barcode || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Internal Code</p>
              <p className="font-medium">{item.internal_code || 'N/A'}</p>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Created Date</p>
              <p className="font-medium">
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium">
                {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
          
          {/* Custom Attributes */}
          {item.attributes && Object.keys(item.attributes).length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Custom Attributes</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(item.attributes).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1">
                      <span className="text-sm text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-sm font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}