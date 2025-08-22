'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { formatCurrencySync } from '@/lib/currency-utils';
import { financialAnalyticsApi } from '@/services/api/financial-analytics';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  IndianRupee as DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Download,
  RefreshCw as Refresh,
  IndianRupee,
  CreditCard,
  Wallet,
  Activity,
} from 'lucide-react';

// Color palette for charts
const CHART_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

interface DateRange {
  from: Date;
  to: Date;
}

function FinancialDashboardContent() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    to: new Date(),
  });
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  // Format dates for API
  const formatDateForAPI = (date: Date) => date.toISOString().split('T')[0];

  // Financial Dashboard Query
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ['financial-dashboard', formatDateForAPI(dateRange.from), formatDateForAPI(dateRange.to)],
    queryFn: () =>
      financialAnalyticsApi.getFinancialDashboard({
        start_date: formatDateForAPI(dateRange.from),
        end_date: formatDateForAPI(dateRange.to),
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Revenue Trends Query
  const {
    data: revenueTrends,
    isLoading: trendsLoading,
    refetch: refetchTrends,
  } = useQuery({
    queryKey: ['revenue-trends', period, formatDateForAPI(dateRange.from), formatDateForAPI(dateRange.to)],
    queryFn: () =>
      financialAnalyticsApi.getRevenueTrends({
        period,
        start_date: formatDateForAPI(dateRange.from),
        end_date: formatDateForAPI(dateRange.to),
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Cash Flow Query
  const {
    data: cashFlowData,
    isLoading: cashFlowLoading,
    refetch: refetchCashFlow,
  } = useQuery({
    queryKey: ['cash-flow', formatDateForAPI(dateRange.from), formatDateForAPI(dateRange.to)],
    queryFn: () =>
      financialAnalyticsApi.getCashFlowAnalysis({
        start_date: formatDateForAPI(dateRange.from),
        end_date: formatDateForAPI(dateRange.to),
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Refresh all data
  const refreshData = () => {
    refetchDashboard();
    refetchTrends();
    refetchCashFlow();
    refetchReceivables();
    refetchUtilization();
    refetchCustomerValue();
  };

  // Prepare revenue by type chart data
  const revenueByTypeData = dashboardData?.revenue_by_type.map((item, index) => ({
    ...item,
    color: CHART_COLORS[index % CHART_COLORS.length],
  })) || [];

  // Prepare monthly revenue trend data
  const monthlyTrendData = revenueTrends?.map((trend) => ({
    ...trend,
    period: period === 'monthly' ? `${trend.year}-${String(trend.month).padStart(2, '0')}` 
      : period === 'yearly' ? trend.year?.toString() 
      : period === 'daily' ? `${trend.month}/${trend.day}` 
      : `${trend.year}-W${trend.week}`,
  })) || [];

  // Additional data queries for enhanced metrics
  const {
    data: receivablesData,
    isLoading: receivablesLoading,
    refetch: refetchReceivables,
  } = useQuery({
    queryKey: ['receivables-aging'],
    queryFn: () => financialAnalyticsApi.getReceivablesAging(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: utilizationData,
    isLoading: utilizationLoading,
    refetch: refetchUtilization,
  } = useQuery({
    queryKey: ['rental-utilization', formatDateForAPI(dateRange.from), formatDateForAPI(dateRange.to)],
    queryFn: () =>
      financialAnalyticsApi.getRentalUtilization({
        start_date: formatDateForAPI(dateRange.from),
        end_date: formatDateForAPI(dateRange.to),
      }),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: customerValueData,
    isLoading: customerValueLoading,
    refetch: refetchCustomerValue,
  } = useQuery({
    queryKey: ['customer-lifetime-value'],
    queryFn: () => financialAnalyticsApi.getCustomerLifetimeValue(5),
    staleTime: 5 * 60 * 1000,
  });

  // Use real period comparison data
  const getPercentageChange = (metricKey: 'revenue' | 'transactions' | 'customers' | 'outstanding') => {
    if (!dashboardData?.period_comparison?.changes) return 0;
    
    switch (metricKey) {
      case 'revenue':
        return dashboardData.period_comparison.changes.revenue_change;
      case 'transactions':
        return dashboardData.period_comparison.changes.transactions_change;
      case 'customers':
        return dashboardData.period_comparison.changes.customers_change;
      case 'outstanding':
        // For outstanding, negative change is good
        return -(dashboardData.period_comparison.changes.revenue_change || 0);
      default:
        return 0;
    }
  };

  // KPI Cards Data
  const kpiCards = [
    {
      title: 'Total Revenue',
      value: formatCurrencySync(dashboardData?.summary.total_revenue || 0),
      change: getPercentageChange('revenue'),
      icon: IndianRupee,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Transactions',
      value: (dashboardData?.summary.total_transactions || 0).toLocaleString(),
      change: getPercentageChange('transactions'),
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Utilization Rate',
      value: `${(utilizationData?.utilization.utilization_rate || 0).toFixed(1)}%`,
      change: 0, // Will calculate trend later
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Outstanding Amount',
      value: formatCurrencySync(receivablesData?.total_outstanding || 0),
      change: getPercentageChange('outstanding'),
      icon: Wallet,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Active Rentals',
      value: (dashboardData?.summary.active_rental_count || 0).toLocaleString(),
      change: getPercentageChange('transactions'),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Net Cash Flow',
      value: formatCurrencySync(cashFlowData?.summary.net_cash_flow || 0),
      change: 0, // Cash flow doesn't have period comparison yet
      icon: cashFlowData?.summary.net_cash_flow >= 0 ? TrendingUp : TrendingDown,
      color: cashFlowData?.summary.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: cashFlowData?.summary.net_cash_flow >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
  ];

  const isLoading = dashboardLoading || trendsLoading || cashFlowLoading || receivablesLoading || utilizationLoading || customerValueLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Financial Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive business financial analytics and insights
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-4">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            className="w-64"
          />
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refreshData} disabled={isLoading}>
            <Refresh className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon;
          const isPositive = kpi.change >= 0;
          
          return (
            <Card key={index} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {kpi.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
                  )}
                  <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                    {Math.abs(kpi.change)}%
                  </span>
                  <span className="ml-1">vs last period</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Trends Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Revenue Trends ({period})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatCurrencySync(value)}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      formatCurrencySync(value),
                      name === 'revenue' ? 'Revenue' : name
                    ]}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    name="Revenue"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="transaction_count" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    name="Transaction Count"
                    yAxisId="right"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Type Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Revenue by Transaction Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueByTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ transaction_type, percent }) => 
                      `${transaction_type} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="revenue"
                  >
                    {revenueByTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrencySync(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Cash Flow Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium text-green-800">Cash Inflows</span>
                <span className="text-lg font-bold text-green-900">
                  {formatCurrencySync(cashFlowData?.summary.total_inflows || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="text-sm font-medium text-red-800">Cash Outflows</span>
                <span className="text-lg font-bold text-red-900">
                  {formatCurrencySync(cashFlowData?.summary.total_outflows || 0)}
                </span>
              </div>
              <div className={`flex justify-between items-center p-3 rounded-lg ${
                cashFlowData?.summary.net_cash_flow >= 0 ? 'bg-blue-50' : 'bg-orange-50'
              }`}>
                <span className={`text-sm font-medium ${
                  cashFlowData?.summary.net_cash_flow >= 0 ? 'text-blue-800' : 'text-orange-800'
                }`}>
                  Net Cash Flow
                </span>
                <span className={`text-xl font-bold ${
                  cashFlowData?.summary.net_cash_flow >= 0 ? 'text-blue-900' : 'text-orange-900'
                }`}>
                  {formatCurrencySync(cashFlowData?.summary.net_cash_flow || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Period</th>
                  <th className="text-right p-2">Revenue</th>
                  <th className="text-right p-2">Transactions</th>
                  <th className="text-right p-2">Avg Value</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTrendData.slice(0, 12).map((trend, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{trend.period}</td>
                    <td className="p-2 text-right">{formatCurrencySync(trend.revenue)}</td>
                    <td className="p-2 text-right">{trend.transaction_count.toLocaleString()}</td>
                    <td className="p-2 text-right">{formatCurrencySync(trend.avg_transaction_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* New Section: Receivables Aging and Customer Value */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Receivables Aging Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Receivables Aging Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-2xl font-bold">
                {formatCurrencySync(receivablesData?.total_outstanding || 0)}
                <span className="text-sm text-gray-600 ml-2">Total Outstanding</span>
              </div>
              
              {receivablesData?.aging_summary?.map((bucket) => (
                <div key={bucket.bucket} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      bucket.bucket === 'Current' ? 'bg-green-500' :
                      bucket.bucket === '1-30 days' ? 'bg-yellow-500' :
                      bucket.bucket === '31-60 days' ? 'bg-orange-500' :
                      bucket.bucket === '61-90 days' ? 'bg-red-500' :
                      'bg-red-700'
                    }`} />
                    <span className="text-sm">{bucket.bucket}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrencySync(bucket.amount)}</div>
                    <div className="text-xs text-gray-500">{bucket.count} invoices</div>
                  </div>
                </div>
              ))}
              
              {receivablesData?.overdue_customers?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Top Overdue Customers</h4>
                  {receivablesData.overdue_customers.slice(0, 3).map((customer) => (
                    <div key={customer.customer_id} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">{customer.customer_name}</span>
                      <span className="font-medium text-red-600">
                        {formatCurrencySync(customer.outstanding_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Customers by Value */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5" />
              Top Customers by Lifetime Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customerValueData?.top_customers?.map((customer, index) => (
                <div key={customer.customer_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-600">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{customer.customer_name}</div>
                      <div className="text-xs text-gray-500">
                        {customer.transaction_count} transactions
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrencySync(customer.lifetime_value)}</div>
                    <div className="text-xs text-gray-500">
                      Avg: {formatCurrencySync(customer.avg_transaction)}
                    </div>
                  </div>
                </div>
              ))}
              
              {customerValueData?.summary && (
                <div className="mt-4 pt-4 border-t text-center">
                  <div className="text-sm text-gray-600">Average Customer Lifetime Value</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrencySync(customerValueData.summary.avg_lifetime_value)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rental Utilization Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Rental Utilization & Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {utilizationData?.utilization.utilization_rate.toFixed(1) || 0}%
              </div>
              <div className="text-sm text-gray-600">Utilization Rate</div>
              <div className="text-xs text-gray-500 mt-1">
                {utilizationData?.utilization.rented_items || 0} of {utilizationData?.utilization.total_items || 0} items
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {utilizationData?.performance.total_rentals || 0}
              </div>
              <div className="text-sm text-gray-600">Total Rentals</div>
              <div className="text-xs text-gray-500 mt-1">In selected period</div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {formatCurrencySync(utilizationData?.performance.avg_rental_value || 0)}
              </div>
              <div className="text-sm text-gray-600">Avg Rental Value</div>
              <div className="text-xs text-gray-500 mt-1">Per transaction</div>
            </div>
            
            <div className="text-center">
              <div className={`text-3xl font-bold ${
                (utilizationData?.performance.late_return_rate || 0) > 10 ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {utilizationData?.performance.late_return_rate.toFixed(1) || 0}%
              </div>
              <div className="text-sm text-gray-600">Late Return Rate</div>
              <div className="text-xs text-gray-500 mt-1">
                {utilizationData?.performance.late_rentals || 0} late returns
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FinancialDashboardPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <ProtectedRoute requiredPermissions={['SALE_VIEW', 'RENTAL_VIEW']}>
        <FinancialDashboardContent />
      </ProtectedRoute>
    </AuthConnectionGuard>
  );
}