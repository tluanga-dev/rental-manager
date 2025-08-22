'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Eye, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { cn } from '@/lib/utils';
import type { 
  InventoryItemSummary, 
  InventoryItemsSortConfig,
  StockStatus 
} from '@/types/inventory-items';

interface InventoryItemsTableProps {
  items: InventoryItemSummary[];
  sortConfig: InventoryItemsSortConfig;
  onSort: (field: InventoryItemsSortConfig['field']) => void;
  isLoading?: boolean;
}

const STOCK_STATUS_CONFIG = {
  IN_STOCK: {
    label: 'In Stock',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  LOW_STOCK: {
    label: 'Low Stock',
    icon: AlertTriangle,
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  OUT_OF_STOCK: {
    label: 'Out of Stock',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 border-red-200',
  },
};

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

export function InventoryItemsTable({
  items,
  sortConfig,
  onSort,
  isLoading
}: InventoryItemsTableProps) {
  const router = useRouter();

  const renderSortIcon = (field: InventoryItemsSortConfig['field']) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.order === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  const handleViewDetails = (itemId: string) => {
    router.push(`/inventory/items/${itemId}`);
  };

  const getStockPercentage = (item: InventoryItemSummary) => {
    const { total, available } = item.stock_summary;
    if (total === 0) return 0;
    return (available / total) * 100;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-muted-foreground">No inventory items found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try adjusting your filters or search criteria
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex items-center gap-1"
                onClick={() => onSort('sku')}
              >
                SKU
                {renderSortIcon('sku')}
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex items-center gap-1"
                onClick={() => onSort('item_name')}
              >
                Product Name
                {renderSortIcon('item_name')}
              </Button>
            </TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead className="text-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex items-center gap-1"
                onClick={() => onSort('stock_summary.total')}
              >
                Total Stock
                {renderSortIcon('stock_summary.total')}
              </Button>
            </TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex items-center gap-1"
                onClick={() => onSort('total_value')}
              >
                Value
                {renderSortIcon('total_value')}
              </Button>
            </TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const stockConfig = STOCK_STATUS_CONFIG[item.stock_summary.stock_status as StockStatus];
            const StockIcon = stockConfig?.icon || Package;
            const itemStatusConfig = ITEM_STATUS_CONFIG[item.item_status as keyof typeof ITEM_STATUS_CONFIG];
            const stockPercentage = getStockPercentage(item);

            return (
              <TableRow key={item.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">{item.sku}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{item.item_name}</span>
                    <div className="flex gap-2 mt-1">
                      {item.is_rentable && (
                        <Badge variant="outline" className="text-xs">
                          Rentable
                        </Badge>
                      )}
                      {item.is_saleable && (
                        <Badge variant="outline" className="text-xs">
                          Saleable
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{item.category.name}</TableCell>
                <TableCell>{item.brand.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-center space-y-1">
                    <span className="font-medium">{item.stock_summary.total}</span>
                    <Progress 
                      value={stockPercentage} 
                      className="w-20 h-2"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{item.stock_summary.available}</span>
                    {item.stock_summary.reserved > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {item.stock_summary.reserved} reserved
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge 
                      variant="outline"
                      className={cn(
                        'flex items-center gap-1 w-fit',
                        stockConfig?.className
                      )}
                    >
                      <StockIcon className="h-3 w-3" />
                      {stockConfig?.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs w-fit',
                        itemStatusConfig?.className
                      )}
                    >
                      {itemStatusConfig?.label}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {item.total_value === 0 ? (
                        <span className="text-muted-foreground" title="No pricing data available">
                          {formatCurrencySync(0)}
                        </span>
                      ) : (
                        formatCurrencySync(item.total_value)
                      )}
                    </span>
                    {item.sale_price && (
                      <span className="text-xs text-muted-foreground">
                        @ {formatCurrencySync(item.sale_price)}
                      </span>
                    )}
                    {item.total_value === 0 && (
                      <span className="text-xs text-orange-600">
                        No price set
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(item.id)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}