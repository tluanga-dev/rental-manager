/**
 * Rollback Management Panel Component
 * 
 * Interface for managing and executing rollbacks of sale transitions
 */

import React, { useState, useEffect } from 'react';
import {
  RotateCcwIcon,
  ClockIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  DollarSignIcon,
  UserIcon,
  InfoIcon,
  ShieldIcon,
  PackageIcon,
  ArrowRightIcon
} from 'lucide-react';
import { saleTransitionsApi } from '@/services/api/sale-transitions';
import {
  SaleTransitionListItem,
  TransitionStatus,
  TransitionStatusResponse,
  RollbackResult
} from '@/types/sale-transition';
import { useToast } from '@/hooks/useToast';
import { format, differenceInHours, addHours } from 'date-fns';

interface RollbackCandidate extends SaleTransitionListItem {
  rollback_deadline: Date;
  hours_remaining: number;
  affected_bookings_count: number;
  can_rollback: boolean;
}

const RollbackManagementPanel: React.FC = () => {
  const [rollbackCandidates, setRollbackCandidates] = useState<RollbackCandidate[]>([]);
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null);
  const [transitionDetails, setTransitionDetails] = useState<TransitionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rollbackReason, setRollbackReason] = useState('');
  const [processingRollback, setProcessingRollback] = useState(false);
  const [rollbackHistory, setRollbackHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'eligible' | 'history'>('eligible');
  const { showToast } = useToast();

  useEffect(() => {
    loadRollbackData();
    // Refresh every minute to update time remaining
    const interval = setInterval(loadRollbackData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedTransition) {
      loadTransitionDetails(selectedTransition);
    }
  }, [selectedTransition]);

  const loadRollbackData = async () => {
    try {
      setLoading(true);
      
      // Load completed transitions that are within rollback window (24 hours)
      const completedResponse = await saleTransitionsApi.getTransitions({
        status: TransitionStatus.COMPLETED,
        size: 50
      });

      // Filter and enhance with rollback information
      const candidates: RollbackCandidate[] = completedResponse.items
        .filter(t => t.completed_at)
        .map(transition => {
          const completedDate = new Date(transition.completed_at!);
          const rollbackDeadline = addHours(completedDate, 24);
          const hoursRemaining = differenceInHours(rollbackDeadline, new Date());
          
          return {
            ...transition,
            rollback_deadline: rollbackDeadline,
            hours_remaining: Math.max(0, hoursRemaining),
            affected_bookings_count: transition.conflicts_count || 0,
            can_rollback: hoursRemaining > 0
          };
        })
        .filter(t => t.can_rollback)
        .sort((a, b) => a.hours_remaining - b.hours_remaining); // Sort by urgency

      setRollbackCandidates(candidates);

      // Load rollback history
      const historyResponse = await saleTransitionsApi.getTransitions({
        status: TransitionStatus.ROLLED_BACK,
        size: 20
      });
      setRollbackHistory(historyResponse.items);

      // Auto-select first candidate if available
      if (candidates.length > 0 && !selectedTransition) {
        setSelectedTransition(candidates[0].id);
      }
    } catch (error) {
      console.error('Failed to load rollback data:', error);
      showToast('Failed to load rollback candidates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTransitionDetails = async (transitionId: string) => {
    try {
      const details = await saleTransitionsApi.getTransitionStatus(transitionId);
      setTransitionDetails(details);
    } catch (error) {
      console.error('Failed to load transition details:', error);
    }
  };

  const handleRollback = async () => {
    if (!selectedTransition || !rollbackReason.trim()) {
      showToast('Please provide a reason for rollback', 'warning');
      return;
    }

    if (!confirm('Are you sure you want to rollback this transition? This will restore the item to rental status and reinstate cancelled bookings.')) {
      return;
    }

    try {
      setProcessingRollback(true);
      const result: RollbackResult = await saleTransitionsApi.rollbackTransition(
        selectedTransition,
        rollbackReason
      );

      if (result.success) {
        showToast(
          `Rollback successful! ${result.items_restored} items restored, ${result.bookings_restored} bookings reinstated.`,
          'success'
        );
        
        // Remove from candidates list
        setRollbackCandidates(prev => prev.filter(c => c.id !== selectedTransition));
        
        // Clear selection
        setSelectedTransition(null);
        setTransitionDetails(null);
        setRollbackReason('');
        
        // Reload data
        loadRollbackData();
      } else {
        showToast(result.message || 'Rollback failed', 'error');
      }
    } catch (error) {
      console.error('Rollback failed:', error);
      showToast('Failed to execute rollback', 'error');
    } finally {
      setProcessingRollback(false);
    }
  };

  const getUrgencyColor = (hoursRemaining: number) => {
    if (hoursRemaining <= 2) return 'text-red-600 bg-red-100';
    if (hoursRemaining <= 6) return 'text-orange-600 bg-orange-100';
    if (hoursRemaining <= 12) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Rollback Management</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage and execute rollbacks for completed sale transitions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RotateCcwIcon className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium text-gray-600">
              {rollbackCandidates.length} eligible for rollback
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('eligible')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'eligible'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Eligible for Rollback ({rollbackCandidates.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'history'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Rollback History ({rollbackHistory.length})
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'eligible' ? (
        <>
          {/* Urgent Rollbacks Warning */}
          {rollbackCandidates.some(c => c.hours_remaining <= 2) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangleIcon className="w-5 h-5 text-red-600 mt-0.5 mr-3" />
                <div>
                  <p className="text-sm font-medium text-red-900">Urgent Rollbacks Required</p>
                  <p className="text-sm text-red-700 mt-1">
                    Some transitions are approaching their rollback deadline. Take action soon.
                  </p>
                </div>
              </div>
            </div>
          )}

          {rollbackCandidates.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="text-center">
                <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Rollback Candidates</h3>
                <p className="text-sm text-gray-500">
                  No completed transitions are currently eligible for rollback
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {/* Left Panel - List of Candidates */}
              <div className="col-span-1 bg-white rounded-lg shadow-sm">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Rollback Candidates</h3>
                </div>
                
                <div className="overflow-y-auto max-h-[600px]">
                  {rollbackCandidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      onClick={() => setSelectedTransition(candidate.id)}
                      className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        selectedTransition === candidate.id ? 'bg-purple-50 border-l-4 border-l-purple-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-gray-900 text-sm">
                          {candidate.item_name}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          getUrgencyColor(candidate.hours_remaining)
                        }`}>
                          {candidate.hours_remaining}h left
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">
                          Completed: {format(new Date(candidate.completed_at!), 'MMM d, h:mm a')}
                        </p>
                        <p className="text-xs text-gray-500">
                          Deadline: {format(candidate.rollback_deadline, 'MMM d, h:mm a')}
                        </p>
                        {candidate.affected_bookings_count > 0 && (
                          <p className="text-xs text-orange-600">
                            {candidate.affected_bookings_count} bookings to restore
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Panel - Rollback Details */}
              {selectedTransition && transitionDetails && (
                <div className="col-span-2 space-y-6">
                  {/* Transition Info */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Transition Details</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-gray-500">Item</p>
                        <p className="font-medium text-gray-900">{transitionDetails.item_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Transition ID</p>
                        <p className="font-medium text-gray-900">{selectedTransition.slice(0, 8)}...</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Completed At</p>
                        <p className="font-medium text-gray-900">
                          {format(new Date(rollbackCandidates.find(c => c.id === selectedTransition)?.completed_at || ''), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Time Remaining</p>
                        <p className={`font-medium ${
                          rollbackCandidates.find(c => c.id === selectedTransition)?.hours_remaining! <= 2
                            ? 'text-red-600'
                            : 'text-gray-900'
                        }`}>
                          {rollbackCandidates.find(c => c.id === selectedTransition)?.hours_remaining} hours
                        </p>
                      </div>
                    </div>

                    {/* Impact Summary */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Rollback Impact</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Items to Restore</p>
                          <p className="text-lg font-semibold text-gray-900">1</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Bookings to Reinstate</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {transitionDetails.conflicts_resolved}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Notifications to Send</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {transitionDetails.conflicts_resolved}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rollback Reason */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Execute Rollback</h3>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rollback Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={rollbackReason}
                        onChange={(e) => setRollbackReason(e.target.value)}
                        placeholder="Provide a detailed reason for this rollback..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        rows={4}
                      />
                    </div>

                    {/* Warning */}
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start">
                        <InfoIcon className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-yellow-900">Important Information</p>
                          <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                            <li>• Item will be restored to rental inventory</li>
                            <li>• Cancelled bookings will be reinstated</li>
                            <li>• Customers will be notified of the reinstatement</li>
                            <li>• This action cannot be undone</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={handleRollback}
                      disabled={processingRollback || !rollbackReason.trim()}
                      className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {processingRollback ? (
                        'Processing Rollback...'
                      ) : (
                        <>
                          <RotateCcwIcon className="w-5 h-5" />
                          Execute Rollback
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* History Tab */
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Rollback History</h3>
            
            {rollbackHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No rollback history available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rolled Back
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requested By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sale Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bookings Restored
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rollbackHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                            <p className="text-xs text-gray-500">ID: {item.item_id.slice(0, 8)}...</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-900">
                            {format(new Date(item.completed_at || item.request_date), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(item.completed_at || item.request_date), 'h:mm a')}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <UserIcon className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{item.requested_by_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(item.sale_price)}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <PackageIcon className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{item.conflicts_count || 0}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RollbackManagementPanel;