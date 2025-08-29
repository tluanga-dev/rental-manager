'use client';

import React from 'react';
import { InventoryAlert } from '@/services/api/inventory-alerts';
import { 
  ChevronUp, 
  ChevronDown, 
  AlertTriangle, 
  AlertCircle,
  Info,
  Clock,
  MapPin,
  Package
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AlertsTableProps {
  alerts: InventoryAlert[];
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

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'high':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'medium':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'low':
      return <Info className="h-4 w-4 text-blue-500" />;
    default:
      return <Info className="h-4 w-4 text-gray-500" />;
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'medium':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'low':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

function getAlertTypeColor(alertType: string) {
  switch (alertType) {
    case 'LOW_STOCK':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'OUT_OF_STOCK':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'MAINTENANCE_DUE':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'WARRANTY_EXPIRING':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'DAMAGE_REPORTED':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'INSPECTION_DUE':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

function formatAlertType(alertType: string) {
  return alertType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

export function AlertsTable({ alerts, sortConfig, onSort, isLoading }: AlertsTableProps) {

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded col-span-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 bg-green-100 rounded-full">
            <Package className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">No Active Alerts</h3>
            <p className="text-gray-600">
              Great! No inventory issues require attention at the moment.
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
                field="severity"
                label="Severity"
                sortConfig={sortConfig}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3 text-left">
              <SortableColumnHeader
                field="alert_type"
                label="Type"
                sortConfig={sortConfig}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3 text-left">
              <SortableColumnHeader
                field="title"
                label="Alert"
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
            <th className="px-4 py-3 text-left">
              <SortableColumnHeader
                field="created_at"
                label="Date"
                sortConfig={sortConfig}
                onSort={onSort}
              />
            </th>
            <th className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert, index) => (
            <tr key={alert.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {getSeverityIcon(alert.severity)}
                  <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={getAlertTypeColor(alert.alert_type)}>
                  {formatAlertType(alert.alert_type)}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div>
                  <div className="font-medium text-gray-900">{alert.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{alert.message}</div>
                  {alert.data && (
                    <div className="text-xs text-gray-500 mt-1">
                      {alert.data.current_stock !== undefined && (
                        <span>Stock: {alert.data.current_stock}</span>
                      )}
                      {alert.data.reorder_point !== undefined && (
                        <span className="ml-2">Reorder: {alert.data.reorder_point}</span>
                      )}
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                {alert.item_name && (
                  <div>
                    <div className="font-medium text-gray-900">{alert.item_name}</div>
                    {alert.item_sku && (
                      <div className="text-sm text-gray-500">SKU: {alert.item_sku}</div>
                    )}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                {alert.location_name && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-900">{alert.location_name}</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {new Date(alert.created_at).toLocaleDateString()}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                >
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}