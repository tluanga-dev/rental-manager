'use client';

import React, { useState } from 'react';
import { SerialNumberInput } from './SerialNumberInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Demo component to test SerialNumberInput functionality
 * This helps verify that users can actually enter serial numbers
 */
export function SerialNumberDemo() {
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(2);
  const [itemName, setItemName] = useState('Test Item');
  const [required, setRequired] = useState(true);

  const handleSerialNumbersChange = (newSerialNumbers: string[]) => {
    console.log('Serial numbers changed:', newSerialNumbers);
    setSerialNumbers(newSerialNumbers);
  };

  const handleSubmit = () => {
    console.log('Final serial numbers:', serialNumbers);
    alert(`Serial numbers entered: ${JSON.stringify(serialNumbers, null, 2)}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Serial Number Input Demo</CardTitle>
          <CardDescription>
            Test the serial number input component to ensure users can enter serial numbers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max="10"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label htmlFor="itemName">Item Name</Label>
              <Input
                id="itemName"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="required"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              />
              <Label htmlFor="required">Required</Label>
            </div>
          </div>

          {/* Serial Number Input Component */}
          <SerialNumberInput
            value={serialNumbers}
            onChange={handleSerialNumbersChange}
            quantity={quantity}
            itemName={itemName}
            required={required}
          />

          {/* Current State Display */}
          <div className="p-4 bg-gray-100 rounded-lg">
            <h3 className="font-medium mb-2">Current State:</h3>
            <pre className="text-sm">
              {JSON.stringify({ serialNumbers, quantity, itemName, required }, null, 2)}
            </pre>
          </div>

          {/* Submit Button */}
          <Button onClick={handleSubmit} className="w-full">
            Test Submit (Check Console)
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Adjust the quantity to see input fields auto-adjust</li>
            <li>Try typing serial numbers manually in the input fields</li>
            <li>Test the "Auto Generate" button</li>
            <li>Test the "Clear All" button</li>
            <li>Try changing the quantity after entering some serial numbers</li>
            <li>Click "Test Submit" to see the final values in console and alert</li>
            <li>Toggle "Required" to see the component hide/show</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

export default SerialNumberDemo;