'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Package,
  Calendar,
  IndianRupee,
  Users,
  Clock,
  Award,
} from 'lucide-react';
import { rentalsApi } from '@/services/api/rentals';
import { rentalAnalyticsApi, analyticsTransformers, type ComprehensiveAnalyticsData } from '@/services/api/rentalAnalytics';
import { format, subDays, subMonths, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

function RentalAnalyticsContent() {
  const [timeRange, setTimeRange] = useState<'month' | 'year'>('month');

  // Calculate date ranges
  const getDateRange = () => {
    const now = new Date();
    if (timeRange === 'month') {
      return {
        start: format(subMonths(now, 1), 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd'),
        label: 'Past Month'
      };
    } else {
      return {
        start: format(subYears(now, 1), 'yyyy-MM-dd'),
        end: format(now, 'yyyy-MM-dd'),
        label: 'Past Year'
      };
    }
  };

  const dateRange = getDateRange();

  // Fetch comprehensive rental analytics data
  const { data: analyticsResponse, isLoading, error } = useQuery({
    queryKey: ['rental-analytics-comprehensive', timeRange, dateRange.start, dateRange.end],
    queryFn: () =>
      rentalAnalyticsApi.getComprehensiveAnalytics({
        start_date: dateRange.start,
        end_date: dateRange.end,
      }),
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract analytics data or use fallback
  const analyticsData: ComprehensiveAnalyticsData = analyticsResponse?.success 
    ? analyticsResponse.data! 
    : analyticsTransformers.generateFallbackData(timeRange);

  // Extract data from analytics response
  const {
    summary,
    top_performer: topPerformer,
    revenue_trends: revenueTrends,
    category_distribution: categoryData,
    top_items: topItems,
    daily_activity: dailyActivity,
    insights
  } = analyticsData;

  // Transform data for charts
  const revenueTrend = analyticsTransformers.transformRevenueTrends(revenueTrends);
  const chartCategoryData = analyticsTransformers.transformCategoryDistribution(categoryData);

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rental Analytics</h1>
            <p className="text-gray-600">Loading analytics data...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show error state with fallback data
  const showError = error && !analyticsResponse?.success;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rental Analytics</h1>
          <p className="text-gray-600">
            {showError ? (
              <span className="text-amber-600">
                Using demo data - unable to load live analytics
              </span>
            ) : (
              'Insights and trends for rental performance'
            )}
          </p>
        </div>
        <div className="flex gap-3">
          {showError && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.reload()}
              className="text-amber-600 border-amber-300"
            >
              Retry
            </Button>
          )}
          <Select value={timeRange} onValueChange={(value: 'month' | 'year') => setTimeRange(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Past Month</SelectItem>
              <SelectItem value="year">Past Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rentals</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_rentals.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {summary.period_label.toLowerCase()}
              {summary.growth_rate !== 0 && (
                <span className={`ml-1 ${summary.growth_rate > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.growth_rate > 0 ? '+' : ''}{summary.growth_rate.toFixed(1)}%
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{summary.total_revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {summary.period_label.toLowerCase()}
              {summary.daily_avg_revenue && (
                <span className="block">₹{Math.round(summary.daily_avg_revenue).toLocaleString()}/day avg</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rental Value</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{Math.round(summary.average_rental_value).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Per rental transaction
              <span className="block">{summary.unique_customers} unique customers</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <Award className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {topPerformer?.item_name ? 
                topPerformer.item_name.split(' ')[0] : 
                'No data'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {topPerformer ? `${topPerformer.rental_count} rentals` : 'No rentals yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend ({dateRange.label})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value, name) => [
                  name === 'revenue' ? `₹${value.toLocaleString()}` : value,
                  name === 'revenue' ? 'Revenue' : 'Rentals'
                ]} />
                <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Rental by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartCategoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name} ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, 'Rentals']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Rented Items */}
      <Card>
        <CardHeader>
          <CardTitle>Most Rented Items ({dateRange.label})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Total Rentals</TableHead>
                  <TableHead>Revenue Generated</TableHead>
                  <TableHead>Avg Duration</TableHead>
                  <TableHead>Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topItems.slice(0, 10).map((item, index) => (
                  <TableRow key={item.item_id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.rank}
                        {item.rank === 1 && <Award className="h-4 w-4 text-yellow-500" />}
                        {item.rank === 2 && <Award className="h-4 w-4 text-gray-400" />}
                        {item.rank === 3 && <Award className="h-4 w-4 text-orange-500" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.rental_count}
                    </TableCell>
                    <TableCell>
                      ₹{item.revenue.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {item.avg_duration} days
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${item.performance_percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-500">
                          {Math.round(item.performance_percentage)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Additional Insights */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Rental Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Daily Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyActivity.slice(-7)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  formatter={(value, name) => [value, name === 'rentals' ? 'Rentals' : 'Revenue']}
                />
                <Bar dataKey="rentals" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-blue-900">Peak Category</p>
                  <p className="text-sm text-blue-700">{insights.peak_category.name} items {insights.peak_category.trend}</p>
                </div>
                <Badge className="bg-blue-100 text-blue-800">{insights.peak_category.percentage}%</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-green-900">Growth Trend</p>
                  <p className="text-sm text-green-700">{insights.growth_trend.comparison}</p>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  {insights.growth_trend.percentage > 0 ? '+' : ''}{insights.growth_trend.percentage}%
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div>
                  <p className="font-medium text-orange-900">Avg Duration</p>
                  <p className="text-sm text-orange-700">{insights.avg_duration.trend}</p>
                </div>
                <Badge className="bg-orange-100 text-orange-800">{insights.avg_duration.days}d</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function RentalAnalyticsPage() {
  return (
    <ProtectedRoute requiredPermissions={['RENTAL_VIEW']}>
      <RentalAnalyticsContent />
    </ProtectedRoute>
  );
}