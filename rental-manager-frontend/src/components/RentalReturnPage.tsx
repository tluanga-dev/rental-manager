'use client';

// Rental Return Page - Main component for processing returns with sidebar navigation
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle as CheckCircleIcon,
  Printer as PrinterIcon,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { useRentalReturn } from '../hooks/useRentalReturn';
import RentalReturnSidebar, { TabType } from './RentalReturnSidebar';
import { RentalItemsTab, FinancialTab, ReturnNotesTab } from './tabs';
import { ReturnableRental, RentalReturnResponse } from '../types/rental-return';
import { ReturnPageLoadingSkeleton } from './LoadingSkeletons';
import { ErrorAlert, ErrorBoundary, NetworkStatus } from './ErrorComponents';
import { ReturnConfirmationDialog } from './ConfirmationDialogs';
import { PageTransition, AnimatedButton } from './AnimationComponents';
import { RentalReturnPrint } from './rentals/RentalReturnPrint';
import { RentalReturnReceipt } from './rentals/RentalReturnReceipt';

interface RentalReturnPageProps {
  rentalId: string;
}

export default function RentalReturnPage({ rentalId }: RentalReturnPageProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const router = useRouter();
  
  const {
    returnData,
    returnItems,
    loading,
    error,
    processingReturn,
    fetchReturnData,
    updateReturnItem,
    toggleAllItems,
    setReturnActionForAll,
    processReturn,
    calculateFinancialPreview,
    canProcessReturn,
    selectedItemsCount,
    totalItemsCount,
    hasOverdueItems
  } = useRentalReturn(rentalId);

  const [returnNotes, setReturnNotes] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [returnResult, setReturnResult] = useState<RentalReturnResponse | null>(null);
  const [showReturnConfirmation, setShowReturnConfirmation] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchReturnData();
    }
  }, [mounted, fetchReturnData]);

  const handleProcessReturn = async () => {
    
    if (!canProcessReturn()) {
      return;
    }
    
    // Clear any previous dialog errors
    setDialogError(null);
    
    try {
      
      const result = await processReturn(returnNotes);
      
      
      // Close dialog and show receipt modal
      setShowReturnConfirmation(false);
      setReturnResult(result);
      setShowConfirmation(true);
      
      // Show receipt modal after successful return
      if (result && result.success) {
        setShowReceiptModal(true);
      }
      
      
    } catch (err) {
      
      if (err.response) {
      }
      
      // Show error in dialog instead of closing it
      const errorMessage = err instanceof Error ? err.message : 'Failed to process return. Please try again.';
      setDialogError(errorMessage);
    }
  };

  const handleReturnClick = () => {
    if (canProcessReturn()) {
      setDialogError(null); // Clear any previous errors
      setShowReturnConfirmation(true);
    }
  };

  const handleCloseDialog = () => {
    setShowReturnConfirmation(false);
    setDialogError(null); // Clear errors when closing
  };

  const handlePrintReturn = () => {
    // If we have a return result, show the receipt modal
    // Otherwise show the print preview modal
    if (returnResult && returnResult.success) {
      setShowReceiptModal(true);
    } else {
      setShowPrintModal(true);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Calculate unreturned items and their penalties
  const calculateUnreturnedItems = (originalItems: any[], returnedItems: any[]) => {
    const unreturnedItems = [];
    const currentDate = new Date();
    const dailyPenaltyRate = 50; // ₹50 per day per item (configurable)
    
    // For each original rental item
    for (const originalItem of originalItems || []) {
      // Find if this item was returned
      const returnedItem = returnedItems.find(
        r => r.sku === originalItem.sku || r.item_name === originalItem.item_name
      );
      
      const originalQty = originalItem.quantity || 0;
      const returnedQty = returnedItem?.returned_quantity || 0;
      const outstandingQty = originalQty - returnedQty;
      
      if (outstandingQty > 0) {
        // Calculate status and penalties
        const rentalEndDate = new Date(originalItem.rental_end_date);
        const isOverdue = currentDate > rentalEndDate;
        const daysOverdue = isOverdue 
          ? Math.ceil((currentDate.getTime() - rentalEndDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const penaltyAmount = daysOverdue * dailyPenaltyRate * outstandingQty;
        
        unreturnedItems.push({
          ...originalItem,
          outstanding_quantity: outstandingQty,
          returned_quantity: returnedQty,
          is_overdue: isOverdue,
          days_overdue: daysOverdue,
          penalty_amount: penaltyAmount,
          status: isOverdue ? 'OVERDUE' : 'ON_TIME',
          due_date: rentalEndDate
        });
      }
    }
    
    return unreturnedItems;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'RENTAL_INPROGRESS': { 
        color: 'bg-blue-100 text-blue-800', 
        label: 'In Progress' 
      },
      'RENTAL_COMPLETED': { 
        color: 'bg-green-100 text-green-800', 
        label: 'Completed' 
      },
      'RENTAL_LATE': { 
        color: 'bg-red-100 text-red-800', 
        label: 'Late' 
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: 'bg-gray-100 text-gray-800',
      label: status
    };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const financialPreview = calculateFinancialPreview();

  // Safe navigation function
  const navigateTo = (path: string) => {
    if (mounted && router) {
      router.push(path);
    }
  };

  // Render active tab content
  const renderActiveTab = () => {
    if (!returnData) return null;

    switch (activeTab) {
      case 'items':
        return (
          <RentalItemsTab
            returnItems={returnItems}
            onUpdateItem={updateReturnItem}
            onToggleAll={toggleAllItems}
            onSetActionForAll={setReturnActionForAll}
            selectedCount={selectedItemsCount}
            totalCount={totalItemsCount}
            isProcessing={processingReturn}
            hasOverdueItems={hasOverdueItems}
          />
        );
      case 'financial':
        return (
          <FinancialTab
            financialPreview={financialPreview}
            returnData={returnData}
            selectedItemsCount={selectedItemsCount}
          />
        );
      case 'notes':
        return (
          <ReturnNotesTab
            returnNotes={returnNotes}
            onReturnNotesChange={setReturnNotes}
            onProcessReturn={handleReturnClick}
            canProcessReturn={canProcessReturn()}
            isProcessing={processingReturn}
            selectedItemsCount={selectedItemsCount}
            financialPreview={financialPreview}
            rentalId={rentalId}
          />
        );
      default:
        return null;
    }
  };

  // Return loading state until component is mounted (prevents SSR issues)
  if (!mounted) {
    return (
      <>
        <NetworkStatus />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing...</p>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <NetworkStatus />
        <ReturnPageLoadingSkeleton />
      </>
    );
  }

  if (error || !returnData) {
    const errorType = error?.includes('not found') ? 'not_found_error' : 
                     error?.includes('permission') ? 'permission_error' :
                     error?.includes('Authentication') ? 'auth_error' :
                     'server_error';
                     
    return (
      <>
        <NetworkStatus />
        <PageTransition>
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="max-w-md w-full mx-4">
              <ErrorAlert
                error={{
                  type: errorType,
                  message: error || 'Unable to load return data',
                  details: error?.includes('not found') 
                    ? `The rental ID "${rentalId}" does not exist or has been deleted.`
                    : 'The rental return information could not be retrieved. Please check if this rental exists and is in a returnable state.'
                }}
                onRetry={() => fetchReturnData()}
              />
              <div className="mt-6 space-y-3">
                <div className="text-center">
                  <AnimatedButton
                    onClick={() => router.push('/rentals')}
                    variant="primary"
                  >
                    View All Rentals
                  </AnimatedButton>
                </div>
                <div className="text-center">
                  <AnimatedButton
                    onClick={() => router.push(`/rentals/${rentalId}`)}
                    variant="secondary"
                  >
                    Try Rental Details Page
                  </AnimatedButton>
                </div>
                <div className="text-center text-sm text-gray-500">
                  Rental ID: <code className="bg-gray-100 px-2 py-1 rounded">{rentalId}</code>
                </div>
              </div>
            </div>
          </div>
        </PageTransition>
      </>
    );
  }

  // Enhanced Success confirmation full-page display
  if (showConfirmation && returnResult) {
    return (
      <ErrorBoundary>
        <NetworkStatus />
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
          <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-4">
                <CheckCircleIcon className="w-16 h-16 text-green-600" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Return Processed Successfully!</h1>
              <p className="text-xl text-gray-600">
                Transaction {returnResult.transaction_number} has been completed
              </p>
              <div className="mt-4 inline-flex items-center px-4 py-2 bg-green-100 border border-green-200 rounded-lg">
                <span className="text-green-800 font-medium">
                  Processed on {formatDate(returnResult.return_date)} at {new Date(returnResult.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Transaction Overview */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Transaction Summary Card */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                    <h2 className="text-xl font-bold text-white">Transaction Details</h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Customer Information</h3>
                        <div className="mt-3 space-y-2">
                          <p className="text-lg font-semibold text-gray-900">{returnData.customer_name}</p>
                          <p className="text-gray-600">{returnData.customer_email}</p>
                          <p className="text-gray-600">{returnData.customer_phone}</p>
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Transaction Info</h3>
                        <div className="mt-3 space-y-2">
                          <p className="text-gray-600">
                            <span className="font-medium">Transaction #:</span>{' '}
                            <span className="font-semibold text-gray-900">{returnResult.transaction_number}</span>
                          </p>
                          <p className="text-gray-600">
                            <span className="font-medium">Rental Status:</span>{' '}
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {returnResult.rental_status}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Returned */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
                    <h2 className="text-xl font-bold text-white">
                      Returned Items ({returnResult.items_returned.length})
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {returnResult.items_returned.map((item, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-gray-900">{item.item_name}</div>
                                <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                {item.returned_quantity}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {item.new_status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                {item.condition_notes || 'Returned'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Unreturned Items Warning Section */}
                {(() => {
                  const unreturnedItems = calculateUnreturnedItems(
                    returnData?.rental_items || [],
                    returnResult.items_returned || []
                  );
                  
                  if (unreturnedItems.length === 0) return null;
                  
                  const totalPenalties = unreturnedItems.reduce((sum, item) => sum + item.penalty_amount, 0);
                  const hasOverdueItems = unreturnedItems.some(item => item.is_overdue);
                  
                  return (
                    <div className="mt-6 bg-white rounded-xl shadow-lg border-2 border-orange-300 overflow-hidden">
                      <div className={`${hasOverdueItems ? 'bg-gradient-to-r from-red-500 to-orange-600' : 'bg-gradient-to-r from-yellow-500 to-orange-500'} px-6 py-4`}>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                          <AlertTriangle className="w-6 h-6" />
                          Items Still Outstanding ({unreturnedItems.length})
                        </h2>
                      </div>
                      <div className="p-6">
                        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-sm text-orange-800">
                            <strong>Important:</strong> The following items have not been returned yet. 
                            {hasOverdueItems && ' Some items are overdue and accumulating daily penalties.'}
                          </p>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding Qty</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Overdue</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Penalty</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {unreturnedItems.map((item, index) => (
                                <tr key={index} className={item.is_overdue ? 'bg-red-50' : ''}>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-gray-900">{item.item_name}</div>
                                    <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-lg font-semibold text-gray-900">{item.outstanding_quantity}</span>
                                    <span className="text-sm text-gray-500"> of {item.quantity}</span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{formatDate(item.rental_end_date)}</div>
                                    {!item.is_overdue && (
                                      <div className="text-xs text-gray-500">
                                        {Math.ceil((item.due_date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    {item.is_overdue ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        OVERDUE
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        <Clock className="w-3 h-3 mr-1" />
                                        ON TIME
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {item.days_overdue > 0 ? (
                                      <span className="text-red-600 font-bold">{item.days_overdue} days</span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    {item.penalty_amount > 0 ? (
                                      <span className="text-red-600 font-bold">₹{item.penalty_amount.toFixed(2)}</span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            {totalPenalties > 0 && (
                              <tfoot className="bg-red-50">
                                <tr>
                                  <td colSpan={5} className="px-6 py-3 text-right font-semibold text-gray-900">
                                    Total Penalties Accumulating:
                                  </td>
                                  <td className="px-6 py-3 text-right">
                                    <span className="text-xl font-bold text-red-600">₹{totalPenalties.toFixed(2)}</span>
                                    <div className="text-xs text-red-500">Increases daily</div>
                                  </td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                        
                        {hasOverdueItems && (
                          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800">
                              <strong>⚠️ Action Required:</strong> Overdue items are accumulating penalties at ₹50 per item per day. 
                              Please contact the customer to arrange immediate return.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Financial Summary Sidebar */}
              <div className="space-y-6">
                
                {/* Return Date Card */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
                    <h3 className="text-lg font-bold text-white">Return Date</h3>
                  </div>
                  <div className="p-6 text-center">
                    <div className="text-2xl font-bold text-gray-900">{formatDate(returnResult.return_date)}</div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-600 to-yellow-700 px-6 py-4">
                    <h3 className="text-lg font-bold text-white">Financial Summary</h3>
                  </div>
                  <div className="p-6 space-y-3">
                    {(() => {
                      // Calculate financial details from returned items
                      const returnedItems = returnResult.items_returned || [];
                      
                      // Calculate unreturned items for financial impact
                      const unreturnedItems = calculateUnreturnedItems(
                        returnData?.rental_items || [],
                        returnResult.items_returned || []
                      );
                      const totalAccumulatingPenalties = unreturnedItems.reduce((sum, item) => sum + item.penalty_amount, 0);
                      const hasUnreturnedItems = unreturnedItems.length > 0;
                      
                      // Debug: Log the structure to see what data we have
                      console.log('Return result items:', returnedItems);
                      console.log('Original return data:', returnData);
                      
                      // Use the original rental subtotal from returnData since it has the correct amounts
                      // The returnResult might not have complete financial data
                      const originalSubtotal = returnData?.subtotal || returnData?.total_amount || 0;
                      
                      // If we have selected items in the return process, calculate proportionally
                      // Otherwise use the full original amount
                      let rentalSubtotal = originalSubtotal;
                      
                      // Try to get calculation from returnItems state (which should have the correct data)
                      if (returnItems && returnItems.length > 0) {
                        const selectedItems = returnItems.filter(item => item.selected);
                        if (selectedItems.length > 0) {
                          rentalSubtotal = selectedItems.reduce((total, returnItem) => {
                            const item = returnItem.item;
                            const quantity = item.quantity || 1;
                            const unitRate = item.unit_price || 0;
                            const rentalPeriod = item.rental_period || 1;
                            const itemTotal = quantity * unitRate * rentalPeriod;
                            console.log(`Return item: ${item.item_name}, Qty: ${quantity}, Rate: ${unitRate}, Period: ${rentalPeriod}, Total: ${itemTotal}`);
                            return total + itemTotal;
                          }, 0);
                        }
                      } else if (returnData?.rental_items && returnData.rental_items.length > 0) {
                        // Fallback to original rental items
                        rentalSubtotal = returnData.rental_items.reduce((total, item) => {
                          const quantity = item.quantity || 1;
                          const unitRate = item.unit_price || 0;
                          const rentalPeriod = item.rental_period || 1;
                          console.log(`Original item: ${item.item_name}, Qty: ${quantity}, Rate: ${unitRate}, Period: ${rentalPeriod}, Total: ${quantity * unitRate * rentalPeriod}`);
                          return total + (quantity * unitRate * rentalPeriod);
                        }, 0);
                      } else {
                        // Final fallback to using the stored subtotal from the rental transaction
                        console.log('Using original subtotal from returnData:', originalSubtotal);
                      }
                      
                      const lateFees = returnResult.financial_impact?.late_fees || 0;
                      const damagePenalties = returnResult.financial_impact?.damage_penalties || 0;
                      const additionalCharges = lateFees + damagePenalties;
                      const totalAmount = rentalSubtotal + additionalCharges;
                      const depositAmount = returnResult.financial_impact?.deposit_amount || 0;
                      const balanceAmount = totalAmount - depositAmount;
                      
                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Rental Subtotal</span>
                            <span className="font-medium">₹{rentalSubtotal.toFixed(2)}</span>
                          </div>
                          
                          {lateFees > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Late Fees</span>
                              <span className="font-semibold text-red-600">+₹{lateFees.toFixed(2)}</span>
                            </div>
                          )}
                          
                          {damagePenalties > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Damage Penalties</span>
                              <span className="font-semibold text-red-600">+₹{damagePenalties.toFixed(2)}</span>
                            </div>
                          )}
                          
                          <div className="border-t pt-3">
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-semibold text-gray-900">Total Amount</span>
                              <span className="text-lg font-bold">₹{totalAmount.toFixed(2)}</span>
                            </div>
                          </div>
                          
                          {depositAmount > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Less: Deposit Paid</span>
                              <span className="font-semibold text-blue-600">-₹{depositAmount.toFixed(2)}</span>
                            </div>
                          )}
                          
                          <div className="border-t pt-3">
                            <div className={`flex justify-between items-center ${
                              balanceAmount >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              <span className="text-xl font-bold">
                                {balanceAmount >= 0 ? 'Amount to be Paid' : 'Refund Amount'}
                              </span>
                              <span className="text-2xl font-bold">
                                ₹{Math.abs(balanceAmount).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          
                          {hasUnreturnedItems && (
                            <>
                              <div className="border-t pt-3 mt-3">
                                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                  <div className="text-sm font-medium text-orange-800 mb-2">
                                    ⚠️ Outstanding Items Impact:
                                  </div>
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-orange-700">Unreturned Items:</span>
                                    <span className="font-medium text-orange-900">{unreturnedItems.length} items</span>
                                  </div>
                                  {totalAccumulatingPenalties > 0 && (
                                    <div className="flex justify-between items-center text-sm mt-1">
                                      <span className="text-orange-700">Current Penalties:</span>
                                      <span className="font-bold text-red-600">₹{totalAccumulatingPenalties.toFixed(2)}</span>
                                    </div>
                                  )}
                                  <div className="mt-2 text-xs text-orange-600">
                                    * Penalties increase daily until items are returned
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-8 flex justify-center space-x-4">
              <button
                onClick={() => window.print()}
                className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 flex items-center"
              >
                <PrinterIcon className="w-4 h-4 mr-2" />
                Print Receipt
              </button>
              <button
                onClick={() => router.push(`/rentals/${rentalId}`)}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                View Rental Details
              </button>
              <button
                onClick={() => router.push('/rentals')}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
              >
                Back to Rentals
              </button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Success confirmation modal
  
  if (showConfirmation && returnResult) {
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Return Processed Successfully!</h2>
            <p className="mt-2 text-gray-600">
              {returnResult.items_returned.length} items have been returned successfully.
            </p>
            
            {/* Return Summary */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Return Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Transaction:</span>
                  <span className="font-medium">{returnResult.transaction_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Return Date:</span>
                  <span className="font-medium">{formatDate(returnResult.return_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span>New Status:</span>
                  <span>{getStatusBadge(returnResult.rental_status)}</span>
                </div>
                {returnResult.financial_impact && (
                  <>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between">
                        <span>Deposit Amount:</span>
                        <span className="font-medium">${returnResult.financial_impact.deposit_amount.toFixed(2)}</span>
                      </div>
                      {returnResult.financial_impact.late_fees > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Late Fees:</span>
                          <span className="font-medium">-${returnResult.financial_impact.late_fees.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                        <span>Refund Amount:</span>
                        <span className="text-green-600">${returnResult.financial_impact.total_refund.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-8 flex justify-center space-x-4">
              <button
                onClick={() => window.print()}
                className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 flex items-center"
              >
                <PrinterIcon className="w-4 h-4 mr-2" />
                Print Receipt
              </button>
              <button
                onClick={() => router.push(`/rentals/${rentalId}`)}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                View Rental Details
              </button>
              <button
                onClick={() => router.push('/rentals')}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
              >
                Back to Rentals
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <NetworkStatus />
      <PageTransition>
        <div className="h-screen bg-gray-50 flex overflow-hidden">
          {/* Sidebar */}
          <RentalReturnSidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            rentalId={rentalId}
            transactionNumber={returnData?.transaction_number}
            canProcessReturn={canProcessReturn()}
            isProcessing={processingReturn}
            selectedItemsCount={selectedItemsCount}
            onProcessReturn={handleReturnClick}
            onPrintReturn={handlePrintReturn}
          />
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-6">
              {renderActiveTab()}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="fixed bottom-4 right-4 max-w-md z-50">
              <ErrorAlert
                error={{
                  type: 'server_error',
                  message: 'Return Processing Failed',
                  details: error
                }}
                onRetry={() => fetchReturnData()}
              />
            </div>
          )}

          {/* Return Confirmation Dialog */}
          <ReturnConfirmationDialog
            isOpen={showReturnConfirmation}
            onClose={handleCloseDialog}
            onConfirm={handleProcessReturn}
            loading={processingReturn}
            error={dialogError}
            selectedItems={returnItems
              .filter(item => item.selected)
              .map(item => ({
                item_name: item.item.item_name,
                return_quantity: item.return_quantity
              }))
            }
            financialImpact={financialPreview || undefined}
          />

          {/* Receipt Modal - Shows after successful return */}
          {showReceiptModal && returnResult && (
            <RentalReturnReceipt
              isOpen={showReceiptModal}
              onClose={() => setShowReceiptModal(false)}
              returnData={{
                success: returnResult.success,
                message: returnResult.message || 'Return processed successfully',
                rental_id: rentalId,
                transaction_number: returnData?.transaction_number || '',
                return_date: new Date().toISOString(),
                items_returned: returnResult.items_returned || [],
                rental_status: returnResult.rental_status || 'RENTAL_PARTIAL_RETURN',
                financial_impact: returnResult.financial_impact || {
                  deposit_refunded: 0,
                  late_fees_charged: 0,
                  damage_fees_charged: 0,
                  total_refund: 0
                },
                timestamp: new Date().toISOString()
              }}
              companyInfo={{
                name: 'Your Rental Company',
                address: '123 Business Street, City, State 12345',
                phone: '(555) 123-4567',
                email: 'info@yourrental.com'
              }}
              customerInfo={{
                name: returnData?.customer?.name || 'Customer Name',
                phone: returnData?.customer?.phone || undefined,
                email: returnData?.customer?.email || undefined,
                address: returnData?.customer?.address || undefined
              }}
            />
          )}

          {/* Print Modal */}
          {showPrintModal && returnData && (
            <RentalReturnPrint 
              returnData={{
                rental: returnData,
                items: returnItems?.filter(item => item.selected)?.map((item: any) => ({
                  ...item,
                  item_name: item.item.item_name,
                  sku: item.item.sku,
                  quantity: item.item.quantity,
                  unit_price: item.item.unit_price,
                  rental_period: item.item.rental_period,
                  rental_start_date: item.item.rental_start_date,
                  rental_end_date: item.item.rental_end_date,
                  line_total: item.item.line_total,
                  discount_amount: item.item.discount_amount,
                  return_quantity: item.return_quantity,
                  return_action: item.return_action,
                  condition_notes: item.condition_notes,
                  damage_notes: item.damage_notes,
                  late_fee: item.late_fee || 0,
                  damage_penalty: item.damage_penalty || 0
                })) || [],
                notes: returnNotes,
              }}
              onClose={() => setShowPrintModal(false)} 
            />
          )}
        </div>
      </PageTransition>
    </ErrorBoundary>
  );
}