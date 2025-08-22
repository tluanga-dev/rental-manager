/**
 * Approval Management Panel Component
 * 
 * Component for managers to review and approve sale transitions
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  UserIcon,
  CalendarIcon,
  DollarSignIcon,
  FileTextIcon,
  ShieldIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  AlertCircleIcon
} from 'lucide-react';
import { saleTransitionsApi } from '@/services/api/sale-transitions';
import {
  SaleTransitionListItem,
  TransitionStatus,
  TransitionStatusResponse,
  AffectedBooking
} from '@/types/sale-transition';
import { useToast } from '@/hooks/useToast';
import { format } from 'date-fns';

interface Props {
  onApproved?: () => void;
  onRejected?: () => void;
}

const ApprovalManagementPanel: React.FC<Props> = ({ onApproved, onRejected }) => {
  const [pendingApprovals, setPendingApprovals] = useState<SaleTransitionListItem[]>([]);
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null);
  const [transitionDetails, setTransitionDetails] = useState<TransitionStatusResponse | null>(null);
  const [affectedBookings, setAffectedBookings] = useState<AffectedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['details']));
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  useEffect(() => {
    if (selectedTransition) {
      loadTransitionDetails(selectedTransition);
    }
  }, [selectedTransition]);

  const loadPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await saleTransitionsApi.getTransitions({
        status: TransitionStatus.AWAITING_APPROVAL,
        size: 50
      });
      setPendingApprovals(response.items);
      
      // Auto-select first item if available
      if (response.items.length > 0 && !selectedTransition) {
        setSelectedTransition(response.items[0].id);
      }
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
      showToast('Failed to load pending approvals', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTransitionDetails = async (transitionId: string) => {
    try {
      const [statusData, bookingsData] = await Promise.all([
        saleTransitionsApi.getTransitionStatus(transitionId),
        saleTransitionsApi.getAffectedBookings(transitionId)
      ]);
      setTransitionDetails(statusData);
      setAffectedBookings(bookingsData);
    } catch (error) {
      console.error('Failed to load transition details:', error);
      showToast('Failed to load transition details', 'error');
    }
  };

  const handleApprove = async (transitionId: string) => {
    if (!confirm('Are you sure you want to approve this transition?')) return;

    try {
      setProcessingId(transitionId);
      await saleTransitionsApi.approveTransition(transitionId, approvalNotes);
      showToast('Transition approved successfully', 'success');
      
      // Remove from list
      setPendingApprovals(prev => prev.filter(t => t.id !== transitionId));
      
      // Select next item
      const currentIndex = pendingApprovals.findIndex(t => t.id === transitionId);
      if (currentIndex < pendingApprovals.length - 1) {
        setSelectedTransition(pendingApprovals[currentIndex + 1].id);
      } else if (currentIndex > 0) {
        setSelectedTransition(pendingApprovals[currentIndex - 1].id);
      } else {
        setSelectedTransition(null);
        setTransitionDetails(null);
        setAffectedBookings([]);
      }
      
      setApprovalNotes('');
      onApproved?.();
    } catch (error) {
      console.error('Failed to approve transition:', error);
      showToast('Failed to approve transition', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (transitionId: string) => {
    if (!rejectionReason.trim()) {
      showToast('Please provide a reason for rejection', 'warning');
      return;
    }

    if (!confirm('Are you sure you want to reject this transition?')) return;

    try {
      setProcessingId(transitionId);
      await saleTransitionsApi.rejectTransition(transitionId, rejectionReason);
      showToast('Transition rejected', 'success');
      
      // Remove from list
      setPendingApprovals(prev => prev.filter(t => t.id !== transitionId));
      
      // Select next item
      const currentIndex = pendingApprovals.findIndex(t => t.id === transitionId);
      if (currentIndex < pendingApprovals.length - 1) {
        setSelectedTransition(pendingApprovals[currentIndex + 1].id);
      } else if (currentIndex > 0) {
        setSelectedTransition(pendingApprovals[currentIndex - 1].id);
      } else {
        setSelectedTransition(null);
        setTransitionDetails(null);
        setAffectedBookings([]);
      }
      
      setRejectionReason('');
      onRejected?.();
    } catch (error) {
      console.error('Failed to reject transition:', error);
      showToast('Failed to reject transition', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getSeverityColor = (impact: number) => {
    if (impact > 5000) return 'text-red-600 bg-red-100';
    if (impact > 1000) return 'text-orange-600 bg-orange-100';
    if (impact > 500) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (pendingApprovals.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Approvals</h3>
          <p className="text-sm text-gray-500">All sale transitions have been reviewed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left Panel - List of Pending Approvals */}
      <div className="col-span-1 bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Pending Approvals ({pendingApprovals.length})
          </h3>
        </div>
        
        <div className="overflow-y-auto max-h-[600px]">
          {pendingApprovals.map((transition) => (
            <button
              key={transition.id}
              onClick={() => setSelectedTransition(transition.id)}
              className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedTransition === transition.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
              disabled={processingId === transition.id}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">
                    {transition.item_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Requested by {transition.requested_by_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(transition.request_date), 'MMM d, h:mm a')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(transition.sale_price)}
                  </p>
                  {transition.conflicts_count > 0 && (
                    <div className="flex items-center justify-end mt-1">
                      <AlertTriangleIcon className="w-3 h-3 text-yellow-500 mr-1" />
                      <span className="text-xs text-yellow-600">
                        {transition.conflicts_count} conflicts
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Panel - Detailed View */}
      {selectedTransition && transitionDetails && (
        <div className="col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {transitionDetails.item_name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Transition ID: {selectedTransition.slice(0, 8)}...
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ShieldIcon className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-medium text-orange-600">
                  Approval Required
                </span>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Sale Price</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(pendingApprovals.find(t => t.id === selectedTransition)?.sale_price || 0)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Revenue Impact</p>
                <p className={`text-lg font-semibold ${
                  (pendingApprovals.find(t => t.id === selectedTransition)?.revenue_impact || 0) > 1000
                    ? 'text-red-600'
                    : 'text-gray-900'
                }`}>
                  {formatCurrency(pendingApprovals.find(t => t.id === selectedTransition)?.revenue_impact || 0)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Conflicts</p>
                <p className="text-lg font-semibold text-gray-900">
                  {transitionDetails.conflicts_pending + transitionDetails.conflicts_resolved}
                </p>
              </div>
            </div>
          </div>

          {/* Transition Details */}
          <div className="bg-white rounded-lg shadow-sm">
            <button
              onClick={() => toggleSection('details')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <h3 className="text-lg font-medium text-gray-900">Transition Details</h3>
              {expandedSections.has('details') ? (
                <ChevronDownIcon className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRightIcon className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.has('details') && (
              <div className="px-6 pb-6 space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Requested By</span>
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {pendingApprovals.find(t => t.id === selectedTransition)?.requested_by_name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Request Date</span>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {format(new Date(pendingApprovals.find(t => t.id === selectedTransition)?.request_date || ''), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Progress</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      {transitionDetails.progress_percentage}%
                    </span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${transitionDetails.progress_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Current Step</span>
                  <span className="text-sm font-medium text-gray-900">
                    {transitionDetails.current_step}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Affected Bookings */}
          {affectedBookings.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm">
              <button
                onClick={() => toggleSection('bookings')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium text-gray-900">
                    Affected Bookings ({affectedBookings.length})
                  </h3>
                  {affectedBookings.length > 3 && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                      High Impact
                    </span>
                  )}
                </div>
                {expandedSections.has('bookings') ? (
                  <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              {expandedSections.has('bookings') && (
                <div className="px-6 pb-6">
                  <div className="space-y-3">
                    {affectedBookings.map((booking) => (
                      <div key={booking.booking_id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-900">
                            {booking.booking_reference}
                          </p>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'CONFIRMED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Customer</p>
                            <p className="text-gray-900">{booking.customer_name}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Value</p>
                            <p className="font-medium text-gray-900">
                              {formatCurrency(booking.booking_value)}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Dates</p>
                            <p className="text-gray-900">
                              {format(new Date(booking.pickup_date), 'MMM d')} - {format(new Date(booking.return_date), 'MMM d')}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Resolution</p>
                            <p className="text-gray-900">
                              {booking.resolution_action || 'Pending'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Total Impact */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Total Booking Value at Risk
                      </span>
                      <span className={`text-lg font-semibold ${
                        affectedBookings.reduce((sum, b) => sum + b.booking_value, 0) > 1000
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}>
                        {formatCurrency(affectedBookings.reduce((sum, b) => sum + b.booking_value, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approval Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Approval Decision</h3>
            
            {/* Notes Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approval Notes (Optional)
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any notes for the approval record..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>

            {/* Rejection Reason Field */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rejection Reason (Required for rejection)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a reason if rejecting this transition..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>

            {/* Warning Messages */}
            {affectedBookings.length > 5 && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircleIcon className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900">High Impact Transition</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      This transition affects {affectedBookings.length} bookings with a total value of{' '}
                      {formatCurrency(affectedBookings.reduce((sum, b) => sum + b.booking_value, 0))}.
                      Please review carefully before approving.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(selectedTransition)}
                disabled={processingId === selectedTransition}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {processingId === selectedTransition ? (
                  'Processing...'
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Approve Transition
                  </>
                )}
              </button>
              <button
                onClick={() => handleReject(selectedTransition)}
                disabled={processingId === selectedTransition || !rejectionReason.trim()}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {processingId === selectedTransition ? (
                  'Processing...'
                ) : (
                  <>
                    <XCircleIcon className="w-5 h-5" />
                    Reject Transition
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalManagementPanel;