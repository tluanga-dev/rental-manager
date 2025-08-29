'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Edit2, Check, X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { itemsApi } from '@/services/api/items';
import type { 
  RentalRateEditorProps, 
  RentalRateDisplayProps, 
  RentalRateInputProps 
} from './RentalRateEditor.types';

// Display component - shows the rate with optional change button
function RentalRateDisplay({ 
  rate, 
  currency = '₹', 
  periodText = 'period', 
  onEditClick,
  showChangeButton = true,
  className 
}: RentalRateDisplayProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className="font-semibold text-blue-900">
        {currency}{rate}/{periodText}
      </span>
      {showChangeButton && onEditClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEditClick}
          className="ml-2 h-6 px-2 text-xs hover:bg-blue-50 border-blue-200"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          Change
        </Button>
      )}
    </div>
  );
}

// Input component - shows the editable input with save/cancel buttons
function RentalRateInput({
  value,
  onChange,
  onSave,
  onCancel,
  loading = false,
  minRate = 0.01,
  maxRate = 99999,
  placeholder = "Enter rate",
  currency = '₹',
  periodText = 'period',
  error,
  className
}: RentalRateInputProps) {
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
    setIsUserEditing(true); // Mark that user is actively editing
    
    // Clear validation errors on change
    setValidationError(null);
    
    // Don't call onChange here - only update local input value
    // The onChange will be called when user saves, not on every keystroke
  };

  const handleSave = () => {
    // Get the current value from the DOM input (handles cases where React state might be stale)
    const currentDOMValue = inputRef.current?.value || inputValue;
    const numValue = parseFloat(currentDOMValue);
    
    // Validate input
    if (isNaN(numValue)) {
      setValidationError('Please enter a valid number');
      return;
    }
    
    if (numValue < minRate) {
      setValidationError(`Rate must be at least ${currency}${minRate}`);
      return;
    }
    
    if (numValue > maxRate) {
      setValidationError(`Rate cannot exceed ${currency}${maxRate}`);
      return;
    }
    
    // Clear errors and save - pass the new value directly to onSave
    setValidationError(null);
    setIsUserEditing(false); // User finished editing
    console.log('RentalRateInput: handleSave - inputValue:', inputValue, 'numValue:', numValue);
    onChange(numValue); // Update local state
    onSave(numValue); // Pass the new value directly to save handler
  };

  const handleCancel = () => {
    setInputValue(value.toString()); // Reset input to original value
    setValidationError(null);
    setIsUserEditing(false); // User finished editing (cancelled)
    // Don't call onChange here - we're canceling, so no state change should happen
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
            min={minRate}
            max={maxRate}
            step="0.01"
            className={cn(
              "text-sm font-semibold pr-16",
              (validationError || error) && "border-red-500 focus:border-red-500"
            )}
            disabled={loading}
            autoFocus
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
            {currency}/{periodText}
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

// Main RentalRateEditor component
export function RentalRateEditor({
  currentRate,
  itemId,
  periodText = 'period',
  currency = '₹',
  editable = true,
  showChangeButton = true,
  saveToMaster = true,
  onRateChange,
  onMasterDataUpdate,
  onCancel,
  className,
  loading: externalLoading = false,
  minRate = 0.01,
  maxRate = 99999,
  showErrors = true,
  placeholder = "Enter rate"
}: RentalRateEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localRate, setLocalRate] = useState(currentRate);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Update local rate when currentRate prop changes
  useEffect(() => {
    setLocalRate(currentRate);
  }, [currentRate]);

  const handleEditClick = useCallback(() => {
    if (!editable) return;
    setIsEditing(true);
    setError(null);
  }, [editable]);

  const handleRateChange = useCallback((newRate: number) => {
    setLocalRate(newRate);
    // Don't call onRateChange here - only call it when user saves
  }, []);

  const handleSave = useCallback(async (newRate?: number) => {
    if (!editable || isLoading || externalLoading) return;
    
    // Use the passed value or fall back to localRate
    const rateToSave = newRate ?? localRate;
    console.log('RentalRateEditor: handleSave - newRate:', newRate, 'localRate:', localRate, 'rateToSave:', rateToSave);
    
    try {
      setIsLoading(true);
      setError(null);

      // Save to master data if enabled and itemId provided
      if (saveToMaster && itemId) {
        try {
          if (onMasterDataUpdate) {
            await onMasterDataUpdate(itemId, rateToSave);
          } else {
            // Fallback to direct API call
            await itemsApi.updateRentalRate(itemId, rateToSave);
          }
        } catch (masterError) {
          console.error('Failed to update master data:', masterError);
          
          // Show error but don't prevent local rate change
          if (showErrors) {
            setError('Rate updated locally but failed to save to master data');
          }
        }
      }

      // Always update local state (await if it's async)
      if (onRateChange) {
        await onRateChange(rateToSave);
      }
      
      // Update local state after successful save
      setLocalRate(rateToSave);
      setIsEditing(false);
      
      // Show success toast only if we reach here without errors
      toast({
        title: "Rate Updated Successfully",
        description: `Rental rate updated to ${currency}${rateToSave}/${periodText}${saveToMaster && itemId ? ' and saved to master data' : ''}`,
        variant: "default",
      });
      
    } catch (error) {
      console.error('Failed to save rental rate:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save rate';
      
      if (showErrors) {
        setError(errorMessage);
      }
      
      // Show error toast
      toast({
        title: "Failed to Update Rate",
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
    saveToMaster, 
    itemId, 
    localRate, 
    onMasterDataUpdate, 
    onRateChange, 
    showErrors,
    currency,
    periodText,
    toast
  ]);

  const handleCancel = useCallback(() => {
    setLocalRate(currentRate); // Reset to original rate
    setIsEditing(false);
    setError(null);
    onCancel?.();
  }, [currentRate, onCancel]);

  const loading = isLoading || externalLoading;

  if (!editable && !showChangeButton) {
    // Read-only display
    return (
      <span className={cn('font-semibold text-blue-900', className)}>
        {currency}{currentRate}/{periodText}
      </span>
    );
  }

  return (
    <div className={cn('min-w-0', className)}>
      {isEditing ? (
        <RentalRateInput
          value={localRate}
          onChange={handleRateChange}
          onSave={handleSave}
          onCancel={handleCancel}
          loading={loading}
          minRate={minRate}
          maxRate={maxRate}
          placeholder={placeholder}
          currency={currency}
          periodText={periodText}
          error={showErrors ? error : undefined}
        />
      ) : (
        <RentalRateDisplay
          rate={localRate}
          currency={currency}
          periodText={periodText}
          onEditClick={handleEditClick}
          showChangeButton={showChangeButton && editable}
        />
      )}
    </div>
  );
}

export default RentalRateEditor;