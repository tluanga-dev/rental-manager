'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Package,
  Activity,
  Clock
} from 'lucide-react';
import { inventoryUnitsApi } from '@/services/api/inventory-units';
import { formatCurrencySync } from '@/lib/currency-utils';

interface UnitAnalyticsTabProps {
  unitId: string;
}

export function UnitAnalyticsTab({ unitId }: UnitAnalyticsTabProps) {
  const { 
    data: analytics, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['unit-analytics', unitId],
    queryFn: () => inventoryUnitsApi.getUnitAnalytics(unitId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-8 w-8 mx-auto mb-2" />
            <p>Analytics data unavailable</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = analytics || {
    total_rentals: 0,
    total_revenue: 0,
    average_rental_duration: 0,
    utilization_rate: 0,
    total_days_rented: 0,
    last_rental_date: null,
    maintenance_count: 0,
    damage_incidents: 0,
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencySync(data.total_revenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lifetime earnings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Utilization Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((data.utilization_rate || 0) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Time rented vs available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Total Rentals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.total_rentals || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Rental Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.average_rental_duration || 0} days
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per rental
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Total Days Rented</span>
              </div>
              <span className="font-medium">{data.total_days_rented || 0} days</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Last Rental Date</span>
              </div>
              <span className="font-medium">
                {data.last_rental_date 
                  ? new Date(data.last_rental_date).toLocaleDateString() 
                  : 'Never rented'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Maintenance Events</span>
              </div>
              <span className="font-medium">{data.maintenance_count || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Damage Incidents</span>
              </div>
              <span className="font-medium">{data.damage_incidents || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Trends (Placeholder for future chart implementation) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Revenue Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>Chart visualization coming soon</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}