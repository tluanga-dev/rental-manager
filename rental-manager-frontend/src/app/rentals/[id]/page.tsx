'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RentalInvoicePrint } from '@/components/rentals/RentalInvoicePrint';
import { RentalReturnHistory } from '@/components/rentals/RentalReturnHistory';
import { ReturnSummaryWidget } from '@/components/rentals/ReturnSummaryWidget';
import { PaymentHistory } from '@/components/payments/PaymentHistory';
import { 
  ArrowLeft,
  User,
  MapPin,
  Package,
  IndianRupee,
  Clock,
  FileText,
  Edit,
  Printer,
  Download,
  RotateCcw,
  Calendar
} from 'lucide-react';

import { rentalsApi } from '@/services/api/rentals';
import { calculateRentalItemTotal } from '@/utils/calculations';
import { useAuthStore } from '@/stores/auth-store';
import { rentalExtensionService } from '@/services/api/rental-extensions';

interface RentalDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

function RentalDetailContent({ params }: RentalDetailPageProps) {
  const router = useRouter();
  const { id } = use(params);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const { hasPermission } = useAuthStore();

  // Fetch comprehensive rental details (includes return history and returnable items)
  const { data: rental, isLoading, error } = useQuery({
    queryKey: ['rental-detail', id],
    queryFn: () => rentalsApi.getRentalById(id),
    enabled: !!id,
  });
  
  const returnHistory = rental?.return_history || [];
  const returnableItems = rental?.returnable_items || [];
  const returnSummary = rental?.return_summary || null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  const calculateItemTotal = (item: any) => {
    // ALWAYS calculate the correct total, don't trust backend line_total for rentals
    const quantity = item.quantity || 1;
    let unitRate = 0;
    let rentalPeriod = 1;

    // Determine unit rate and rental period
    if (item.rental_rate?.unit_rate) {
      unitRate = item.rental_rate.unit_rate;
      rentalPeriod = item.rental_rate.period_value || 1;
    } else if (item.daily_rate) {
      unitRate = item.daily_rate;
      // Use rental_period field if available, otherwise calculate from dates
      if (item.rental_period && item.rental_period > 0) {
        rentalPeriod = item.rental_period;
      } else if (item.rental_start_date && item.rental_end_date) {
        rentalPeriod = Math.ceil(
          (new Date(item.rental_end_date).getTime() - new Date(item.rental_start_date).getTime()) / 
          (1000 * 60 * 60 * 24)
        );
      }
    } else if (item.unit_price) {
      unitRate = item.unit_price;
      // Use rental_period field if available, otherwise calculate from dates
      if (item.rental_period && item.rental_period > 0) {
        rentalPeriod = item.rental_period;
      } else if (item.rental_start_date && item.rental_end_date) {
        rentalPeriod = Math.ceil(
          (new Date(item.rental_end_date).getTime() - new Date(item.rental_start_date).getTime()) / 
          (1000 * 60 * 60 * 24)
        );
      }
    }

    // Calculate base total with proper rental period multiplication
    const baseTotal = calculateRentalItemTotal(quantity, unitRate, rentalPeriod, 0);

    // Add additional charges
    const lateFeesTotal = (item.late_fee || item.late_fees || 0);
    const damageCharges = (item.damage_charges || 0);
    const extraCharges = (item.extra_charges || item.additional_charges || 0);

    const calculatedTotal = baseTotal + lateFeesTotal + damageCharges + extraCharges;

    return calculatedTotal;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="h-8 bg-gray-200 rounded animate-pulse w-64"></div>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-48"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            <Card className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-32"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Rental Not Found</h3>
            <p className="text-gray-500 mb-6">
              The rental transaction you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => router.back()}>
                Go Back
              </Button>
              <Button variant="outline" onClick={() => router.push('/rentals/history')}>
                View All Rentals
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!rental) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {rental.transaction_number || `Rental #${rental.id.slice(0, 8)}`}
            </h1>
            <p className="text-gray-600">
              Created on {formatDateTime(rental.created_at)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          
          {/* Extension Button - Only show if rental can be extended */}
          {hasPermission('RENTAL_EXTEND') && 
           rental && 
           rentalExtensionService.canExtend(rental.rental_status || rental.status) && 
           returnableItems.length > 0 && (
            <Button 
              variant="outline"
              size="sm"
              className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
              onClick={() => router.push(`/rentals/${id}/extend`)}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Extend Rental
            </Button>
          )}
          
          {/* Return Button - Only show if items are returnable */}
          {hasPermission('RENTAL_RETURN') && returnableItems.length > 0 && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => router.push(`/rentals/${id}/return`)}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Return
            </Button>
          )}
          
          <Button variant="outline" size="sm" onClick={() => setShowPrintModal(true)}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-lg font-medium">{rental.customer?.name || rental.customer_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Code</label>
                  <p className="text-lg">{rental.customer?.code || 'N/A'}</p>
                </div>
                {(rental.customer?.email || rental.customer_email) && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-lg">{rental.customer?.email || rental.customer_email}</p>
                  </div>
                )}
                {(rental.customer?.phone || rental.customer_phone) && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-lg">{rental.customer?.phone || rental.customer_phone}</p>
                  </div>
                )}
                {rental.customer?.address && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500">Address</label>
                    <p className="text-lg">{rental.customer.address}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>



          {/* Location */}
          {rental.location && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium">{rental.location.name}</p>
              </CardContent>
            </Card>
          )}

          {/* Calculation Debug Info */}
          {process.env.NODE_ENV === 'development' && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-orange-800 text-sm">🔍 Calculation Debug</CardTitle>
              </CardHeader>
              <CardContent className="text-xs">
                {(rental.rental_items || rental.items || []).map((item: any, index: number) => (
                  <div key={index} className="mb-2 p-2 bg-white rounded border">
                    <div className="font-medium">{item.item_name}</div>
                    <div>Backend line_total: ₹{item.line_total}</div>
                    <div>Calculated: {item.quantity} × ₹{item.unit_price} × {item.rental_period} days = ₹{calculateItemTotal(item)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Rental Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Rental Items ({rental.rental_items?.length || rental.items?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(rental.rental_items || rental.items) && (rental.rental_items || rental.items).length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Item</TableHead>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs">Rental Period</TableHead>
                        <TableHead className="text-xs">Quantity</TableHead>
                        <TableHead className="text-xs">Rate</TableHead>
                        <TableHead className="text-xs">Late Fee</TableHead>
                        <TableHead className="text-xs">Extra Charges</TableHead>
                        <TableHead className="text-xs">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {(rental.rental_items || rental.items).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs">
                          <div className="font-medium text-base">{item.item?.name || item.name || item.item_name || item.description}</div>
                          {(item.item?.description || item.description) && (
                            <div className="text-sm text-gray-500">{item.item?.description || item.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{item.item?.sku || item.sku || 'N/A'}</TableCell>
                        <TableCell className="text-xs">{item.item?.category || item.category || 'N/A'}</TableCell>
                        <TableCell className="text-xs">
                          <div>
                            {item.rental_start_date && item.rental_end_date ? (
                              <>
                                <div className="font-medium text-xs">
                                  {formatDate(item.rental_start_date)} - {formatDate(item.rental_end_date)}
                                </div>
                                <div className="text-gray-500 text-xs">
                                  {item.rental_duration_days || Math.ceil((new Date(item.rental_end_date).getTime() - new Date(item.rental_start_date).getTime()) / (1000 * 60 * 60 * 24))} days
                                </div>
                                {item.is_rental_overdue && (
                                  <div className="text-red-600 font-medium text-xs">
                                    Overdue by {item.days_overdue || Math.ceil((new Date().getTime() - new Date(item.rental_end_date).getTime()) / (1000 * 60 * 60 * 24))} days
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400 text-xs">No dates set</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <span className="font-medium text-sm">{item.quantity}</span>
                            {(item.quantity_returned || item.returned_quantity) > 0 && (
                              <div className="text-xs text-green-600">
                                {item.quantity_returned || item.returned_quantity} returned
                              </div>
                            )}
                            {item.quantity_damaged > 0 && (
                              <div className="text-xs text-red-600">
                                {item.quantity_damaged} damaged
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.rental_rate ? (
                            <div>
                              <div className="text-sm">{formatCurrency(item.rental_rate.unit_rate)}</div>
                              <div className="text-xs text-gray-500">
                                per {item.rental_rate.period_value} {item.rental_rate.period_type}
                              </div>
                            </div>
                          ) : item.daily_rate ? (
                            <div>
                              <div className="text-sm">{formatCurrency(item.daily_rate)}</div>
                              <div className="text-xs text-gray-500">per day</div>
                            </div>
                          ) : (
                            <span className="text-sm">{formatCurrency(item.unit_price || 0)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            {(item.late_fee || item.late_fees) ? (
                              <span className="text-red-600 font-medium text-sm">
                                {formatCurrency(item.late_fee || item.late_fees)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                            {item.is_rental_overdue && (
                              <div className="text-xs text-red-500 mt-1">
                                {item.days_overdue || Math.ceil((new Date().getTime() - new Date(item.rental_end_date).getTime()) / (1000 * 60 * 60 * 24))} days late
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            {(item.damage_charges || item.extra_charges || item.additional_charges) ? (
                              <div className="space-y-1">
                                {item.damage_charges && (
                                  <div className="text-red-600">
                                    <span className="text-xs">Damage:</span> <span className="text-sm">{formatCurrency(item.damage_charges)}</span>
                                  </div>
                                )}
                                {(item.extra_charges || item.additional_charges) && (
                                  <div className="text-orange-600">
                                    <span className="text-xs">Extra:</span> <span className="text-sm">{formatCurrency(item.extra_charges || item.additional_charges)}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency(calculateItemTotal(item))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No items found</p>
              )}
            </CardContent>
          </Card>

          {/* Return History */}
          <RentalReturnHistory 
            returnHistory={returnHistory}
            rentalId={id}
            onViewReceipt={(returnId) => {
              // TODO: Implement receipt viewing
              console.log('View receipt for return:', returnId);
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Return Summary - Show first in sidebar */}
          {rental && (
            <ReturnSummaryWidget
              rentalId={id}
              totalItems={returnSummary?.total_items || rental.items?.length || 0}
              returnedItems={returnSummary?.returned_items || 0}
              pendingItems={returnSummary?.returnable_items || returnableItems.length}
              rentalStatus={rental.rental_status || rental.status}
              canProcessReturn={hasPermission('RENTAL_RETURN') && returnableItems.length > 0}
              lastReturnDate={returnSummary?.last_return_date || returnHistory[0]?.transaction_date}
              dueDate={rental.rental_end_date}
              isOverdue={rental.rental_end_date && new Date(rental.rental_end_date) < new Date()}
            />
          )}
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Transaction Status</label>
                <div className="mt-1">
                  <Badge variant={getStatusBadgeVariant(rental.status?.transaction_status || rental.status)}>
                    {rental.status?.transaction_status || rental.status || 'Unknown'}
                  </Badge>
                </div>
              </div>
              
              {(rental.status?.rental_status || rental.rental_status) && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Rental Status</label>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(rental.status?.rental_status || rental.rental_status)}>
                      {rental.status?.rental_status || rental.rental_status}
                    </Badge>
                  </div>
                </div>
              )}
              
              {(rental.status?.payment_status || rental.payment_status) && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Payment Status</label>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(rental.status?.payment_status || rental.payment_status)}>
                      {rental.status?.payment_status || rental.payment_status}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rental.financial_summary || rental.financial ? (
                (() => {
                  // Recalculate correct totals from line items
                  const items = rental.rental_items || rental.items || [];
                  const calculatedSubtotal = items.reduce((sum: number, item: any) => sum + calculateItemTotal(item), 0);
                  const financialSummary = rental.financial_summary || rental.financial;
                  
                  // Use calculated subtotal if different from backend
                  const displaySubtotal = Math.abs(calculatedSubtotal - financialSummary.subtotal) > 0.01 
                    ? calculatedSubtotal 
                    : financialSummary.subtotal;
                  
                  const discountAmount = financialSummary.discount_amount || 0;
                  const taxAmount = financialSummary.tax_amount || 0;
                  const lateFees = financialSummary.late_fees || 0;
                  const damageCharges = financialSummary.damage_charges || 0;
                  
                  // Recalculate total with correct subtotal
                  const calculatedTotal = displaySubtotal - discountAmount + taxAmount + lateFees + damageCharges;
                  
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">{formatCurrency(displaySubtotal)}</span>
                      </div>
                  
                  {(rental.financial_summary || rental.financial).discount_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Discount</span>
                      <span className="font-medium text-green-600">-{formatCurrency((rental.financial_summary || rental.financial).discount_amount)}</span>
                    </div>
                  )}
                  
                  {(rental.financial_summary || rental.financial).tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-medium">{formatCurrency((rental.financial_summary || rental.financial).tax_amount)}</span>
                    </div>
                  )}
                  
                  {(rental.financial_summary || rental.financial).late_fees > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Late Fees</span>
                      <span className="font-medium text-red-600">{formatCurrency((rental.financial_summary || rental.financial).late_fees)}</span>
                    </div>
                  )}
                  
                  {(rental.financial_summary || rental.financial).damage_charges > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Damage Charges</span>
                      <span className="font-medium text-red-600">{formatCurrency((rental.financial_summary || rental.financial).damage_charges)}</span>
                    </div>
                  )}
                  
                  <Separator />
                  
                      <div className="flex justify-between">
                        <span className="text-lg font-semibold">Total Amount</span>
                        <span className="text-lg font-bold">{formatCurrency(calculatedTotal)}</span>
                      </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Paid Amount</span>
                    <span className="font-medium text-green-600">{formatCurrency((rental.financial_summary || rental.financial).paid_amount || 0)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Balance Due</span>
                    <span className={`font-medium ${(rental.financial_summary || rental.financial).balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency((rental.financial_summary || rental.financial).balance_due || 0)}
                    </span>
                  </div>
                  
                  {(rental.financial_summary || rental.financial).deposit_amount > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Deposit Amount</span>
                        <span className="font-medium">{formatCurrency((rental.financial_summary || rental.financial).deposit_amount)}</span>
                      </div>
                      
                      {(rental.financial_summary || rental.financial).refundable_deposit && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Refundable Deposit</span>
                          <span className="font-medium text-blue-600">{formatCurrency((rental.financial_summary || rental.financial).refundable_deposit)}</span>
                        </div>
                        )}
                      </>
                    )}
                  </>
                );
                })()
              ) : (
                // Fallback: Calculate totals from line items if financial summary is missing
                (() => {
                  const items = rental.rental_items || rental.items || [];
                  const calculatedTotal = items.reduce((sum: number, item: any) => sum + calculateItemTotal(item), 0);
                  return (
                    <div className="flex justify-between">
                      <span className="text-lg font-semibold">Total Amount</span>
                      <span className="text-lg font-bold">{formatCurrency(calculatedTotal || rental.total_amount || 0)}</span>
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          {rental && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IndianRupee className="w-5 h-5" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentHistory
                  paymentHistory={rental.payment_history || []}
                  paymentSummary={rental.payment_summary || {
                    total_paid: rental.paid_amount || 0,
                    outstanding_balance: (rental.total_amount || 0) - (rental.paid_amount || 0),
                    payment_methods_used: []
                  }}
                  showSummary={true}
                  className=""
                />
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="text-sm">{formatDateTime(rental.created_at)}</p>
              </div>
              
              {rental.updated_at && rental.updated_at !== rental.created_at && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-sm">{formatDateTime(rental.updated_at)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {rental.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{rental.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Print Modal */}
      {showPrintModal && (
        <RentalInvoicePrint 
          rental={rental} 
          onClose={() => setShowPrintModal(false)} 
        />
      )}
    </div>
  );
}

export default function RentalDetailPage({ params }: RentalDetailPageProps) {
  return (
    <ProtectedRoute requiredPermissions={['RENTAL_VIEW']}>
      <RentalDetailContent params={params} />
    </ProtectedRoute>
  );
}