'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Search, 
  Package, 
  MapPin, 
  AlertCircle,
  Eye,
  RefreshCw
} from 'lucide-react';
import { inventoryUnitsApi } from '@/services/api/inventory-units';
import { cn } from '@/lib/utils';
import type { InventoryUnitStatus, ConditionGrade } from '@/types/inventory-items';

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

export default function InventoryUnitsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  // Fetch all units
  const {
    data: units = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['all-inventory-units'],
    queryFn: async () => {
      // This endpoint would need to be implemented in the backend
      // For now, return empty array to avoid errors
      return [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Get unique locations for filter
  const locations = Array.from(new Set(units.map((u: any) => u.location_name).filter(Boolean)));

  // Filter units
  const filteredUnits = units.filter((unit: any) => {
    const matchesSearch = !searchTerm || 
      (unit.unit_identifier && unit.unit_identifier.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (unit.serial_number && unit.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (unit.item_name && unit.item_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (unit.item_sku && unit.item_sku.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || unit.status === statusFilter;
    const matchesLocation = locationFilter === 'all' || unit.location_name === locationFilter;
    
    return matchesSearch && matchesStatus && matchesLocation;
  });

  const handleViewUnit = (unit: any) => {
    if (unit.item_sku) {
      router.push(`/inventory/items/${unit.item_sku}/units/${unit.id}`);
    } else {
      router.push(`/inventory/units/${unit.id}`);
    }
  };

  const handleViewItem = (unit: any) => {
    if (unit.item_sku) {
      router.push(`/inventory/items/${unit.item_sku}`);
    }
  };

  if (isLoading) {
    return (
      <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </AuthConnectionGuard>
    );
  }

  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">All Inventory Units</h1>
              <p className="text-sm text-gray-500 mt-1">
                View and manage all inventory units across all items
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by unit ID, serial, item name or SKU..."
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
                {locations.map((location: any) => (
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
              <span>Available: {units.filter((u: any) => u.status === 'AVAILABLE').length}</span>
              <span>Rented: {units.filter((u: any) => u.status === 'RENTED').length}</span>
              <span>Other: {units.filter((u: any) => u.status !== 'AVAILABLE' && u.status !== 'RENTED').length}</span>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit ID</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Acquisition Date</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        {searchTerm || statusFilter !== 'all' || locationFilter !== 'all' 
                          ? 'No units found matching your filters' 
                          : 'No inventory units found'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUnits.map((unit: any) => {
                    const statusConfig = UNIT_STATUS_CONFIG[unit.status as InventoryUnitStatus] || {
                      label: unit.status,
                      className: 'bg-gray-100 text-gray-800 border-gray-200',
                    };
                    const conditionConfig = unit.condition ? CONDITION_CONFIG[unit.condition as ConditionGrade] : null;
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <TableRow key={unit.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {unit.unit_identifier}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleViewItem(unit)}
                            className="text-blue-600 hover:underline"
                          >
                            {unit.item_name || '-'}
                          </button>
                        </TableCell>
                        <TableCell>
                          {unit.item_sku || '-'}
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
                          {conditionConfig ? (
                            <Badge
                              variant="outline"
                              className={cn('text-xs', conditionConfig.className)}
                            >
                              {conditionConfig.label}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {unit.acquisition_date 
                            ? new Date(unit.acquisition_date).toLocaleDateString()
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewUnit(unit)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AuthConnectionGuard>
  );
}