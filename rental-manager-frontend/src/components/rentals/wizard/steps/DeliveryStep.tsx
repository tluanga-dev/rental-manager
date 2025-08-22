'use client';

import { useState, useEffect } from 'react';
import { Truck, Calendar, Clock, MapPin, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PastelCalendar } from '@/components/ui/pastel-calendar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { WizardData } from '../RentalCreationWizard';

interface DeliveryStepProps {
  data: WizardData;
  onUpdate: (data: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function DeliveryStep({ data, onUpdate, onNext, onBack }: DeliveryStepProps) {
  const [formData, setFormData] = useState({
    delivery_required: data.delivery_required ?? true, // Default to delivery service
    delivery_address: data.delivery_address || '',
    delivery_date: data.delivery_date || data.rental_start_date,
    delivery_time: data.delivery_time || '09:00',
    delivery_charge: data.delivery_charge ?? 25, // Default delivery charge
    pickup_required: data.pickup_required ?? false,
    pickup_date: data.pickup_date || data.rental_end_date,
    pickup_time: data.pickup_time || '17:00',
    pickup_charge: data.pickup_charge ?? 25, // Default pickup charge
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    onUpdate(formData);
  }, [formData, onUpdate]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDeliveryToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      delivery_required: checked,
      pickup_required: checked ? false : prev.pickup_required
    }));
    if (errors.service_selection) {
      setErrors(prev => ({ ...prev, service_selection: '' }));
    }
  };

  const handlePickupToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      pickup_required: checked,
      delivery_required: checked ? false : prev.delivery_required
    }));
    if (errors.service_selection) {
      setErrors(prev => ({ ...prev, service_selection: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Ensure at least one service is selected
    if (!formData.delivery_required && !formData.pickup_required) {
      newErrors.service_selection = 'You must select either delivery or pickup service';
    }

    if (formData.delivery_required) {
      if (!formData.delivery_address.trim()) {
        newErrors.delivery_address = 'Delivery address is required';
      }
      if (!formData.delivery_date) {
        newErrors.delivery_date = 'Delivery date is required';
      }
      if (!formData.delivery_time) {
        newErrors.delivery_time = 'Delivery time is required';
      }
    }

    if (formData.pickup_required) {
      if (!formData.pickup_date) {
        newErrors.pickup_date = 'Pickup date is required';
      }
      if (!formData.pickup_time) {
        newErrors.pickup_time = 'Pickup time is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      onNext();
    }
  };

  const getEstimatedCost = () => {
    let cost = 0;
    if (formData.delivery_required) cost += formData.delivery_charge || 0;
    if (formData.pickup_required) cost += formData.pickup_charge || 0;
    return cost;
  };

  return (
    <div className="space-y-6">
      {/* Service Selection Error */}
      {errors.service_selection && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm font-medium">{errors.service_selection}</p>
        </div>
      )}

      {/* Service Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={formData.delivery_required ? 'border-green-300 bg-green-50' : 'border-gray-200'}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                Delivery Service
              </span>
              <Switch
                checked={formData.delivery_required}
                onCheckedChange={handleDeliveryToggle}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              We'll deliver the rental items to your specified location
            </p>
            {formData.delivery_required && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                Service Enabled
              </Badge>
            )}
            {formData.pickup_required && (
              <Badge variant="outline" className="text-gray-500 border-gray-300">
                Disabled (Pickup Active)
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className={formData.pickup_required ? 'border-green-300 bg-green-50' : 'border-gray-200'}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600 transform rotate-180" />
                Pickup Service
              </span>
              <Switch
                checked={formData.pickup_required}
                onCheckedChange={handlePickupToggle}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              We'll pick up the rental items from your location
            </p>
            {formData.pickup_required && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                Service Enabled
              </Badge>
            )}
            {formData.delivery_required && (
              <Badge variant="outline" className="text-gray-500 border-gray-300">
                Disabled (Delivery Active)
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delivery Details */}
      {formData.delivery_required && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="delivery_address">Delivery Address *</Label>
              <Textarea
                id="delivery_address"
                value={formData.delivery_address}
                onChange={(e) => handleInputChange('delivery_address', e.target.value)}
                placeholder="Enter the complete delivery address"
                className={cn('mt-2', errors.delivery_address && 'border-red-500')}
              />
              {errors.delivery_address && (
                <p className="text-red-500 text-sm mt-1">{errors.delivery_address}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="delivery_date">Delivery Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal mt-2',
                        !formData.delivery_date && 'text-muted-foreground',
                        errors.delivery_date && 'border-red-500'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.delivery_date ? (
                        format(formData.delivery_date, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <PastelCalendar
                      value={formData.delivery_date}
                      onChange={(date) => handleInputChange('delivery_date', date)}
                    />
                  </PopoverContent>
                </Popover>
                {errors.delivery_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.delivery_date}</p>
                )}
              </div>

              <div>
                <Label htmlFor="delivery_time">Delivery Time *</Label>
                <Input
                  id="delivery_time"
                  type="time"
                  value={formData.delivery_time}
                  onChange={(e) => handleInputChange('delivery_time', e.target.value)}
                  className={cn('mt-2', errors.delivery_time && 'border-red-500')}
                />
                {errors.delivery_time && (
                  <p className="text-red-500 text-sm mt-1">{errors.delivery_time}</p>
                )}
              </div>

              <div>
                <Label htmlFor="delivery_charge">Delivery Charge (₹)</Label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm font-semibold text-gray-500">₹</span>
                  <Input
                    id="delivery_charge"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.delivery_charge}
                    onChange={(e) => handleInputChange('delivery_charge', parseFloat(e.target.value) || 0)}
                    className="pl-10"
                    placeholder="Enter delivery charge"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm text-slate-800">
                <strong>Delivery Window:</strong> We'll deliver between {formData.delivery_time} and{' '}
                {formData.delivery_time && 
                  `${(parseInt(formData.delivery_time.split(':')[0]) + 2).toString().padStart(2, '0')}:${formData.delivery_time.split(':')[1]}`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pickup Details */}
      {formData.pickup_required && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              Pickup Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="pickup_date">Pickup Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal mt-2',
                        !formData.pickup_date && 'text-muted-foreground',
                        errors.pickup_date && 'border-red-500'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.pickup_date ? (
                        format(formData.pickup_date, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <PastelCalendar
                      value={formData.pickup_date}
                      onChange={(date) => handleInputChange('pickup_date', date)}
                    />
                  </PopoverContent>
                </Popover>
                {errors.pickup_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.pickup_date}</p>
                )}
              </div>

              <div>
                <Label htmlFor="pickup_time">Pickup Time *</Label>
                <Input
                  id="pickup_time"
                  type="time"
                  value={formData.pickup_time}
                  onChange={(e) => handleInputChange('pickup_time', e.target.value)}
                  className={cn('mt-2', errors.pickup_time && 'border-red-500')}
                />
                {errors.pickup_time && (
                  <p className="text-red-500 text-sm mt-1">{errors.pickup_time}</p>
                )}
              </div>

              <div>
                <Label htmlFor="pickup_charge">Pickup Charge (₹)</Label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm font-semibold text-gray-500">₹</span>
                  <Input
                    id="pickup_charge"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.pickup_charge}
                    onChange={(e) => handleInputChange('pickup_charge', parseFloat(e.target.value) || 0)}
                    className="pl-10"
                    placeholder="Enter pickup charge"
                  />
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-3 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Pickup Window:</strong> We'll pick up between {formData.pickup_time} and{' '}
                {formData.pickup_time && 
                  `${(parseInt(formData.pickup_time.split(':')[0]) + 2).toString().padStart(2, '0')}:${formData.pickup_time.split(':')[1]}`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Summary */}
      {(formData.delivery_required || formData.pickup_required) && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader>
            <CardTitle className="text-lg text-indigo-900">Service Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {formData.delivery_required && (
                <div className="flex justify-between items-center">
                  <span className="text-indigo-800">Delivery Service</span>
                  <Badge variant="outline" className="text-indigo-700">₹{formData.delivery_charge?.toFixed(2) || '0.00'}</Badge>
                </div>
              )}
              {formData.pickup_required && (
                <div className="flex justify-between items-center">
                  <span className="text-indigo-800">Pickup Service</span>
                  <Badge variant="outline" className="text-indigo-700">₹{formData.pickup_charge?.toFixed(2) || '0.00'}</Badge>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center font-semibold">
                <span className="text-indigo-900">Total Service Cost</span>
                <span className="text-indigo-900">₹{getEstimatedCost().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Required Notice */}
      {!formData.delivery_required && !formData.pickup_required && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="text-center py-8">
            <Truck className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-amber-800 mb-2">
              Service Selection Required
            </h3>
            <p className="text-amber-700">
              Please select either delivery or pickup service to continue
            </p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onBack}>
          Back to Items
        </Button>
        <Button
          onClick={handleNext}
          disabled={!formData.delivery_required && !formData.pickup_required}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Continue to Payment
        </Button>
      </div>
    </div>
  );
}