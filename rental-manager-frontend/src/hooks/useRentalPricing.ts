/**
 * React hook for rental pricing operations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rentalPricingApi, type ItemPricingSummary, type RentalPricingCalculation } from '@/services/api/rental-pricing';

/**
 * Hook to fetch pricing summary for an item
 */
export function useItemPricingSummary(itemId: string | undefined) {
  return useQuery({
    queryKey: ['rental-pricing', 'summary', itemId],
    queryFn: () => rentalPricingApi.getItemPricingSummary(itemId!),
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch all pricing tiers for an item
 */
export function useItemPricingTiers(itemId: string | undefined) {
  return useQuery({
    queryKey: ['rental-pricing', 'tiers', itemId],
    queryFn: () => rentalPricingApi.getItemPricingTiers(itemId!),
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to calculate rental pricing
 */
export function useCalculateRentalPricing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ itemId, rentalDays }: { itemId: string; rentalDays: number }) =>
      rentalPricingApi.calculatePricing(itemId, rentalDays),
    onSuccess: (data) => {
      // Cache the calculation result
      if (data) {
        queryClient.setQueryData(
          ['rental-pricing', 'calculation', data.item_id, data.rental_days],
          data
        );
      }
    },
  });
}

/**
 * Hook to get cached calculation result
 */
export function useCachedPricingCalculation(
  itemId: string | undefined,
  rentalDays: number | undefined
): RentalPricingCalculation | undefined {
  const queryClient = useQueryClient();
  
  if (!itemId || !rentalDays) return undefined;
  
  return queryClient.getQueryData<RentalPricingCalculation>(
    ['rental-pricing', 'calculation', itemId, rentalDays]
  );
}

/**
 * Hook to create standard pricing template
 */
export function useCreateStandardPricing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ itemId, template }: { itemId: string; template: any }) =>
      rentalPricingApi.createStandardPricing(itemId, template),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['rental-pricing', 'summary', variables.itemId] });
      queryClient.invalidateQueries({ queryKey: ['rental-pricing', 'tiers', variables.itemId] });
    },
  });
}

/**
 * Hook to update pricing tier
 */
export function useUpdatePricingTier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ pricingId, updateData }: { pricingId: string; updateData: any }) =>
      rentalPricingApi.updatePricingTier(pricingId, updateData),
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['rental-pricing', 'summary', data.item_id] });
      queryClient.invalidateQueries({ queryKey: ['rental-pricing', 'tiers', data.item_id] });
    },
  });
}

/**
 * Hook to delete pricing tier
 */
export function useDeletePricingTier() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (pricingId: string) => rentalPricingApi.deletePricingTier(pricingId),
    onSuccess: () => {
      // Invalidate all pricing queries (we don't know the item_id from here)
      queryClient.invalidateQueries({ queryKey: ['rental-pricing'] });
    },
  });
}