'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line
} from 'recharts';
import { 
  Users, 
  UserPlus, 
  UserCheck, 
  UserX, 
  IndianRupee,
  Activity,
  Clock,
  Star
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';

interface CustomerData {
  summary: {
    total_customers: number;
    active_customers: number;
    new_customers: number;
    inactive_customers: number;
    retention_rate: number;
  };
  segmentation: {
    new: number;
    returning: number;
    loyal: number;
    at_risk: number;
  };
  top_customers: Array<{
    customer_id: string;
    customer_name: string;
    total_revenue: number;
    total_rentals: number;
    avg_rental_value: number;
    days_since_last_rental: number;
  }>;
  activity_trends: Array<{
    period: string;
    new_customers: number;
    returning_customers: number;
    total_activity: number;
  }>;
  lifetime_value: {
    average_clv: number;
    median_clv: number;
    top_tier_clv: number;
  };
}

interface CustomerInsightsProps {
  data: CustomerData;
}

const SEGMENT_COLORS = {
  new: '#10B981',
  returning: '#3B82F6', 
  loyal: '#8B5CF6',
  at_risk: '#EF4444'
};

export function CustomerInsights({ data }: CustomerInsightsProps) {
  if (!data) {
    return (
      <div className="grid gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center h-32 text-gray-500">
              No customer data available
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, segmentation, top_customers, activity_trends, lifetime_value } = data;

  // Prepare segmentation pie chart data
  const segmentData = [
    { name: 'New', value: segmentation.new, color: SEGMENT_COLORS.new },
    { name: 'Returning', value: segmentation.returning, color: SEGMENT_COLORS.returning },
    { name: 'Loyal', value: segmentation.loyal, color: SEGMENT_COLORS.loyal },
    { name: 'At Risk', value: segmentation.at_risk, color: SEGMENT_COLORS.at_risk }
  ].filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-1">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {entry.name}: <span className="font-semibold">{entry.value}</span>
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_customers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Customers</p>
                <p className="text-2xl font-bold text-green-600">{summary.active_customers}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">New Customers</p>
                <p className="text-2xl font-bold text-purple-600">{summary.new_customers}</p>
              </div>
              <UserPlus className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Retention Rate</p>
                <p className="text-2xl font-bold text-indigo-600">{summary.retention_rate}%</p>
              </div>
              <Activity className="w-8 h-8 text-indigo-500" />
            </div>
            <div className="mt-3">
              <Progress value={summary.retention_rate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Segmentation */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Segmentation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segmentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {segmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, name]}
                    labelStyle={{ display: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {segmentData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span className="text-sm text-gray-600">{entry.name}: {entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activity Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Activity Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activity_trends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#6B7280"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    fontSize={12}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="new_customers"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="New Customers"
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="returning_customers"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Returning Customers"
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Lifetime Value */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="w-5 h-5" />
            Customer Lifetime Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Average CLV</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrencySync(lifetime_value.average_clv)}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Median CLV</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrencySync(lifetime_value.median_clv)}
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Top Tier CLV</p>
              <p className="text-2xl font-bold text-purple-900">
                {formatCurrencySync(lifetime_value.top_tier_clv)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Top Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {top_customers.slice(0, 8).map((customer, index) => (
              <div key={customer.customer_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                    <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{customer.customer_name}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span>{customer.total_rentals} rentals</span>
                      <span>Avg: {formatCurrencySync(customer.avg_rental_value)}</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{customer.days_since_last_rental} days ago</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrencySync(customer.total_revenue)}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    Total Revenue
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}