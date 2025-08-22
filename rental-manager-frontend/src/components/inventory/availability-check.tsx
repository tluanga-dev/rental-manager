'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  CalendarIcon,
  Package,
  MapPin,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { stockAnalysisApi } from '@/services/api/inventory';

// Schema for single SKU check
const singleCheckSchema = z.object({
  sku_id: z.string().min(1, 'SKU is required'),
  location_id: z.string().min(1, 'Location is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  start_date: z.date().optional(),
  end_date: z.date().optional(),
});

// Schema for multiple SKUs check
const multipleCheckSchema = z.object({
  items: z.array(z.object({
    sku_id: z.string().min(1),
    location_id: z.string().min(1),
    quantity: z.number().min(1),
  })).min(1, 'Add at least one item to check'),
});

type SingleCheckData = z.infer<typeof singleCheckSchema>;
type MultipleCheckData = z.infer<typeof multipleCheckSchema>;
type CheckMode = 'single' | 'multiple';

interface AvailabilityCheckProps {
  onReserve?: (items: any[]) => void;
}

export function AvailabilityCheck({ onReserve }: AvailabilityCheckProps) {
  const [mode, setMode] = useState<CheckMode>('single');
  const [singleResult, setSingleResult] = useState<any>(null);
  const [multipleResults, setMultipleResults] = useState<any>(null);
  const [checkItems, setCheckItems] = useState<Array<{
    sku_id: string;
    location_id: string;
    quantity: number;
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

  // Single check form
  const singleForm = useForm<SingleCheckData>({
    resolver: zodResolver(singleCheckSchema),
    defaultValues: {
      sku_id: '',
      location_id: '',
      quantity: 1,
    },
  });

  // Multiple check form
  const multipleForm = useForm<MultipleCheckData>({
    resolver: zodResolver(multipleCheckSchema),
    defaultValues: {
      items: checkItems,
    },
  });

  const watchStartDate = singleForm.watch('start_date');
  const watchEndDate = singleForm.watch('end_date');

  // Single availability check mutation
  const singleCheckMutation = useMutation({
    mutationFn: (data: SingleCheckData) => {
      const payload = {
        ...data,
        start_date: data.start_date?.toISOString(),
        end_date: data.end_date?.toISOString(),
      };
      return stockAnalysisApi.checkAvailability(payload as any);
    },
    onSuccess: (result) => {
      setSingleResult(result);
    },
  });

  // Multiple availability check mutation
  const multipleCheckMutation = useMutation({
    mutationFn: (data: MultipleCheckData) => {
      return stockAnalysisApi.checkMultipleAvailability(data.items as any);
    },
    onSuccess: (result) => {
      setMultipleResults(result);
    },
  });

  const handleSingleCheck = (data: SingleCheckData) => {
    setSingleResult(null);
    singleCheckMutation.mutate(data);
  };

  const handleMultipleCheck = () => {
    if (checkItems.length === 0) return;
    setMultipleResults(null);
    multipleCheckMutation.mutate({ items: checkItems });
  };

  const addCheckItem = () => {
    setCheckItems([...checkItems, { sku_id: '', location_id: '', quantity: 1 }]);
  };

  const updateCheckItem = (index: number, field: string, value: any) => {
    const updated = [...checkItems];
    updated[index] = { ...updated[index], [field]: value };
    setCheckItems(updated);
  };

  const removeCheckItem = (index: number) => {
    setCheckItems(checkItems.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <div className="flex gap-2">
        <Button
          variant={mode === 'single' ? 'default' : 'outline'}
          onClick={() => setMode('single')}
        >
          Single SKU Check
        </Button>
        <Button
          variant={mode === 'multiple' ? 'default' : 'outline'}
          onClick={() => setMode('multiple')}
        >
          Multiple SKUs Check
        </Button>
      </div>

      {mode === 'single' ? (
        <Card>
          <CardHeader>
            <CardTitle>Check SKU Availability</CardTitle>
            <CardDescription>
              Check if a specific SKU is available at a location
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={singleForm.handleSubmit(handleSingleCheck)} className="space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    {...singleForm.register('quantity', { valueAsNumber: true })}
                  />
                  {singleForm.formState.errors.quantity && (
                    <p className="text-sm text-red-500">
                      {singleForm.formState.errors.quantity.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Date Range (Optional)</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'flex-1 justify-start text-left font-normal',
                            !watchStartDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {watchStartDate ? format(watchStartDate, 'PP') : 'Start date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={watchStartDate}
                          onSelect={(date) => singleForm.setValue('start_date', date || undefined)}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'flex-1 justify-start text-left font-normal',
                            !watchEndDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {watchEndDate ? format(watchEndDate, 'PP') : 'End date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={watchEndDate}
                          onSelect={(date) => singleForm.setValue('end_date', date || undefined)}
                          disabled={(date) => 
                            date < (watchStartDate || new Date())
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={singleCheckMutation.isPending}
              >
                {singleCheckMutation.isPending ? 'Checking...' : 'Check Availability'}
              </Button>
            </form>

            {/* Single Result */}
            {singleResult && (
              <div className="mt-6">
                <Alert
                  variant={singleResult.available ? 'default' : 'destructive'}
                  className="mt-4"
                >
                  {singleResult.available ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {singleResult.available ? 'Available' : 'Not Available'}
                  </AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between">
                        <span>Requested:</span>
                        <span className="font-medium">{singleResult.requested} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Currently Available:</span>
                        <span className="font-medium">{singleResult.current_available} units</span>
                      </div>
                      {singleResult.future_available !== undefined && (
                        <div className="flex justify-between">
                          <span>Future Available:</span>
                          <span className="font-medium">
                            {singleResult.future_available} units
                          </span>
                        </div>
                      )}
                    </div>
                    {singleResult.available && onReserve && (
                      <Button
                        className="mt-4"
                        onClick={() => onReserve([{
                          sku_id: singleForm.getValues('sku_id'),
                          location_id: singleForm.getValues('location_id'),
                          quantity: singleForm.getValues('quantity'),
                        }])}
                      >
                        Reserve Now
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Check Multiple SKUs</CardTitle>
            <CardDescription>
              Check availability for multiple items at once
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Items to check */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Items to Check</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCheckItem}
                >
                  Add Item
                </Button>
              </div>
              
              {checkItems.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No items added. Click "Add Item" to start checking availability.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {checkItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select
                          value={item.sku_id}
                          onValueChange={(value) => updateCheckItem(index, 'sku_id', value)}
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
                      </div>
                      <div className="flex-1">
                        <Select
                          value={item.location_id}
                          onValueChange={(value) => updateCheckItem(index, 'location_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Location" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateCheckItem(index, 'quantity', parseInt(e.target.value))}
                        className="w-24"
                        placeholder="Qty"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCheckItem(index)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleMultipleCheck}
              disabled={checkItems.length === 0 || multipleCheckMutation.isPending}
            >
              {multipleCheckMutation.isPending ? 'Checking...' : 'Check All Items'}
            </Button>

            {/* Multiple Results */}
            {multipleResults && (
              <div className="mt-6 space-y-4">
                <Alert variant={multipleResults.all_available ? 'default' : 'destructive'}>
                  {multipleResults.all_available ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {multipleResults.all_available
                      ? 'All items available'
                      : 'Some items not available'}
                  </AlertTitle>
                </Alert>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {multipleResults.results.map((result: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          {skus.find(s => s.id === result.sku_id)?.name}
                        </TableCell>
                        <TableCell>
                          {locations.find(l => l.id === result.location_id)?.name}
                        </TableCell>
                        <TableCell>{result.requested}</TableCell>
                        <TableCell>{result.current_available}</TableCell>
                        <TableCell>
                          <Badge
                            variant={result.available ? 'default' : 'destructive'}
                          >
                            {result.available ? 'Available' : 'Not Available'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {multipleResults.all_available && onReserve && (
                  <Button
                    className="w-full"
                    onClick={() => onReserve(checkItems)}
                  >
                    Reserve All Items
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}