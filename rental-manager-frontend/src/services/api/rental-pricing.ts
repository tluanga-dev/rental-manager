/**
 * API service for Rental Pricing management
 */
import { apiClient } from '@/lib/axios';

export interface RentalPricingTier {
  id: string;
  item_id: string;
  tier_name: string;
  period_type: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  period_days?: number;  // Optional for HOUR unit
  period_hours?: number; // For HOUR unit
  period_unit?: 'HOUR' | 'DAY'; // Unit of measure
  period_value?: number; // Computed value (days or hours)
  rate_per_period: number;
  min_rental_days?: number; // Deprecated
  max_rental_days?: number; // Deprecated
  min_rental_periods?: number; // New period-based constraint
  max_rental_periods?: number; // New period-based constraint
  is_default: boolean;
  is_active: boolean;
  priority: number;
  daily_equivalent_rate?: number;
  display_name?: string;
  duration_description?: string;
}

export interface RentalPricingCalculation {
  item_id: string;
  rental_days: number;
  applicable_tiers: RentalPricingTier[];
  recommended_tier?: RentalPricingTier;
  total_cost: number;
  daily_equivalent_rate: number;
  savings_compared_to_daily?: number;
}

export interface ItemPricingSummary {
  item_id: string;
  default_tier?: RentalPricingTier;
  available_tiers: RentalPricingTier[];
  daily_rate_range: [number, number];
  has_tiered_pricing: boolean;
}

export interface StandardPricingTemplate {
  daily_rate: number;
  weekly_discount_percentage?: number;
  monthly_discount_percentage?: number;
}

const BASE_PATH = '/rental-pricing';

export const rentalPricingApi = {
  /**
   * Get pricing summary for an item
   */
  async getItemPricingSummary(itemId: string): Promise<ItemPricingSummary | null> {
    try {
      const response = await apiClient.get<any>(`${BASE_PATH}/item/${itemId}/summary`);
      const data = response.data;
      
      // Handle wrapped response
      if (data && typeof data === 'object' && 'data' in data) {
        return data.data;
      }
      
      return data;
    } catch (error: any) {
      // Return null if no pricing exists for the item (404)
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching pricing summary for item ${itemId}:`, error);
      return null;
    }
  },

  /**
   * Get all pricing tiers for an item
   */
  async getItemPricingTiers(itemId: string): Promise<RentalPricingTier[]> {
    try {
      const response = await apiClient.get<any>(`${BASE_PATH}/item/${itemId}`);
      const data = response.data;
      
      // Handle wrapped response
      if (data && typeof data === 'object' && 'data' in data) {
        return Array.isArray(data.data) ? data.data : [];
      }
      
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      // Return empty array if no pricing exists
      if (error.response?.status === 404) {
        return [];
      }
      console.error(`Error fetching pricing tiers for item ${itemId}:`, error);
      return [];
    }
  },

  /**
   * Calculate rental pricing for specific duration
   */
  async calculatePricing(
    itemId: string,
    rentalDays: number
  ): Promise<RentalPricingCalculation | null> {
    try {
      const response = await apiClient.post<any>(`${BASE_PATH}/calculate`, {
        item_id: itemId,
        rental_days: rentalDays,
        calculation_date: new Date().toISOString().split('T')[0]
      });
      
      const data = response.data;
      
      // Handle wrapped response
      if (data && typeof data === 'object' && 'data' in data) {
        return data.data;
      }
      
      return data;
    } catch (error) {
      console.error(`Error calculating pricing for item ${itemId}:`, error);
      return null;
    }
  },

  /**
   * Create standard pricing template for an item
   */
  async createStandardPricing(
    itemId: string,
    template: StandardPricingTemplate
  ): Promise<any> {
    try {
      const response = await apiClient.post(
        `${BASE_PATH}/standard-template/${itemId}`,
        template
      );
      return response.data;
    } catch (error) {
      console.error(`Error creating standard pricing for item ${itemId}:`, error);
      throw error;
    }
  },

  /**
   * Create custom pricing tier
   */
  async createPricingTier(pricingData: any): Promise<RentalPricingTier> {
    try {
      const response = await apiClient.post<any>(`${BASE_PATH}/`, pricingData);
      const data = response.data;
      
      // Handle wrapped response
      if (data && typeof data === 'object' && 'data' in data) {
        return data.data;
      }
      
      return data;
    } catch (error) {
      console.error('Error creating pricing tier:', error);
      throw error;
    }
  },

  /**
   * Update pricing tier
   */
  async updatePricingTier(
    pricingId: string,
    updateData: Partial<RentalPricingTier>
  ): Promise<RentalPricingTier> {
    try {
      const response = await apiClient.put<any>(`${BASE_PATH}/${pricingId}`, updateData);
      const data = response.data;
      
      // Handle wrapped response
      if (data && typeof data === 'object' && 'data' in data) {
        return data.data;
      }
      
      return data;
    } catch (error) {
      console.error(`Error updating pricing tier ${pricingId}:`, error);
      throw error;
    }
  },

  /**
   * Delete pricing tier
   */
  async deletePricingTier(pricingId: string): Promise<void> {
    try {
      await apiClient.delete(`${BASE_PATH}/${pricingId}`);
    } catch (error) {
      console.error(`Error deleting pricing tier ${pricingId}:`, error);
      throw error;
    }
  }
};