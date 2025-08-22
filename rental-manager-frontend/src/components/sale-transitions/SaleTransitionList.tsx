/**
 * Sale Transition List Component
 * 
 * Displays list of sale transitions with filtering and actions
 */

import React, { useState, useEffect } from 'react';
import {
  ChevronRightIcon,
  AlertTriangleIcon,
  CheckIcon,
  XIcon,
  ClockIcon,
  RotateCcwIcon,
  UserIcon,
  CalendarIcon,
  DollarSignIcon
} from 'lucide-react';
import { saleTransitionsApi } from '@/services/api/sale-transitions';
import { 
  SaleTransitionListItem, 
  TransitionStatus 
} from '@/types/sale-transition';
import { useToast } from '@/hooks/useToast';
import { format } from 'date-fns';

interface Props {
  statusFilter?: TransitionStatus;
  onRefresh?: () => void;
}

const SaleTransitionList: React.FC<Props> = ({ statusFilter, onRefresh }) => {
  const [transitions, setTransitions] = useState<SaleTransitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTransition, setSelectedTransition] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadTransitions();
  }, [statusFilter, page]);

  const loadTransitions = async () => {
    try {
      setLoading(true);
      const params = {
        status: statusFilter,
        page,
        size: 10
      };
      const response = await saleTransitionsApi.getTransitions(params);
      setTransitions(response.items);
      setTotalPages(Math.ceil(response.total / response.size));
    } catch (error) {
      console.error('Failed to load transitions:', error);
      showToast('Failed to load transitions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: TransitionStatus) => {
    const statusConfig = {
      [TransitionStatus.PENDING]: {
        color: 'bg-yellow-100 text-yellow-800',
        icon: <ClockIcon className="w-4 h-4" />,
        label: 'Pending'
      },
      [TransitionStatus.PROCESSING]: {
        color: 'bg-blue-100 text-blue-800',
        icon: <ClockIcon className="w-4 h-4 animate-spin" />,
        label: 'Processing'
      },
      [TransitionStatus.AWAITING_APPROVAL]: {
        color: 'bg-orange-100 text-orange-800',
        icon: <UserIcon className="w-4 h-4" />,
        label: 'Awaiting Approval'
      },
      [TransitionStatus.APPROVED]: {
        color: 'bg-indigo-100 text-indigo-800',
        icon: <CheckIcon className="w-4 h-4" />,
        label: 'Approved'
      },
      [TransitionStatus.COMPLETED]: {
        color: 'bg-green-100 text-green-800',
        icon: <CheckIcon className="w-4 h-4" />,
        label: 'Completed'
      },
      [TransitionStatus.FAILED]: {
        color: 'bg-red-100 text-red-800',
        icon: <XIcon className="w-4 h-4" />,
        label: 'Failed'
      },
      [TransitionStatus.REJECTED]: {
        color: 'bg-gray-100 text-gray-800',
        icon: <XIcon className="w-4 h-4" />,
        label: 'Rejected'
      },
      [TransitionStatus.ROLLED_BACK]: {
        color: 'bg-purple-100 text-purple-800',
        icon: <RotateCcwIcon className="w-4 h-4" />,
        label: 'Rolled Back'
      }
    };

    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleViewDetails = (transitionId: string) => {
    // Navigate to detail page or open modal
    setSelectedTransition(transitionId);
    // TODO: Implement navigation or modal
  };

  const handleApprove = async (transitionId: string) => {
    try {
      await saleTransitionsApi.approveTransition(transitionId);
      showToast('Transition approved successfully', 'success');
      loadTransitions();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to approve transition:', error);
      showToast('Failed to approve transition', 'error');
    }
  };

  const handleReject = async (transitionId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      await saleTransitionsApi.rejectTransition(transitionId, reason);
      showToast('Transition rejected', 'success');
      loadTransitions();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to reject transition:', error);
      showToast('Failed to reject transition', 'error');
    }
  };

  const handleRollback = async (transitionId: string) => {
    const reason = prompt('Please provide a reason for rollback:');
    if (!reason) return;

    try {
      await saleTransitionsApi.rollbackTransition(transitionId, reason);
      showToast('Transition rolled back successfully', 'success');
      loadTransitions();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to rollback transition:', error);
      showToast('Failed to rollback transition', 'error');
    }
  };

  if (loading && transitions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Recent Transitions</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Requested By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sale Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Conflicts
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transitions.map((transition) => (
              <tr key={transition.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {transition.item_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {transition.item_id.slice(0, 8)}...
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(transition.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <UserIcon className="w-4 h-4 text-gray-400 mr-2" />
                    <div>
                      <div className="text-sm text-gray-900">
                        {transition.requested_by_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(transition.request_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatCurrency(transition.sale_price)}
                  </div>
                  {transition.effective_date && (
                    <div className="text-xs text-gray-500">
                      Effective: {format(new Date(transition.effective_date), 'MMM d')}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {transition.conflicts_count > 0 ? (
                    <div className="flex items-center">
                      <AlertTriangleIcon className="w-4 h-4 text-yellow-500 mr-1" />
                      <span className="text-sm text-gray-900">
                        {transition.conflicts_count}
                      </span>
                      {transition.revenue_impact && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({formatCurrency(transition.revenue_impact)})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-green-600">None</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <CalendarIcon className="w-4 h-4 text-gray-400 mr-1" />
                    {format(new Date(transition.request_date), 'MMM d, h:mm a')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {transition.status === TransitionStatus.AWAITING_APPROVAL && (
                      <>
                        <button
                          onClick={() => handleApprove(transition.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Approve"
                        >
                          <CheckIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleReject(transition.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Reject"
                        >
                          <XIcon className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    {transition.status === TransitionStatus.COMPLETED && (
                      <button
                        onClick={() => handleRollback(transition.id)}
                        className="text-purple-600 hover:text-purple-900"
                        title="Rollback"
                      >
                        <RotateCcwIcon className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleViewDetails(transition.id)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View Details"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaleTransitionList;