/**
 * API service for rental analytics
 */

import { apiClient } from '@/lib/axios';
import { AxiosResponse } from 'axios';

// TypeScript interfaces for rental analytics data
export interface RentalSummary {
  total_rentals: number;
  total_revenue: number;
  average_rental_value: number;
  unique_customers: number;
  growth_rate: number;
  period_label: string;
  period_days?: number;
  daily_avg_rentals?: number;
  daily_avg_revenue?: number;
}

export interface TopPerformer {
  item_id: string;
  item_name: string;
  sku?: string;
  category: string;
  rental_count: number;
  revenue: number;
}

export interface RevenueTrend {
  period: string;
  rentals: number;
  revenue: number;
  date?: string;
}

export interface TrendIndicator {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  latest_revenue: number;
  previous_revenue: number;
}

export interface CategoryDistribution {
  name: string;
  value: number;
  revenue: number;
  percentage: number;
  color?: string;
}

export interface TopItem {
  rank: number;
  item_id: string;
  item_name: string;
  category: string;
  rental_count: number;
  revenue: number;
  avg_duration: number;
  performance_percentage: number;
  revenue_per_rental?: number;
}

export interface DailyActivity {
  date: string;
  rentals: number;
  revenue: number;
}

export interface PeakCategoryInsight {
  name: string;
  percentage: number;
  trend: string;
}

export interface GrowthTrendInsight {
  percentage: number;
  direction: string;
  comparison: string;
}

export interface AvgDurationInsight {
  days: number;
  trend: string;
}

export interface AnalyticsInsights {
  peak_category: PeakCategoryInsight;
  growth_trend: GrowthTrendInsight;
  avg_duration: AvgDurationInsight;
}

export interface AnalyticsMetadata {
  period_start: string;
  period_end: string;
  location_id?: string;
  category_id?: string;
  data_points: number;
  top_items_count: number;
}

export interface ComprehensiveAnalyticsData {
  summary: RentalSummary;
  top_performer?: TopPerformer;
  revenue_trends: RevenueTrend[];
  category_distribution: CategoryDistribution[];
  top_items: TopItem[];
  daily_activity: DailyActivity[];
  insights: AnalyticsInsights;
  trend_indicator?: TrendIndicator;
}

export interface ComprehensiveAnalyticsResponse {
  success: boolean;
  message: string;
  data?: ComprehensiveAnalyticsData;
  metadata?: AnalyticsMetadata;
  timestamp: string;
}

export interface SummaryAnalyticsData {
  summary: RentalSummary;
  top_performer?: TopPerformer;
}

export interface SummaryAnalyticsResponse {
  success: boolean;
  message: string;
  data?: SummaryAnalyticsData;
  timestamp: string;
}

export interface AnalyticsRequestParams {
  start_date: string; // ISO date string
  end_date: string;   // ISO date string
  location_id?: string;
  category_id?: string;
}

// Transform data for chart compatibility
export interface ChartRevenueTrend {
  period: string;
  rentals: number;
  revenue: number;
}

export interface ChartCategoryData {
  name: string;
  value: number;
  color: string;
}

export interface ChartTopItem {
  name: string;
  rentals: number;
  revenue: number;
  avgDuration: number;
  category: string;
}

/**
 * Rental analytics API service
 */
export const rentalAnalyticsApi = {
  /**
   * Get comprehensive rental analytics data
   */
  getComprehensiveAnalytics: async (
    params: AnalyticsRequestParams
  ): Promise<ComprehensiveAnalyticsResponse> => {
    const response: AxiosResponse<ComprehensiveAnalyticsResponse> = await apiClient.get(
      '/analytics/rentals/comprehensive',
      { params }
    );
    return response.data;
  },

  /**
   * Get rental analytics summary only (lightweight)
   */
  getSummaryAnalytics: async (
    params: Pick<AnalyticsRequestParams, 'start_date' | 'end_date' | 'location_id'>
  ): Promise<SummaryAnalyticsResponse> => {
    const response: AxiosResponse<SummaryAnalyticsResponse> = await apiClient.get(
      '/analytics/rentals/summary',
      { params }
    );
    return response.data;
  }
};

/**
 * Data transformation utilities for charts
 */
