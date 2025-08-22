'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { 
  MoreHorizontal, 
  Eye, 
  RotateCcw, 
  FileText, 
  Calendar,
  Building2,
  Package,
  IndianRupee,
  Search,
  Filter,
  Download
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { usePurchases } from '@/hooks/use-purchases';
import { cn } from '@/lib/utils';
import type { Purchase, PurchaseFilters, PurchaseStatus } from '@/types/purchases';
import { PURCHASE_STATUSES, PAYMENT_STATUSES } from '@/types/purchases';

interface PurchaseHistoryTableProps {
  filters?: PurchaseFilters;
  onFiltersChange?: (filters: PurchaseFilters) => void;
  showFilters?: boolean;
  compact?: boolean;
}

export function PurchaseHistoryTable({ 
  filters: externalFilters, 
  onFiltersChange,
  showFilters = true,
  compact = false 
}: PurchaseHistoryTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(externalFilters?.search || '');

  const {
    purchases,
    total,
    isLoading,
    error,
    filters,
    updateFilters,
    resetFilters
  } = usePurchases(externalFilters);

  const handleFilterChange = (newFilters: Partial<PurchaseFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    updateFilters(newFilters);
    onFiltersChange?.(updatedFilters);
  };

  const handleSearch = () => {
    handleFilterChange({ search: searchTerm, skip: 0 });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    resetFilters();
    onFiltersChange?.({});
  };

  const handleViewPurchase = (purchase: Purchase) => {
    router.push(`/purchases/history/${purchase.id}`);
  };

  const handleCreateReturn = (purchase: Purchase) => {
    router.push(`/purchases/returns/new?purchase_id=${purchase.id}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getStatusBadge = (status: string, type: 'purchase' | 'payment') => {
    const statusConfig = type === 'purchase' 
      ? PURCHASE_STATUSES.find(s => s.value === status)
      : PAYMENT_STATUSES.find(s => s.value === status);

    if (!statusConfig) return (
      <Badge variant="secondary" className="font-medium px-3 py-1">
        {status}
      </Badge>
    );

    const variant = statusConfig.color === 'green' ? 'default' : 
                   statusConfig.color === 'red' ? 'destructive' :
                   statusConfig.color === 'yellow' ? 'secondary' : 'outline';

    return (
      <Badge 
        variant={variant} 
        className={cn(
          "font-medium px-3 py-1 text-xs",
          statusConfig.color === 'green' && "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
          statusConfig.color === 'red' && "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
          statusConfig.color === 'yellow' && "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800"
        )}
      >
        {statusConfig.label}
      </Badge>
    );
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load purchase history. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold">Purchase History</CardTitle>
                <CardDescription className="text-base">
                  View and manage all recorded purchases
                </CardDescription>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" className="font-medium">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={() => router.push('/purchases/record')} size="sm" className="font-medium">
                  <Package className="h-4 w-4 mr-2" />
                  Record Purchase
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search purchases..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 font-medium"
                  />
                </div>
                <Button onClick={handleSearch} size="sm" className="font-medium">
                  Search
                </Button>
              </div>

              <Select
                value={filters.status || ''}
                onValueChange={(value) => handleFilterChange({ 
                  status: value as PurchaseStatus || undefined, 
                  skip: 0 
                })}
              >
                <SelectTrigger className="font-medium">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {PURCHASE_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="Start date"
                value={filters.start_date || ''}
                onChange={(e) => handleFilterChange({ 
                  start_date: e.target.value || undefined,
                  skip: 0 
                })}
                className="font-medium"
              />

              <Input
                type="date"
                placeholder="End date"
                value={filters.end_date || ''}
                onChange={(e) => handleFilterChange({ 
                  end_date: e.target.value || undefined,
                  skip: 0 
                })}
                className="font-medium"
              />
            </div>

            {(filters.search || filters.status || filters.start_date || filters.end_date) && (
              <div className="flex items-center justify-between bg-muted/30 px-4 py-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-primary rounded-full" />
                  <span className="text-sm font-semibold text-foreground">
                    {total} purchase{total !== 1 ? 's' : ''} found
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="font-medium">
                  Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
        <CardContent className="p-0">
          <div className="overflow-x-auto bg-white dark:bg-gray-900">
            <Table className="bg-white dark:bg-gray-900">
              <TableHeader>
                <TableRow className="border-b border-border/50 bg-gray-50 dark:bg-gray-800">
                  <TableHead className="font-semibold text-foreground px-4 py-3 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Purchase Date</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>Reference</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Supplier</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 text-right bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-end space-x-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>Items</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 text-right bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-end space-x-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>Amount</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 bg-gray-50 dark:bg-gray-800">Status</TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 bg-gray-50 dark:bg-gray-800">Payment</TableHead>
                  <TableHead className="w-[50px] px-4 py-3 bg-gray-50 dark:bg-gray-800"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white dark:bg-gray-900">
                {isLoading ? (
                  // Loading rows
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow 
                      key={index} 
                      className={cn(
                        "border-b border-border/30",
                        index % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-green-50 dark:bg-green-950/20"
                      )}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="h-3 bg-muted/60 animate-pulse rounded-md" />
                          <div className="h-2 bg-muted/40 animate-pulse rounded-md w-12" />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="h-3 bg-muted/60 animate-pulse rounded-md w-20" />
                          <div className="h-2 bg-muted/40 animate-pulse rounded-md w-16" />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="h-3 bg-muted/60 animate-pulse rounded-md w-28" />
                          <div className="h-2 bg-muted/40 animate-pulse rounded-md w-12" />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col items-end space-y-1">
                          <div className="h-3 bg-muted/60 animate-pulse rounded-md w-6" />
                          <div className="h-2 bg-muted/40 animate-pulse rounded-md w-10" />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex justify-end">
                          <div className="h-3 bg-muted/60 animate-pulse rounded-md w-16" />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="h-5 bg-muted/60 animate-pulse rounded-full w-16" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="h-5 bg-muted/60 animate-pulse rounded-full w-12" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="h-6 bg-muted/60 animate-pulse rounded-md w-6" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : purchases.length === 0 ? (
                  <TableRow className="bg-white dark:bg-gray-900">
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="p-4 bg-muted/30 rounded-full">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-medium text-foreground">
                            {filters.search || filters.status ? 'No purchases found' : 'No purchases recorded yet'}
                          </p>
                          <p className="text-sm text-muted-foreground max-w-md">
                            {filters.search || filters.status 
                              ? 'Try adjusting your search criteria or filters to find what you\'re looking for.' 
                              : 'Get started by recording your first purchase transaction.'
                            }
                          </p>
                        </div>
                        {!filters.search && !filters.status && (
                          <Button onClick={() => router.push('/purchases/record')} size="default" className="mt-4">
                            <Package className="h-4 w-4 mr-2" />
                            Record your first purchase
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  purchases.map((purchase, index) => (
                    <TableRow 
                      key={purchase.id} 
                      className={cn(
                        "group cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors duration-200 border-b border-border/30 last:border-b-0",
                        index % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-green-50 dark:bg-green-950/20"
                      )}
                      onClick={() => handleViewPurchase(purchase)}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col space-y-0.5">
                          <span className="font-semibold text-sm text-foreground">
                            {format(new Date(purchase.purchase_date), 'MMM dd, yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {format(new Date(purchase.created_at), 'HH:mm')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col space-y-0.5">
                          {purchase.reference_number ? (
                            <span className="font-semibold text-sm text-foreground">{purchase.reference_number}</span>
                          ) : (
                            <span className="text-muted-foreground font-medium text-sm">—</span>
                          )}
                          <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded w-fit">
                            {purchase.id.slice(0, 8)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col space-y-0.5">
                          <span className="font-semibold text-sm text-foreground">
                            {purchase.supplier?.display_name || purchase.supplier_id}
                          </span>
                          {purchase.supplier?.supplier_code && (
                            <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded w-fit">
                              {purchase.supplier.supplier_code}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col items-end space-y-0.5">
                          <span className="font-bold text-base text-foreground">{purchase.total_items}</span>
                          <span className="text-xs text-muted-foreground font-medium">
                            {(purchase.items || purchase.lines || []).length} line{(purchase.items || purchase.lines || []).length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="text-right">
                          <span className="font-bold text-base text-foreground">
                            {formatCurrency(purchase.total_amount)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex justify-start">
                          {getStatusBadge(purchase.status, 'purchase')}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex justify-start">
                          {getStatusBadge(purchase.payment_status, 'payment')}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-muted/60 h-6 w-6 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleViewPurchase(purchase)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {purchase.status === 'COMPLETED' && (
                              <DropdownMenuItem onClick={() => handleCreateReturn(purchase)}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Create Return
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <FileText className="h-4 w-4 mr-2" />
                              Export Receipt
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > (filters.limit || 20) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-foreground">
                  Showing {(filters.skip || 0) + 1} to {Math.min((filters.skip || 0) + (filters.limit || 20), total)} of {total} purchases
                </span>
                <div className="h-4 w-px bg-border" />
                <span className="text-sm text-muted-foreground">
                  {Math.ceil(total / (filters.limit || 20))} pages
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange({ skip: Math.max(0, (filters.skip || 0) - (filters.limit || 20)) })}
                  disabled={!filters.skip || filters.skip === 0}
                  className="font-medium"
                >
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  <span className="text-sm text-muted-foreground">Page</span>
                  <span className="text-sm font-bold text-foreground bg-muted/50 px-2 py-1 rounded-md">
                    {Math.floor((filters.skip || 0) / (filters.limit || 20)) + 1}
                  </span>
                  <span className="text-sm text-muted-foreground">of {Math.ceil(total / (filters.limit || 20))}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFilterChange({ skip: (filters.skip || 0) + (filters.limit || 20) })}
                  disabled={!purchases.length || purchases.length < (filters.limit || 20)}
                  className="font-medium"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}