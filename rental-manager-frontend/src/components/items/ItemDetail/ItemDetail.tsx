'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Package, 
  Warehouse, 
  Edit,
  Tag,
  Barcode,
  Ruler,
  Weight,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Grid3X3,
  Palette,
  Layers,
  Hash,
  QrCode,
  Clock,
  Shield,
  TrendingUp,
  RefreshCw,
  ShoppingCart,
  Store,
  Home
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Item } from '@/types/item';

interface ItemDetailProps {
  item: Item;
  onEdit?: (item: Item) => void;
  onRent?: (item: Item) => void;
  onUpdateStock?: (item: Item) => void;
  className?: string;
}

export function ItemDetail({ 
  item, 
  onEdit, 
  onRent,
  onUpdateStock,
  className 
}: ItemDetailProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStockStatus = () => {
    const stockQuantity = (item as any).available_units ?? item.initial_stock_quantity ?? 0;
    if (stockQuantity === 0) {
      return { 
        label: 'Out of Stock', 
        variant: 'destructive' as const, 
        icon: AlertTriangle,
        color: 'text-red-600'
      };
    }
    if (item.reorder_point && stockQuantity <= item.reorder_point) {
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

  const DetailRow = ({ 
    icon: Icon, 
    label, 
    value, 
    valueClassName 
  }: { 
    icon: React.ComponentType<any>; 
    label: string; 
    value: React.ReactNode;
    valueClassName?: string;
  }) => (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className={cn('text-sm font-medium', valueClassName)}>
        {value}
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 text-slate-600" />
                <div>
                  <h1 className="text-2xl font-bold">{item.item_name}</h1>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Barcode className="h-4 w-4" />
                    <span className="font-mono">{item.sku}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={item.item_status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {item.item_status || 'Unknown'}
                </Badge>
                {item.serial_number_required && (
                  <Badge variant="outline">
                    <Tag className="h-3 w-3 mr-1" />
                    Serial Required
                  </Badge>
                )}
                <Badge variant={stockStatus.variant}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {stockStatus.label}
                </Badge>
                {item.is_rentable && !item.is_saleable && (
                  <Badge variant="default">
                    <Home className="h-3 w-3 mr-1" />
                    Rental Only
                  </Badge>
                )}
                {item.is_saleable && !item.is_rentable && (
                  <Badge variant="secondary">
                    <Store className="h-3 w-3 mr-1" />
                    Sale Only
                  </Badge>
                )}
                {item.is_rentable && item.is_saleable && (
                  <Badge variant="outline">
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    Rental & Sale
                  </Badge>
                )}
                {!item.is_rentable && !item.is_saleable && (
                  <Badge variant="outline">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Unavailable
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {onRent && ((item as any).available_units ?? item.initial_stock_quantity ?? 0) > 0 && item.is_rentable && (
                <Button onClick={() => onRent(item)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rent Item
                </Button>
              )}

            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <DetailRow 
              icon={Grid3X3} 
              label="Category" 
              value={item.category?.name || 'Uncategorized'} 
            />
            <DetailRow 
              icon={Tag} 
              label="Brand" 
              value={item.brand?.name || 'No brand'} 
            />
            <DetailRow 
              icon={Ruler} 
              label="Unit of Measurement" 
              value={item.unit_of_measurement?.name || 'Not specified'}
            />
            {item.description && (
              <>
                <Separator className="my-2" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm">{item.description}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pricing & Rental Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pricing & Rental Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <DetailRow 
              icon={ShoppingCart} 
              label="Purchase Price" 
              value={item.purchase_price ? formatCurrency(item.purchase_price) : 'Not set'}
              valueClassName="text-slate-600"
            />
            <DetailRow 
              icon={Package} 
              label="Daily Rental" 
              value={item.rental_rate_per_period ? formatCurrency(item.rental_rate_per_period) : 'Not set'}
              valueClassName="text-green-600 font-semibold"
            />
            <DetailRow 
              icon={Clock} 
              label="Rental Period" 
              value={`${item.rental_period || 1} days`}
            />
            {item.security_deposit && item.security_deposit > 0 && (
              <DetailRow 
                icon={Shield} 
                label="Security Deposit" 
                value={formatCurrency(item.security_deposit)}
                valueClassName="text-orange-600"
              />
            )}
            {item.warranty_period_days && parseInt(item.warranty_period_days.toString()) > 0 && (
              <DetailRow 
                icon={Shield} 
                label="Warranty Period" 
                value={`${item.warranty_period_days} days`}
                valueClassName="text-blue-600"
              />
            )}
          </CardContent>
        </Card>

        {/* Availability Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Availability Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Product Mode: {' '}
                <Badge variant={item.is_rentable && !item.is_saleable ? 'default' : item.is_saleable && !item.is_rentable ? 'secondary' : 'outline'}>
                  {item.is_rentable && !item.is_saleable ? 'Rental Only' : 
                   item.is_saleable && !item.is_rentable ? 'Sale Only' : 
                   item.is_rentable && item.is_saleable ? 'Rental & Sale' : 'Unavailable'}
                </Badge>
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.is_rentable ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm">Rentable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.is_saleable ? 'bg-slate-500' : 'bg-gray-300'}`} />
                <span className="text-sm">For Sale</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Details */}
        {(item.model_number || item.specifications) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Technical Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {item.model_number && (
                <DetailRow 
                  icon={Tag} 
                  label="Model Number" 
                  value={item.model_number}
                />
              )}
              {item.specifications && (
                <>
                  <Separator className="my-2" />
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Specifications</p>
                    <p className="text-sm">{item.specifications}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Inventory Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Inventory Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <DetailRow 
              icon={Warehouse} 
              label="Total Stock" 
              value={(item as any).total_units ?? item.initial_stock_quantity ?? 0}
              valueClassName="font-semibold"
            />
            <DetailRow 
              icon={CheckCircle} 
              label="Available" 
              value={(item as any).available_units ?? item.initial_stock_quantity ?? 0}
              valueClassName={stockStatus.color}
            />
            <DetailRow 
              icon={Clock} 
              label="Reserved" 
              value={((item as any).total_units ?? 0) - ((item as any).available_units ?? 0)}
              valueClassName="text-orange-600"
            />
            {item.reorder_point && (
              <DetailRow 
                icon={TrendingUp} 
                label="Reorder Point" 
                value={item.reorder_point}
              />
            )}
            
            {onUpdateStock && (
              <>
                <Separator className="my-3" />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onUpdateStock(item)}
                  className="w-full"
                >
                  <Warehouse className="h-4 w-4 mr-2" />
                  Update Stock
                </Button>
              </>
            )}
          </CardContent>
        </Card>



        {/* Activity History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Activity History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailRow 
                icon={Calendar} 
                label="Created" 
                value={formatDate(item.created_at)}
              />
              <DetailRow 
                icon={Calendar} 
                label="Last Updated" 
                value={formatDate(item.updated_at)}
              />
              {item.purchase_price && (
                <DetailRow 
                  icon={ShoppingCart} 
                  label="Purchase Price" 
                  value={formatCurrency(item.purchase_price)}
                />
              )}
              {item.sale_price && (
                <DetailRow 
                  icon={Store} 
                  label="Sale Price" 
                  value={formatCurrency(item.sale_price)}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}