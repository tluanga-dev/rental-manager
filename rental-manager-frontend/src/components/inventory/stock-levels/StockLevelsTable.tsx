'use client';

import React from 'react';
import { StockLevel } from '@/services/api/stock-levels';
import { 
  ChevronUp, 
  ChevronDown, 
  Package, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Minus,
  ArrowUpDown,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StockLevelsTableProps {
  stockLevels: StockLevel[];
  sortConfig: {
    field: string;
    order: 'asc' | 'desc';
  };
  onSort: (field: string) => void;
  onAdjustStock: (stockLevel: StockLevel) => void;
  onTransferStock: (stockLevel: StockLevel) => void;
  isLoading: boolean;
}

interface SortableColumnHeaderProps {
  field: string;
  label: string;
  sortConfig: { field: string; order: 'asc' | 'desc' };
  onSort: (field: string) => void;
  align?: 'left' | 'center' | 'right';
}

function SortableColumnHeader({ field, label, sortConfig, onSort, align = 'left' }: SortableColumnHeaderProps) {
  const isSorted = sortConfig.field === field;
  const sortOrder = isSorted ? sortConfig.order : null;

  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end'
  };

  return (
    <button
      className={`flex items-center gap-2 font-medium text-gray-900 hover:text-gray-700 ${alignmentClasses[align]}`}
      onClick={() => onSort(field)}
    >
      {label}
      <div className="flex flex-col">
        <ChevronUp 
          className={`h-3 w-3 ${
            sortOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'
          }`} 
        />
        <ChevronDown 
          className={`h-3 w-3 -mt-1 ${
            sortOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'
          }`} 
        />
      </div>
    </button>
  );
}

function getStockStatusIcon(status: string) {
  switch (status) {
    case 'IN_STOCK':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'LOW_STOCK':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'OUT_OF_STOCK':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-gray-500" />;
  }
}

function getStockStatusColor(status: string) {
  switch (status) {
    case 'IN_STOCK':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'LOW_STOCK':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'OUT_OF_STOCK':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export function StockLevelsTable({
  stockLevels,
  sortConfig,
  onSort,
  onAdjustStock,
  onTransferStock,
  isLoading
}: StockLevelsTableProps) {

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-8 gap-4">
                <div className="h-4 bg-gray-200 rounded col-span-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stockLevels.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 bg-gray-100 rounded-full">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">No Stock Levels Found</h3>
            <p className="text-gray-600">
              No stock levels match the current filters. Try adjusting your search criteria.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="px-4 py-3 text-left">
              <SortableColumnHeader
                field="item_name"
                label="Item"
                sortConfig={sortConfig}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3 text-left">
              <SortableColumnHeader
                field="location_name"
                label="Location"
                sortConfig={sortConfig}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3 text-center">
              <SortableColumnHeader
                field="quantity_on_hand"
                label="On Hand"
                sortConfig={sortConfig}
                onSort={onSort}
                align="center"
              />
            </th>
            <th className="px-4 py-3 text-center">
              <SortableColumnHeader
                field="quantity_available"
                label="Available"
                sortConfig={sortConfig}
                onSort={onSort}
                align="center"
              />
            </th>
            <th className="px-4 py-3 text-center">
              <SortableColumnHeader
                field="quantity_reserved"
                label="Reserved"
                sortConfig={sortConfig}
                onSort={onSort}
                align="center"
              />
            </th>
            <th className="px-4 py-3 text-center">
              <SortableColumnHeader
                field="quantity_on_rent"
                label="On Rent"
                sortConfig={sortConfig}
                onSort={onSort}
                align="center"
              />
            </th>
            <th className="px-4 py-3 text-center">
              <SortableColumnHeader
                field="stock_status"
                label="Status"
                sortConfig={sortConfig}
                onSort={onSort}
                align="center"
              />
            </th>
            <th className="px-4 py-3 text-right">
              <SortableColumnHeader
                field="total_value"
                label="Value"
                sortConfig={sortConfig}
                onSort={onSort}
                align="right"
              />
            </th>
            <th className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {stockLevels.map((stockLevel, index) => (
            <tr key={`${stockLevel.item_id}-${stockLevel.location_id}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3">
                <div>
                  <div className="font-medium text-gray-900">{stockLevel.item_name}</div>
                  <div className="text-sm text-gray-600">
                    SKU: {stockLevel.item_sku}
                    {stockLevel.category && (
                      <span className="ml-2">• {stockLevel.category.name}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-gray-900">{stockLevel.location_name}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-medium">{stockLevel.quantity_on_hand}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-green-600 font-medium">{stockLevel.quantity_available}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-yellow-600">{stockLevel.quantity_reserved}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-blue-600">{stockLevel.quantity_on_rent}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  {getStockStatusIcon(stockLevel.stock_status)}
                  <Badge variant="outline" className={getStockStatusColor(stockLevel.stock_status)}>
                    {stockLevel.stock_status.replace('_', ' ')}
                  </Badge>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-medium">
                  ${stockLevel.total_value?.toLocaleString() || '0.00'}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Button
                    onClick={() => onAdjustStock(stockLevel)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => onTransferStock(stockLevel)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}