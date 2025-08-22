'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { 
  Plus, 
  MoreHorizontal, 
  Eye, 
  FileText, 
  Search,
  Filter,
  Download,
  RotateCcw
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { usePurchaseReturns } from '@/hooks/use-purchases';
import type { PurchaseReturnFilters } from '@/types/purchases';
import { RETURN_STATUSES, PAYMENT_STATUSES, RETURN_REASONS } from '@/types/purchases';

export default function PurchaseReturnsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const {
    returns,
    total,
    isLoading,
    error,
    filters,
    updateFilters,
    resetFilters
  } = usePurchaseReturns();

  const handleFilterChange = (newFilters: Partial<PurchaseReturnFilters>) => {
    updateFilters({ ...newFilters, skip: 0 });
  };

  const handleSearch = () => {
    handleFilterChange({ search: searchTerm });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    resetFilters();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getStatusBadge = (status: string, type: 'return' | 'payment') => {
    const statusConfig = type === 'return' 
      ? RETURN_STATUSES.find(s => s.value === status)
      : PAYMENT_STATUSES.find(s => s.value === status);

    if (!statusConfig) return <Badge variant="secondary">{status}</Badge>;

    const variant = statusConfig.color === 'green' ? 'default' : 
                   statusConfig.color === 'red' ? 'destructive' :
                   statusConfig.color === 'blue' ? 'secondary' : 'outline';

    return <Badge variant={variant}>{statusConfig.label}</Badge>;
  };

  const getReasonBadge = (reason: string) => {
    const reasonConfig = RETURN_REASONS.find(r => r.value === reason);
    const color = reason === 'DEFECTIVE' ? 'destructive' :
                  reason === 'WRONG_ITEM' ? 'secondary' :
                  reason === 'QUALITY_ISSUE' ? 'destructive' : 'outline';
    
    return <Badge variant={color}>{reasonConfig?.label || reason}</Badge>;
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load purchase returns. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Purchase Returns</CardTitle>
              <CardDescription>
                View and manage all purchase returns
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button onClick={() => router.push('/purchases/returns/new')}>
                <RotateCcw className="h-4 w-4 mr-1" />
                New Return
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Search returns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <Select
              value={filters.status || ''}
              onValueChange={(value) => handleFilterChange({ 
                status: (value as any) || undefined 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {RETURN_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.return_reason || ''}
              onValueChange={(value) => handleFilterChange({ 
                return_reason: (value as any) || undefined 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reasons</SelectItem>
                {RETURN_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="Start date"
              value={filters.start_date || ''}
              onChange={(e) => handleFilterChange({ 
                start_date: e.target.value || undefined 
              })}
            />

            <Input
              type="date"
              placeholder="End date"
              value={filters.end_date || ''}
              onChange={(e) => handleFilterChange({ 
                end_date: e.target.value || undefined 
              })}
            />
          </div>

          {(filters.search || filters.status || filters.return_reason || filters.start_date || filters.end_date) && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} return{total !== 1 ? 's' : ''} found
              </p>
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return Date</TableHead>
                  <TableHead>Original Purchase</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Refund Amount</TableHead>
                  <TableHead>Primary Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading rows
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 8 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <div className="h-4 bg-muted animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : returns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center space-y-2">
                        <RotateCcw className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {filters.search || filters.status ? 'No returns found matching your criteria' : 'No purchase returns recorded yet'}
                        </p>
                        {!filters.search && !filters.status && (
                          <Button onClick={() => router.push('/purchases/returns/new')} size="sm">
                            Create your first return
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  returns.map((returnRecord: any) => (
                    <TableRow 
                      key={returnRecord.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/purchases/returns/${returnRecord.id}`)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(new Date(returnRecord.return_date), 'MMM dd, yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(returnRecord.created_at), 'HH:mm')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {returnRecord.original_purchase?.reference_number || 
                             `#${returnRecord.original_purchase_id.slice(0, 8)}`}
                          </span>
                          {returnRecord.original_purchase && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(returnRecord.original_purchase.purchase_date), 'MMM dd, yyyy')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {returnRecord.supplier?.display_name || returnRecord.supplier_id}
                          </span>
                          {returnRecord.supplier?.supplier_code && (
                            <span className="text-xs text-muted-foreground">
                              {returnRecord.supplier.supplier_code}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-medium">{returnRecord.total_items}</span>
                          <span className="text-xs text-muted-foreground">
                            {returnRecord.items.length} line{returnRecord.items.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">
                          {formatCurrency(returnRecord.refund_amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {returnRecord.items.length > 0 && 
                         getReasonBadge(returnRecord.items[0].return_reason)
                        }
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(returnRecord.status, 'return')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/purchases/returns/${returnRecord.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="h-4 w-4 mr-2" />
                              Export Return
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(filters.skip || 0) + 1} to {Math.min((filters.skip || 0) + (filters.limit || 20), total)} of {total} returns
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilters({ skip: Math.max(0, (filters.skip || 0) - (filters.limit || 20)) })}
              disabled={!filters.skip || filters.skip === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateFilters({ skip: (filters.skip || 0) + (filters.limit || 20) })}
              disabled={!returns.length || returns.length < (filters.limit || 20)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}