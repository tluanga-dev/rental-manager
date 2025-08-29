'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Search, 
  MapPin, 
  Package,
  AlertCircle 
} from 'lucide-react';
import { RentalStatusToggle } from '@/components/rental-blocking/RentalStatusToggle';
import { useRentalBlocking } from '@/hooks/useRentalBlocking';
import { cn } from '@/lib/utils';
import { formatCurrencySync } from '@/lib/currency-utils';
import type { InventoryUnitDetail, InventoryUnitStatus, ConditionGrade, InventoryItemDetail } from '@/types/inventory-items';

interface UnitsTableProps {
  units: InventoryUnitDetail[];
  isLoading?: boolean;
  itemName?: string; // Item name for rental blocking context
  item?: InventoryItemDetail; // Full item data for stock information
}

const UNIT_STATUS_CONFIG: Record<InventoryUnitStatus, {
  label: string;
  className: string;
  icon?: React.ComponentType<{ className?: string }>;
}> = {
  AVAILABLE: {
    label: 'Available',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  RESERVED: {
    label: 'Reserved',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  RENTED: {
    label: 'Rented',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  IN_TRANSIT: {
    label: 'In Transit',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  INSPECTION: {
    label: 'Inspection',
    className: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },
  DAMAGED: {
    label: 'Damaged',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertCircle,
  },
  LOST: {
    label: 'Lost',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  SOLD: {
    label: 'Sold',
    className: 'bg-slate-100 text-slate-800 border-slate-200',
  },
};

const CONDITION_CONFIG: Record<ConditionGrade, {
  label: string;
  className: string;
}> = {
  A: {
    label: 'Grade A',
    className: 'bg-green-100 text-green-800',
  },
  B: {
    label: 'Grade B',
    className: 'bg-blue-100 text-blue-800',
  },
  C: {
    label: 'Grade C',
    className: 'bg-yellow-100 text-yellow-800',
  },
  D: {
    label: 'Grade D',
    className: 'bg-red-100 text-red-800',
  },
};

export function UnitsTable({ units, isLoading, itemName, item }: UnitsTableProps) {
  const router = useRouter();
  const { toggleEntityStatus } = useRentalBlocking();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  // Debug logging
  console.log('🔍 UnitsTable received units:', units?.length || 0);
  console.log('🔍 Units is array?', Array.isArray(units));
  console.log('🔍 Units value:', units);
  if (units && units.length > 0) {
    console.log('🔍 First unit sample:', JSON.stringify(units[0], null, 2));
    console.log('🔍 First unit has unit_identifier?', 'unit_identifier' in units[0]);
    console.log('🔍 First unit has location_name?', 'location_name' in units[0]);
  }

  // Get unique locations for filter
  const locations = Array.from(new Set(units.map(u => u.location_name).filter(Boolean)));

  // Filter units
  const filteredUnits = units.filter(unit => {
    const matchesSearch = !searchTerm || 
      (unit.unit_identifier && unit.unit_identifier.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (unit.serial_number && unit.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || unit.status === statusFilter;
    const matchesLocation = locationFilter === 'all' || unit.location_name === locationFilter;
    
    return matchesSearch && matchesStatus && matchesLocation;
  });
  
  console.log('🔍 Filtered units:', filteredUnits.length);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by unit ID or serial number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(UNIT_STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(location => (
              <SelectItem key={location} value={location}>
                {location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredUnits.length} of {units.length} units
        </span>
        <div className="flex gap-4">
          <span>Available: {units.filter(u => u.status === 'AVAILABLE').length}</span>
          <span>Rented: {units.filter(u => u.status === 'RENTED').length}</span>
          <span>Other: {units.filter(u => u.status !== 'AVAILABLE' && u.status !== 'RENTED').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit ID</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead>Rental Status</TableHead>
              <TableHead>Acquisition</TableHead>
              <TableHead>Last Movement</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUnits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  {item && item.stock_summary && item.stock_summary.total > 0 ? (
                    <div className="space-y-3">
                      <p className="text-muted-foreground">This is a non-serialized item (bulk tracking)</p>
                      <div className="bg-muted/50 rounded-lg p-4 mx-auto max-w-md">
                        <h4 className="font-medium text-sm mb-3">Stock Summary</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Stock:</span>
                            <span className="font-medium">{item.stock_summary.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Available:</span>
                            <span className="font-medium text-green-600">{item.stock_summary.available}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">On Rent:</span>
                            <span className="font-medium text-blue-600">{item.stock_summary.rented}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Reserved:</span>
                            <span className="font-medium text-purple-600">{item.stock_summary.reserved}</span>
                          </div>
                        </div>
                        {item.location_breakdown && item.location_breakdown.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <h5 className="font-medium text-xs mb-2">By Location:</h5>
                            <div className="space-y-1">
                              {item.location_breakdown.map((loc) => (
                                <div key={loc.location_id} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">{loc.location_name}:</span>
                                  <span className="font-medium">{loc.total_units}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Individual units are not tracked for this item. Only aggregate stock levels are maintained.
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No units found</p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredUnits.map((unit) => {
                // Handle string status/condition from backend with fallback
                const statusConfig = UNIT_STATUS_CONFIG[unit.status as InventoryUnitStatus] || {
                  label: unit.status,
                  className: 'bg-gray-100 text-gray-800 border-gray-200',
                };
                const conditionConfig = CONDITION_CONFIG[unit.condition as ConditionGrade] || {
                  label: unit.condition,
                  className: 'bg-gray-100 text-gray-800',
                };
                const StatusIcon = statusConfig.icon;
                
                return (
                  <TableRow 
                    key={unit.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      // Navigate to unit detail page using SKU-based URL structure
                      const itemSku = item?.sku || item?.item?.sku;
                      if (itemSku) {
                        router.push(`/inventory/items/${itemSku}/units/${unit.id}`);
                      } else {
                        // Fallback to old structure if SKU not available
                        const queryParams = new URLSearchParams();
                        if (item?.id) queryParams.set('itemId', item.id.toString());
                        if (item?.name) queryParams.set('itemName', item.name);
                        const queryString = queryParams.toString();
                        router.push(`/inventory/units/${unit.id}${queryString ? `?${queryString}` : ''}`);
                      }
                    }}
                  >
                    <TableCell className="font-medium">
                      {unit.unit_identifier}
                    </TableCell>
                    <TableCell>
                      {unit.serial_number || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {unit.location_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'flex items-center gap-1 w-fit',
                          statusConfig.className
                        )}
                      >
                        {StatusIcon && <StatusIcon className="h-3 w-3" />}
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('text-xs', conditionConfig.className)}
                      >
                        {conditionConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RentalStatusToggle
                        entityId={unit.id}
                        entityType="INVENTORY_UNIT"
                        entityName={`${itemName || 'Unit'} - ${unit.unit_identifier}`}
                        currentStatus={unit.is_rental_blocked || false}
                        currentReason={unit.rental_block_reason}
                        onStatusChange={async (blocked, remarks) => {
                          await toggleEntityStatus('INVENTORY_UNIT', unit.id, blocked, remarks);
                        }}
                        size="sm"
                        disabled={unit.item_is_rental_blocked}
                        overrideReason={unit.item_is_rental_blocked ? `Item blocked: ${unit.item_rental_block_reason}` : undefined}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{new Date(unit.acquisition_date).toLocaleDateString()}</div>
                        {unit.acquisition_cost && (
                          <div className="text-xs text-muted-foreground">
                            {formatCurrencySync(unit.acquisition_cost)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {unit.last_movement 
                        ? new Date(unit.last_movement).toLocaleDateString()
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                        {unit.notes || '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}