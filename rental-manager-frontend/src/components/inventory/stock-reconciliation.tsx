'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  CheckCircle,
  Package,
  MapPin,
  Calculator,
  FileText,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Download,
  Upload,
} from 'lucide-react';
import { stockLevelsApi, stockAnalysisApi } from '@/services/api/inventory';
import type { StockLevel } from '@/types/inventory';

const reconciliationSchema = z.object({
  sku_id: z.string().min(1, 'SKU is required'),
  location_id: z.string().min(1, 'Location is required'),
  physical_count: z.number().min(0, 'Count must be 0 or greater'),
  reason: z.string().min(1, 'Reason is required'),
});

const bulkReconciliationSchema = z.object({
  location_id: z.string().min(1, 'Location is required'),
  items: z.array(z.object({
    sku_id: z.string(),
    physical_count: z.number().min(0),
  })).min(1, 'Add at least one item'),
  reason: z.string().min(1, 'Reason is required'),
});

type ReconciliationData = z.infer<typeof reconciliationSchema>;
type BulkReconciliationData = z.infer<typeof bulkReconciliationSchema>;

const reconciliationReasons = [
  'Periodic stock count',
  'Discrepancy found',
  'Theft/Loss',
  'Damage',
  'System error correction',
  'Initial setup',
  'Other',
];

