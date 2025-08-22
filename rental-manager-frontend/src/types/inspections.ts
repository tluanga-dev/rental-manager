// Inspection and quality control types
export interface InspectionItem {
  id: string;
  sku_id: string;
  sku_code: string;
  item_name: string;
  serial_number?: string;
  location_id: string;
  transaction_id?: string;
  transaction_line_id?: string;
  inspection_type: InspectionType;
  status: InspectionStatus;
  assigned_to?: string;
  priority: InspectionPriority;
  due_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InspectionReport {
  id: string;
  inspection_item_id: string;
  inspector_id: string;
  inspection_date: string;
  inspection_type: InspectionType;
  overall_condition: ConditionGrade;
  checklist_items: ChecklistItem[];
  photos: InspectionPhoto[];
  defects: InspectionDefect[];
  recommended_actions: RecommendedAction[];
  customer_signature?: string;
  inspector_signature: string;
  completion_time: number; // minutes
  notes?: string;
  approved_by?: string;
  approved_at?: string;
}

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  item: string;
  required: boolean;
  status: ChecklistStatus;
  notes?: string;
  photo_required: boolean;
  photo_urls?: string[];
}

export interface InspectionPhoto {
  id: string;
  photo_url: string;
  angle: PhotoAngle;
  description: string;
  required: boolean;
  timestamp: string;
  metadata?: PhotoMetadata;
}

export interface PhotoMetadata {
  device_info: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  file_size: number;
  resolution: string;
  camera_settings?: string;
}

export interface InspectionDefect {
  id: string;
  type: DefectType;
  severity: DefectSeverity;
  location_on_item: string;
  description: string;
  customer_fault: boolean;
  repair_required: boolean;
  estimated_repair_cost: number;
  estimated_repair_time: number; // hours
  photos: string[];
  created_at: string;
}

export interface ServiceQueueItem {
  id: string;
  sku_id: string;
  sku_code: string;
  item_name: string;
  serial_number?: string;
  service_type: ServiceType;
  priority: ServicePriority;
  estimated_duration: number; // hours
  estimated_cost: number;
  assigned_to?: string;
  status: ServiceStatus;
  defects: InspectionDefect[];
  notes?: string;
  scheduled_date?: string;
  started_at?: string;
  completed_at?: string;
  quality_check_passed?: boolean;
}

export interface InspectionTemplate {
  id: string;
  name: string;
  inspection_type: InspectionType;
  category_id?: string;
  checklist_items: ChecklistTemplateItem[];
  required_photos: RequiredPhotoAngle[];
  estimated_duration: number; // minutes
  instructions: string;
  is_active: boolean;
}

export interface ChecklistTemplateItem {
  id: string;
  category: ChecklistCategory;
  item: string;
  description?: string;
  required: boolean;
  photo_required: boolean;
  order: number;
}

export interface InspectionStats {
  total_inspections: number;
  pending_inspections: number;
  overdue_inspections: number;
  avg_completion_time: number;
  defect_rate: number;
  photos_captured: number;
  inspector_performance: InspectorPerformance[];
}

export interface InspectorPerformance {
  inspector_id: string;
  inspector_name: string;
  total_inspections: number;
  avg_completion_time: number;
  defect_detection_rate: number;
  quality_score: number;
}

// Enums
export type InspectionType = 
  | 'PRE_RENTAL'
  | 'POST_RENTAL'
  | 'MAINTENANCE'
  | 'QUALITY_CHECK'
  | 'DAMAGE_ASSESSMENT'
  | 'RETURN_VERIFICATION';

export type InspectionStatus = 
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REQUIRES_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type InspectionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type ChecklistCategory = 
  | 'PHYSICAL_CONDITION'
  | 'FUNCTIONAL_TEST'
  | 'ACCESSORIES'
  | 'PACKAGING'
  | 'DOCUMENTATION'
  | 'SAFETY_CHECK'
  | 'CLEANLINESS'
  | 'SERIAL_VERIFICATION';

export type ChecklistStatus = 'PENDING' | 'PASS' | 'FAIL' | 'NOT_APPLICABLE';

