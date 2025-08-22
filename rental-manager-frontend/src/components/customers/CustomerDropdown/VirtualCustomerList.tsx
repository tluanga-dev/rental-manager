'use client';

import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { User, Building2, AlertCircle } from 'lucide-react';
import type { Customer } from '@/types/customer';
import { createCustomerOption } from '@/utils/customer-utils';
import { cn } from '@/lib/utils';

interface VirtualCustomerListProps {
  customers: Customer[];
  selectedId?: string;
  highlightedIndex: number;
  onSelect: (customer: Customer) => void;
  showCode?: boolean;
  showTier?: boolean;
  showCreditInfo?: boolean;
  showLastTransaction?: boolean;
  excludeBlacklisted?: boolean;
  height?: number;
  itemHeight?: number;
}

interface CustomerItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    customers: Customer[];
    selectedId?: string;
    highlightedIndex: number;
    onSelect: (customer: Customer) => void;
    showCode?: boolean;
    showTier?: boolean;
    showCreditInfo?: boolean;
    showLastTransaction?: boolean;
    excludeBlacklisted?: boolean;
  };
}

const CustomerItem: React.FC<CustomerItemProps> = ({ index, style, data }) => {
  const {
    customers,
    selectedId,
    highlightedIndex,
    onSelect,
    showCode = true,
    showTier = true,
    showCreditInfo = false,
    showLastTransaction = false,
    excludeBlacklisted = false,
  } = data;

  const customer = customers[index];
  if (!customer) return null;

  const option = createCustomerOption(customer, selectedId, highlightedIndex, index);
  const CustomerIcon = customer.type === 'BUSINESS' ? Building2 : User;

  return (
    <div
      style={style}
      className={cn(
        'px-3 py-3 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0',
        'hover:bg-gray-100',
        option.isHighlighted && 'bg-gray-100',
        option.isSelected && 'bg-slate-50 text-slate-900'
      )}
      onClick={() => onSelect(customer)}
      role="option"
      aria-selected={option.isSelected}
    >
      <div className="flex items-start justify-between h-full">
        <div className="flex items-start space-x-2 flex-1 min-w-0">
          <CustomerIcon className="h-4 w-4 mt-0.5 text-gray-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-medium truncate">{customer.name}</span>
              {showTier && (
                <span
                  className="px-2 py-0.5 text-xs font-medium rounded-full text-white flex-shrink-0"
                  style={{ backgroundColor: option.tierColor }}
                >
                  {customer.tier}
                </span>
              )}
            </div>
            
            {showCode && (
              <div className="text-sm text-gray-500 truncate">
                {customer.code}
              </div>
            )}
            
            {showCreditInfo && customer.credit_limit && (
              <div className="text-sm text-gray-600">
                Credit: ₹{customer.credit_limit.toLocaleString()}
              </div>
            )}
            
            {showLastTransaction && customer.last_transaction_date && (
              <div className="text-sm text-gray-500">
                Last: {new Date(customer.last_transaction_date).toLocaleDateString()}
              </div>
            )}
            
            {option.hasWarning && (
              <div className="text-sm text-red-600 flex items-center mt-1">
                <AlertCircle className="h-3 w-3 mr-1" />
                {option.warningMessage}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col space-y-1">
          {customer.blacklist_status === 'BLACKLISTED' && (
            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded flex-shrink-0">
              Blacklisted
            </span>
          )}
          
          {customer.status === 'inactive' && (
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded flex-shrink-0">
              Inactive
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export function VirtualCustomerList({
  customers,
  selectedId,
  highlightedIndex,
  onSelect,
  showCode = true,
  showTier = true,
  showCreditInfo = false,
  showLastTransaction = false,
  excludeBlacklisted = false,
  height = 300,
  itemHeight = 60,
}: VirtualCustomerListProps) {
  const itemData = useMemo(() => ({
    customers,
    selectedId,
    highlightedIndex,
    onSelect,
    showCode,
    showTier,
    showCreditInfo,
    showLastTransaction,
    excludeBlacklisted,
  }), [
    customers, 
    selectedId, 
    highlightedIndex, 
    onSelect, 
    showCode, 
    showTier, 
    showCreditInfo, 
    showLastTransaction, 
    excludeBlacklisted
  ]);

  // Calculate the actual height based on available items
  const actualHeight = Math.min(height, customers.length * itemHeight);

  // Adjust item height based on what information is shown
  const dynamicItemHeight = useMemo(() => {
    let baseHeight = 60; // Base height for name and code
    
    if (showCreditInfo) baseHeight += 20;
    if (showLastTransaction) baseHeight += 20;
    
    return Math.max(itemHeight, baseHeight);
  }, [itemHeight, showCreditInfo, showLastTransaction]);

  return (
    <List
      height={actualHeight}
      itemCount={customers.length}
      itemSize={dynamicItemHeight}
      itemData={itemData}
      width="100%"
      className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
    >
      {CustomerItem}
    </List>
  );
}