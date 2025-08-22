// Enhanced TypeScript interfaces for Rental Return System with Damage Tracking
// This extends the basic rental-return.ts with mixed condition support

export interface DamageDetail {
  quantity: number;
  damage_type: DamageType;
  damage_severity: DamageSeverity;
  estimated_repair_cost?: number;
  description: string;
  serial_numbers?: string[];
}

export type DamageType = 
  | 'PHYSICAL'
  | 'WATER'
  | 'ELECTRICAL'
  | 'WEAR_AND_TEAR'
  | 'COSMETIC'
  | 'FUNCTIONAL'
  | 'OTHER';

export type DamageSeverity = 
  | 'MINOR'
  | 'MODERATE'
  | 'SEVERE'
  | 'BEYOND_REPAIR';

// Enhanced item return request with mixed condition support
export interface ItemReturnRequestEnhanced {
  line_id: string;
  item_id: string;
  
  // Total quantity being returned
  total_return_quantity: number;
  
  // Breakdown by condition
  quantity_good: number;
  quantity_damaged: number;
  quantity_beyond_repair: number;
  quantity_lost: number;
  
  // Damage details for damaged/beyond repair items
  damage_details?: DamageDetail[];
  
  return_date: string;
  return_action: ReturnAction;
  condition_notes?: string;
  damage_notes?: string;
  damage_penalty?: number;
}

// Enhanced return state for UI
export interface ReturnItemStateEnhanced {
  item: RentalItem;
  selected: boolean;
  
  // Quantities by condition
  total_return_quantity: number;
  quantity_good: number;
  quantity_damaged: number;
  quantity_beyond_repair: number;
  quantity_lost: number;
  
  // Damage tracking
  damage_details: DamageDetail[];
  
  return_action: ReturnAction;
  condition_notes: string;
  damage_notes: string;
  damage_penalty: number;
  
  // UI state
  showDamageDetails: boolean;
  validationErrors?: string[];
}

// Damage assessment for viewing/managing damaged items
export interface DamageAssessment {
  id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  damage_date: string;
  damage_type: DamageType;
  damage_severity: DamageSeverity;
  damage_description: string;
  assessment_date: string;
  estimated_repair_cost?: number;
  repair_feasible: boolean;
  photos_url?: string[];
  transaction_header_id?: string;
  transaction_line_id?: string;
  created_at: string;
  updated_at: string;
}

// Repair order tracking
export interface RepairOrder {
  id: string;
  damage_assessment_id: string;
  item_id: string;
  item_name: string;
  repair_status: RepairStatus;
  repair_start_date?: string;
  repair_end_date?: string;
  repair_cost?: number;
  repair_invoice_number?: string;
  repair_notes?: string;
  repair_vendor_id?: string;
  repair_vendor_name?: string;
  quality_check_status?: QualityCheckStatus;
  quality_check_date?: string;
  quality_check_by?: string;
  created_at: string;
  updated_at: string;
}

export type RepairStatus = 
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type QualityCheckStatus = 
  | 'PENDING'
  | 'PASSED'
  | 'FAILED';

// Summary statistics for damage tracking
export interface DamageSummary {
  total_damaged: number;
  total_repair_cost: number;
  by_severity: {
    [key in DamageSeverity]?: number;
  };
  items: {
    item_id: string;
    item_name: string;
    severity: DamageSeverity;
    quantity: number;
    repair_cost: number;
  }[];
}

// Import existing types from rental-return.ts
export type { 
  RentalItem, 
  RentalDetails, 
  ReturnableRental,
  RentalStatus,
  ReturnAction,
  RentalReturnRequest,
  RentalReturnResponse,
  ItemReturnResponse,
  FinancialImpact
} from './rental-return';