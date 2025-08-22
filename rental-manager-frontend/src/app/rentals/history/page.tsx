'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Search,
  Filter,
  SortAsc,
  SortDesc,
  ChevronLeft, 
  ChevronRight,
  Plus,
  X,
  Calendar,
  Package,
  IndianRupee,
  Clock,
  Eye,
  LayoutGrid,
  List
} from 'lucide-react';

import { rentalsApi } from '@/services/api/rentals';

// Search and filter state interface
interface SearchFilters {
  search?: string;
  item_search?: string;
  transaction_number_search?: string;
  date_from?: string;
  date_to?: string;
  rental_start_from?: string;
  rental_start_to?: string;
  rental_end_from?: string;
  rental_end_to?: string;
  status?: string;
  rental_status?: string;
  payment_status?: string;
  location_id?: string;
  category_id?: string;
  amount_from?: number;
  amount_to?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  secondary_sort_by?: string;
  secondary_sort_order?: 'asc' | 'desc';
}

// Sort field options
const SORT_FIELDS = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'updated_at', label: 'Updated Date' },
  { value: 'customer_name', label: 'Customer Name' },
  { value: 'transaction_number', label: 'Transaction Number' },
  { value: 'transaction_date', label: 'Transaction Date' },
  { value: 'rental_start_date', label: 'Rental Start Date' },
  { value: 'rental_end_date', label: 'Rental End Date' },
  { value: 'total_amount', label: 'Total Amount' },
  { value: 'deposit_amount', label: 'Deposit Amount' },
  { value: 'status', label: 'Status' },
  { value: 'rental_status', label: 'Rental Status' },
  { value: 'payment_status', label: 'Payment Status' },
  { value: 'items_count', label: 'Items Count' },
];

// Status options
const TRANSACTION_STATUSES = [
  'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'ON_HOLD', 'IN_PROGRESS'
];

const RENTAL_STATUSES = [
  'RENTAL_IN_PROGRESS', 'RENTAL_COMPLETED', 'RENTAL_LATE', 'RENTAL_EXTENDED', 'ACTIVE', 'RENTAL_PARTIAL_RETURN', 'RENTAL_LATE_PARTIAL_RETURN'
];

const PAYMENT_STATUSES = [
  'PENDING', 'PAID', 'PARTIAL', 'FAILED', 'REFUNDED'
];

