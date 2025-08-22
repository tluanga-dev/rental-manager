// Types for Item Inventory API

export type ItemStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type UnitStatus = 'available' | 'rented' | 'sold' | 'maintenance' | 'damaged' | 'retired';
export type UnitCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
export type MovementType = 'RENTAL_OUT' | 'RENTAL_IN' | 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'TRANSFER' | 'MAINTENANCE';
export type ReferenceType = 'TRANSACTION' | 'RENTAL' | 'SALE' | 'PURCHASE' | 'TRANSFER';

// Units by status breakdown
export interface UnitsByStatus {
  available: number;
  rented: number;
  sold: number;
  maintenance: number;
  damaged: number;
  retired: number;
}

// Item Inventory Overview (for table display)
export interface ItemInventoryOverview {
  id?: string;
  sku: string;
  item_name: string;
  item_status: ItemStatus;
  brand: string;
  category: string;
  unit_of_measurement: string;
  rental_rate: number | null;
  sale_price: number | null;
  total_value?: number; // Backend-calculated total inventory value
  stock: {
    total: number;
    available: number;
    rented: number;
    status: StockStatus;
  };
  
  // Legacy fields for backward compatibility
  brand_name?: string | null;
  category_name?: string | null;
  rental_rate_per_period?: number | null;
  is_rentable?: boolean;
  is_saleable?: boolean;
  total_units?: number;
  units_by_status?: UnitsByStatus;
  total_quantity_on_hand?: number;
  total_quantity_available?: number;
  total_quantity_on_rent?: number;
  stock_status?: StockStatus;
  reorder_point?: number;
  is_low_stock?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Inventory Unit Detail
export interface InventoryUnitDetail {
  id: string;
  unit_code: string;
  serial_number: string | null;
  status: UnitStatus;
  condition: UnitCondition;
  location_id: string;
  location_name: string;
  purchase_date: string | null;
  purchase_price: number;
  warranty_expiry: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Location Stock Info
export interface LocationStockInfo {
  location_id: string;
  location_name: string;
  quantity_on_hand: number;
  quantity_available: number;
  quantity_on_rent: number;
}

// Recent Movement
export interface RecentMovement {
  id: string;
  movement_type: MovementType;
  quantity_change: number;
  reason: string;
  reference_type: ReferenceType;
  reference_id: string | null;
  location_name: string;
  created_at: string;
  created_by_name: string | null;
}

// Item Inventory Detailed (single item comprehensive view)
export interface ItemInventoryDetailed {
  id: string;
  sku: string;
  item_name: string;
  item_status: ItemStatus;
  brand_id: string;
  brand_name: string;
  category_id: string;
  category_name: string;
  unit_of_measurement_id: string;
  unit_of_measurement_name: string;
  description: string | null;
  specifications: string | null;
  model_number: string | null;
  serial_number_required: boolean;
  warranty_period_days: string;
  rental_rate_per_period: number;
  rental_period: string;
  sale_price: number;
  purchase_price: number;
  security_deposit: number;
  is_rentable: boolean;
  is_saleable: boolean;
  total_units: number;
  units_by_status: UnitsByStatus;
  inventory_units: InventoryUnitDetail[];
  stock_by_location: LocationStockInfo[];
  total_quantity_on_hand: number;
  total_quantity_available: number;
  total_quantity_on_rent: number;
  reorder_point: number;
  stock_status: StockStatus;
  is_low_stock: boolean;
  recent_movements: RecentMovement[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

// Query parameters for inventory endpoints
export interface ItemInventoryQueryParams {
  skip?: number;
  limit?: number;
  item_status?: ItemStatus;
  brand_id?: string;
  category_id?: string;
  stock_status?: StockStatus;
  is_rentable?: boolean;
  is_saleable?: boolean;
  search?: string;
  // Backend supported sort_by fields: item_name, sku, brand, category, item_status, total, available, rented, stock_status  
  sort_by?: 'item_name' | 'sku' | 'brand' | 'category' | 'item_status' | 'total' | 'available' | 'rented' | 'stock_status';
  sort_order?: 'asc' | 'desc';
}

// Table column sort configuration
export interface SortConfig {
  field: ItemInventoryQueryParams['sort_by'];
  order: 'asc' | 'desc';
}

// Filter state for the table
export interface InventoryFilterState {
  search: string;
  item_status: ItemStatus | 'all';
  stock_status: StockStatus | 'all';
  brand_id: string;
  category_id: string;
  is_rentable: boolean | '';
  is_saleable: boolean | '';
}