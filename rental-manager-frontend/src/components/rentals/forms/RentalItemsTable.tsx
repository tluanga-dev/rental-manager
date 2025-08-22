'use client';

import { format } from 'date-fns';
import { Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateRentalItemTotal } from '@/utils/calculations';

export interface RentalItem {
  item_id: string;
  quantity: number;
  rental_start_date: Date;
  rental_end_date: Date;
  rental_period_type: string;
  rental_period_value: number;
  unit_rate: number;
  discount_value?: number;
  notes?: string;
}

interface RentalItemsTableProps {
  items: RentalItem[];
  onRemoveItem: (index: number) => void;
  onEditItem?: (index: number) => void;
}

export function RentalItemsTable({ items, onRemoveItem, onEditItem }: RentalItemsTableProps) {
  const getRentalDays = (startDate: Date, endDate: Date) => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const calculateTotal = (item: RentalItem) => {
    // Use the centralized calculation utility for consistency
    return calculateRentalItemTotal(
      item.quantity,
      item.unit_rate,
      item.rental_period_value || 1,
      item.discount_value || 0
    );
  };

  const getGrandTotal = () => {
    return items.reduce((total, item) => total + calculateTotal(item), 0);
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <p>No rental items added yet.</p>
            <p className="text-sm mt-2">Click "Add Item" to get started.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rental Items ({items.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {item.item_id}
                    {item.notes && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{format(item.rental_start_date, 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{format(item.rental_end_date, 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getRentalDays(item.rental_start_date, item.rental_end_date)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {item.rental_period_value} {item.rental_period_type}
                    </Badge>
                  </TableCell>
                  <TableCell>₹{item.unit_rate.toFixed(2)}</TableCell>
                  <TableCell>
                    {item.discount_value ? (
                      <span className="text-green-600">-₹{item.discount_value.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    ₹{calculateTotal(item).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {onEditItem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditItem(index)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {items.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Total items: {items.length}
              </span>
              <div className="text-right">
                <div className="text-lg font-semibold">
                  Grand Total: ₹{getGrandTotal().toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
