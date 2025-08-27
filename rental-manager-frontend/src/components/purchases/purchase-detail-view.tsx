'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Package, 
  Building2, 
  Calendar,
  FileText,
  RotateCcw,
  Download,
  Edit,
  MoreHorizontal,
  MapPin,
  Hash,
  Printer
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { usePurchase, usePurchaseReturnsByPurchase } from '@/hooks/use-purchases';
import { useCompanyProfileWithDefaults } from '@/hooks/use-company-profile';
import { cn } from '@/lib/utils';
import type { PurchaseResponse } from '@/services/api/purchases';
import { PurchasePrintDocument } from './PurchasePrintDocument';
import { IndividualItemTrackingTab } from './IndividualItemTrackingTab';

interface PurchaseDetailViewProps {
  purchaseId: string;
  onEdit?: (purchase: PurchaseResponse) => void;
  onCreateReturn?: (purchase: PurchaseResponse) => void;
}

export function PurchaseDetailView({ 
  purchaseId, 
  onEdit, 
  onCreateReturn 
}: PurchaseDetailViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'items' | 'tracking' | 'returns'>('items');

  const { 
    data: purchase, 
    isLoading: loadingPurchase, 
    error: purchaseError 
  } = usePurchase(purchaseId);

  const { 
    data: returnsData, 
    isLoading: loadingReturns 
  } = usePurchaseReturnsByPurchase(purchaseId);

  const companyProfile = useCompanyProfileWithDefaults();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    
    const colorMap: Record<string, string> = {
      // Purchase statuses
      'COMPLETED': 'default',
      'CANCELLED': 'destructive',
      'PARTIALLY_RETURNED': 'secondary',
      // Payment statuses
      'PAID': 'default',
      'PENDING': 'secondary',
      'PARTIAL': 'outline',
      'FAILED': 'destructive',
      'REFUNDED': 'secondary'
    };

    const labelMap: Record<string, string> = {
      'PAID': 'Paid',
      'PENDING': 'Pending',
      'PARTIAL': 'Partial',
      'FAILED': 'Failed',
      'REFUNDED': 'Refunded',
      'COMPLETED': 'Completed',
      'CANCELLED': 'Cancelled',
      'PARTIALLY_RETURNED': 'Partially Returned'
    };

    const variant = colorMap[status] || 'outline';
    const label = labelMap[status] || status;
    return <Badge variant={variant as any}>{label}</Badge>;
  };

  const getConditionBadge = (condition: string) => {
    const colorMap: Record<string, string> = {
      'A': 'default',
      'B': 'secondary',
      'C': 'outline',
      'D': 'destructive'
    };

    const variant = colorMap[condition] || 'outline';
    return <Badge variant={variant as any}>{condition}</Badge>;
  };

  const handleCreateReturn = () => {
    if (purchase && onCreateReturn) {
      onCreateReturn(purchase);
    } else if (purchase) {
      router.push(`/purchases/returns/new?purchase_id=${purchase.id}`);
    }
  };

  const handlePrint = async () => {
    if (!purchase) return;

    try {
      // Import the print service for centralized printing
      const { printService } = await import('@/services/print-service');
      
      // Use the print service to handle the purchase printing
      await printService.printPurchase(
        purchase.reference_number || purchase.id,
        purchase,
        companyProfile,
        {
          paperSize: 'A4',
          includeHeader: true,
          includeFooter: true,
        }
      );
    } catch (error) {
      console.error('Failed to print purchase:', error);
      // Fallback to manual printing if print service fails
      const { documentContent } = PurchasePrintDocument({ 
        purchase,
        companyInfo: companyProfile
      });

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(documentContent);
        printWindow.document.close();
        
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
          printWindow.onafterprint = () => printWindow.close();
        };
      }
    }
  };

  const handleEdit = () => {
    if (purchase && onEdit) {
      onCreateReturn(purchase);
    }
  };

  if (loadingPurchase) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-48 bg-muted animate-pulse rounded" />
          <div className="h-48 bg-muted animate-pulse rounded" />
          <div className="h-48 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (purchaseError || !purchase) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load purchase details. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const returns = returnsData?.items || [];
  const totalReturned = returns.reduce((sum, ret) => sum + ret.total_items, 0);
  const totalRefunded = returns.reduce((sum, ret) => sum + ret.refund_amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="-ml-2 no-print"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Purchase {purchase.reference_number || `#${purchase.id.slice(0, 8)}`}
            </h1>
            <p className="text-muted-foreground">
              Recorded on {(() => {
                try {
                  const dateValue = purchase.purchase_date || purchase.transaction_date;
                  if (!dateValue) return 'Date not available';
                  const date = new Date(dateValue);
                  if (isNaN(date.getTime())) return 'Date not available';
                  return format(date, 'MMMM dd, yyyy');
                } catch {
                  return 'Date not available';
                }
              })()}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 no-print">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          {purchase.status === 'COMPLETED' && (
            <Button onClick={handleCreateReturn}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Create Return
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Purchase
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FileText className="h-4 w-4 mr-2" />
                Print Receipt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block mb-6">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold">Purchase Order</h1>
          <p className="text-gray-600">{companyProfile?.company_name || 'Your Company Name'}</p>
          <p className="text-sm text-gray-500">
            {companyProfile?.company_address?.replace(/\n/g, ', ') || '123 Business Street'}
          </p>
          <p className="text-sm text-gray-500">
            Phone: {companyProfile?.company_phone || '(555) 123-4567'} | 
            Email: {companyProfile?.company_email || 'info@yourcompany.com'}
          </p>
        </div>
        <div className="border-t border-b py-2 my-4">
          <div className="flex justify-between">
            <div>
              <p className="font-semibold">Purchase Order #: {purchase.reference_number || purchase.id}</p>
              <p className="text-sm">Date: {(() => {
                try {
                  const dateValue = purchase.purchase_date || purchase.transaction_date;
                  if (!dateValue) return 'Date not available';
                  const date = new Date(dateValue);
                  if (isNaN(date.getTime())) return 'Date not available';
                  return format(date, 'MMMM dd, yyyy');
                } catch {
                  return 'Date not available';
                }
              })()}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">Status: {purchase.status}</p>
              <p className="text-sm">Payment: {purchase.payment_status || 'Pending'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(purchase.total_amount)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Items Count</p>
              <p className="text-xl font-bold">{purchase.total_items}</p>
              <p className="text-xs text-muted-foreground">
                {purchase.items?.length || 0} line{purchase.items?.length !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Returns</p>
              <p className="text-xl font-bold">{returns.length}</p>
              <p className="text-xs text-muted-foreground">
                {totalReturned} items returned
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Refunded</p>
              <p className="text-xl font-bold">{formatCurrency(totalRefunded)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              {getStatusBadge(purchase.status)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Breakdown - New Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Financial Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(purchase.subtotal || 0)}</span>
            </div>
            
            {purchase.discount_amount > 0 && (
              <div className="flex justify-between items-center text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(purchase.discount_amount)}</span>
              </div>
            )}
            
            {purchase.tax_amount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">{formatCurrency(purchase.tax_amount)}</span>
              </div>
            )}
            
            {purchase.shipping_amount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Shipping/Delivery</span>
                <span className="font-medium">{formatCurrency(purchase.shipping_amount)}</span>
              </div>
            )}
            
            <Separator />
            
            <div className="flex justify-between items-center">
              <span className="font-semibold text-lg">Total Amount</span>
              <span className="font-bold text-lg text-primary">{formatCurrency(purchase.total_amount)}</span>
            </div>
            
            {purchase.paid_amount > 0 && (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Paid Amount</span>
                  <span className="text-green-600">{formatCurrency(purchase.paid_amount)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className={purchase.balance_due > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                    {formatCurrency(purchase.balance_due || 0)}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Purchase Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Supplier Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Supplier Name</p>
              <p className="text-lg">{purchase.supplier?.display_name || purchase.supplier?.company_name || 'Unknown Supplier'}</p>
            </div>

            <div>
              <p className="text-sm font-medium">Location</p>
              <p className="text-sm text-muted-foreground">{purchase.location?.name || 'Unknown Location'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Purchase Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Purchase Date</p>
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    try {
                      const dateValue = purchase.purchase_date || purchase.transaction_date;
                      if (!dateValue) return 'Date not available';
                      const date = new Date(dateValue);
                      if (isNaN(date.getTime())) return 'Date not available';
                      return format(date, 'MMMM dd, yyyy');
                    } catch {
                      return 'Date not available';
                    }
                  })()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(purchase.created_at), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Payment Status</p>
              <div className="mt-1">
                {getStatusBadge(purchase.payment_status)}
              </div>
            </div>
            {purchase.reference_number && (
              <div>
                <p className="text-sm font-medium">Reference Number</p>
                <p className="text-sm text-muted-foreground">{purchase.reference_number}</p>
              </div>
            )}
            {purchase.notes && (
              <div>
                <p className="text-sm font-medium">Notes</p>
                <p className="text-sm text-muted-foreground">{purchase.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('items')}
            className={cn(
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === 'items'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            )}
          >
            Purchase Items ({purchase.items?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('tracking')}
            className={cn(
              'py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2',
              activeTab === 'tracking'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            )}
          >
            <Hash className="h-4 w-4" />
            Individual Tracking
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            className={cn(
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === 'returns'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            )}
          >
            Returns ({returns.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'items' && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase Items</CardTitle>
            <CardDescription>
              Items that were purchased and added to inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Details</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {item.sku?.display_name || 'Unknown Item'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            SKU: {item.sku?.sku_code}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unit_cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.tax_amount ? (
                          <div className="text-sm">
                            <div>{formatCurrency(item.tax_amount)}</div>
                            {item.tax_rate > 0 && (
                              <div className="text-xs text-muted-foreground">
                                ({item.tax_rate}%)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.total_cost)}
                      </TableCell>
                      <TableCell>
                        {item.condition ? (
                          getConditionBadge(item.condition)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{item.location?.name || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.notes ? (
                          <span className="text-sm">{item.notes}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'tracking' && (
        <IndividualItemTrackingTab 
          purchase={purchase} 
          isLoading={loadingPurchase}
        />
      )}

      {activeTab === 'returns' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Purchase Returns</CardTitle>
                <CardDescription>
                  Items returned to the supplier from this purchase
                </CardDescription>
              </div>
              {purchase.status === 'COMPLETED' && (
                <Button onClick={handleCreateReturn} size="sm">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  New Return
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingReturns ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-8 w-8 animate-spin" />
                <p className="mt-2 text-sm text-muted-foreground">Loading returns...</p>
              </div>
            ) : returns.length === 0 ? (
              <div className="text-center py-8">
                <RotateCcw className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No returns recorded for this purchase
                </p>
                {purchase.status === 'COMPLETED' && (
                  <Button onClick={handleCreateReturn} size="sm" className="mt-4">
                    Create Return
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {returns.map((returnRecord) => (
                  <div key={returnRecord.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">
                          Return #{returnRecord.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(returnRecord.return_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(returnRecord.refund_amount)}</p>
                        <p className="text-sm text-muted-foreground">
                          {returnRecord.total_items} items
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{returnRecord.status}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/purchases/returns/${returnRecord.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
