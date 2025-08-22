/**
 * Conflict Resolution Panel Component
 * 
 * Component for resolving conflicts in sale transitions
 */

import React, { useState, useEffect } from 'react';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  CalendarIcon,
  DollarSignIcon,
  PackageIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldAlertIcon,
  InfoIcon,
  ArrowRightIcon
} from 'lucide-react';
import { saleTransitionsApi } from '@/services/api/sale-transitions';
import {
  TransitionStatusResponse,
  AffectedBooking,
  ResolutionAction,
  TransitionConfirmationRequest,
  ConflictSeverity
} from '@/types/sale-transition';
import { useToast } from '@/hooks/useToast';
import { format } from 'date-fns';

interface Props {
  transitionId: string;
  onResolved?: () => void;
  onCancel?: () => void;
}

const ConflictResolutionPanel: React.FC<Props> = ({ transitionId, onResolved, onCancel }) => {
  const [status, setStatus] = useState<TransitionStatusResponse | null>(null);
  const [affectedBookings, setAffectedBookings] = useState<AffectedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<ResolutionAction>(
    ResolutionAction.WAIT_FOR_RETURN
  );
  const [resolutionOverrides, setResolutionOverrides] = useState<Record<string, ResolutionAction>>({});
  const [notificationMessage, setNotificationMessage] = useState('');
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  useEffect(() => {
    loadTransitionDetails();
  }, [transitionId]);

  const loadTransitionDetails = async () => {
    try {
      setLoading(true);
      const [statusData, bookingsData] = await Promise.all([
        saleTransitionsApi.getTransitionStatus(transitionId),
        saleTransitionsApi.getAffectedBookings(transitionId)
      ]);
      setStatus(statusData);
      setAffectedBookings(bookingsData);
    } catch (error) {
      console.error('Failed to load transition details:', error);
      showToast('Failed to load conflict details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResolution = async () => {
    if (!status) return;

    try {
      setResolving(true);
      const request: TransitionConfirmationRequest = {
        confirmed: true,
        resolution_strategy: selectedStrategy,
        resolution_overrides: resolutionOverrides,
        notification_message: notificationMessage || null
      };

      const result = await saleTransitionsApi.confirmTransition(transitionId, request);
      
      if (result.success) {
        showToast(
          `Transition completed successfully. ${result.conflicts_resolved} conflicts resolved, ${result.customers_notified} customers notified.`,
          'success'
        );
        onResolved?.();
      } else {
        showToast(result.message || 'Failed to resolve conflicts', 'error');
      }
    } catch (error) {
      console.error('Failed to resolve conflicts:', error);
      showToast('Failed to resolve conflicts', 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleCancel = async () => {
    try {
      setResolving(true);
      const request: TransitionConfirmationRequest = {
        confirmed: false,
        resolution_strategy: ResolutionAction.WAIT_FOR_RETURN,
        resolution_overrides: {},
        notification_message: null
      };

      await saleTransitionsApi.confirmTransition(transitionId, request);
      showToast('Transition cancelled', 'info');
      onCancel?.();
    } catch (error) {
      console.error('Failed to cancel transition:', error);
      showToast('Failed to cancel transition', 'error');
    } finally {
      setResolving(false);
    }
  };

  const toggleBookingExpanded = (bookingId: string) => {
    const newExpanded = new Set(expandedBookings);
    if (newExpanded.has(bookingId)) {
      newExpanded.delete(bookingId);
    } else {
      newExpanded.add(bookingId);
    }
    setExpandedBookings(newExpanded);
  };

  const setBookingResolution = (bookingId: string, action: ResolutionAction) => {
    setResolutionOverrides(prev => ({
      ...prev,
      [bookingId]: action
    }));
  };

  const getResolutionStrategyInfo = (action: ResolutionAction) => {
    const strategies = {
      [ResolutionAction.WAIT_FOR_RETURN]: {
        label: 'Wait for Return',
        description: 'Wait for items to be returned naturally before transitioning to sale',
        color: 'text-blue-600 bg-blue-100',
        icon: <ClockIcon className="w-5 h-5" />
      },
      [ResolutionAction.CANCEL_BOOKING]: {
        label: 'Cancel Bookings',
        description: 'Cancel affected bookings and notify customers immediately',
        color: 'text-red-600 bg-red-100',
        icon: <XCircleIcon className="w-5 h-5" />
      },
      [ResolutionAction.TRANSFER_TO_ALTERNATIVE]: {
        label: 'Offer Alternatives',
        description: 'Transfer customers to alternative items when available',
        color: 'text-green-600 bg-green-100',
        icon: <PackageIcon className="w-5 h-5" />
      },
      [ResolutionAction.OFFER_COMPENSATION]: {
        label: 'Offer Compensation',
        description: 'Cancel bookings with compensation offers to affected customers',
        color: 'text-purple-600 bg-purple-100',
        icon: <DollarSignIcon className="w-5 h-5" />
      },
      [ResolutionAction.POSTPONE_SALE]: {
        label: 'Postpone Sale',
        description: 'Delay the sale transition until after all conflicts are resolved',
        color: 'text-orange-600 bg-orange-100',
        icon: <CalendarIcon className="w-5 h-5" />
      },
      [ResolutionAction.FORCE_SALE]: {
        label: 'Force Sale',
        description: 'Override all conflicts and proceed with sale (requires special permission)',
        color: 'text-gray-600 bg-gray-100',
        icon: <ShieldAlertIcon className="w-5 h-5" />
      }
    };
    return strategies[action];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-red-50 rounded-lg p-6">
        <p className="text-red-600">Failed to load transition details</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Conflict Resolution</h2>
            <p className="mt-1 text-sm text-gray-500">
              Resolve conflicts for {status.item_name}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Progress</p>
              <p className="text-lg font-semibold text-gray-900">{status.progress_percentage}%</p>
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${status.progress_percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Conflicts Resolved</p>
            <p className="text-lg font-semibold text-gray-900">
              {status.conflicts_resolved} / {status.conflicts_resolved + status.conflicts_pending}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Notifications Sent</p>
            <p className="text-lg font-semibold text-gray-900">{status.notifications_sent}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Customer Responses</p>
            <p className="text-lg font-semibold text-gray-900">{status.customer_responses}</p>
          </div>
        </div>
      </div>

      {/* Resolution Strategy Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Resolution Strategy</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose how to handle conflicts for this transition
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.values(ResolutionAction).map(action => {
            const info = getResolutionStrategyInfo(action);
            return (
              <button
                key={action}
                onClick={() => setSelectedStrategy(action)}
                disabled={action === ResolutionAction.FORCE_SALE}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedStrategy === action
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${action === ResolutionAction.FORCE_SALE ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start">
                  <div className={`p-2 rounded-lg mr-3 ${info.color}`}>
                    {info.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{info.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{info.description}</p>
                  </div>
                  {selectedStrategy === action && (
                    <CheckCircleIcon className="w-5 h-5 text-blue-600 ml-2" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Affected Bookings */}
      {affectedBookings.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Affected Bookings ({affectedBookings.length})
          </h3>
          
          <div className="space-y-3">
            {affectedBookings.map(booking => (
              <div
                key={booking.booking_id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleBookingExpanded(booking.booking_id)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedBookings.has(booking.booking_id) ? (
                        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                      )}
                      <div className="text-left">
                        <p className="font-medium text-gray-900">
                          {booking.booking_reference}
                        </p>
                        <p className="text-sm text-gray-500">
                          {booking.customer_name} • {format(new Date(booking.pickup_date), 'MMM d')} - {format(new Date(booking.return_date), 'MMM d')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(booking.booking_value)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        booking.status === 'CONFIRMED' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                </button>
                
                {expandedBookings.has(booking.booking_id) && (
                  <div className="p-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Customer</p>
                        <p className="text-sm text-gray-900">{booking.customer_name}</p>
                        <p className="text-xs text-gray-500">{booking.customer_email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Booking Value</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(booking.booking_value)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Override Resolution for This Booking */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Override resolution for this booking
                      </p>
                      <select
                        value={resolutionOverrides[booking.booking_id] || selectedStrategy}
                        onChange={(e) => setBookingResolution(booking.booking_id, e.target.value as ResolutionAction)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Use default strategy</option>
                        {Object.values(ResolutionAction).map(action => {
                          const info = getResolutionStrategyInfo(action);
                          return (
                            <option key={action} value={action} disabled={action === ResolutionAction.FORCE_SALE}>
                              {info.label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    
                    {booking.compensation_offered && (
                      <div className="mt-3 bg-purple-50 rounded-lg p-3">
                        <p className="text-sm text-purple-900">
                          Compensation offered: {formatCurrency(booking.compensation_offered)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Notification Message */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Notification</h3>
        <p className="text-sm text-gray-600 mb-4">
          Add a custom message to include in customer notifications (optional)
        </p>
        <textarea
          value={notificationMessage}
          onChange={(e) => setNotificationMessage(e.target.value)}
          placeholder="Enter a personalized message for affected customers..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={4}
        />
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <InfoIcon className="w-5 h-5 text-blue-500" />
            <p className="text-sm text-gray-600">
              {status.conflicts_pending} conflict{status.conflicts_pending !== 1 ? 's' : ''} pending resolution
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={resolving}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel Transition
            </button>
            <button
              onClick={handleConfirmResolution}
              disabled={resolving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {resolving ? (
                'Processing...'
              ) : (
                <>
                  Confirm & Resolve
                  <ArrowRightIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionPanel;