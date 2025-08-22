'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Search, 
  Filter, 
  Eye,
  IndianRupee,
  ShoppingCart,
  Calendar,
  TrendingUp,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import { format } from 'date-fns';

// Mock data for customer sales - replace with actual API call
const mockCustomerSales = [
  {
    id: '1',
    customer: {
      id: 'cust-001',
      name: 'Tech Solutions Ltd',
      email: 'contact@techsolutions.com',
      phone: '+91 98765 43210',
      address: 'Mumbai, Maharashtra',
      customer_code: 'TECH001',
      tier: 'GOLD'
    },
    sales_summary: {
      total_transactions: 24,
      total_revenue: 145000.00,
      average_order_value: 6041.67,
      first_purchase: '2024-01-15T10:30:00Z',
      last_purchase: '2024-08-02T14:20:00Z',
      growth_rate: 18.5
    },
    recent_transactions: [
      {
        id: 'sale-001',
        transaction_number: 'SALE-20240802-0001',
        date: '2024-08-02T14:20:00Z',
        amount: 8500.00,
        status: 'COMPLETED',
        items_count: 3
      },
      {
        id: 'sale-002',
        transaction_number: 'SALE-20240730-0003',
        date: '2024-07-30T11:15:00Z',
        amount: 12000.00,
        status: 'COMPLETED',
        items_count: 5
      }
    ]
  },
  {
    id: '2',
    customer: {
      id: 'cust-002',
      name: 'Digital Works Inc',
      email: 'info@digitalworks.com',
      phone: '+91 87654 32109',
      address: 'Delhi, NCR',
      customer_code: 'DIG002',
      tier: 'SILVER'
    },
    sales_summary: {
      total_transactions: 18,
      total_revenue: 98500.00,
      average_order_value: 5472.22,
      first_purchase: '2024-02-10T09:45:00Z',
      last_purchase: '2024-08-01T16:30:00Z',
      growth_rate: 12.3
    },
    recent_transactions: [
      {
        id: 'sale-003',
        transaction_number: 'SALE-20240801-0002',
        date: '2024-08-01T16:30:00Z',
        amount: 6200.00,
        status: 'COMPLETED',
        items_count: 2
      }
    ]
  },
  {
    id: '3',
    customer: {
      id: 'cust-003',
      name: 'Innovation Corp',
      email: 'orders@innovationcorp.com',
      phone: '+91 76543 21098',
      address: 'Bangalore, Karnataka',
      customer_code: 'INN003',
      tier: 'BRONZE'
    },
    sales_summary: {
      total_transactions: 12,
      total_revenue: 67800.00,
      average_order_value: 5650.00,
      first_purchase: '2024-03-05T12:20:00Z',
      last_purchase: '2024-07-28T10:10:00Z',
      growth_rate: -5.2
    },
    recent_transactions: [
      {
        id: 'sale-004',
        transaction_number: 'SALE-20240728-0001',
        date: '2024-07-28T10:10:00Z',
        amount: 4200.00,
        status: 'COMPLETED',
        items_count: 1
      }
    ]
  }
];

