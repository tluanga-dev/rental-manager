'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowLeft, ArrowRight, Sparkles, CheckCircle, XCircle, AlertTriangle, Calendar, IndianRupee, User } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { rentalsApi } from '@/services/api/rentals';

// Step Components
import { CustomerStep } from './steps/CustomerStep';
import { RentalDetailsStep } from './steps/RentalDetailsStep';
import { ItemsStep } from './steps/ItemsStep';
import { DeliveryStep } from './steps/DeliveryStep';
import { PaymentStep } from './steps/PaymentStep';
import { ReviewStep } from './steps/ReviewStep';

export interface WizardData {
  // Customer data
  customer_id: string;
  customer?: any;
  
  // Rental details
  transaction_date: Date;
  location_id: string;
  location?: any;
  rental_start_date: Date;
  rental_end_date: Date;
  reference_number?: string;
  notes?: string;
  
  // Items
  items: Array<{
    id: string;
    item_id: string;
    item?: any;
    quantity: number;
    rental_rate: number;
    rental_periods?: number;
    period_type?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    rental_start_date?: Date;
    rental_end_date?: Date;
    discount_value?: number;
    notes?: string;
  }>;
  
  // Delivery & Pickup
  delivery_required: boolean;
  delivery_address?: string;
  delivery_date?: Date;
  delivery_time?: string;
  delivery_charge?: number;
  pickup_required: boolean;
  pickup_date?: Date;
  pickup_time?: string;
  pickup_charge?: number;
  
  // Payment
  payment_method?: string;
  payment_reference?: string;
  deposit_amount: number;
  tax_rate: number;
  discount_amount?: number;
}

const steps = [
  { 
    id: 'customer', 
    title: 'Customer', 
    description: 'Select customer details',
    icon: '👤'
  },
  { 
    id: 'details', 
    title: 'Rental Details', 
    description: 'Set dates and location',
    icon: '📅'
  },
  { 
    id: 'items', 
    title: 'Items', 
    description: 'Add rental items',
    icon: '📦'
  },
  { 
    id: 'delivery', 
    title: 'Delivery & Pickup', 
    description: 'Configure logistics',
    icon: '🚚'
  },
  { 
    id: 'payment', 
    title: 'Payment', 
    description: 'Set pricing and deposits',
    icon: '💳'
  },
  { 
    id: 'review', 
    title: 'Review', 
    description: 'Confirm and submit',
    icon: '✅'
  },
];

