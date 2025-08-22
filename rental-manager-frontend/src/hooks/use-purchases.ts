import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// import { toast } from 'sonner';
import { purchasesApi } from '@/services/api/purchases';
import type {
  Purchase,
  PurchaseReturn,
  PurchaseFormData,
  PurchaseReturnFormData,
  PurchaseFilters,
  PurchaseReturnFilters,
  PurchaseAnalytics,
  PurchaseReturnValidation
} from '@/types/purchases';

// Purchase Management Hook
export function usePurchases(filters?: PurchaseFilters) {
  const [localFilters, setLocalFilters] = useState<PurchaseFilters>(filters || {});

  const {
    data: purchasesData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['purchases', localFilters],
    queryFn: () => purchasesApi.getPurchases(localFilters),
    keepPreviousData: true,
  });

  const updateFilters = useCallback((newFilters: Partial<PurchaseFilters>) => {
    setLocalFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setLocalFilters({});
  }, []);

  return {
    purchases: purchasesData?.items || [],
    total: purchasesData?.total || 0,
    skip: purchasesData?.skip || 0,
    limit: purchasesData?.limit || 20,
    isLoading,
    error,
    filters: localFilters,
    updateFilters,
    resetFilters,
    refetch
  };
}

// Single Purchase Hook
export function usePurchase(id: string) {
  return useQuery({
    queryKey: ['purchase', id],
    queryFn: () => purchasesApi.getPurchaseById(id),
    enabled: !!id,
  });
}

// Purchase Creation Hook with improved debouncing
const PURCHASE_SUBMISSION_DEBOUNCE_MS = parseInt(
  process.env.NEXT_PUBLIC_PURCHASE_DEBOUNCE_MS || '1000'
); // Default 1 second, configurable

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Calculate remaining wait time
  const getRemainingWaitTime = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastSubmissionTime;
    const remaining = PURCHASE_SUBMISSION_DEBOUNCE_MS - elapsed;
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }, [lastSubmissionTime]);

  return useMutation({
    mutationFn: async (data: PurchaseFormData & { bypassDebounce?: boolean }) => {
      const now = Date.now();
      const timeSinceLastSubmission = now - lastSubmissionTime;
      
      // Skip debouncing if:
      // 1. It's the first submission (lastSubmissionTime === 0)
      // 2. Enough time has passed
      // 3. bypassDebounce flag is set (for error retries)
      if (
        lastSubmissionTime > 0 && 
        timeSinceLastSubmission < PURCHASE_SUBMISSION_DEBOUNCE_MS &&
        !data.bypassDebounce
      ) {
        const remainingSeconds = getRemainingWaitTime();
        throw new Error(`Please wait ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''} before submitting again`);
      }
      
      // Only update last submission time on actual submission attempt
      setLastSubmissionTime(now);
      setIsDebouncing(true);
      
      // Set a timeout to clear the debouncing state
      setTimeout(() => {
        setIsDebouncing(false);
      }, PURCHASE_SUBMISSION_DEBOUNCE_MS);

      // Validate serial numbers for uniqueness within the purchase
      const allSerialNumbers: string[] = [];
      for (const item of data.items) {
        if (item.serial_numbers && item.serial_numbers.length > 0) {
          for (const serial of item.serial_numbers) {
            if (serial && serial.trim()) {
              const trimmedSerial = serial.trim();
              if (allSerialNumbers.includes(trimmedSerial)) {
                throw new Error(`Duplicate serial number found within this purchase: ${trimmedSerial}`);
              }
              allSerialNumbers.push(trimmedSerial);
            }
          }
        }
      }

      // Clean up serial numbers before sending
      const cleanedData = {
        ...data,
        items: data.items.map(item => ({
          ...item,
          serial_numbers: item.serial_numbers?.filter(s => s && s.trim()).map(s => s.trim()) || undefined,
        })),
      };

      return purchasesApi.recordPurchase(cleanedData);
    },
    onSuccess: (newPurchase) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-analytics'] });
      console.log('Purchase recorded successfully:', newPurchase);
      // toast.success('Purchase recorded successfully');
    },
    onError: (error: any) => {
      // Enhanced error handling based on API guide
      console.error('Purchase creation error:', error);
      
      // Check for debouncing error first
      if (error.message && error.message.includes('Please wait')) {
        console.warn('Purchase submission debounced:', error.message);
        // toast.warning(error.message);
        return;
      }

      // Check for duplicate serial number error
      if (error.message && error.message.includes('Duplicate serial number found within this purchase')) {
        console.error('Duplicate serial number error:', error.message);
        // toast.error(error.message);
        return;
      }
      
      if (error.response?.status === 422) {
        // Validation error - extract more specific message
        const detail = error.response.data.detail;
        const message = error.response.data.message;
        
        if (typeof detail === 'string') {
          console.error('Validation error:', detail);
          // toast.error(detail);
        } else if (message) {
          console.error('Validation error:', message);
          // toast.error(message);
        } else if (Array.isArray(detail)) {
          detail.forEach((err, index) => {
            console.error(`Validation error ${index + 1}:`, err.msg, 'at field:', err.loc?.join('.'));
          });
          // toast.error('Validation failed. Please check your input data.');
        } else {
          // toast.error('Validation failed. Please check your input data.');
        }
      } else if (error.response?.status === 409) {
        // Conflict error (duplicate)
        const conflictMessage = error.response.data.detail || error.response.data.message || 'Duplicate purchase detected';
        console.error('Conflict error:', conflictMessage);
        // toast.error(conflictMessage);
      } else if (error.response?.status === 404) {
        // Not found error (supplier, location, or item not found)
        const notFoundMessage = error.response.data.detail || error.response.data.message || 'Required resource not found';
        console.error('Not found error:', notFoundMessage);
        // toast.error(notFoundMessage);
      } else if (error.response?.status === 401) {
        // Authentication error
        console.error('Authentication error: Please login again');
        // toast.error('Authentication failed. Please login again.');
      } else if (error.response?.status === 403) {
        // Authorization error
        console.error('Authorization error: Insufficient permissions');
        // toast.error('You do not have permission to create purchases.');
      } else if (error.response?.status >= 500) {
        // Server error
        const serverMessage = error.response.data?.detail || error.response.data?.message || 'Server error. Please try again later.';
        console.error('Server error:', serverMessage);
        // toast.error(serverMessage);
      } else {
        // Generic error
        const message = error?.response?.data?.detail || 
                       error?.response?.data?.message || 
                       error?.message || 
                       'Failed to record purchase';
        console.error('Generic error:', message);
        // toast.error(message);
      }
    }
  });
}

