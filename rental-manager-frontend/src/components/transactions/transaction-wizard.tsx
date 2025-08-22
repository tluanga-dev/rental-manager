'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, 
  ChevronRight, 
  ShoppingCart, 
  User, 
  CreditCard, 
  FileText, 
  CheckCircle 
} from 'lucide-react';
import { TransactionWizardData, TransactionType, PricingBreakdown } from '@/types/transactions';
import { RentableItemSelector } from './RentableItemSelector';

interface TransactionWizardProps {
  transactionType: TransactionType;
  onComplete: (data: TransactionWizardData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

type WizardStep = 'products' | 'customer' | 'payment' | 'review' | 'complete';

const steps: Array<{ id: WizardStep; title: string; icon: any; description: string }> = [
  { 
    id: 'products', 
    title: 'Select Products', 
    icon: ShoppingCart, 
    description: 'Choose items and quantities' 
  },
  { 
    id: 'customer', 
    title: 'Customer Details', 
    icon: User, 
    description: 'Select or add customer' 
  },
  { 
    id: 'payment', 
    title: 'Payment', 
    icon: CreditCard, 
    description: 'Process payment' 
  },
  { 
    id: 'review', 
    title: 'Review', 
    icon: FileText, 
    description: 'Confirm transaction' 
  },
  { 
    id: 'complete', 
    title: 'Complete', 
    icon: CheckCircle, 
    description: 'Transaction completed' 
  },
];

export function TransactionWizard({
  transactionType,
  onComplete,
  onCancel,
  isLoading,
}: TransactionWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('products');
  const [wizardData, setWizardData] = useState<TransactionWizardData>({
    transaction_type: transactionType,
    location_id: '', // This should be set from user context
    cart_items: [],
    discount_amount: 0,
  });

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 'products':
        return wizardData.cart_items.length > 0;
      case 'customer':
        return !!wizardData.customer_id;
      case 'payment':
        return !!wizardData.payment_method;
      case 'review':
        return true;
      case 'complete':
        return false;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleStepClick = (stepId: WizardStep) => {
    const stepIndex = steps.findIndex(step => step.id === stepId);
    // Only allow going back or to current step
    if (stepIndex <= currentStepIndex) {
      setCurrentStep(stepId);
    }
  };

  const updateWizardData = (updates: Partial<TransactionWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  };

  const calculatePricing = (): PricingBreakdown => {
    const subtotal = wizardData.cart_items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unit_price * (item.rental_days || 1);
      const discountAmount = lineTotal * (item.discount_percentage / 100);
      return sum + (lineTotal - discountAmount);
    }, 0);

    const discount_amount = wizardData.discount_amount;
    const tax_amount = (subtotal - discount_amount) * 0.18; // 18% GST
    const deposit_total = wizardData.cart_items.reduce((sum, item) => 
      sum + (item.deposit_per_unit * item.quantity), 0
    );
    const total_amount = subtotal - discount_amount + tax_amount;
    const payment_due = total_amount + deposit_total;

    return {
      subtotal,
      discount_amount,
      tax_amount,
      deposit_total,
      total_amount,
      payment_due,
    };
  };

