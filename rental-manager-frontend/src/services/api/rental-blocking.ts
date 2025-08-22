/**
 * API service for rental blocking operations
 */

import { apiClient } from '@/lib/axios';
import type {
  RentalStatusRequest,
  RentalStatusResponse,
  RentalBlockHistoryListResponse,
  BlockedItemsListResponse,
  RentalAvailabilityResponse,
  BulkRentalStatusRequest,
  BulkRentalStatusResponse,
  UnitRentalStatusResponse,
  BlockedUnitsListResponse,
  ItemUnitRentalStatusSummary,
  UnitAvailabilityResponse
} from '@/types/rental-blocking';

class RentalBlockingService {
  // Item-level blocking operations
  async toggleItemRentalStatus(
    itemId: string, 
    request: RentalStatusRequest
  ): Promise<RentalStatusResponse> {
    const response = await apiClient.put(
      `/master-data/items/rental-blocking/${itemId}/status`,
      request
    );
    return response.data;
  }

  async getItemRentalHistory(
    itemId: string,
    skip: number = 0,
    limit: number = 100
  ): Promise<RentalBlockHistoryListResponse> {
    const response = await apiClient.get(
      `/master-data/items/rental-blocking/${itemId}/history`,
      { params: { skip, limit } }
    );
    return response.data;
  }

  async getBlockedItems(
    skip: number = 0,
    limit: number = 100
  ): Promise<BlockedItemsListResponse> {
    const response = await apiClient.get(
      `/master-data/items/rental-blocking/blocked-items`,
      { params: { skip, limit } }
    );
    return response.data;
  }

  async checkItemRentalAvailability(itemId: string): Promise<RentalAvailabilityResponse> {
    const response = await apiClient.get(
      `/master-data/items/rental-blocking/${itemId}/availability`
    );
    return response.data;
  }

  async bulkToggleItemRentalStatus(
    request: BulkRentalStatusRequest
  ): Promise<BulkRentalStatusResponse> {
    const response = await apiClient.put(
      `/master-data/items/rental-blocking/bulk-status`,
      request
    );
    return response.data;
  }

  // Unit-level blocking operations
  async toggleUnitRentalStatus(
    unitId: string,
    request: RentalStatusRequest
  ): Promise<UnitRentalStatusResponse> {
    const response = await apiClient.put(
      `/inventory/units/rental-blocking/${unitId}/status`,
      request
    );
    return response.data;
  }

  async getUnitRentalHistory(
    unitId: string,
    skip: number = 0,
    limit: number = 100
  ): Promise<RentalBlockHistoryListResponse> {
    const response = await apiClient.get(
      `/inventory/units/rental-blocking/${unitId}/history`,
      { params: { skip, limit } }
    );
    return response.data;
  }

  async getBlockedUnits(
    skip: number = 0,
    limit: number = 100,
    itemId?: string
  ): Promise<BlockedUnitsListResponse> {
    const params: any = { skip, limit };
    if (itemId) {
      params.item_id = itemId;
    }
    
    const response = await apiClient.get(
      `/inventory/units/rental-blocking/blocked-units`,
      { params }
    );
    return response.data;
  }

  async getItemUnitsRentalStatus(itemId: string): Promise<ItemUnitRentalStatusSummary> {
    const response = await apiClient.get(
      `/inventory/units/rental-blocking/items/${itemId}/units/status`
    );
    return response.data;
  }

  async checkUnitRentalAvailability(unitId: string): Promise<UnitAvailabilityResponse> {
    const response = await apiClient.get(
      `/inventory/units/rental-blocking/${unitId}/availability`
    );
    return response.data;
  }

  async bulkToggleUnitRentalStatus(
    request: BulkRentalStatusRequest
  ): Promise<BulkRentalStatusResponse> {
    const response = await apiClient.put(
      `/inventory/units/rental-blocking/bulk-status`,
      request
    );
    return response.data;
  }
}

export const rentalBlockingService = new RentalBlockingService();