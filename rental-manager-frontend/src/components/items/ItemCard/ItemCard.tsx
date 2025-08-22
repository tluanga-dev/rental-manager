'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatCurrencySync, getCurrentCurrency } from '@/lib/currency-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  Warehouse, 
  Eye, 
  Edit,
  Tag,
  Barcode,
  Ruler,
  Weight,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Grid3X3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Item } from '@/types/item';

interface ItemCardProps {
  item: Item;
  onView?: (item: Item) => void;
  onEdit?: (item: Item) => void;
  onClick?: (item: Item) => void;
  className?: string;
  showActions?: boolean;
  compact?: boolean;
}

export function ItemCard({ 
  item, 
  onView, 
  onEdit, 
  onClick,
  className,
  showActions = true,
  compact = false 
}: ItemCardProps) {
  const [currencySymbol, setCurrencySymbol] = useState('₹'); // Default to INR

  // Load currency symbol
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const currency = await getCurrentCurrency();
        setCurrencySymbol(currency.symbol);
      } catch (error) {
        console.error('Failed to load currency:', error);
        setCurrencySymbol('₹'); // Keep INR as fallback
      }
    };
    loadCurrency();
  }, []);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getStockStatus = () => {
    if (item.available_quantity === 0) {
      return { 
        label: 'Out of Stock', 
        variant: 'destructive' as const, 
        icon: AlertTriangle,
        color: 'text-red-600'
      };
    }
    if (item.reorder_point && item.available_quantity <= item.reorder_point) {
      return { 
        label: 'Low Stock', 
        variant: 'secondary' as const, 
        icon: AlertTriangle,
        color: 'text-yellow-600'
      };
    }
    return { 
      label: 'In Stock', 
      variant: 'default' as const, 
      icon: CheckCircle,
      color: 'text-green-600'
    };
  };

  const stockStatus = getStockStatus();
  const StatusIcon = stockStatus.icon;

  const handleCardClick = () => {
    if (onClick) {
      onClick(item);
    }
  };

  return (
    <Card 
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        onClick && 'cursor-pointer hover:shadow-lg',
        !item.is_active && 'opacity-75',
        className
      )}
      onClick={handleCardClick}
    >
      <CardHeader className={cn('pb-3', compact && 'pb-2')}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <h3 className="font-medium text-sm truncate">{item.item_name}</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Barcode className="h-3 w-3" />
              <span className="font-mono">{item.sku}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={item.is_active ? 'default' : 'secondary'} className="text-xs">
              {item.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {item.is_serialized && (
              <Badge variant="outline" className="text-xs">
                <Tag className="h-3 w-3 mr-1" />
                Serialized
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn('space-y-3', compact && 'space-y-2')}>
        {/* Category and Brand */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Grid3X3 className="h-3 w-3 text-gray-400" />
            <span className="text-muted-foreground">Category:</span>
            <span className="font-medium truncate">
              {item.category?.name || 'Uncategorized'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Tag className="h-3 w-3 text-gray-400" />
            <span className="text-muted-foreground">Brand:</span>
            <span className="font-medium truncate">
              {item.brand?.brand_name || 'No brand'}
            </span>
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-green-600">
              {formatCurrencySync(item.rental_price_daily)}/day
            </span>
          </div>
          {!compact && (
            <div className="text-xs text-muted-foreground">
              Purchase: {formatCurrencySync(item.purchase_price)}
              {item.rental_price_weekly && (
                <span className="ml-2">
                  • Weekly: {formatCurrencySync(item.rental_price_weekly)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stock Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-gray-500" />
            <span className="text-sm">
              {item.available_quantity}/{item.stock_quantity}
            </span>
            <Badge variant={stockStatus.variant} className="text-xs">
              <StatusIcon className="h-3 w-3 mr-1" />
              {stockStatus.label}
            </Badge>
          </div>
        </div>

        {/* Physical Properties (if not compact) */}
        {!compact && (item.dimensions || item.weight) && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {item.dimensions && (
              <div className="flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                <span>
                  {item.dimensions.length && item.dimensions.width && item.dimensions.height
                    ? `${item.dimensions.length} × ${item.dimensions.width} × ${item.dimensions.height} cm`
                    : 'Dimensions available'}
                </span>
              </div>
            )}
            {item.weight && (
              <div className="flex items-center gap-1">
                <Weight className="h-3 w-3" />
                <span>{item.weight} kg</span>
              </div>
            )}
          </div>
        )}

        {/* Last Rental (if not compact) */}
        {!compact && (
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Last rental: {formatDate(item.last_rental_date)}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(item);
                }}
                className="h-8 px-3"
              >
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                className="h-8 px-3"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}