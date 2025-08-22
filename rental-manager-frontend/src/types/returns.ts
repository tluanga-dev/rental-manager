// Return processing types
export interface RentalReturnHeader {
  id: string;
  rental_transaction_id: string;
  return_number: string;
  customer_id: string;
  location_id: string;
  return_date: string;
  processed_by: string;
  return_type: ReturnType;
  status: ReturnStatus;
  total_late_fees: number;
  total_damage_fees: number;
  total_cleaning_fees: number;
  deposit_refund_amount: number;
  net_refund_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RentalReturnLine {
  id: string;
  return_header_id: string;
  transaction_line_id: string;
  inventory_unit_id: string;
  sku_id: string;
  quantity_returned: number;
  condition_before: ConditionGrade;
  condition_after: ConditionGrade;
  return_date: string;
  days_overdue: number;
  late_fee_per_day: number;
  total_late_fee: number;
  damage_cost: number;
  cleaning_cost: number;
  line_deposit_refund: number;
  notes?: string;
  defects: ItemDefect[];
}

export interface ItemDefect {
  id: string;
  defect_type: DefectType;
  severity: DefectSeverity;
  description: string;
  customer_fault: boolean;
  repair_cost: number;
  replacement_cost: number;
  photos: DefectPhoto[];
  created_at: string;
}

export interface DefectPhoto {
  id: string;
  photo_url: string;
  description?: string;
  uploaded_at: string;
}

export interface ReturnInspection {
  id: string;
  return_line_id: string;
  inspector_id: string;
  inspection_date: string;
  pre_rental_photos: string[];
  post_rental_photos: string[];
  comparison_notes: string;
  overall_condition: ConditionGrade;
  functional_check_passed: boolean;
  cosmetic_check_passed: boolean;
  accessories_complete: boolean;
  packaging_condition: PackagingCondition;
  recommended_action: RecommendedAction;
  customer_acknowledgment: boolean;
  customer_signature?: string;
  dispute_raised: boolean;
  dispute_notes?: string;
}

export interface OutstandingRental {
  transaction_id: string;
  transaction_line_id: string;
  sku_id: string;
  sku_code: string;
  item_name: string;
  quantity_rented: number;
  quantity_returned: number;
  quantity_outstanding: number;
  rental_start_date: string;
  rental_end_date: string;
  days_overdue: number;
  daily_rate: number;
  deposit_per_unit: number;
  customer_id: string;
  customer_name: string;
  location_id: string;
  estimated_late_fee: number;
}

export interface ReturnCalculation {
  line_id: string;
  sku_id: string;
  quantity_returned: number;
  days_overdue: number;
  daily_rate: number;
  late_fee_rate: number; // 150% of daily rate
  late_fee_amount: number;
  damage_cost: number;
  cleaning_cost: number;
  deposit_per_unit: number;
  deposit_refund: number;
  net_refund: number;
}

export interface ReturnSummary {
  total_items_returned: number;
  total_items_outstanding: number;
  total_late_fees: number;
  total_damage_costs: number;
  total_cleaning_costs: number;
  total_deposit_held: number;
  total_deposit_refund: number;
  net_amount_due: number; // Positive if customer owes, negative if refund due
}

// Enums
export type ReturnType = 'PARTIAL' | 'FULL' | 'EARLY' | 'DAMAGED' | 'LOST';

export type ReturnStatus = 
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'INSPECTION_PENDING'
  | 'INSPECTION_COMPLETE'
  | 'FEES_CALCULATED'
  | 'PAYMENT_PENDING'
  | 'COMPLETED'
  | 'DISPUTED';

export type DefectType = 
  | 'COSMETIC_DAMAGE'
  | 'FUNCTIONAL_DAMAGE'
  | 'MISSING_PARTS'
  | 'MISSING_ACCESSORIES'
  | 'EXCESSIVE_WEAR'
  | 'TOTAL_FAILURE'
  | 'WATER_DAMAGE'
  | 'PHYSICAL_DAMAGE';

export type DefectSeverity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL';

export type ConditionGrade = 'A' | 'B' | 'C' | 'D';

export type PackagingCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'MISSING';

export type RecommendedAction = 
  | 'RETURN_TO_INVENTORY'
  | 'MINOR_CLEANING'
  | 'DEEP_CLEANING'
  | 'MINOR_REPAIR'
  | 'MAJOR_REPAIR'
  | 'QUARANTINE'
  | 'WRITE_OFF';

// Form data types
export interface ReturnWizardData {
  rental_transaction_id: string;
  return_type: ReturnType;
  selected_items: ReturnItemSelection[];
  inspection_data: Record<string, ReturnInspection>;
  fee_calculations: ReturnCalculation[];
  customer_acknowledgment: boolean;
  dispute_notes?: string;
}

export interface ReturnItemSelection {
  transaction_line_id: string;
  sku_id: string;
  quantity_to_return: number;
  return_date: string;
  condition_after: ConditionGrade;
  defects: ItemDefect[];
  notes?: string;
}

export interface FeeCalculationData {
  base_daily_rate: number;
  late_fee_multiplier: number; // 1.5 for 150%
  cleaning_fee_rates: Record<ConditionGrade, number>;
  damage_assessment_rates: Record<DefectSeverity, number>;
}

// Business rules configuration
export const RETURN_BUSINESS_RULES = {
  LATE_FEE_MULTIPLIER: 1.5, // 150% of daily rate
  GRACE_PERIOD_HOURS: 4, // 4-hour buffer
  CLEANING_FEES: {
    A: 0,    // No cleaning needed
    B: 200,  // Minor cleaning
    C: 500,  // Deep cleaning
    D: 1000, // Extensive cleaning/refurbishment
  },
  DAMAGE_COST_MULTIPLIERS: {
    MINOR: 0.1,    // 10% of item value
    MODERATE: 0.25, // 25% of item value
    MAJOR: 0.5,    // 50% of item value
    CRITICAL: 1.0,  // 100% of item value (replacement)
  },
  CONDITION_DOWNGRADE_CLEANING: {
    A: 'EXCELLENT',
    B: 'MINOR_CLEANING',
    C: 'DEEP_CLEANING',
    D: 'QUARANTINE',
  } as Record<ConditionGrade, RecommendedAction>,
};

// Filter and search types
export interface ReturnFilters {
  return_status?: ReturnStatus[];
  return_type?: ReturnType[];
  customer_id?: string;
  location_id?: string;
  date_range?: {
    start: string;
    end: string;
  };
  overdue_only?: boolean;
  disputed_only?: boolean;
  inspector_id?: string;
}

export interface OverdueRentalFilters {
  customer_id?: string;
  location_id?: string;
  sku_id?: string;
  days_overdue_min?: number;
  days_overdue_max?: number;
  estimated_fee_min?: number;
  estimated_fee_max?: number;
}