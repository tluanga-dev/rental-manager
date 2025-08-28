'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  MapPin,
  Calendar,
  DollarSign,
  Wrench,
  Shield,
  User,
  FileText,
  AlertCircle,
  CheckCircle,
  Info,
  Building2,
  Hash,
  Barcode,
  Clock,
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { cn } from '@/lib/utils';
import type { InventoryUnitDetail, InventoryUnitStatus, ConditionGrade } from '@/types/inventory-items';

interface InventoryUnitDetailDialogProps {
  unit: InventoryUnitDetail | null;
  onClose: () => void;
}

const UNIT_STATUS_CONFIG: Record<InventoryUnitStatus, {
  label: string;
  className: string;
  icon?: React.ComponentType<{ className?: string }>;
}> = {
  AVAILABLE: {
    label: 'Available',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle,
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
    icon: Wrench,
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
    label: 'Grade A - Excellent',
    className: 'bg-green-100 text-green-800',
  },
  B: {
    label: 'Grade B - Good',
    className: 'bg-blue-100 text-blue-800',
  },
  C: {
    label: 'Grade C - Fair',
    className: 'bg-yellow-100 text-yellow-800',
  },
  D: {
    label: 'Grade D - Poor',
    className: 'bg-red-100 text-red-800',
  },
};

export function InventoryUnitDetailDialog({ unit, onClose }: InventoryUnitDetailDialogProps) {
  if (!unit) return null;

  const statusConfig = UNIT_STATUS_CONFIG[unit.status as InventoryUnitStatus] || {
    label: unit.status,
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  const conditionConfig = CONDITION_CONFIG[unit.condition as ConditionGrade] || {
    label: unit.condition,
    className: 'bg-gray-100 text-gray-800',
  };
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={!!unit} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Inventory Unit Details</span>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn('flex items-center gap-1', statusConfig.className)}
              >
                {StatusIcon && <StatusIcon className="h-3 w-3" />}
                {statusConfig.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn('text-xs', conditionConfig.className)}
              >
                {conditionConfig.label}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Unit Identifier (SKU)</p>
                <p className="font-medium">{unit.unit_identifier}</p>
              </div>
              {unit.serial_number && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Serial Number
                  </p>
                  <p className="font-medium font-mono">{unit.serial_number}</p>
                </div>
              )}
              {(unit as any).batch_code && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Batch Code</p>
                  <p className="font-medium">{(unit as any).batch_code}</p>
                </div>
              )}
              {(unit as any).barcode && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Barcode className="h-3 w-3" /> Barcode
                  </p>
                  <p className="font-medium font-mono">{(unit as any).barcode}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Current Location
                </p>
                <p className="font-medium">{unit.location_name}</p>
              </div>
              {(unit as any).quantity && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Quantity</p>
                  <p className="font-medium">{(unit as any).quantity}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchase & Financial Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                Purchase & Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Purchase Date
                </p>
                <p className="font-medium">{formatDate(unit.acquisition_date)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Purchase Price</p>
                <p className="font-medium text-lg">
                  {unit.acquisition_cost ? formatCurrencySync(unit.acquisition_cost) : 'N/A'}
                </p>
              </div>
              {(unit as any).supplier && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Supplier
                  </p>
                  <p className="font-medium">
                    {typeof (unit as any).supplier === 'object' 
                      ? (unit as any).supplier.name 
                      : (unit as any).supplier}
                  </p>
                </div>
              )}
              {(unit as any).sale_price && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Sale Price</p>
                  <p className="font-medium">{formatCurrencySync((unit as any).sale_price)}</p>
                </div>
              )}
              {(unit as any).rental_rate_per_period && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Rental Rate (Per Period)</p>
                  <p className="font-medium">{formatCurrencySync((unit as any).rental_rate_per_period)}</p>
                </div>
              )}
              {(unit as any).security_deposit !== undefined && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Security Deposit</p>
                  <p className="font-medium">{formatCurrencySync((unit as any).security_deposit || 0)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance & Warranty */}
          {((unit as any).warranty_expiry || (unit as any).next_maintenance_date) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  Maintenance & Warranty
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(unit as any).warranty_expiry && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Warranty Expiry</p>
                    <p className="font-medium">{formatDate((unit as any).warranty_expiry)}</p>
                  </div>
                )}
                {(unit as any).next_maintenance_date && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> Next Maintenance
                    </p>
                    <p className="font-medium">{formatDate((unit as any).next_maintenance_date)}</p>
                  </div>
                )}
                {(unit as any).last_maintenance_date && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Last Maintenance</p>
                    <p className="font-medium">{formatDate((unit as any).last_maintenance_date)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Rental Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" />
                Rental Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Rental Availability</p>
                  <Badge variant={unit.is_rental_blocked ? "destructive" : "default"}>
                    {unit.is_rental_blocked ? 'Blocked' : 'Available for Rent'}
                  </Badge>
                </div>
                {unit.is_rental_blocked && unit.rental_block_reason && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Block Reason</p>
                    <p className="font-medium text-sm">{unit.rental_block_reason}</p>
                  </div>
                )}
              </div>
              {unit.is_rental_blocked && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unit.rental_blocked_at && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Blocked Date</p>
                      <p className="font-medium">{formatDateTime(unit.rental_blocked_at)}</p>
                    </div>
                  )}
                  {unit.rental_blocked_by && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> Blocked By
                      </p>
                      <p className="font-medium">{unit.rental_blocked_by}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {unit.notes && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-md">{unit.notes}</p>
                </div>
              )}
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {unit.last_movement && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Last Movement
                    </p>
                    <p className="font-medium">{formatDate(unit.last_movement)}</p>
                  </div>
                )}
                {(unit as any).created_at && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Created Date</p>
                    <p className="font-medium">{formatDateTime((unit as any).created_at)}</p>
                  </div>
                )}
                {(unit as any).updated_at && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{formatDateTime((unit as any).updated_at)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}