function SalesCustomersContent() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [sortBy, setSortBy] = useState('revenue');

  const getTierBadge = (tier: string) => {
    const tierColors = {
      GOLD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      SILVER: 'bg-gray-100 text-gray-800 border-gray-300',
      BRONZE: 'bg-orange-100 text-orange-800 border-orange-300',
      PLATINUM: 'bg-purple-100 text-purple-800 border-purple-300'
    };
    return tierColors[tier as keyof typeof tierColors] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

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

  const filteredCustomers = mockCustomerSales
    .filter(customer => {
      const matchesSearch = searchTerm === '' || 
        customer.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.customer.customer_code.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTier = selectedTier === 'ALL' || customer.customer.tier === selectedTier;
      
      return matchesSearch && matchesTier;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return b.sales_summary.total_revenue - a.sales_summary.total_revenue;
        case 'transactions':
          return b.sales_summary.total_transactions - a.sales_summary.total_transactions;
        case 'avg_order':
          return b.sales_summary.average_order_value - a.sales_summary.average_order_value;
        case 'growth':
          return b.sales_summary.growth_rate - a.sales_summary.growth_rate;
        case 'name':
          return a.customer.name.localeCompare(b.customer.name);
        default:
          return 0;
      }
    });

  const totalRevenue = mockCustomerSales.reduce((sum, customer) => sum + customer.sales_summary.total_revenue, 0);
  const totalTransactions = mockCustomerSales.reduce((sum, customer) => sum + customer.sales_summary.total_transactions, 0);
  const averageOrderValue = totalRevenue / totalTransactions;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Sales by Customer
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Analyze customer purchase patterns and performance
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From all customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground">Across all customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockCustomerSales.length}</div>
            <p className="text-xs text-muted-foreground">With sales history</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter & Sort Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by customer name, email, or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Tiers</option>
              <option value="PLATINUM">Platinum</option>
              <option value="GOLD">Gold</option>
              <option value="SILVER">Silver</option>
              <option value="BRONZE">Bronze</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="revenue">Sort by Revenue</option>
              <option value="transactions">Sort by Transactions</option>
              <option value="avg_order">Sort by Avg Order</option>
              <option value="growth">Sort by Growth</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Customer Sales Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer Sales Performance ({filteredCustomers.length})</CardTitle>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customerData) => (
                <div 
                  key={customerData.customer.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Customer Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{customerData.customer.name}</h3>
                        <Badge className={getTierBadge(customerData.customer.tier)}>
                          {customerData.customer.tier}
                        </Badge>
                        <span className="text-sm text-gray-500">({customerData.customer.customer_code})</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {customerData.customer.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customerData.customer.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {customerData.customer.address}
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push(`/customers/${customerData.customer.id}/sales`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </Button>
                  </div>

                  {/* Sales Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-sm text-green-700 mb-1">Total Revenue</div>
                      <div className="text-lg font-bold text-green-900">
                        {formatCurrency(customerData.sales_summary.total_revenue)}
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-sm text-blue-700 mb-1">Transactions</div>
                      <div className="text-lg font-bold text-blue-900">
                        {customerData.sales_summary.total_transactions}
                      </div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="text-sm text-purple-700 mb-1">Avg Order Value</div>
                      <div className="text-lg font-bold text-purple-900">
                        {formatCurrency(customerData.sales_summary.average_order_value)}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${
                      customerData.sales_summary.growth_rate >= 0 
                        ? 'bg-green-50' 
                        : 'bg-red-50'
                    }`}>
                      <div className={`text-sm mb-1 ${
                        customerData.sales_summary.growth_rate >= 0 
                          ? 'text-green-700' 
                          : 'text-red-700'
                      }`}>
                        Growth Rate
                      </div>
                      <div className={`text-lg font-bold ${
                        customerData.sales_summary.growth_rate >= 0 
                          ? 'text-green-900' 
                          : 'text-red-900'
                      }`}>
                        {formatPercentage(customerData.sales_summary.growth_rate)}
                      </div>
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Recent Transactions</h4>
                      <div className="text-xs text-gray-500">
                        First purchase: {format(new Date(customerData.sales_summary.first_purchase), 'MMM dd, yyyy')}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {customerData.recent_transactions.map((transaction) => (
                        <div 
                          key={transaction.id}
                          className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                          onClick={() => router.push(`/sales/${transaction.id}`)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{transaction.transaction_number}</span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(transaction.date), 'MMM dd, yyyy')}
                            </span>
                            <span className="text-xs text-gray-500">
                              {transaction.items_count} items
                            </span>
                          </div>
                          <div className="text-sm font-bold">
                            {formatCurrency(transaction.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="font-medium">No customers found</p>
                <p className="text-sm mt-1">
                  {searchTerm || selectedTier !== 'ALL' 
                    ? 'Try adjusting your filters' 
                    : 'No customer sales data available'
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SalesCustomersPage() {
  return (
    <ProtectedRoute requiredPermissions={['SALE_VIEW', 'CUSTOMER_VIEW']}>
      <SalesCustomersContent />
    </ProtectedRoute>
  );
}