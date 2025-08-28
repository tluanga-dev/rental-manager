'use client';

import React, { useState } from 'react';
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
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Boxes
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrencySync } from '@/lib/currency-utils';
import type { 
  AllInventoryLocation, 
  InventoryUnitDetail, 
  InventoryUnitStatus, 
  ConditionGrade,
  BulkStockInfo
} from '@/types/inventory-items';

interface AllInventoryTableProps {
  locations: AllInventoryLocation[];
  isLoading?: boolean;
  itemName?: string;
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

interface BulkStockRowProps {
  location: AllInventoryLocation;
}

function BulkStockRow({ location }: BulkStockRowProps) {
  const { bulk_stock } = location;
  
  if (bulk_stock.total_quantity === 0) return null;
  
  return (
    <TableRow className="bg-blue-50/50">
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-blue-600" />
          <span className="text-blue-700">Bulk Stock</span>
        </div>
      </TableCell>
      <TableCell>-</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          {location.location_name}
        </div>
      </TableCell>
      <TableCell>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Available: {bulk_stock.available}
          </Badge>
          <Badge variant="outline" className="bg-blue-100 text-blue-800">
            Rented: {bulk_stock.rented}
          </Badge>
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
            Maintenance: {bulk_stock.in_maintenance}
          </Badge>
          <Badge variant="outline" className="bg-red-100 text-red-800">
            Damaged: {bulk_stock.damaged}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="bg-gray-100 text-gray-800">
          Bulk Item
        </Badge>
      </TableCell>
      <TableCell>-</TableCell>
      <TableCell>
        <div className="text-sm">
          <div>Total: {bulk_stock.total_quantity}</div>
        </div>
      </TableCell>
      <TableCell>-</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        Non-serialized inventory
      </TableCell>
    </TableRow>
  );
}

export function AllInventoryTable({ locations, isLoading, itemName }: AllInventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  // Auto-expand all locations by default for better visibility
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(
    new Set(locations.map(loc => loc.location_id))
  );

  // Update expanded locations when locations change
  React.useEffect(() => {
    setExpandedLocations(new Set(locations.map(loc => loc.location_id)));
  }, [locations]);

  // Get all serialized units for filtering
  const allUnits = locations.flatMap(loc => 
    loc.serialized_units.map(unit => ({ ...unit, locationName: loc.location_name }))
  );

  // Get unique locations for filter
  const locationNames = Array.from(new Set(locations.map(l => l.location_name)));

  // Filter units
  const filteredUnits = allUnits.filter(unit => {
    const matchesSearch = !searchTerm || 
      unit.unit_identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (unit.serial_number && unit.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || unit.status === statusFilter;
    const matchesLocation = locationFilter === 'all' || unit.locationName === locationFilter;
    
    return matchesSearch && matchesStatus && matchesLocation;
  });

  // Group filtered units by location
  const groupedUnits = filteredUnits.reduce((acc, unit) => {
    const locationName = unit.locationName;
    if (!acc[locationName]) {
      acc[locationName] = [];
    }
    acc[locationName].push(unit);
    return acc;
  }, {} as Record<string, typeof filteredUnits>);

  // Calculate totals
  const totalSerializedUnits = allUnits.length;
  const totalBulkQuantity = locations.reduce((sum, loc) => sum + loc.bulk_stock.total_quantity, 0);
  const availableUnits = allUnits.filter(u => u.status === 'AVAILABLE').length;
  const rentedUnits = allUnits.filter(u => u.status === 'RENTED').length;

  const toggleLocation = (locationId: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedLocations(newExpanded);
  };

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
            {locationNames.map(location => (
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
          Showing {filteredUnits.length} serialized units + {totalBulkQuantity} bulk quantity across {locations.length} locations
        </span>
        <div className="flex gap-4">
          <span>Serialized Available: {availableUnits}</span>
          <span>Serialized Rented: {rentedUnits}</span>
          <span>Bulk Total: {totalBulkQuantity}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit ID / Type</TableHead>
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
            {locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No inventory found</p>
                </TableCell>
              </TableRow>
            ) : (
              locations.map((location) => {
                const isExpanded = expandedLocations.has(location.location_id);
                const locationUnits = groupedUnits[location.location_name] || [];
                const hasSerializedUnits = (location.serialized_units?.length || 0) > 0;
                const hasBulkStock = (location.bulk_stock?.total_quantity || 0) > 0;
                
                if (!hasSerializedUnits && !hasBulkStock) return null;
                
                return (
                  <React.Fragment key={location.location_id}>
                    {/* Location Header Row */}
                    <TableRow className="bg-gray-50 border-b-2">
                      <TableCell colSpan={9}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleLocation(location.location_id)}
                          className="flex items-center gap-2 w-full justify-start p-0 h-auto font-medium"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <MapPin className="h-4 w-4" />
                          {location.location_name}
                          <span className="text-muted-foreground text-sm ml-2">
                            ({location.serialized_units?.length || 0} units, {location.bulk_stock?.total_quantity || 0} bulk)
                          </span>
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {/* Location Content */}
                    {isExpanded && (
                      <>
                        {/* Bulk Stock Row */}
                        <BulkStockRow location={location} />
                        
                        {/* Serialized Units */}
                        {locationUnits.map((unit) => {
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
                            <TableRow key={unit.id}>
                              <TableCell className="font-medium pl-8">
                                {unit.unit_identifier}
                              </TableCell>
                              <TableCell>
                                {unit.serial_number || '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  {location.location_name}
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
                                {/* Rental blocking toggle would go here */}
                                <Badge variant="outline" className="text-xs">
                                  Available
                                </Badge>
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
                        })}
                      </>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}