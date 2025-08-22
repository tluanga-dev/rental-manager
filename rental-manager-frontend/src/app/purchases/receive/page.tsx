'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, PackageCheck, Search } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';

interface ReceiveItem {
  id: string;
  skuCode: string;
  skuName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
}

function ReceiveInventoryContent() {
  const router = useRouter();
  const { addNotification } = useAppStore();
  const [poNumber, setPoNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [receivingLocation, setReceivingLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ReceiveItem[]>([]);
  const [searchSku, setSearchSku] = useState('');

  const handleAddItem = () => {
    const newItem: ReceiveItem = {
      id: Date.now().toString(),
      skuCode: '',
      skuName: '',
      quantityOrdered: 0,
      quantityReceived: 0,
      unitCost: 0,
      condition: 'NEW',
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof ReceiveItem, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async () => {
    // Validate form
    if (!poNumber || !supplierName || !receivingLocation || items.length === 0) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fill in all required fields and add at least one item',
      });
      return;
    }

    // Here you would call the bulk receive endpoint
    // For now, we'll simulate success
    addNotification({
      type: 'success',
      title: 'Inventory Received',
      message: `Successfully received ${items.reduce((sum, item) => sum + item.quantityReceived, 0)} items`,
    });

    router.push('/purchases');
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantityReceived, 0);
  const totalCost = items.reduce((sum, item) => sum + (item.quantityReceived * item.unitCost), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Receive Inventory
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Process incoming inventory from purchase orders
        </p>
      </div>

      {/* Receiving Details */}
      <Card>
        <CardHeader>
          <CardTitle>Receiving Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="po-number">Purchase Order Number*</Label>
              <Input
                id="po-number"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="PO-2024-001"
              />
            </div>
            <div>
              <Label htmlFor="supplier">Supplier*</Label>
              <Input
                id="supplier"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Enter supplier name"
              />
            </div>
            <div>
              <Label htmlFor="location">Receiving Location*</Label>
              <Select value={receivingLocation} onValueChange={setReceivingLocation}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main-warehouse">Main Warehouse</SelectItem>
                  <SelectItem value="store-front">Store Front</SelectItem>
                  <SelectItem value="secondary-warehouse">Secondary Warehouse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any receiving notes..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Items to Receive */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Items to Receive</CardTitle>
            <Button onClick={handleAddItem} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No items added. Click "Add Item" to start receiving inventory.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Qty Ordered</TableHead>
                  <TableHead>Qty Received</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input
                        value={item.skuCode}
                        onChange={(e) => handleItemChange(item.id, 'skuCode', e.target.value)}
                        placeholder="SKU code"
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.skuName}
                        onChange={(e) => handleItemChange(item.id, 'skuName', e.target.value)}
                        placeholder="Item name"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantityOrdered}
                        onChange={(e) => handleItemChange(item.id, 'quantityOrdered', parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantityReceived}
                        onChange={(e) => handleItemChange(item.id, 'quantityReceived', parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitCost}
                        onChange={(e) => handleItemChange(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={item.condition} 
                        onValueChange={(value) => handleItemChange(item.id, 'condition', value)}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW">New</SelectItem>
                          <SelectItem value="GOOD">Good</SelectItem>
                          <SelectItem value="FAIR">Fair</SelectItem>
                          <SelectItem value="POOR">Poor</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${(item.quantityReceived * item.unitCost).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary and Actions */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Receiving Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span className="font-medium">{totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Cost:</span>
                <span className="font-medium">${totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Purchase Order:</span>
                <span className="font-medium">{poNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span>Supplier:</span>
                <span className="font-medium">{supplierName || '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              className="w-full" 
              onClick={handleSubmit}
              disabled={items.length === 0}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              Receive Inventory
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.push('/purchases')}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ReceiveInventoryPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_CREATE']}>
      <ReceiveInventoryContent />
    </ProtectedRoute>
  );
}