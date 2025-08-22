'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Clock, AlertCircle, TrendingUp, Calendar, Users, ArrowRight } from 'lucide-react';

import { rentalsApi } from '@/services/api/rentals';
import { AvailabilityChecker } from '@/components/rentals/widgets/AvailabilityChecker';

function RentalDashboardContent() {
  const router = useRouter();

  // Load rental analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['rental-analytics'],
    queryFn: () => rentalsApi.getRentalAnalytics(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Load rentals due today
  const { data: dueToday } = useQuery({
    queryKey: ['rentals-due-today'],
    queryFn: () => rentalsApi.getRentalsDueToday(),
    refetchInterval: 60000, // Refresh every minute
  });

  const stats = [
    {
      title: 'Active Rentals',
      value: analytics?.overview?.active_rentals?.toString() || '0',
      change: `${analytics?.trends?.monthly_growth || 0}% from last month`,
      icon: Package,
      color: 'text-slate-600',
      trend: 'up',
    },
    {
      title: 'Overdue Returns',
      value: analytics?.overview?.overdue_rentals?.toString() || '0',
      change: 'Needs attention',
      icon: AlertCircle,
      color: 'text-red-600',
      trend: 'down',
    },
    {
      title: 'Due Today',
      value: dueToday?.summary?.total_rentals?.toString() || '0',
      change: `${dueToday?.summary?.overdue_count || 0} overdue`,
      icon: Clock,
      color: 'text-orange-600',
      trend: 'neutral',
    },
    {
      title: 'Monthly Revenue',
      value: analytics?.overview?.total_revenue ? `₹${analytics.overview.total_revenue.toLocaleString()}` : '₹0',
      change: `${analytics?.trends?.revenue_growth || 0}% from last month`,
      icon: TrendingUp,
      color: 'text-green-600',
      trend: 'up',
    },
  ];

  const quickActions = [
    {
      title: 'Create New Rental',
      description: 'Start a new rental transaction with availability checking',
      icon: Plus,
      action: () => router.push('/rentals/create-compact'),
      color: 'bg-slate-50 text-slate-600 border-slate-200',
    },
    {
      title: 'Active Rentals',
      description: 'View and manage current active rentals',
      icon: Package,
      action: () => router.push('/rentals/active'),
      color: 'bg-green-50 text-green-600 border-green-200',
    },
    {
      title: 'Due Today',
      description: 'Manage rentals due for return today',
      icon: Clock,
      action: () => router.push('/rentals/due-today'),
      color: 'bg-orange-50 text-orange-600 border-orange-200',
    },
    {
      title: 'Rental History',
      description: 'Browse past rental transactions and reports',
      icon: Calendar,
      action: () => router.push('/rentals/history'),
      color: 'bg-purple-50 text-purple-600 border-purple-200',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Rental Management
          </h1>
          <p className="text-gray-600">
            Comprehensive rental transaction management and analytics
          </p>
        </div>
        <Button onClick={() => router.push('/rentals/create-compact')} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          New Rental
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  {stat.trend === 'up' && <TrendingUp className="w-3 h-3 mr-1 text-green-500" />}
                  {stat.trend === 'down' && <AlertCircle className="w-3 h-3 mr-1 text-red-500" />}
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card
                  key={action.title}
                  className={`cursor-pointer hover:shadow-lg transition-all border-2 ${action.color}`}
                  onClick={action.action}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        {action.title}
                      </div>
                      <ArrowRight className="h-4 w-4" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm opacity-80">
                      {action.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Availability Checker */}
        <div className="space-y-4">
          <AvailabilityChecker />
        </div>
      </div>

      {/* Today's Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rentals Due Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Rentals Due Today</CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push('/rentals/due-today')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dueToday?.data?.slice(0, 5).map((rental) => (
                <div
                  key={rental.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/rentals/${rental.id}`)}
                >
                  <div>
                    <p className="font-medium">{rental.customer_name}</p>
                    <p className="text-sm text-gray-600">
                      {rental.transaction_number} • {rental.items_count} items
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={rental.is_overdue ? "destructive" : "outline"}>
                      {rental.is_overdue ? `${rental.days_overdue}d overdue` : 'Due today'}
                    </Badge>
                    <p className="text-sm text-gray-600 mt-1">
                      ₹{rental.total_amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              )) || (
                  <p className="text-center text-gray-500 py-4">
                    No rentals due today
                  </p>
                )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push('/rentals/history')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics?.recent_activity?.slice(0, 5).map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/rentals/${activity.rental_id}`)}
                >
                  <div>
                    <p className="font-medium">{activity.customer_name}</p>
                    <p className="text-sm text-gray-600">
                      {activity.rental_number} • {activity.action}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </p>
                    {activity.amount && (
                      <p className="text-sm font-medium">
                        ${activity.amount.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )) || (
                  <p className="text-center text-gray-500 py-4">
                    No recent activity
                  </p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Insights */}
      {analytics && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top Customers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Top Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(analytics?.top_performers?.customers || []).slice(0, 5).map((customer, index) => (
                  <div key={customer.party_id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{customer.customer_name}</p>
                      <p className="text-sm text-gray-600">{customer.total_rentals} rentals</p>
                    </div>
                    <p className="font-medium">${customer.total_revenue.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Top Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(analytics?.top_performers?.items || []).slice(0, 5).map((item, index) => (
                  <div key={item.item_id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.item_name}</p>
                      <p className="text-sm text-gray-600">{item.rental_count} rentals</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${item.revenue.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">{item.utilization_rate.toFixed(1)}% util</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completion Rate</span>
                  <span className="font-medium">
                    {analytics?.overview?.completion_rate !== undefined
                      ? analytics.overview.completion_rate.toFixed(1)
                      : '0.0'
                    }%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Average Rental Value</span>
                  <span className="font-medium">₹{analytics?.overview?.average_rental_value?.toLocaleString() || '0'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Monthly Growth</span>
                  <span className={`font-medium ${(analytics?.trends?.monthly_growth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(analytics?.trends?.monthly_growth || 0) >= 0 ? '+' : ''}{(analytics?.trends?.monthly_growth || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Revenue Growth</span>
                  <span className={`font-medium ${(analytics?.trends?.revenue_growth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(analytics?.trends?.revenue_growth || 0) >= 0 ? '+' : ''}{(analytics?.trends?.revenue_growth || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function RentalDashboardPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <ProtectedRoute requiredPermissions={['RENTAL_VIEW']}>
        <RentalDashboardContent />
      </ProtectedRoute>
    </AuthConnectionGuard>
  );
}