export const analyticsTransformers = {
  /**
   * Transform revenue trends for line chart
   */
  transformRevenueTrends: (trends: RevenueTrend[]): ChartRevenueTrend[] => {
    return trends.map(trend => ({
      period: trend.period,
      rentals: trend.rentals,
      revenue: trend.revenue
    }));
  },

  /**
   * Transform category distribution for pie chart
   */
  transformCategoryDistribution: (categories: CategoryDistribution[]): ChartCategoryData[] => {
    return categories.map(category => ({
      name: category.name,
      value: category.value,
      color: category.color || '#8884d8'
    }));
  },

  /**
   * Transform top items for table display
   */
  transformTopItems: (items: TopItem[]): ChartTopItem[] => {
    return items.map(item => ({
      name: item.item_name,
      rentals: item.rental_count,
      revenue: item.revenue,
      avgDuration: item.avg_duration,
      category: item.category
    }));
  },

  /**
   * Generate dummy data structure for fallback (matching current page structure)
   */
  generateFallbackData: (timeRange: 'month' | 'year'): ComprehensiveAnalyticsData => {
    const itemNames = [
      'Wedding Tent (20x30)',
      'Round Table (8-seater)',
      'Chiavari Chair (Gold)',
      'LED String Lights',
      'Sound System (Premium)',
      'Projector & Screen',
      'Dance Floor (20x20)',
      'Cocktail Table',
      'Lounge Sofa Set',
      'Photo Booth Props',
      'Centerpiece (Floral)',
      'Linens (White)',
      'Canopy Tent (10x10)',
      'Bar Setup (Portable)',
      'Stage Platform'
    ];

    const topItems: TopItem[] = itemNames.map((name, index) => ({
      rank: index + 1,
      item_id: `item-${index}`,
      item_name: name,
      category: ['Furniture', 'Lighting', 'Audio/Visual', 'Decor', 'Structures'][Math.floor(Math.random() * 5)],
      rental_count: Math.floor(Math.random() * 50) + 10,
      revenue: Math.floor(Math.random() * 100000) + 20000,
      avg_duration: Math.floor(Math.random() * 5) + 1,
      performance_percentage: 100 - (index * 5)
    })).sort((a, b) => b.rental_count - a.rental_count);

    const periods = timeRange === 'month' ? 30 : 12;
    const revenueTrends: RevenueTrend[] = [];
    
    for (let i = periods - 1; i >= 0; i--) {
      const date = new Date();
      if (timeRange === 'month') {
        date.setDate(date.getDate() - i);
      } else {
        date.setMonth(date.getMonth() - i);
      }
      
      const label = timeRange === 'month' 
        ? date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
        : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
      revenueTrends.push({
        period: label,
        rentals: Math.floor(Math.random() * 20) + 5,
        revenue: Math.floor(Math.random() * 50000) + 10000,
        date: date.toISOString().split('T')[0]
      });
    }

    const totalRentals = topItems.reduce((sum, item) => sum + item.rental_count, 0);
    const totalRevenue = topItems.reduce((sum, item) => sum + item.revenue, 0);

    return {
      summary: {
        total_rentals: totalRentals,
        total_revenue: totalRevenue,
        average_rental_value: totalRentals > 0 ? totalRevenue / totalRentals : 0,
        unique_customers: Math.floor(totalRentals * 0.7),
        growth_rate: 12,
        period_label: timeRange === 'month' ? 'Past Month' : 'Past Year'
      },
      top_performer: topItems[0] ? {
        item_id: topItems[0].item_id,
        item_name: topItems[0].item_name,
        sku: `SKU-${topItems[0].rank.toString().padStart(3, '0')}`,
        category: topItems[0].category,
        rental_count: topItems[0].rental_count,
        revenue: topItems[0].revenue
      } : undefined,
      revenue_trends: revenueTrends,
      category_distribution: [
        { name: 'Furniture', value: 35, revenue: 150000, percentage: 35, color: '#0088FE' },
        { name: 'Lighting', value: 25, revenue: 120000, percentage: 25, color: '#00C49F' },
        { name: 'Audio/Visual', value: 20, revenue: 100000, percentage: 20, color: '#FFBB28' },
        { name: 'Decor', value: 15, revenue: 80000, percentage: 15, color: '#FF8042' },
        { name: 'Structures', value: 5, revenue: 50000, percentage: 5, color: '#8884D8' },
      ],
      top_items: topItems,
      daily_activity: revenueTrends.slice(-7).map(trend => ({
        date: trend.date!,
        rentals: trend.rentals,
        revenue: trend.revenue
      })),
      insights: {
        peak_category: {
          name: 'Furniture',
          percentage: 35,
          trend: 'dominate rentals'
        },
        growth_trend: {
          percentage: 12,
          direction: 'increasing',
          comparison: 'Revenue increasing steadily'
        },
        avg_duration: {
          days: 2.5,
          trend: 'Most rentals are 2-3 days'
        }
      }
    };
  }
};

export default rentalAnalyticsApi;