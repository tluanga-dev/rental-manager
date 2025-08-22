// Custom hook for rental return functionality
import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  ReturnableRental, 
  RentalReturnRequest, 
  RentalReturnResponse, 
  ReturnItemState,
  ReturnAction 
} from '../types/rental-return';

export const useRentalReturn = (rentalId: string) => {
  const [returnData, setReturnData] = useState<ReturnableRental | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingReturn, setProcessingReturn] = useState(false);

  // Fetch return data
  const fetchReturnData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 Fetching rental data for ID: ${rentalId}`);
      const response = await apiClient.get(`/transactions/rentals/${rentalId}`);
      
      if (!response.data || !response.data.data) {
        throw new Error('Invalid response from server');
      }
      
      const rentalData = response.data.data;
      console.log('✅ Rental data fetched successfully:', rentalData.transaction_number);
      
      // Check if rental is in a returnable state
      if (rentalData.rental_status === 'RENTAL_COMPLETED' || rentalData.rental_status === 'RENTAL_CANCELLED') {
        throw new Error(`This rental is already ${rentalData.rental_status.toLowerCase().replace('rental_', '')} and cannot be returned.`);
      }
      
      // Transform rental data to ReturnableRental format
      const returnableRental = {
        ...rentalData,
        returnable_items: rentalData.items || [], // Map items to returnable_items with fallback
        return_metadata: {
          can_return: true, // Assume returnable if we can access the data
          return_date: new Date().toISOString().split('T')[0],
          is_overdue: new Date() > new Date(rentalData.rental_end_date)
        }
      };
      
      setReturnData(returnableRental);
      
      // Initialize return items state using the items array
      if (rentalData.items && rentalData.items.length > 0) {
        const initialItems: ReturnItemState[] = rentalData.items.map(item => ({
          item,
          selected: true, // Default to selected for return
          return_quantity: item.quantity,
          return_action: 'COMPLETE_RETURN' as ReturnAction,
          condition_notes: '',
          damage_notes: '',
          damage_penalty: 0
        }));
        
        setReturnItems(initialItems);
      } else {
        console.warn('⚠️ No items found in rental');
        setReturnItems([]);
      }
      
    } catch (err: any) {
      console.error('❌ Error fetching rental data:', err);
      
      // Provide more specific error messages
      if (err.response) {
        if (err.response.status === 404) {
          setError(`Rental with ID ${rentalId} not found. This rental may have been deleted or the ID is incorrect.`);
        } else if (err.response.status === 401) {
          setError('Authentication failed. Please login again.');
        } else if (err.response.status === 403) {
          setError('You do not have permission to view this rental.');
        } else if (err.response.status === 422) {
          setError('Invalid rental ID format. Please check the URL.');
        } else {
          setError(`Server error (${err.response.status}): ${err.response.data?.detail || err.response.data?.message || 'Unable to fetch rental data'}`);
        }
      } else if (err.request) {
        setError('Unable to reach the server. Please check your internet connection.');
      } else {
        setError(err.message || 'Unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  }, [rentalId]);

  // Update return item state
  const updateReturnItem = useCallback((lineId: string, updates: Partial<ReturnItemState>) => {
    setReturnItems(prev => prev.map(item => 
      item.item.id === lineId 
        ? { ...item, ...updates }
        : item
    ));
  }, []);

  // Select/deselect all items
  const toggleAllItems = useCallback((selected: boolean) => {
    setReturnItems(prev => prev.map(item => ({ ...item, selected })));
  }, []);

  // Set return action for all selected items
  const setReturnActionForAll = useCallback((action: ReturnAction) => {
    setReturnItems(prev => prev.map(item => 
      item.selected ? { ...item, return_action: action } : item
    ));
  }, []);

  // Calculate financial impact preview
  const calculateFinancialPreview = useCallback(() => {
    if (!returnData) return null;

    const selectedItems = (returnItems || []).filter(item => item?.selected);
    const selectedItemsCount = selectedItems.length;
    const isOverdue = returnData.return_metadata.is_overdue;
    const daysLate = isOverdue ? 1 : 0; // Simplified calculation
    
    // Calculate rental subtotal for selected items
    const rentalSubtotal = selectedItems.reduce((total, returnItem) => {
      const item = returnItem.item;
      const quantity = item.quantity || 1;
      const unitRate = item.unit_price || 0;
      const rentalPeriod = item.rental_period || 1;
      
      // Calculate base rental amount (without additional charges)
      const itemSubtotal = quantity * unitRate * rentalPeriod;
      return total + itemSubtotal;
    }, 0);
    
    const baseLateFePerItem = 5.0;
    const lateFees = isOverdue ? selectedItemsCount * baseLateFePerItem * daysLate : 0;
    
    // Calculate total damage penalties
    const damagePenalties = (returnItems || [])
      .filter(item => item?.selected && item?.return_action === 'MARK_DAMAGED')
      .reduce((total, item) => total + (item?.damage_penalty || 0), 0);
    
    const additionalCharges = lateFees + damagePenalties;
    const totalAmount = rentalSubtotal + additionalCharges;
    const depositAmount = returnData.financial_summary.deposit_amount;
    const balanceAmount = totalAmount - depositAmount;

    return {
      rental_subtotal: rentalSubtotal,
      late_fees: lateFees,
      damage_penalties: damagePenalties,
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      charges_applied: additionalCharges > 0
    };
  }, [returnData, returnItems]);

  // Process return
  const processReturn = useCallback(async (returnNotes?: string): Promise<RentalReturnResponse> => {
    console.log('🚀 Starting return process...');
    
    if (!returnData) {
      console.error('❌ No return data available');
      throw new Error('No return data available');
    }

    const selectedItems = (returnItems || []).filter(item => item?.selected);
    console.log(`📦 Selected ${selectedItems.length} items for return`);
    
    if (selectedItems.length === 0) {
      console.error('❌ No items selected');
      throw new Error('Please select at least one item to return');
    }

    setProcessingReturn(true);
    setError(null);

    try {
      const returnRequest: RentalReturnRequest = {
        rental_id: rentalId,
        return_date: new Date().toISOString().split('T')[0],
        items: selectedItems.map(itemState => {
          // Determine quantity breakdown based on return action
          const totalQty = itemState.return_quantity;
          let quantityGood = 0;
          let quantityDamaged = 0;
          const quantityBeyondRepair = 0;
          const quantityLost = 0;

          // Map return action to appropriate quantity fields
          switch (itemState.return_action) {
            case 'MARK_DAMAGED':
              quantityDamaged = totalQty;
              break;
            case 'MARK_LATE':
              // Late items are still in good condition, just late
              quantityGood = totalQty;
              break;
            case 'COMPLETE_RETURN':
            case 'PARTIAL_RETURN':
            default:
              quantityGood = totalQty;
              break;
          }

          return {
            line_id: itemState.item.id,
            item_id: itemState.item.item_id,
            // Backend expects total_return_quantity and breakdown
            total_return_quantity: totalQty,
            quantity_good: quantityGood,
            quantity_damaged: quantityDamaged,
            quantity_beyond_repair: quantityBeyondRepair,
            quantity_lost: quantityLost,
            return_date: new Date().toISOString().split('T')[0],
            return_action: itemState.return_action,
            condition_notes: itemState.condition_notes || '',
            damage_notes: itemState.damage_notes || '',
            damage_penalty: itemState.damage_penalty || 0
          };
        }),
        notes: returnNotes,
        processed_by: 'web_user' // Could be from auth context
      };

      console.log('📤 Sending return request:', {
        rental_id: returnRequest.rental_id,
        items_count: returnRequest.items.length,
        endpoint: `/transactions/rentals/${rentalId}/return-direct`
      });

      const response = await apiClient.post(`/transactions/rentals/${rentalId}/return-direct`, returnRequest);
      
      console.log('📥 Return response received:', response.status);
      
      const result: RentalReturnResponse = response.data;
      
      if (!result) {
        console.error('❌ No result data in response');
        throw new Error('Return processing failed: No result data received');
      }
      
      console.log('✅ Return processed successfully:', result.transaction_number);
      return result;

    } catch (err: any) {
      console.error('❌ Return processing failed:', err);
      
      let errorMessage = 'Unknown error occurred';
      
      if (err.response) {
        // Server responded with error
        if (err.response.status === 422) {
          errorMessage = `Validation error: ${err.response.data?.detail || 'Invalid return data'}`;
        } else if (err.response.status === 404) {
          errorMessage = 'Rental not found';
        } else if (err.response.status === 400) {
          errorMessage = err.response.data?.detail || 'Bad request';
        } else {
          errorMessage = `Server error (${err.response.status}): ${err.response.data?.detail || err.response.data?.message || 'Failed to process return'}`;
        }
      } else if (err.request) {
        errorMessage = 'Unable to reach server. Please check your connection.';
      } else {
        errorMessage = err.message || 'Unknown error occurred';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setProcessingReturn(false);
    }
  }, [rentalId, returnData, returnItems]);

  // Validation
  const canProcessReturn = useCallback(() => {
    const selectedItems = (returnItems || []).filter(item => item?.selected);
    return selectedItems.length > 0 && !processingReturn;
  }, [returnItems, processingReturn]);

  return {
    // State
    returnData,
    returnItems,
    loading,
    error,
    processingReturn,

    // Actions
    fetchReturnData,
    updateReturnItem,
    toggleAllItems,
    setReturnActionForAll,
    processReturn,

    // Computed
    calculateFinancialPreview,
    canProcessReturn,

    // Helpers
    selectedItemsCount: (returnItems || []).filter(item => item?.selected).length,
    totalItemsCount: returnItems.length,
    hasOverdueItems: returnData?.return_metadata.is_overdue || false
  };
};