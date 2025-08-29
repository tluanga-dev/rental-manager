import { apiClient } from '@/lib/axios';
import type { InventoryUnitDetail } from '@/types/inventory-items';

export const inventoryUnitsApi = {
  // Get unit detail
  getUnitDetail: async (unitId: string): Promise<InventoryUnitDetail> => {
    const response = await apiClient.get(`/inventory/units/${unitId}`);
    return response.data.data;
  },

  // Get unit movements
  getUnitMovements: async (unitId: string): Promise<any[]> => {
    try {
      const response = await apiClient.get(`/inventory/units/${unitId}/movements`);
      return response.data.data || [];
    } catch (error) {
      console.log('Unit movements not implemented yet, returning empty array');
      return [];
    }
  },

  // Get unit rental history
  getUnitRentalHistory: async (unitId: string): Promise<any[]> => {
    try {
      const response = await apiClient.get(`/inventory/units/${unitId}/rentals`);
      return response.data.data || [];
    } catch (error) {
      console.log('Unit rental history not implemented yet, returning empty array');
      return [];
    }
  },

  // Get unit analytics
  getUnitAnalytics: async (unitId: string): Promise<any> => {
    try {
      const response = await apiClient.get(`/inventory/units/${unitId}/analytics`);
      return response.data.data;
    } catch (error) {
      console.log('Unit analytics not implemented yet, returning default data');
      return {
        utilizationRate: 0,
        totalRevenue: 0,
        maintenanceCost: 0,
        daysInStatus: {},
      };
    }
  },

  // Get unit maintenance history
  getUnitMaintenanceHistory: async (unitId: string): Promise<any[]> => {
    try {
      const response = await apiClient.get(`/inventory/units/${unitId}/maintenance`);
      return response.data.data || [];
    } catch (error) {
      console.log('Unit maintenance not implemented yet, returning empty array');
      return [];
    }
  },

  // Update unit rental block status
  updateRentalBlockStatus: async (
    unitId: string,
    isBlocked: boolean,
    reason?: string
  ): Promise<InventoryUnitDetail> => {
    const response = await apiClient.patch(`/inventory/units/${unitId}/rental-block`, {
      is_rental_blocked: isBlocked,
      rental_block_reason: reason,
    });
    return response.data.data;
  },
};