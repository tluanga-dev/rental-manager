'use client';

import { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  Users, 
  Package,
  TrendingUp,
  Star,
  Building2,
  Award,
  Calendar,
  PieChart
} from 'lucide-react';
import { 
  PieChart as RechartsPieChart, 
  Pie,
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts';
import { suppliersApi, SupplierAnalytics } from '@/services/api/suppliers';
import { DateRangePicker } from '@/components/ui/date-range-picker';

// Color schemes for charts
const SUPPLIER_TYPE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald  
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
];

const SUPPLIER_TIER_COLORS = [
  '#10b981', // green for preferred
  '#3b82f6', // blue for standard
  '#ef4444', // red for restricted
];

function SupplierAnalyticsContent() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<SupplierAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(subMonths(new Date(), 11)), // Last 12 months
    to: endOfMonth(new Date())
  });

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        
        // Format dates for API
        const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
        const endDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;
        
        const data = await suppliersApi.getAnalytics(startDate, endDate);
        console.log('✅ Analytics data loaded successfully:', data);
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to load supplier analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  // Transform supplier type data for pie chart
  const supplierTypeChartData = analytics ? Object.entries(analytics.supplier_type_distribution)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => ({
      name: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count,
      percentage: ((count / analytics.total_suppliers) * 100).toFixed(1)
    })) : [];

  // Transform supplier tier data for pie chart
  const supplierTierChartData = analytics ? Object.entries(analytics.supplier_tier_distribution)
    .filter(([_, count]) => count > 0)
    .map(([tier, count]) => ({
      name: tier.charAt(0).toUpperCase() + tier.slice(1),
      value: count,
      percentage: ((count / analytics.total_suppliers) * 100).toFixed(1)
    })) : [];

  // Transform monthly data for line chart
  const monthlyGrowthData = analytics?.monthly_new_suppliers?.map(month => ({
    month: month.month,
    count: month.count,
    label: month.month.split('-')[1] + '/' + month.month.split('-')[0].slice(-2)
  })) || [];

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <PieChart className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No analytics data available</h3>
          <p className="mt-1 text-sm text-gray-500">Analytics data could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Supplier Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Performance insights and supplier metrics
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Select date range"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDateRange({
              from: startOfMonth(subMonths(new Date(), 11)),
              to: endOfMonth(new Date())
            })}
          >
            Reset to Last 12 Months
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
            <Users className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.total_suppliers}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.active_suppliers} active ({formatPercentage(analytics.active_suppliers, analytics.total_suppliers)})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.total_spend)}</div>
            <p className="text-xs text-muted-foreground">
              All time spend
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Quality Rating</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.average_quality_rating.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Out of 5.0 stars
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <Award className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.top_suppliers_by_spend.length > 0 
                ? formatCurrency(
                    analytics.top_suppliers_by_spend.reduce((sum, s) => sum + s.total_spend, 0) /
                    analytics.top_suppliers_by_spend.reduce((sum, s) => sum + s.supplier.total_orders, 0) || 0
                  )
                : formatCurrency(0)
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Average purchase value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Supplier Type Distribution - Interactive Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Supplier Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supplierTypeChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={supplierTypeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {supplierTypeChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={SUPPLIER_TYPE_COLORS[index % SUPPLIER_TYPE_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [
                        `${value} suppliers (${props.payload.percentage}%)`,
                        props.payload.name
                      ]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-3 justify-center">
                  {supplierTypeChartData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: SUPPLIER_TYPE_COLORS[index % SUPPLIER_TYPE_COLORS.length] }}
                      ></div>
                      <span className="text-xs text-gray-600">
                        {entry.name} ({entry.value})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">No supplier type data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier Tier Distribution - Interactive Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="h-5 w-5 mr-2" />
              Supplier Tiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supplierTierChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={supplierTierChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {supplierTierChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={SUPPLIER_TIER_COLORS[index % SUPPLIER_TIER_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [
                        `${value} suppliers (${props.payload.percentage}%)`,
                        props.payload.name
                      ]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-3 justify-center">
                  {supplierTierChartData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: SUPPLIER_TIER_COLORS[index % SUPPLIER_TIER_COLORS.length] }}
                      ></div>
                      <span className="text-xs text-gray-600">
                        {entry.name} ({entry.value})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Award className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">No supplier tier data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly New Suppliers - Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Growth Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyGrowthData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="label"
                      tick={{ fontSize: 12 }}
                      tickLine={{ stroke: '#6b7280' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={{ stroke: '#6b7280' }}
                    />
                    <Tooltip 
                      formatter={(value, name) => [`${value} new suppliers`, 'New Suppliers']}
                      labelFormatter={(label) => `Month: ${label}`}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">No growth data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Suppliers by Spend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Top Suppliers by Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.top_suppliers_by_spend.length > 0 ? (
              <div className="space-y-4">
                {analytics.top_suppliers_by_spend.slice(0, 5).map((item, index) => (
                  <div
                    key={item.supplier.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => router.push(`/purchases/suppliers/${item.supplier.id}`)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {item.supplier.company_name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.supplier.supplier_code} • {item.supplier.supplier_type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(item.total_spend)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.supplier.total_orders} orders
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No spending data</h3>
                <p className="mt-1 text-sm text-gray-500">No supplier spending data available yet.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purchase Frequency Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Purchase Frequency
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.top_suppliers_by_spend.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={analytics.top_suppliers_by_spend.slice(0, 5).map(item => ({
                      name: item.supplier.company_name.length > 15 
                        ? item.supplier.company_name.substring(0, 15) + '...'
                        : item.supplier.company_name,
                      orders: item.supplier.total_orders,
                      avgValue: item.total_spend / item.supplier.total_orders
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={{ stroke: '#6b7280' }}
                    />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'orders' ? `${value} orders` : formatCurrency(Number(value)),
                        name === 'orders' ? 'Total Orders' : 'Avg Order Value'
                      ]}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    />
                    <Bar dataKey="orders" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">No purchase frequency data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SupplierAnalyticsPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_VIEW']}>
      <SupplierAnalyticsContent />
    </ProtectedRoute>
  );
}