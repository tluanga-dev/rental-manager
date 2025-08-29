// Rentable Items API Types based on the inventory_unit/rentable endpoint
export interface LocationAvailability {
  location_id: string;
  name: string;
  available_quantity: number;
}

export interface RentableBrand {
  id: string;
  name: string;
}

export interface RentableCategory {
  id: string;
  name: string;
  path?: string;
}

export interface RentableUnitOfMeasurement {
  id: string;
  name: string;
  abbreviation?: string;
}

// New interface for the inventory_unit/rentable endpoint response
export interface RentableInventoryUnit {
  item_id: string;
  inventory_unit_id: string;
  item_name: string;
  description: string;
  serial_number_required: boolean;
  model_number: string;
  security_deposit: string;
  rental_rate_per_period: string;
  rental_period: string;
  quantity_available: string;
  location_id: string;
  name: string;
  location_name?: string; // Add optional location_name field to match API response
  serial_number: string | null;
}

// Legacy interface for backward compatibility
export interface RentableItem {
  id: string;
  sku: string;
  item_name: string;
  description?: string;
  brand?: RentableBrand | null;
  category?: RentableCategory | null;
  unit_of_measurement?: RentableUnitOfMeasurement | null;
  rental_rate_per_period: number;
  rental_period: string;
  security_deposit: number;
  min_rental_days?: number;
  max_rental_days?: number;
  is_rentable: boolean;
  is_saleable?: boolean;
  serial_number_required?: boolean;
  total_available_quantity: number;
  location_availability: LocationAvailability[];
}

export interface RentableItemsParams {
  location_id?: string;
  category_id?: string;
  search_name?: string;
  skip?: number;
  limit?: number;
}

export interface RentableItemsResponse extends Array<RentableItem> {}
