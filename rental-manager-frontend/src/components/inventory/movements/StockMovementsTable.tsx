'use client';

import React from 'react';
import { StockMovement } from '@/services/api/stock-movements';
import { 
  ChevronUp, 
  ChevronDown, 
  TrendingUp,
  TrendingDown,
  Package,
  RotateCcw,
  Wrench,
  AlertTriangle,
  User,
  MapPin,
  Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StockMovementsTableProps {
  movements: StockMovement[];
  sortConfig: {
    field: string;
    order: 'asc' | 'desc';
  };
  onSort: (field: string) => void;
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

function getMovementTypeIcon(type: string) {
  switch (type) {
    case 'PURCHASE':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'SALE':
      return <TrendingDown className="h-4 w-4 text-blue-500" />;
    case 'RENTAL_OUT':
      return <Package className="h-4 w-4 text-orange-500" />;
    case 'RENTAL_RETURN':
      return <RotateCcw className="h-4 w-4 text-purple-500" />;
    case 'TRANSFER':
      return <RotateCcw className="h-4 w-4 text-cyan-500" />;
    case 'ADJUSTMENT':
      return <Package className="h-4 w-4 text-yellow-500" />;
    case 'DAMAGE':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'REPAIR':
      return <Wrench className="h-4 w-4 text-green-500" />;
    case 'WRITE_OFF':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    default:
      return <Package className="h-4 w-4 text-gray-500" />;
  }
}

function getMovementTypeColor(type: string) {
  switch (type) {
    case 'PURCHASE':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'SALE':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'RENTAL_OUT':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'RENTAL_RETURN':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'TRANSFER':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'ADJUSTMENT':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'DAMAGE':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'REPAIR':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'WRITE_OFF':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

function formatMovementType(type: string) {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

function isInbound(type: string) {
  return ['PURCHASE', 'RENTAL_RETURN', 'TRANSFER', 'REPAIR'].includes(type) ||
         (type === 'ADJUSTMENT' && true); // Need to check quantity sign for adjustments
}

export function StockMovementsTable({ movements, sortConfig, onSort, isLoading }: StockMovementsTableProps) {

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="grid grid-cols-7 gap-4">
                <div className="h-4 bg-gray-200 rounded"></div>
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

  if (movements.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 bg-gray-100 rounded-full">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">No Stock Movements Found</h3>
            <p className="text-gray-600">
              No stock movements match the current filters. Try adjusting your search criteria.
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
                field="created_at"
                label="Date"
                sortConfig={sortConfig}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3 text-left">
              <SortableColumnHeader
                field="movement_type"
                label="Type"
                sortConfig={sortConfig}
                onSort={onSort}
              />
            </th>
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
                field="quantity"
                label="Quantity"
                sortConfig={sortConfig}
                onSort={onSort}
                align="center"
              />
            </th>
            <th className="px-4 py-3 text-right">
              <SortableColumnHeader
                field="total_cost"
                label="Value"
                sortConfig={sortConfig}
                onSort={onSort}
                align="right"
              />
            </th>
            <th className="px-4 py-3 text-left">
              <SortableColumnHeader
                field="created_by_name"
                label="User"
                sortConfig={sortConfig}
                onSort={onSort}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement, index) => {
            const isInboundMovement = isInbound(movement.movement_type);
            const quantityColor = movement.quantity > 0 ? 
              (isInboundMovement ? 'text-green-600' : 'text-red-600') : 
              'text-gray-600';

            return (
              <tr key={movement.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(movement.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(movement.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getMovementTypeIcon(movement.movement_type)}
                    <Badge variant="outline" className={getMovementTypeColor(movement.movement_type)}>
                      {formatMovementType(movement.movement_type)}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium text-gray-900">
                      {movement.item_name || 'Unknown Item'}
                    </div>
                    {movement.item_sku && (
                      <div className="text-sm text-gray-500">SKU: {movement.item_sku}</div>
                    )}
                    {movement.reference_number && (
                      <div className="text-xs text-gray-400">Ref: {movement.reference_number}</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-900">
                      {movement.location_name || 'Unknown Location'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${quantityColor}`}>
                    {isInboundMovement ? '+' : '-'}{Math.abs(movement.quantity)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {movement.total_cost !== undefined && movement.total_cost !== null ? (
                    <span className="font-medium">
                      ${movement.total_cost.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-gray-400" />
                    <span className="text-sm text-gray-700">
                      {movement.created_by_name || 'System'}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Additional Notes Section */}
      {movements.some(m => m.notes) && (
        <div className="border-t p-4 bg-gray-50">
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
              View Movement Notes
            </summary>
            <div className="mt-3 space-y-2">
              {movements.filter(m => m.notes).map((movement) => (
                <div key={movement.id} className="flex gap-3 p-2 bg-white rounded border">
                  <div className="flex-shrink-0">
                    {getMovementTypeIcon(movement.movement_type)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-xs text-gray-600">
                      {movement.item_name} - {formatMovementType(movement.movement_type)}
                    </div>
                    <div className="text-gray-800">{movement.notes}</div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}