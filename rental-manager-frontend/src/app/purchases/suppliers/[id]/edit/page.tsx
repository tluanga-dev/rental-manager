'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft,
  Save,
  Building2,
  AlertCircle
} from 'lucide-react';
import { suppliersApi, SupplierResponse, SupplierUpdate } from '@/services/api/suppliers';

function EditSupplierContent() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;
  
  const [supplier, setSupplier] = useState<SupplierResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<SupplierUpdate & { is_active: boolean }>({
    company_name: '',
    supplier_type: 'DISTRIBUTOR',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    payment_terms: 'NET30',
    credit_limit: 0,
    supplier_tier: 'STANDARD',
    is_active: true
  });

  const [errors, setErrors] = useState<Partial<Record<keyof SupplierUpdate, string>>>({});

  useEffect(() => {
    const loadSupplier = async () => {
      try {
        setLoading(true);
        const supplierData = await suppliersApi.getById(supplierId);
        setSupplier(supplierData);
        
        // Populate form with current data
        setFormData({
          company_name: supplierData.company_name,
          supplier_type: supplierData.supplier_type as any,
          contact_person: supplierData.contact_person || '',
          email: supplierData.email || '',
          phone: supplierData.phone || '',
          address: supplierData.address || '',
          tax_id: supplierData.tax_id || '',
          payment_terms: supplierData.payment_terms as any,
          credit_limit: supplierData.credit_limit,
          supplier_tier: supplierData.supplier_tier as any,
          is_active: supplierData.is_active
        });
      } catch (error) {
        console.error('Failed to load supplier:', error);
        setError('Failed to load supplier data');
      } finally {
        setLoading(false);
      }
    };

    if (supplierId) {
      loadSupplier();
    }
  }, [supplierId]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SupplierUpdate, string>> = {};

    if (!formData.company_name?.trim()) {
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

  const handleInputChange = (field: keyof (SupplierUpdate & { is_active: boolean }), value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[field as keyof SupplierUpdate]) {
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

    setSaving(true);
    setError(null);

    try {
      // Clean up the form data
      const cleanedData: SupplierUpdate = {
        company_name: formData.company_name?.trim(),
        supplier_type: formData.supplier_type,
        contact_person: formData.contact_person?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        tax_id: formData.tax_id?.trim() || undefined,
        payment_terms: formData.payment_terms,
        credit_limit: formData.credit_limit,
        supplier_tier: formData.supplier_tier
      };

      // Update supplier data
      await suppliersApi.update(supplierId, cleanedData);
      
      // Update status separately if it changed
      if (supplier && formData.is_active !== supplier.is_active) {
        await suppliersApi.updateStatus(supplierId, formData.is_active);
      }
      
      // Redirect back to supplier detail page
      router.push(`/purchases/suppliers/${supplierId}`);
    } catch (error: any) {
      console.error('Failed to update supplier:', error);
      setError(error.response?.data?.message || 'Failed to update supplier. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Supplier not found</h3>
          <p className="mt-1 text-sm text-gray-500">The supplier you're trying to edit doesn't exist.</p>
          <div className="mt-6">
            <Button onClick={() => router.push('/purchases/suppliers')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Suppliers
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            Edit Supplier
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Update supplier information for {supplier.company_name}
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
                Error updating supplier
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active">
                {formData.is_active ? 'Active' : 'Inactive'}
              </Label>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {formData.is_active 
                ? 'This supplier is active and can be used for new orders.'
                : 'This supplier is inactive and cannot be used for new orders.'
              }
            </p>
          </CardContent>
        </Card>

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
                <Label htmlFor="supplier_code">Supplier Code</Label>
                <Input
                  id="supplier_code"
                  value={supplier.supplier_code}
                  disabled
                  className="bg-gray-50 dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500 mt-1">Supplier code cannot be changed</p>
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
                  <option value="STANDARD">Standard</option>
                  <option value="PREFERRED">Preferred</option>
                  <option value="RESTRICTED">Restricted</option>
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

        {/* Performance Metrics (Read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-slate-600">{supplier.total_orders}</div>
                <div className="text-sm text-gray-600">Total Orders</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  ₹{supplier.total_spend.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Spend</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {supplier.quality_rating.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Quality Rating</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {supplier.performance_score.toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600">Performance</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Performance metrics are calculated automatically based on order history.
            </p>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function EditSupplierPage() {
  return (
    <ProtectedRoute requiredPermissions={['INVENTORY_EDIT']}>
      <EditSupplierContent />
    </ProtectedRoute>
  );
}