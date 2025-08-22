'use client';

import React, { useState, useEffect, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PriceInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: number;
  onChange?: (value: number | undefined) => void;
  currency?: string;
  decimalPlaces?: number;
  min?: number;
  max?: number;
  showCurrency?: boolean;
  currencyPosition?: 'prefix' | 'suffix';
}

export const PriceInput = forwardRef<HTMLInputElement, PriceInputProps>(
  ({
    value,
    onChange,
    currency = '₹',
    decimalPlaces = 2,
    min = 0,
    max,
    showCurrency = true,
    currencyPosition = 'prefix',
    className,
    disabled,
    ...props
  }, ref) => {
    const [inputValue, setInputValue] = useState<string>('');
    const [isFocused, setIsFocused] = useState(false);

    // Format number to display value
    const formatValue = (num: number | undefined): string => {
      if (num === undefined || num === null || isNaN(num)) return '';
      return num.toFixed(decimalPlaces);
    };

    // Parse input to number
    const parseValue = (str: string): number | undefined => {
      const cleaned = str.replace(/[^\d.-]/g, '');
      const num = parseFloat(cleaned);
      if (isNaN(num)) return undefined;
      return num;
    };

    // Update input value when prop value changes
    useEffect(() => {
      if (!isFocused) {
        setInputValue(formatValue(value));
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      
      // Allow empty input
      if (newValue === '') {
        setInputValue('');
        onChange?.(undefined);
        return;
      }

      // Allow typing decimal point
      if (newValue.endsWith('.') && newValue.split('.').length <= 2) {
        setInputValue(newValue);
        return;
      }

      // Validate and parse the input
      const parsed = parseValue(newValue);
      if (parsed !== undefined) {
        // Apply min/max constraints
        let constrained = parsed;
        if (min !== undefined && parsed < min) constrained = min;
        if (max !== undefined && parsed > max) constrained = max;
        
        setInputValue(newValue);
        onChange?.(constrained);
      }
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
      // Format the value on blur
      setInputValue(formatValue(value));
    };

    return (
      <div className="relative">
        {showCurrency && currencyPosition === 'prefix' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {currency}
          </span>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            showCurrency && currencyPosition === 'prefix' && 'pl-8',
            showCurrency && currencyPosition === 'suffix' && 'pr-8',
            className
          )}
          disabled={disabled}
          {...props}
        />
        {showCurrency && currencyPosition === 'suffix' && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {currency}
          </span>
        )}
      </div>
    );
  }
);

PriceInput.displayName = 'PriceInput';