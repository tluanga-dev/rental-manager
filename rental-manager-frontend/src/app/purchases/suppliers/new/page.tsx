'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  ArrowLeft,
  Save,
  Building2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Edit,
  Sparkles,
  Info
} from 'lucide-react';
import { suppliersApi, SupplierCreate } from '@/services/api/suppliers';

function CreateSupplierContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  
  const [formData, setFormData] = useState<SupplierCreate>({
    supplier_code: '',
    company_name: '',
    supplier_type: 'DISTRIBUTOR',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    payment_terms: 'NET30',
    credit_limit: 0,
    supplier_tier: 'STANDARD'
  });

  const [errors, setErrors] = useState<Partial<Record<keyof SupplierCreate, string>>>({});
  const [codeMode, setCodeMode] = useState<'auto' | 'manual'>('auto');
  const [isCodeGenerated, setIsCodeGenerated] = useState(false);

  const generateSupplierCode = (): string => {
    const typePrefix = formData.supplier_type.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 4).toUpperCase();
    return `SUP-${typePrefix}-${timestamp}-${random}`;
  };

  // Auto-generate supplier code on mount and when supplier type changes
  useEffect(() => {
    if (codeMode === 'auto') {
      const generatedCode = generateSupplierCode();
      setFormData(prev => ({ ...prev, supplier_code: generatedCode }));
      setIsCodeGenerated(true);
    }
  }, [codeMode, formData.supplier_type]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SupplierCreate, string>> = {};

    // Only validate supplier code if manual mode and empty
    if (codeMode === 'manual' && !formData.supplier_code.trim()) {
      newErrors.supplier_code = 'Supplier code is required';
    }

    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required';
    }

    if (formData.email && !isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.credit_limit && formData.credit_limit < 0) {
      newErrors.credit_limit = 'Credit limit cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (field: keyof SupplierCreate, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // If manually changing supplier code, switch to manual mode
    if (field === 'supplier_code' && codeMode === 'auto') {
      setCodeMode('manual');
      setIsCodeGenerated(false);
    }
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Clean up the form data
      const cleanedData: SupplierCreate = {
        ...formData,
        contact_person: formData.contact_person?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        tax_id: formData.tax_id?.trim() || undefined,
      };

      const newSupplier = await suppliersApi.create(cleanedData);
      
      // Show success dialog first
      setShowSuccessDialog(true);
      
      // Wait a moment then redirect
      setTimeout(() => {
        router.push(`/purchases/suppliers/${newSupplier.id}`);
      }, 1500);
    } catch (error: any) {
      console.error('Failed to create supplier:', error);
      let errorMessage = 'Failed to create supplier. Please try again.';
      
      // Handle different types of errors
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.toString().includes('CORS')) {
        errorMessage = 'Connection error. Please check if the server is running and try again.';
      }
      
      setError(errorMessage);
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Add New Supplier
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create a new supplier record
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error creating supplier
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="supplier_code">
                    Supplier Code *
                    {codeMode === 'auto' && (
                      <Sparkles className="inline ml-1 h-3 w-3 text-blue-500" />
                    )}
                  </Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCodeMode(codeMode === 'auto' ? 'manual' : 'auto');
                        if (codeMode === 'manual') {
                          const newCode = generateSupplierCode();
                          handleInputChange('supplier_code', newCode);
                          setIsCodeGenerated(true);
                        }
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      {codeMode === 'auto' ? (
                        <>
                          <Edit className="h-3 w-3 mr-1" />
                          Manual
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-1" />
                          Auto
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="supplier_code"
                    value={formData.supplier_code}
                    onChange={(e) => codeMode === 'manual' && handleInputChange('supplier_code', e.target.value)}
                    placeholder={codeMode === 'auto' ? 'Auto-generated' : 'e.g., SUP-DIS-123456-AB'}
                    readOnly={codeMode === 'auto'}
                    className={`${errors.supplier_code ? 'border-red-500' : ''} ${
                      codeMode === 'auto' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  />
                  {codeMode === 'auto' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newCode = generateSupplierCode();
                        handleInputChange('supplier_code', newCode);
                        setIsCodeGenerated(true);
                      }}
                      className="px-3"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {codeMode === 'auto' && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center">
                    <Info className="h-3 w-3 mr-1" />
                    Code auto-generated based on supplier type
                  </p>
                )}
                {errors.supplier_code && (
                  <p className="text-sm text-red-600 mt-1">{errors.supplier_code}</p>
                )}
              </div>

              <div>
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="Enter company name"
                  className={errors.company_name ? 'border-red-500' : ''}
                />
                {errors.company_name && (
                  <p className="text-sm text-red-600 mt-1">{errors.company_name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="supplier_type">Supplier Type</Label>
                <select
                  id="supplier_type"
                  value={formData.supplier_type}
                  onChange={(e) => handleInputChange('supplier_type', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="MANUFACTURER">Manufacturer</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="WHOLESALER">Wholesaler</option>
                  <option value="RETAILER">Retailer</option>
                  <option value="SERVICE_PROVIDER">Service Provider</option>
                </select>
              </div>

              <div>
                <Label htmlFor="supplier_tier">Supplier Tier</Label>
                <select
                  id="supplier_tier"
                  value={formData.supplier_tier}
                  onChange={(e) => handleInputChange('supplier_tier', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="PREMIUM">Premium</option>
                  <option value="STANDARD">Standard</option>
                  <option value="BASIC">Basic</option>
                  <option value="TRIAL">Trial</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => handleInputChange('contact_person', e.target.value)}
                  placeholder="Enter contact person name"
                />
              </div>

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
                  <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <Label htmlFor="tax_id">Tax ID</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) => handleInputChange('tax_id', e.target.value)}
                  placeholder="Enter tax identification number"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Enter full address"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Business Terms */}
        <Card>
          <CardHeader>
            <CardTitle>Business Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <select
                  id="payment_terms"
                  value={formData.payment_terms}
                  onChange={(e) => handleInputChange('payment_terms', e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="NET15">Net 15 Days</option>
                  <option value="NET30">Net 30 Days</option>
                  <option value="NET45">Net 45 Days</option>
                  <option value="NET60">Net 60 Days</option>
                  <option value="NET90">Net 90 Days</option>
                  <option value="COD">Cash on Delivery</option>
                  <option value="PREPAID">Prepaid</option>
                </select>
              </div>

              <div>
                <Label htmlFor="credit_limit">Credit Limit (₹)</Label>
                <Input
                  id="credit_limit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.credit_limit}
                  onChange={(e) => handleInputChange('credit_limit', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={errors.credit_limit ? 'border-red-500' : ''}
                />
                {errors.credit_limit && (
                  <p className="text-sm text-red-600 mt-1">{errors.credit_limit}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Supplier
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
              <DialogTitle className="text-red-900 dark:text-red-100">
                Error Creating Supplier
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-red-700 dark:text-red-300">
            {error}
          </DialogDescription>
          <DialogFooter>
            <Button 
              onClick={() => setShowErrorDialog(false)}
              variant="outline"
            >
              Close
            </Button>
            <Button 
              onClick={() => {
                setShowErrorDialog(false);
                setError(null);
              }}
            >
              Try Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <DialogTitle className="text-green-900 dark:text-green-100">
                Supplier Created Successfully
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-green-700 dark:text-green-300">
            The supplier has been created successfully. Redirecting to supplier details...
          </DialogDescription>
          <DialogFooter>
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Redirecting...</span>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CreateSupplierPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_CREATE']}>
      <CreateSupplierContent />
    </ProtectedRoute>
  );
}