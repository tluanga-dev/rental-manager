'use client';

import React, { useState, useEffect } from 'react';
import { format, addDays, differenceInDays } from 'date-fns';
import { Calendar, Package, User, MapPin, DollarSign, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useBookings, useBookingAvailability } from '@/hooks/useBookings';
import { BookingCreateRequest, BookingAvailabilityResponse } from '@/types/booking';
import { useCustomers } from '@/components/customers/hooks/useCustomers';
import { useItems } from '@/components/items/hooks/useItems';
import { useLocations } from '@/hooks/useLocations';

interface BookingCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (booking: any) => void;
  preSelectedItemId?: string;
  preSelectedCustomerId?: string;
}

type WizardStep = 'item' | 'dates' | 'customer' | 'summary';

export const BookingCreationWizard: React.FC<BookingCreationWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedItemId,
  preSelectedCustomerId
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('item');
  const [bookingData, setBookingData] = useState<Partial<BookingCreateRequest>>({
    item_id: preSelectedItemId || '',
    customer_id: preSelectedCustomerId || '',
    quantity_reserved: 1,
    deposit_paid: false,
    notes: ''
  });

  const { createBooking, isCreating } = useBookings();
  const { checkAvailability, availability, isChecking, reset: resetAvailability } = useBookingAvailability();
  const { customers } = useCustomers();
  const { items } = useItems();
  const { locations } = useLocations();

  // Calculate rental details
  const selectedItem = items?.find(item => item.id === bookingData.item_id);
  const selectedCustomer = customers?.find(c => c.id === bookingData.customer_id);
  const selectedLocation = locations?.find(l => l.id === bookingData.location_id);

  const calculateRentalDetails = () => {
    if (!bookingData.start_date || !bookingData.end_date || !selectedItem) {
      return { days: 0, periods: 0, estimatedTotal: 0, depositRequired: 0 };
    }

    const start = new Date(bookingData.start_date);
    const end = new Date(bookingData.end_date);
    const days = differenceInDays(end, start) + 1; // Inclusive
    const rentalPeriod = selectedItem.rental_period || 1;
    const periods = Math.ceil(days / rentalPeriod);
    const rentalRate = selectedItem.rental_rate || 100;
    const quantity = bookingData.quantity_reserved || 1;
    const estimatedTotal = rentalRate * periods * quantity;
    const depositRequired = estimatedTotal * 0.2; // 20% deposit

    return { days, periods, estimatedTotal, depositRequired };
  };

  const { days, periods, estimatedTotal, depositRequired } = calculateRentalDetails();

  // Check availability when dates or item change
  useEffect(() => {
    if (bookingData.item_id && bookingData.start_date && bookingData.end_date && bookingData.quantity_reserved) {
      checkAvailability({
        item_id: bookingData.item_id,
        quantity: bookingData.quantity_reserved,
        start_date: bookingData.start_date,
        end_date: bookingData.end_date
      });
    }
  }, [bookingData.item_id, bookingData.start_date, bookingData.end_date, bookingData.quantity_reserved]);

  const handleNext = () => {
    const steps: WizardStep[] = ['item', 'dates', 'customer', 'summary'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const steps: WizardStep[] = ['item', 'dates', 'customer', 'summary'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    const completeBookingData: BookingCreateRequest = {
      item_id: bookingData.item_id!,
      quantity_reserved: bookingData.quantity_reserved!,
      start_date: bookingData.start_date!,
      end_date: bookingData.end_date!,
      customer_id: bookingData.customer_id!,
      location_id: bookingData.location_id!,
      estimated_rental_rate: selectedItem?.rental_rate,
      estimated_total: estimatedTotal,
      deposit_required: depositRequired,
      deposit_paid: bookingData.deposit_paid || false,
      notes: bookingData.notes
    };

    createBooking(completeBookingData, {
      onSuccess: (booking) => {
        onSuccess?.(booking);
        onClose();
        resetForm();
      }
    });
  };

  const resetForm = () => {
    setCurrentStep('item');
    setBookingData({
      item_id: preSelectedItemId || '',
      customer_id: preSelectedCustomerId || '',
      quantity_reserved: 1,
      deposit_paid: false,
      notes: ''
    });
    resetAvailability();
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'item', label: 'Select Item', icon: Package },
      { key: 'dates', label: 'Choose Dates', icon: Calendar },
      { key: 'customer', label: 'Customer', icon: User },
      { key: 'summary', label: 'Review', icon: Check }
    ];

    return (
      <div className="flex items-center justify-between mb-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.key === currentStep;
          const isCompleted = steps.findIndex(s => s.key === currentStep) > index;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${isActive ? 'bg-blue-600 text-white' : 
                      isCompleted ? 'bg-green-600 text-white' : 
                      'bg-gray-200 text-gray-600'}
                  `}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : ''}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderItemSelection = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="item">Select Item</Label>
        <select
          id="item"
          className="w-full p-2 border rounded-md"
          value={bookingData.item_id}
          onChange={(e) => setBookingData({ ...bookingData, item_id: e.target.value })}
        >
          <option value="">Select an item...</option>
          {items?.map(item => (
            <option key={item.id} value={item.id}>
              {item.item_name} - ${item.rental_rate || 0}/period
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="quantity">Quantity</Label>
        <Input
          id="quantity"
          type="number"
          min="1"
          value={bookingData.quantity_reserved}
          onChange={(e) => setBookingData({ 
            ...bookingData, 
            quantity_reserved: parseInt(e.target.value) || 1 
          })}
        />
      </div>

      <div>
        <Label htmlFor="location">Pickup/Return Location</Label>
        <select
          id="location"
          className="w-full p-2 border rounded-md"
          value={bookingData.location_id}
          onChange={(e) => setBookingData({ ...bookingData, location_id: e.target.value })}
        >
          <option value="">Select location...</option>
          {locations?.map(location => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </div>

      {selectedItem && (
        <Card className="bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm"><strong>Item:</strong> {selectedItem.item_name}</p>
            <p className="text-sm"><strong>SKU:</strong> {selectedItem.sku}</p>
            <p className="text-sm"><strong>Rate:</strong> ${selectedItem.rental_rate || 0} per {selectedItem.rental_period || 1} day(s)</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderDateSelection = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="start_date">Start Date</Label>
        <Input
          id="start_date"
          type="date"
          min={format(new Date(), 'yyyy-MM-dd')}
          value={bookingData.start_date}
          onChange={(e) => setBookingData({ ...bookingData, start_date: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="end_date">End Date</Label>
        <Input
          id="end_date"
          type="date"
          min={bookingData.start_date || format(new Date(), 'yyyy-MM-dd')}
          value={bookingData.end_date}
          onChange={(e) => setBookingData({ ...bookingData, end_date: e.target.value })}
        />
      </div>

      {bookingData.start_date && bookingData.end_date && (
        <Card className="bg-gray-50">
          <CardContent className="pt-4">
            <p className="text-sm"><strong>Rental Period:</strong> {days} days ({periods} rental periods)</p>
            <p className="text-sm"><strong>Estimated Total:</strong> ${estimatedTotal.toFixed(2)}</p>
            <p className="text-sm"><strong>Deposit Required:</strong> ${depositRequired.toFixed(2)}</p>
          </CardContent>
        </Card>
      )}

      {availability && (
        <Alert className={availability.is_available ? 'border-green-500' : 'border-red-500'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {availability.is_available ? (
              <span className="text-green-600">
                ✓ Available - {availability.available_quantity} units available
              </span>
            ) : (
              <div>
                <span className="text-red-600">✗ Not Available</span>
                <p className="text-sm mt-1">
                  {availability.conflicting_bookings} conflicting booking(s). 
                  Only {availability.available_quantity} of {availability.requested_quantity} units available.
                </p>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderCustomerSelection = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="customer">Select Customer</Label>
        <select
          id="customer"
          className="w-full p-2 border rounded-md"
          value={bookingData.customer_id}
          onChange={(e) => setBookingData({ ...bookingData, customer_id: e.target.value })}
        >
          <option value="">Select customer...</option>
          {customers?.map(customer => (
            <option key={customer.id} value={customer.id}>
              {customer.name} - {customer.phone}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="deposit_paid">
          <input
            id="deposit_paid"
            type="checkbox"
            className="mr-2"
            checked={bookingData.deposit_paid}
            onChange={(e) => setBookingData({ ...bookingData, deposit_paid: e.target.checked })}
          />
          Deposit Paid (${depositRequired.toFixed(2)})
        </Label>
      </div>

      <div>
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea
          id="notes"
          value={bookingData.notes}
          onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
          placeholder="Any special instructions or notes..."
          rows={3}
        />
      </div>

      {selectedCustomer && (
        <Card className="bg-blue-50">
          <CardContent className="pt-4">
            <p className="text-sm"><strong>Customer:</strong> {selectedCustomer.name}</p>
            <p className="text-sm"><strong>Email:</strong> {selectedCustomer.email}</p>
            <p className="text-sm"><strong>Phone:</strong> {selectedCustomer.phone}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Booking Summary</CardTitle>
          <CardDescription>Review your booking details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Item:</span>
            <span className="text-sm font-medium">{selectedItem?.item_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Quantity:</span>
            <span className="text-sm font-medium">{bookingData.quantity_reserved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Period:</span>
            <span className="text-sm font-medium">
              {bookingData.start_date && bookingData.end_date && 
                `${format(new Date(bookingData.start_date), 'MMM dd, yyyy')} - 
                 ${format(new Date(bookingData.end_date), 'MMM dd, yyyy')}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Duration:</span>
            <span className="text-sm font-medium">{days} days ({periods} periods)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Customer:</span>
            <span className="text-sm font-medium">{selectedCustomer?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Location:</span>
            <span className="text-sm font-medium">{selectedLocation?.name}</span>
          </div>
          <div className="border-t pt-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Estimated Total:</span>
              <span className="text-lg font-semibold">${estimatedTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Deposit Required:</span>
              <span className="text-sm font-medium">${depositRequired.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Deposit Status:</span>
              <Badge variant={bookingData.deposit_paid ? 'success' : 'warning'}>
                {bookingData.deposit_paid ? 'Paid' : 'Pending'}
              </Badge>
            </div>
          </div>
          {bookingData.notes && (
            <div className="border-t pt-3">
              <p className="text-sm text-gray-600">Notes:</p>
              <p className="text-sm">{bookingData.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {availability && !availability.is_available && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Warning: The item is not fully available for the selected period. 
            The booking will be created but may need adjustment.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'item':
        return renderItemSelection();
      case 'dates':
        return renderDateSelection();
      case 'customer':
        return renderCustomerSelection();
      case 'summary':
        return renderSummary();
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'item':
        return bookingData.item_id && bookingData.location_id && bookingData.quantity_reserved;
      case 'dates':
        return bookingData.start_date && bookingData.end_date;
      case 'customer':
        return bookingData.customer_id;
      case 'summary':
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Booking</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {renderStepIndicator()}
          {renderCurrentStep()}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {currentStep !== 'item' && (
              <Button variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {currentStep !== 'summary' ? (
              <Button 
                onClick={handleNext} 
                disabled={!canProceed() || (currentStep === 'dates' && isChecking)}
              >
                Next
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={isCreating || !canProceed()}
              >
                {isCreating ? 'Creating...' : 'Create Booking'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};