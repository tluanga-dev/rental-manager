import React, { useState, useEffect } from 'react';
import { 
  CalendarDaysIcon, 
  BanknotesIcon as CurrencyIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import axios from '@/lib/axios';

interface ExtensionHistoryItem {
  extension_id: string;
  extension_date: string;
  original_end_date: string;
  new_end_date: string;
  extension_type: string;
  extension_charges: number;
  payment_received: number;
  payment_status: string;
  extended_by?: string;
  notes?: string;
}

interface ExtensionHistoryProps {
  rentalId: string;
}

export default function ExtensionHistory({ rentalId }: ExtensionHistoryProps) {
  const [extensions, setExtensions] = useState<ExtensionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalExtensions, setTotalExtensions] = useState(0);

  useEffect(() => {
    fetchExtensionHistory();
  }, [rentalId]);

  const fetchExtensionHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/transactions/rentals/${rentalId}/extension-history`);
      setExtensions(response.data.extensions || []);
      setTotalExtensions(response.data.total_extensions || 0);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load extension history');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      'PAID': { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' },
      'PARTIAL': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Partial' },
      'PENDING': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Pending' }
    };

    const config = statusConfig[status] || statusConfig['PENDING'];
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getExtensionTypeBadge = (type: string) => {
    const typeConfig: Record<string, { bg: string; text: string; label: string }> = {
      'FULL': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Full Extension' },
      'PARTIAL': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Partial Extension' }
    };

    const config = typeConfig[type] || typeConfig['FULL'];
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600 text-sm">{error}</div>
      </div>
    );
  }

  if (extensions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <ClockIcon className="w-5 h-5 mr-2" />
          Extension History
        </h3>
        <p className="text-gray-500 text-sm">No extensions have been made for this rental.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <ClockIcon className="w-5 h-5 mr-2" />
          Extension History
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          This rental has been extended {totalExtensions} time{totalExtensions !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-4">
        {extensions.map((extension, index) => (
          <div
            key={extension.extension_id}
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                  {totalExtensions - index}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Extension on {format(new Date(extension.extension_date), 'MMM dd, yyyy')}
                  </p>
                  {getExtensionTypeBadge(extension.extension_type)}
                </div>
              </div>
              {getPaymentStatusBadge(extension.payment_status)}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {/* Date Range */}
              <div className="flex items-start">
                <CalendarDaysIcon className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                <div>
                  <p className="text-gray-600">Period Extended</p>
                  <p className="font-medium">
                    {format(new Date(extension.original_end_date), 'MMM dd')} → {format(new Date(extension.new_end_date), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>

              {/* Financial */}
              <div className="flex items-start">
                <CurrencyIcon className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                <div>
                  <p className="text-gray-600">Charges / Paid</p>
                  <p className="font-medium">
                    ₹{extension.extension_charges.toFixed(2)} / ₹{extension.payment_received.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Extended By */}
              {extension.extended_by && (
                <div className="flex items-start">
                  <UserIcon className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                  <div>
                    <p className="text-gray-600">Extended By</p>
                    <p className="font-medium">{extension.extended_by}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {extension.notes && (
                <div className="flex items-start">
                  <DocumentTextIcon className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                  <div>
                    <p className="text-gray-600">Notes</p>
                    <p className="font-medium">{extension.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Balance Info */}
            {extension.payment_status !== 'PAID' && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm">
                  <span className="text-gray-600">Outstanding:</span>{' '}
                  <span className="font-medium text-orange-600">
                    ₹{(extension.extension_charges - extension.payment_received).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Total Extension Charges</p>
            <p className="text-lg font-semibold">
              ₹{extensions.reduce((sum, ext) => sum + ext.extension_charges, 0).toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Paid on Extensions</p>
            <p className="text-lg font-semibold text-green-600">
              ₹{extensions.reduce((sum, ext) => sum + ext.payment_received, 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}