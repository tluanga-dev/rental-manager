/**
 * API service for Inventory Alerts
 */
import { apiClient } from '@/lib/axios';

export interface InventoryAlert {
  id: string;
  alert_type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'MAINTENANCE_DUE' | 'WARRANTY_EXPIRING' | 'DAMAGE_REPORTED' | 'INSPECTION_DUE';
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  item_id?: string;
  item_name?: string;
  item_sku?: string;
  location_id?: string;
  location_name?: string;
  unit_id?: string;
  created_at: string;
  resolved_at?: string;
  data?: {
    [key: string]: any;
    current_stock?: number;
    reorder_point?: number;
    shortage?: number;
    maintenance_due_date?: string;
    warranty_expiry_date?: string;
  };
}

export interface AlertsResponse {
  success: boolean;
  data: InventoryAlert[];
  total?: number;
}

export const inventoryAlertsApi = {
  /**
   * Get all inventory alerts
   */
  async getAlerts(location_id?: string): Promise<InventoryAlert[]> {
    try {
      const params = location_id ? `?location_id=${location_id}` : '';
      const response = await apiClient.get<AlertsResponse>(
        `/inventory/stocks/alerts${params}`
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching inventory alerts:', error);
      return [];
    }
  },

  /**
   * Get alerts by type
   */
  async getAlertsByType(
    alert_type: InventoryAlert['alert_type'], 
    location_id?: string
  ): Promise<InventoryAlert[]> {
    try {
      const params = new URLSearchParams();
      params.append('alert_type', alert_type);
      if (location_id) {
        params.append('location_id', location_id);
      }

      const response = await apiClient.get<AlertsResponse>(
        `/inventory/stocks/alerts?${params.toString()}`
      );
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      return [];
    } catch (error) {
      console.error(`Error fetching ${alert_type} alerts:`, error);
      return [];
    }
  },

  /**
   * Get alerts by severity
   */
  async getAlertsBySeverity(
    severity: InventoryAlert['severity'], 
    location_id?: string
  ): Promise<InventoryAlert[]> {
    const allAlerts = await this.getAlerts(location_id);
    return allAlerts.filter(alert => alert.severity === severity);
  },

  /**
   * Mark alert as resolved
   */
  async resolveAlert(alert_id: string): Promise<boolean> {
    try {
      const response = await apiClient.patch<{success: boolean}>(
        `/inventory/alerts/${alert_id}/resolve`
      );
      
      return response.data.success;
    } catch (error) {
      console.error(`Error resolving alert ${alert_id}:`, error);
      return false;
    }
  },

  /**
   * Get alert statistics
   */
  async getAlertStats(location_id?: string): Promise<{
    total: number;
    by_severity: Record<string, number>;
    by_type: Record<string, number>;
  }> {
    try {
      const alerts = await this.getAlerts(location_id);
      
      const stats = {
        total: alerts.length,
        by_severity: alerts.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        by_type: alerts.reduce((acc, alert) => {
          acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      return stats;
    } catch (error) {
      console.error('Error fetching alert statistics:', error);
      return {
        total: 0,
        by_severity: {},
        by_type: {},
      };
    }
  },
};