export type PhotoAngle = 
  | 'FRONT'
  | 'BACK'
  | 'LEFT_SIDE'
  | 'RIGHT_SIDE'
  | 'TOP'
  | 'BOTTOM'
  | 'SERIAL_NUMBER'
  | 'DEFECT_CLOSEUP'
  | 'ACCESSORIES'
  | 'PACKAGING';

export type RequiredPhotoAngle = PhotoAngle;

export type ServiceType = 
  | 'CLEANING'
  | 'MINOR_REPAIR'
  | 'MAJOR_REPAIR'
  | 'PART_REPLACEMENT'
  | 'CALIBRATION'
  | 'SOFTWARE_UPDATE'
  | 'REFURBISHMENT'
  | 'WRITE_OFF';

export type ServicePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type ServiceStatus = 
  | 'QUEUED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'QUALITY_CHECK'
  | 'APPROVED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type ConditionGrade = 'A' | 'B' | 'C' | 'D';

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

export type RecommendedAction = 
  | 'RETURN_TO_INVENTORY'
  | 'MINOR_CLEANING'
  | 'DEEP_CLEANING'
  | 'MINOR_REPAIR'
  | 'MAJOR_REPAIR'
  | 'QUARANTINE'
  | 'WRITE_OFF';

// Form data types
export interface InspectionFormData {
  inspection_item_id: string;
  inspection_type: InspectionType;
  checklist_items: ChecklistItem[];
  photos: File[];
  defects: Partial<InspectionDefect>[];
  overall_condition: ConditionGrade;
  notes?: string;
  customer_signature?: string;
}

export interface ChecklistTemplateItem {
  category: ChecklistCategory;
  item: string;
  required: boolean;
  photo_required?: boolean;
}

export interface MobileInspectionState {
  current_inspection?: InspectionItem;
  photos_captured: InspectionPhoto[];
  checklist_progress: Record<string, ChecklistStatus>;
  defects_found: InspectionDefect[];
  inspection_start_time: string;
  offline_mode: boolean;
  sync_pending: boolean;
}

// Configuration
export const INSPECTION_CONFIG = {
  REQUIRED_PHOTOS: {
    PRE_RENTAL: ['FRONT', 'BACK', 'TOP', 'SERIAL_NUMBER', 'ACCESSORIES', 'PACKAGING'] as PhotoAngle[],
    POST_RENTAL: ['FRONT', 'BACK', 'TOP', 'SERIAL_NUMBER', 'DEFECT_CLOSEUP'] as PhotoAngle[],
    MAINTENANCE: ['FRONT', 'SERIAL_NUMBER', 'DEFECT_CLOSEUP'] as PhotoAngle[],
  },
  MAX_PHOTO_SIZE: 5 * 1024 * 1024, // 5MB
  MIN_PHOTO_RESOLUTION: '1280x720',
  INSPECTION_TIMEOUT: 30, // minutes
  OFFLINE_STORAGE_LIMIT: 100, // inspections
};

// Generic inspection checklist template - can be customized per category in the future
export const DEFAULT_CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  { category: 'PHYSICAL_CONDITION', item: 'No visible damage or defects', required: true },
  { category: 'PHYSICAL_CONDITION', item: 'All components intact', required: true },
  { category: 'FUNCTIONAL_TEST', item: 'Item powers on/operates correctly', required: true },
  { category: 'FUNCTIONAL_TEST', item: 'All features working as expected', required: true },
  { category: 'ACCESSORIES', item: 'All required accessories present', required: true },
  { category: 'PACKAGING', item: 'Protective packaging included', required: false },
  { category: 'CLEANLINESS', item: 'Item clean and ready for rental', required: true },
  { category: 'SERIAL_VERIFICATION', item: 'Serial number matches records', required: true },
];

// Fallback for backward compatibility - all categories use the same generic template
export const CHECKLIST_TEMPLATES = new Proxy({}, {
  get: () => DEFAULT_CHECKLIST_TEMPLATE
}) as Record<string, ChecklistTemplateItem[]>;