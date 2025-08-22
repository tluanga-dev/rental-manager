'use client';

// Mixed Condition Return Form - Allows returning items in different conditions
import React, { useState, useCallback, useMemo } from 'react';
import { 
  AlertTriangle,
  Package,
  AlertCircle,
  XCircle,
  HelpCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  ReturnItemStateEnhanced, 
  DamageDetail, 
  DamageType, 
  DamageSeverity 
} from '../../types/rental-return-enhanced';

interface MixedConditionReturnFormProps {
  item: ReturnItemStateEnhanced;
  onUpdate: (updates: Partial<ReturnItemStateEnhanced>) => void;
  isProcessing: boolean;
}

export default function MixedConditionReturnForm({
  item,
  onUpdate,
  isProcessing
}: MixedConditionReturnFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDamageForm, setShowDamageForm] = useState(false);

  // Calculate if mixed condition (some damaged/lost)
  const hasMixedCondition = useMemo(() => {
    return item.quantity_damaged > 0 || 
           item.quantity_beyond_repair > 0 || 
           item.quantity_lost > 0;
  }, [item]);

  // Validate quantities
  const validateQuantities = useCallback(() => {
    const total = item.quantity_good + item.quantity_damaged + 
                  item.quantity_beyond_repair + item.quantity_lost;
    
    if (total !== item.total_return_quantity) {
      return `Total breakdown (${total}) doesn't match return quantity (${item.total_return_quantity})`;
    }
    
    if (total > item.item.quantity) {
      return `Cannot return more than rented quantity (${item.item.quantity})`;
    }
    
    return null;
  }, [item]);

  const validationError = validateQuantities();

  // Handle quantity changes
  const handleQuantityChange = (field: keyof ReturnItemStateEnhanced, value: number) => {
    const newValue = Math.max(0, Math.min(value, item.item.quantity));
    
    // Auto-adjust total if changing breakdown
    if (field !== 'total_return_quantity') {
      const otherQuantities = {
        quantity_good: item.quantity_good,
        quantity_damaged: item.quantity_damaged,
        quantity_beyond_repair: item.quantity_beyond_repair,
        quantity_lost: item.quantity_lost,
        [field]: newValue
      };
      
      const newTotal = otherQuantities.quantity_good + 
                      otherQuantities.quantity_damaged +
                      otherQuantities.quantity_beyond_repair + 
                      otherQuantities.quantity_lost;
      
      onUpdate({
        [field]: newValue,
        total_return_quantity: newTotal
      });
    } else {
      // If changing total, adjust good quantity
      const damaged = item.quantity_damaged + item.quantity_beyond_repair + item.quantity_lost;
      onUpdate({
        total_return_quantity: newValue,
        quantity_good: Math.max(0, newValue - damaged)
      });
    }
  };

  // Add damage detail
  const addDamageDetail = () => {
    const newDetail: DamageDetail = {
      quantity: 1,
      damage_type: 'PHYSICAL',
      damage_severity: 'MODERATE',
      description: '',
      estimated_repair_cost: 0
    };
    
    onUpdate({
      damage_details: [...item.damage_details, newDetail]
    });
  };

  // Remove damage detail
  const removeDamageDetail = (index: number) => {
    const newDetails = item.damage_details.filter((_, i) => i !== index);
    onUpdate({ damage_details: newDetails });
  };

  // Update damage detail
  const updateDamageDetail = (index: number, updates: Partial<DamageDetail>) => {
    const newDetails = [...item.damage_details];
    newDetails[index] = { ...newDetails[index], ...updates };
    onUpdate({ damage_details: newDetails });
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-white">
      {/* Item Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{item.item.item_name}</h4>
          <p className="text-sm text-gray-500">SKU: {item.item.sku}</p>
          <p className="text-sm text-gray-500">
            Rented: {item.item.quantity} | Returning: {item.total_return_quantity}
          </p>
        </div>
        
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={isProcessing}
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleQuantityChange('total_return_quantity', item.item.quantity)}
          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200"
          disabled={isProcessing}
        >
          Return All
        </button>
        
        <button
          onClick={() => setShowDamageForm(!showDamageForm)}
          className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200"
          disabled={isProcessing}
        >
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          Report Damage
        </button>
      </div>

      {/* Validation Error */}
      {validationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {validationError}
          </p>
        </div>
      )}

      {/* Expanded Form */}
      {expanded && (
        <div className="space-y-4 pt-4 border-t">
          {/* Total Return Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Return Quantity
            </label>
            <input
              type="number"
              min="0"
              max={item.item.quantity}
              value={item.total_return_quantity}
              onChange={(e) => handleQuantityChange('total_return_quantity', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            />
          </div>

          {/* Condition Breakdown */}
          <div className="space-y-3">
            <h5 className="text-sm font-medium text-gray-700">Condition Breakdown</h5>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Good Condition */}
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-green-500" />
                <div className="flex-1">
                  <label className="text-sm text-gray-600">Good Condition</label>
                  <input
                    type="number"
                    min="0"
                    max={item.item.quantity}
                    value={item.quantity_good}
                    onChange={(e) => handleQuantityChange('quantity_good', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border rounded text-sm"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Damaged */}
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <div className="flex-1">
                  <label className="text-sm text-gray-600">Damaged (Repairable)</label>
                  <input
                    type="number"
                    min="0"
                    max={item.item.quantity}
                    value={item.quantity_damaged}
                    onChange={(e) => handleQuantityChange('quantity_damaged', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border rounded text-sm"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Beyond Repair */}
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <div className="flex-1">
                  <label className="text-sm text-gray-600">Beyond Repair</label>
                  <input
                    type="number"
                    min="0"
                    max={item.item.quantity}
                    value={item.quantity_beyond_repair}
                    onChange={(e) => handleQuantityChange('quantity_beyond_repair', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border rounded text-sm"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Lost */}
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-gray-500" />
                <div className="flex-1">
                  <label className="text-sm text-gray-600">Lost/Missing</label>
                  <input
                    type="number"
                    min="0"
                    max={item.item.quantity}
                    value={item.quantity_lost}
                    onChange={(e) => handleQuantityChange('quantity_lost', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1 border rounded text-sm"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Damage Details Form */}
          {(showDamageForm || item.quantity_damaged > 0 || item.quantity_beyond_repair > 0) && (
            <div className="space-y-3 p-3 bg-orange-50 rounded-lg">
              <div className="flex justify-between items-center">
                <h5 className="text-sm font-medium text-gray-700">Damage Details</h5>
                <button
                  onClick={addDamageDetail}
                  className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                  disabled={isProcessing}
                >
                  <Plus className="w-3 h-3 inline mr-1" />
                  Add Detail
                </button>
              </div>

              {item.damage_details.map((detail, index) => (
                <div key={index} className="p-3 bg-white rounded border space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Damage #{index + 1}</span>
                    <button
                      onClick={() => removeDamageDetail(index)}
                      className="text-red-500 hover:text-red-700"
                      disabled={isProcessing}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Type</label>
                      <select
                        value={detail.damage_type}
                        onChange={(e) => updateDamageDetail(index, { damage_type: e.target.value as DamageType })}
                        className="w-full px-2 py-1 text-sm border rounded"
                        disabled={isProcessing}
                      >
                        <option value="PHYSICAL">Physical</option>
                        <option value="WATER">Water</option>
                        <option value="ELECTRICAL">Electrical</option>
                        <option value="WEAR_AND_TEAR">Wear & Tear</option>
                        <option value="COSMETIC">Cosmetic</option>
                        <option value="FUNCTIONAL">Functional</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-600">Severity</label>
                      <select
                        value={detail.damage_severity}
                        onChange={(e) => updateDamageDetail(index, { damage_severity: e.target.value as DamageSeverity })}
                        className="w-full px-2 py-1 text-sm border rounded"
                        disabled={isProcessing}
                      >
                        <option value="MINOR">Minor</option>
                        <option value="MODERATE">Moderate</option>
                        <option value="SEVERE">Severe</option>
                        <option value="BEYOND_REPAIR">Beyond Repair</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Description</label>
                    <textarea
                      value={detail.description}
                      onChange={(e) => updateDamageDetail(index, { description: e.target.value })}
                      className="w-full px-2 py-1 text-sm border rounded"
                      rows={2}
                      placeholder="Describe the damage..."
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={detail.quantity}
                        onChange={(e) => updateDamageDetail(index, { quantity: parseInt(e.target.value) || 1 })}
                        className="w-full px-2 py-1 text-sm border rounded"
                        disabled={isProcessing}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-600">Est. Repair Cost</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={detail.estimated_repair_cost || 0}
                        onChange={(e) => updateDamageDetail(index, { estimated_repair_cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-sm border rounded"
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Damage Penalty */}
              <div>
                <label className="text-sm font-medium text-gray-700">Total Damage Penalty</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.damage_penalty}
                  onChange={(e) => onUpdate({ damage_penalty: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={isProcessing}
                />
              </div>
            </div>
          )}

          {/* General Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700">Condition Notes</label>
            <textarea
              value={item.condition_notes}
              onChange={(e) => onUpdate({ condition_notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              rows={2}
              placeholder="Any additional notes about the item condition..."
              disabled={isProcessing}
            />
          </div>
        </div>
      )}

      {/* Status Summary */}
      {hasMixedCondition && (
        <div className="flex items-center space-x-4 text-sm">
          {item.quantity_good > 0 && (
            <span className="text-green-600">✓ {item.quantity_good} Good</span>
          )}
          {item.quantity_damaged > 0 && (
            <span className="text-orange-600">⚠ {item.quantity_damaged} Damaged</span>
          )}
          {item.quantity_beyond_repair > 0 && (
            <span className="text-red-600">✗ {item.quantity_beyond_repair} Beyond Repair</span>
          )}
          {item.quantity_lost > 0 && (
            <span className="text-gray-600">? {item.quantity_lost} Lost</span>
          )}
        </div>
      )}
    </div>
  );
}