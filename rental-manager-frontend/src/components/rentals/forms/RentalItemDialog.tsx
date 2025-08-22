'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon, Plus } from 'lucide-react';
import { format, addDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PastelCalendar } from '@/components/ui/pastel-calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PriceInput } from '@/components/ui/price-input';
import { cn } from '@/lib/utils';
import { calculateRentalItemTotal } from '@/utils/calculations';
import { PERIOD_TYPES } from '@/types/rentals';
import type { PeriodType } from '@/types/rentals';

const rentalItemSchema = z.object({
  item_id: z.string().min(1, 'Please select an item'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  rental_start_date: z.date({ required_error: 'Start date is required' }),
  rental_end_date: z.date({ required_error: 'End date is required' }),
  rental_period_type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY'] as const),
  rental_period_value: z.number().min(1, 'Period value must be at least 1'),
  unit_rate: z.number().min(0, 'Rate must be positive'),
  discount_value: z.number().min(0).optional(),
  notes: z.string().optional(),
});

type RentalItemFormData = z.infer<typeof rentalItemSchema>;

interface RentalItemDialogProps {
  onAddItem: (item: RentalItemFormData) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RentalItemDialog({ onAddItem, isOpen, onOpenChange }: RentalItemDialogProps) {
  const form = useForm<RentalItemFormData>({
    resolver: zodResolver(rentalItemSchema),
    defaultValues: {
      item_id: '',
      quantity: 1,
      rental_start_date: new Date(),
      rental_end_date: addDays(new Date(), 1),
      rental_period_type: 'DAILY',
      rental_period_value: 1,
      unit_rate: 0,
      discount_value: 0,
      notes: '',
    },
  });

  const onSubmit = (data: RentalItemFormData) => {
    onAddItem(data);
    form.reset();
    onOpenChange(false);
  };

  const getRentalDays = (startDate: Date, endDate: Date) => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden">
        <DialogHeader className="pb-3">
          <DialogTitle>Add Rental Item</DialogTitle>
          <DialogDescription>
            Configure the rental item details including dates, rates, and quantities.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {/* Item and Quantity Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="item_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Item *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Select an item" className="h-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Quantity *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        className="h-9"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Rental duration display - moved to top right */}
              {form.watch('rental_start_date') && form.watch('rental_end_date') && (
                <div className="bg-slate-50 p-2 rounded-lg flex items-center">
                  <p className="text-sm text-slate-800">
                    <strong>Duration:</strong> {getRentalDays(
                      form.watch('rental_start_date') as Date,
                      form.watch('rental_end_date') as Date
                    )} days
                  </p>
                </div>
              )}
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="rental_start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Start Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal h-9",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "MMM dd, yyyy")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <PastelCalendar
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rental_end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">End Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal h-9",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "MMM dd, yyyy")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <PastelCalendar
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Period and Pricing Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FormField
                control={form.control}
                name="rental_period_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Period Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PERIOD_TYPES.map((period) => (
                          <SelectItem key={period.value} value={period.value}>
                            {period.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rental_period_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Period Value *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        className="h-9"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Unit Rate *</FormLabel>
                    <FormControl>
                      <PriceInput
                        {...field}
                        onChange={(value) => field.onChange(value)}
                        className="h-9"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discount_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">Discount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-9"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Calculation Preview */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="text-sm font-medium mb-3">Calculation Preview</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Base Cost:</span>
                  <span>₹{((form.watch('unit_rate') || 0) * (form.watch('quantity') || 1) * (form.watch('rental_period_value') || 1)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span className="text-green-600">-₹{(form.watch('discount_value') || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total:</span>
                  <span>₹{calculateRentalItemTotal(
                    form.watch('quantity') || 1,
                    form.watch('unit_rate') || 0,
                    form.watch('rental_period_value') || 1,
                    form.watch('discount_value') || 0
                  ).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes Row */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Additional notes for this item" 
                      className="min-h-[60px] resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Add Item
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
