import { apiClient } from './client';

// Types
export interface BatchSummary {
  batch_code: string;
  item_id: string;
  item_name: string;
  location_id: string;
  location_name: string;
  total_units: number;
  total_quantity: number;
  available_quantity: number;
  purchase_price: number;
  sale_price?: number;
  rental_rate?: number;
  warranty_expiry?: string;
  created_at: string;
}

export interface BatchReport {
  batch_code: string;
  summary: BatchSummary;
  units: InventoryUnit[];
  financial_summary: FinancialSummary;
  status_breakdown: Record<string, number>;
}

export interface InventoryUnit {
  id: string;
  sku: string;
  serial_number?: string;
  status: string;
  quantity: number;
  purchase_price: number;
  sale_price?: number;
  rental_rate_per_period?: number;
  warranty_expiry?: string;
  batch_code?: string;
  model_number?: string;
  remarks?: string;
}

export interface FinancialSummary {
  total_purchase_value: number;
  total_sale_value?: number;
  potential_profit?: number;
  average_purchase_price: number;
  rental_value_per_period?: number;
}

export interface WarrantyExpiryItem {
  unit_id: string;
  sku: string;
  item_name: string;
  batch_code?: string;
  serial_number?: string;
  warranty_expiry: string;
  days_remaining: number;
  location_name: string;
  purchase_date?: string;
  purchase_price: number;
}

export interface PricingComparison {
  item_id: string;
  item_name: string;
  batches: BatchPricing[];
}

export interface BatchPricing {
  batch_code: string;
  location: string;
  unit_count: number;
  total_quantity: number;
  purchase_price: {
    average: number;
    min: number;
    max: number;
  };
  sale_price?: number;
  rental_rate?: number;
  batch_date?: string;
  margin?: number;
  margin_percentage?: number;
}

export interface BatchSearchParams {
  batch_code?: string;
  item_id?: string;
  location_id?: string;
}

export interface WarrantyParams {
  days_ahead?: number;
  location_id?: string;
}

// API Service
class BatchTrackingService {
  private baseUrl = '/inventory/batch';

  async searchBatches(params: BatchSearchParams = {}): Promise<BatchSummary[]> {
    const queryParams = new URLSearchParams();
    
    if (params.batch_code) queryParams.append('batch_code', params.batch_code);
    if (params.item_id) queryParams.append('item_id', params.item_id);
    if (params.location_id) queryParams.append('location_id', params.location_id);
    
    const response = await apiClient.get(`${this.baseUrl}/search?${queryParams}`);
    return response.data;
  }

  async getBatchReport(batchCode: string): Promise<BatchReport> {
    const response = await apiClient.get(`${this.baseUrl}/report/${batchCode}`);
    return response.data;
  }

  async getWarrantyExpiries(params: WarrantyParams = {}): Promise<WarrantyExpiryItem[]> {
    const queryParams = new URLSearchParams();
    
    if (params.days_ahead) queryParams.append('days_ahead', params.days_ahead.toString());
    if (params.location_id) queryParams.append('location_id', params.location_id);
    
    const response = await apiClient.get(`${this.baseUrl}/warranty-expiry?${queryParams}`);
    return response.data;
  }

  async getPricingComparison(itemId: string): Promise<PricingComparison> {
    const response = await apiClient.get(`${this.baseUrl}/pricing-comparison?item_id=${itemId}`);
    return response.data;
  }

  async createBatch(data: {
    batch_code: string;
    item_id: string;
    location_id: string;
    units: Array<{
      serial_number?: string;
      purchase_price: number;
      sale_price?: number;
      rental_rate_per_period?: number;
      warranty_period_days?: number;
      model_number?: string;
      quantity: number;
      remarks?: string;
    }>;
  }): Promise<BatchReport> {
    const response = await apiClient.post(`${this.baseUrl}/create`, data);
    return response.data;
  }

  async updateBatchPricing(batchCode: string, pricing: {
    sale_price?: number;
    rental_rate_per_period?: number;
    security_deposit?: number;
  }): Promise<BatchReport> {
    const response = await apiClient.patch(`${this.baseUrl}/${batchCode}/pricing`, pricing);
    return response.data;
  }

  async getBatchAnalytics(params: {
    start_date?: string;
    end_date?: string;
    location_id?: string;
  } = {}): Promise<{
    total_batches: number;
    total_value: number;
    average_margin: number;
    top_performing_batches: BatchSummary[];
    slow_moving_batches: BatchSummary[];
    expiring_warranties_count: number;
  }> {
    const queryParams = new URLSearchParams();
    
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.location_id) queryParams.append('location_id', params.location_id);
    
    const response = await apiClient.get(`${this.baseUrl}/analytics?${queryParams}`);
    return response.data;
  }

  async exportBatchData(format: 'csv' | 'excel' = 'csv', params: BatchSearchParams = {}): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append('format', format);
    
    if (params.batch_code) queryParams.append('batch_code', params.batch_code);
    if (params.item_id) queryParams.append('item_id', params.item_id);
    if (params.location_id) queryParams.append('location_id', params.location_id);
    
    const response = await apiClient.get(`${this.baseUrl}/export?${queryParams}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async getBatchAuditTrail(batchCode: string): Promise<Array<{
    id: string;
    action: string;
    user: string;
    timestamp: string;
    details: Record<string, any>;
  }>> {
    const response = await apiClient.get(`${this.baseUrl}/${batchCode}/audit`);
    return response.data;
  }

  async getBatchMovements(batchCode: string): Promise<Array<{
    id: string;
    type: 'IN' | 'OUT' | 'TRANSFER';
    quantity: number;
    from_location?: string;
    to_location?: string;
    transaction_type: string;
    transaction_id: string;
    timestamp: string;
  }>> {
    const response = await apiClient.get(`${this.baseUrl}/${batchCode}/movements`);
    return response.data;
  }
}

export const batchTrackingService = new BatchTrackingService();