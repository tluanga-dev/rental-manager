import { apiClient } from '@/lib/axios';

// Import types from returns.ts
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
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    company?: string;
  };
  rental?: {
    id: string;
    start_date: string;
    end_date: string;
    total_days: number;
    location_name: string;
  };
  items?: RentalReturnLine[];
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
  item_details?: {
    name: string;
    sku: string;
    category: string;
    brand: string;
  };
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
}

export interface DefectPhoto {
  id: string;
  file_path: string;
  description?: string;
  timestamp: string;
}

export type ReturnType = 'FULL' | 'PARTIAL';
export type ReturnStatus = 'PENDING_INSPECTION' | 'INSPECTION_COMPLETE' | 'FEES_CALCULATED' | 'COMPLETED' | 'CANCELLED';
export type ConditionGrade = 'A' | 'B' | 'C' | 'D';
export type DefectType = 'SURFACE_SCRATCHES' | 'DENTS' | 'MISSING_PARTS' | 'FUNCTIONAL_ISSUES' | 'WATER_DAMAGE' | 'ELECTRICAL_ISSUES' | 'WEAR_AND_TEAR' | 'OTHER';
export type DefectSeverity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL';

// Request/Response interfaces
export interface InitiateReturnRequest {
  rental_transaction_id: string;
  return_type: ReturnType;
  items: {
    transaction_line_id: string;
    quantity_returned: number;
  }[];
  notes?: string;
}

export interface ProcessPartialReturnRequest {
  items: {
    transaction_line_id: string;
    quantity_returned: number;
    condition_grade: ConditionGrade;
    notes?: string;
  }[];
}

export interface AssessDamageRequest {
  return_line_id: string;
  defects: {
    defect_type: DefectType;
    severity: DefectSeverity;
    description: string;
    customer_fault: boolean;
    repair_cost: number;
    replacement_cost: number;
  }[];
  condition_after: ConditionGrade;
  photos?: File[];
}

export interface CalculateLateFeeRequest {
  return_line_id: string;
  actual_return_date: string;
}

export interface FinalizeReturnRequest {
  payment_method?: string;
  customer_acknowledgment: boolean;
  notes?: string;
}

export interface ReturnListParams {
  skip?: number;
  limit?: number;
  status?: ReturnStatus;
  return_type?: ReturnType;
  customer_id?: string;
  location_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_by?: 'return_date' | 'created_at' | 'net_refund_amount';
  sort_order?: 'asc' | 'desc';
}

export interface ReturnListResponse {
  items: RentalReturnHeader[];
  total: number;
  skip: number;
  limit: number;
}

export interface OutstandingRentalsParams {
  customer_id?: string;
  location_id?: string;
  overdue_only?: boolean;
  days_overdue?: number;
  skip?: number;
  limit?: number;
}

export interface LateRentalsParams {
  days_overdue?: number;
  location_id?: string;
  skip?: number;
  limit?: number;
}

export interface InspectionNeededParams {
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  location_id?: string;
  skip?: number;
  limit?: number;
}

export interface ReturnAnalytics {
  total_returns: number;
  total_fees_collected: number;
  average_processing_time: number;
  damage_rate: number;
  on_time_return_rate: number;
  customer_satisfaction: number;
  monthly_trends: {
    returns_this_month: number;
    returns_last_month: number;
    fees_this_month: number;
    fees_last_month: number;
    avg_time_this_month: number;
    avg_time_last_month: number;
  };
  top_damage_types: {
    type: string;
    count: number;
    percentage: number;
    avg_cost: number;
  }[];
  top_customers_by_returns: {
    customer_name: string;
    returns_count: number;
    total_fees: number;
    avg_rating: number;
  }[];
}

// API service object
export const returnsApi = {
  // Initiate a new return - Updated to match API_REFERENCE.md
  initiateReturn: async (data: InitiateReturnRequest): Promise<RentalReturnHeader> => {
    const response = await apiClient.post('/rentals/rentals/', data);
    return response.data.success ? response.data.data : response.data;
  },

  // Get all returns with filters - Updated to match API_REFERENCE.md
  list: async (params?: ReturnListParams): Promise<ReturnListResponse> => {
    const response = await apiClient.get('/rentals/rentals/', { params });
    return response.data.success ? response.data.data : response.data;
  },

  // Get return by ID - Updated to match API_REFERENCE.md
  getById: async (id: string): Promise<RentalReturnHeader> => {
    const response = await apiClient.get(`/rentals/rentals/${id}`);
    return response.data.success ? response.data.data : response.data;
  },

  // Process partial return
  processPartialReturn: async (
    returnId: string, 
    data: ProcessPartialReturnRequest
  ): Promise<RentalReturnHeader> => {
    const response = await apiClient.post(`/rental-returns/${returnId}/process-partial`, data);
    return response.data.success ? response.data.data : response.data;
  },

  // Calculate late fees
  calculateLateFee: async (
    returnId: string, 
    data: CalculateLateFeeRequest
  ): Promise<{ late_fee: number; days_overdue: number }> => {
    const response = await apiClient.post(`/rental-returns/${returnId}/calculate-late-fee`, data);
    return response.data.success ? response.data.data : response.data;
  },

  // Assess damage
  assessDamage: async (returnId: string, data: AssessDamageRequest): Promise<RentalReturnLine> => {
    const formData = new FormData();
    
    // Add non-file fields
    formData.append('return_line_id', data.return_line_id);
    formData.append('defects', JSON.stringify(data.defects));
    formData.append('condition_after', data.condition_after);
    
    // Add photos if provided
    if (data.photos) {
      data.photos.forEach((photo) => {
        formData.append(`photos`, photo);
      });
    }

    const response = await apiClient.post(`/rental-returns/${returnId}/assess-damage`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Finalize return
  finalizeReturn: async (returnId: string, data: FinalizeReturnRequest): Promise<RentalReturnHeader> => {
    const response = await apiClient.post(`/rental-returns/${returnId}/finalize`, data);
    return response.data.success ? response.data.data : response.data;
  },

  // Get outstanding rentals (ready for return)
  getOutstandingRentals: async (params?: OutstandingRentalsParams): Promise<ReturnListResponse> => {
    const response = await apiClient.get('/rental-returns/outstanding', { params });
    return response.data.success ? response.data.data : response.data;
  },

  // Get late rentals
  getLateRentals: async (params?: LateRentalsParams): Promise<ReturnListResponse> => {
    const response = await apiClient.get('/rental-returns/late', { params });
    return response.data.success ? response.data.data : response.data;
  },

  // Get returns needing inspection
  getInspectionNeeded: async (params?: InspectionNeededParams): Promise<ReturnListResponse> => {
    const response = await apiClient.get('/rental-returns/inspection-needed', { params });
    return response.data.success ? response.data.data : response.data;
  },

  // Search returns by customer or return number
  search: async (query: string, limit: number = 10): Promise<RentalReturnHeader[]> => {
    const response = await apiClient.get('/rental-returns/search', { 
      params: { q: query, limit } 
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Get return analytics
  getAnalytics: async (dateRange?: string): Promise<ReturnAnalytics> => {
    try {
      const response = await apiClient.get('/analytics/analytics/returns', {
        params: { date_range: dateRange }
      });
      return response.data.success ? response.data.data : response.data;
    } catch (error) {
      console.warn('Return analytics API failed:', error);
      throw error;
    }
  },

  // Upload additional photos for a return
  uploadPhotos: async (returnId: string, lineId: string, photos: File[]): Promise<DefectPhoto[]> => {
    const formData = new FormData();
    formData.append('return_line_id', lineId);
    
    photos.forEach((photo) => {
      formData.append('photos', photo);
    });

    const response = await apiClient.post(`/rental-returns/${returnId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.success ? response.data.data : response.data;
  },

  // Delete a return (admin only)
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/rental-returns/${id}`);
  },

  // Update return notes
  updateNotes: async (id: string, notes: string): Promise<RentalReturnHeader> => {
    const response = await apiClient.patch(`/rental-returns/${id}/notes`, { notes });
    return response.data.success ? response.data.data : response.data;
  },

  // Get return summary for printing/export
  getReturnSummary: async (id: string): Promise<Record<string, unknown>> => {
    const response = await apiClient.get(`/rental-returns/${id}/summary`);
    return response.data.success ? response.data.data : response.data;
  },

  // Export returns data
  exportReturns: async (params?: ReturnListParams & { format?: 'csv' | 'xlsx' }): Promise<Blob> => {
    const response = await apiClient.get('/rental-returns/export', {
      params,
      responseType: 'blob'
    });
    return response.data;
  }
};

// Export commonly used types for convenience
export type {
  ReturnType as RentalReturnType,
  ReturnStatus as RentalReturnStatus,
  ConditionGrade as RentalConditionGrade,
  DefectType as RentalDefectType,
  DefectSeverity as RentalDefectSeverity
};