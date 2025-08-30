import type { InventoryItemDetail } from '@/types/inventory-items';
import type { RentalStatus } from '@/types/rentals';

export interface CurrentRentalInfo {
  rental_id: string;
  rental_number: string;
  customer_name: string;
  customer_id: string;
  rental_status: RentalStatus;
  start_date: string;
  end_date: string;
  days_remaining: number;
  is_overdue: boolean;
  units_rented: number;
  total_units: number;
  daily_rate: number;
  total_rental_value: number;
}

export interface DeliveryConfiguration {
  delivery_enabled: boolean;
  delivery_charge: number;
  pickup_charge: number;
  free_delivery_threshold?: number;
  delivery_radius_km?: number;
  estimated_delivery_time?: string;
}

export interface RentalConfiguration {
  is_rentable: boolean;
  is_rental_blocked: boolean;
  rental_block_reason?: string;
  daily_rate?: number;
  security_deposit?: number;
  min_rental_period?: number;
  max_rental_period?: number;
  has_tiered_pricing: boolean;
  delivery_config: DeliveryConfiguration;
}

export interface ItemRentalStatus {
  item_id: string;
  item_name: string;
  sku: string;
  rental_config: RentalConfiguration;
  current_rentals: CurrentRentalInfo[];
  available_units: number;
  total_units: number;
  units_breakdown: {
    available: number;
    rented: number;
    reserved: number;
    maintenance: number;
    damaged: number;
  };
}

export interface RentalStatusBlockProps {
  item: InventoryItemDetail;
  onManagePricing?: () => void;
  onManageRental?: () => void;
}