function RentalHistoryContent() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Search and filter state
  const [filters, setFilters] = useState<SearchFilters>({
    sort_by: 'created_at',
    sort_order: 'desc',
    secondary_sort_order: 'asc',
  });

  // Build search parameters
  const searchParams = useMemo(() => ({
    skip: (currentPage - 1) * pageSize,
    limit: pageSize,
    include_items: true,
    include_customer: true,
    highlight_search: false,
    ...filters,
  }), [currentPage, pageSize, filters]);

  // Fetch rental data using search endpoint
  const { data: searchResults, isLoading, error, refetch } = useQuery({
    queryKey: ['rental-search', searchParams],
    queryFn: () => rentalsApi.searchRentalTransactions(searchParams),
    keepPreviousData: true,
    staleTime: 30000,
  });

  // Load analytics for summary stats
  const { data: analytics } = useQuery({
    queryKey: ['rental-analytics'],
    queryFn: () => rentalsApi.getRentalAnalytics(),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      sort_by: 'created_at',
      sort_order: 'desc',
      secondary_sort_order: 'asc',
    });
    setCurrentPage(1);
  }, []);

  const handleFiltersChange = useCallback((newFilters: any) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }, []);

  const handleRentalClick = (rental: any) => {
    router.push(`/rentals/${rental.id}`);
  };

  // Count active filters (excluding sort fields)
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => 
    !key.includes('sort') && value !== undefined && value !== '' && value !== null
  ).length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return 'default';
      case 'ACTIVE':
      case 'RENTAL_IN_PROGRESS':
        return 'secondary';
      case 'PENDING':
        return 'outline';
      case 'CANCELLED':
        return 'destructive';
      case 'LATE':
        return 'destructive';
      case 'PAID':
        return 'default';
      case 'PARTIAL':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const rentals = searchResults?.data || [];
  const pagination = searchResults?.pagination;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Rental History
          </h1>
          <p className="text-gray-600">
            View and manage all rental transactions with advanced search and filtering
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/rentals/create-compact')}>
            <Plus className="mr-2 h-4 w-4" />
            New Rental
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.overview?.total_rentals || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analytics?.overview?.active_rentals || 0}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{analytics?.overview?.overdue_rentals || 0}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics?.overview?.total_revenue || 0)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Search & Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} active</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary Search */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customers, items, transaction numbers..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Package className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={filters.item_search || ''}
                onChange={(e) => handleFilterChange('item_search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Advanced Filters
              {showAdvancedFilters ? <X className="w-4 h-4 ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                <X className="w-4 h-4 mr-2" />
                Clear All Filters
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="space-y-4 border-t pt-4">
              {/* Date Filters */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Created From</label>
                  <Input
                    type="date"
                    value={filters.date_from || ''}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Created To</label>
                  <Input
                    type="date"
                    value={filters.date_to || ''}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Rental Start From</label>
                  <Input
                    type="date"
                    value={filters.rental_start_from || ''}
                    onChange={(e) => handleFilterChange('rental_start_from', e.target.value)}
                  />
                </div>
              </div>

              {/* Status Filters */}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Transaction Status</label>
                  <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {TRANSACTION_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Rental Status</label>
                  <Select value={filters.rental_status || 'all'} onValueChange={(value) => handleFilterChange('rental_status', value === 'all' ? undefined : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All rental statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All rental statuses</SelectItem>
                      {RENTAL_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Payment Status</label>
                  <Select value={filters.payment_status || 'all'} onValueChange={(value) => handleFilterChange('payment_status', value === 'all' ? undefined : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All payment statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All payment statuses</SelectItem>
                      {PAYMENT_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Amount Filters */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">Min Amount</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="number"
                      placeholder="0"
                      value={filters.amount_from || ''}
                      onChange={(e) => handleFilterChange('amount_from', e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Max Amount</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="number"
                      placeholder="999999"
                      value={filters.amount_to || ''}
                      onChange={(e) => handleFilterChange('amount_to', e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sorting and Results */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              Rental Transactions ({pagination?.total || 0} total)
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Sorting Controls */}
              <div className="flex items-center gap-2">
                <Select value={filters.sort_by || 'created_at'} onValueChange={(value) => handleFilterChange('sort_by', value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_FIELDS.map(field => (
                      <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange('sort_order', filters.sort_order === 'asc' ? 'desc' : 'asc')}
                >
                  {filters.sort_order === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-center py-8 text-red-600">
              Error loading rentals: {error.toString()}
              <Button onClick={refetch} className="mt-2 ml-2" size="sm" variant="outline">
                Retry
              </Button>
            </div>
          )}
          
          {!isLoading && !error && rentals.length === 0 && (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Package className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No rentals found</h3>
              <p className="text-gray-500 mb-6">
                {activeFilterCount > 0 
                  ? "No rental transactions match your current filters. Try adjusting your search criteria."
                  : "You haven't created any rental transactions yet. Create your first rental to get started."
                }
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => router.push('/rentals/create-compact')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Rental
                </Button>
                {activeFilterCount > 0 && (
                  <Button variant="outline" onClick={handleClearFilters}>
                    <X className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {/* Results Table */}
          {rentals.length > 0 && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Rental Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                        <TableCell><div className="h-4 bg-gray-200 rounded animate-pulse"></div></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    rentals.map((rental) => (
                      <TableRow key={rental.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleRentalClick(rental)}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rental.transaction_number}</div>
                            <div className="text-sm text-gray-500">{formatDate(rental.transaction_date)}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rental.customer.name}</div>
                            {rental.customer.email && (
                              <div className="text-sm text-gray-500">{rental.customer.email}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">{formatDate(rental.rental_period.start_date)} - {formatDate(rental.rental_period.end_date)}</div>
                            <div className="text-sm text-gray-500">{rental.rental_period.duration_days} days</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant={getStatusBadgeVariant(rental.status.transaction_status)}>
                              {rental.status.transaction_status}
                            </Badge>
                            {rental.status.rental_status && (
                              <Badge variant={getStatusBadgeVariant(rental.status.rental_status)} className="text-xs">
                                {rental.status.rental_status}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{formatCurrency(rental.financial.total_amount)}</div>
                            {rental.financial.deposit_amount && (
                              <div className="text-sm text-gray-500">Deposit: {formatCurrency(rental.financial.deposit_amount)}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rental.items.length} item{rental.items.length !== 1 ? 's' : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            handleRentalClick(rental);
                          }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {pagination && pagination.total > 0 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600">
                      Showing {pagination.skip + 1} to {Math.min(pagination.skip + pagination.limit, pagination.total)} of {pagination.total} results
                    </p>
                    <Badge variant="outline" className="text-xs">
                      Page {pagination.page} of {pagination.pages}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={!pagination.has_previous || isLoading}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={!pagination.has_next || isLoading}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RentalHistoryPage() {
  return (
    <ProtectedRoute requiredPermissions={['RENTAL_VIEW']}>
      <RentalHistoryContent />
    </ProtectedRoute>
  );
}