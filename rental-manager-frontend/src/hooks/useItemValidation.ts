'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { itemsApi } from '@/services/api/items';
import { ErrorParser } from '@/utils/error-parser';
import { ErrorType, ErrorDetails, ConflictErrorData } from '@/types/error';
import type { CreateItemRequest } from '@/types/item';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  conflictData?: ConflictErrorData;
  suggestions?: string[];
}

export interface UseItemValidationOptions {
  onValidationSuccess?: (data: ValidationResult) => void;
  onValidationError?: (error: ErrorDetails, conflictData?: ConflictErrorData) => void;
  enablePreValidation?: boolean;
}

export function useItemValidation(options: UseItemValidationOptions = {}) {
  const [validationState, setValidationState] = useState<{
    isValidating: boolean;
    lastValidation: ValidationResult | null;
    hasValidated: boolean;
  }>({
    isValidating: false,
    lastValidation: null,
    hasValidated: false
  });

  // Pre-validation check for duplicate items
  const preValidationMutation = useMutation({
    mutationFn: async (itemName: string): Promise<ValidationResult> => {
      try {
        // Search for existing items with the same name
        const existingItems = await itemsApi.search(itemName, 5);
        
        // Check for exact name matches
        const exactMatch = existingItems.find(
          item => item.item_name.toLowerCase().trim() === itemName.toLowerCase().trim()
        );

        if (exactMatch) {
          const conflictData: ConflictErrorData = {
            conflictingResource: {
              id: exactMatch.id,
              name: exactMatch.item_name,
              type: 'Item',
              createdAt: new Date().toISOString() // API doesn't provide this, using current time
            },
            suggestedAlternatives: ErrorParser['generateAlternativeNames'](itemName),
            allowOverwrite: false
          };

          return {
            isValid: false,
            errors: [`An item with the name "${itemName}" already exists.`],
            conflictData,
            suggestions: [
              'Choose a different name for your item',
              'Check if you intended to update the existing item instead',
              'View the existing item to see if it meets your needs'
            ]
          };
        }

        // Check for similar name matches (potential typos or variations)
        const similarItems = existingItems.filter(
          item => item.item_name.toLowerCase().includes(itemName.toLowerCase()) ||
                  itemName.toLowerCase().includes(item.item_name.toLowerCase())
        );

        if (similarItems.length > 0) {
          return {
            isValid: true, // Not blocking, just warning
            errors: [],
            suggestions: [
              `Found ${similarItems.length} similar item(s). Make sure this isn't a duplicate.`,
              'Review similar items: ' + similarItems.map(item => item.item_name).join(', ')
            ]
          };
        }

        return {
          isValid: true,
          errors: []
        };

      } catch (error: any) {
        // Handle API errors during validation
        const errorDetails = ErrorParser.parseAxiosError(error);
        
        return {
          isValid: false,
          errors: [errorDetails.message],
          suggestions: errorDetails.suggestions
        };
      }
    },
    onSuccess: (result) => {
      setValidationState(prev => ({
        ...prev,
        isValidating: false,
        lastValidation: result,
        hasValidated: true
      }));

      if (result.isValid) {
        options.onValidationSuccess?.(result);
      } else if (result.conflictData) {
        const errorDetails: ErrorDetails = {
          type: ErrorType.DUPLICATE_RESOURCE,
          severity: 'LOW',
          title: 'Item Already Exists',
          message: result.errors[0] || 'An item with this name already exists.',
          suggestions: result.suggestions,
          actions: [
            {
              label: 'Try Different Name',
              action: 'suggest_alternatives',
              variant: 'default'
            },
            {
              label: 'View Existing Item',
              action: 'view_existing',
              variant: 'outline'
            },
            {
              label: 'Cancel',
              action: 'cancel',
              variant: 'secondary'
            }
          ]
        };
        options.onValidationError?.(errorDetails, result.conflictData);
      }
    },
    onError: (error: any) => {
      const errorDetails = ErrorParser.parseAxiosError(error);
      setValidationState(prev => ({
        ...prev,
        isValidating: false,
        hasValidated: true
      }));
      options.onValidationError?.(errorDetails);
    }
  });

  // Full item validation (includes format, required fields, etc.)
  const fullValidationMutation = useMutation({
    mutationFn: async (itemData: CreateItemRequest): Promise<ValidationResult> => {
      const errors: string[] = [];

      // Basic required field validation
      if (!itemData.item_name?.trim()) {
        errors.push('Item name is required');
      }

      if (!itemData.sku?.trim()) {
        errors.push('SKU is required');
      }

      if (!itemData.category_id) {
        errors.push('Category is required');
      }

      if (!itemData.brand_id) {
        errors.push('Brand is required');
      }

      // Price validation
      if (itemData.is_rentable && (!itemData.rental_rate_per_period || itemData.rental_rate_per_period <= 0)) {
        errors.push('Rental rate must be greater than 0 for rentable items');
      }

      if (itemData.is_saleable && (!itemData.sale_price || itemData.sale_price <= 0)) {
        errors.push('Sale price must be greater than 0 for saleable items');
      }

      // If basic validation fails, return early
      if (errors.length > 0) {
        return {
          isValid: false,
          errors,
          suggestions: [
            'Please fill in all required fields',
            'Ensure prices are greater than 0 for rentable/saleable items'
          ]
        };
      }

      // Check for duplicates if pre-validation wasn't done
      if (options.enablePreValidation !== false && itemData.item_name) {
        try {
          const existingItems = await itemsApi.search(itemData.item_name, 5);
          const exactMatch = existingItems.find(
            item => item.item_name.toLowerCase().trim() === itemData.item_name.toLowerCase().trim()
          );

          if (exactMatch) {
            const conflictData: ConflictErrorData = {
              conflictingResource: {
                id: exactMatch.id,
                name: exactMatch.item_name,
                type: 'Item'
              },
              suggestedAlternatives: ErrorParser['generateAlternativeNames'](itemData.item_name),
              allowOverwrite: false
            };

            return {
              isValid: false,
              errors: [`An item with the name "${itemData.item_name}" already exists.`],
              conflictData,
              suggestions: [
                'Choose a different name for your item',
                'Check if you intended to update the existing item instead'
              ]
            };
          }
        } catch (duplicateError) {
          // If duplicate check fails, continue with validation
          console.warn('Duplicate check failed during validation:', duplicateError);
        }
      }

      return {
        isValid: true,
        errors: []
      };
    }
  });

  // Validate item name for duplicates
  const validateItemName = useCallback((itemName: string) => {
    if (!itemName?.trim()) return;

    setValidationState(prev => ({ ...prev, isValidating: true }));
    preValidationMutation.mutate(itemName);
  }, [preValidationMutation]);

  // Validate full item data
  const validateItem = useCallback((itemData: CreateItemRequest) => {
    setValidationState(prev => ({ ...prev, isValidating: true }));
    fullValidationMutation.mutate(itemData);
  }, [fullValidationMutation]);

  // Clear validation state
  const clearValidation = useCallback(() => {
    setValidationState({
      isValidating: false,
      lastValidation: null,
      hasValidated: false
    });
  }, []);

  return {
    // State
    isValidating: validationState.isValidating || preValidationMutation.isPending || fullValidationMutation.isPending,
    lastValidation: validationState.lastValidation,
    hasValidated: validationState.hasValidated,
    
    // Actions
    validateItemName,
    validateItem,
    clearValidation,
    
    // Helper functions
    isItemNameValid: validationState.lastValidation?.isValid ?? true,
    validationErrors: validationState.lastValidation?.errors ?? [],
    validationSuggestions: validationState.lastValidation?.suggestions ?? [],
    conflictData: validationState.lastValidation?.conflictData,
  };
}