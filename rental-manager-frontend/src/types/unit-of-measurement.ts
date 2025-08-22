// Base unit of measurement interface matching backend schema
export interface UnitOfMeasurement {
  id: string;
  name: string;
  code: string;
  unit_type?: string | null;
  conversion_factor?: number | null;
  base_unit?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

// Request types
export interface CreateUnitOfMeasurementRequest {
  name: string;
  code: string;
  unit_type?: string;
  conversion_factor?: number;
  base_unit?: string;
  description?: string;
}

export interface UpdateUnitOfMeasurementRequest {
  name?: string;
  code?: string;
  unit_type?: string;
  conversion_factor?: number;
  base_unit?: string;
  description?: string;
}

// Form data types
export interface UnitOfMeasurementUpdateFormData {
  name?: string;
  code?: string;
  description?: string;
}

// Response types
export interface UnitOfMeasurementListResponse {
  items: UnitOfMeasurement[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// For dropdown component
export interface UnitOfMeasurementOption {
  id: string;
  name: string;
  code?: string;
}