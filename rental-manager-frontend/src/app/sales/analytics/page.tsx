'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  IndianRupee, 
  ShoppingCart,
  Users,
  Package,
  Calendar,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

// Mock analytics data - replace with actual API calls
const mockAnalyticsData = {
  overview: {
    total_sales: 125000.00,
    total_transactions: 156,
    average_sale_amount: 801.28,
    growth_rate: 15.2,
    top_selling_items: [
      { name: 'Laptop Stand', quantity: 45, revenue: 22500.00 },
      { name: 'Wireless Mouse', quantity: 38, revenue: 11400.00 },
      { name: 'Keyboard', quantity: 32, revenue: 9600.00 },
      { name: 'Monitor', quantity: 18, revenue: 36000.00 },
      { name: 'Webcam', quantity: 25, revenue: 12500.00 }
    ],
    top_customers: [
      { name: 'Tech Solutions Ltd', transactions: 12, revenue: 24000.00 },
      { name: 'Digital Works Inc', transactions: 8, revenue: 18500.00 },
      { name: 'Innovation Corp', transactions: 6, revenue: 15200.00 },
      { name: 'Modern Office Co', transactions: 9, revenue: 13800.00 },
      { name: 'StartUp Hub', transactions: 7, revenue: 11200.00 }
    ]
  },
  trends: {
    daily_sales: [
      { date: '2024-07-28', sales: 3200 },
      { date: '2024-07-29', sales: 2800 },
      { date: '2024-07-30', sales: 4100 },
      { date: '2024-07-31', sales: 3600 },
      { date: '2024-08-01', sales: 5200 },
      { date: '2024-08-02', sales: 4800 },
      { date: '2024-08-03', sales: 3900 }
    ],
    monthly_comparison: [
      { month: 'May 2024', sales: 89000 },
      { month: 'Jun 2024', sales: 108000 },
      { month: 'Jul 2024', sales: 125000 }
    ]
  }
};

function SalesAnalyticsContent() {
  const [dateRange, setDateRange] = useState('30_days');
  const [selectedMetric, setSelectedMetric] = useState('revenue');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getDateRangeLabel = (range: string) => {
    const labels = {
      '7_days': 'Last 7 Days',
      '30_days': 'Last 30 Days',
      '90_days': 'Last 90 Days',
      'this_month': 'This Month',
      'last_month': 'Last Month'
    };
    return labels[range as keyof typeof labels] || 'Custom Range';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Sales Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive sales performance insights and trends
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Date Range:</span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="7_days">Last 7 Days</option>
                <option value="30_days">Last 30 Days</option>
                <option value="90_days">Last 90 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Primary Metric:</span>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="revenue">Revenue</option>
                <option value="transactions">Transactions</option>
                <option value="items_sold">Items Sold</option>
                <option value="customers">Customers</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockAnalyticsData.overview.total_sales)}
            </div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              {formatPercentage(mockAnalyticsData.overview.growth_rate)} from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockAnalyticsData.overview.total_transactions}
            </div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12.3% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(mockAnalyticsData.overview.average_sale_amount)}
            </div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              +2.8% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <div className="flex items-center text-xs text-red-600 mt-1">
              <TrendingDown className="h-3 w-3 mr-1" />
              -3.2% from last period
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Sales Trend ({getDateRangeLabel(dateRange)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Simplified chart representation */}
              <div className="h-48 bg-gradient-to-t from-blue-50 to-blue-100 rounded-lg flex items-end justify-center p-4">
                <div className="text-center text-blue-700">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">Sales Trend Chart</p>
                  <p className="text-xs">Interactive chart would be rendered here</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-bold text-green-600">15.2%</div>
                  <div className="text-gray-500">Growth Rate</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">₹4,167</div>
                  <div className="text-gray-500">Daily Avg</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-purple-600">5.2</div>
                  <div className="text-gray-500">Avg Transactions/Day</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Simplified pie chart representation */}
              <div className="h-48 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg flex items-center justify-center">
                <div className="text-center text-purple-700">
                  <Package className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">Category Distribution</p>
                  <p className="text-xs">Pie chart would be rendered here</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Electronics</span>
                  </div>
                  <span className="text-sm font-medium">45.2%</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Accessories</span>
                  </div>
                  <span className="text-sm font-medium">28.7%</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm">Office Supplies</span>
                  </div>
                  <span className="text-sm font-medium">26.1%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Selling Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Top Selling Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockAnalyticsData.overview.top_selling_items.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.quantity} units sold</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{formatCurrency(item.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockAnalyticsData.overview.top_customers.map((customer, index) => (
                <div key={customer.name} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{customer.name}</div>
                      <div className="text-xs text-gray-500">{customer.transactions} transactions</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{formatCurrency(customer.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-700 mb-2">Revenue Growth</div>
              <div className="text-2xl font-bold text-green-900">+15.2%</div>
              <div className="text-xs text-green-600">vs last period</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-700 mb-2">Conversion Rate</div>
              <div className="text-2xl font-bold text-blue-900">68.5%</div>
              <div className="text-xs text-blue-600">quotes to sales</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-700 mb-2">Customer Retention</div>
              <div className="text-2xl font-bold text-purple-900">84.2%</div>
              <div className="text-xs text-purple-600">repeat customers</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-orange-700 mb-2">Avg Deal Size</div>
              <div className="text-2xl font-bold text-orange-900">{formatCurrency(801.28)}</div>
              <div className="text-xs text-orange-600">per transaction</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SalesAnalyticsPage() {
  return (
    <ProtectedRoute requiredPermissions={['SALE_VIEW']}>
      <SalesAnalyticsContent />
    </ProtectedRoute>
  );
}