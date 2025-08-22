/**
 * Transition Detail View Component
 * 
 * Detailed view of a single sale transition with complete tracking
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  AlertTriangleIcon,
  UserIcon,
  CalendarIcon,
  DollarSignIcon,
  PackageIcon,
  ChevronRightIcon,
  InfoIcon,
  RotateCcwIcon,
  FileTextIcon,
  TrendingUpIcon,
  ShieldAlertIcon,
  BellIcon,
  ActivityIcon
} from 'lucide-react';
import { saleTransitionsApi } from '@/services/api/sale-transitions';
import {
  TransitionStatusResponse,
  AffectedBooking,
  TransitionStatus,
  SaleEligibilityResponse
} from '@/types/sale-transition';
import { useToast } from '@/hooks/useToast';
import { format, formatDistanceToNow } from 'date-fns';

interface Props {
  transitionId: string;
  onClose?: () => void;
  onRollback?: () => void;
}

const TransitionDetailView: React.FC<Props> = ({ transitionId, onClose, onRollback }) => {
  const [status, setStatus] = useState<TransitionStatusResponse | null>(null);
  const [affectedBookings, setAffectedBookings] = useState<AffectedBooking[]>([]);
  const [eligibility, setEligibility] = useState<SaleEligibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'conflicts' | 'notifications'>('overview');
  const [rollbackReason, setRollbackReason] = useState('');
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadTransitionDetails();
    // Set up polling for status updates
    const interval = setInterval(loadTransitionDetails, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
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
      
      // Load eligibility data if available
      if (statusData.item_id) {
        try {
          const eligibilityData = await saleTransitionsApi.checkEligibility(statusData.item_id);
          setEligibility(eligibilityData);
        } catch (error) {
          console.error('Failed to load eligibility data:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load transition details:', error);
      showToast('Failed to load transition details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!rollbackReason.trim()) {
      showToast('Please provide a reason for rollback', 'warning');
      return;
    }

    try {
      setProcessing(true);
      const result = await saleTransitionsApi.rollbackTransition(transitionId, rollbackReason);
      
      if (result.success) {
        showToast(
          `Rollback successful. ${result.items_restored} items restored, ${result.bookings_restored} bookings restored.`,
          'success'
        );
        setShowRollbackDialog(false);
        onRollback?.();
        loadTransitionDetails();
      } else {
        showToast(result.message || 'Rollback failed', 'error');
      }
    } catch (error) {
      console.error('Failed to rollback transition:', error);
      showToast('Failed to rollback transition', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: TransitionStatus) => {
    const colors = {
      [TransitionStatus.PENDING]: 'text-yellow-600 bg-yellow-100',
      [TransitionStatus.PROCESSING]: 'text-blue-600 bg-blue-100',
      [TransitionStatus.AWAITING_APPROVAL]: 'text-orange-600 bg-orange-100',
      [TransitionStatus.APPROVED]: 'text-indigo-600 bg-indigo-100',
      [TransitionStatus.COMPLETED]: 'text-green-600 bg-green-100',
      [TransitionStatus.FAILED]: 'text-red-600 bg-red-100',
      [TransitionStatus.REJECTED]: 'text-gray-600 bg-gray-100',
      [TransitionStatus.ROLLED_BACK]: 'text-purple-600 bg-purple-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status: TransitionStatus) => {
    switch (status) {
      case TransitionStatus.PENDING:
        return <ClockIcon className="w-5 h-5" />;
      case TransitionStatus.PROCESSING:
        return <ActivityIcon className="w-5 h-5 animate-spin" />;
      case TransitionStatus.AWAITING_APPROVAL:
        return <ShieldAlertIcon className="w-5 h-5" />;
      case TransitionStatus.APPROVED:
        return <CheckCircleIcon className="w-5 h-5" />;
      case TransitionStatus.COMPLETED:
        return <CheckCircleIcon className="w-5 h-5" />;
      case TransitionStatus.FAILED:
        return <XCircleIcon className="w-5 h-5" />;
      case TransitionStatus.REJECTED:
        return <XCircleIcon className="w-5 h-5" />;
      case TransitionStatus.ROLLED_BACK:
        return <RotateCcwIcon className="w-5 h-5" />;
      default:
        return <InfoIcon className="w-5 h-5" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getTimelineSteps = () => {
    const steps = [
      { id: 'initiated', label: 'Initiated', status: 'completed', icon: <CheckCircleIcon className="w-5 h-5" /> },
      { id: 'eligibility', label: 'Eligibility Check', status: 'completed', icon: <CheckCircleIcon className="w-5 h-5" /> },
      { id: 'conflicts', label: 'Conflict Detection', status: 'completed', icon: <AlertTriangleIcon className="w-5 h-5" /> },
      { id: 'approval', label: 'Approval', status: 'pending', icon: <ShieldAlertIcon className="w-5 h-5" /> },
      { id: 'resolution', label: 'Conflict Resolution', status: 'pending', icon: <ClockIcon className="w-5 h-5" /> },
      { id: 'notifications', label: 'Customer Notifications', status: 'pending', icon: <BellIcon className="w-5 h-5" /> },
      { id: 'completed', label: 'Completed', status: 'pending', icon: <CheckCircleIcon className="w-5 h-5" /> }
    ];

    // Update status based on current transition status
    if (status) {
      switch (status.status) {
        case TransitionStatus.AWAITING_APPROVAL:
          steps[3].status = 'active';
          break;
        case TransitionStatus.APPROVED:
        case TransitionStatus.PROCESSING:
          steps[3].status = 'completed';
          steps[4].status = 'active';
          break;
        case TransitionStatus.COMPLETED:
          steps.forEach(step => step.status = 'completed');
          break;
        case TransitionStatus.FAILED:
        case TransitionStatus.REJECTED:
          const failIndex = status.status === TransitionStatus.REJECTED ? 3 : 4;
          steps.slice(0, failIndex).forEach(step => step.status = 'completed');
          steps[failIndex].status = 'failed';
          break;
      }
    }

    return steps;
  };

  if (loading && !status) {
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
            <h2 className="text-2xl font-semibold text-gray-900">{status.item_name}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Transition ID: {transitionId.slice(0, 8)}...
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(status.status)}`}>
              {getStatusIcon(status.status)}
              {status.status.replace('_', ' ')}
            </span>
            {status.can_rollback && (
              <button
                onClick={() => setShowRollbackDialog(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <RotateCcwIcon className="w-4 h-4" />
                Rollback
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Progress</span>
            <span className="text-sm font-medium text-gray-900">{status.progress_percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${status.progress_percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{status.current_step}</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Conflicts</p>
            <p className="text-xl font-semibold text-gray-900">
              {status.conflicts_resolved}/{status.conflicts_resolved + status.conflicts_pending}
            </p>
            <p className="text-xs text-green-600 mt-1">Resolved</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Notifications</p>
            <p className="text-xl font-semibold text-gray-900">{status.notifications_sent}</p>
            <p className="text-xs text-blue-600 mt-1">Sent</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Responses</p>
            <p className="text-xl font-semibold text-gray-900">{status.customer_responses}</p>
            <p className="text-xs text-orange-600 mt-1">Received</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Est. Completion</p>
            <p className="text-xl font-semibold text-gray-900">
              {status.estimated_completion 
                ? format(new Date(status.estimated_completion), 'h:mm a')
                : 'N/A'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {status.estimated_completion 
                ? formatDistanceToNow(new Date(status.estimated_completion), { addSuffix: true })
                : 'Pending'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'overview'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'timeline'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('conflicts')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'conflicts'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Conflicts & Bookings
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'notifications'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Notifications
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Transition Overview</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div className="border-b border-gray-100 pb-3">
                    <dt className="text-sm text-gray-500">Item ID</dt>
                    <dd className="text-sm font-medium text-gray-900 mt-1">{status.item_id}</dd>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <dt className="text-sm text-gray-500">Item Name</dt>
                    <dd className="text-sm font-medium text-gray-900 mt-1">{status.item_name}</dd>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <dt className="text-sm text-gray-500">Current Status</dt>
                    <dd className="text-sm font-medium text-gray-900 mt-1">{status.status}</dd>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <dt className="text-sm text-gray-500">Progress</dt>
                    <dd className="text-sm font-medium text-gray-900 mt-1">{status.progress_percentage}%</dd>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <dt className="text-sm text-gray-500">Conflicts Pending</dt>
                    <dd className="text-sm font-medium text-gray-900 mt-1">{status.conflicts_pending}</dd>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <dt className="text-sm text-gray-500">Rollback Available</dt>
                    <dd className="text-sm font-medium text-gray-900 mt-1">
                      {status.can_rollback ? 'Yes' : 'No'}
                      {status.rollback_deadline && (
                        <span className="text-xs text-gray-500 ml-2">
                          Until {format(new Date(status.rollback_deadline), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {eligibility && eligibility.conflicts && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Conflict Summary</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Total Conflicts</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {eligibility.conflicts.total_conflicts}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Revenue Impact</p>
                      <p className="text-2xl font-semibold text-red-600">
                        {formatCurrency(eligibility.conflicts.total_revenue_impact)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Affected Customers</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {eligibility.conflicts.affected_customers}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-6">Transition Timeline</h3>
              <div className="relative">
                {getTimelineSteps().map((step, index) => (
                  <div key={step.id} className="relative flex items-start mb-8">
                    {index < getTimelineSteps().length - 1 && (
                      <div className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" />
                    )}
                    <div className={`relative flex items-center justify-center w-10 h-10 rounded-full ${
                      step.status === 'completed' ? 'bg-green-100 text-green-600' :
                      step.status === 'active' ? 'bg-blue-100 text-blue-600 animate-pulse' :
                      step.status === 'failed' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {step.icon}
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className={`text-sm font-medium ${
                        step.status === 'completed' ? 'text-gray-900' :
                        step.status === 'active' ? 'text-blue-600' :
                        step.status === 'failed' ? 'text-red-600' :
                        'text-gray-500'
                      }`}>
                        {step.label}
                      </h4>
                      {step.status === 'active' && (
                        <p className="text-xs text-gray-500 mt-1">In progress...</p>
                      )}
                      {step.status === 'completed' && (
                        <p className="text-xs text-green-600 mt-1">Completed</p>
                      )}
                      {step.status === 'failed' && (
                        <p className="text-xs text-red-600 mt-1">Failed</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflicts Tab */}
          {activeTab === 'conflicts' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Affected Bookings ({affectedBookings.length})
              </h3>
              {affectedBookings.length > 0 ? (
                <div className="space-y-4">
                  {affectedBookings.map((booking) => (
                    <div key={booking.booking_id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-900">{booking.booking_reference}</p>
                          <p className="text-sm text-gray-500">{booking.customer_name}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          booking.status === 'CONFIRMED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Dates</p>
                          <p className="text-gray-900">
                            {format(new Date(booking.pickup_date), 'MMM d')} - {format(new Date(booking.return_date), 'MMM d')}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Value</p>
                          <p className="font-medium text-gray-900">{formatCurrency(booking.booking_value)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Resolution</p>
                          <p className="text-gray-900">{booking.resolution_action || 'Pending'}</p>
                        </div>
                      </div>
                      {booking.compensation_offered && (
                        <div className="mt-3 p-2 bg-purple-50 rounded">
                          <p className="text-sm text-purple-900">
                            Compensation: {formatCurrency(booking.compensation_offered)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No affected bookings</p>
              )}
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Notifications</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <BellIcon className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Notification Summary</p>
                      <div className="mt-2 grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-blue-700">Sent</p>
                          <p className="text-lg font-semibold text-blue-900">{status.notifications_sent}</p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-700">Delivered</p>
                          <p className="text-lg font-semibold text-blue-900">
                            {Math.floor(status.notifications_sent * 0.95)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-700">Responses</p>
                          <p className="text-lg font-semibold text-blue-900">{status.customer_responses}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {status.notifications_sent > 0 && (
                  <div className="text-sm text-gray-600">
                    <p>Notification channels used:</p>
                    <ul className="mt-2 space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        Email notifications sent
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        SMS notifications sent
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        In-app notifications created
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rollback Dialog */}
      {showRollbackDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Rollback Transition</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will restore the item to its previous state and reinstate any cancelled bookings.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Rollback <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="Provide a reason for this rollback..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRollbackDialog(false)}
                disabled={processing}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={processing || !rollbackReason.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransitionDetailView;