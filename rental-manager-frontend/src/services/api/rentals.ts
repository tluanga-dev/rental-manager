import { apiClient } from '@/lib/api-client';
import type {
  // Core Types
  Rental,
  RentalReturn,
  RentalListResponse,
  ApiResponse,
  // Enhanced API Guide Types
  RentalTransaction,
  RentalFilterParams,
  RentalApiResponse,
  // Request Types
  CreateRentalRequest,
  CreateReturnRequest,
  ExtendRentalRequest,
  CalculateChargesRequest,
  CalculateChargesResponse,
  AvailabilityCheck,
  AvailabilityResponse,
  Reservation,
  // Filter Types
  RentalFilters,
  CustomerRentalFilters,
  ReportFilters,
  // Report Types
  RevenueReport,
  UtilizationReport,
  OverdueReport,
  // Other Types
  RentalStatus,
  TransactionStatus,
} from '@/types/rentals';

/**
 * Comprehensive Rental API Service
 * Implements all endpoints from the rental API documentation
 */
export const rentalsApi = {
  // ============= RENTAL MANAGEMENT =============

  /**
   * Create a new rental transaction with automatic inventory allocation
   */
  createRental: async (data: CreateRentalRequest): Promise<Rental> => {
    const response = await apiClient.post<ApiResponse<Rental>>('/transactions/rentals/new', data);
    return response.data.data;
  },

  /**
   * Get a paginated list of rental transactions with filtering
   */
  getRentals: async (filters?: RentalFilters): Promise<RentalListResponse> => {
    const params = {
      transaction_type: 'RENTAL',
      ...filters,
    };
    const response = await apiClient.get<RentalListResponse>('/transactions/', { params });
    return response.data;
  },

  /**
   * Get rental transactions using the enhanced filtering API
   * Based on the rental filtering API guide
   */
  getRentalTransactions: async (filters: RentalFilterParams = {}): Promise<RentalTransaction[]> => {
    const queryParams = new URLSearchParams();
    
    // Always include transaction_type=RENTAL to filter for rental transactions
    queryParams.append('transaction_type', 'RENTAL');
    
    // Add each parameter if it exists
    if (filters.skip !== undefined) queryParams.append('skip', filters.skip.toString());
    if (filters.limit !== undefined) queryParams.append('limit', filters.limit.toString());
    if (filters.party_id) queryParams.append('party_id', filters.party_id);
    if (filters.location_id) queryParams.append('location_id', filters.location_id);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.rental_status) queryParams.append('rental_status', filters.rental_status);
    if (filters.date_from) queryParams.append('date_from', filters.date_from);
    if (filters.date_to) queryParams.append('date_to', filters.date_to);
    if (filters.overdue_only !== undefined) queryParams.append('overdue_only', filters.overdue_only.toString());
    
    // Use the main transactions endpoint with rental filter
    const response = await apiClient.get<RentalTransaction[]>(
      `/transactions/?${queryParams.toString()}`
    );
    return response.data;
  },

  /**
   * Export rental transactions in specified format
   */
  exportRentalTransactions: async (
    filters: RentalFilterParams, 
    format: 'csv' | 'excel' = 'csv'
  ): Promise<Blob> => {
    const queryParams = new URLSearchParams();
    
    // Add filters to query
    if (filters.skip !== undefined) queryParams.append('skip', filters.skip.toString());
    if (filters.limit !== undefined) queryParams.append('limit', filters.limit.toString());
    if (filters.party_id) queryParams.append('party_id', filters.party_id);
    if (filters.location_id) queryParams.append('location_id', filters.location_id);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.rental_status) queryParams.append('rental_status', filters.rental_status);
    if (filters.date_from) queryParams.append('date_from', filters.date_from);
    if (filters.date_to) queryParams.append('date_to', filters.date_to);
    if (filters.overdue_only !== undefined) queryParams.append('overdue_only', filters.overdue_only.toString());
    
    // Add format parameter
    queryParams.append('format', format);
    
    const response = await apiClient.get(
      `/transactions/rentals/export?${queryParams.toString()}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  /**
   * Get comprehensive rental transaction data by ID
   * Includes original rental, return history, and returnable items
   */
  getRentalById: async (id: string): Promise<any> => {
    const response = await apiClient.get(`/transactions/rentals/${id}`);
    // The backend now returns comprehensive data including return_history, returnable_items, and return_summary
    return response.data.data;
  },

  /**
   * @deprecated Use getRentalById instead - it now returns all comprehensive data
   * Get rental transaction with complete return history
   * Includes all return transactions and their details
   */
  getRentalWithReturns: async (id: string): Promise<any> => {
    // This method is now deprecated - getRentalById returns comprehensive data
    return rentalsApi.getRentalById(id);
  },

  /**
   * Get a rental by its transaction number
   */
  getRentalByNumber: async (transactionNumber: string): Promise<Rental> => {
    const response = await apiClient.get<Rental>(`/transactions/number/${transactionNumber}`);
    return response.data;
  },

  /**
   * Get a rental transaction along with all its line items
   */
  getRentalWithLines: async (id: string): Promise<Rental> => {
    const response = await apiClient.get<Rental>(`/transactions/${id}/with-lines`);
    return response.data;
  },

  /**
   * Update the status of a rental transaction
   */
  updateRentalStatus: async (
    id: string,
    data: {
      status: RentalStatus;
      notes?: string;
      picked_up_by?: string;
      pickup_signature?: string;
    }
  ): Promise<Rental> => {
    const response = await apiClient.patch<ApiResponse<Rental>>(
      `/transactions/${id}/rental-status`,
      data
    );
    return response.data.data;
  },

  /**
   * Extend the rental period for active rentals
   */
  extendRental: async (id: string, data: ExtendRentalRequest): Promise<Rental> => {
    const response = await apiClient.post<ApiResponse<Rental>>(
      `/rentals/${id}/extend`,
      data
    );
    return response.data.data;
  },

  /**
   * Calculate rental charges before creating a rental
   */
  calculateCharges: async (data: CalculateChargesRequest): Promise<CalculateChargesResponse> => {
    const response = await apiClient.post<CalculateChargesResponse>(
      '/rentals/calculate-charges',
      data
    );
    return response.data;
  },

  // ============= RENTAL RETURNS =============

  /**
   * Process the return of rented items
   */
  createReturn: async (rentalId: string, data: CreateReturnRequest): Promise<RentalReturn> => {
    const response = await apiClient.post<RentalReturn>(
      `/transactions/rentals/${rentalId}/return-direct`,
      data
    );
    return response.data;
  },

  /**
   * Get a list of rental returns
   */
  getReturns: async (filters?: {
    skip?: number;
    limit?: number;
    return_date_from?: string;
    return_date_to?: string;
    has_damage?: boolean;
    party_id?: string;
  }): Promise<{ items: RentalReturn[]; total: number; skip: number; limit: number }> => {
    const response = await apiClient.get('/rentals/returns', { params: filters });
    return response.data;
  },

  /**
   * Get details of a specific return
   */
  getReturnById: async (returnId: string): Promise<RentalReturn> => {
    const response = await apiClient.get<RentalReturn>(`/rentals/returns/${returnId}`);
    return response.data;
  },

  /**
   * Update damage assessment after detailed inspection
   */
  processDamageAssessment: async (
    returnId: string,
    data: {
      assessments: Array<{
        item_id: string;
        unit_code: string;
        damage_type: 'COSMETIC' | 'FUNCTIONAL' | 'STRUCTURAL' | 'MISSING_PARTS';
        severity: 'MINOR' | 'MODERATE' | 'MAJOR';
        repair_needed: boolean;
        repair_cost_estimate: number;
        write_off: boolean;
        charge_to_customer: number;
        notes?: string;
        photos?: string[];
      }>;
      assessment_complete: boolean;
      assessed_by: string;
    }
  ): Promise<RentalReturn> => {
    const response = await apiClient.post<ApiResponse<RentalReturn>>(
      `/rentals/returns/${returnId}/damage-assessment`,
      data
    );
    return response.data.data;
  },

  // ============= RENTAL AVAILABILITY =============

  /**
   * Check availability of items for a specific period
   */
  checkAvailability: async (data: AvailabilityCheck): Promise<AvailabilityResponse> => {
    const response = await apiClient.post<AvailabilityResponse>(
      '/rentals/check-availability',
      data
    );
    return response.data;
  },

  /**
   * Get list of available items for rent
   */
  getAvailableItems: async (filters?: {
    category_id?: string;
    start_date?: string;
    end_date?: string;
    location_id?: string;
    min_quantity?: number;
    search?: string;
  }): Promise<any[]> => {
    const response = await apiClient.get('/rentals/available-items', { params: filters });
    return response.data;
  },

  /**
   * Create a reservation for items
   */
  createReservation: async (data: Reservation): Promise<{ reservation_id: string }> => {
    const response = await apiClient.post<{ reservation_id: string }>(
      '/rentals/reservations',
      data
    );
    return response.data;
  },

  /**
   * Cancel a reservation and release items
   */
  cancelReservation: async (reservationId: string): Promise<void> => {
    await apiClient.delete(`/rentals/reservations/${reservationId}`);
  },

  // ============= CUSTOMER RENTALS =============

  /**
   * Get active rentals for a specific customer
   */
  getCustomerActiveRentals: async (customerId: string): Promise<{
    customer: {
      id: string;
      name: string;
      code: string;
    };
    active_rentals: Array<{
      rental_id: string;
      rental_number: string;
      start_date: string;
      end_date: string;
      days_remaining: number;
      total_items: number;
      total_value: number;
      balance_due: number;
      status: RentalStatus;
      is_overdue: boolean;
    }>;
    summary: {
      total_active_rentals: number;
      total_items_on_rent: number;
      total_value_on_rent: number;
      total_balance_due: number;
      has_overdue: boolean;
    };
  }> => {
    const response = await apiClient.get(`/customers/${customerId}/rentals/active`);
    return response.data;
  },

  /**
   * Get rental history for a customer
   */
  getCustomerRentalHistory: async (
    customerId: string,
    filters?: CustomerRentalFilters
  ): Promise<RentalListResponse> => {
    const response = await apiClient.get(
      `/customers/${customerId}/rentals/history`,
      { params: filters }
    );
    return response.data;
  },

  /**
   * Get overdue rentals for a customer
   */
  getCustomerOverdueRentals: async (customerId: string): Promise<Rental[]> => {
    const response = await apiClient.get(`/customers/${customerId}/rentals/overdue`);
    return response.data;
  },

  // ============= RENTAL REPORTS =============

  /**
   * Generate rental revenue report
   */
  getRevenueReport: async (filters?: ReportFilters): Promise<RevenueReport> => {
    const response = await apiClient.get<RevenueReport>('/reports/rentals/revenue', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get item utilization report showing how efficiently items are being rented
   */
  getUtilizationReport: async (filters?: ReportFilters): Promise<UtilizationReport> => {
    const response = await apiClient.get<UtilizationReport>('/reports/rentals/utilization', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get list of all overdue rentals
   */
  getOverdueReport: async (): Promise<OverdueReport> => {
    const response = await apiClient.get<OverdueReport>('/reports/rentals/overdue');
    return response.data;
  },

  // ============= RENTAL AGREEMENTS =============

  /**
   * Generate a rental agreement PDF
   */
  generateAgreement: async (
    rentalId: string,
    data: {
      template_id: string;
      include_terms: boolean;
      include_insurance: boolean;
      custom_terms?: string[];
      signatory_name: string;
      signatory_title?: string;
    }
  ): Promise<{
    success: boolean;
    agreement_id: string;
    document_url: string;
    preview_url: string;
    expires_at: string;
  }> => {
    const response = await apiClient.post(`/rentals/${rentalId}/agreement/generate`, data);
    return response.data;
  },

  /**
   * Get available agreement templates
   */
  getAgreementTemplates: async (): Promise<Array<{
    id: string;
    name: string;
    description: string;
    version: string;
    is_default: boolean;
  }>> => {
    const response = await apiClient.get('/rentals/agreement-templates');
    return response.data;
  },

  // ============= UTILITY METHODS =============

  /**
   * Search rentals by query
   */
  searchRentals: async (query: string, limit = 10): Promise<Rental[]> => {
    const response = await apiClient.get<Rental[]>('/transactions/search', {
      params: { q: query, limit, transaction_type: 'RENTAL' },
    });
    return response.data;
  },

  /**
   * Search rental transactions with advanced filtering and sorting
   */
  searchRentalTransactions: async (params?: {
    // Pagination
    skip?: number;
    limit?: number;
    
    // Search parameters
    search?: string;
    customer_search?: string;
    item_search?: string;
    transaction_number_search?: string;
    
    // Date filters
    date_from?: string;
    date_to?: string;
    rental_start_from?: string;
    rental_start_to?: string;
    rental_end_from?: string;
    rental_end_to?: string;
    
    // Status filters
    status?: string;
    rental_status?: string;
    payment_status?: string;
    
    // Location and category filters
    location_id?: string;
    category_id?: string;
    
    // Amount filters
    amount_from?: number;
    amount_to?: number;
    
    // Sorting parameters
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    secondary_sort_by?: string;
    secondary_sort_order?: 'asc' | 'desc';
    
    // Advanced options
    include_items?: boolean;
    include_customer?: boolean;
    highlight_search?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    data: Array<{
      id: string;
      transaction_number: string;
      transaction_date: string;
      customer: {
        id: string;
        name: string;
        email?: string;
        phone?: string;
        customer_type: string;
      };
      location: {
        id: string;
        name: string;
      };
      rental_period: {
        start_date: string;
        end_date: string;
        duration_days: number;
      };
      financial: {
        subtotal: number;
        discount_amount: number;
        tax_amount: number;
        total_amount: number;
        deposit_amount?: number;
      };
      status: {
        transaction_status: string;
        rental_status?: string;
        payment_status?: string;
      };
      items: Array<{
        id: string;
        name: string;
        sku?: string;
        category?: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      }>;
      search_highlights?: {
        customer_name?: string;
        customer_email?: string;
        customer_phone?: string;
        item_names: string[];
        item_skus: string[];
        transaction_number?: string;
      };
      created_at: string;
      updated_at: string;
    }>;
    pagination: {
      total: number;
      page: number;
      pages: number;
      skip: number;
      limit: number;
      has_next: boolean;
      has_previous: boolean;
    };
    search_metadata: {
      query?: string;
      filters_applied: Record<string, any>;
      sort_applied: Record<string, string>;
      execution_time_ms: number;
      total_results: number;
    };
  }> => {
    // Map frontend parameters to backend parameter names
    const backendParams: any = {};
    
    // Direct mappings
    if (params?.skip !== undefined) backendParams.skip = params.skip;
    if (params?.limit !== undefined) backendParams.limit = params.limit;
    if (params?.search) backendParams.search = params.search;
    if (params?.status) backendParams.status = params.status;
    if (params?.rental_status) backendParams.rental_status = params.rental_status;
    if (params?.payment_status) backendParams.payment_status = params.payment_status;
    if (params?.location_id) backendParams.location_id = params.location_id;
    if (params?.sort_by) backendParams.sort_by = params.sort_by;
    if (params?.sort_order) backendParams.sort_order = params.sort_order;
    
    // Date mappings
    if (params?.date_from) backendParams.start_date = params.date_from;
    if (params?.date_to) backendParams.end_date = params.date_to;
    if (params?.rental_start_from) backendParams.rental_start_date = params.rental_start_from;
    if (params?.rental_end_from) backendParams.rental_end_date = params.rental_end_from;
    
    // Use the main rentals endpoint which now supports search and sorting
    const response = await apiClient.get('/transactions/rentals/', { params: backendParams });
    return response.data;
  },

  /**
   * Get active rental transactions (in progress, late, extended, or partial returns)
   */
  getActiveRentals: async (params?: {
    skip?: number;
    limit?: number;
    status_filter?: 'in_progress' | 'overdue' | 'extended' | 'partial_return';
    location_id?: string;
    customer_id?: string;
    show_overdue_only?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    data: Array<{
      id: string;
      transaction_number: string;
      transaction_date: string;
      party_id: string;
      customer_name: string;
      customer_email?: string;
      customer_phone?: string;
      customer_type: string;
      location_id: string;
      location_name: string;
      payment_method?: string;
      subtotal: number;
      tax_amount: number;
      total_amount: number;
      deposit_amount: number;
      discount_amount: number;
      status: string;
      rental_status: string;
      payment_status?: string;
      rental_start_date?: string;
      rental_end_date?: string;
      is_overdue: boolean;
      days_overdue: number;
      delivery_required: boolean;
      delivery_address?: string;
      delivery_date?: string;
      delivery_time?: string;
      pickup_required: boolean;
      pickup_date?: string;
      pickup_time?: string;
      reference_number?: string;
      notes?: string;
      created_at: string;
      updated_at: string;
      items_count: number;
      items: Array<{
        id: string;
        line_number: number;
        item_id: string;
        item_name: string;
        sku?: string;
        description?: string;
        quantity: number;
        unit_price: number;
        line_total: number;
        discount_amount: number;
        rental_period?: number;
        rental_period_unit?: string;
        rental_start_date?: string;
        rental_end_date?: string;
        current_rental_status?: string;
        notes?: string;
      }>;
      customer: {
        id: string;
        name: string;
        email?: string;
        phone?: string;
        customer_type: string;
      };
      location: {
        id: string;
        name: string;
      };
      financial_summary: {
        subtotal: number;
        discount_amount: number;
        tax_amount: number;
        total_amount: number;
        deposit_amount: number;
      };
      rental_period: {
        start_date?: string;
        end_date?: string;
        duration_days: number;
      };
    }>;
    summary: {
      total_rentals: number;
      total_value: number;
      overdue_count: number;
      locations: Array<{
        location_id: string;
        location_name: string;
        rental_count: number;
        total_value: number;
      }>;
      status_breakdown: Record<string, number>;
      aggregated_stats?: {
        in_progress: number;
        overdue: number;
        extended: number;
        partial_return: number;
      };
      rental_metrics?: {
        total_active_rentals: number;
        total_active_value: number;
        overdue_rentals_count: number;
        overdue_rentals_value: number;
        average_days_overdue: number;
        items_at_risk: number;
      };
    };
    pagination: {
      skip: number;
      limit: number;
      total: number;
    };
    timestamp: string;
  }> => {
    const response = await apiClient.get('/transactions/rentals/active', { params });
    return response.data;
  },

  /**
   * Get rentals due today with enhanced filtering and summary statistics
   */
  getRentalsDueToday: async (filters?: {
    location_id?: string;
    search?: string;
    status?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: Array<{
      id: string;
      transaction_number: string;
      party_id: string;
      customer_name: string;
      customer_phone?: string;
      customer_email?: string;
      location_id: string;
      location_name: string;
      rental_start_date: string;
      rental_end_date: string;
      days_overdue: number;
      is_overdue: boolean;
      status: string;
      payment_status: string;
      total_amount: number;
      deposit_amount: number;
      items_count: number;
      items: Array<{
        id: string;
        item_id: string;
        item_name: string;
        sku?: string;
        quantity: number;
        unit_price: number;
        rental_period_value: number;
        rental_period_unit: string;
        current_rental_status?: string;
        notes?: string;
      }>;
      created_at: string;
      updated_at: string;
    }>;
    summary: {
      total_rentals: number;
      total_value: number;
      overdue_count: number;
      locations: Array<{
        location_id: string;
        location_name: string;
        rental_count: number;
        total_value: number;
      }>;
      status_breakdown: Record<string, number>;
    };
    filters_applied: Record<string, any>;
    timestamp: string;
  }> => {
    const response = await apiClient.get('/transactions/rentals/due_today', { params: filters });
    return response.data;
  },

  /**
   * Calculate late fees for a rental
   */
  calculateLateFees: async (
    rentalId: string,
    returnDate: string
  ): Promise<{
    total_late_fee: number;
    items: Array<{
      rental_item_id: string;
      days_overdue: number;
      late_fee: number;
    }>;
  }> => {
    const response = await apiClient.post(`/transactions/${rentalId}/calculate-late-fees`, {
      return_date: returnDate,
    });
    return response.data;
  },

  /**
   * Get overdue rentals with filtering
   */
  getOverdueRentals: async (filters?: {
    skip?: number;
    limit?: number;
    party_id?: string;
    location_id?: string;
    days_overdue_min?: number;
    days_overdue_max?: number;
    search?: string;
  }): Promise<RentalListResponse> => {
    const response = await apiClient.get<RentalListResponse>('/transactions/overdue', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Validate rental dates
   */
  validateRentalDates: async (
    startDate: string,
    endDate: string
  ): Promise<{
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  }> => {
    const response = await apiClient.post('/rentals/validate-dates', {
      rental_start_date: startDate,
      rental_end_date: endDate,
    });
    return response.data;
  },

  // ============= ANALYTICS DASHBOARD =============

  /**
   * Get comprehensive rental analytics for dashboard
   */
  getRentalAnalytics: async (filters?: {
    start_date?: string;
    end_date?: string;
    party_id?: string;
    location_id?: string;
  }): Promise<{
    overview: {
      total_rentals: number;
      total_revenue: number;
      average_rental_value: number;
      active_rentals: number;
      overdue_rentals: number;
      completion_rate: number;
    };
    trends: {
      daily_rentals: Array<{ date: string; count: number; revenue: number }>;
      monthly_growth: number;
      revenue_growth: number;
    };
    top_performers: {
      customers: Array<{
        party_id: string;
        customer_name: string;
        total_rentals: number;
        total_revenue: number;
      }>;
      items: Array<{
        item_id: string;
        item_name: string;
        rental_count: number;
        revenue: number;
        utilization_rate: number;
      }>;
      locations: Array<{
        location_id: string;
        location_name: string;
        rental_count: number;
        revenue: number;
      }>;
    };
    recent_activity: Array<{
      rental_id: string;
      rental_number: string;
      customer_name: string;
      action: 'created' | 'picked_up' | 'returned' | 'extended' | 'cancelled';
      timestamp: string;
      amount?: number;
    }>;
  }> => {
    try {
      const response = await apiClient.get('/analytics/rentals/dashboard', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch rental analytics:', error);
      // Return fallback data structure
      return {
        overview: {
          total_rentals: 0,
          total_revenue: 0,
          average_rental_value: 0,
          active_rentals: 0,
          overdue_rentals: 0,
          completion_rate: 0,
        },
        trends: {
          daily_rentals: [],
          monthly_growth: 0,
          revenue_growth: 0,
        },
        top_performers: {
          customers: [],
          items: [],
          locations: [],
        },
        recent_activity: [],
      };
    }
  },
};

// Export individual API functions for easier imports
export const {
  createRental,
  getRentals,
  getRentalTransactions,
  exportRentalTransactions,
  getRentalById,
  getRentalWithReturns,
  getRentalByNumber,
  getRentalWithLines,
  updateRentalStatus,
  extendRental,
  calculateCharges,
  createReturn,
  getReturns,
  getReturnById,
  processDamageAssessment,
  checkAvailability,
  getAvailableItems,
  createReservation,
  cancelReservation,
  getCustomerActiveRentals,
  getCustomerRentalHistory,
  getCustomerOverdueRentals,
  getRevenueReport,
  getUtilizationReport,
  getOverdueReport,
  generateAgreement,
  getAgreementTemplates,
  searchRentals,
  searchRentalTransactions,
  getActiveRentals,
  getRentalsDueToday,
  calculateLateFees,
  getOverdueRentals,
  validateRentalDates,
  getRentalAnalytics,
} = rentalsApi;

export default rentalsApi;