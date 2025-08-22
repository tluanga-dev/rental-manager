import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { rentalExtensionService } from '@/services/api/rental-extensions';
import type {
  ExtensionAvailabilityResponse,
  RentalExtensionRequest,
  RentalExtensionResponse,
  RentalBalanceResponse,
  ExtensionHistoryResponse
} from '@/services/api/rental-extensions';

interface UseRentalExtensionReturn {
  // State
  loading: boolean;
  checking: boolean;
  processing: boolean;
  error: string | null;
  availability: ExtensionAvailabilityResponse | null;
  balance: RentalBalanceResponse | null;
  extensionHistory: ExtensionHistoryResponse | null;
  
  // Actions
  checkAvailability: (rentalId: string, newEndDate: string) => Promise<void>;
  processExtension: (rentalId: string, request: RentalExtensionRequest) => Promise<void>;
  getBalance: (rentalId: string) => Promise<void>;
  getExtensionHistory: (rentalId: string) => Promise<void>;
  clearError: () => void;
}

export function useRentalExtension(): UseRentalExtensionReturn {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<ExtensionAvailabilityResponse | null>(null);
  const [balance, setBalance] = useState<RentalBalanceResponse | null>(null);
  const [extensionHistory, setExtensionHistory] = useState<ExtensionHistoryResponse | null>(null);

  const checkAvailability = useCallback(async (rentalId: string, newEndDate: string) => {
    try {
      setChecking(true);
      setError(null);
      
      const response = await rentalExtensionService.checkAvailability(rentalId, newEndDate);
      setAvailability(response);
      
      if (!response.can_extend && Object.keys(response.conflicts).length > 0) {
        setError('Extension not available due to booking conflicts. Please try a different date.');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to check extension availability';
      setError(errorMessage);
      setAvailability(null);
    } finally {
      setChecking(false);
    }
  }, []);

  const processExtension = useCallback(async (rentalId: string, request: RentalExtensionRequest) => {
    try {
      setProcessing(true);
      setError(null);
      
      const response = await rentalExtensionService.processExtension(rentalId, request);
      
      if (response.success) {
        // Success - redirect to rental details
        router.push(`/rentals/${rentalId}?extension=success`);
      } else {
        setError(response.message || 'Extension failed');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to process extension';
      setError(errorMessage);
    } finally {
      setProcessing(false);
    }
  }, [router]);

  const getBalance = useCallback(async (rentalId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await rentalExtensionService.getBalance(rentalId);
      setBalance(response);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to get rental balance';
      setError(errorMessage);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const getExtensionHistory = useCallback(async (rentalId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await rentalExtensionService.getExtensionHistory(rentalId);
      setExtensionHistory(response);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to get extension history';
      setError(errorMessage);
      setExtensionHistory(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    loading,
    checking,
    processing,
    error,
    availability,
    balance,
    extensionHistory,
    
    // Actions
    checkAvailability,
    processExtension,
    getBalance,
    getExtensionHistory,
    clearError
  };
}

// Helper hook for extension form management
export function useExtensionForm(rentalId: string) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemActions, setItemActions] = useState<Record<string, string>>({});
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnConditions, setReturnConditions] = useState<Record<string, string>>({});
  const [paymentOption, setPaymentOption] = useState<'PAY_NOW' | 'PAY_LATER'>('PAY_LATER');
  const [paymentAmount, setPaymentAmount] = useState(0);

  const toggleItemSelection = useCallback((lineId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineId)) {
        newSet.delete(lineId);
      } else {
        newSet.add(lineId);
      }
      return newSet;
    });
  }, []);

  const selectAllItems = useCallback((lineIds: string[]) => {
    setSelectedItems(new Set(lineIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const updateItemAction = useCallback((lineId: string, action: string) => {
    setItemActions(prev => ({ ...prev, [lineId]: action }));
  }, []);

  const updateReturnQuantity = useCallback((lineId: string, quantity: number) => {
    setReturnQuantities(prev => ({ ...prev, [lineId]: quantity }));
  }, []);

  const updateReturnCondition = useCallback((lineId: string, condition: string) => {
    setReturnConditions(prev => ({ ...prev, [lineId]: condition }));
  }, []);

  const resetForm = useCallback(() => {
    setSelectedItems(new Set());
    setItemActions({});
    setReturnQuantities({});
    setReturnConditions({});
    setPaymentOption('PAY_LATER');
    setPaymentAmount(0);
  }, []);

  return {
    // State
    selectedItems,
    itemActions,
    returnQuantities,
    returnConditions,
    paymentOption,
    paymentAmount,
    
    // Actions
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    updateItemAction,
    updateReturnQuantity,
    updateReturnCondition,
    setPaymentOption,
    setPaymentAmount,
    resetForm
  };
}