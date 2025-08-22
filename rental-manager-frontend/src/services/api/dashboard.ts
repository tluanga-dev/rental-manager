import { apiClient } from '@/lib/axios';

export interface DashboardOverviewResponse {
  success: boolean;
  data: {
    revenue: {
      current_period: number;
      previous_period: number;
      growth_rate: number;
      transaction_count: number;
    };
    active_rentals: {
      count: number;
      total_value: number;
      average_value: number;
    };
    inventory: {
      total_items: number;
      rentable_items: number;
      rented_items: number;
      utilization_rate: number;
    };
    customers: {
      total: number;
      active: number;
      new: number;
      retention_rate: number;
    };
  };
}

export interface DashboardFinancialResponse {
  success: boolean;
  data: {
    revenue_summary: {
      total_revenue: number;
      rental_revenue: number;
      sales_revenue: number;
      extension_revenue: number;
      growth_rate: number;
    };
    revenue_by_category: Array<{
      category: string;
      revenue: number;
      transactions: number;
      percentage: number;
    }>;
    revenue_by_type: Array<{
      type: string;
      revenue: number;
      transactions: number;
    }>;
    payment_collection: {
      total_due: number;
      collected: number;
      pending: number;
      partial: number;
      paid: number;
      collection_rate: number;
    };
    outstanding_balances: {
      total: number;
      count: number;
      average: number;
    };
    daily_trend: Array<{
      date: string;
      revenue: number;
      transactions: number;
    }>;
  };
}

export interface DashboardOperationalResponse {
  success: boolean;
  data: {
    rental_duration: {
      average: number;
      median: number;
      minimum: number;
      maximum: number;
    };
    extensions: {
      total_extensions: number;
      extended_rentals: number;
      extension_rate: number;
      total_extension_revenue: number;
    };
    returns: {
      total_returns: number;
      on_time_returns: number;
      late_returns: number;
      on_time_rate: number;
    };
    damage_stats: {
      total_damaged: number;
      minor_damage: number;
      major_damage: number;
      total_damage_cost: number;
    };
  };
}

export interface DashboardInventoryResponse {
  success: boolean;
  data: {
    stock_summary: {
      total_items: number;
      available_items: number;
      rented_items: number;
      maintenance_items: number;
      utilization_rate: number;
    };
    category_utilization: Array<{
      category: string;
      total: number;
      rented: number;
      utilization_rate: number;
    }>;
    location_breakdown: Array<{
      location: string;
      total_items: number;
      available: number;
      rented: number;
    }>;
    top_items: Array<{
      name: string;
      sku: string;
      rentals: number;
      revenue: number;
    }>;
    bottom_items: Array<{
      name: string;
      sku: string;
      rentals: number;
    }>;
    low_stock_alerts: Array<{
      item: string;
      sku: string;
      location: string;
      available: number;
      minimum_required: number;
    }>;
  };
}

export interface DashboardCustomerResponse {
  success: boolean;
  data: {
    summary: {
      total_customers: number;
      active_customers: number;
      new_customers: number;
      inactive_customers: number;
      retention_rate: number;
    };
    segmentation: {
      new: number;
      returning: number;
      loyal: number;
      at_risk: number;
    };
    top_customers: Array<{
      customer_id: string;
      customer_name: string;
      total_revenue: number;
      total_rentals: number;
      avg_rental_value: number;
      days_since_last_rental: number;
    }>;
    activity_trends: Array<{
      period: string;
      new_customers: number;
      returning_customers: number;
      total_activity: number;
    }>;
    lifetime_value: {
      average_clv: number;
      median_clv: number;
      top_tier_clv: number;
    };
  };
}

export interface DashboardKPIResponse {
  success: boolean;
  data: Array<{
    name: string;
    current_value: number;
    target_value: number;
    achievement_percentage: number;
    category: 'revenue' | 'operational' | 'customer' | 'inventory';
    trend?: 'up' | 'down' | 'stable';
    unit?: string;
    description?: string;
  }>;
}

export interface DashboardDateRange {
  start_date: string;
  end_date: string;
}

export interface DashboardExportRequest {
  format: 'json' | 'csv' | 'excel';
  report_type: 'overview' | 'financial' | 'operational' | 'inventory' | 'customers';
  start_date: string;
  end_date: string;
}


