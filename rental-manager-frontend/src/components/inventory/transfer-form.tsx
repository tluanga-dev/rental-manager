'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  Package,
  ArrowRight,
  MapPin,
  Hash,
  BoxSelect,
} from 'lucide-react';
import { inventoryUnitsApi, inventoryTransfersApi } from '@/services/api/inventory';
import type { InventoryUnit } from '@/types/inventory';

// Schema for single unit transfer
const singleTransferSchema = z.object({
  unit_id: z.string().min(1, 'Unit is required'),
  to_location_id: z.string().min(1, 'Destination location is required'),
  transfer_notes: z.string().optional(),
});

// Schema for bulk transfer
const bulkTransferSchema = z.object({
  unit_ids: z.array(z.string()).min(1, 'Select at least one unit'),
  from_location_id: z.string().min(1, 'Source location is required'),
  to_location_id: z.string().min(1, 'Destination location is required'),
  transfer_notes: z.string().optional(),
});

// Schema for SKU-based transfer
const skuTransferSchema = z.object({
  sku_id: z.string().min(1, 'SKU is required'),
  from_location_id: z.string().min(1, 'Source location is required'),
  to_location_id: z.string().min(1, 'Destination location is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  transfer_notes: z.string().optional(),
});

type SingleTransferData = z.infer<typeof singleTransferSchema>;
type BulkTransferData = z.infer<typeof bulkTransferSchema>;
type SkuTransferData = z.infer<typeof skuTransferSchema>;

interface TransferFormProps {
  unit?: InventoryUnit;
  units?: InventoryUnit[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TransferForm({ unit, units = [], onSuccess, onCancel }: TransferFormProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [transferType, setTransferType] = useState<'single' | 'bulk' | 'sku'>(
    unit ? 'single' : units.length > 0 ? 'bulk' : 'sku'
  );
  const [selectedUnits, setSelectedUnits] = useState<string[]>(
    units.map(u => u.id) || []
  );

  // Mock locations - in real app, fetch from API
  const locations = [
    { id: 'loc1', name: 'Main Warehouse' },
    { id: 'loc2', name: 'Store Front' },
    { id: 'loc3', name: 'Service Center' },
    { id: 'loc4', name: 'Distribution Hub' },
  ];

  // Mock SKUs - in real app, fetch from API
  const skus = [
    { id: 'sku1', name: 'MacBook Pro 16" 2023' },
    { id: 'sku2', name: 'iPhone 15 Pro Max' },
    { id: 'sku3', name: 'iPad Pro 12.9"' },
  ];

  // Single transfer form
  const singleForm = useForm<SingleTransferData>({
    resolver: zodResolver(singleTransferSchema),
    defaultValues: {
      unit_id: unit?.id || '',
      to_location_id: '',
      transfer_notes: '',
    },
  });

  // Bulk transfer form
  const bulkForm = useForm<BulkTransferData>({
    resolver: zodResolver(bulkTransferSchema),
    defaultValues: {
      unit_ids: selectedUnits,
      from_location_id: '',
      to_location_id: '',
      transfer_notes: '',
    },
  });

  // SKU transfer form
  const skuForm = useForm<SkuTransferData>({
    resolver: zodResolver(skuTransferSchema),
    defaultValues: {
      sku_id: '',
      from_location_id: '',
      to_location_id: '',
      quantity: 1,
      transfer_notes: '',
    },
  });

  // Single transfer mutation
  const singleTransferMutation = useMutation({
    mutationFn: (data: SingleTransferData) =>
      inventoryUnitsApi.transfer(data.unit_id, {
        to_location_id: data.to_location_id,
        transfer_notes: data.transfer_notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to transfer unit');
    },
  });

  // Bulk transfer mutation
  const bulkTransferMutation = useMutation({
    mutationFn: (data: BulkTransferData) =>
      inventoryUnitsApi.bulkTransfer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to transfer units');
    },
  });

  // SKU transfer mutation
  const skuTransferMutation = useMutation({
    mutationFn: (data: SkuTransferData) =>
      inventoryUnitsApi.transferBySku(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to transfer SKU');
    },
  });

  const handleSingleSubmit = (data: SingleTransferData) => {
    setError(null);
    singleTransferMutation.mutate(data);
  };

  const handleBulkSubmit = (data: BulkTransferData) => {
    setError(null);
    data.unit_ids = selectedUnits;
    bulkTransferMutation.mutate(data);
  };

  const handleSkuSubmit = (data: SkuTransferData) => {
    setError(null);
    skuTransferMutation.mutate(data);
  };

  const toggleUnitSelection = (unitId: string) => {
    setSelectedUnits(prev =>
      prev.includes(unitId)
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={transferType} onValueChange={(value) => setTransferType(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="single" disabled={!unit && units.length === 0}>
            <Package className="h-4 w-4 mr-2" />
            Single Unit
          </TabsTrigger>
          <TabsTrigger value="bulk">
            <BoxSelect className="h-4 w-4 mr-2" />
            Bulk Transfer
          </TabsTrigger>
          <TabsTrigger value="sku">
            <Hash className="h-4 w-4 mr-2" />
            By SKU
          </TabsTrigger>
        </TabsList>

        {/* Single Unit Transfer */}
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Single Unit</CardTitle>
              <CardDescription>
                Transfer a specific inventory unit to another location
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={singleForm.handleSubmit(handleSingleSubmit)} className="space-y-4">
                {unit && (
                  <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Serial Number</span>
                      <span>{unit.serial_number || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Current Location</span>
                      <Badge variant="outline">{unit.location_id}</Badge>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="to_location_id">Destination Location *</Label>
                  <Select
                    value={singleForm.watch('to_location_id')}
                    onValueChange={(value) => singleForm.setValue('to_location_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter(loc => loc.id !== unit?.location_id)
                        .map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {location.name}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {singleForm.formState.errors.to_location_id && (
                    <p className="text-sm text-red-500">
                      {singleForm.formState.errors.to_location_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transfer_notes">Transfer Notes</Label>
                  <Textarea
                    id="transfer_notes"
                    placeholder="Add notes about this transfer..."
                    {...singleForm.register('transfer_notes')}
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={singleTransferMutation.isPending}
                  >
                    {singleTransferMutation.isPending ? 'Transferring...' : 'Transfer Unit'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Transfer */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Transfer</CardTitle>
              <CardDescription>
                Transfer multiple units between locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={bulkForm.handleSubmit(handleBulkSubmit)} className="space-y-4">
                {units.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select Units</Label>
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                checked={selectedUnits.length === units.length}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedUnits(units.map(u => u.id));
                                  } else {
                                    setSelectedUnits([]);
                                  }
                                }}
                              />
                            </TableHead>
                            <TableHead>Serial Number</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Location</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {units.map((unit) => (
                            <TableRow key={unit.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedUnits.includes(unit.id)}
                                  onCheckedChange={() => toggleUnitSelection(unit.id)}
                                />
                              </TableCell>
                              <TableCell>{unit.serial_number || 'N/A'}</TableCell>
                              <TableCell>{unit.sku_id}</TableCell>
                              <TableCell>{unit.location_id}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedUnits.length} unit{selectedUnits.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from_location_id">Source Location *</Label>
                    <Select
                      value={bulkForm.watch('from_location_id')}
                      onValueChange={(value) => bulkForm.setValue('from_location_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {bulkForm.formState.errors.from_location_id && (
                      <p className="text-sm text-red-500">
                        {bulkForm.formState.errors.from_location_id.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="to_location_id">Destination Location *</Label>
                    <Select
                      value={bulkForm.watch('to_location_id')}
                      onValueChange={(value) => bulkForm.setValue('to_location_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations
                          .filter(loc => loc.id !== bulkForm.watch('from_location_id'))
                          .map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {bulkForm.formState.errors.to_location_id && (
                      <p className="text-sm text-red-500">
                        {bulkForm.formState.errors.to_location_id.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transfer_notes">Transfer Notes</Label>
                  <Textarea
                    id="transfer_notes"
                    placeholder="Add notes about this transfer..."
                    {...bulkForm.register('transfer_notes')}
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={bulkTransferMutation.isPending || selectedUnits.length === 0}
                  >
                    {bulkTransferMutation.isPending
                      ? 'Transferring...'
                      : `Transfer ${selectedUnits.length} Unit${selectedUnits.length !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SKU Transfer */}
        <TabsContent value="sku">
          <Card>
            <CardHeader>
              <CardTitle>Transfer by SKU</CardTitle>
              <CardDescription>
                Transfer a specific quantity of a SKU between locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={skuForm.handleSubmit(handleSkuSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sku_id">SKU *</Label>
                  <Select
                    value={skuForm.watch('sku_id')}
                    onValueChange={(value) => skuForm.setValue('sku_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      {skus.map((sku) => (
                        <SelectItem key={sku.id} value={sku.id}>
                          {sku.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {skuForm.formState.errors.sku_id && (
                    <p className="text-sm text-red-500">
                      {skuForm.formState.errors.sku_id.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from_location_id">Source Location *</Label>
                    <Select
                      value={skuForm.watch('from_location_id')}
                      onValueChange={(value) => skuForm.setValue('from_location_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {skuForm.formState.errors.from_location_id && (
                      <p className="text-sm text-red-500">
                        {skuForm.formState.errors.from_location_id.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="to_location_id">Destination Location *</Label>
                    <Select
                      value={skuForm.watch('to_location_id')}
                      onValueChange={(value) => skuForm.setValue('to_location_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations
                          .filter(loc => loc.id !== skuForm.watch('from_location_id'))
                          .map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {skuForm.formState.errors.to_location_id && (
                      <p className="text-sm text-red-500">
                        {skuForm.formState.errors.to_location_id.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    {...skuForm.register('quantity', { valueAsNumber: true })}
                  />
                  {skuForm.formState.errors.quantity && (
                    <p className="text-sm text-red-500">
                      {skuForm.formState.errors.quantity.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transfer_notes">Transfer Notes</Label>
                  <Textarea
                    id="transfer_notes"
                    placeholder="Add notes about this transfer..."
                    {...skuForm.register('transfer_notes')}
                  />
                </div>

                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={skuTransferMutation.isPending}
                  >
                    {skuTransferMutation.isPending ? 'Transferring...' : 'Transfer SKU'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}