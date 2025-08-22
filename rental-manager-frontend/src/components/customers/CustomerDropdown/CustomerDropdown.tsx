'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown, X, Search, AlertCircle, Plus, User, Building2 } from 'lucide-react';
import { useCustomerSearch } from '../hooks/useCustomerSearch';
import { useClickOutside } from '@/hooks/use-click-outside';
import { CustomerDropdownProps } from './CustomerDropdown.types';
import { VirtualCustomerList } from './VirtualCustomerList';
import { usePerformanceTracking } from '@/utils/performance-monitor';
import { createCustomerOption, addToRecentCustomers } from '@/utils/customer-utils';
import type { Customer } from '@/types/customer';
import { cn } from '@/lib/utils';

export function CustomerDropdown({
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder = 'Search or select a customer...',
  disabled = false,
  error = false,
  helperText,
  size = 'medium',
  fullWidth = false,
  className,
  name,
  id,
  required = false,
  searchable = true,
  clearable = true,
  virtualScroll = false,
  showCode = true,
  showTier = true,
  showCreditInfo = false,
  showLastTransaction = false,
  allowAddNew = false,
  includeInactive = false,
  excludeBlacklisted = false,
  customerType = 'all',
  minTier,
  maxResults = 100,
  showRecentCustomers = false,
  recentCustomersLimit = 5,
  debounceMs = 300,
  cacheTime,
  staleTime,
  filterByTransactionHistory = false,
  requireCreditCheck = false,
}: CustomerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Performance tracking
  const { trackRender, trackSearch, trackSelection, startTimer, endTimer } = 
    usePerformanceTracking('CustomerDropdown');

  const {
    customers,
    searchTerm,
    isLoading,
    error: fetchError,
    handleSearch,
    clearSearch,
    refetch,
  } = useCustomerSearch({
    customerType,
    includeInactive,
    limit: maxResults,
    debounceMs,
    cacheTime,
    staleTime,
  });

  // Filter customers based on props
  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Exclude blacklisted if required
    if (excludeBlacklisted) {
      filtered = filtered.filter(customer => customer.blacklist_status === 'CLEAR');
    }

    // Filter by minimum tier if specified
    if (minTier) {
      const tierOrder = { 'BRONZE': 1, 'SILVER': 2, 'GOLD': 3, 'PLATINUM': 4 };
      const minTierLevel = tierOrder[minTier];
      filtered = filtered.filter(customer => tierOrder[customer.tier] >= minTierLevel);
    }

    // Filter by transaction history if required
    if (filterByTransactionHistory) {
      filtered = filtered.filter(customer => customer.last_transaction_date);
    }

    return filtered;
  }, [customers, excludeBlacklisted, minTier, filterByTransactionHistory]);

  // Find selected customer
  const selectedCustomer = useMemo(() => {
    if (!value) return null;
    return filteredCustomers.find((c: Customer) => c.id === value) || null;
  }, [value, filteredCustomers]);

  // Display value in input
  const inputValue = useMemo(() => {
    if (searchTerm) return searchTerm;
    if (selectedCustomer) return selectedCustomer.name;
    return '';
  }, [searchTerm, selectedCustomer]);

  // Handle click outside
  useClickOutside(dropdownRef, () => {
    if (isOpen) {
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (!selectedCustomer) {
        clearSearch();
      }
    }
  });

  // Handle customer selection
  const handleSelect = useCallback((customer: Customer) => {
    startTimer('selection');
    onChange?.(customer.id, customer);
    addToRecentCustomers(customer.id);
    setIsOpen(false);
    setHighlightedIndex(-1);
    clearSearch();
    inputRef.current?.blur();
    endTimer('selection', { customerId: customer.id, customerName: customer.name });
  }, [onChange, clearSearch, startTimer, endTimer]);

  // Handle clear
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('', null as any);
    clearSearch();
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, [onChange, clearSearch]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    startTimer('search');
    handleSearch(value);
    if (!isOpen) {
      setIsOpen(true);
    }
    setHighlightedIndex(-1);
  }, [handleSearch, isOpen, startTimer]);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    onFocus?.();
    setIsOpen(true);
  }, [onFocus]);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredCustomers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredCustomers[highlightedIndex]) {
          handleSelect(filteredCustomers[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (!selectedCustomer) {
          clearSearch();
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, filteredCustomers, highlightedIndex, handleSelect, selectedCustomer, clearSearch]);

  // Track search results and component render
  useEffect(() => {
    if (!isLoading && searchTerm) {
      const duration = endTimer('search');
      if (duration !== null) {
        trackSearch(searchTerm, filteredCustomers.length, duration);
      }
    }
  }, [filteredCustomers, isLoading, searchTerm, endTimer, trackSearch]);

  // Track component renders
  useEffect(() => {
    trackRender({ 
      customersCount: filteredCustomers.length, 
      isOpen, 
      hasSearchTerm: !!searchTerm,
      virtualScrollEnabled: virtualScroll && filteredCustomers.length > 20
    });
  }, [filteredCustomers.length, isOpen, searchTerm, virtualScroll, trackRender]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [highlightedIndex]);

  // Size classes
  const sizeClasses = {
    small: 'h-8 text-sm',
    medium: 'h-10 text-base',
    large: 'h-12 text-lg',
  };

  const hasError = error || !!fetchError;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'relative',
        fullWidth ? 'w-full' : 'w-[320px]',
        className
      )}
    >
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={!searchable}
          required={required}
          className={cn(
            'w-full rounded-md border bg-white px-3 pr-10 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            sizeClasses[size],
            hasError
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-slate-500 focus:ring-slate-500',
            disabled && 'cursor-not-allowed bg-gray-50 opacity-60',
            !searchable && 'cursor-pointer'
          )}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="customer-dropdown-list"
          aria-invalid={hasError}
          aria-describedby={helperText ? 'customer-dropdown-helper' : undefined}
        />

        {/* Icons */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2" />
          )}
          {!isLoading && hasError && (
            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
          )}
          {!isLoading && !hasError && clearable && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded pointer-events-auto"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-500 transition-transform ml-1',
              isOpen && 'transform rotate-180'
            )}
          />
        </div>
      </div>

      {/* Helper text */}
      {helperText && (
        <p
          id="customer-dropdown-helper"
          className={cn(
            'mt-1 text-sm',
            hasError ? 'text-red-600' : 'text-gray-500'
          )}
        >
          {helperText}
        </p>
      )}

      {/* Dropdown list */}
      {isOpen && (
        <div
          id="customer-dropdown-list"
          ref={listRef}
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border border-gray-200',
            'bg-white shadow-lg max-h-60 overflow-auto',
            'focus:outline-none'
          )}
          role="listbox"
          aria-label="Customers"
        >
          {/* Add New Customer Option */}
          {allowAddNew && searchTerm && (
            <div
              className="px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-slate-50 flex items-center"
              onClick={() => {
                // TODO: Implement add new customer functionality
                console.log('Add new customer:', searchTerm);
              }}
            >
              <Plus className="h-4 w-4 text-slate-600 mr-2" />
              <span className="text-slate-600 font-medium">
                Add "{searchTerm}" as new customer
              </span>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="px-3 py-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2" />
              Loading customers...
            </div>
          )}

          {/* Error state */}
          {!isLoading && fetchError && (
            <div className="px-3 py-8 text-center">
              <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600 mb-2">
                Failed to load customers
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-sm text-slate-600 hover:text-slate-800 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* No results */}
          {!isLoading && !fetchError && filteredCustomers.length === 0 && (
            <div className="px-3 py-8 text-center text-gray-500">
              <Search className="h-6 w-6 mx-auto mb-2 text-gray-400" />
              {searchTerm ? (
                <div>
                  <p>No customers found for "{searchTerm}"</p>
                  {allowAddNew && (
                    <button
                      type="button"
                      className="mt-2 text-sm text-slate-600 hover:text-slate-800 underline"
                      onClick={() => {
                        // TODO: Implement add new customer functionality
                        console.log('Add new customer:', searchTerm);
                      }}
                    >
                      Add as new customer
                    </button>
                  )}
                </div>
              ) : (
                <p>No customers available</p>
              )}
            </div>
          )}

          {/* Customer list */}
          {!isLoading && !fetchError && filteredCustomers.length > 0 && (
            <>
              {virtualScroll && filteredCustomers.length > 20 ? (
                <VirtualCustomerList
                  customers={filteredCustomers}
                  selectedId={value}
                  highlightedIndex={highlightedIndex}
                  onSelect={handleSelect}
                  showCode={showCode}
                  showTier={showTier}
                  showCreditInfo={showCreditInfo}
                  showLastTransaction={showLastTransaction}
                  excludeBlacklisted={excludeBlacklisted}
                  height={300}
                  itemHeight={showCreditInfo || showLastTransaction ? 80 : 60}
                />
              ) : (
                filteredCustomers.map((customer: Customer, index: number) => {
                  const option = createCustomerOption(customer, value, highlightedIndex, index);
                  const CustomerIcon = customer.type === 'BUSINESS' ? Building2 : User;
                  
                  return (
                    <div
                      key={customer.id}
                      className={cn(
                        'px-3 py-3 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0',
                        'hover:bg-gray-100',
                        option.isHighlighted && 'bg-gray-100',
                        option.isSelected && 'bg-slate-50 text-slate-900'
                      )}
                      onClick={() => handleSelect(customer)}
                      role="option"
                      aria-selected={option.isSelected}
                    >
                      <div className="flex items-start justify-between">
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
                            
                            {(showCreditInfo && customer.credit_limit) && (
                              <div className="text-sm text-gray-600">
                                Credit: ₹{customer.credit_limit.toLocaleString()}
                              </div>
                            )}
                            
                            {(showLastTransaction && customer.last_transaction_date) && (
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
                  );
                })
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}