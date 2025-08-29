'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
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
  CircleDollarSign,
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { RentalRateEditor } from '@/components/rentals/RentalRateEditor';
import { SalePriceEditor } from '@/components/sales/SalePriceEditor';
import { itemsApi } from '@/services/api/items';
import { inventoryUnitsApi } from '@/services/api/inventory';
import type { InventoryUnitDetail, InventoryItemDetail } from '@/types/inventory-items';

interface UnitDetailsTabProps {
  unit: InventoryUnitDetail;
  item?: InventoryItemDetail | null;
}

export function UnitDetailsTab({ unit, item }: UnitDetailsTabProps) {
  const { toast } = useToast();
  const [rentalPeriod, setRentalPeriod] = useState((unit as any).rental_period?.toString() || '1');
  const [securityDeposit, setSecurityDeposit] = useState((unit as any).security_deposit || '');

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

  const getRentalPeriodText = (period: string) => {
    switch (period) {
      case '1': return 'day';
      case '7': return 'week';
      case '30': return 'month';
      default: return 'period';
    }
  };

  const handleRateUpdate = async (newRate: number) => {
    console.log('UnitDetailsTab: Updating rental rate for unit:', unit.id, 'to:', newRate);
    const result = await inventoryUnitsApi.updateRentalRate(unit.id, newRate);
    console.log('UnitDetailsTab: API response:', result);
    // Update local state to reflect the change immediately
    (unit as any).rental_rate_per_period = newRate;
    // Note: Toast is handled by RentalRateEditor component
  };

  const handleSalePriceUpdate = async (newPrice: number) => {
    console.log('UnitDetailsTab: Updating sale price for unit:', unit.id, 'to:', newPrice);
    const result = await inventoryUnitsApi.updateSalePrice(unit.id, newPrice);
    console.log('UnitDetailsTab: API response:', result);
    // Update local state to reflect the change immediately
    (unit as any).sale_price = newPrice;
    // Note: Toast is handled by SalePriceEditor component
  };

  const handlePeriodChange = async (value: string) => {
    setRentalPeriod(value);
    // TODO: Call API to update rental period
    toast({
      title: 'Rental Period Updated',
      description: `Rental period set to per ${getRentalPeriodText(value)}`,
    });
  };

  const handleDepositChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSecurityDeposit(e.target.value);
  };

  const handleDepositSave = async () => {
    // TODO: Call API to update security deposit
    toast({
      title: 'Security Deposit Updated',
      description: `Security deposit set to ${formatCurrencySync(parseFloat(securityDeposit) || 0)}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant="outline">{unit.status}</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Condition</p>
            <Badge variant="outline">{unit.condition}</Badge>
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
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Sale Price</p>
            <SalePriceEditor
              currentPrice={(unit as any).sale_price || 0}
              unitId={unit.id}
              currency="₹"
              editable={true}
              showChangeButton={true}
              onPriceChange={handleSalePriceUpdate}
              placeholder="Set sale price"
              className="w-full"
            />
          </div>
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
        
        {/* Rental Pricing Section - Only show if item is rentable */}
        {(item as any)?.item?.is_rentable && (
          <>
            <Separator className="my-4" />
            <CardContent>
              <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4" />
                Rental Pricing Configuration
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Rental Rate</p>
                  <RentalRateEditor
                    currentRate={(unit as any).rental_rate_per_period || 0}
                    itemId={undefined} // Don't pass itemId to prevent internal API call
                    periodText={getRentalPeriodText(rentalPeriod)}
                    editable={true}
                    showChangeButton={true}
                    saveToMaster={false}
                    onRateChange={handleRateUpdate}
                    placeholder="Set rental rate"
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Rental Period</p>
                  <Select
                    value={rentalPeriod}
                    onValueChange={handlePeriodChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Per Day</SelectItem>
                      <SelectItem value="7">Per Week</SelectItem>
                      <SelectItem value="30">Per Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Security Deposit</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={securityDeposit}
                      onChange={handleDepositChange}
                      placeholder="Enter deposit amount"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleDepositSave}
                      variant="outline"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
              {(item as any)?.item?.rental_rate_per_period && (
                <div className="mt-3 p-2 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground">
                    ℹ️ Master rental rate: {formatCurrencySync((item as any).item.rental_rate_per_period)}/
                    {getRentalPeriodText((item as any).item.rental_period || '1')}
                  </p>
                </div>
              )}
            </CardContent>
          </>
        )}
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
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
  );
}