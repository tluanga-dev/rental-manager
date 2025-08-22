export type LocationType = 'WAREHOUSE' | 'STORE' | 'SERVICE_CENTER';

export interface Location {
  id: string;
  location_code: string;    // Match backend field name
  location_name: string;    // Match backend field name
  location_type: LocationType;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  contact_number?: string | null;  // Match backend field name
  email?: string | null;           // Match backend field name
  
  // Contact Person Fields
  contact_person_name?: string | null;
  contact_person_title?: string | null;
  contact_person_phone?: string | null;
  contact_person_email?: string | null;
  contact_person_notes?: string | null;
  
  manager_user_id?: number | null; // Backend field for manager
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Legacy compatibility fields (for gradual migration)
  code?: string;              // Alias for location_code
  name?: string;              // Alias for location_name
  contact_phone?: string;     // Alias for contact_number
  contact_email?: string;     // Alias for email
  contact_person?: string;    // Legacy single contact person field
}
