'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthConnectionGuard } from '@/components/auth/auth-connection-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft,
  Save,
  Users,
  Building,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { customersApi, type CustomerCreate } from '@/services/api/customers';
import { useAppStore } from '@/stores/app-store';

function CustomerCreateContent() {
  const router = useRouter();
  const { addNotification } = useAppStore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState<CustomerCreate>({
    customer_code: '',
    customer_type: 'INDIVIDUAL',
    business_name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    tax_number: '',
    credit_limit: 1000,
    payment_terms: '',
    notes: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const generateCustomerCode = () => {
    const prefix = formData.customer_type === 'BUSINESS' ? 'BUS' : 'IND';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.customer_code.trim()) {
      newErrors.customer_code = 'Customer code is required';
    }

    if (formData.customer_type === 'BUSINESS') {
      if (!formData.business_name?.trim()) {
        newErrors.business_name = 'Business name is required for business customers';
      }
    } else {
      if (!formData.first_name?.trim()) {
        newErrors.first_name = 'First name is required for individual customers';
      }
      if (!formData.last_name?.trim()) {
        newErrors.last_name = 'Last name is required for individual customers';
      }
    }

    if (formData.credit_limit < 0) {
      newErrors.credit_limit = 'Credit limit cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof CustomerCreate, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCustomerTypeChange = (type: 'INDIVIDUAL' | 'BUSINESS') => {
    setFormData(prev => ({
      ...prev,
      customer_type: type,
      // Clear fields that don't apply to the new type
      business_name: type === 'BUSINESS' ? prev.business_name : '',
      first_name: type === 'INDIVIDUAL' ? prev.first_name : '',
      last_name: type === 'INDIVIDUAL' ? prev.last_name : '',
      tax_number: prev.tax_number // Tax number can apply to both
    }));
    
    // Clear related errors
    setErrors(prev => {
      const newErrors = { ...prev };
      if (type === 'BUSINESS') {
        delete newErrors.first_name;
        delete newErrors.last_name;
      } else {
        delete newErrors.business_name;
      }
      return newErrors;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const customer = await customersApi.create(formData);
      
      setIsSuccess(true);
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Customer created successfully'
      });

      // Redirect after a short delay to show success state
      setTimeout(() => {
        router.push(`/customers/${customer.id}`);
      }, 1500);
      
    } catch (error: any) {
      console.error('Error creating customer:', error);
      
      // Handle specific validation errors from backend
      if (error.response?.status === 400) {
        const detail = error.response.data?.detail;
        if (typeof detail === 'string') {
          if (detail.includes('customer_code')) {
            setErrors({ customer_code: 'Customer code already exists' });
          } else {
            addNotification({
              type: 'error',
              title: 'Validation Error',
              message: detail
            });
          }
        } else {
          addNotification({
            type: 'error',
            title: 'Validation Error',
            message: 'Please check your input and try again'
          });
        }
      } else {
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to create customer. Please try again.'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDisplayName = () => {
    if (formData.customer_type === 'BUSINESS') {
      return formData.business_name || 'New Business Customer';
    }
    const firstName = formData.first_name || '';
    const lastName = formData.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'New Individual Customer';
  };

  return (
    <div className="p-6 space-y-6 relative">
      {/* Loading Overlay */}
      {(isSubmitting || isSuccess) && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg flex items-center space-x-3">
            {isSuccess ? (
              <>
                <CheckCircle className="h-6 w-6 text-green-600" />
                <span className="text-green-600 font-medium">Customer created successfully!</span>
              </>
            ) : (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                <span className="text-gray-600">Creating customer...</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Create New Customer
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Add a new customer to the system
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Button
                    type="button"
                    variant={formData.customer_type === 'INDIVIDUAL' ? 'default' : 'outline'}
                    className="h-20 flex-col gap-2"
                    onClick={() => handleCustomerTypeChange('INDIVIDUAL')}
                  >
                    <Users className="h-6 w-6" />
                    Individual Customer
                  </Button>
                  <Button
                    type="button"
                    variant={formData.customer_type === 'BUSINESS' ? 'default' : 'outline'}
                    className="h-20 flex-col gap-2"
                    onClick={() => handleCustomerTypeChange('BUSINESS')}
                  >
                    <Building className="h-6 w-6" />
                    Business Customer
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="customer_code">Customer Code *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="customer_code"
                        value={formData.customer_code}
                        onChange={(e) => handleInputChange('customer_code', e.target.value)}
                        placeholder="Enter customer code"
                        className={errors.customer_code ? 'border-red-500' : ''}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleInputChange('customer_code', generateCustomerCode())}
                      >
                        Generate
                      </Button>
                    </div>
                    {errors.customer_code && (
                      <p className="text-sm text-red-500 mt-1">{errors.customer_code}</p>
                    )}
                  </div>
                </div>

                {formData.customer_type === 'BUSINESS' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="business_name">Business Name *</Label>
                      <Input
                        id="business_name"
                        value={formData.business_name}
                        onChange={(e) => handleInputChange('business_name', e.target.value)}
                        placeholder="Enter business name"
                        className={errors.business_name ? 'border-red-500' : ''}
                      />
                      {errors.business_name && (
                        <p className="text-sm text-red-500 mt-1">{errors.business_name}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="tax_number">Tax Number</Label>
                      <Input
                        id="tax_number"
                        value={formData.tax_number}
                        onChange={(e) => handleInputChange('tax_number', e.target.value)}
                        placeholder="Enter tax number"
                        className={errors.tax_number ? 'border-red-500' : ''}
                      />
                      {errors.tax_number && (
                        <p className="text-sm text-red-500 mt-1">{errors.tax_number}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => handleInputChange('first_name', e.target.value)}
                        placeholder="Enter first name"
                        className={errors.first_name ? 'border-red-500' : ''}
                      />
                      {errors.first_name && (
                        <p className="text-sm text-red-500 mt-1">{errors.first_name}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => handleInputChange('last_name', e.target.value)}
                        placeholder="Enter last name"
                        className={errors.last_name ? 'border-red-500' : ''}
                      />
                      {errors.last_name && (
                        <p className="text-sm text-red-500 mt-1">{errors.last_name}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Enter email address"
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="Enter phone number"
                      className={errors.phone ? 'border-red-500' : ''}
                    />
                    {errors.phone && (
                      <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="mobile">Mobile</Label>
                    <Input
                      id="mobile"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange('mobile', e.target.value)}
                      placeholder="Enter mobile number"
                      className={errors.mobile ? 'border-red-500' : ''}
                    />
                    {errors.mobile && (
                      <p className="text-sm text-red-500 mt-1">{errors.mobile}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader>
                <CardTitle>Address Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="address_line1">Address Line 1</Label>
                    <Input
                      id="address_line1"
                      value={formData.address_line1}
                      onChange={(e) => handleInputChange('address_line1', e.target.value)}
                      placeholder="Enter street address"
                      className={errors.address_line1 ? 'border-red-500' : ''}
                    />
                    {errors.address_line1 && (
                      <p className="text-sm text-red-500 mt-1">{errors.address_line1}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="address_line2">Address Line 2</Label>
                    <Input
                      id="address_line2"
                      value={formData.address_line2}
                      onChange={(e) => handleInputChange('address_line2', e.target.value)}
                      placeholder="Enter apartment, suite, etc."
                      className={errors.address_line2 ? 'border-red-500' : ''}
                    />
                    {errors.address_line2 && (
                      <p className="text-sm text-red-500 mt-1">{errors.address_line2}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Enter city"
                      className={errors.city ? 'border-red-500' : ''}
                    />
                    {errors.city && (
                      <p className="text-sm text-red-500 mt-1">{errors.city}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      placeholder="Enter state"
                      className={errors.state ? 'border-red-500' : ''}
                    />
                    {errors.state && (
                      <p className="text-sm text-red-500 mt-1">{errors.state}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code}
                      onChange={(e) => handleInputChange('postal_code', e.target.value)}
                      placeholder="Enter postal code"
                      className={errors.postal_code ? 'border-red-500' : ''}
                    />
                    {errors.postal_code && (
                      <p className="text-sm text-red-500 mt-1">{errors.postal_code}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      placeholder="Enter country"
                      className={errors.country ? 'border-red-500' : ''}
                    />
                    {errors.country && (
                      <p className="text-sm text-red-500 mt-1">{errors.country}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Financial Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="credit_limit">Credit Limit (₹)</Label>
                    <Input
                      id="credit_limit"
                      type="number"
                      min="0"
                      step="100"
                      value={formData.credit_limit}
                      onChange={(e) => handleInputChange('credit_limit', parseFloat(e.target.value) || 0)}
                      placeholder="Enter credit limit"
                      className={errors.credit_limit ? 'border-red-500' : ''}
                    />
                    {errors.credit_limit && (
                      <p className="text-sm text-red-500 mt-1">{errors.credit_limit}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="payment_terms">Payment Terms</Label>
                    <Input
                      id="payment_terms"
                      value={formData.payment_terms}
                      onChange={(e) => handleInputChange('payment_terms', e.target.value)}
                      placeholder="e.g., Net 30, COD, etc."
                      className={errors.payment_terms ? 'border-red-500' : ''}
                    />
                    {errors.payment_terms && (
                      <p className="text-sm text-red-500 mt-1">{errors.payment_terms}</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Additional notes about the customer"
                    className={errors.notes ? 'border-red-500' : ''}
                    rows={3}
                  />
                  {errors.notes && (
                    <p className="text-sm text-red-500 mt-1">{errors.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center">
                    {formData.customer_type === 'BUSINESS' ? (
                      <Building className="h-8 w-8 text-slate-600" />
                    ) : (
                      <Users className="h-8 w-8 text-slate-600" />
                    )}
                  </div>
                  <h3 className="font-medium text-lg">{getDisplayName()}</h3>
                  <p className="text-sm text-gray-600">{formData.customer_code || 'No code set'}</p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium">{formData.customer_type}</span>
                  </div>
                  {formData.email && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium text-xs">{formData.email}</span>
                    </div>
                  )}
                  {formData.phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium">{formData.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Credit Limit:</span>
                    <span className="font-medium">${formData.credit_limit?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Card>
              <CardContent className="p-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting || isSuccess}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Customer...
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Customer Created!
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Customer
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function CustomerCreatePage() {
  return (
    <AuthConnectionGuard requireAuth={true} showOfflineAlert={true}>
      <ProtectedRoute requiredPermissions={['CUSTOMER_CREATE']}>
        <CustomerCreateContent />
      </ProtectedRoute>
    </AuthConnectionGuard>
  );
}