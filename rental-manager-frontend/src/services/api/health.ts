import { apiClient } from '@/lib/axios';

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version?: string;
  uptime?: number;
  database?: {
    status: 'connected' | 'disconnected';
    latency?: number;
  };
  services?: {
    name: string;
    status: 'up' | 'down';
    latency?: number;
  }[];
}

export const healthApi = {
  // Check basic health status
  checkHealth: async (): Promise<HealthCheckResponse> => {
    try {
      const response = await apiClient.get<HealthCheckResponse>('/health');
      return response.data.success ? response.data.data : (response.data as unknown as HealthCheckResponse);
    } catch (error) {
      console.error('Health check failed:', error);
      // Return a default unhealthy response on error
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      };
    }
  },

  // Check detailed health status
  checkDetailedHealth: async (): Promise<HealthCheckResponse> => {
    try {
      const response = await apiClient.get<HealthCheckResponse>('/health/detailed');
      return response.data.success ? response.data.data : (response.data as unknown as HealthCheckResponse);
    } catch (error) {
      console.error('Detailed health check failed:', error);
      // Return a default unhealthy response on error
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      };
    }
  },

  // Check if specific service is available
  checkServiceHealth: async (serviceName: string): Promise<boolean> => {
    try {
      const response = await apiClient.get(`/health/service/${serviceName}`);
      const data = response.data.success ? response.data.data : response.data;
      return data.status === 'up';
    } catch (error) {
      console.error(`Service ${serviceName} health check failed:`, error);
      return false;
    }
  }
};
