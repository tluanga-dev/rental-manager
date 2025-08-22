// Active Rentals Table with Return Button Integration
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  ArrowPathIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  BanknotesIcon as CurrencyIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import { AnimatedButton } from './AnimationComponents';
import { Badge } from './DesignSystem';
import { Tooltip } from './HelpComponents';
import { ResponsiveTable, MobileCard } from './ResponsiveComponents';
import { LoadingSpinner } from './LoadingSkeletons';
import { ErrorAlert } from './ErrorComponents';

interface ActiveRental {
  id: string;
  transaction_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  location_id: string;
  location_name: string;
  rental_start_date: string;
  rental_end_date: string;
  days_overdue: number;
  is_overdue: boolean;
  status: string;
  rental_status: string;
  payment_status: string;
  total_amount: number;
  deposit_amount: number;
  items_count: number;
  can_extend?: boolean; // Added for extension eligibility
  has_booking_conflicts?: boolean; // Added for booking conflict indicator
  items: Array<{
    id: string;
    item_id: string;
    item_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    current_rental_status: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface ActiveRentalsResponse {
  success: boolean;
  message: string;
  data: ActiveRental[];
  summary: {
    total_rentals: number;
    total_value: number;
    overdue_count: number;
    locations: Array<{
      location_id: string;
      location_name: string;
      rental_count: number;
      total_value: number;
    }>;
    status_breakdown: Record<string, number>;
  };
  pagination: {
    skip: number;
    limit: number;
    total: number;
  };
}

export default function ActiveRentalsTable() {
  const router = useRouter();
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [summary, setSummary] = useState<ActiveRentalsResponse['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingReturn, setProcessingReturn] = useState<string | null>(null);
  const [processingExtension, setProcessingExtension] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveRentals();
  }, []);

  const fetchActiveRentals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/transactions/rentals/active');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch active rentals: ${response.statusText}`);
      }
      
      const result: ActiveRentalsResponse = await response.json();
      setRentals(result.data);
      setSummary(result.summary);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (rentalId: string) => {
    router.push(`/rentals/${rentalId}`);
  };

  const handleReturnItems = (rentalId: string) => {
    setProcessingReturn(rentalId);
    // Small delay to show loading state, then navigate
    setTimeout(() => {
      router.push(`/rentals/${rentalId}/return`);
      setProcessingReturn(null);
    }, 300);
  };

  const handleExtendRental = (rentalId: string) => {
    setProcessingExtension(rentalId);
    // Small delay to show loading state, then navigate
    setTimeout(() => {
      router.push(`/rentals/${rentalId}/extend`);
      setProcessingExtension(null);
    }, 300);
  };

