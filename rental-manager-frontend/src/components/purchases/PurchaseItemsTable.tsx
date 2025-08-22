'use client';

import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, Package, MapPin, AlertCircle } from 'lucide-react';
import { formatCurrencySync, getCurrentCurrency } from '@/lib/currency-utils';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface PurchaseItem {
  id?: string;
  item_id: string;
  item_name?: string;
  sku?: string;
  quantity: number;
  unit_cost: number;
  tax_rate?: number;
  discount_amount?: number;
  condition: 'A' | 'B' | 'C' | 'D';
  location_id?: string;
  location_name?: string;
  notes?: string;
}

interface PurchaseItemsTableProps {
  items: PurchaseItem[];
  onEditItem?: (index: number, item: PurchaseItem) => void;
  onRemoveItem?: (index: number) => void;
  isEditable?: boolean;
  className?: string;
}

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  A: { label: 'Excellent', color: 'bg-green-100 text-green-800 border-green-200' },
  B: { label: 'Good', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  C: { label: 'Fair', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  D: { label: 'Poor', color: 'bg-red-100 text-red-800 border-red-200' },
};

export function PurchaseItemsTable({
  items,
  onEditItem,
  onRemoveItem,
  isEditable = true,
  className,
}: PurchaseItemsTableProps) {
  const [currencySymbol, setCurrencySymbol] = useState('₹'); // Default to INR
  
  // Load currency symbol
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const currency = await getCurrentCurrency();
        setCurrencySymbol(currency.symbol);
      } catch (error) {
        console.error('Failed to load currency:', error);
        setCurrencySymbol('₹'); // Keep INR as fallback
      }
    };
    loadCurrency();
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => {
    const subtotal = item.quantity * item.unit_cost;
    const discount = item.discount_amount || 0;
    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * ((item.tax_rate || 0) / 100);
    return sum + (taxableAmount + tax);
  }, 0);

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Purchase Items
          </CardTitle>
          <CardDescription>Items included in this purchase</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No items have been added to this purchase yet. Add items to continue.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Purchase Items
            </CardTitle>
            <CardDescription>
              {items.length} item{items.length !== 1 ? 's' : ''} • {totalItems} unit{totalItems !== 1 ? 's' : ''} • {formatCurrencySync(totalValue)} total
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-center w-[80px]">Qty</TableHead>
                <TableHead className="text-right w-[100px]">Unit Cost</TableHead>
                <TableHead className="text-center w-[80px]">Tax %</TableHead>
                <TableHead className="text-right w-[100px]">Discount</TableHead>
                <TableHead className="text-center w-[100px]">Condition</TableHead>
                <TableHead className="w-[120px]">Location</TableHead>
                <TableHead className="text-right w-[100px]">Total</TableHead>
                {isEditable && <TableHead className="text-center w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const subtotal = item.quantity * item.unit_cost;
                const discount = item.discount_amount || 0;
                const taxableAmount = subtotal - discount;
                const tax = taxableAmount * ((item.tax_rate || 0) / 100);
                const itemTotal = taxableAmount + tax;
                const condition = CONDITION_LABELS[item.condition] || CONDITION_LABELS.A;

                return (
                  <TableRow key={index} className="group hover:bg-muted/50">
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {item.item_name || 'Unknown Item'}
                        </div>
                        {item.sku && (
                          <div className="text-sm text-muted-foreground">
                            SKU: {item.sku}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-sm text-muted-foreground italic">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono">
                        {item.quantity}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-right font-mono">
                      {formatCurrencySync(item.unit_cost)}
                    </TableCell>
                    
                    <TableCell className="text-center font-mono text-sm">
                      {(item.tax_rate || 0).toFixed(1)}%
                    </TableCell>
                    
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrencySync(item.discount_amount || 0)}
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", condition.color)}
                      >
                        {condition.label}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      {item.location_name ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{item.location_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No location</span>
                      )}
                    </TableCell>
                    
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrencySync(itemTotal)}
                    </TableCell>
                    
                    {isEditable && (
                      <TableCell>
                        <div className="flex items-center justify-center gap-1 transition-opacity">
                          {onEditItem && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditItem(index, item)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          )}
                          {onRemoveItem && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => onRemoveItem(index)}
                              className="h-8 w-8 p-0 bg-red-500 hover:bg-red-600 text-white"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-end">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-8 text-sm">
                <span className="text-muted-foreground">Total Items:</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex items-center justify-between gap-8 text-sm">
                <span className="text-muted-foreground">Total Units:</span>
                <span className="font-medium">{totalItems}</span>
              </div>
              <div className="flex items-center justify-between gap-8 text-base border-t pt-2">
                <span className="font-medium">Total Value:</span>
                <span className="font-bold font-mono">{formatCurrencySync(totalValue)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}