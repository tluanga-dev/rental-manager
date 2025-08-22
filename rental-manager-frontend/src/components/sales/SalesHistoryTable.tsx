'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { 
  MoreHorizontal, 
  Eye, 
  FileText, 
  Calendar,
  User,
  IndianRupee,
  Search,
  Filter,
  Download,
  RefreshCw,
  X
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { cn } from '@/lib/utils';
import type { 
  SaleTransaction, 
  SaleFilters, 
  SaleTransactionStatus, 
  SalePaymentStatus 
} from '@/types/sales';
import { SALE_TRANSACTION_STATUSES, SALE_PAYMENT_STATUSES } from '@/types/sales';

interface SalesHistoryTableProps {
  transactions: SaleTransaction[];
  isLoading: boolean;
  error?: string | null;
  filters?: SaleFilters;
  onFiltersChange?: (filters: SaleFilters) => void;
  onRefresh?: () => void;
  total?: number;
  showFilters?: boolean;
  compact?: boolean;
  className?: string;
}

export function SalesHistoryTable({ 
  transactions,
  isLoading,
  error,
  filters = {},
  onFiltersChange,
  onRefresh,
  total,
  showFilters = true,
  compact = false,
  className
}: SalesHistoryTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(filters.search || '');

  const handleFilterChange = (key: keyof SaleFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    if (key !== 'search') {
      newFilters.skip = 0; // Reset pagination when changing filters
    }
    onFiltersChange?.(newFilters);
  };

  const handleSearch = () => {
    handleFilterChange('search', searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    handleFilterChange('search', '');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleViewTransaction = (transaction: SaleTransaction) => {
    router.push(`/sales/${transaction.id}`);
  };

  const handlePrintReceipt = async (transaction: SaleTransaction) => {
    try {
      // Import the print service and document component dynamically
      const { printService } = await import('@/services/print-service');
      const { SalePrintDocument } = await import('@/components/printing/SalePrintDocument');
      
      // Convert transaction to the expected format
      const transactionWithLines = {
        ...transaction,
        lines: transaction.lines || []
      };
      
      // Generate professional receipt using the print document component
      const { documentContent } = SalePrintDocument({
        transaction: transactionWithLines,
        documentType: 'receipt'
      });
      
      // Print using the centralized service
      await printService.printSale(
        transaction.transaction_number || transaction.id,
        documentContent,
        {
          paperSize: 'A4',
          includeHeader: true,
          includeFooter: true,
        }
      );
    } catch (error) {
      console.error('Failed to print receipt:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusBadge = (status: string, type: 'transaction' | 'payment') => {
    const statusConfig = type === 'transaction' 
      ? SALE_TRANSACTION_STATUSES.find(s => s.value === status)
      : SALE_PAYMENT_STATUSES.find(s => s.value === status);

    if (!statusConfig) {
      return (
        <Badge variant="secondary" className="font-medium px-3 py-1">
          {status}
        </Badge>
      );
    }

    const variant = statusConfig.color === 'green' ? 'default' : 
                   statusConfig.color === 'red' ? 'destructive' :
                   statusConfig.color === 'yellow' ? 'secondary' : 'outline';

    return (
      <Badge 
        variant={variant} 
        className={cn(
          "font-medium px-3 py-1 text-xs",
          statusConfig.color === 'green' && "bg-green-100 text-green-800 border-green-200",
          statusConfig.color === 'red' && "bg-red-100 text-red-800 border-red-200",
          statusConfig.color === 'yellow' && "bg-yellow-100 text-yellow-800 border-yellow-200",
          statusConfig.color === 'blue' && "bg-slate-100 text-slate-800 border-slate-200",
          statusConfig.color === 'gray' && "bg-gray-100 text-gray-800 border-gray-200"
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
          Failed to load sales history: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      {showFilters && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold">Sales History</CardTitle>
                <CardDescription className="text-base">
                  View and manage all sales transactions
                  {total && ` (${total} total)`}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" className="font-medium">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={() => router.push('/sales/new')} size="sm" className="font-medium">
                  <IndianRupee className="h-4 w-4 mr-2" />
                  New Sale
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10 pr-10"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearch}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Status Filter */}
              <Select 
                value={filters.status || 'all'} 
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {SALE_TRANSACTION_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Range - From */}
              <Input
                type="date"
                placeholder="From date"
                value={filters.date_from || ''}
                onChange={(e) => handleFilterChange('date_from', e.target.value || undefined)}
              />

              {/* Date Range - To */}
              <Input
                type="date"
                placeholder="To date"
                value={filters.date_to || ''}
                onChange={(e) => handleFilterChange('date_to', e.target.value || undefined)}
              />
            </div>

            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
                {onRefresh && (
                  <Button variant="outline" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                )}
              </div>
              
              {/* Clear Filters */}
              {(filters.search || filters.status || filters.date_from || filters.date_to) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    onFiltersChange?.({});
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto bg-white">
            <Table className="bg-white">
              <TableHeader>
                <TableRow className="border-b border-border/50 bg-gray-50">
                  <TableHead className="font-semibold text-foreground px-4 py-3 bg-gray-50">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Date</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 bg-gray-50">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>Transaction #</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 bg-gray-50">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Customer</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 text-right bg-gray-50">
                    <div className="flex items-center justify-end space-x-2">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      <span>Amount</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 bg-gray-50">Status</TableHead>
                  <TableHead className="font-semibold text-foreground px-4 py-3 bg-gray-50">Payment</TableHead>
                  <TableHead className="w-[50px] px-4 py-3 bg-gray-50">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {isLoading ? (
                  // Loading rows
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow 
                      key={index} 
                      className={cn(
                        "border-b border-border/30",
                        index % 2 === 0 ? "bg-white" : "bg-green-50/20"
                      )}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="animate-pulse bg-gray-200 h-4 w-20 rounded"></div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="animate-pulse bg-gray-200 h-4 w-24 rounded"></div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="animate-pulse bg-gray-200 h-4 w-16 rounded ml-auto"></div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="animate-pulse bg-gray-200 h-5 w-20 rounded"></div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="animate-pulse bg-gray-200 h-5 w-16 rounded"></div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="animate-pulse bg-gray-200 h-8 w-8 rounded"></div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-12 w-12 text-gray-400" />
                        <p className="text-gray-500 font-medium">No sales transactions found</p>
                        {(filters.search || filters.status || filters.date_from || filters.date_to) ? (
                          <p className="text-sm text-gray-400">
                            Try adjusting your search criteria
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">
                            Create your first sale to get started
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction, index) => (
                    <TableRow 
                      key={transaction.id} 
                      className={cn(
                        "group cursor-pointer hover:bg-green-100/50 transition-colors duration-200 border-b border-border/30 last:border-b-0",
                        index % 2 === 0 ? "bg-white" : "bg-green-50/20"
                      )}
                      onClick={() => handleViewTransaction(transaction)}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="text-sm font-medium">
                          {format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(transaction.created_at), 'HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="font-mono text-sm font-medium text-slate-600">
                          {transaction.transaction_number}
                        </div>
                        {transaction.reference_number && (
                          <div className="text-xs text-gray-500">
                            Ref: {transaction.reference_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="text-sm font-medium">
                          {transaction.customer_name}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="text-sm font-bold">
                          {formatCurrency(transaction.total_amount)}
                        </div>
                        {transaction.subtotal !== transaction.total_amount && (
                          <div className="text-xs text-gray-500">
                            Subtotal: {formatCurrency(transaction.subtotal)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {getStatusBadge(transaction.status, 'transaction')}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {getStatusBadge(transaction.payment_status, 'payment')}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewTransaction(transaction);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintReceipt(transaction);
                              }}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Print Receipt
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

      {/* Pagination - placeholder for future implementation */}
      {!isLoading && transactions.length > 0 && total && total > (filters.limit || 100) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((filters.skip || 0) + 1)} to {Math.min((filters.skip || 0) + (filters.limit || 100), total)} of {total} transactions
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={(filters.skip || 0) === 0}
                  onClick={() => handleFilterChange('skip', Math.max(0, (filters.skip || 0) - (filters.limit || 100)))}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={(filters.skip || 0) + (filters.limit || 100) >= total}
                  onClick={() => handleFilterChange('skip', (filters.skip || 0) + (filters.limit || 100))}
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