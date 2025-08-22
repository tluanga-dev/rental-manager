'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Calculator, 
  Clock, 
  AlertTriangle, 
  Package, 
  FileText,
  TrendingDown,
  TrendingUp,
  Info,
  CheckCircle
} from 'lucide-react';
import { 
  ReturnCalculation, 
  ItemDefect, 
  ConditionGrade,
  RETURN_BUSINESS_RULES,
  OutstandingRental
} from '@/types/returns';

interface FeeCalculatorProps {
  outstandingRental: OutstandingRental;
  quantityReturned: number;
  returnDate: string;
  conditionAfter: ConditionGrade;
  defects: ItemDefect[];
  onCalculationComplete: (calculation: ReturnCalculation) => void;
  onCancel: () => void;
}

export function FeeCalculator({
  outstandingRental,
  quantityReturned,
  returnDate,
  conditionAfter,
  defects,
  onCalculationComplete,
  onCancel,
}: FeeCalculatorProps) {
  const [calculation, setCalculation] = useState<ReturnCalculation>({
    line_id: outstandingRental.transaction_line_id,
    sku_id: outstandingRental.sku_id,
    quantity_returned: quantityReturned,
    days_overdue: 0,
    daily_rate: outstandingRental.daily_rate,
    late_fee_rate: 0,
    late_fee_amount: 0,
    damage_cost: 0,
    cleaning_cost: 0,
    deposit_per_unit: outstandingRental.deposit_per_unit,
    deposit_refund: 0,
    net_refund: 0,
  });

  const [customLateFeeRate, setCustomLateFeeRate] = useState<number | null>(null);
  const [customCleaningCost, setCustomCleaningCost] = useState<number | null>(null);
  const [waiveLateFees, setWaiveLateFees] = useState(false);
  const [notes, setNotes] = useState('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const calculateDaysOverdue = () => {
    const expectedReturnDate = new Date(outstandingRental.rental_end_date);
    const actualReturnDate = new Date(returnDate);
    
    // Add grace period
    expectedReturnDate.setHours(expectedReturnDate.getHours() + (RETURN_BUSINESS_RULES.GRACE_PERIOD_HOURS || 4));
    
    if (actualReturnDate <= expectedReturnDate) {
      return 0; // Not overdue
    }
    
    const diffTime = actualReturnDate.getTime() - expectedReturnDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const calculateLateFeeRate = () => {
    if (customLateFeeRate !== null) return customLateFeeRate;
    return outstandingRental.daily_rate * RETURN_BUSINESS_RULES.LATE_FEE_MULTIPLIER;
  };

  const calculateCleaningCost = () => {
    if (customCleaningCost !== null) return customCleaningCost;
    return RETURN_BUSINESS_RULES.CLEANING_FEES[conditionAfter] || 0;
  };

  const calculateDamageCost = () => {
    return defects
      .filter(defect => defect.customer_fault)
      .reduce((sum, defect) => sum + defect.repair_cost, 0);
  };

  const calculateDepositRefund = () => {
    const totalDeposit = calculation.deposit_per_unit * quantityReturned;
    const totalCharges = calculation.late_fee_amount + calculation.damage_cost + calculation.cleaning_cost;
    return Math.max(0, totalDeposit - totalCharges);
  };

  const calculateNetRefund = () => {
    const depositRefund = calculateDepositRefund();
    const totalFees = calculation.late_fee_amount + calculation.damage_cost + calculation.cleaning_cost;
    return depositRefund - totalFees;
  };

  // Recalculate whenever dependencies change
  useEffect(() => {
    const daysOverdue = calculateDaysOverdue();
    const lateFeeRate = calculateLateFeeRate();
    const cleaningCost = calculateCleaningCost();
    const damageCost = calculateDamageCost();
    
    const lateFeeAmount = waiveLateFees ? 0 : (daysOverdue * lateFeeRate * quantityReturned);
    const depositRefund = calculateDepositRefund();
    const netRefund = calculateNetRefund();

    setCalculation(prev => ({
      ...prev,
      days_overdue: daysOverdue,
      late_fee_rate: lateFeeRate,
      late_fee_amount: lateFeeAmount,
      damage_cost: damageCost,
      cleaning_cost: cleaningCost,
      deposit_refund: depositRefund,
      net_refund: netRefund,
    }));
  }, [
    returnDate, 
    quantityReturned, 
    conditionAfter, 
    defects, 
    customLateFeeRate, 
    customCleaningCost, 
    waiveLateFees
  ]);

  const handleComplete = () => {
    onCalculationComplete(calculation);
  };

  const getTotalCharges = () => {
    return calculation.late_fee_amount + calculation.damage_cost + calculation.cleaning_cost;
  };

  const getTotalDeposit = () => {
    return calculation.deposit_per_unit * quantityReturned;
  };

  const isEarlyReturn = () => {
    const returnDateTime = new Date(returnDate);
    const expectedReturnDate = new Date(outstandingRental.rental_end_date);
    return returnDateTime < expectedReturnDate;
  };

  const getRefundStatus = () => {
    const netRefund = calculation.net_refund;
    if (netRefund > 0) return { type: 'refund', amount: netRefund, color: 'text-green-600' };
    if (netRefund < 0) return { type: 'due', amount: Math.abs(netRefund), color: 'text-red-600' };
    return { type: 'break-even', amount: 0, color: 'text-gray-600' };
  };

  const refundStatus = getRefundStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Fee Calculation</h2>
              <p className="text-muted-foreground">
                {outstandingRental.item_name} ({outstandingRental.sku_code})
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {quantityReturned} of {outstandingRental.quantity_outstanding} units
              </Badge>
              {isEarlyReturn() && (
                <Badge className="bg-green-100 text-green-800">Early Return</Badge>
              )}
              {calculation.days_overdue > 0 && (
                <Badge className="bg-red-100 text-red-800">
                  {calculation.days_overdue} days overdue
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculation Details */}
        <div className="space-y-6">
          {/* Rental Period Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Rental Period</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Start Date</div>
                  <div className="font-medium">{formatDate(outstandingRental.rental_start_date)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Due Date</div>
                  <div className="font-medium">{formatDate(outstandingRental.rental_end_date)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Return Date</div>
                  <div className="font-medium">{formatDate(returnDate)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Days Overdue</div>
                  <div className={`font-medium ${calculation.days_overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {calculation.days_overdue}
                    {calculation.days_overdue === 0 && ' (On time)'}
                  </div>
                </div>
              </div>

              {calculation.days_overdue > 0 && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center space-x-2 text-orange-800">
                    <Info className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Grace period of {RETURN_BUSINESS_RULES.GRACE_PERIOD_HOURS} hours has been applied
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Late Fee Calculation */}
          {calculation.days_overdue > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span>Late Fee Calculation</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Daily Rate</div>
                    <div className="font-medium">{formatCurrency(outstandingRental.daily_rate)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Late Fee Rate (150%)</div>
                    <div className="font-medium">{formatCurrency(calculation.late_fee_rate)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Days Overdue</div>
                    <div className="font-medium">{calculation.days_overdue}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Quantity</div>
                    <div className="font-medium">{quantityReturned}</div>
                  </div>
                </div>

                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-700">
                    Late Fee = {formatCurrency(calculation.late_fee_rate)} × {calculation.days_overdue} days × {quantityReturned} units
                  </div>
                  <div className="text-lg font-bold text-red-800 mt-1">
                    = {formatCurrency(calculation.late_fee_amount)}
                  </div>
                </div>

                {/* Custom Late Fee Override */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="custom_late_fee"
                      checked={customLateFeeRate !== null}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCustomLateFeeRate(calculation.late_fee_rate);
                        } else {
                          setCustomLateFeeRate(null);
                        }
                      }}
                      className="rounded"
                    />
                    <Label htmlFor="custom_late_fee">Custom late fee rate</Label>
                  </div>
                  
                  {customLateFeeRate !== null && (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customLateFeeRate}
                      onChange={(e) => setCustomLateFeeRate(Number(e.target.value))}
                      placeholder="Custom rate per day"
                    />
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="waive_late_fees"
                    checked={waiveLateFees}
                    onChange={(e) => setWaiveLateFees(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="waive_late_fees">Waive late fees (management approval)</Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Damage and Cleaning Costs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-slate-500" />
                <span>Additional Charges</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cleaning Cost */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cleaning Cost (Grade {conditionAfter}):</span>
                  <span className="font-medium">{formatCurrency(calculation.cleaning_cost)}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="custom_cleaning"
                    checked={customCleaningCost !== null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCustomCleaningCost(calculation.cleaning_cost);
                      } else {
                        setCustomCleaningCost(null);
                      }
                    }}
                    className="rounded"
                  />
                  <Label htmlFor="custom_cleaning">Custom cleaning cost</Label>
                </div>
                
                {customCleaningCost !== null && (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customCleaningCost}
                    onChange={(e) => setCustomCleaningCost(Number(e.target.value))}
                    placeholder="Custom cleaning cost"
                  />
                )}
              </div>

              {/* Damage Cost */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Damage Cost:</span>
                  <span className="font-medium">{formatCurrency(calculation.damage_cost)}</span>
                </div>
                
                {defects.length > 0 && (
                  <div className="space-y-1">
                    {defects.filter(d => d.customer_fault).map((defect) => (
                      <div key={defect.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {defect.defect_type.replace('_', ' ')} ({defect.severity}):
                        </span>
                        <span>{formatCurrency(defect.repair_cost)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-2">
                <div className="flex justify-between font-medium">
                  <span>Total Additional Charges:</span>
                  <span>{formatCurrency(calculation.damage_cost + calculation.cleaning_cost)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes about the fee calculation..."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calculator className="h-5 w-5" />
                <span>Financial Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Security Deposit Held:</span>
                  <span className="font-medium">{formatCurrency(getTotalDeposit())}</span>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <div className="text-sm font-medium text-red-600">Charges:</div>
                  {calculation.late_fee_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="ml-4">Late Fees:</span>
                      <span className="text-red-600">{formatCurrency(calculation.late_fee_amount)}</span>
                    </div>
                  )}
                  {calculation.cleaning_cost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="ml-4">Cleaning:</span>
                      <span className="text-red-600">{formatCurrency(calculation.cleaning_cost)}</span>
                    </div>
                  )}
                  {calculation.damage_cost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="ml-4">Damage:</span>
                      <span className="text-red-600">{formatCurrency(calculation.damage_cost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium">
                    <span>Total Charges:</span>
                    <span className="text-red-600">{formatCurrency(getTotalCharges())}</span>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <div className="flex justify-between">
                    <span>Deposit Refund:</span>
                    <span className="font-medium text-green-600">{formatCurrency(calculation.deposit_refund)}</span>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Net Amount:</span>
                    <span className={refundStatus.color}>
                      {refundStatus.type === 'refund' && 'Refund: '}
                      {refundStatus.type === 'due' && 'Amount Due: '}
                      {refundStatus.type === 'break-even' && 'Break Even'}
                      {refundStatus.amount > 0 && formatCurrency(refundStatus.amount)}
                    </span>
                  </div>
                  
                  {refundStatus.type === 'refund' && (
                    <div className="flex items-center space-x-2 mt-2 text-green-600">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm">Customer receives refund</span>
                    </div>
                  )}
                  
                  {refundStatus.type === 'due' && (
                    <div className="flex items-center space-x-2 mt-2 text-red-600">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Customer owes additional amount</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calculation Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Calculation Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="font-medium">Formula:</div>
              <div className="ml-4 space-y-1 text-muted-foreground">
                <div>Net Refund = Deposit - (Late Fees + Damage + Cleaning)</div>
                <div>
                  = {formatCurrency(getTotalDeposit())} - ({formatCurrency(calculation.late_fee_amount)} + {formatCurrency(calculation.damage_cost)} + {formatCurrency(calculation.cleaning_cost)})
                </div>
                <div>= {formatCurrency(getTotalDeposit())} - {formatCurrency(getTotalCharges())}</div>
                <div className="font-medium text-gray-900">
                  = {formatCurrency(calculation.net_refund)}
                </div>
              </div>

              {waiveLateFees && calculation.days_overdue > 0 && (
                <div className="p-2 bg-green-50 rounded text-green-700 text-xs">
                  <CheckCircle className="h-3 w-3 inline mr-1" />
                  Late fees waived by management
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Rules Applied */}
          <Card>
            <CardHeader>
              <CardTitle>Applied Business Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div>• Late fee rate: {(RETURN_BUSINESS_RULES.LATE_FEE_MULTIPLIER * 100)}% of daily rate</div>
              <div>• Grace period: {RETURN_BUSINESS_RULES.GRACE_PERIOD_HOURS} hours</div>
              <div>• Cleaning fees based on condition grade</div>
              <div>• Damage costs only apply if customer fault</div>
              <div>• Deposit refund cannot exceed deposit amount</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleComplete}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Confirm Calculation
        </Button>
      </div>
    </div>
  );
}