export function StockReconciliation() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [reconciliationResult, setReconciliationResult] = useState<any>(null);
  const [bulkItems, setBulkItems] = useState<Array<{
    sku_id: string;
    sku_name: string;
    system_count: number;
    physical_count: number;
  }>>([]);

  // Mock data - in real app, fetch from API
  const skus = [
    { id: 'sku1', name: 'MacBook Pro 16" 2023' },
    { id: 'sku2', name: 'iPhone 15 Pro Max' },
    { id: 'sku3', name: 'iPad Pro 12.9"' },
  ];

  const locations = [
    { id: 'loc1', name: 'Main Warehouse' },
    { id: 'loc2', name: 'Store Front' },
    { id: 'loc3', name: 'Service Center' },
  ];

  // Single reconciliation form
  const singleForm = useForm<ReconciliationData>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: {
      sku_id: '',
      location_id: '',
      physical_count: 0,
      reason: '',
    },
  });

  // Bulk reconciliation form
  const bulkForm = useForm<BulkReconciliationData>({
    resolver: zodResolver(bulkReconciliationSchema),
    defaultValues: {
      location_id: '',
      items: [],
      reason: '',
    },
  });

  // Fetch current stock level for selected SKU and location
  const { data: currentStock } = useQuery({
    queryKey: ['stock-level', singleForm.watch('sku_id'), singleForm.watch('location_id')],
    queryFn: () => stockLevelsApi.getBySkuLocation(
      singleForm.watch('sku_id'),
      singleForm.watch('location_id')
    ),
    enabled: !!singleForm.watch('sku_id') && !!singleForm.watch('location_id'),
  });

  // Fetch stock levels for bulk reconciliation
  const { data: locationStockLevels } = useQuery({
    queryKey: ['stock-levels', selectedLocation],
    queryFn: () => stockLevelsApi.list({ location_id: selectedLocation }),
    enabled: !!selectedLocation && mode === 'bulk',
  });

  // Single reconciliation mutation
  const reconcileMutation = useMutation({
    mutationFn: (data: ReconciliationData) =>
      stockLevelsApi.reconcile(
        data.sku_id,
        data.location_id,
        data.physical_count,
        data.reason
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
      setReconciliationResult(result);
      singleForm.reset();
    },
  });

  // Bulk reconciliation mutation
  const bulkReconcileMutation = useMutation({
    mutationFn: async (data: BulkReconciliationData) => {
      // In a real app, this would be a single bulk endpoint
      const results = await Promise.all(
        data.items.map(item =>
          stockLevelsApi.reconcile(
            item.sku_id,
            data.location_id,
            item.physical_count,
            data.reason
          )
        )
      );
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] });
      setReconciliationResult({ bulk: true, results });
      bulkForm.reset();
      setBulkItems([]);
    },
  });

  const handleSingleSubmit = (data: ReconciliationData) => {
    reconcileMutation.mutate(data);
  };

  const handleBulkSubmit = (data: BulkReconciliationData) => {
    data.items = bulkItems.map(item => ({
      sku_id: item.sku_id,
      physical_count: item.physical_count,
    }));
    bulkReconcileMutation.mutate(data);
  };

  const updateBulkItem = (index: number, physicalCount: number) => {
    const updated = [...bulkItems];
    updated[index].physical_count = physicalCount;
    setBulkItems(updated);
  };

  const loadStockLevelsForBulk = () => {
    if (locationStockLevels) {
      const items = locationStockLevels.map((stock: StockLevel) => ({
        sku_id: stock.sku_id,
        sku_name: skus.find(s => s.id === stock.sku_id)?.name || stock.sku_id,
        system_count: stock.total_units,
        physical_count: stock.total_units, // Default to system count
      }));
      setBulkItems(items);
    }
  };

  const calculateVariance = (systemCount: number, physicalCount: number) => {
    const variance = physicalCount - systemCount;
    const percentage = systemCount > 0 ? (variance / systemCount) * 100 : 0;
    return { variance, percentage };
  };

  const exportReconciliation = () => {
    // In a real app, this would generate a CSV or Excel file
    console.log('Exporting reconciliation data...');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stock Reconciliation</CardTitle>
          <CardDescription>
            Compare physical inventory counts with system records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(value) => setMode(value as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">
                <Package className="h-4 w-4 mr-2" />
                Single Item
              </TabsTrigger>
              <TabsTrigger value="bulk">
                <BarChart3 className="h-4 w-4 mr-2" />
                Bulk Reconciliation
              </TabsTrigger>
            </TabsList>

            {/* Single Item Reconciliation */}
            <TabsContent value="single" className="space-y-4">
              <form onSubmit={singleForm.handleSubmit(handleSingleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku_id">SKU *</Label>
                    <Select
                      value={singleForm.watch('sku_id')}
                      onValueChange={(value) => singleForm.setValue('sku_id', value)}
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
                    {singleForm.formState.errors.sku_id && (
                      <p className="text-sm text-red-500">
                        {singleForm.formState.errors.sku_id.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location_id">Location *</Label>
                    <Select
                      value={singleForm.watch('location_id')}
                      onValueChange={(value) => singleForm.setValue('location_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {location.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {singleForm.formState.errors.location_id && (
                      <p className="text-sm text-red-500">
                        {singleForm.formState.errors.location_id.message}
                      </p>
                    )}
                  </div>
                </div>

                {currentStock && (
                  <Card className="bg-gray-50">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">System Count</p>
                          <p className="text-2xl font-bold">{currentStock.total_units}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Available Units</p>
                          <p className="text-2xl font-bold">{currentStock.available_units}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label htmlFor="physical_count">Physical Count *</Label>
                  <Input
                    id="physical_count"
                    type="number"
                    min="0"
                    {...singleForm.register('physical_count', { valueAsNumber: true })}
                  />
                  {singleForm.formState.errors.physical_count && (
                    <p className="text-sm text-red-500">
                      {singleForm.formState.errors.physical_count.message}
                    </p>
                  )}
                  {currentStock && singleForm.watch('physical_count') !== undefined && (
                    <div className="text-sm">
                      Variance: {' '}
                      <span className={cn(
                        'font-medium',
                        singleForm.watch('physical_count') - currentStock.total_units > 0
                          ? 'text-green-600'
                          : singleForm.watch('physical_count') - currentStock.total_units < 0
                          ? 'text-red-600'
                          : 'text-gray-600'
                      )}>
                        {singleForm.watch('physical_count') - currentStock.total_units > 0 && '+'}
                        {singleForm.watch('physical_count') - currentStock.total_units}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Select
                    value={singleForm.watch('reason')}
                    onValueChange={(value) => singleForm.setValue('reason', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {reconciliationReasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {singleForm.formState.errors.reason && (
                    <p className="text-sm text-red-500">
                      {singleForm.formState.errors.reason.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={reconcileMutation.isPending}
                >
                  {reconcileMutation.isPending ? 'Processing...' : 'Reconcile Stock'}
                </Button>
              </form>
            </TabsContent>

            {/* Bulk Reconciliation */}
            <TabsContent value="bulk" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="bulk_location">Location *</Label>
                    <Select
                      value={selectedLocation}
                      onValueChange={setSelectedLocation}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location for bulk count" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {location.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={loadStockLevelsForBulk}
                    disabled={!selectedLocation}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Load Items
                  </Button>
                </div>

                {bulkItems.length > 0 && (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg">Count Sheet</CardTitle>
                          <Button variant="outline" size="sm" onClick={exportReconciliation}>
                            <Download className="h-4 w-4 mr-2" />
                            Export
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>SKU</TableHead>
                              <TableHead className="text-center">System Count</TableHead>
                              <TableHead className="text-center">Physical Count</TableHead>
                              <TableHead className="text-center">Variance</TableHead>
                              <TableHead className="text-center">Variance %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bulkItems.map((item, index) => {
                              const { variance, percentage } = calculateVariance(
                                item.system_count,
                                item.physical_count
                              );
                              return (
                                <TableRow key={item.sku_id}>
                                  <TableCell className="font-medium">
                                    {item.sku_name}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {item.system_count}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={item.physical_count}
                                      onChange={(e) => updateBulkItem(
                                        index,
                                        parseInt(e.target.value) || 0
                                      )}
                                      className="w-20 mx-auto"
                                    />
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={cn(
                                      'font-medium',
                                      variance > 0 ? 'text-green-600' :
                                      variance < 0 ? 'text-red-600' :
                                      'text-gray-600'
                                    )}>
                                      {variance > 0 && '+'}{variance}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant={
                                      Math.abs(percentage) < 5 ? 'default' :
                                      Math.abs(percentage) < 10 ? 'secondary' :
                                      'destructive'
                                    }>
                                      {percentage > 0 && '+'}{percentage.toFixed(1)}%
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <Label htmlFor="bulk_reason">Reason for Reconciliation *</Label>
                      <Select
                        value={bulkForm.watch('reason')}
                        onValueChange={(value) => bulkForm.setValue('reason', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {reconciliationReasons.map((reason) => (
                            <SelectItem key={reason} value={reason}>
                              {reason}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {bulkForm.formState.errors.reason && (
                        <p className="text-sm text-red-500">
                          {bulkForm.formState.errors.reason.message}
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => {
                        bulkForm.setValue('location_id', selectedLocation);
                        bulkForm.handleSubmit(handleBulkSubmit)();
                      }}
                      className="w-full"
                      disabled={bulkReconcileMutation.isPending}
                    >
                      {bulkReconcileMutation.isPending 
                        ? 'Processing...' 
                        : `Reconcile ${bulkItems.length} Items`}
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Reconciliation Result */}
      {reconciliationResult && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Reconciliation Complete</AlertTitle>
          <AlertDescription>
            {reconciliationResult.bulk ? (
              <div className="mt-2">
                Successfully reconciled {reconciliationResult.results.length} items.
              </div>
            ) : (
              <div className="mt-2 space-y-1">
                <div>Stock level updated successfully.</div>
                <div>Adjustment: {reconciliationResult.adjustment > 0 && '+'}{reconciliationResult.adjustment} units</div>
                <div className="text-sm text-muted-foreground">
                  Movement ID: {reconciliationResult.movement_id}
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}