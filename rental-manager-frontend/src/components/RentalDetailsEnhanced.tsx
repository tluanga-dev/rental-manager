// Enhanced Rental Details Page with Return Button
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  ArrowLeftIcon, 
  PrinterIcon, 
  PencilIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { RentalDetails } from '../types/rental-return';

interface RentalDetailsPageProps {
  rentalId: string;
}

export default function RentalDetailsEnhanced({ rentalId }: RentalDetailsPageProps) {
  const router = useRouter();
  const [rental, setRental] = useState<RentalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRentalDetails();
  }, [rentalId]);

  const fetchRentalDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/transactions/rentals/${rentalId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch rental details');
      }
      
      const result = await response.json();
      setRental(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'RENTAL_INPROGRESS': { 
        color: 'bg-blue-100 text-blue-800', 
        icon: ClockIcon, 
        label: 'Active' 
      },
      'RENTAL_COMPLETED': { 
        color: 'bg-green-100 text-green-800', 
        icon: CheckCircleIcon, 
        label: 'Completed' 
      },
      'RENTAL_LATE': { 
        color: 'bg-red-100 text-red-800', 
        icon: ExclamationTriangleIcon, 
        label: 'Overdue' 
      },
      'RENTAL_PARTIAL_RETURN': { 
        color: 'bg-yellow-100 text-yellow-800', 
        icon: ClockIcon, 
        label: 'Partial Return' 
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: 'bg-gray-100 text-gray-800',
      icon: ClockIcon,
      label: status
    };

    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {config.label}
      </span>
    );
  };

  const canReturn = rental && !['RENTAL_COMPLETED'].includes(rental.rental_status);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !rental) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading rental</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <button 
            onClick={() => router.push('/rentals')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Rentals
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/rentals')}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeftIcon className="w-5 h-5 mr-2" />
                  Back to Rentals
                </button>
                <div className="h-6 w-px bg-gray-300" />
                <h1 className="text-2xl font-bold text-gray-900">
                  {rental.transaction_number}
                </h1>
                {getStatusBadge(rental.rental_status)}
              </div>
              
              <div className="flex items-center space-x-3">
                {canReturn && (
                  <button
                    onClick={() => router.push(`/rentals/${rentalId}/return`)}
                    className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors flex items-center"
                  >
                    <ArrowLeftIcon className="w-4 h-4 mr-2 rotate-180" />
                    Return Items
                  </button>
                )}
                <button
                  onClick={() => window.open(`/api/transactions/rentals/${rentalId}/print`, '_blank')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors flex items-center"
                >
                  <PrinterIcon className="w-4 h-4 mr-2" />
                  Print
                </button>
                <button
                  onClick={() => {/* Handle edit */}}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
                >
                  <PencilIcon className="w-4 h-4 mr-2" />
                  Edit
                </button>
              </div>
            </div>
          </div>
          
          {/* Transaction Summary */}
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Customer</h3>
                <p className="mt-1 text-lg font-semibold text-gray-900">{rental.customer_name}</p>
                <p className="text-sm text-gray-600">{rental.customer_email}</p>
                <p className="text-sm text-gray-600">{rental.customer_phone}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Location</h3>
                <p className="mt-1 text-lg font-semibold text-gray-900">{rental.location_name}</p>
                <p className="text-sm text-gray-600">Payment: {rental.payment_method}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Rental Period</h3>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {new Date(rental.rental_start_date).toLocaleDateString()} - 
                  {new Date(rental.rental_end_date).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">{rental.rental_period.duration_days} days</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Total Amount</h3>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  ${rental.total_amount.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">
                  Deposit: ${rental.deposit_amount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Rental Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rental.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                        <div className="text-sm text-gray-500">{item.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.sku}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.rental_period} {item.rental_period_unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(item.current_rental_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      ${item.line_total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Financial Summary</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Subtotal</p>
                <p className="text-lg font-semibold">${rental.subtotal.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Tax</p>
                <p className="text-lg font-semibold">${rental.tax_amount.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Deposit</p>
                <p className="text-lg font-semibold">${rental.deposit_amount.toFixed(2)}</p>
              </div>
              <div className="text-center border-l-2 border-gray-200">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-900">${rental.total_amount.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}