'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Package,
  Clock,
  AlertTriangle,
  TrendingUp,
  Eye,
  RefreshCw,
  PlayCircle,
  ArrowRightLeft,
  FileText,
  History,
  RotateCcw,
  Info,
  MoreVertical,
  ClipboardList
} from 'lucide-react';

import { rentalsApi } from '@/services/api/rentals';
import { useAuthStore } from '@/stores/auth-store';

function ActiveRentalsContent() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<'in_progress' | 'overdue' | 'extended' | 'partial_return' | null>(null);
  const { hasPermission } = useAuthStore();

  // Fetch active rentals with filtering
  const { data: activeRentals, isLoading, error, refetch } = useQuery({
    queryKey: ['active-rentals', currentPage, pageSize, statusFilter],
    queryFn: () => rentalsApi.getActiveRentals({
      skip: (currentPage - 1) * pageSize,
      limit: pageSize,
      ...(statusFilter && { status_filter: statusFilter }),
    }),
    keepPreviousData: true,
    staleTime: 30000, // 30 seconds
  });

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
      case 'RENTAL_INPROGRESS':
        return 'secondary';
      case 'RENTAL_LATE':
      case 'RENTAL_LATE_PARTIAL_RETURN':
        return 'destructive';
      case 'RENTAL_EXTENDED':
        return 'outline';
      case 'RENTAL_PARTIAL_RETURN':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'RENTAL_INPROGRESS':
        return 'In Progress';
      case 'RENTAL_LATE':
        return 'Late';
      case 'RENTAL_EXTENDED':
        return 'Extended';
      case 'RENTAL_PARTIAL_RETURN':
        return 'Partial Return';
      case 'RENTAL_LATE_PARTIAL_RETURN':
        return 'Late Partial Return';
      default:
        return status;
    }
  };

  const handleRentalClick = (rental: any) => {
    router.push(`/rentals/${rental.id}`);
  };

  const rentals = activeRentals?.data || [];
  const summary = activeRentals?.summary;
  const pagination = activeRentals?.pagination;
  
  // Debug logging to understand the issue
  useEffect(() => {
    if (summary) {
      console.log('Active Rentals Summary:', {
        overdue_count: summary.overdue_count,
        aggregated_stats: summary.aggregated_stats,
        status_breakdown: summary.status_breakdown,
        calculated_overdue: summary.aggregated_stats?.overdue ?? summary.overdue_count ?? 0
      });
    }
  }, [summary]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Active Rentals
          </h1>
          <p className="text-gray-600">
            Manage all ongoing rental transactions and track their status
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => router.push('/rentals/create-compact')}>
            <Plus className="mr-2 h-4 w-4" />
            New Rental
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PlayCircle className="w-4 h-4" />
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary?.aggregated_stats?.in_progress ?? ((summary?.status_breakdown?.RENTAL_INPROGRESS || 0) - (summary?.overdue_count || 0))}
              </div>
              <p className="text-xs text-muted-foreground mb-3">Active rentals</p>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  setStatusFilter(statusFilter === 'in_progress' ? null : 'in_progress');
                  setCurrentPage(1);
                }}
              >
                {statusFilter === 'in_progress' ? 'Clear' : 'Show'}
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {summary?.aggregated_stats?.overdue ?? summary?.overdue_count ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mb-3">Need attention</p>
              <Button 
                size="sm" 
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  setStatusFilter(statusFilter === 'overdue' ? null : 'overdue');
                  setCurrentPage(1);
                }}
              >
                {statusFilter === 'overdue' ? 'Clear' : 'Show'}
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Extended
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                {summary?.aggregated_stats?.extended ?? summary?.status_breakdown?.RENTAL_EXTENDED ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mb-3">Extended rentals</p>
              <Button 
                size="sm" 
                className="bg-blue-400 hover:bg-blue-500 text-white"
                onClick={() => {
                  setStatusFilter(statusFilter === 'extended' ? null : 'extended');
                  setCurrentPage(1);
                }}
              >
                {statusFilter === 'extended' ? 'Clear' : 'Show'}
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                Partial Return
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {summary?.aggregated_stats?.partial_return ?? ((summary?.status_breakdown?.RENTAL_PARTIAL_RETURN || 0) + (summary?.status_breakdown?.RENTAL_LATE_PARTIAL_RETURN || 0))}
              </div>
              <p className="text-xs text-muted-foreground mb-3">Partial returns</p>
              <Button 
                size="sm" 
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => {
                  setStatusFilter(statusFilter === 'partial_return' ? null : 'partial_return');
                  setCurrentPage(1);
                }}
              >
                {statusFilter === 'partial_return' ? 'Clear' : 'Show'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Active filter indicator */}
      {statusFilter && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-blue-800">
            Filtering by: <span className="font-semibold">{statusFilter.replace('_', ' ').charAt(0).toUpperCase() + statusFilter.replace('_', ' ').slice(1)}</span>
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setStatusFilter(null);
              setCurrentPage(1);
            }}
          >
            Clear Filter
          </Button>
        </div>
      )}

      {/* Active Rentals Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Active Rental Transactions ({pagination?.total || 0} total)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-center py-8 text-red-600">
              Error loading active rentals: {error.toString()}
              <Button onClick={() => refetch()} className="mt-2 ml-2" size="sm" variant="outline">
                Retry
              </Button>
            </div>
          )}
          
          {!isLoading && !error && rentals.length === 0 && (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Package className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Rentals</h3>
              <p className="text-gray-500 mb-6">
                There are currently no active rental transactions.
              </p>
              <Button onClick={() => router.push('/rentals/create-compact')}>
                <Plus className="w-4 h-4 mr-2" />
                Create New Rental
              </Button>
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
                    <TableHead className="text-center">Quick Actions</TableHead>
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
                            <div className="font-medium">{rental.customer_name}</div>
                            {rental.customer_email && (
                              <div className="text-sm text-gray-500">{rental.customer_email}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {rental.rental_start_date && rental.rental_end_date && (
                              <>
                                <div className="text-sm">{formatDate(rental.rental_start_date)} - {formatDate(rental.rental_end_date)}</div>
                                <div className="text-sm text-gray-500">{rental.rental_period?.duration_days} days</div>
                              </>
                            )}
                            {rental.is_overdue && (
                              <div className="text-sm text-red-600 font-medium">
                                {rental.days_overdue} days overdue
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(rental.rental_status)}>
                            {getStatusLabel(rental.rental_status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{formatCurrency(rental.total_amount)}</div>
                            {rental.deposit_amount > 0 && (
                              <div className="text-sm text-gray-500">Deposit: {formatCurrency(rental.deposit_amount)}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rental.items_count} item{rental.items_count !== 1 ? 's' : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 items-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRentalClick(rental);
                                    }}
                                    className="flex items-center gap-1"
                                  >
                                    <Eye className="w-4 h-4" />
                                    <span className="hidden sm:inline">View</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View rental details</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/rentals/${rental.id}/return`);
                                    }}
                                    className="flex items-center gap-1"
                                    disabled={rental.rental_status === 'RENTAL_COMPLETED'}
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                    <span className="hidden sm:inline">Return</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Process return</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRentalClick(rental);
                                  }}
                                >
                                  <Info className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/rentals/${rental.id}/return`);
                                  }}
                                  disabled={rental.rental_status === 'RENTAL_COMPLETED'}
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Process Return
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/rentals/${rental.id}/extend`);
                                  }}
                                  disabled={rental.rental_status !== 'RENTAL_INPROGRESS'}
                                >
                                  <Clock className="mr-2 h-4 w-4" />
                                  Extend Rental
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/rentals/${rental.id}/invoice`);
                                  }}
                                >
                                  <ClipboardList className="mr-2 h-4 w-4" />
                                  View Invoice
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/rentals/${rental.id}/history`);
                                  }}
                                >
                                  <History className="mr-2 h-4 w-4" />
                                  View History
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={currentPage === 1 || isLoading}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={pagination.skip + pagination.limit >= pagination.total || isLoading}
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

export default function ActiveRentalsPage() {
  return (
    <ProtectedRoute requiredPermissions={['RENTAL_VIEW']}>
      <ActiveRentalsContent />
    </ProtectedRoute>
  );
}