  const handleComplete = () => {
    onComplete(wizardData);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getTransactionTypeDisplay = () => {
    switch (transactionType) {
      case 'SALE':
        return { title: 'New Sale', color: 'bg-green-100 text-green-800' };
      case 'RENTAL':
        return { title: 'New Rental', color: 'bg-slate-100 text-slate-800' };
      case 'RETURN':
        return { title: 'Process Return', color: 'bg-orange-100 text-orange-800' };
      case 'REFUND':
        return { title: 'Process Refund', color: 'bg-red-100 text-red-800' };
      default:
        return { title: 'Transaction', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const transactionDisplay = getTransactionTypeDisplay();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Badge className={transactionDisplay.color}>
                  {transactionDisplay.title}
                </Badge>
                <div>
                  <h1 className="text-2xl font-bold">Transaction Wizard</h1>
                  <p className="text-muted-foreground">
                    Complete your {transactionType.toLowerCase()} transaction
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Progress Steps */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              
              {/* Step indicators */}
              <div className="flex justify-between">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = step.id === currentStep;
                  const isCompleted = index < currentStepIndex;
                  const isAccessible = index <= currentStepIndex;
                  
                  return (
                    <div
                      key={step.id}
                      className={`flex flex-col items-center space-y-2 cursor-pointer ${
                        isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                      }`}
                      onClick={() => isAccessible && handleStepClick(step.id)}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                          isActive
                            ? 'bg-slate-500 border-slate-500 text-white'
                            : isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'bg-white border-gray-300 text-gray-400'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-medium ${
                          isActive ? 'text-slate-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {step.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step Content */}
          <div className="lg:col-span-2">
            <Card className="min-h-[600px]">
              <CardHeader>
                <CardTitle>
                  {steps.find(s => s.id === currentStep)?.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentStep === 'products' && (
                  <RentableItemSelector
                    cartItems={wizardData.cart_items}
                    transactionType={transactionType}
                    locationId={wizardData.location_id}
                    onCartUpdate={(cartItems) => updateWizardData({ cart_items: cartItems })}
                    isLoading={isLoading}
                  />
                )}

                {currentStep === 'customer' && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Select an existing customer or add a new one.
                    </p>
                    
                    {/* Customer Selector Component would go here */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium mb-2">Customer Selector</h3>
                      <p className="text-muted-foreground mb-4">
                        Choose or add customer details
                      </p>
                      <div className="flex justify-center space-x-4">
                        <Button variant="outline">
                          Search Customers
                        </Button>
                        <Button variant="outline">
                          Add New Customer
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 'payment' && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Process payment for this transaction.
                    </p>
                    
                    {/* Payment Form Component would go here */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium mb-2">Payment Processing</h3>
                      <p className="text-muted-foreground mb-4">
                        Select payment method and process transaction
                      </p>
                      <Button variant="outline">
                        Configure Payment
                      </Button>
                    </div>
                  </div>
                )}

                {currentStep === 'review' && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Review all transaction details before completing.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Transaction Summary</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Type:</span>
                            <Badge className={transactionDisplay.color}>
                              {transactionDisplay.title}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Items:</span>
                            <span>{wizardData.cart_items.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Customer:</span>
                            <span>{wizardData.customer_id || 'Not selected'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Payment:</span>
                            <span>{wizardData.payment_method || 'Not configured'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 'complete' && (
                  <div className="text-center space-y-4">
                    <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                    <h3 className="text-xl font-semibold">Transaction Completed!</h3>
                    <p className="text-muted-foreground">
                      Your {transactionType.toLowerCase()} has been processed successfully.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            {/* Pricing Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const pricing = calculatePricing();
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(pricing.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Discount:</span>
                        <span className="text-red-600">
                          -{formatCurrency(pricing.discount_amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax (18%):</span>
                        <span>{formatCurrency(pricing.tax_amount)}</span>
                      </div>
                      {transactionType === 'RENTAL' && (
                        <div className="flex justify-between text-sm">
                          <span>Security Deposit:</span>
                          <span>{formatCurrency(pricing.deposit_total)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2">
                        <div className="flex justify-between font-semibold">
                          <span>Total Amount:</span>
                          <span>{formatCurrency(pricing.total_amount)}</span>
                        </div>
                        {transactionType === 'RENTAL' && (
                          <div className="flex justify-between font-bold text-lg mt-2">
                            <span>Total Due:</span>
                            <span>{formatCurrency(pricing.payment_due)}</span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Cart Items */}
            {wizardData.cart_items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Cart Items ({wizardData.cart_items.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {wizardData.cart_items.map((item, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                      <div className="font-medium">SKU: {item.sku_id}</div>
                      <div className="text-muted-foreground">
                        Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                        {item.rental_days && ` × ${item.rental_days} days`}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Navigation */}
        {currentStep !== 'complete' && (
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStepIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                {currentStep === 'review' ? (
                  <Button
                    onClick={handleComplete}
                    disabled={!canProceed() || isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Complete Transaction'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}