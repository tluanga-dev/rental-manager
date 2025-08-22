/**
 * Sale Eligibility Check Component
 * 
 * Component for checking if an item is eligible for sale transition
 */

import React, { useState } from 'react';
import {
  SearchIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  ArrowRightIcon,
  ShieldAlertIcon,
  DollarSignIcon,
  UsersIcon
} from 'lucide-react';
import { saleTransitionsApi } from '@/services/api/sale-transitions';
import {
  SaleEligibilityResponse,
  ConflictSeverity,
  ConflictType,
  SaleTransitionInitiateRequest
} from '@/types/sale-transition';
import { useToast } from '@/hooks/useToast';

interface Props {
  itemId?: string;
  onTransitionInitiated?: (transitionId: string) => void;
}

const SaleEligibilityCheck: React.FC<Props> = ({ itemId: initialItemId, onTransitionInitiated }) => {
  const [itemId, setItemId] = useState(initialItemId || '');
  const [checking, setChecking] = useState(false);
  const [eligibility, setEligibility] = useState<SaleEligibilityResponse | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [notes, setNotes] = useState('');
  const { showToast } = useToast();

  const checkEligibility = async () => {
    if (!itemId.trim()) {
      showToast('Please enter an item ID', 'error');
      return;
    }

    try {
      setChecking(true);
      setEligibility(null);
      const response = await saleTransitionsApi.checkEligibility(itemId);
      setEligibility(response);
      
      if (!response.eligible) {
        showToast(response.recommendation, 'warning');
      }
    } catch (error) {
      console.error('Failed to check eligibility:', error);
      showToast('Failed to check item eligibility', 'error');
    } finally {
      setChecking(false);
    }
  };

  const initiateTransition = async () => {
    if (!eligibility || !eligibility.eligible) return;
    
    if (!salePrice || parseFloat(salePrice) <= 0) {
      showToast('Please enter a valid sale price', 'error');
      return;
    }

    try {
      setInitiating(true);
      const request: SaleTransitionInitiateRequest = {
        sale_price: parseFloat(salePrice),
        effective_date: effectiveDate || null,
        force_transition: false,
        skip_notifications: false,
        notes: notes || null
      };

      const response = await saleTransitionsApi.initiateTransition(itemId, request);
      showToast('Sale transition initiated successfully', 'success');
      onTransitionInitiated?.(response.transition_id);
      
      // Reset form
      setEligibility(null);
      setSalePrice('');
      setEffectiveDate('');
      setNotes('');
    } catch (error) {
      console.error('Failed to initiate transition:', error);
      showToast('Failed to initiate sale transition', 'error');
    } finally {
      setInitiating(false);
    }
  };

  const getSeverityColor = (severity: ConflictSeverity) => {
    switch (severity) {
      case ConflictSeverity.LOW:
        return 'text-blue-600 bg-blue-100';
      case ConflictSeverity.MEDIUM:
        return 'text-yellow-600 bg-yellow-100';
      case ConflictSeverity.HIGH:
        return 'text-orange-600 bg-orange-100';
      case ConflictSeverity.CRITICAL:
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getConflictTypeLabel = (type: ConflictType) => {
    const labels: Record<ConflictType, string> = {
      [ConflictType.ACTIVE_RENTAL]: 'Active Rental',
      [ConflictType.LATE_RENTAL]: 'Late Rental',
      [ConflictType.FUTURE_BOOKING]: 'Future Booking',
      [ConflictType.PENDING_BOOKING]: 'Pending Booking',
      [ConflictType.INVENTORY_ISSUE]: 'Inventory Issue',
      [ConflictType.MAINTENANCE_SCHEDULED]: 'Maintenance Scheduled'
    };
    return labels[type] || type;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Check Sale Eligibility</h2>
        
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                placeholder="Enter item ID to check eligibility"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <SearchIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
          <button
            onClick={checkEligibility}
            disabled={checking || !itemId.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors mt-6"
          >
            {checking ? 'Checking...' : 'Check Eligibility'}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {eligibility && (
        <div className="space-y-6">
          {/* Eligibility Status */}
          <div className={`rounded-lg p-6 ${
            eligibility.eligible 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start">
              {eligibility.eligible ? (
                <CheckCircleIcon className="h-6 w-6 text-green-600 mt-0.5 mr-3" />
              ) : (
                <XCircleIcon className="h-6 w-6 text-red-600 mt-0.5 mr-3" />
              )}
              <div className="flex-1">
                <h3 className={`text-lg font-medium ${
                  eligibility.eligible ? 'text-green-900' : 'text-red-900'
                }`}>
                  {eligibility.eligible ? 'Item Eligible for Sale' : 'Item Not Eligible'}
                </h3>
                <p className={`mt-1 text-sm ${
                  eligibility.eligible ? 'text-green-700' : 'text-red-700'
                }`}>
                  {eligibility.recommendation}
                </p>
                
                {/* Item Info */}
                <div className="mt-4 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">Item:</span> {eligibility.item_name}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Current Status:</span> {eligibility.current_status}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {eligibility.warnings && eligibility.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-900">Warnings</h4>
                  <ul className="mt-1 text-sm text-yellow-700 space-y-1">
                    {eligibility.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Conflicts Summary */}
          {eligibility.conflicts && eligibility.conflicts.total_conflicts > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Conflict Analysis</h3>
              
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Conflicts</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {eligibility.conflicts.total_conflicts}
                      </p>
                    </div>
                    <AlertCircleIcon className="h-8 w-8 text-gray-400" />
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Revenue Impact</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(eligibility.conflicts.total_revenue_impact)}
                      </p>
                    </div>
                    <DollarSignIcon className="h-8 w-8 text-gray-400" />
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Affected Customers</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {eligibility.conflicts.affected_customers}
                      </p>
                    </div>
                    <UsersIcon className="h-8 w-8 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Conflicts by Type */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Conflicts by Type</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(eligibility.conflicts.by_type).map(([type, count]) => (
                    <span
                      key={type}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {getConflictTypeLabel(type as ConflictType)}: {count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Conflicts by Severity */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Conflicts by Severity</h4>
                <div className="flex gap-4">
                  {Object.entries(eligibility.conflicts.by_severity).map(([severity, count]) => (
                    <span
                      key={severity}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(severity as ConflictSeverity)}`}
                    >
                      {severity}: {count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Critical Conflicts */}
              {eligibility.conflicts.critical_conflicts && eligibility.conflicts.critical_conflicts.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Critical Conflicts</h4>
                  <div className="space-y-2">
                    {eligibility.conflicts.critical_conflicts.map((conflict, index) => (
                      <div key={index} className="bg-red-50 rounded-lg p-3">
                        <div className="flex items-start">
                          <ShieldAlertIcon className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
                          <div className="flex-1">
                            <p className="text-sm text-red-900">{conflict.description}</p>
                            {conflict.financial_impact && (
                              <p className="text-xs text-red-700 mt-1">
                                Impact: {formatCurrency(conflict.financial_impact)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approval Requirements */}
          {eligibility.requires_approval && eligibility.approval_reasons && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-start">
                <InfoIcon className="h-6 w-6 text-orange-600 mt-0.5 mr-3" />
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-orange-900">Approval Required</h3>
                  <p className="mt-1 text-sm text-orange-700">
                    This transition requires manager approval due to:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {eligibility.approval_reasons.map((reason, index) => (
                      <li key={index} className="text-sm text-orange-700">
                        • {reason.description}
                        {reason.threshold && reason.actual_value && (
                          <span className="text-xs ml-1">
                            (Threshold: {reason.threshold}, Actual: {reason.actual_value})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Initiate Transition Form */}
          {eligibility.eligible && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Initiate Sale Transition</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="Enter sale price"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty for immediate transition
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any relevant notes about this transition"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-gray-600">
                    {eligibility.requires_approval && (
                      <span className="text-orange-600">
                        ⚠ This transition will require approval
                      </span>
                    )}
                  </div>
                  <button
                    onClick={initiateTransition}
                    disabled={initiating || !salePrice}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {initiating ? (
                      'Initiating...'
                    ) : (
                      <>
                        Initiate Transition
                        <ArrowRightIcon className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SaleEligibilityCheck;