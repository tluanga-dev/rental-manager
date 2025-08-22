'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CreditCard, 
  Smartphone, 
  Banknote, 
  Building2,
  CheckCircle,
  AlertTriangle,
  Plus,
  Minus,
  Receipt
} from 'lucide-react';
import { PaymentMethod, PaymentFormData, SplitPayment, PricingBreakdown } from '@/types/transactions';

const paymentSchema = z.object({
  payment_method: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT', 'CHEQUE']),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  payment_reference: z.string().optional(),
});

interface PaymentFormProps {
  pricing: PricingBreakdown;
  onPaymentSubmit: (paymentData: PaymentFormData) => void;
  onPaymentMethodChange?: (method: PaymentMethod) => void;
  allowPartialPayment?: boolean;
  allowSplitPayment?: boolean;
  isLoading?: boolean;
}

const paymentMethods = [
  { 
    id: 'CASH' as PaymentMethod, 
    label: 'Cash', 
    icon: Banknote,
    description: 'Cash payment',
    requiresReference: false 
  },
  { 
    id: 'CARD' as PaymentMethod, 
    label: 'Card', 
    icon: CreditCard,
    description: 'Credit/Debit Card',
    requiresReference: true 
  },
  { 
    id: 'UPI' as PaymentMethod, 
    label: 'UPI', 
    icon: Smartphone,
    description: 'UPI Payment',
    requiresReference: true 
  },
  { 
    id: 'BANK_TRANSFER' as PaymentMethod, 
    label: 'Bank Transfer', 
    icon: Building2,
    description: 'NEFT/RTGS/IMPS',
    requiresReference: true 
  },
  { 
    id: 'CREDIT' as PaymentMethod, 
    label: 'Credit', 
    icon: Receipt,
    description: 'Pay Later',
    requiresReference: false 
  },
  { 
    id: 'CHEQUE' as PaymentMethod, 
    label: 'Cheque', 
    icon: Receipt,
    description: 'Cheque Payment',
    requiresReference: true 
  },
];

