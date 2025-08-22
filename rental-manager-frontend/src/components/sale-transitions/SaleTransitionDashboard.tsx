/**
 * Sale Transition Dashboard Component
 * 
 * Main dashboard for managing sale transitions
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUpIcon, 
  AlertCircleIcon, 
  CheckCircleIcon, 
  ClockIcon,
  XCircleIcon,
  RotateCcwIcon,
  DollarSignIcon,
  UsersIcon,
  PlusIcon,
  ShieldIcon
} from 'lucide-react';
import { saleTransitionsApi } from '@/services/api/sale-transitions';
import { TransitionMetrics, TransitionStatus } from '@/types/sale-transition';
import SaleTransitionList from './SaleTransitionList';
import { useToast } from '@/hooks/useToast';

const SaleTransitionDashboard: React.FC = () => {
  const router = useRouter();
  const [metrics, setMetrics] = useState<TransitionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<TransitionStatus | 'ALL'>('ALL');
  const { showToast } = useToast();

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await saleTransitionsApi.getMetrics();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      showToast('Failed to load dashboard metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-100';
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-100';
      case 'AWAITING_APPROVAL':
        return 'text-orange-600 bg-orange-100';
      case 'FAILED':
        return 'text-red-600 bg-red-100';
      case 'PROCESSING':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Sale Transitions</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage item transitions from rental to sale inventory
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/sales/transitions/check-eligibility')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Check Eligibility
            </button>
            {metrics && metrics.awaiting_approval > 0 && (
              <button
                onClick={() => router.push('/sales/transitions/approvals')}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
              >
                <ShieldIcon className="w-4 h-4" />
                Review Approvals ({metrics.awaiting_approval})
              </button>
            )}
            <button
              onClick={loadMetrics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Transitions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Transitions</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {metrics.total_transitions}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUpIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Pending Transitions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {metrics.pending_transitions}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {metrics.awaiting_approval} awaiting approval
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Revenue Protected */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenue Protected</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {formatCurrency(metrics.total_revenue_protected)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  From conflict resolution
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSignIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Avg Resolution Time */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Resolution Time</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {formatTime(metrics.average_resolution_time)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {metrics.conflicts_resolved_today} resolved today
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setSelectedStatus('ALL')}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedStatus === 'ALL'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">All</span>
              <span className="text-2xl font-bold text-gray-900">
                {metrics.total_transitions}
              </span>
            </div>
          </button>

          <button
            onClick={() => setSelectedStatus(TransitionStatus.COMPLETED)}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedStatus === TransitionStatus.COMPLETED
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-600">Completed</span>
              <span className="text-2xl font-bold text-green-600">
                {metrics.completed_today}
              </span>
            </div>
          </button>

          <button
            onClick={() => setSelectedStatus(TransitionStatus.AWAITING_APPROVAL)}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedStatus === TransitionStatus.AWAITING_APPROVAL
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-orange-600">Approvals</span>
              <span className="text-2xl font-bold text-orange-600">
                {metrics.awaiting_approval}
              </span>
            </div>
          </button>

          <button
            onClick={() => setSelectedStatus(TransitionStatus.FAILED)}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedStatus === TransitionStatus.FAILED
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-600">Failed</span>
              <span className="text-2xl font-bold text-red-600">
                {metrics.failed_today}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Quick Stats */}
      {metrics && metrics.rollback_count > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <RotateCcwIcon className="h-5 w-5 text-yellow-600 mr-2" />
            <span className="text-sm text-yellow-800">
              {metrics.rollback_count} transition{metrics.rollback_count !== 1 ? 's' : ''} rolled back in the last 24 hours
            </span>
          </div>
        </div>
      )}

      {/* Transition List */}
      <SaleTransitionList 
        statusFilter={selectedStatus === 'ALL' ? undefined : selectedStatus}
        onRefresh={loadMetrics}
      />
    </div>
  );
};

export default SaleTransitionDashboard;