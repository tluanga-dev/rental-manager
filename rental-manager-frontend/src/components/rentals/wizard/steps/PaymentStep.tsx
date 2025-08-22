'use client';

import { PaymentMethod } from '@/types/payment_method';

import { useState, useEffect } from 'react';
import { CreditCard, Calculator, Receipt, IndianRupee } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { WizardData } from '../RentalCreationWizard';

interface PaymentStepProps {
  data: WizardData;
  onUpdate: (data: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function PaymentStep({ data, onUpdate, onNext, onBack }: PaymentStepProps) {
  const [formData, setFormData] = useState({
    deposit_amount: data.deposit_amount || 0,
    tax_rate: data.tax_rate || 8.5,
    discount_amount: data.discount_amount || 0,
    apply_tax: true,
    deposit_percentage: 0,
    use_percentage_deposit: true,
    payment_method: data.payment_method || PaymentMethod.CASH,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    onUpdate({
      deposit_amount: formData.deposit_amount,
      tax_rate: formData.tax_rate,
      discount_amount: formData.discount_amount,
      payment_method: formData.payment_method,
    });
  }, [formData, onUpdate]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Calculate totals
  const getItemsSubtotal = () => {
    return data.items.reduce((total, item) => {
      const periods = item.rental_periods || 1;
      return total + (item.quantity * item.rental_rate * periods - (item.discount_value || 0));
    }, 0);
  };

  const getDeliverySubtotal = () => {
    let cost = 0;
    if (data.delivery_required) cost += 25;
    if (data.pickup_required) cost += 25;
    return cost;
  };

  const getDiscountAmount = () => {
    return formData.discount_amount || 0;
  };

  const getSubtotal = () => {
    return getItemsSubtotal() + getDeliverySubtotal() - getDiscountAmount();
  };

  const getTaxAmount = () => {
    if (!formData.apply_tax) return 0;
    return (getSubtotal() * formData.tax_rate) / 100;
  };

  const getGrandTotal = () => {
    return getSubtotal() + getTaxAmount();
  };

  const calculatePercentageDeposit = () => {
    return (getGrandTotal() * formData.deposit_percentage) / 100;
  };

  const getDepositAmount = () => {
    if (formData.use_percentage_deposit) {
      return calculatePercentageDeposit();
    }
    return formData.deposit_amount;
  };

  const getRemainingBalance = () => {
    return getGrandTotal() - getDepositAmount();
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.tax_rate < 0 || formData.tax_rate > 100) {
      newErrors.tax_rate = 'Tax rate must be between 0 and 100';
    }

    if (formData.discount_amount < 0) {
      newErrors.discount_amount = 'Discount amount cannot be negative';
    }

    if (formData.discount_amount > getItemsSubtotal() + getDeliverySubtotal()) {
      newErrors.discount_amount = 'Discount cannot exceed subtotal';
    }

    if (!formData.use_percentage_deposit && formData.deposit_amount < 0) {
      newErrors.deposit_amount = 'Deposit amount cannot be negative';
    }

    if (!formData.use_percentage_deposit && formData.deposit_amount > getGrandTotal()) {
      newErrors.deposit_amount = 'Deposit cannot exceed grand total';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      // Update with final deposit amount
      onUpdate({ deposit_amount: getDepositAmount() });
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      {/* Pricing Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-600" />
              Tax & Discount
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="apply_tax">Apply Tax</Label>
              <Switch
                id="apply_tax"
                checked={formData.apply_tax}
                onCheckedChange={(checked) => handleInputChange('apply_tax', checked)}
              />
            </div>

            {formData.apply_tax && (
              <div>
                <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.tax_rate}
                  onChange={(e) => handleInputChange('tax_rate', parseFloat(e.target.value) || 0)}
                  className={`mt-2 ${errors.tax_rate ? 'border-red-500' : ''}`}
                />
                {errors.tax_rate && (
                  <p className="text-red-500 text-sm mt-1">{errors.tax_rate}</p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="discount_amount">Discount Amount (₹)</Label>
              <Input
                id="discount_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.discount_amount}
                onChange={(e) => handleInputChange('discount_amount', parseFloat(e.target.value) || 0)}
                className={`mt-2 ${errors.discount_amount ? 'border-red-500' : ''}`}
                placeholder="0.00"
              />
              {errors.discount_amount && (
                <p className="text-red-500 text-sm mt-1">{errors.discount_amount}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Deposit Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                💡 Set the deposit amount customers pay upfront. Default is 0% (no deposit required).
                Maximum deposit cannot exceed ₹{getGrandTotal().toFixed(2)} (total rental amount).
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="use_percentage_deposit">Deposit Method</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Choose between percentage or fixed amount
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {formData.use_percentage_deposit ? 'Percentage' : 'Fixed Amount'}
                </span>
                <Switch
                  id="use_percentage_deposit"
                  checked={formData.use_percentage_deposit}
                  onCheckedChange={(checked) => handleInputChange('use_percentage_deposit', checked)}
                />
              </div>
            </div>

            {formData.use_percentage_deposit ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="deposit_percentage">
                    Deposit Percentage: {formData.deposit_percentage}%
                  </Label>
                  <Slider
                    id="deposit_percentage"
                    min={0}
                    max={100}
                    step={5}
                    value={[formData.deposit_percentage]}
                    onValueChange={(value) => handleInputChange('deposit_percentage', value[0])}
                    className="mt-2"
                  />
                </div>

                <div className="flex gap-2">
                  <Label className="text-sm text-gray-600">Quick Select:</Label>
                  <div className="flex gap-1">
                    {[0, 25, 50, 75, 100].map((percent) => (
                      <Button
                        key={percent}
                        type="button"
                        variant={formData.deposit_percentage === percent ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleInputChange('deposit_percentage', percent)}
                        className="px-2 py-1 text-xs"
                      >
                        {percent}%
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-800">Deposit Amount:</span>
                    <span className="text-lg font-bold text-green-900">
                      ₹{calculatePercentageDeposit().toFixed(2)}
                    </span>
                  </div>
                  {formData.deposit_percentage === 0 && (
                    <p className="text-xs text-green-700 mt-1">
                      No deposit required - full payment on delivery/pickup
                    </p>
                  )}
                  {formData.deposit_percentage === 100 && (
                    <p className="text-xs text-green-700 mt-1">
                      Full payment required upfront
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="deposit_amount">Custom Deposit Amount (₹)</Label>
                  <Input
                    id="deposit_amount"
                    type="number"
                    min="0"
                    max={getGrandTotal()}
                    step="0.01"
                    value={formData.deposit_amount}
                    onChange={(e) => handleInputChange('deposit_amount', parseFloat(e.target.value) || 0)}
                    className={`mt-2 ${errors.deposit_amount ? 'border-red-500' : ''}`}
                    placeholder="0.00"
                  />
                  {errors.deposit_amount && (
                    <p className="text-red-500 text-sm mt-1">{errors.deposit_amount}</p>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Equivalent to:</span>
                    <span className="font-medium text-gray-800">
                      {((formData.deposit_amount / getGrandTotal()) * 100).toFixed(1)}% of total
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-gray-600">Maximum allowed:</span>
                    <span className="font-medium text-gray-800">
                      ₹{getGrandTotal().toFixed(2)}
                    </span>
                  </div>
                </div>

                {formData.deposit_amount === 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                    ⚠️ No deposit set - customer will pay full amount on delivery/pickup
                  </p>
                )}
                {formData.deposit_amount > getGrandTotal() * 0.9 && formData.deposit_amount < getGrandTotal() && (
                  <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded p-2">
                    ℹ️ High deposit amount - only ₹{(getGrandTotal() - formData.deposit_amount).toFixed(2)} remaining at delivery/pickup
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="payment_method">Select Payment Method</Label>
            <select
              id="payment_method"
              value={formData.payment_method}
              onChange={e => handleInputChange('payment_method', e.target.value as PaymentMethod)}
              className="mt-2 block w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={PaymentMethod.CASH}>Cash</option>
              <option value={PaymentMethod.CREDIT_CARD}>Credit Card</option>
              <option value={PaymentMethod.DEBIT_CARD}>Debit Card</option>
              <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
              <option value={PaymentMethod.CHEQUE}>Cheque</option>
              <option value={PaymentMethod.ONLINE}>Online</option>
              <option value={PaymentMethod.CREDIT_ACCOUNT}>Credit Account</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Summary */}
      <Card className="border-indigo-200 bg-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-900">
            <Receipt className="w-5 h-5" />
            Pricing Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Items Breakdown */}
            <div>
              <h4 className="font-medium text-indigo-900 mb-2">Rental Items</h4>
              <div className="space-y-1 text-sm">
                {data.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-indigo-800">
                    <span>{item.item?.name} (x{item.quantity})</span>
                    <span>₹{(item.quantity * item.rental_rate - (item.discount_value || 0)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Services */}
            {(data.delivery_required || data.pickup_required) && (
              <div>
                <h4 className="font-medium text-indigo-900 mb-2">Services</h4>
                <div className="space-y-1 text-sm">
                  {data.delivery_required && (
                    <div className="flex justify-between text-indigo-800">
                      <span>Delivery Service</span>
                      <span>₹25.00</span>
                    </div>
                  )}
                  {data.pickup_required && (
                    <div className="flex justify-between text-indigo-800">
                      <span>Pickup Service</span>
                      <span>₹25.00</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-indigo-800">
                <span>Subtotal</span>
                <span>₹{(getItemsSubtotal() + getDeliverySubtotal()).toFixed(2)}</span>
              </div>

              {formData.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-₹{getDiscountAmount().toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-indigo-800">
                <span>Subtotal after discount</span>
                <span>₹{getSubtotal().toFixed(2)}</span>
              </div>

              {formData.apply_tax && (
                <div className="flex justify-between text-indigo-800">
                  <span>Tax ({formData.tax_rate}%)</span>
                  <span>₹{getTaxAmount().toFixed(2)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between text-lg font-semibold text-indigo-900">
                <span>Grand Total</span>
                <span>₹{getGrandTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Schedule */}
      <Card className={getDepositAmount() === 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${getDepositAmount() === 0 ? "text-amber-900" : "text-green-900"}`}>
            <IndianRupee className="w-5 h-5" />
            Payment Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {getDepositAmount() === 0 ? (
            <div className="bg-amber-100 border border-amber-300 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-amber-900 mb-2">
                ₹{getGrandTotal().toFixed(2)}
              </div>
              <div className="text-sm text-amber-800">
                Full payment due at delivery/pickup
              </div>
              <Badge variant="outline" className="mt-3 text-amber-700 border-amber-400">
                No deposit required
              </Badge>
              <p className="text-xs text-amber-700 mt-3">
                Customer will pay the entire amount when receiving the items
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`text-center p-4 rounded-lg ${
                getDepositAmount() === getGrandTotal() 
                  ? "bg-green-200 border-2 border-green-400" 
                  : "bg-green-100"
              }`}>
                <div className="text-2xl font-bold text-green-800">
                  ₹{getDepositAmount().toFixed(2)}
                </div>
                <div className="text-sm text-green-700 mt-1">
                  Deposit ({formData.use_percentage_deposit ? `${formData.deposit_percentage}%` : 'Custom'})
                </div>
                <Badge variant="outline" className="mt-2 text-green-600 border-green-300">
                  Due at booking
                </Badge>
                {getDepositAmount() === getGrandTotal() && (
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    ✓ Full payment
                  </p>
                )}
              </div>

              <div className={`text-center p-4 rounded-lg ${
                getRemainingBalance() === 0
                  ? "bg-gray-50 border border-gray-200"
                  : "bg-slate-100"
              }`}>
                <div className={`text-2xl font-bold ${
                  getRemainingBalance() === 0 ? "text-gray-400" : "text-slate-800"
                }`}>
                  ₹{getRemainingBalance().toFixed(2)}
                </div>
                <div className={`text-sm mt-1 ${
                  getRemainingBalance() === 0 ? "text-gray-500" : "text-slate-700"
                }`}>
                  Remaining Balance
                </div>
                {getRemainingBalance() > 0 ? (
                  <Badge variant="outline" className="mt-2 text-slate-600 border-slate-300">
                    Due at pickup/delivery
                  </Badge>
                ) : (
                  <Badge variant="outline" className="mt-2 text-gray-400 border-gray-200">
                    Paid in full
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {/* Summary info */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Total Rental Amount:</span>
              <span className="font-semibold text-gray-900">₹{getGrandTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-600">Payment Method:</span>
              <span className="font-medium text-gray-800">
                {formData.payment_method.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onBack}>
          Back to Delivery
        </Button>
        <Button
          onClick={handleNext}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Continue to Review
        </Button>
      </div>
    </div>
  );
}
