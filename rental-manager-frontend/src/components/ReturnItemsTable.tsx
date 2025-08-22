'use client';

// Return Items Table Component for Rental Return System
import React, { useState } from 'react';
import { 
  Check as CheckIcon, 
  X as XMarkIcon, 
  AlertTriangle as ExclamationTriangleIcon,
  Clock as ClockIcon,
  CheckCircle as CheckCircleIcon,
  Camera as CameraIcon
} from 'lucide-react';
import { ReturnItemState, ReturnAction, RentalStatus } from '../types/rental-return';
import { DamageAssessmentModal } from './rentals/DamageAssessmentModal';

interface ReturnItemsTableProps {
  returnItems: ReturnItemState[];
  onUpdateItem: (lineId: string, updates: Partial<ReturnItemState>) => void;
  onToggleAll: (selected: boolean) => void;
  onSetActionForAll: (action: ReturnAction) => void;
  selectedCount: number;
  totalCount: number;
  isProcessing: boolean;
}

export default function ReturnItemsTable({
  returnItems,
  onUpdateItem,
  onToggleAll,
  onSetActionForAll,
  selectedCount,
  totalCount,
  isProcessing
}: ReturnItemsTableProps) {
  const [damageModalItem, setDamageModalItem] = useState<ReturnItemState | null>(null);
  const [damageAssessments, setDamageAssessments] = useState<Record<string, any>>({});

  const handleDamageAssessment = (item: ReturnItemState) => {
    setDamageModalItem(item);
  };

  const saveDamageAssessment = (assessment: any) => {
    if (damageModalItem) {
      // Store the assessment
      setDamageAssessments(prev => ({
        ...prev,
        [damageModalItem.item.id]: assessment
      }));
      
      // Update the item with damage information
      onUpdateItem(damageModalItem.item.id, {
        return_action: 'MARK_DAMAGED' as ReturnAction,
        damage_notes: assessment.description,
        damage_penalty: assessment.customFee
      });
    }
    setDamageModalItem(null);
  };

  const getStatusBadge = (status: RentalStatus) => {
    const statusConfig = {
      'RENTAL_INPROGRESS': { 
        color: 'bg-blue-100 text-blue-800', 
        icon: ClockIcon, 
        label: 'In Progress' 
      },
      'RENTAL_COMPLETED': { 
        color: 'bg-green-100 text-green-800', 
        icon: CheckCircleIcon, 
        label: 'Completed' 
      },
      'RENTAL_LATE': { 
        color: 'bg-red-100 text-red-800', 
        icon: ExclamationTriangleIcon, 
        label: 'Late' 
      },
      'RENTAL_EXTENDED': { 
        color: 'bg-yellow-100 text-yellow-800', 
        icon: ClockIcon, 
        label: 'Extended' 
      },
      'RENTAL_PARTIAL_RETURN': { 
        color: 'bg-orange-100 text-orange-800', 
        icon: ClockIcon, 
        label: 'Partial Return' 
      },
      'RENTAL_LATE_PARTIAL_RETURN': { 
        color: 'bg-red-100 text-red-800', 
        icon: ExclamationTriangleIcon, 
        label: 'Late Partial Return' 
      }
    };

    const config = statusConfig[status] || {
      color: 'bg-gray-100 text-gray-800',
      icon: ClockIcon,
      label: status
    };

    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const getReturnActionColor = (action: ReturnAction) => {
    const actionColors = {
      'COMPLETE_RETURN': 'text-green-700 bg-green-50 border-green-200',
      'PARTIAL_RETURN': 'text-yellow-700 bg-yellow-50 border-yellow-200',
      'MARK_LATE': 'text-red-700 bg-red-50 border-red-200',
      'MARK_DAMAGED': 'text-orange-700 bg-orange-50 border-orange-200'
    };
    return actionColors[action] || 'text-gray-700 bg-gray-50 border-gray-200';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isOverdue = (endDate: string) => {
    return new Date() > new Date(endDate);
  };

  const allSelected = selectedCount === totalCount && totalCount > 0;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Table Header with Bulk Actions */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">Return Items</h2>
            <span className="text-sm text-gray-500">
              {selectedCount} of {totalCount} items selected
            </span>
          </div>
          
          {selectedCount > 0 && (
            <div className="flex items-center space-x-3">
              <select
                onChange={(e) => onSetActionForAll(e.target.value as ReturnAction)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isProcessing}
              >
                <option value="">Set action for selected...</option>
                <option value="COMPLETE_RETURN">Complete Return</option>
                {/* Show partial return only if any selected item has quantity >= 2 */}
                {returnItems.some(item => item.selected && item.item.quantity >= 2) && (
                  <option value="PARTIAL_RETURN">Partial Return</option>
                )}
                <option value="MARK_LATE">Mark Late</option>
                <option value="MARK_DAMAGED">Mark Damaged</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) => onToggleAll(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    disabled={isProcessing}
                  />
                  <span className="ml-2">Item</span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rental Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Return Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Return Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {returnItems.map((itemState) => (
              <tr 
                key={itemState.item.id} 
                className={`${itemState.selected ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
              >
                {/* Selection and Item Info */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={itemState.selected}
                      onChange={(e) => onUpdateItem(itemState.item.id, { selected: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      disabled={isProcessing}
                    />
                    <div className="ml-4">
                      <div className="text-base font-medium text-gray-900">
                        {itemState.item.item_name}
                      </div>
                      <div className="text-sm text-gray-500 font-medium">
                        {itemState.item.description}
                      </div>
                      <div className="text-xs text-black mt-1 font-medium">
                        SKU: {itemState.item.sku}
                      </div>
                      <div className="text-xs text-black mt-1 font-medium">
                        Quantity: <span className="font-bold">{itemState.item.quantity}</span>
                      </div>
                      {isOverdue(itemState.item.rental_end_date) && (
                        <div className="flex items-center mt-1">
                          <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mr-1" />
                          <span className="text-xs text-red-600 font-medium">
                            Overdue since {formatDate(itemState.item.rental_end_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Rental Period */}
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="text-center">
                    <div>{formatDate(itemState.item.rental_start_date)}</div>
                    <div className="text-xs text-gray-500">to</div>
                    <div>{formatDate(itemState.item.rental_end_date)}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {itemState.item.rental_period} {itemState.item.rental_period_unit}
                    </div>
                  </div>
                </td>

                {/* Current Status */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(itemState.item.current_rental_status)}
                </td>

                {/* Return Action */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={itemState.return_action}
                    onChange={(e) => onUpdateItem(itemState.item.id, { return_action: e.target.value as ReturnAction })}
                    className={`text-xs border rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getReturnActionColor(itemState.return_action)}`}
                    disabled={!itemState.selected || isProcessing}
                  >
                    <option value="COMPLETE_RETURN">Complete Return</option>
                    {/* Show partial return only if item quantity >= 2 */}
                    {itemState.item.quantity >= 2 && (
                      <option value="PARTIAL_RETURN">Partial Return</option>
                    )}
                    <option value="MARK_LATE">Mark Late</option>
                    <option value="MARK_DAMAGED">Mark Damaged</option>
                  </select>
                </td>

                {/* Return Quantity */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    min="0"
                    max={itemState.item.quantity}
                    step="0.1"
                    value={itemState.return_quantity}
                    onChange={(e) => onUpdateItem(itemState.item.id, { return_quantity: parseFloat(e.target.value) || 0 })}
                    className="w-20 text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={!itemState.selected || isProcessing}
                  />
                </td>

                {/* Status */}
                <td className="px-6 py-4 w-1/5">
                  {itemState.return_action === 'MARK_DAMAGED' ? (
                    <>
                      <button
                        onClick={() => handleDamageAssessment(itemState)}
                        className="w-full mb-2 px-3 py-2 bg-orange-100 text-orange-700 border border-orange-300 rounded-md hover:bg-orange-200 transition-colors flex items-center justify-center gap-2"
                        disabled={!itemState.selected || isProcessing}
                      >
                        <CameraIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">Assess Damage</span>
                      </button>
                      {damageAssessments[itemState.item.id] && (
                        <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                          <span className="font-medium text-orange-700">Assessment Complete</span>
                          <div className="text-orange-600">Fee: ₹{damageAssessments[itemState.item.id].customFee}</div>
                        </div>
                      )}
                      <textarea
                        value={itemState.damage_notes}
                        onChange={(e) => onUpdateItem(itemState.item.id, { damage_notes: e.target.value })}
                        placeholder="Additional notes..."
                        className="w-full text-sm border border-red-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none bg-red-50"
                        rows={2}
                        disabled={!itemState.selected || isProcessing}
                      />
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-red-700 mb-1">
                          Damage Fine/Penalty (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={itemState.damage_penalty === 0 ? '' : itemState.damage_penalty}
                          onChange={(e) => {
                            const value = e.target.value;
                            const numValue = value === '' ? 0 : parseFloat(value);
                            onUpdateItem(itemState.item.id, { damage_penalty: isNaN(numValue) ? 0 : numValue });
                          }}
                          onFocus={(e) => {
                            // Select all text when focused, making it easy to replace
                            e.target.select();
                            // If value is 0, clear the field for better UX
                            if (itemState.damage_penalty === 0) {
                              e.target.value = '';
                            }
                          }}
                          onBlur={(e) => {
                            // If field is empty on blur, set it back to 0
                            if (e.target.value === '' || isNaN(parseFloat(e.target.value))) {
                              onUpdateItem(itemState.item.id, { damage_penalty: 0 });
                            }
                          }}
                          placeholder="Enter penalty amount"
                          className="w-full text-sm border border-red-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-red-50"
                          disabled={!itemState.selected || isProcessing}
                        />
                      </div>
                    </>
                  ) : (
                    <textarea
                      value={itemState.condition_notes}
                      onChange={(e) => onUpdateItem(itemState.item.id, { condition_notes: e.target.value })}
                      placeholder="Item status notes..."
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={2}
                      disabled={!itemState.selected || isProcessing}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {returnItems.length === 0 && (
        <div className="px-6 py-12 text-center">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No items to return</h3>
          <p className="mt-1 text-sm text-gray-500">All rental items have already been returned.</p>
        </div>
      )}

      {/* Summary Footer */}
      {returnItems.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">
                <strong>{selectedCount}</strong> items selected for return
              </span>
              {selectedCount > 0 && (
                <span className="text-gray-600">
                  Total quantity: <strong>
                    {returnItems
                      .filter(item => item.selected)
                      .reduce((sum, item) => sum + item.return_quantity, 0)
                    }
                  </strong>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <CheckIcon className="w-4 h-4 text-green-500" />
              <span className="text-green-600 text-xs">
                Ready for processing
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Damage Assessment Modal */}
      {damageModalItem && (
        <DamageAssessmentModal
          isOpen={!!damageModalItem}
          onClose={() => setDamageModalItem(null)}
          onSave={saveDamageAssessment}
          item={{
            id: damageModalItem.item.id,
            name: damageModalItem.item.item_name,
            sku: damageModalItem.item.sku,
            quantity: damageModalItem.item.quantity,
            rental_price: damageModalItem.item.unit_price
          }}
          existingAssessment={damageAssessments[damageModalItem.item.id]}
        />
      )}
    </div>
  );
}