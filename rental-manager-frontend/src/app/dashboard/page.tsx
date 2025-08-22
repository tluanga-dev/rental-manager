'use client';

import { useState, useEffect } from 'react';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { formatCurrencySync, getCurrentCurrency } from '@/lib/currency-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { rentalsApi } from '@/services/api/rentals';
import { customersApi } from '@/services/api/customers';
import { SupplierSelector } from '@/components/supplier-selector';
import { LowStockWidget } from '@/components/dashboard/low-stock-widget';
import {
  IndianRupee,
  Package,
  Users,
  AlertCircle,
  LucideIcon,
  Clock,
  AlertTriangle,
  Calendar,
  Phone,
  Eye,
  FileText,
} from 'lucide-react';

// Dashboard will use real API data instead of mock data

// Type definitions for rental due today
interface RentalDueToday {
  transaction_id: string;
  transaction_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  rental_start_date: string;
  rental_end_date: string;
  rental_days: number;
  is_overdue: boolean;
  days_overdue: number;
  days_remaining: number;
  total_amount: number;
  deposit_amount: number;
  balance_due: number;
  items: Array<{
    sku_code: string;
    item_name: string;
    quantity: number;
    unit_price: number;
  }>;
  location_id: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface RentalsSummary {
  total_due_today: number;
  total_overdue: number;
  total_due_soon: number;
  total_revenue_at_risk: number;
  total_deposits_held: number;
}

function DashboardContent() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [rentalsDueToday, setRentalsDueToday] = useState<RentalDueToday[]>([]);
  const [rentalsSummary, setRentalsSummary] = useState<RentalsSummary>({
    total_due_today: 0,
    total_overdue: 0,
    total_due_soon: 0,
    total_revenue_at_risk: 0,
    total_deposits_held: 0,
  });
  const [activeRentalsCount, setActiveRentalsCount] = useState<number>(0);
  const [customersCount, setCustomersCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  // Comprehensive data fetching function
  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      // Fetch rentals due today, active rentals, and customers in parallel
      const [dueResponse, activeResponse, customersResponse] = await Promise.allSettled([
        rentalsApi.getRentalsDueToday(),
        rentalsApi.getActiveRentals({ limit: 1000 }), // Get all active rentals for count
        customersApi.list({ limit: 1000 }) // Get all customers for count
      ]);

      // Handle rentals due today response
      if (dueResponse.status === 'fulfilled') {
        setRentalsDueToday(dueResponse.value.data || []);
        setRentalsSummary({
          total_due_today: dueResponse.value.summary?.total_rentals || 0,
          total_overdue: dueResponse.value.summary?.overdue_count || 0,
          total_due_soon: 0, // Not available in new API
          total_revenue_at_risk: dueResponse.value.summary?.total_value || 0,
          total_deposits_held: 0, // Not available in new API
        });
      } else {
        console.log('Failed to fetch rentals due today:', dueResponse.reason);
        setRentalsDueToday([]);
        setRentalsSummary({
          total_due_today: 0,
          total_overdue: 0,
          total_due_soon: 0,
          total_revenue_at_risk: 0,
          total_deposits_held: 0,
        });
      }

      // Handle active rentals response
      if (activeResponse.status === 'fulfilled') {
        setActiveRentalsCount(activeResponse.value.data?.length || 0);
      } else {
        console.log('Failed to fetch active rentals:', activeResponse.reason);
        setActiveRentalsCount(0);
      }

      // Handle customers response
      if (customersResponse.status === 'fulfilled') {
        setCustomersCount(customersResponse.value.total || 0);
      } else {
        console.log('Failed to fetch customers:', customersResponse.reason);
        setCustomersCount(0);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set default values on error
      setRentalsDueToday([]);
      setRentalsSummary({
        total_due_today: 0,
        total_overdue: 0,
        total_due_soon: 0,
        total_revenue_at_risk: 0,
        total_deposits_held: 0,
      });
      setActiveRentalsCount(0);
      setCustomersCount(0);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData(true); // Refresh without showing loading state
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  const [currencySymbol, setCurrencySymbol] = useState('₹'); // Default to INR

  // Load currency symbol
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const currency = await getCurrentCurrency();
        setCurrencySymbol(currency.symbol);
      } catch (error) {
        console.error('Failed to load currency:', error);
        setCurrencySymbol('₹'); // Keep INR as fallback
      }
    };
    loadCurrency();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (rental: RentalDueToday) => {
    if (rental.is_overdue) {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {rental.days_overdue} days overdue
      </Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        <Clock className="w-3 h-3 mr-1" />
        Due today
      </Badge>;
    }
  };

