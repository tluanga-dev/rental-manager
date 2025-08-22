'use client';

import { usePurchaseAnalytics } from '@/hooks/use-purchases';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Package, RotateCcw, Building2 } from 'lucide-react';

interface PurchaseAnalyticsCardsProps {
  dateRange?: {
    start_date?: string;
    end_date?: string;
  };
  supplierId?: string;
}

export function PurchaseAnalyticsCards({ dateRange, supplierId }: PurchaseAnalyticsCardsProps) {
  const {
    data: analytics,
    isLoading,
    error
  } = usePurchaseAnalytics({
    ...dateRange,
    supplier_id: supplierId
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-8 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Unable to load purchase analytics
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Purchases */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.total_purchases}</div>
          <p className="text-xs text-muted-foreground">
            {analytics.total_items} items purchased
          </p>
        </CardContent>
      </Card>

      {/* Total Amount */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(analytics.total_amount)}</div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(analytics.average_order_value)} avg order value
          </p>
        </CardContent>
      </Card>

      {/* Return Statistics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Returns</CardTitle>
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.return_statistics.total_returns}</div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-muted-foreground">
              {formatPercentage(analytics.return_statistics.return_rate)} return rate
            </span>
            {analytics.return_statistics.return_rate > 10 ? (
              <TrendingUp className="h-3 w-3 text-red-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-green-500" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Suppliers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Suppliers</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analytics.top_suppliers.length}</div>
          <div className="space-y-1">
            {analytics.top_suppliers.slice(0, 2).map((supplier) => (
              <div key={supplier.supplier_id} className="flex items-center justify-between text-xs">
                <span className="truncate">{supplier.supplier_name}</span>
                <Badge variant="outline" className="text-xs">
                  {formatCurrency(supplier.total_amount)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Summary component for purchase dashboard
export function PurchaseSummaryCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend 
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <span>{subtitle}</span>
          {trend && (
            <>
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={trend.isPositive ? "text-green-600" : "text-red-600"}>
                {Math.abs(trend.value)}%
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}