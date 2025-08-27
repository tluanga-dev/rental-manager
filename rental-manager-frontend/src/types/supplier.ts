// Base supplier interface matching exact backend schema
export interface Supplier {
  id: string;
  code: string;
  name: string;
  supplier_code?: string; // Legacy field mapping
  company_name?: string; // Legacy field mapping
  supplier_type: 'MANUFACTURER' | 'DISTRIBUTOR' | 'WHOLESALER' | 'RETAILER' | 'INVENTORY' | 'SERVICE' | 'DIRECT';
  supplier_tier?: 'PREMIUM' | 'STANDARD' | 'BASIC' | 'TRIAL';
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  website?: string | null;
  tax_id?: string | null;
  payment_terms?: string | null;
  credit_limit?: number | null;
  rating?: number | null;
  quality_rating?: number | null;
  delivery_rating?: number | null;
  performance_score?: number | null;
  total_orders?: number | null;
  total_spend?: number | null;
  average_delivery_days?: number | null;
  last_order_date?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// For backward compatibility - maps new fields to old expected names
export interface SupplierLegacy {
  id: string;
  supplier_code: string; // maps to 'code'
  company_name: string; // maps to 'name'
  display_name: string; // computed from name + code
  supplier_type: string;
  contact_number?: string; // maps to 'contact_phone'
  email?: string; // maps to 'contact_email'
  is_active: boolean;
}