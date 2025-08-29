'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Edit2, Check, X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { inventoryUnitsApi } from '@/services/api/inventory';
import type { 
  SalePriceEditorProps, 
  SalePriceDisplayProps, 
  SalePriceInputProps 
} from './SalePriceEditor.types';

// Display component - shows the price with optional change button
function SalePriceDisplay({ 
  price, 
  currency = '₹', 
  onEditClick,
  showChangeButton = true,
  className 
}: SalePriceDisplayProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className="font-semibold text-green-900">
        {currency}{price}
      </span>
      {showChangeButton && onEditClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEditClick}
          className="ml-2 h-6 px-2 text-xs hover:bg-green-50 border-green-200"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          Change
        </Button>
      )}
    </div>
  );
}

// Input component - shows the editable input with save/cancel buttons
function SalePriceInput({
  value,
  onChange,
  onSave,
  onCancel,
  loading = false,
  minPrice = 0.01,
  maxPrice = 99999,
  placeholder = "Enter price",
  currency = '₹',
  error,
  className
}: SalePriceInputProps) {
  const [inputValue, setInputValue] = useState(value.toString());
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update input value when prop changes, but not during editing
  const [isUserEditing, setIsUserEditing] = useState(false);
  
  useEffect(() => {
    if (!isUserEditing) {
      setInputValue(value.toString());
    }
  }, [value, isUserEditing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsUserEditing(true);
    
    // Clear validation errors on change
    setValidationError(null);
  };

  const handleSave = () => {
    // Get the current value from the DOM input
    const currentDOMValue = inputRef.current?.value || inputValue;
    const numValue = parseFloat(currentDOMValue);
    
    // Validate input
    if (isNaN(numValue)) {
      setValidationError('Please enter a valid number');
      return;
    }
    
    if (numValue < minPrice) {
      setValidationError(`Price must be at least ${currency}${minPrice}`);
      return;
    }
    
    if (numValue > maxPrice) {
      setValidationError(`Price cannot exceed ${currency}${maxPrice}`);
      return;
    }
    
    // Clear errors and save
    setValidationError(null);
    setIsUserEditing(false);
    onChange(numValue);
    onSave(numValue);
  };

  const handleCancel = () => {
    setInputValue(value.toString());
    setValidationError(null);
    setIsUserEditing(false);
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            min={minPrice}
            max={maxPrice}
            step="0.01"
            className={cn(
              "text-sm font-semibold pr-8",
              (validationError || error) && "border-red-500 focus:border-red-500"
            )}
            disabled={loading}
            autoFocus
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
            {currency}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading || !inputValue.trim()}
            className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="h-8 w-8 p-0 hover:bg-red-50 border-red-200"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      {(validationError || error) && (
        <p className="text-red-500 text-xs mt-1">{validationError || error}</p>
      )}
    </div>
  );
}

// Main SalePriceEditor component
export function SalePriceEditor({
  currentPrice,
  unitId,
  currency = '₹',
  editable = true,
  showChangeButton = true,
  onPriceChange,
  onCancel,
  className,
  loading: externalLoading = false,
  minPrice = 0.01,
  maxPrice = 99999,
  showErrors = true,
  placeholder = "Enter price"
}: SalePriceEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localPrice, setLocalPrice] = useState(currentPrice);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Update local price when currentPrice prop changes
  useEffect(() => {
    setLocalPrice(currentPrice);
  }, [currentPrice]);

  const handleEditClick = useCallback(() => {
    if (!editable) return;
    setIsEditing(true);
    setError(null);
  }, [editable]);

  const handlePriceChange = useCallback((newPrice: number) => {
    setLocalPrice(newPrice);
  }, []);

  const handleSave = useCallback(async (newPrice?: number) => {
    if (!editable || isLoading || externalLoading) return;
    
    const priceToSave = newPrice ?? localPrice;
    
    try {
      setIsLoading(true);
      setError(null);

      // Update via API if unitId is provided
      if (unitId) {
        await inventoryUnitsApi.updateSalePrice(unitId, priceToSave);
      }

      // Update local state
      if (onPriceChange) {
        await onPriceChange(priceToSave);
      }
      
      setLocalPrice(priceToSave);
      setIsEditing(false);
      
      // Show success toast
      toast({
        title: "Sale Price Updated Successfully",
        description: `Sale price updated to ${currency}${priceToSave}`,
        variant: "default",
      });
      
    } catch (error) {
      console.error('Failed to save sale price:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save price';
      
      if (showErrors) {
        setError(errorMessage);
      }
      
      toast({
        title: "Failed to Update Price",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    editable, 
    isLoading, 
    externalLoading, 
    unitId,
    localPrice, 
    onPriceChange, 
    showErrors,
    currency,
    toast
  ]);

  const handleCancel = useCallback(() => {
    setLocalPrice(currentPrice);
    setIsEditing(false);
    setError(null);
    onCancel?.();
  }, [currentPrice, onCancel]);

  const loading = isLoading || externalLoading;

  if (!editable && !showChangeButton) {
    // Read-only display
    return (
      <span className={cn('font-semibold text-green-900', className)}>
        {currency}{currentPrice}
      </span>
    );
  }

  return (
    <div className={cn('min-w-0', className)}>
      {isEditing ? (
        <SalePriceInput
          value={localPrice}
          onChange={handlePriceChange}
          onSave={handleSave}
          onCancel={handleCancel}
          loading={loading}
          minPrice={minPrice}
          maxPrice={maxPrice}
          placeholder={placeholder}
          currency={currency}
          error={showErrors ? error : undefined}
        />
      ) : (
        <SalePriceDisplay
          price={localPrice}
          currency={currency}
          onEditClick={handleEditClick}
          showChangeButton={showChangeButton && editable}
        />
      )}
    </div>
  );
}

export default SalePriceEditor;