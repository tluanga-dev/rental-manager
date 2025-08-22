// Inventory-specific types
export interface InventoryUnit {
  id: string;
  item_id: string;
  location_id: string;
  sku: string;
  serial_number?: string;
  status: InventoryStatus;
  condition: string;  // NEW, EXCELLENT, GOOD, FAIR, POOR, DAMAGED
  purchase_date?: string;
  purchase_price?: number;
  warranty_expiry?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  notes?: string;
  
  // New fields migrated from Item model
  sale_price?: number;
  security_deposit: number;
  rental_rate_per_period?: number;
  rental_period: number;
  model_number?: string;
  warranty_period_days: number;
  
  // New batch tracking fields
  batch_code?: string;
  quantity: number;
  remarks?: string;
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockLevel {
  id: string;
  item_id: string;
  location_id: string;
  quantity_on_hand: number;
  quantity_available: number;
  quantity_reserved: number;
  quantity_in_transit: number;
  quantity_damaged: number;
  reorder_point: number;
  maximum_stock?: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  // Optional related data
  item?: {
    id: string;
    item_name: string;
    sku?: string;
    purchase_price?: number;
  };
  location?: {
    id: string;
    name: string;
    code?: string;
  };
}

export interface InventoryTransfer {
  id: string;
  from_location_id: string;
  to_location_id: string;
  sku_id: string;
  quantity: number;
  transfer_date: string;
  requested_by: string;
  approved_by?: string;
  status: TransferStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryReservation {
  id: string;
  sku_id: string;
  location_id: string;
  quantity: number;
  reserved_for: string; // customer_id or transaction_id
  reservation_type: ReservationType;
  start_date: string;
  end_date: string;
  status: ReservationStatus;
  created_at: string;
  expires_at: string;
}

export interface InventoryMovement {
  id: string;
  inventory_unit_id: string;
  from_status: InventoryStatus;
  to_status: InventoryStatus;
  movement_type: MovementType;
  reference_id?: string; // transaction_id, transfer_id, etc.
  notes?: string;
  moved_by: string;
  moved_at: string;
}

// Enums
export type InventoryStatus = 
  | 'AVAILABLE'
  | 'RESERVED'
  | 'RENTED'
  | 'IN_TRANSIT'
  | 'MAINTENANCE'
  | 'INSPECTION'
  | 'DAMAGED'
  | 'LOST'
  | 'SOLD';

export type ConditionGrade = 'A' | 'B' | 'C' | 'D';

export type TransferStatus = 
  | 'PENDING'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED';

export type ReservationType = 
  | 'RENTAL_BOOKING'
  | 'SALE_HOLD'
  | 'MAINTENANCE_HOLD'
  | 'TRANSFER_HOLD';

export type ReservationStatus = 
  | 'ACTIVE'
  | 'EXPIRED'
  | 'FULFILLED'
  | 'CANCELLED';

export type MovementType = 
  | 'STATUS_CHANGE'
  | 'LOCATION_TRANSFER'
  | 'CONDITION_UPDATE'
  | 'RENTAL_OUT'
  | 'RENTAL_RETURN'
  | 'SALE'
  | 'MAINTENANCE'
  | 'INSPECTION';

// Dashboard summary types
export interface InventoryDashboardSummary {
  total_units: number;
  total_value: number;
  utilization_rate: number;
  locations: LocationSummary[];
  status_breakdown: StatusBreakdown[];
  condition_breakdown: ConditionBreakdown[];
  recent_movements: InventoryMovement[];
  alerts: InventoryAlert[];
}

export interface LocationSummary {
  location_id: string;
  location_name: string;
  total_units: number;
  available_units: number;
  utilization_rate: number;
  total_value: number;
}

export interface StatusBreakdown {
  status: InventoryStatus;
  count: number;
  percentage: number;
  value: number;
}

export interface ConditionBreakdown {
  grade: ConditionGrade;
  count: number;
  percentage: number;
  avg_age_days: number;
}

export interface InventoryAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  sku_id?: string;
  location_id?: string;
  inventory_unit_id?: string;
  created_at: string;
  is_acknowledged: boolean;
}

export type AlertType = 
  | 'LOW_STOCK'
  | 'OVERDUE_RETURN'
  | 'MAINTENANCE_DUE'
  | 'INSPECTION_DUE'
  | 'TRANSFER_PENDING'
  | 'DAMAGED_ITEM'
  | 'EXPIRED_RESERVATION';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Filter types
export interface InventoryFilters {
  location_ids?: string[];
  sku_ids?: string[];
  statuses?: InventoryStatus[];
  condition_grades?: ConditionGrade[];
  date_range?: {
    start: string;
    end: string;
  };
  search?: string;
}