export function PaymentForm({
  pricing,
  onPaymentSubmit,
  onPaymentMethodChange,
  allowPartialPayment = false,
  allowSplitPayment = false,
  isLoading,
}: PaymentFormProps) {
  const [paymentMode, setPaymentMode] = useState<'single' | 'split'>('single');
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH');

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_method: 'CASH',
      amount: pricing.payment_due,
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    const paymentMethod = paymentMethods.find(pm => pm.id === method);
    const Icon = paymentMethod?.icon || CreditCard;
    return <Icon className="h-4 w-4" />;
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    form.setValue('payment_method', method);
    onPaymentMethodChange?.(method);
  };

  const addSplitPayment = () => {
    const remainingAmount = pricing.payment_due - getTotalSplitAmount();
    setSplitPayments(prev => [...prev, {
      payment_method: 'CASH',
      amount: Math.max(0, remainingAmount),
      payment_reference: '',
    }]);
  };

  const removeSplitPayment = (index: number) => {
    setSplitPayments(prev => prev.filter((_, i) => i !== index));
  };

  const updateSplitPayment = (index: number, updates: Partial<SplitPayment>) => {
    setSplitPayments(prev => prev.map((payment, i) => 
      i === index ? { ...payment, ...updates } : payment
    ));
  };

  const getTotalSplitAmount = () => {
    return splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const handleSubmit = (data: PaymentFormData) => {
    if (paymentMode === 'split') {
      onPaymentSubmit({
        ...data,
        split_payments: splitPayments,
      });
    } else {
      onPaymentSubmit(data);
    }
  };

  const getRemainingAmount = () => {
    if (paymentMode === 'split') {
      return pricing.payment_due - getTotalSplitAmount();
    }
    return pricing.payment_due - form.watch('amount');
  };

  const isPaymentComplete = () => {
    if (paymentMode === 'split') {
      return Math.abs(getRemainingAmount()) < 0.01;
    }
    return Math.abs(getRemainingAmount()) < 0.01;
  };

  const selectedMethodData = paymentMethods.find(pm => pm.id === selectedMethod);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Payment Processing</h2>
        <p className="text-muted-foreground">
          Process payment for total amount of {formatCurrency(pricing.payment_due)}
        </p>
      </div>

      {/* Payment Amount Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Net Amount:</span>
              <span>{formatCurrency(pricing.total_amount)}</span>
            </div>
            {pricing.deposit_total > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Security Deposit:</span>
                <span>{formatCurrency(pricing.deposit_total)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Total Due:</span>
              <span>{formatCurrency(pricing.payment_due)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Mode Selection */}
      {allowSplitPayment && (
        <Card>
          <CardContent className="p-4">
            <Tabs value={paymentMode} onValueChange={(value) => setPaymentMode(value as 'single' | 'split')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">Single Payment</TabsTrigger>
                <TabsTrigger value="split">Split Payment</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {paymentMode === 'single' ? (
          // Single Payment Form
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payment Method Selection */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  const isSelected = selectedMethod === method.id;
                  
                  return (
                    <div
                      key={method.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-slate-500 bg-slate-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleMethodSelect(method.id)}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <Icon className={`h-6 w-6 ${isSelected ? 'text-slate-600' : 'text-gray-600'}`} />
                        <span className={`font-medium ${isSelected ? 'text-slate-600' : 'text-gray-900'}`}>
                          {method.label}
                        </span>
                        <span className="text-xs text-muted-foreground text-center">
                          {method.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Payment Amount */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Payment Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    max={pricing.payment_due}
                    step="0.01"
                    {...form.register('amount', { valueAsNumber: true })}
                    disabled={!allowPartialPayment}
                    placeholder="0.00"
                  />
                  {form.formState.errors.amount && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.amount.message}
                    </p>
                  )}
                </div>

                {/* Payment Reference */}
                {selectedMethodData?.requiresReference && (
                  <div className="space-y-2">
                    <Label htmlFor="reference">
                      Payment Reference
                      {selectedMethod === 'CARD' && ' (Last 4 digits)'}
                      {selectedMethod === 'UPI' && ' (Transaction ID)'}
                      {selectedMethod === 'BANK_TRANSFER' && ' (Reference Number)'}
                      {selectedMethod === 'CHEQUE' && ' (Cheque Number)'}
                    </Label>
                    <Input
                      id="reference"
                      {...form.register('payment_reference')}
                      placeholder={
                        selectedMethod === 'CARD' ? '1234' :
                        selectedMethod === 'UPI' ? 'TXN123456789' :
                        selectedMethod === 'BANK_TRANSFER' ? 'REF123456' :
                        selectedMethod === 'CHEQUE' ? '123456' : 'Reference'
                      }
                    />
                  </div>
                )}
              </div>

              {/* Payment Status */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span>Amount Paying:</span>
                  <span className="font-medium">{formatCurrency(form.watch('amount') || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Remaining:</span>
                  <span className={`font-medium ${getRemainingAmount() > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(getRemainingAmount()))}
                  </span>
                </div>
                <div className="flex items-center mt-2">
                  {isPaymentComplete() ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-green-600 text-sm">Payment Complete</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
                      <span className="text-orange-600 text-sm">
                        {allowPartialPayment ? 'Partial Payment' : 'Incomplete Payment'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Split Payment Form
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Split Payments</span>
                <Button type="button" variant="outline" size="sm" onClick={addSplitPayment}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {splitPayments.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No split payments added yet</p>
                  <p className="text-sm">Click "Add Payment" to split the payment</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {splitPayments.map((payment, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Payment {index + 1}</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeSplitPayment(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Payment Method</Label>
                          <Select
                            value={payment.payment_method}
                            onValueChange={(value) => 
                              updateSplitPayment(index, { payment_method: value as PaymentMethod })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentMethods.map((method) => (
                                <SelectItem key={method.id} value={method.id}>
                                  <div className="flex items-center space-x-2">
                                    {getPaymentMethodIcon(method.id)}
                                    <span>{method.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Amount</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={payment.amount}
                            onChange={(e) => 
                              updateSplitPayment(index, { amount: Number(e.target.value) })
                            }
                            placeholder="0.00"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Reference</Label>
                          <Input
                            value={payment.payment_reference}
                            onChange={(e) => 
                              updateSplitPayment(index, { payment_reference: e.target.value })
                            }
                            placeholder="Payment reference"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Split Payment Summary */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Total Split Amount:</span>
                    <span className="font-medium">{formatCurrency(getTotalSplitAmount())}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Amount Due:</span>
                    <span className="font-medium">{formatCurrency(pricing.payment_due)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span>Remaining:</span>
                    <span className={`font-medium ${getRemainingAmount() > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(getRemainingAmount()))}
                    </span>
                  </div>
                  <div className="flex items-center mt-2">
                    {isPaymentComplete() ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        <span className="text-green-600 text-sm">All payments configured</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
                        <span className="text-orange-600 text-sm">
                          {getRemainingAmount() > 0 ? 'Payment incomplete' : 'Payment exceeds due amount'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline">
            Save as Draft
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading || (!allowPartialPayment && !isPaymentComplete())}
          >
            {isLoading ? 'Processing...' : 'Process Payment'}
          </Button>
        </div>
      </form>

      {/* Payment Instructions */}
      {selectedMethodData && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {selectedMethod === 'CASH' && (
                <p>Ensure you have the exact amount. Change will be provided if necessary.</p>
              )}
              {selectedMethod === 'CARD' && (
                <p>Please have your credit/debit card ready. PIN may be required for transactions above ₹2,000.</p>
              )}
              {selectedMethod === 'UPI' && (
                <p>Scan the QR code or use the UPI ID provided. Enter the exact amount shown above.</p>
              )}
              {selectedMethod === 'BANK_TRANSFER' && (
                <p>Transfer the exact amount to the account details provided. Share the transaction reference.</p>
              )}
              {selectedMethod === 'CREDIT' && (
                <p>This amount will be added to the customer's credit account. Ensure credit limit is sufficient.</p>
              )}
              {selectedMethod === 'CHEQUE' && (
                <p>Cheque should be drawn in favor of the company name. Ensure proper date and signature.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}