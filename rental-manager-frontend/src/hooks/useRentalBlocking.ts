/**
 * Hooks for rental blocking functionality
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rentalBlockingService } from '@/services/api/rental-blocking';
import type {
  RentalStatusRequest,
  RentalStatusResponse,
  UnitRentalStatusResponse,
  EntityType
} from '@/types/rental-blocking';

// Hook for managing item rental blocking
export function useItemRentalBlocking() {
  const queryClient = useQueryClient();

  const toggleStatus = useMutation({
    mutationFn: ({ itemId, request }: { itemId: string; request: RentalStatusRequest }) =>
      rentalBlockingService.toggleItemRentalStatus(itemId, request),
    onSuccess: (data, { itemId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['item', itemId] });
      queryClient.invalidateQueries({ queryKey: ['item-rental-history', itemId] });
      queryClient.invalidateQueries({ queryKey: ['blocked-items'] });
      queryClient.invalidateQueries({ queryKey: ['item-availability', itemId] });
    }
  });

  const bulkToggleStatus = useMutation({
    mutationFn: rentalBlockingService.bulkToggleItemRentalStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['blocked-items'] });
    }
  });

  return {
    toggleStatus: toggleStatus.mutateAsync,
    bulkToggleStatus: bulkToggleStatus.mutateAsync,
    isToggling: toggleStatus.isPending,
    isBulkToggling: bulkToggleStatus.isPending
  };
}

// Hook for managing unit rental blocking
export function useUnitRentalBlocking() {
  const queryClient = useQueryClient();

  const toggleStatus = useMutation({
    mutationFn: ({ unitId, request }: { unitId: string; request: RentalStatusRequest }) =>
      rentalBlockingService.toggleUnitRentalStatus(unitId, request),
    onSuccess: (data, { unitId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-unit', unitId] });
      queryClient.invalidateQueries({ queryKey: ['unit-rental-history', unitId] });
      queryClient.invalidateQueries({ queryKey: ['blocked-units'] });
      queryClient.invalidateQueries({ queryKey: ['unit-availability', unitId] });
      
      // Also invalidate item-level queries if this affects an item
      if (data.item_id) {
        queryClient.invalidateQueries({ queryKey: ['item-units-status', data.item_id] });
        queryClient.invalidateQueries({ queryKey: ['items'] });
      }
    }
  });

  const bulkToggleStatus = useMutation({
    mutationFn: rentalBlockingService.bulkToggleUnitRentalStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      queryClient.invalidateQueries({ queryKey: ['blocked-units'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    }
  });

  return {
    toggleStatus: toggleStatus.mutateAsync,
    bulkToggleStatus: bulkToggleStatus.mutateAsync,
    isToggling: toggleStatus.isPending,
    isBulkToggling: bulkToggleStatus.isPending
  };
}

// Combined hook for handling both types
export function useRentalBlocking() {
  const itemBlocking = useItemRentalBlocking();
  const unitBlocking = useUnitRentalBlocking();

  const toggleEntityStatus = useCallback(async (
    entityType: EntityType,
    entityId: string,
    isBlocked: boolean,
    remarks: string
  ): Promise<RentalStatusResponse | UnitRentalStatusResponse> => {
    const request: RentalStatusRequest = {
      is_rental_blocked: isBlocked,
      remarks
    };

    if (entityType === 'ITEM') {
      return await itemBlocking.toggleStatus({ itemId: entityId, request });
    } else {
      return await unitBlocking.toggleStatus({ unitId: entityId, request });
    }
  }, [itemBlocking, unitBlocking]);

  return {
    toggleEntityStatus,
    itemBlocking,
    unitBlocking,
    isToggling: itemBlocking.isToggling || unitBlocking.isToggling
  };
}

// Hook for fetching rental history
export function useRentalHistory(entityType: EntityType, entityId: string) {
  const query = useQuery({
    queryKey: [`${entityType.toLowerCase()}-rental-history`, entityId],
    queryFn: () => {
      if (entityType === 'ITEM') {
        return rentalBlockingService.getItemRentalHistory(entityId);
      } else {
        return rentalBlockingService.getUnitRentalHistory(entityId);
      }
    },
    enabled: !!entityId
  });

  return {
    history: query.data,
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch
  };
}

// Hook for fetching blocked items
export function useBlockedItems(skip: number = 0, limit: number = 100) {
  const query = useQuery({
    queryKey: ['blocked-items', skip, limit],
    queryFn: () => rentalBlockingService.getBlockedItems(skip, limit)
  });

  return {
    blockedItems: query.data,
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch
  };
}

// Hook for fetching blocked units
export function useBlockedUnits(
  skip: number = 0, 
  limit: number = 100, 
  itemId?: string
) {
  const query = useQuery({
    queryKey: ['blocked-units', skip, limit, itemId],
    queryFn: () => rentalBlockingService.getBlockedUnits(skip, limit, itemId)
  });

  return {
    blockedUnits: query.data,
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch
  };
}

// Hook for checking rental availability
export function useRentalAvailability(entityType: EntityType, entityId: string) {
  const query = useQuery({
    queryKey: [`${entityType.toLowerCase()}-availability`, entityId],
    queryFn: () => {
      if (entityType === 'ITEM') {
        return rentalBlockingService.checkItemRentalAvailability(entityId);
      } else {
        return rentalBlockingService.checkUnitRentalAvailability(entityId);
      }
    },
    enabled: !!entityId
  });

  return {
    availability: query.data,
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch
  };
}

// Hook for getting item units rental status
export function useItemUnitsRentalStatus(itemId: string) {
  const query = useQuery({
    queryKey: ['item-units-status', itemId],
    queryFn: () => rentalBlockingService.getItemUnitsRentalStatus(itemId),
    enabled: !!itemId
  });

  return {
    unitsStatus: query.data,
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch
  };
}