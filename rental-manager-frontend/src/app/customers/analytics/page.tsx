'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  Users,
  Building,
  CreditCard,
  UserX,
  TrendingUp,
  Package,
  Calendar,
  Target,
  Award,
  BarChart3
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { customersApi, type CustomerAnalytics } from '@/services/api/customers';
import { useAppStore } from '@/stores/app-store';

// Mock chart components - replace with actual chart library like recharts
const PieChart = ({ data, title }: { data: any[]; title: string }) => (
  <div className="space-y-4">
    <h4 className="font-medium">{title}</h4>
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: `hsl(${index * 90}, 70%, 50%)` }}
            />
            <span className="text-sm">{item.name}</span>
          </div>
          <span className="text-sm font-medium">{item.value}</span>
        </div>
      ))}
    </div>
  </div>
);

const BarChart = ({ data, title }: { data: any[]; title: string }) => (
  <div className="space-y-4">
    <h4 className="font-medium">{title}</h4>
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{item.name}</span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-slate-600 h-2 rounded-full" 
              style={{ width: `${(item.value / Math.max(...data.map(d => d.value))) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
);

function CustomerAnalyticsContent() {
  const router = useRouter();
  const { addNotification } = useAppStore();
  
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await customersApi.getAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load customer analytics'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-600">No analytics data available</p>
        </div>
      </div>
    );
  }

  const tierData = [
    { name: 'Bronze', value: analytics?.tier_distribution?.bronze || 0 },
    { name: 'Silver', value: analytics?.tier_distribution?.silver || 0 },
    { name: 'Gold', value: analytics?.tier_distribution?.gold || 0 },
    { name: 'Platinum', value: analytics?.tier_distribution?.platinum || 0 }
  ].filter(item => item.value > 0);

  const customerTypeData = [
    { name: 'Individual', value: analytics?.customer_types?.individual || 0 },
    { name: 'Business', value: analytics?.customer_types?.business || 0 }
  ].filter(item => item.value > 0);

  const topCustomersData = (analytics?.top_customers_by_value || []).slice(0, 5).map(item => ({
    name: item.customer.customer_type === 'BUSINESS' 
      ? item.customer.business_name || 'Business Customer'
      : `${item.customer.first_name || ''} ${item.customer.last_name || ''}`.trim() || 'Individual Customer',
    value: item.lifetime_value
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Customer Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Comprehensive insights into your customer base
            </p>
          </div>
        </div>
        <Button onClick={loadAnalytics}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.total_customers || 0}</div>
            <p className="text-xs text-muted-foreground">
              All registered customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
              Active Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analytics?.active_customers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.total_customers ? (((analytics?.active_customers || 0) / analytics.total_customers) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <UserX className="h-4 w-4 mr-2 text-red-600" />
              Blacklisted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{analytics?.blacklisted_customers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.total_customers ? (((analytics?.blacklisted_customers || 0) / analytics.total_customers) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Award className="h-4 w-4 mr-2 text-purple-600" />
              Premium Tiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {(analytics?.tier_distribution?.gold || 0) + (analytics?.tier_distribution?.platinum || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Gold & Platinum customers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building className="h-5 w-5 mr-2" />
              Customer Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart data={customerTypeData} title="Customer Types" />
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Customer Tier Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart data={tierData} title="Customer Tiers" />
          </CardContent>
        </Card>

        {/* Top Customers by Value */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Top Customers by Lifetime Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCustomersData.length > 0 ? (
                <div className="space-y-3">
                  {topCustomersData.map((customer, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-sm font-medium">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-gray-500">Customer</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatCurrency(customer.value)}</p>
                        <p className="text-xs text-gray-500">Lifetime Value</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No customer data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Growth */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Monthly New Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.monthly_new_customers?.length > 0 ? (
              <BarChart 
                data={analytics.monthly_new_customers.map(item => ({
                  name: item.month,
                  value: item.count
                }))} 
                title="New Customer Registration Trend" 
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Monthly growth data will appear here once more customers are registered</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tier Breakdown Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Customer Tier Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{analytics?.tier_distribution?.bronze || 0}</div>
              <p className="text-sm text-orange-700 dark:text-orange-400">Bronze</p>
              <p className="text-xs text-gray-500">Entry Level</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{analytics?.tier_distribution?.silver || 0}</div>
              <p className="text-sm text-gray-700 dark:text-gray-400">Silver</p>
              <p className="text-xs text-gray-500">Standard</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{analytics?.tier_distribution?.gold || 0}</div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">Gold</p>
              <p className="text-xs text-gray-500">Premium</p>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{analytics?.tier_distribution?.platinum || 0}</div>
              <p className="text-sm text-purple-700 dark:text-purple-400">Platinum</p>
              <p className="text-xs text-gray-500">Elite</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CustomerAnalyticsPage() {
  return (
    <ProtectedRoute requiredPermissions={['CUSTOMER_VIEW']}>
      <CustomerAnalyticsContent />
    </ProtectedRoute>
  );
}