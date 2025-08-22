'use client';

import React from 'react';
import { PaymentMethod, PaymentMethodInfo } from '@/types/payment';
import { ChevronDown } from 'lucide-react';

interface PaymentMethodSelectorProps {
  value: PaymentMethod | '';
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'Select payment method'
}) => {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PaymentMethod)}
        disabled={disabled}
        className={`w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <option value="">{placeholder}</option>
        {Object.entries(PaymentMethod).map(([key, method]) => {
          const info = PaymentMethodInfo[method];
          return (
            <option key={method} value={method}>
              {info.icon} {info.label}
            </option>
          );
        })}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
};