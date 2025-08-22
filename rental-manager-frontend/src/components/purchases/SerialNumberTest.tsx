'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SerialNumberInput } from './SerialNumberInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';

// Mock item data
const mockItems = [
  {
    id: '1',
    item_name: 'Laptop Dell XPS 13',
    sku: 'LAPTOP-001',
    serial_number_required: true,
    purchase_price: 1200
  },
  {
    id: '2',
    item_name: 'Office Chair',
    sku: 'CHAIR-001',
    serial_number_required: false,
    purchase_price: 300
  },
  {
    id: '3',
    item_name: 'iPhone 15 Pro',
    sku: 'PHONE-001',
    serial_number_required: true,
    purchase_price: 999
  }
];

const itemSchema = z.object({
  item_id: z.string().min(1, 'Item is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_cost: z.number().min(0, 'Unit cost must be positive'),
  serial_numbers: z.array(z.string().min(1, 'Serial number cannot be empty')).optional(),
});

const testFormSchema = z.object({
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

type TestFormValues = z.infer<typeof testFormSchema>;

export function SerialNumberTest() {
  const [selectedItems, setSelectedItems] = useState<Record<number, any>>({});

  const form = useForm<TestFormValues>({
    resolver: zodResolver(testFormSchema),
    defaultValues: {
      items: [
        {
          item_id: '',
          quantity: 1,
          unit_cost: 0,
          serial_numbers: [],
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const validateSerialNumbers = (items: any[], selectedItems: Record<number, any>) => {
    const errors: string[] = [];
    
    items.forEach((item, index) => {
      const selectedItem = selectedItems[index];
      
      if (selectedItem?.serial_number_required) {
        const serialNumbers = item.serial_numbers || [];
        const validSerialNumbers = serialNumbers.filter((sn: string) => sn && sn.trim());
        
        if (validSerialNumbers.length === 0) {
          errors.push(`Serial numbers are required for ${selectedItem.item_name}`);
        } else if (validSerialNumbers.length !== item.quantity) {
          errors.push(
            `${selectedItem.item_name}: ${item.quantity} units ordered but ${validSerialNumbers.length} serial numbers provided`
          );
        }
      }
    });
    
    return errors;
  };

  const onSubmit = (values: TestFormValues) => {
    const errors = validateSerialNumbers(values.items, selectedItems);
    
    if (errors.length > 0) {
      alert('Validation errors:\n' + errors.join('\n'));
      return;
    }

    console.log('Form submitted successfully:', values);
    alert('Form submitted successfully! Check console for details.');
  };

  const addItem = () => {
    append({
      item_id: '',
      quantity: 1,
      unit_cost: 0,
      serial_numbers: [],
    });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      setSelectedItems(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Serial Number Integration Test</CardTitle>
          <CardDescription>
            Test the serial number functionality integrated with form validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Item {index + 1}</h4>
                      {selectedItems[index]?.serial_number_required && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                          Serial Numbers Required
                        </Badge>
                      )}
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.item_id`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="w-full p-2 border rounded-md"
                              onChange={(e) => {
                                field.onChange(e.target.value);
                                const selectedItem = mockItems.find(item => item.id === e.target.value);
                                setSelectedItems(prev => ({
                                  ...prev,
                                  [index]: selectedItem || null
                                }));
                                if (selectedItem) {
                                  form.setValue(`items.${index}.unit_cost`, selectedItem.purchase_price);
                                  form.setValue(`items.${index}.serial_numbers`, []);
                                }
                              }}
                            >
                              <option value="">Select an item...</option>
                              {mockItems.map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.item_name} - {item.sku} 
                                  {item.serial_number_required ? ' (Serial Required)' : ''}
                                </option>
                              ))}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_cost`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Cost</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Serial Number Input */}
                  {selectedItems[index]?.serial_number_required && (
                    <FormField
                      control={form.control}
                      name={`items.${index}.serial_numbers`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <SerialNumberInput
                              value={field.value || []}
                              onChange={field.onChange}
                              quantity={form.watch(`items.${index}.quantity`) || 1}
                              itemName={selectedItems[index]?.item_name || 'Selected Item'}
                              required={true}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-4">
                <Button type="button" onClick={addItem} variant="outline">
                  Add Item
                </Button>
                <Button type="submit">
                  Submit Test Form
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Test Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Select "Laptop Dell XPS 13" or "iPhone 15 Pro" to see serial number inputs appear</li>
            <li>Select "Office Chair" to see no serial number inputs (not required)</li>
            <li>Change quantity and watch serial number inputs adjust automatically</li>
            <li>Enter serial numbers manually or use auto-generate</li>
            <li>Try submitting with missing serial numbers to test validation</li>
            <li>Try submitting with correct serial numbers to test success</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

export default SerialNumberTest;