  const getStatusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue) {
      return (
        <Badge variant="danger" dot>
          <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    }

    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      'RENTAL_INPROGRESS': { 
        variant: 'primary', 
        icon: ClockIcon, 
        label: 'Active' 
      },
      'RENTAL_EXTENDED': { 
        variant: 'warning', 
        icon: ClockIcon, 
        label: 'Extended' 
      },
      'RENTAL_PARTIAL_RETURN': { 
        variant: 'warning', 
        icon: ArrowPathIcon, 
        label: 'Partial Return' 
      },
      'RENTAL_LATE_PARTIAL_RETURN': { 
        variant: 'danger', 
        icon: ExclamationTriangleIcon, 
        label: 'Late Partial' 
      }
    };

    const config = statusConfig[status] || { 
      variant: 'default', 
      icon: ClockIcon, 
      label: status 
    };
    
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} dot>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const canReturn = (rental: ActiveRental) => {
    const returnableStatuses = [
      'RENTAL_INPROGRESS',
      'RENTAL_EXTENDED', 
      'RENTAL_PARTIAL_RETURN',
      'RENTAL_LATE_PARTIAL_RETURN'
    ];
    return returnableStatuses.includes(rental.rental_status);
  };

  const canExtend = (rental: ActiveRental) => {
    // Can extend if not completed/returned and no explicit conflicts
    const extendableStatuses = [
      'RENTAL_INPROGRESS',
      'RENTAL_EXTENDED',
      'RENTAL_LATE',
      'RENTAL_PARTIAL_RETURN',
      'RENTAL_LATE_PARTIAL_RETURN'
    ];
    return extendableStatuses.includes(rental.rental_status) && 
           rental.can_extend !== false;
  };

  const tableHeaders = [
    'Transaction',
    'Customer', 
    'Location',
    'Rental Period',
    'Status',
    'Amount',
    'Items',
    'Actions'
  ];

  const renderDesktopRow = (rental: ActiveRental, index: number) => (
    <tr key={rental.id} className="hover:bg-gray-50 transition-colors">
      {/* Transaction Number */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {rental.transaction_number}
        </div>
        <div className="text-xs text-gray-500">
          {formatDate(rental.created_at)}
        </div>
      </td>

      {/* Customer */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {rental.customer_name}
        </div>
        <div className="text-xs text-gray-500">
          {rental.customer_phone}
        </div>
      </td>

      {/* Location */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {rental.location_name}
        </div>
      </td>

      {/* Rental Period */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {formatDate(rental.rental_start_date)} - {formatDate(rental.rental_end_date)}
        </div>
        {rental.is_overdue && (
          <div className="text-xs text-red-600 font-medium">
            {rental.days_overdue} days overdue
          </div>
        )}
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge(rental.rental_status, rental.is_overdue)}
      </td>

      {/* Amount */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {formatCurrency(rental.total_amount)}
        </div>
        <div className="text-xs text-gray-500">
          Deposit: {formatCurrency(rental.deposit_amount)}
        </div>
      </td>

      {/* Items Count */}
      <td className="px-6 py-4 whitespace-nowrap">
        <Tooltip content={`${rental.items_count} items rented`}>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {rental.items_count} items
          </span>
        </Tooltip>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center space-x-2">
          <Tooltip content="View rental details">
            <AnimatedButton
              variant="ghost"
              size="sm"
              onClick={() => handleViewDetails(rental.id)}
            >
              <EyeIcon className="w-4 h-4" />
            </AnimatedButton>
          </Tooltip>
          
          {canExtend(rental) && (
            <Tooltip content={rental.has_booking_conflicts ? "Cannot extend - has booking conflicts" : "Extend rental period"}>
              <AnimatedButton
                variant={rental.has_booking_conflicts ? "ghost" : "secondary"}
                size="sm"
                onClick={() => handleExtendRental(rental.id)}
                loading={processingExtension === rental.id}
                disabled={processingExtension === rental.id || rental.has_booking_conflicts}
              >
                {processingExtension === rental.id ? (
                  'Opening...'
                ) : (
                  <>
                    <CalendarDaysIcon className="w-4 h-4 mr-1" />
                    Extend
                  </>
                )}
              </AnimatedButton>
            </Tooltip>
          )}
          
          {canReturn(rental) && (
            <Tooltip content="Process return for this rental">
              <AnimatedButton
                variant="primary"
                size="sm"
                onClick={() => handleReturnItems(rental.id)}
                loading={processingReturn === rental.id}
                disabled={processingReturn === rental.id}
              >
                {processingReturn === rental.id ? (
                  'Opening...'
                ) : (
                  <>
                    <ArrowPathIcon className="w-4 h-4 mr-1" />
                    Return
                  </>
                )}
              </AnimatedButton>
            </Tooltip>
          )}
        </div>
      </td>
    </tr>
  );

  const renderMobileCard = (rental: ActiveRental, index: number) => (
    <MobileCard
      key={rental.id}
      title={rental.transaction_number}
      subtitle={rental.customer_name}
      className="space-y-4"
    >
      {/* Status and Amount Row */}
      <div className="flex items-center justify-between">
        {getStatusBadge(rental.rental_status, rental.is_overdue)}
        <div className="text-right">
          <div className="font-semibold text-gray-900">
            {formatCurrency(rental.total_amount)}
          </div>
          <div className="text-xs text-gray-500">
            {rental.items_count} items
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-500">Location</div>
          <div className="font-medium">{rental.location_name}</div>
        </div>
        <div>
          <div className="text-gray-500">Period</div>
          <div className="font-medium">
            {formatDate(rental.rental_start_date)} - {formatDate(rental.rental_end_date)}
          </div>
          {rental.is_overdue && (
            <div className="text-xs text-red-600 font-medium mt-1">
              {rental.days_overdue} days overdue
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
        <AnimatedButton
          variant="ghost"
          size="sm"
          onClick={() => handleViewDetails(rental.id)}
        >
          <EyeIcon className="w-4 h-4 mr-1" />
          View
        </AnimatedButton>
        
        {canExtend(rental) && (
          <AnimatedButton
            variant={rental.has_booking_conflicts ? "ghost" : "secondary"}
            size="sm"
            onClick={() => handleExtendRental(rental.id)}
            loading={processingExtension === rental.id}
            disabled={processingExtension === rental.id || rental.has_booking_conflicts}
          >
            {processingExtension === rental.id ? (
              'Opening...'
            ) : (
              <>
                <CalendarDaysIcon className="w-4 h-4 mr-1" />
                Extend
              </>
            )}
          </AnimatedButton>
        )}
        
        {canReturn(rental) && (
          <AnimatedButton
            variant="primary"
            size="sm"
            onClick={() => handleReturnItems(rental.id)}
            loading={processingReturn === rental.id}
            disabled={processingReturn === rental.id}
          >
            {processingReturn === rental.id ? (
              'Opening...'
            ) : (
              <>
                <ArrowPathIcon className="w-4 h-4 mr-1" />
                Return
              </>
            )}
          </AnimatedButton>
        )}
      </div>
    </MobileCard>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Loading active rentals..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <ErrorAlert
          error={{
            type: 'server_error',
            message: 'Failed to load active rentals',
            details: error
          }}
          onRetry={fetchActiveRentals}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <ClockIcon className="w-8 h-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Active</p>
                <p className="text-2xl font-semibold text-gray-900">{summary.total_rentals}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <CurrencyIcon className="w-8 h-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Value</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(summary.total_value)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Overdue</p>
                <p className="text-2xl font-semibold text-gray-900">{summary.overdue_count}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <CheckCircleIcon className="w-8 h-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Locations</p>
                <p className="text-2xl font-semibold text-gray-900">{summary.locations.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rentals Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Active Rental Transactions
            </h2>
            <AnimatedButton
              variant="ghost"
              size="sm"
              onClick={fetchActiveRentals}
            >
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Refresh
            </AnimatedButton>
          </div>
        </div>

        <ResponsiveTable
          headers={tableHeaders}
          data={rentals}
          renderRow={renderDesktopRow}
          renderMobileCard={renderMobileCard}
        />

        {rentals.length === 0 && (
          <div className="text-center py-12">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No active rentals</h3>
            <p className="mt-1 text-sm text-gray-500">
              There are no active rental transactions at this time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}