  const stats = [
    {
      title: 'Total Revenue',
      value: formatCurrencySync(0),
      change: 'No data available',
      icon: IndianRupee,
      color: 'text-green-600',
    },
    {
      title: 'Active Rentals',
      value: activeRentalsCount.toString(),
      change: isRefreshing ? 'Updating...' : (activeRentalsCount > 0 ? `${activeRentalsCount} rentals in progress` : 'No active rentals'),
      icon: Package,
      color: 'text-blue-600',
      link: '/rentals/active',
    },
    {
      title: 'Customers',
      value: customersCount.toString(),
      change: isRefreshing ? 'Updating...' : (customersCount > 0 ? `${customersCount} total customers` : 'No customers found'),
      icon: Users,
      color: 'text-purple-600',
      link: '/customers',
    },
    {
      title: 'Rentals Due Today',
      value: (rentalsSummary.total_due_today + rentalsSummary.total_overdue).toString(),
      change: isRefreshing ? 'Updating...' : `${rentalsSummary.total_overdue} overdue, ${rentalsSummary.total_due_today} due today`,
      icon: AlertCircle,
      color: 'text-yellow-600',
      link: '/rentals/due-today',
    },
  ] as Array<{
    title: string;
    value: string;
    change: string;
    icon: LucideIcon;
    color: string;
    link?: string;
  }>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome back, {user?.firstName}! Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRefreshing && (
            <div className="flex items-center text-sm text-gray-500">
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full mr-2"></div>
              Updating...
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isClickable = stat.link;
          
          return (
            <Card 
              key={stat.title} 
              className={isClickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}
              onClick={isClickable ? () => router.push(stat.link) : undefined}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Low Stock Alerts Section */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        <LowStockWidget />
        
        {/* Demo: New Supplier Selector Component */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Supplier Selector Demo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This demonstrates the new searchable supplier selector component with async loading.
              </p>
              <div className="max-w-md">
                <label className="text-sm font-medium mb-2 block">Select a Supplier:</label>
                <SupplierSelector
                  value={selectedSupplier}
                  onValueChange={setSelectedSupplier}
                  placeholder="Search and select supplier..."
                  showCreateButton={true}
                  onCreateNew={() => router.push('/purchases/suppliers/new')}
                />
              </div>
              {selectedSupplier && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    ✅ Selected supplier ID: <code className="font-mono">{selectedSupplier}</code>
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedSupplier(null)}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rentals Due Today Section */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        {/* Summary Cards */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Due Today Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Due Today</span>
              <span className="text-lg font-semibold text-yellow-600">{rentalsSummary.total_due_today}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Overdue</span>
              <span className="text-lg font-semibold text-red-600">{rentalsSummary.total_overdue}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Revenue at Risk</span>
              <span className="text-lg font-semibold text-red-600">{formatCurrencySync(rentalsSummary.total_revenue_at_risk)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Deposits Held</span>
              <span className="text-lg font-semibold text-green-600">{formatCurrencySync(rentalsSummary.total_deposits_held)}</span>
            </div>
            <Button 
              className="w-full mt-4" 
              onClick={() => router.push('/rentals/due-today')}
            >
              View All Due Rentals
            </Button>
          </CardContent>
        </Card>

        {/* Rentals Due Today Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rentals Due Today</CardTitle>
          </CardHeader>
          <CardContent>
            {rentalsDueToday.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          Loading rentals due today...
                        </TableCell>
                      </TableRow>
                    ) : rentalsDueToday.length > 0 ? (
                      rentalsDueToday.slice(0, 5).map((rental) => (
                        <TableRow key={rental.transaction_id}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{rental.customer_name}</div>
                              {rental.customer_phone && (
                                <div className="text-xs text-gray-500 flex items-center">
                                  <Phone className="w-3 h-3 mr-1" />
                                  {rental.customer_phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{rental.transaction_number}</div>
                              <div className="text-xs text-gray-500">
                                Due: {formatDate(rental.rental_end_date)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(rental)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{formatCurrencySync(rental.total_amount)}</div>
                              <div className="text-xs text-gray-500">
                                Balance: {formatCurrencySync(rental.balance_due)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm">
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button size="sm">
                                <FileText className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          No rentals due today
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No rentals due today
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <ProtectedRoute requiredPermissions={['SALE_VIEW', 'RENTAL_VIEW']}>
        <DashboardContent />
      </ProtectedRoute>
    </AuthConnectionGuard>
  );
}