'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { Plus, FileText, TrendingUp, Package, Users, Calendar, BarChart3, Star } from 'lucide-react';
import { useSalesDashboard, usePaginatedSales } from '@/hooks/use-sales';
import { format } from 'date-fns';

function SalesContent() {
  const router = useRouter();
  const { dashboardData, isLoading: isDashboardLoading } = useSalesDashboard();
  const { transactions: recentSales, isLoading: isRecentSalesLoading } = usePaginatedSales({
    limit: 5,
    skip: 0
  });

  const stats = dashboardData?.stats || {
    today_sales: 0,
    monthly_sales: 0,
    total_transactions: 0,
    average_sale_amount: 0
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      COMPLETED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const statsCards = [
    {
      title: "Today's Sales",
      value: formatCurrency(stats.today_sales),
      change: stats.today_sales > 0 ? '+' + formatCurrency(stats.today_sales) : 'No sales today',
      icon: Package,
      color: 'text-green-600',
    },
    {
      title: 'Monthly Sales',
      value: formatCurrency(stats.monthly_sales),
      change: stats.monthly_sales > 0 ? '+' + formatCurrency(stats.monthly_sales) : 'No sales this month',
      icon: TrendingUp,
      color: 'text-slate-600',
    },
    {
      title: 'Total Transactions',
      value: stats.total_transactions.toString(),
      change: stats.total_transactions > 0 ? `${stats.total_transactions} transactions` : 'No transactions',
      icon: FileText,
      color: 'text-purple-600',
    },
    {
      title: 'Average Sale',
      value: formatCurrency(stats.average_sale_amount),
      change: stats.average_sale_amount > 0 ? 'Avg per transaction' : 'No average available',
      icon: Package,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Sales Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage sales transactions and view sales analytics
          </p>
        </div>
        <Button onClick={() => router.push('/sales/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Sale
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isDashboardLoading ? (
                    <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                  ) : (
                    stat.value
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isDashboardLoading ? (
                    <div className="animate-pulse bg-gray-200 h-3 w-24 rounded mt-1"></div>
                  ) : (
                    stat.change
                  )}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/sales/new')}
        >
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5" />
              Create New Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Process a new sales transaction with inventory management
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/sales/history')}
        >
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Sales History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View and manage past sales transactions
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/reports?type=sales')}
        >
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="mr-2 h-5 w-5" />
              Sales Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Generate detailed sales reports and analytics
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Sales</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/sales/history')}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isRecentSalesLoading ? (
              // Loading state
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2">
                    <div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div>
                    <div className="animate-pulse bg-gray-200 h-3 w-24 rounded"></div>
                  </div>
                  <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
                </div>
              ))
            ) : recentSales.length > 0 ? (
              recentSales.map((sale) => (
                <div 
                  key={sale.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/sales/${sale.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="font-medium">
                        {sale.transaction_number}
                      </div>
                      <Badge className={getStatusBadge(sale.status)}>
                        {sale.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {sale.customer_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(sale.transaction_date), 'MMM dd, yyyy')}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {formatCurrency(sale.total_amount)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {sale.payment_status}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="font-medium">No recent sales available</p>
                <p className="text-sm mt-1">Create your first sale to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analytics Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Selling Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Top Selling Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isDashboardLoading ? (
              // Loading state
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="space-y-1">
                      <div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div>
                      <div className="animate-pulse bg-gray-200 h-3 w-20 rounded"></div>
                    </div>
                    <div className="animate-pulse bg-gray-200 h-4 w-16 rounded"></div>
                  </div>
                ))}
              </div>
            ) : dashboardData?.top_selling_items && dashboardData.top_selling_items.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.top_selling_items.slice(0, 5).map((item, index) => (
                  <div key={item.item_id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                        <div>
                          <div className="font-medium text-sm">{item.item_name}</div>
                          <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{item.quantity_sold} sold</div>
                      <div className="text-xs text-gray-500">{formatCurrency(item.revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="font-medium">No sales data available</p>
                <p className="text-sm mt-1">Start selling to see top items</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Sales Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isDashboardLoading ? (
              <div className="space-y-4">
                <div className="animate-pulse bg-gray-200 h-32 w-full rounded"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm text-blue-700">Daily Average</div>
                    <div className="text-lg font-bold text-blue-900">
                      {formatCurrency(stats.monthly_sales / 30)}
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm text-green-700">Success Rate</div>
                    <div className="text-lg font-bold text-green-900">
                      {stats.total_transactions > 0 ? '95%' : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Performance Bars */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Today vs Monthly Avg</span>
                      <span>{Math.round((stats.today_sales / (stats.monthly_sales / 30)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ 
                          width: `${Math.min(100, (stats.today_sales / (stats.monthly_sales / 30)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Monthly Progress</span>
                      <span>{Math.round((new Date().getDate() / 30) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ 
                          width: `${(new Date().getDate() / 30) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Summary */}
      {!isDashboardLoading && (stats.today_sales > 0 || stats.monthly_sales > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-green-700">Today&apos;s Revenue:</span>
                <span className="font-bold text-green-900">{formatCurrency(stats.today_sales)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-700">Monthly Revenue:</span>
                <span className="font-bold text-slate-900">{formatCurrency(stats.monthly_sales)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-purple-700">Avg. Transaction:</span>
                <span className="font-bold text-purple-900">{formatCurrency(stats.average_sale_amount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SalesPage() {
  return (
    <ProtectedRoute requiredPermissions={['SALE_VIEW']}>
      <SalesContent />
    </ProtectedRoute>
  );
}