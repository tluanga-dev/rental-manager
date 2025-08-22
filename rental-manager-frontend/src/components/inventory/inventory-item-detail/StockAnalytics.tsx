'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Activity,
  RotateCcw,
  Calendar,
  Package,
  BarChart3,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryAnalytics } from '@/types/inventory-items';

interface StockAnalyticsProps {
  analytics: InventoryAnalytics;
  isLoading?: boolean;
}

export function StockAnalytics({ analytics, isLoading }: StockAnalyticsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getTrendIcon = () => {
    switch (analytics.trend) {
      case 'INCREASING':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'DECREASING':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      default:
        return <Minus className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
    switch (analytics.trend) {
      case 'INCREASING':
        return 'text-green-600 bg-green-50';
      case 'DECREASING':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return { label: 'Excellent', className: 'bg-green-100 text-green-800' };
    if (score >= 60) return { label: 'Good', className: 'bg-blue-100 text-blue-800' };
    if (score >= 40) return { label: 'Fair', className: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Poor', className: 'bg-red-100 text-red-800' };
  };

  const healthBadge = getHealthBadge(analytics.stock_health_score);

  return (
    <div className="space-y-4">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Movements */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Movements</p>
                <p className="text-2xl font-bold mt-1">
                  {analytics.total_movements}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  All time
                </p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily Movement */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Daily Movement</p>
                <p className="text-2xl font-bold mt-1">
                  {analytics.average_daily_movement.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last 30 days
                </p>
              </div>
              <div className="p-2 bg-purple-50 rounded-lg">
                <BarChart3 className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Turnover Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Turnover Rate</p>
                <p className="text-2xl font-bold mt-1">
                  {analytics.turnover_rate.toFixed(1)}x
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Per month
                </p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <RotateCcw className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Days of Stock */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Days of Stock</p>
                <p className="text-2xl font-bold mt-1">
                  {analytics.days_of_stock || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  At current rate
                </p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg">
                <Package className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Health Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Stock Health Score</CardTitle>
            <Badge className={cn('font-semibold', healthBadge.className)}>
              {healthBadge.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={cn('text-3xl font-bold', getHealthColor(analytics.stock_health_score))}>
                {analytics.stock_health_score.toFixed(0)}%
              </span>
              <div className={cn('p-2 rounded-lg', getTrendColor())}>
                {getTrendIcon()}
              </div>
            </div>
            
            <Progress 
              value={analytics.stock_health_score} 
              className="h-3"
            />
            
            <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
              <div>
                <p className="text-muted-foreground">Trend</p>
                <p className="font-medium capitalize">{analytics.trend.toLowerCase()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Movement Rate</p>
                <p className="font-medium">
                  {analytics.average_daily_movement > 1 ? 'High' : 'Low'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Stock Level</p>
                <p className="font-medium">
                  {analytics.days_of_stock && analytics.days_of_stock > 30 ? 'Healthy' : 'Low'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.last_restock_date && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Last Restock</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(analytics.last_restock_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {Math.floor((Date.now() - new Date(analytics.last_restock_date).getTime()) / (1000 * 60 * 60 * 24))} days ago
                </Badge>
              </div>
            )}
            
            {analytics.last_sale_date && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Last Sale/Rental</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(analytics.last_sale_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                  {Math.floor((Date.now() - new Date(analytics.last_sale_date).getTime()) / (1000 * 60 * 60 * 24))} days ago
                </Badge>
              </div>
            )}
            
            {!analytics.last_restock_date && !analytics.last_sale_date && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <span>No recent activity recorded</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.stock_health_score < 50 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Low Stock Health</p>
                  <p className="text-sm text-muted-foreground">
                    Consider increasing stock levels to improve availability
                  </p>
                </div>
              </div>
            )}
            
            {analytics.turnover_rate < 0.5 && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                <RotateCcw className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Low Turnover</p>
                  <p className="text-sm text-muted-foreground">
                    This item has low movement. Consider promotional activities
                  </p>
                </div>
              </div>
            )}
            
            {analytics.days_of_stock && analytics.days_of_stock < 14 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                <Package className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Restock Soon</p>
                  <p className="text-sm text-muted-foreground">
                    Current stock will last approximately {analytics.days_of_stock} days
                  </p>
                </div>
              </div>
            )}
            
            {analytics.stock_health_score >= 80 && analytics.turnover_rate >= 1 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Optimal Performance</p>
                  <p className="text-sm text-muted-foreground">
                    This item is performing well with good stock levels and turnover
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}