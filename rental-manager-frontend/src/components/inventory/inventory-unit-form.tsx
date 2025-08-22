'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { CalendarIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inventoryUnitsApi } from '@/services/api/inventory';
import type { InventoryUnit, ConditionGrade } from '@/types/inventory';
import { locationsApi } from '@/services/api/locations';
import { itemsApi } from '@/services/api/items';
import type { Location } from '@/types/location';
import type { Item } from '@/types/item';

const inventoryUnitSchema = z.object({
  sku_id: z.string().min(1, 'SKU is required'),
  location_id: z.string().min(1, 'Location is required'),
  serial_number: z.string().optional(),
  purchase_date: z.date().optional(),
  purchase_price: z.number().min(0).optional(),
  condition_grade: z.enum(['A', 'B', 'C', 'D']),
  notes: z.string().optional(),
});

type InventoryUnitFormData = z.infer<typeof inventoryUnitSchema>;

interface InventoryUnitFormProps {
  unit?: InventoryUnit;
  onSuccess?: (unit: InventoryUnit) => void;
  onCancel?: () => void;
}

export function InventoryUnitForm({ unit, onSuccess, onCancel }: InventoryUnitFormProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: items, isLoading: isLoadingItems } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: itemsApi.list,
  });

  const { data: locations, isLoading: isLoadingLocations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: locationsApi.list,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
  } = useForm<InventoryUnitFormData>({
    resolver: zodResolver(inventoryUnitSchema),
    defaultValues: {
      sku_id: unit?.sku_id || '',
      location_id: unit?.location_id || '',
      serial_number: unit?.serial_number || '',
      purchase_date: unit?.purchase_date ? new Date(unit.purchase_date) : undefined,
      purchase_price: unit?.purchase_price || undefined,
      condition_grade: unit?.condition_grade || 'A',
      notes: unit?.notes || '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InventoryUnitFormData) => {
      const payload = {
        ...data,
        purchase_date: data.purchase_date?.toISOString(),
      };
      return inventoryUnitsApi.create(payload);
    },
    onSuccess: (newUnit) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      onSuccess?.(newUnit);
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to create inventory unit');
    },
  });

  const onSubmit = (data: InventoryUnitFormData) => {
    setError(null);
    createMutation.mutate(data);
  };

  const watchPurchaseDate = watch('purchase_date');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SKU Selection */}
        <div className="space-y-2">
          <Label htmlFor="sku_id">SKU *</Label>
          <Select
            value={watch('sku_id')}
            onValueChange={(value) => setValue('sku_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select SKU" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingItems ? (
                <SelectItem value="loading" disabled>Loading...</SelectItem>
              ) : (
                items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.sku})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {errors.sku_id && (
            <p className="text-sm text-red-500">{errors.sku_id.message}</p>
          )}
        </div>

        {/* Location Selection */}
        <div className="space-y-2">
          <Label htmlFor="location_id">Location *</Label>
          <Select
            value={watch('location_id')}
            onValueChange={(value) => setValue('location_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingLocations ? (
                <SelectItem value="loading" disabled>Loading...</SelectItem>
              ) : (
                locations?.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.location_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {errors.location_id && (
            <p className="text-sm text-red-500">{errors.location_id.message}</p>
          )}
        </div>

        {/* Serial Number */}
        <div className="space-y-2">
          <Label htmlFor="serial_number">Serial Number</Label>
          <Input
            id="serial_number"
            placeholder="Enter serial number (if applicable)"
            {...register('serial_number')}
          />
          {errors.serial_number && (
            <p className="text-sm text-red-500">{errors.serial_number.message}</p>
          )}
        </div>

        {/* Condition Grade */}
        <div className="space-y-2">
          <Label htmlFor="condition_grade">Condition Grade *</Label>
          <Select
            value={watch('condition_grade')}
            onValueChange={(value) => setValue('condition_grade', value as ConditionGrade)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">Grade A - Excellent</SelectItem>
              <SelectItem value="B">Grade B - Good</SelectItem>
              <SelectItem value="C">Grade C - Fair</SelectItem>
              <SelectItem value="D">Grade D - Poor</SelectItem>
            </SelectContent>
          </Select>
          {errors.condition_grade && (
            <p className="text-sm text-red-500">{errors.condition_grade.message}</p>
          )}
        </div>

        {/* Purchase Date */}
        <div className="space-y-2">
          <Label>Purchase Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !watchPurchaseDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {watchPurchaseDate ? format(watchPurchaseDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={watchPurchaseDate}
                onSelect={(date) => setValue('purchase_date', date || undefined)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.purchase_date && (
            <p className="text-sm text-red-500">{errors.purchase_date.message}</p>
          )}
        </div>

        {/* Purchase Price */}
        <div className="space-y-2">
          <Label htmlFor="purchase_price">Purchase Price</Label>
          <Input
            id="purchase_price"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register('purchase_price', { valueAsNumber: true })}
          />
          {errors.purchase_price && (
            <p className="text-sm text-red-500">{errors.purchase_price.message}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Add any additional notes about this inventory unit..."
          rows={4}
          {...register('notes')}
        />
        {errors.notes && (
          <p className="text-sm text-red-500">{errors.notes.message}</p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : unit ? 'Update Unit' : 'Create Unit'}
        </Button>
      </div>
    </form>
  );
}