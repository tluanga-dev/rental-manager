'use client';

import React, { useState, useEffect } from 'react';
import { Plus, X, AlertCircle, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface SerialNumberInputProps {
    value: string[];
    onChange: (serialNumbers: string[]) => void;
    quantity: number;
    itemName: string;
    required: boolean;
    disabled?: boolean;
    error?: string;
}

export function SerialNumberInput({
    value = [],
    onChange,
    quantity,
    itemName,
    required,
    disabled = false,
    error
}: SerialNumberInputProps) {
    const [serialNumbers, setSerialNumbers] = useState<string[]>(value);

    useEffect(() => {
        setSerialNumbers(value);
    }, [value]);

    useEffect(() => {
        // Auto-adjust serial numbers array when quantity changes
        if (serialNumbers.length < quantity) {
            // Add empty slots if quantity increased
            const updated = [...serialNumbers, ...Array(quantity - serialNumbers.length).fill('')];
            setSerialNumbers(updated);
            onChange(updated);
        } else if (serialNumbers.length > quantity) {
            // Remove excess slots if quantity decreased, but preserve existing data
            const updated = serialNumbers.slice(0, quantity);
            setSerialNumbers(updated);
            onChange(updated);
        }
    }, [quantity, onChange]); // Remove serialNumbers from dependencies to prevent infinite loops

    const handleSerialNumberChange = (index: number, serialNumber: string) => {
        const updated = [...serialNumbers];
        updated[index] = serialNumber.trim();
        setSerialNumbers(updated);
        onChange(updated);
    };

    const addSerialNumber = () => {
        if (serialNumbers.length < quantity) {
            const updated = [...serialNumbers, ''];
            setSerialNumbers(updated);
            onChange(updated);
        }
    };

    const removeSerialNumber = (index: number) => {
        if (serialNumbers.length > 1) {
            const updated = serialNumbers.filter((_, i) => i !== index);
            setSerialNumbers(updated);
            onChange(updated);
        }
    };

    const generateSerialNumbers = () => {
        const timestamp = Date.now();
        const generated = Array.from({ length: quantity }, (_, i) =>
            `SN-${timestamp}-${String(i + 1).padStart(3, '0')}`
        );
        setSerialNumbers(generated);
        onChange(generated);
    };

    const clearAllSerialNumbers = () => {
        const cleared = Array(quantity).fill('');
        setSerialNumbers(cleared);
        onChange(cleared);
    };

    if (!required) {
        return null;
    }

    const filledCount = serialNumbers.filter(sn => sn.trim().length > 0).length;
    const isComplete = filledCount === quantity;
    const hasPartialData = filledCount > 0 && filledCount < quantity;

    return (
        <div className="space-y-3 p-4 border rounded-lg bg-blue-50/30">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-blue-600" />
                    <Label className="text-sm font-medium text-blue-900">
                        Serial Numbers for {itemName} *
                    </Label>
                    <div className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        isComplete ? "bg-green-100 text-green-800" :
                            hasPartialData ? "bg-yellow-100 text-yellow-800" :
                                "bg-gray-100 text-gray-600"
                    )}>
                        {filledCount}/{quantity}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateSerialNumbers}
                        disabled={disabled}
                        className="text-xs"
                    >
                        Auto Generate
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearAllSerialNumbers}
                        disabled={disabled}
                        className="text-xs"
                    >
                        Clear All
                    </Button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
                {Array.from({ length: quantity }, (_, index) => (
                    <div key={index} className="flex gap-2 items-center">
                        <div className="w-8 text-xs text-gray-500 text-center">
                            {index + 1}
                        </div>
                        <Input
                            value={serialNumbers[index] || ''}
                            onChange={(e) => handleSerialNumberChange(index, e.target.value)}
                            placeholder={`Serial number ${index + 1}`}
                            disabled={disabled}
                            className={cn(
                                "flex-1",
                                error && "border-red-500",
                                serialNumbers[index]?.trim() && "border-green-500 bg-green-50/30"
                            )}
                        />
                        {quantity > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSerialNumber(index)}
                                disabled={disabled || serialNumbers.length <= 1}
                                className="text-red-500 hover:text-red-700 p-1"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ))}
            </div>

            {serialNumbers.length < quantity && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSerialNumber}
                    disabled={disabled}
                    className="w-full text-sm"
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Serial Number Slot
                </Button>
            )}

            <div className="text-sm text-muted-foreground">
                {isComplete ? (
                    <span className="text-green-600 font-medium">✓ All serial numbers provided</span>
                ) : hasPartialData ? (
                    <span className="text-yellow-600">
                        {quantity - filledCount} more serial number{quantity - filledCount !== 1 ? 's' : ''} needed
                    </span>
                ) : (
                    <span className="text-gray-600">
                        Please provide {quantity} serial number{quantity !== 1 ? 's' : ''} for this item
                    </span>
                )}
            </div>
        </div>
    );
}