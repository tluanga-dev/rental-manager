'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  FileText, 
  User, 
  IndianRupee, 
  Package, 
  MoreHorizontal,
  Download,
  RefreshCw,
  XCircle,
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

import { cn } from '@/lib/utils';
import type { SaleTransactionWithLines } from '@/types/sales';
import { SALE_TRANSACTION_STATUSES, SALE_PAYMENT_STATUSES } from '@/types/sales';

interface SaleDetailViewProps {
  transaction: SaleTransactionWithLines;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onBack?: () => void;
  onPrint?: () => void;
  onCancel?: () => void;
  onRefund?: () => void;
  className?: string;
}

export function SaleDetailView({
  transaction,
  isLoading = false,
  error,
  onRefresh,
  onBack,
  onPrint,
  onCancel,
  onRefund,
  className
}: SaleDetailViewProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

    const Icon = statusConfig.color === 'green' ? CheckCircle :
                 statusConfig.color === 'red' ? XCircle :
                 statusConfig.color === 'yellow' ? AlertTriangle :
                 FileText;

    return (
      <Badge 
        variant={variant} 
        className={cn(
          "font-medium px-3 py-1 text-sm flex items-center gap-2",
          statusConfig.color === 'green' && "bg-green-100 text-green-800 border-green-200",
          statusConfig.color === 'red' && "bg-red-100 text-red-800 border-red-200",
          statusConfig.color === 'yellow' && "bg-yellow-100 text-yellow-800 border-yellow-200",
          statusConfig.color === 'blue' && "bg-slate-100 text-slate-800 border-slate-200",
          statusConfig.color === 'gray' && "bg-gray-100 text-gray-800 border-gray-200"
        )}
      >
        <Icon className="h-3 w-3" />
        {statusConfig.label}
      </Badge>
    );
  };

  const handleAction = async (action: string, callback?: () => void) => {
    setActionLoading(action);
    try {
      await callback?.();
    } finally {
      setActionLoading(null);
    }
  };

  const canCancel = transaction.status === 'PENDING' || transaction.status === 'COMPLETED';
  const canRefund = transaction.status === 'COMPLETED' && transaction.payment_status === 'PAID';

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load transaction details: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Loading skeleton */}
        <div className="animate-pulse space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-64 bg-gray-200 rounded"></div>
              <div className="h-4 w-48 bg-gray-200 rounded"></div>
            </div>
            <div className="h-10 w-32 bg-gray-200 rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <div>
              <h1 className="text-3xl font-bold">Sale Details</h1>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-muted-foreground">
                  Transaction #{transaction.transaction_number}
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => copyToClipboard(transaction.transaction_number)}
                  className="h-6 px-2 text-xs"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="h-4 w-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onPrint && (
                <DropdownMenuItem onClick={() => handleAction('print', onPrint)}>
                  <Download className="h-4 w-4 mr-2" />
                  {actionLoading === 'print' ? 'Generating...' : 'Download Receipt'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => copyToClipboard(transaction.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Transaction ID
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyToClipboard(JSON.stringify(transaction, null, 2))}>
                <Eye className="h-4 w-4 mr-2" />
                Copy Transaction Data
              </DropdownMenuItem>
              {canRefund && onRefund && (
                <DropdownMenuItem onClick={() => handleAction('refund', onRefund)}>
                  <IndianRupee className="h-4 w-4 mr-2" />
                  {actionLoading === 'refund' ? 'Processing...' : 'Process Refund'}
                </DropdownMenuItem>
              )}
              {canCancel && onCancel && (
                <DropdownMenuItem 
                  onClick={() => handleAction('cancel', onCancel)}
                  className="text-red-600"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel Transaction'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Transaction Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transaction Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transaction Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Transaction Number</label>
                <p className="font-mono text-sm font-bold text-slate-600">{transaction.transaction_number}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <div className="mt-1">
                  {getStatusBadge(transaction.status, 'transaction')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Transaction Date</label>
                <p className="text-sm font-medium">{format(new Date(transaction.transaction_date), 'PPP')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Created</label>
                <p className="text-sm font-medium">{format(new Date(transaction.created_at), 'PPP p')}</p>
              </div>
            </div>

            {transaction.reference_number && (
              <div>
                <label className="text-sm font-medium text-gray-600">Reference Number</label>
                <p className="text-sm font-medium">{transaction.reference_number}</p>
              </div>
            )}

            {transaction.notes && (
              <div>
                <label className="text-sm font-medium text-gray-600">Notes</label>
                <p className="text-sm">{transaction.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer & Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer & Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Customer</label>
              <p className="text-sm font-medium">{transaction.customer_name}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Payment Status</label>
              <div className="mt-1">
                {getStatusBadge(transaction.payment_status, 'payment')}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Subtotal:</span>
                <span className="text-sm font-medium">{formatCurrency(transaction.subtotal)}</span>
              </div>
              
              {transaction.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tax:</span>
                  <span className="text-sm font-medium">{formatCurrency(transaction.tax_amount)}</span>
                </div>
              )}
              
              {transaction.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Discount:</span>
                  <span className="text-sm font-medium text-red-600">-{formatCurrency(transaction.discount_amount)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-lg font-bold text-gray-900">Total Amount:</span>
                <span className="text-2xl font-bold text-green-600">{formatCurrency(transaction.total_amount)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Amount Paid:</span>
                <span className="text-sm font-medium">{formatCurrency(transaction.paid_amount)}</span>
              </div>

              {transaction.balance_due && transaction.balance_due > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Balance Due:</span>
                  <span className="text-sm font-medium text-red-600">{formatCurrency(transaction.balance_due)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transaction Items ({transaction.transaction_lines?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transaction.transaction_lines && transaction.transaction_lines.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Tax Rate</TableHead>
                    <TableHead className="text-right">Tax Amount</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transaction.transaction_lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{line.item_name}</div>
                          <div className="text-sm text-gray-500">SKU: {line.item_sku}</div>
                          {line.description && (
                            <div className="text-sm text-gray-500">{line.description}</div>
                          )}
                          {line.notes && (
                            <div className="text-xs text-gray-400 mt-1">{line.notes}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{line.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.unit_price)}</TableCell>
                      <TableCell className="text-right">{line.tax_rate}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(line.tax_amount)}</TableCell>
                      <TableCell className="text-right">
                        {line.discount_amount > 0 ? (
                          <span className="text-red-600">-{formatCurrency(line.discount_amount)}</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(line.line_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No items found for this transaction</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600">System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created At</label>
              <p className="mt-1">{format(new Date(transaction.created_at), 'PPP p')}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Updated</label>
              <p className="mt-1">{format(new Date(transaction.updated_at), 'PPP p')}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transaction ID</label>
              <p className="mt-1 font-mono text-xs">{transaction.id}</p>
            </div>
            {transaction.created_by && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created By</label>
                <p className="mt-1">{transaction.created_by}</p>
              </div>
            )}
            {transaction.updated_by && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Updated By</label>
                <p className="mt-1">{transaction.updated_by}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}