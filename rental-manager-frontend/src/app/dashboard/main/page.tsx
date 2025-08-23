'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
// Authentication is handled by MainLayout - no need for additional guards
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { dashboardApi } from '@/services/api/dashboard';
import { MetricCard } from '@/components/dashboard/metric-card';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { InventoryUtilization } from '@/components/dashboard/inventory-utilization';
import { TopItemsChart } from '@/components/dashboard/top-items-chart';
import { CustomerInsights } from '@/components/dashboard/customer-insights';
import { PerformanceGauges } from '@/components/dashboard/performance-gauges';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrencySync } from '@/lib/currency-utils';
import {
  IndianRupee,
  Package,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Download,
  Calendar,
  BarChart3,
  PieChart,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface DateRange {
  from: Date;
  to: Date;
}

export default function MainDashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  // Dashboard Overview Query
  const {
    data: overviewData,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview
  } = useQuery({
    queryKey: ['dashboard', 'overview', dateRange.from, dateRange.to],
    queryFn: () => dashboardApi.getOverview({
      start_date: dateRange.from.toISOString().split('T')[0],
      end_date: dateRange.to.toISOString().split('T')[0]
    }),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes
    retry: 2
  });

  // Financial Performance Query
  const {
    data: financialData,
    isLoading: financialLoading,
    refetch: refetchFinancial
  } = useQuery({
    queryKey: ['dashboard', 'financial', dateRange.from, dateRange.to],
    queryFn: () => dashboardApi.getFinancial({
      start_date: dateRange.from.toISOString().split('T')[0],
      end_date: dateRange.to.toISOString().split('T')[0]
    }),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000 // Consider stale after 2 minutes
  });

  // Operational Metrics Query
  const {
    data: operationalData,
    isLoading: operationalLoading,
    refetch: refetchOperational
  } = useQuery({
    queryKey: ['dashboard', 'operational', dateRange.from, dateRange.to],
    queryFn: () => dashboardApi.getOperational({
      start_date: dateRange.from.toISOString().split('T')[0],
      end_date: dateRange.to.toISOString().split('T')[0]
    }),
    enabled: activeTab === 'operational'
  });

  // Inventory Analytics Query
  const {
    data: inventoryData,
    isLoading: inventoryLoading,
    refetch: refetchInventory
  } = useQuery({
    queryKey: ['dashboard', 'inventory'],
    queryFn: () => dashboardApi.getInventory(),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000 // Consider stale after 2 minutes
  });

  // Customer Insights Query
  const {
    data: customerData,
    isLoading: customerLoading,
    refetch: refetchCustomer
  } = useQuery({
    queryKey: ['dashboard', 'customers', dateRange.from, dateRange.to],
    queryFn: () => dashboardApi.getCustomers({
      start_date: dateRange.from.toISOString().split('T')[0],
      end_date: dateRange.to.toISOString().split('T')[0]
    }),
    enabled: activeTab === 'customers'
  });

  // KPIs Query
  const {
    data: kpiData,
    isLoading: kpiLoading,
    refetch: refetchKPIs
  } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => dashboardApi.getKPIs(),
    refetchInterval: 10 * 60 * 1000 // Refresh every 10 minutes
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchOverview(),
        refetchFinancial(),
        refetchOperational(),
        refetchInventory(),
        refetchCustomer(),
        refetchKPIs()
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await dashboardApi.exportData({
        format: 'json',
        report_type: activeTab,
        start_date: dateRange.from.toISOString().split('T')[0],
        end_date: dateRange.to.toISOString().split('T')[0]
      });
      
      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-${activeTab}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getTrendIcon = (growthRate: number) => {
    if (growthRate > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (growthRate < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendColor = (growthRate: number) => {
    if (growthRate > 0) return 'text-green-600';
    if (growthRate < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (overviewError) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span>Failed to load dashboard data. Please try refreshing.</span>
            </div>
            <Button 
              onClick={handleRefresh} 
              className="mt-4"
              variant="outline"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Business Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Comprehensive business intelligence and performance analytics
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                className="w-auto"
              />
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Error State Banner */}
          {overviewError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <div>
                    <span className="font-medium">Analytics Unavailable:</span>
                    <span className="ml-1">Unable to load dashboard analytics. Please try refreshing or contact support if the issue persists.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overview Cards */}
          {overviewLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-16 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : overviewError ? (
            <Card className="border-gray-200">
              <CardContent className="p-6 text-center text-gray-500">
                <div className="flex flex-col items-center gap-2">
                  <AlertCircle className="w-8 h-8" />
                  <p>Unable to load overview metrics</p>
                </div>
              </CardContent>
            </Card>
          ) : overviewData?.data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Revenue"
                value={formatCurrencySync(overviewData.data.revenue.current_period)}
                change={overviewData.data.revenue.growth_rate}
                icon={<IndianRupee className="w-6 h-6" />}
                trend={getTrendIcon(overviewData.data.revenue.growth_rate)}
                trendColor={getTrendColor(overviewData.data.revenue.growth_rate)}
                description={`${overviewData.data.revenue.transaction_count} transactions`}
              />
              
              <MetricCard
                title="Active Rentals"
                value={overviewData.data.active_rentals.count.toString()}
                change={0} // You could calculate this if you track historical data
                icon={<Package className="w-6 h-6" />}
                description={`${formatCurrencySync(overviewData.data.active_rentals.total_value)} total value`}
              />
              
              <MetricCard
                title="Inventory Utilization"
                value={`${overviewData.data.inventory.utilization_rate}%`}
                change={0}
                icon={<BarChart3 className="w-6 h-6" />}
                description={`${overviewData.data.inventory.rented_items}/${overviewData.data.inventory.rentable_items} items rented`}
              />
              
              <MetricCard
                title="Active Customers"
                value={overviewData.data.customers.active.toString()}
                change={0}
                icon={<Users className="w-6 h-6" />}
                description={`${overviewData.data.customers.new} new this period`}
              />
            </div>
          ) : null}

          {/* KPI Gauges */}
          {kpiLoading ? (
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ) : kpiData?.data ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Key Performance Indicators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PerformanceGauges data={kpiData.data} />
              </CardContent>
            </Card>
          ) : null}

          {/* Tabbed Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="operational">Operations</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {financialData?.data?.daily_trend ? (
                      <RevenueChart data={financialData.data.daily_trend} />
                    ) : (
                      <LoadingSpinner />
                    )}
                  </CardContent>
                </Card>

                {/* Top Items */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Performing Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {inventoryData?.data?.top_items ? (
                      <TopItemsChart data={inventoryData.data.top_items} />
                    ) : (
                      <LoadingSpinner />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentActivity />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="space-y-6">
              {financialLoading ? (
                <LoadingSpinner />
              ) : financialData?.data ? (
                <>
                  {/* Revenue Breakdown */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Revenue by Category</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {financialData.data.revenue_by_category.map((category, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm font-medium">{category.category}</span>
                              <div className="text-right">
                                <div className="font-semibold">
                                  {formatCurrencySync(category.revenue)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {category.transactions} transactions
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Payment Collection</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span>Collection Rate</span>
                            <Badge variant="outline">
                              {financialData.data.payment_collection?.collection_rate || 0}%
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Paid</span>
                              <span className="text-green-600">
                                {financialData.data.payment_collection?.paid || 0}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Partial</span>
                              <span className="text-yellow-600">
                                {financialData.data.payment_collection?.partial || 0}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Pending</span>
                              <span className="text-red-600">
                                {financialData.data.payment_collection?.pending || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Outstanding Balances */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                        Outstanding Balances
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span>Total Outstanding</span>
                        <span className="text-2xl font-bold text-orange-600">
                          {formatCurrencySync(financialData.data.outstanding_balances?.total || 0)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        {financialData.data.outstanding_balances?.count || 0} transactions pending payment
                      </p>
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="operational" className="space-y-6">
              {operationalLoading ? (
                <LoadingSpinner />
              ) : operationalData?.data ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Rental Duration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Average</span>
                          <span className="font-semibold">
                            {operationalData.data.rental_duration.average.toFixed(1)} days
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Median</span>
                          <span className="font-semibold">
                            {operationalData.data.rental_duration.median.toFixed(1)} days
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Range</span>
                          <span>
                            {operationalData.data.rental_duration.minimum} - {operationalData.data.rental_duration.maximum} days
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Extensions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Extension Rate</span>
                          <Badge variant="outline">
                            {operationalData.data.extensions.extension_rate}%
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Extended Rentals</span>
                          <span className="font-semibold">
                            {operationalData.data.extensions.extended_rentals}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Extension Revenue</span>
                          <span className="font-semibold text-green-600">
                            {formatCurrencySync(operationalData.data.extensions.total_extension_revenue)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Return Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>On-time Rate</span>
                          <Badge variant="outline" className="text-green-600">
                            {operationalData.data.returns.on_time_rate}%
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>On-time Returns</span>
                          <span className="font-semibold text-green-600">
                            {operationalData.data.returns.on_time_returns}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Late Returns</span>
                          <span className="font-semibold text-red-600">
                            {operationalData.data.returns.late_returns}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="inventory" className="space-y-6">
              {inventoryLoading ? (
                <LoadingSpinner />
              ) : inventoryData?.data ? (
                <>
                  <InventoryUtilization data={inventoryData.data} />
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Low Stock Alerts</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {inventoryData.data.low_stock_alerts.length > 0 ? (
                          <div className="space-y-3">
                            {inventoryData.data.low_stock_alerts.map((item, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                                <div>
                                  <div className="font-medium">{item.item}</div>
                                  <div className="text-sm text-gray-600">{item.sku} - {item.location}</div>
                                </div>
                                <Badge variant="outline" className="text-orange-600">
                                  {item.available} left
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-gray-500">
                            <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                            <p>All items are well stocked</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Least Rented Items</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {inventoryData.data.bottom_items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-gray-600">{item.sku}</div>
                              </div>
                              <Badge variant="outline">
                                {item.rentals} rentals
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="customers" className="space-y-6">
              {customerLoading ? (
                <LoadingSpinner />
              ) : customerData?.data ? (
                <CustomerInsights data={customerData.data} />
              ) : null}
            </TabsContent>
          </Tabs>
    </div>
  );
}