export const dashboardApi = {
  // Get dashboard overview with key metrics
  getOverview: async (params: DashboardDateRange): Promise<DashboardOverviewResponse> => {
    const response = await apiClient.get('/analytics/dashboard/overview', { params });
    console.log('🔍 Dashboard Overview API Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  },

  // Get financial performance metrics
  getFinancial: async (params: DashboardDateRange): Promise<DashboardFinancialResponse> => {
    const response = await apiClient.get('/analytics/dashboard/financial', { params });
    return response.data;
  },

  // Get operational performance metrics
  getOperational: async (params: DashboardDateRange): Promise<DashboardOperationalResponse> => {
    const response = await apiClient.get('/analytics/dashboard/operational', { params });
    return response.data;
  },

  // Get inventory analytics
  getInventory: async (): Promise<DashboardInventoryResponse> => {
    const response = await apiClient.get('/analytics/dashboard/inventory');
    const raw = response.data;
    if (raw?.data) {
      // Handle backend variant key 'stock_metrics'
      if (raw.data.stock_metrics && !raw.data.stock_summary) {
        raw.data.stock_summary = raw.data.stock_metrics;
      }
      // Ensure arrays exist to avoid .map on undefined
      raw.data.top_items = Array.isArray(raw.data.top_items) ? raw.data.top_items : [];
      raw.data.bottom_items = Array.isArray(raw.data.bottom_items) ? raw.data.bottom_items : [];
      raw.data.low_stock_alerts = Array.isArray(raw.data.low_stock_alerts) ? raw.data.low_stock_alerts : [];
      raw.data.category_utilization = Array.isArray(raw.data.category_utilization) ? raw.data.category_utilization : [];
      raw.data.location_breakdown = Array.isArray(raw.data.location_breakdown) ? raw.data.location_breakdown : [];
    }
    return raw;
  },

  // Get customer insights
  getCustomers: async (params: DashboardDateRange): Promise<DashboardCustomerResponse> => {
    const response = await apiClient.get('/analytics/dashboard/customers', { params });
    const raw = response.data;
    
    // Debug logging - remove in production
    console.log('🔍 Dashboard Customer API Response:', JSON.stringify(raw, null, 2));
    
    if (raw?.data) {
      // Normalize backend response to expected frontend format
      const backendData = raw.data;
      
      // Debug logging for backend data structure
      console.log('🔍 Backend Data Structure:', {
        hasSummary: !!backendData.summary,
        hasSegmentation: !!backendData.segmentation,
        hasSegments: !!backendData.segments,
        totalCustomersFromSummary: backendData.summary?.total_customers,
        totalCustomersFromSegments: backendData.segmentation?.total || backendData.segments?.total
      });
      
      // Handle different backend response structures
      let summary = backendData.summary;
      if (!summary) {
        // Build summary from segmentation data if available
        const seg = backendData.segmentation || backendData.segments || {};
        const totalFromSeg = Object.values(seg).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
        
        // Use customer_summary_metrics from backend if available
        const metrics = backendData.customer_summary_metrics || {};
        
        summary = {
          total_customers: metrics.total_customers || backendData.total_customers || totalFromSeg || 0,
          active_customers: metrics.active_customers || backendData.active_customers || totalFromSeg || 0,
          new_customers: metrics.new_customers || backendData.new_customers || seg.new || 0,
          inactive_customers: metrics.inactive_customers || backendData.inactive_customers || 0,
          retention_rate: metrics.retention_rate || backendData.retention_rate || 0
        };
      }
      
      // Debug final summary
      console.log('🔍 Final Summary Object:', summary);
      
      // Normalize segmentation data
      let segmentation = backendData.segmentation;
      if (!segmentation && backendData.segments) {
        segmentation = backendData.segments;
      }
      if (!segmentation) {
        segmentation = {
          new: summary.new_customers || 0,
          returning: 0,
          loyal: 0,
          at_risk: 0
        };
      }
      
      // Ensure arrays exist
      const topCustomers = Array.isArray(backendData.top_customers) ? backendData.top_customers : [];
      const activityTrends = Array.isArray(backendData.activity_trends) ? backendData.activity_trends : [];
      
      // Handle lifetime value
      let lifetimeValue = backendData.lifetime_value;
      if (!lifetimeValue) {
        lifetimeValue = {
          average_clv: backendData.average_clv || 0,
          median_clv: backendData.median_clv || 0,
          top_tier_clv: backendData.top_tier_clv || 0
        };
      }
      
      // Return normalized data
      const normalizedData = {
        summary,
        segmentation,
        top_customers: topCustomers,
        activity_trends: activityTrends,
        lifetime_value: lifetimeValue
      };
      
      console.log('🔍 Final Normalized Data:', normalizedData);
      raw.data = normalizedData;
    } else {
      // Fallback structure if no data is returned
      console.log('⚠️ No data returned from backend, using fallback');
      raw.data = {
        summary: {
          total_customers: 0,
          active_customers: 0,
          new_customers: 0,
          inactive_customers: 0,
          retention_rate: 0
        },
        segmentation: {
          new: 0,
          returning: 0,
          loyal: 0,
          at_risk: 0
        },
        top_customers: [],
        activity_trends: [],
        lifetime_value: {
          average_clv: 0,
          median_clv: 0,
          top_tier_clv: 0
        }
      };
    }
    
    console.log('🔍 Final API Response:', raw);
    return raw;
  },

  // Get KPI metrics
  getKPIs: async (): Promise<DashboardKPIResponse> => {
    const response = await apiClient.get('/analytics/dashboard/kpis');
    const raw = response.data;

    // If the backend already returns an array shaped like we expect, just return it
    if (Array.isArray(raw?.data)) {
      return raw;
    }

    // Otherwise flatten the category object structure into an array of KPI items
    const categoryObject = raw?.data || {};
    const flat: DashboardKPIResponse['data'] = [];

    const FRIENDLY_NAMES: Record<string, string> = {
      total_revenue: 'Total Revenue',
      growth_rate: 'Revenue Growth Rate',
      avg_transaction_value: 'Avg Transaction Value',
      utilization_rate: 'Inventory Utilization Rate',
      on_time_return_rate: 'On-time Return Rate',
      new_customers: 'New Customers',
      retention_rate: 'Customer Retention Rate',
      stock_availability: 'Stock Availability',
      low_stock_items: 'Low Stock Items'
    };

    const UNIT_MAP: Record<string, string> = {
      total_revenue: '',
      growth_rate: '%',
      avg_transaction_value: '',
      utilization_rate: '%',
      on_time_return_rate: '%',
      new_customers: '',
      retention_rate: '%',
      stock_availability: '%',
      low_stock_items: ''
    };

    (['revenue','operational','customer','inventory'] as const).forEach(category => {
      const metrics = categoryObject[category];
      if (metrics && typeof metrics === 'object') {
        Object.entries(metrics).forEach(([key, metric]: any) => {
          if (!metric || typeof metric !== 'object') return;
            // Expect shape { value, target, achievement }
          const value = Number(metric.value ?? 0);
          const target = Number(metric.target ?? metric.target_value ?? 0);
          const achievement = Number(metric.achievement ?? metric.achievement_percentage ?? 0);
          flat.push({
            name: FRIENDLY_NAMES[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            current_value: value,
            target_value: target,
            achievement_percentage: Number.isFinite(achievement) ? achievement : 0,
            category,
            unit: UNIT_MAP[key] || undefined
          });
        });
      }
    });

    return {
      success: Boolean(raw?.success),
      data: flat
    };
  },

  // Refresh dashboard cache
  refreshCache: async (): Promise<{ success: boolean; message?: string; [k: string]: any }> => {
    const response = await apiClient.post('/analytics/dashboard/refresh-cache');
    return response.data;
  },

  // Get recent activity
  getRecentActivity: async (limit: number = 10): Promise<{ success: boolean; data: Array<{ id: string; type: string; title: string; description: string; amount?: number; customer?: string; timestamp: string; status?: string; metadata?: Record<string, any>; }> }> => {
    const response = await apiClient.get('/analytics/dashboard/recent-activity', { params: { limit } });
    return response.data;
  },

  // Export dashboard data
  exportData: async (params: DashboardExportRequest): Promise<any> => {
    const response = await apiClient.get('/analytics/dashboard/export', { params });
    return response.data;
  }
};