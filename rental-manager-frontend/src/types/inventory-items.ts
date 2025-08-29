/**
 * TypeScript type definitions for Inventory Items feature
 */

// Category summary for inventory items
export interface CategorySummary {
  id: string;
  name: string;
  code: string;
}

// Brand summary for inventory items
export interface BrandSummary {
  id: string;
  name: string;
}

// Location-specific stock breakdown
export interface LocationStock {
  location_id: string;
  location_name: string;
  total_units: number;
  available_units: number;
  reserved_units: number;
  rented_units: number;
}

// Stock summary for an item
export interface StockSummary {
  total: number;
  available: number;
  reserved: number;
  rented: number;
  in_maintenance: number;
  damaged: number;
  stock_status: StockStatus;
}

// Stock status enum
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

// Item status enum
export type ItemStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

// Inventory unit status
export type InventoryUnitStatus = 
  | 'AVAILABLE'
  | 'RESERVED'
  | 'RENTED'
  | 'IN_TRANSIT'
  | 'MAINTENANCE'
  | 'INSPECTION'
  | 'DAMAGED'
  | 'LOST'
  | 'SOLD';

// Condition grade for inventory units
export type ConditionGrade = 'A' | 'B' | 'C' | 'D';

// Movement type enum
export type MovementType = 
  | 'PURCHASE'
  | 'SALE'
  | 'RENTAL_OUT'
  | 'RENTAL_RETURN'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'REPAIR'
  | 'WRITE_OFF';

// Inventory item summary (for list view)
export interface InventoryItemSummary {
  item_id: string;
  sku: string;
  item_name: string;
  category: CategorySummary;
  brand: BrandSummary;
  stock_summary: StockSummary;
  total_value: number;
  item_status: string; // Backend sends as string, not enum
  purchase_price?: number;
  sale_price?: number;
  rental_rate?: number;
  is_rentable: boolean;
  is_salable: boolean;
}

// Detailed inventory item (for detail view)
export interface InventoryItemDetail extends InventoryItemSummary {
  description?: string;
  image_url?: string;
  location_breakdown: LocationStock[];
  min_stock_level?: number;
  max_stock_level?: number;
  created_at: string;
  updated_at: string;
}

// Individual inventory unit detail
export interface InventoryUnitDetail {
  id: string;
  unit_identifier: string;
  serial_number?: string;
  location_id: string;
  location_name: string;
  status: string; // Backend sends as string, not enum
  condition: string; // Backend sends as string, not enum
  last_movement?: string;
  acquisition_date: string;
  acquisition_cost?: number;
  notes?: string;
  
  // Rental blocking fields
  is_rental_blocked?: boolean;
  rental_block_reason?: string;
  rental_blocked_at?: string;
  rental_blocked_by?: string;
  
  // Parent item info for hierarchical blocking
  item_is_rental_blocked?: boolean;
  item_rental_block_reason?: string;
}

// Stock movement detail
export interface StockMovementDetail {
  id: string;
  movement_type: string; // Backend sends as string, not enum
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  from_status?: string;
  to_status?: string;
  location_id: string;
  location_name: string;
  created_at: string;
  created_by?: string;
  notes?: string;
}

// Analytics data for an inventory item
export interface InventoryAnalytics {
  total_movements: number;
  average_daily_movement: number;
  turnover_rate: number;
  stock_health_score: number;
  days_of_stock?: number;
  last_restock_date?: string;
  last_sale_date?: string;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
}

// Filter state for inventory items list
export interface InventoryItemsFilterState {
  search: string;
  category_id: string;
  brand_id: string;
  item_status: ItemStatus | 'all';
  stock_status: StockStatus | 'all';
  is_rentable: boolean | undefined;
  is_salable: boolean | undefined;
}

// Sort configuration
export interface InventoryItemsSortConfig {
  field: 'item_name' | 'sku' | 'stock_summary.total' | 'total_value' | 'item_status';
  order: 'asc' | 'desc';
}

// API request parameters
export interface GetInventoryItemsParams {
  search?: string;
  category_id?: string;
  brand_id?: string;
  item_status?: string;
  stock_status?: string;
  is_rentable?: boolean;
  is_salable?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

export interface GetInventoryUnitsParams {
  location_id?: string;
  status?: string;
  condition?: string;
  skip?: number;
  limit?: number;
}

export interface GetMovementsParams {
  movement_type?: string;
  location_id?: string;
  skip?: number;
  limit?: number;
}

// Types for comprehensive inventory display (both serialized units and bulk stock)
export interface BulkStockInfo {
  total_quantity: number;
  available: number;
  rented: number;
  damaged: number;
  in_maintenance: number;
  reserved: number;
}

export interface AllInventoryLocation {
  location_id: string;
  location_name: string;
  serialized_units: InventoryUnitDetail[];
  bulk_stock: BulkStockInfo;
}

export interface GetAllInventoryParams {
  location_id?: string;
  status?: string;
  condition?: string;
  skip?: number;
  limit?: number;
}

// Summary statistics for dashboard
export interface InventorySummaryStats {
  total_products: number;
  total_units: number;
  total_value: number;
  stock_health: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
}