export function RentalCreationWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingSubmessage, setLoadingSubmessage] = useState('');
  
  const [wizardData, setWizardData] = useState<WizardData>({
    customer_id: '',
    transaction_date: new Date(),
    location_id: '',
    rental_start_date: new Date(),
    rental_end_date: new Date(),
    items: [],
    delivery_required: false,
    pickup_required: false,
    payment_method: 'CASH',
    payment_reference: '',
    deposit_amount: 0,
    tax_rate: 0,
  });

  const updateWizardData = useCallback((data: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...data }));
  }, []);

  const handleNext = useCallback(() => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleStepClick = useCallback((stepIndex: number) => {
    if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
      setCurrentStep(stepIndex);
    }
  }, [currentStep, completedSteps]);

  // Calculate total amount from wizard data for success dialog
  const calculateTotalAmount = useCallback(() => {
    const itemsSubtotal = wizardData.items.reduce((total, item) => {
      return total + (item.quantity * item.rental_rate - (item.discount_value || 0));
    }, 0);
    
    let deliverySubtotal = 0;
    if (wizardData.delivery_required) deliverySubtotal += 25;
    if (wizardData.pickup_required) deliverySubtotal += 25;
    
    const discountAmount = wizardData.discount_amount || 0;
    const subtotal = itemsSubtotal + deliverySubtotal - discountAmount;
    const taxAmount = (subtotal * wizardData.tax_rate) / 100;
    
    return subtotal + taxAmount;
  }, [wizardData]);

  const handleSubmit = async () => {
    // Prevent multiple submissions
    if (submissionState === 'submitting') return;
    
    setIsSubmitting(true);
    setSubmissionState('submitting');
    setSubmissionError(null);
    setSubmissionResult(null);
    setLoadingMessage('Creating Rental...');
    setLoadingSubmessage('Preparing your rental transaction');
    
    try {
      console.log('🚀 Starting rental creation process...');
      console.log('📋 Rental data being submitted:', {
        customer_id: wizardData.customer_id,
        location_id: wizardData.location_id,
        transaction_date: wizardData.transaction_date,
        rental_start_date: wizardData.rental_start_date,
        rental_end_date: wizardData.rental_end_date,
        items_count: wizardData.items?.length || 0,
        delivery_required: wizardData.delivery_required,
        pickup_required: wizardData.pickup_required,
        deposit_amount: wizardData.deposit_amount,
        tax_rate: wizardData.tax_rate,
        notes: wizardData.notes
      });

      // Update loading message
      setLoadingMessage('Validating Data...');
      setLoadingSubmessage('Checking inventory availability and customer details');

      // Transform wizard data to API format matching the exact schema
      const rentalData = {
        transaction_date: wizardData.transaction_date.toISOString().split('T')[0], // Date only in YYYY-MM-DD format
        customer_id: wizardData.customer_id,
        party_id: wizardData.customer_id, // Add required party_id field
        location_id: wizardData.location_id,
        payment_method: (wizardData.payment_method as 'CREDIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'CHECK') || 'CASH',
        payment_reference: wizardData.payment_reference || '',
        notes: wizardData.notes || '',
        items: wizardData.items?.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          rental_period_type: (item.period_type as 'DAILY' | 'WEEKLY' | 'MONTHLY') || 'DAILY',
          rental_period_value: item.rental_periods || 1,
          rental_start_date: (item.rental_start_date || wizardData.rental_start_date).toISOString().split('T')[0],
          rental_end_date: (item.rental_end_date || wizardData.rental_end_date).toISOString().split('T')[0],
          unit_rate: item.rental_rate || 0,
          discount_value: item.discount_value || 0,
          notes: item.notes || ''
        })) || [],
        delivery_required: wizardData.delivery_required || false,
        delivery_address: wizardData.delivery_address || '',
        delivery_date: wizardData.delivery_date?.toISOString().split('T')[0] || '',
        delivery_time: wizardData.delivery_time || '',
        pickup_required: wizardData.pickup_required || false,
        pickup_date: wizardData.pickup_date?.toISOString().split('T')[0] || '',
        pickup_time: wizardData.pickup_time || '',
        deposit_amount: wizardData.deposit_amount || 0,
        reference_number: wizardData.reference_number || ''
      };

      console.log('📦 Transformed API payload:', rentalData);

      // Update loading message before API call
      setLoadingMessage('Processing Rental...');
      setLoadingSubmessage('Saving rental details and updating inventory');

      // Call the rental creation API
      const response = await rentalsApi.createRental(rentalData);
      
      // Update loading message after API success
      setLoadingMessage('Rental Created Successfully!');
      setLoadingSubmessage('Preparing rental details...');
      
      // Log successful response
      console.log('✅ Rental creation successful!');
      console.log('🎉 API Response:', response);

      // Store the successful result
      setSubmissionResult(response);
      setSubmissionState('success');
      
      // Keep the success message visible briefly before showing the dialog
      setTimeout(() => {
        setIsSubmitting(false);
      }, 1500);

    } catch (error: any) {
      setLoadingMessage('Error Creating Rental');
      setLoadingSubmessage('Please check the details and try again');
      
      console.error('❌ Rental creation failed!');
      console.error('🔥 Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        stack: error.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack trace
      });

      // Extract user-friendly error message
      let errorMessage = 'An unexpected error occurred while creating the rental.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setSubmissionError(errorMessage);
      setSubmissionState('error');
      
      // Reset loading state after showing error briefly
      setTimeout(() => {
        setIsSubmitting(false);
      }, 2000);
    }
  };

  const renderStep = () => {
    const stepProps = {
      data: wizardData,
      onUpdate: updateWizardData,
      onNext: handleNext,
      onBack: handleBack,
      isLastStep: currentStep === steps.length - 1,
      isFirstStep: currentStep === 0,
    };

    switch (steps[currentStep].id) {
      case 'customer':
        return <CustomerStep {...stepProps} />;
      case 'details':
        return <RentalDetailsStep {...stepProps} />;
      case 'items':
        return <ItemsStep {...stepProps} />;
      case 'delivery':
        return <DeliveryStep {...stepProps} />;
      case 'payment':
        return <PaymentStep {...stepProps} />;
      case 'review':
        return <ReviewStep {...stepProps} onSubmit={handleSubmit} isSubmitting={isSubmitting} />;
      default:
        return null;
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">Create New Rental</h1>
        </div>
        <p className="text-gray-600">Follow the steps below to create a new rental agreement</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-medium text-gray-700">
            Step {currentStep + 1} of {steps.length}
          </span>
          <Badge variant="outline" className="text-indigo-600 border-indigo-200">
            {Math.round(progress)}% Complete
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Navigation */}
      <div className="flex justify-between items-center mb-8">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex flex-col items-center cursor-pointer transition-all ${
              index <= currentStep || completedSteps.has(index)
                ? 'text-indigo-600'
                : 'text-gray-400'
            }`}
            onClick={() => handleStepClick(index)}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold border-2 transition-all ${
                index === currentStep
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : completedSteps.has(index)
                  ? 'bg-green-100 text-green-600 border-green-300'
                  : index < currentStep
                  ? 'bg-indigo-100 text-indigo-600 border-indigo-300'
                  : 'bg-gray-100 text-gray-400 border-gray-300'
              }`}
            >
              {completedSteps.has(index) ? (
                <Check className="w-5 h-5" />
              ) : (
                <span>{step.icon}</span>
              )}
            </div>
            <div className="text-center mt-2">
              <div className="text-sm font-medium">{step.title}</div>
              <div className="text-xs text-gray-500 hidden sm:block">{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      <Separator className="mb-8" />

      {/* Step Content */}
      <Card className="shadow-lg border-0 bg-white/70 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3">
            <span className="text-2xl">{steps[currentStep].icon}</span>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {steps[currentStep].title}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {steps[currentStep].description}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      {/* <div className="flex justify-between items-center mt-8">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {currentStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Rental...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Rental
                </>
              )}
            </Button>
          )}
        </div>
      </div> */}

      {/* Loading Overlay */}
      <LoadingOverlay
        isVisible={isSubmitting}
        message={loadingMessage}
        submessage={loadingSubmessage}
      />

      {/* Success Dialog */}
      <Dialog open={submissionState === 'success'} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-green-800">
                  Rental Created Successfully!
                </DialogTitle>
                <DialogDescription className="text-green-600 mt-1">
                  Your rental has been created and is ready for processing.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {submissionResult && (
            <div className="space-y-4">
              {/* Enhanced rental summary with customer, amount, and date */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer Information */}
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full flex-shrink-0">
                      <User className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800">Customer</p>
                      <p className="text-lg font-semibold text-green-900">
                        {submissionResult.customer?.name || 
                         wizardData.customer?.name || 
                         wizardData.customer?.display_name ||
                         'N/A'}
                      </p>
                      {(submissionResult.customer?.code || wizardData.customer?.customer_code) && (
                        <p className="text-sm text-green-700">
                          Code: {submissionResult.customer?.code || wizardData.customer?.customer_code}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rental Amount */}
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full flex-shrink-0">
                      <IndianRupee className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800">Total Rental Amount</p>
                      <p className="text-lg font-semibold text-green-900">
                        ${submissionResult.financial_summary?.total_amount?.toFixed(2) || 
                          calculateTotalAmount().toFixed(2)}
                      </p>
                      {submissionResult.financial_summary?.deposit_amount && (
                        <p className="text-sm text-green-700">
                          Deposit: ${submissionResult.financial_summary.deposit_amount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rental Date & Time */}
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full flex-shrink-0">
                      <Calendar className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800">Rental Date</p>
                      <p className="text-lg font-semibold text-green-900">
                        {submissionResult.transaction_date 
                          ? format(new Date(submissionResult.transaction_date), 'MMM dd, yyyy')
                          : format(wizardData.transaction_date, 'MMM dd, yyyy')
                        }
                      </p>
                      <p className="text-sm text-green-700">
                        Created: {submissionResult.created_at 
                          ? format(new Date(submissionResult.created_at), 'hh:mm a')
                          : format(new Date(), 'hh:mm a')
                        }
                      </p>
                    </div>
                  </div>

                  {/* Transaction Number */}
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-800">Transaction Number</p>
                      <p className="text-lg font-mono font-semibold text-green-900">
                        {submissionResult.transaction_number || 'Generating...'}
                      </p>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 mt-1">
                        {submissionResult.rental_status || submissionResult.status || 'Active'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Rental Period Summary */}
                {(submissionResult.rental_period || wizardData.rental_start_date) && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-green-800">Rental Period: </span>
                        <span className="text-green-700">
                          {submissionResult.rental_period?.start_date 
                            ? format(new Date(submissionResult.rental_period.start_date), 'MMM dd')
                            : format(wizardData.rental_start_date, 'MMM dd')
                          } - {submissionResult.rental_period?.end_date 
                            ? format(new Date(submissionResult.rental_period.end_date), 'MMM dd, yyyy')
                            : format(wizardData.rental_end_date, 'MMM dd, yyyy')
                          }
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-green-800">Duration: </span>
                        <span className="text-green-700">
                          {submissionResult.rental_period?.total_days || 
                           Math.ceil((wizardData.rental_end_date.getTime() - wizardData.rental_start_date.getTime()) / (1000 * 60 * 60 * 24))
                          } days
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {submissionResult.rental_items && submissionResult.rental_items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Items ({submissionResult.rental_items.length})
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {submissionResult.rental_items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm text-gray-600 py-1">
                        <span>{item.item?.name || item.item_name || 'Item'}</span>
                        <span>Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSubmissionState('idle');
                setSubmissionResult(null);
              }}
            >
              Create Another Rental
            </Button>
            <Button
              onClick={() => {
                if (submissionResult?.id) {
                  router.push(`/rentals/${submissionResult.id}`);
                } else {
                  router.push('/rentals');
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              View Rental Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={submissionState === 'error'} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-red-800">
                  Rental Creation Failed
                </DialogTitle>
                <DialogDescription className="text-red-600 mt-1">
                  There was an error creating your rental. Please try again.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {submissionError && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800 mb-1">Error Details:</p>
                  <p className="text-sm text-red-700">{submissionError}</p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSubmissionState('idle');
                setSubmissionError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSubmissionState('idle');
                setSubmissionError(null);
                handleSubmit();
              }}
              variant="destructive"
            >
              Try Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