// Export a hook to get debouncing state
export function usePurchaseDebounceState() {
  const [remainingTime, setRemainingTime] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      // This will be managed by the mutation hook
      setRemainingTime(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return { remainingTime, setRemainingTime };
}

// Purchase Returns Management Hook
export function usePurchaseReturns(filters?: PurchaseReturnFilters) {
  const [localFilters, setLocalFilters] = useState<PurchaseReturnFilters>(filters || {});

  const {
    data: returnsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['purchase-returns', localFilters],
    queryFn: () => purchasesApi.getPurchaseReturns(localFilters),
    keepPreviousData: true,
  });

  const updateFilters = useCallback((newFilters: Partial<PurchaseReturnFilters>) => {
    setLocalFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setLocalFilters({});
  }, []);

  return {
    returns: returnsData?.items || [],
    total: returnsData?.total || 0,
    skip: returnsData?.skip || 0,
    limit: returnsData?.limit || 20,
    isLoading,
    error,
    filters: localFilters,
    updateFilters,
    resetFilters,
    refetch
  };
}

// Single Purchase Return Hook
export function usePurchaseReturn(id: string) {
  return useQuery({
    queryKey: ['purchase-return', id],
    queryFn: () => purchasesApi.getPurchaseReturnById(id),
    enabled: !!id,
  });
}

// Purchase Return Creation Hook
export function useCreatePurchaseReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PurchaseReturnFormData) => purchasesApi.recordPurchaseReturn(data),
    onSuccess: (newReturn) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-analytics'] });
      // toast.success('Purchase return recorded successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to record purchase return';
      // toast.error(message);
    }
  });
}

// Purchase Return Validation Hook
export function usePurchaseReturnValidation() {
  return useMutation({
    mutationFn: ({ originalPurchaseId, items }: { 
      originalPurchaseId: string; 
      items: PurchaseReturnFormData['items'] 
    }) => purchasesApi.validatePurchaseReturn(originalPurchaseId, items),
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to validate return';
      // toast.error(message);
    }
  });
}

// Purchase Analytics Hook
export function usePurchaseAnalytics(params?: {
  start_date?: string;
  end_date?: string;
  supplier_id?: string;
}) {
  return useQuery({
    queryKey: ['purchase-analytics', params],
    queryFn: () => purchasesApi.getPurchaseAnalytics(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Purchase Search Hook
export function usePurchaseSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Purchase[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchPurchases = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await purchasesApi.searchPurchases(query);
      setResults(searchResults);
    } catch (error) {
      console.error('Purchase search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchPurchases(searchTerm);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, searchPurchases]);

  return {
    searchTerm,
    setSearchTerm,
    results,
    isSearching,
    searchPurchases
  };
}

// Purchases by Supplier Hook
export function usePurchasesBySupplier(supplierId: string, params?: {
  skip?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: ['purchases-by-supplier', supplierId, params],
    queryFn: () => purchasesApi.getPurchasesBySupplier(supplierId, params),
    enabled: !!supplierId,
  });
}

// Purchase Returns by Purchase Hook
export function usePurchaseReturnsByPurchase(purchaseId: string) {
  return useQuery({
    queryKey: ['purchase-returns-by-purchase', purchaseId],
    queryFn: () => purchasesApi.getPurchaseReturnsByPurchase(purchaseId),
    enabled: !!purchaseId,
  });
}