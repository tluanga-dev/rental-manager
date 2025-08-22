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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Package, 
  Hash, 
  Calendar,
  DollarSign,
  MapPin,
  Shield,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrencySync } from '@/lib/currency-utils';
import { cn } from '@/lib/utils';
import type { PurchaseResponse } from '@/services/api/purchases';

interface IndividualItemTrackingTabProps {
  purchase: PurchaseResponse;
  inventoryUnits?: InventoryUnitDetail[];
  isLoading?: boolean;
}

interface InventoryUnitDetail {
  id: string;
  sku: string;
  serial_number?: string;
  batch_code?: string;
  item_name: string;
  purchase_price: number;
  purchase_date: string;
  warranty_expiry?: string;
  status: string;
  condition: string;
  location_name: string;
  notes?: string;
  tracking_type: 'INDIVIDUAL' | 'BATCH';
  quantity: number;
}

const STATUS_CONFIG = {
  AVAILABLE: { label: 'Available', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  RENTED: { label: 'On Rent', className: 'bg-blue-100 text-blue-800', icon: Clock },
  MAINTENANCE: { label: 'Maintenance', className: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
  DAMAGED: { label: 'Damaged', className: 'bg-red-100 text-red-800', icon: AlertCircle },
  SOLD: { label: 'Sold', className: 'bg-purple-100 text-purple-800', icon: DollarSign },
};

const CONDITION_CONFIG = {
  NEW: { label: 'New', className: 'bg-green-100 text-green-800' },
  EXCELLENT: { label: 'Excellent', className: 'bg-blue-100 text-blue-800' },
  GOOD: { label: 'Good', className: 'bg-yellow-100 text-yellow-800' },
  FAIR: { label: 'Fair', className: 'bg-orange-100 text-orange-800' },
  POOR: { label: 'Poor', className: 'bg-red-100 text-red-800' },
  DAMAGED: { label: 'Damaged', className: 'bg-red-100 text-red-800' },
};

export function IndividualItemTrackingTab({ 
  purchase, 
  inventoryUnits = [], 
  isLoading 
}: IndividualItemTrackingTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [trackingFilter, setTrackingFilter] = useState<string>('all');

  // Mock data for demonstration - in real implementation, this would come from the backend
  const mockInventoryUnits: InventoryUnitDetail[] = purchase.items?.flatMap(item => {
    if (item.serial_numbers && item.serial_numbers.length > 0) {
      // Individual tracking - create unit for each serial number
      return item.serial_numbers.map((serialNo, index) => ({
        id: `${item.id}-${index}`,
        sku: `${item.sku}-${String(index + 1).padStart(4, '0')}`,
        serial_number: serialNo,
        item_name: item.item_name,
        purchase_price: item.unit_cost,
        purchase_date: purchase.purchase_date,
        warranty_expiry: item.warranty_period_days ? 
          new Date(Date.now() + item.warranty_period_days * 24 * 60 * 60 * 1000).toISOString() : 
          undefined,
        status: 'AVAILABLE',
        condition: 'NEW',
        location_name: purchase.location?.name || 'Unknown',
        notes: item.notes,
        tracking_type: 'INDIVIDUAL' as const,
        quantity: 1,
      }));
    } else {
      // Batch tracking - single unit for entire quantity
      return [{
        id: `${item.id}-batch`,
        sku: `${item.sku}-BATCH-001`,
        batch_code: `BATCH-${purchase.id.slice(0, 8)}-${item.id.slice(0, 6)}`,
        item_name: item.item_name,
        purchase_price: item.unit_cost,
        purchase_date: purchase.purchase_date,
        warranty_expiry: item.warranty_period_days ? 
          new Date(Date.now() + item.warranty_period_days * 24 * 60 * 60 * 1000).toISOString() : 
          undefined,
        status: 'AVAILABLE',
        condition: 'NEW',
        location_name: purchase.location?.name || 'Unknown',
        notes: item.notes,
        tracking_type: 'BATCH' as const,
        quantity: item.quantity,
      }];
    }
  }) || [];

  const units = inventoryUnits.length > 0 ? inventoryUnits : mockInventoryUnits;

  // Filter units
  const filteredUnits = units.filter(unit => {
    const matchesSearch = !searchTerm || 
      unit.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (unit.serial_number && unit.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (unit.batch_code && unit.batch_code.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || unit.status === statusFilter;
    const matchesTracking = trackingFilter === 'all' || unit.tracking_type === trackingFilter;
    
    return matchesSearch && matchesStatus && matchesTracking;
  });

  // Calculate summary stats
  const individualUnits = units.filter(u => u.tracking_type === 'INDIVIDUAL');
  const batchUnits = units.filter(u => u.tracking_type === 'BATCH');
  const totalValue = units.reduce((sum, unit) => sum + (unit.purchase_price * unit.quantity), 0);
  const totalQuantity = units.reduce((sum, unit) => sum + unit.quantity, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Units</p>
                <p className="text-2xl font-bold">{units.length}</p>
                <p className="text-xs text-muted-foreground">
                  {totalQuantity} total quantity
                </p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Individual Items</p>
                <p className="text-2xl font-bold">{individualUnits.length}</p>
                <p className="text-xs text-muted-foreground">
                  Serialized tracking
                </p>
              </div>
              <Hash className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Batch Items</p>
                <p className="text-2xl font-bold">{batchUnits.length}</p>
                <p className="text-xs text-muted-foreground">
                  Bulk tracking
                </p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrencySync(totalValue)}</p>
                <p className="text-xs text-muted-foreground">
                  Inventory valuation
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Information Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This purchase created {units.length} inventory units: {individualUnits.length} individual (serialized) items 
          and {batchUnits.length} batch records for non-serialized items. Each unit includes purchase price 
          (inclusive of tax and discounts), purchase date, and complete transaction history.
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by SKU, item name, serial number..."
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
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={trackingFilter} onValueChange={setTrackingFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by tracking" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="INDIVIDUAL">Individual (Serialized)</SelectItem>
            <SelectItem value="BATCH">Batch (Non-serialized)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Units Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Individual Item Tracking
          </CardTitle>
          <CardDescription>
            Detailed tracking for each inventory unit created from this purchase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit SKU</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Serial / Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Warranty</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No units found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUnits.map((unit) => {
                    const statusConfig = STATUS_CONFIG[unit.status as keyof typeof STATUS_CONFIG] || {
                      label: unit.status,
                      className: 'bg-gray-100 text-gray-800',
                      icon: Package,
                    };
                    const conditionConfig = CONDITION_CONFIG[unit.condition as keyof typeof CONDITION_CONFIG] || {
                      label: unit.condition,
                      className: 'bg-gray-100 text-gray-800',
                    };
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {unit.sku}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell>{unit.item_name}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={unit.tracking_type === 'INDIVIDUAL' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {unit.tracking_type === 'INDIVIDUAL' ? (
                              <>
                                <Hash className="h-3 w-3 mr-1" />
                                Individual
                              </>
                            ) : (
                              <>
                                <Package className="h-3 w-3 mr-1" />
                                Batch
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {unit.serial_number ? (
                            <code className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded">
                              {unit.serial_number}
                            </code>
                          ) : unit.batch_code ? (
                            <code className="text-xs bg-orange-50 text-orange-800 px-2 py-1 rounded">
                              {unit.batch_code}
                            </code>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'flex items-center gap-1 w-fit',
                              statusConfig.className
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
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
                        <TableCell className="text-center">
                          <span className="font-medium">{unit.quantity}</span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrencySync(unit.purchase_price)}
                          {unit.quantity > 1 && (
                            <div className="text-xs text-muted-foreground">
                              Total: {formatCurrencySync(unit.purchase_price * unit.quantity)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {unit.warranty_expiry ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Shield className="h-3 w-3 text-green-600" />
                              <span className="text-xs">
                                {new Date(unit.warranty_expiry).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">No warranty</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{unit.location_name}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}