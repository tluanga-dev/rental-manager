'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrencySync, getCurrentCurrency } from '@/lib/currency-utils';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Filter,
  Edit,
  Eye,
  Users,
  Building,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Calendar,
  UserCheck,
  UserX
} from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { customersApi, type CustomerResponse } from '@/services/api/customers';

function CustomersContent() {
  const router = useRouter();
  const { addNotification } = useAppStore();
  
  // State
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [blacklistFilter, setBlacklistFilter] = useState<string>('all');
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    individual: 0,
    business: 0,
    blacklisted: 0,
    topTier: 0
  });

  // Load customers
  useEffect(() => {
    loadCustomers();
  }, [currentPage, customerTypeFilter, tierFilter, statusFilter, blacklistFilter]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params: any = {
        skip: currentPage * pageSize,
        limit: pageSize,
      };

      if (customerTypeFilter !== 'all') {
        params.customer_type = customerTypeFilter;
      }
      if (tierFilter !== 'all') {
        params.customer_tier = tierFilter;
      }
      if (statusFilter !== 'all') {
        params.is_active = statusFilter === 'active';
      }
      if (blacklistFilter !== 'all') {
        params.blacklist_status = blacklistFilter;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const response = await customersApi.list(params);
      setCustomers(response.items || []);
      setTotalCount(response.total || 0);

      // Calculate stats
      const items = response.items || [];
      const activeCustomers = (items || []).filter(c => c?.is_active);
      setStats({
        total: response.total || 0,
        active: activeCustomers.length,
        individual: (items || []).filter(c => c?.customer_type === 'INDIVIDUAL').length,
        business: (items || []).filter(c => c?.customer_type === 'BUSINESS').length,
        blacklisted: (items || []).filter(c => c?.status === 'BLACKLISTED').length,
        topTier: 0 // Will be calculated when customer_tier is available
      });

    } catch (error) {
      console.error('Error loading customers:', error);
      // Set default values on error
      setCustomers([]);
      setTotalCount(0);
      setStats({
        total: 0,
        active: 0,
        individual: 0,
        business: 0,
        blacklisted: 0,
        topTier: 0
      });
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load customers'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(0);
    loadCustomers();
  };

  const handleQuickAction = async (customerId: string, action: 'blacklist' | 'unblacklist') => {
    try {
      await customersApi.manageBlacklist(customerId, action);
      addNotification({
        type: 'success',
        title: 'Success',
        message: `Customer ${action === 'blacklist' ? 'blacklisted' : 'removed from blacklist'} successfully`
      });
      loadCustomers();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to ${action} customer`
      });
    }
  };

  const getCustomerDisplayName = (customer: CustomerResponse) => {
    // Build display name from available fields
    if (customer.customer_type === 'BUSINESS' && customer.business_name) {
      return customer.business_name;
    }
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM': return 'bg-purple-100 text-purple-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      default: return 'bg-orange-100 text-orange-800';
    }
  };

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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Customer Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage customer information, tiers, and blacklist status
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/customers/analytics')}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Analytics
          </Button>
          <Button onClick={() => router.push('/customers/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <UserCheck className="h-4 w-4 mr-2" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Individual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.individual}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Building className="h-4 w-4 mr-2" />
              Business
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.business}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <UserX className="h-4 w-4 mr-2" />
              Blacklisted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.blacklisted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              Premium Tiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.topTier}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="customer-type">Customer Type</Label>
              <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
                <SelectTrigger id="customer-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                  <SelectItem value="BUSINESS">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tier">Customer Tier</Label>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger id="tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="BRONZE">Bronze</SelectItem>
                  <SelectItem value="SILVER">Silver</SelectItem>
                  <SelectItem value="GOLD">Gold</SelectItem>
                  <SelectItem value="PLATINUM">Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="blacklist">Blacklist</Label>
              <Select value={blacklistFilter} onValueChange={setBlacklistFilter}>
                <SelectTrigger id="blacklist">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="CLEAR">Clear</SelectItem>
                  <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                <Filter className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customers ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Lifetime Value</TableHead>
                  <TableHead>Last Transaction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading customers...
                    </TableCell>
                  </TableRow>
                ) : !customers || customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getCustomerDisplayName(customer)}</div>
                          <div className="text-sm text-gray-500">{customer.customer_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {customer.customer_type === 'BUSINESS' ? (
                            <><Building className="h-3 w-3 mr-1" /> Business</>
                          ) : (
                            <><Users className="h-3 w-3 mr-1" /> Individual</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {customer.credit_rating || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrencySync(customer.credit_limit)}</TableCell>
                      <TableCell>
                        <div className="font-medium">N/A</div>
                      </TableCell>
                      <TableCell>N/A</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                            {customer.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {customer.status === 'BLACKLISTED' && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Blacklisted
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/customers/${customer.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/customers/${customer.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {customer.status === 'BLACKLISTED' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuickAction(customer.id, 'unblacklist')}
                              className="text-green-600 hover:text-green-700"
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleQuickAction(customer.id, 'blacklist')}
                              className="text-red-600 hover:text-red-700"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} customers
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(currentPage + 1) * pageSize >= totalCount}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <ProtectedRoute requiredPermissions={['CUSTOMER_VIEW']}>
        <CustomersContent />
      </ProtectedRoute>
    </AuthConnectionGuard>
  );
}