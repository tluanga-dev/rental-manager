'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  User,
  Building2,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { customersApi, CustomerResponse, CustomerUpdate } from '@/services/api/customers';
import { CustomerForm } from '@/components/customers/customer-form';
import { type CustomerCreateFormData } from '@/lib/validations';
import { useAppStore } from '@/stores/app-store';

function EditCustomerContent() {
  const params = useParams();
  const router = useRouter();
  const { addNotification } = useAppStore();
  const customerId = params.id as string;
  
  const [customer, setCustomer] = useState<CustomerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCustomer = async () => {
      try {
        setLoading(true);
        const customerData = await customersApi.getById(customerId);
        setCustomer(customerData);
      } catch (error) {
        console.error('Failed to load customer:', error);
        setError('Failed to load customer data');
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load customer data'
        });
      } finally {
        setLoading(false);
      }
    };

    if (customerId) {
      loadCustomer();
    }
  }, [customerId, addNotification]);

  const handleSubmit = async (formData: CustomerCreateFormData) => {
    if (!customer) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Prepare update data - only include fields that can be updated
      const updateData: CustomerUpdate = {
        first_name: formData.customer.first_name,
        last_name: formData.customer.last_name,
        business_name: formData.customer.business_name,
        tax_id: formData.customer.tax_id,
        customer_tier: formData.customer.customer_tier,
        credit_limit: formData.customer.credit_limit,
      };

      // Remove empty fields based on customer type
      if (customer.customer_type === 'INDIVIDUAL') {
        delete updateData.business_name;
      } else {
        delete updateData.first_name;
        delete updateData.last_name;
      }

      // Update customer data
      await customersApi.update(customerId, updateData);
      
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Customer updated successfully'
      });

      // Redirect back to customer detail page
      router.push(`/customers/${customerId}`);
    } catch (error) {
      console.error('Failed to update customer:', error);
      const errorMessage = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to update customer. Please try again.';
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        title: 'Error',
        message: errorMessage
      });
    } finally {
      setSaving(false);
    }
  };

  const getCustomerDisplayName = (customer: CustomerResponse) => {
    if (customer.customer_type === 'BUSINESS') {
      return customer.business_name || 'Business Customer';
    }
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Individual Customer';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="flex items-center space-x-3">
            <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            <span className="text-gray-600">Loading customer data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading customer</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <div className="mt-6">
            <Button onClick={() => router.push('/customers')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Customers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
        <div className="text-center py-8">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-gray-100">
            {customer?.customer_type === 'BUSINESS' ? (
              <Building2 className="h-6 w-6 text-gray-400" />
            ) : (
              <User className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Customer not found</h3>
          <p className="mt-1 text-sm text-gray-500">The customer you&apos;re trying to edit doesn&apos;t exist.</p>
          <div className="mt-6">
            <Button onClick={() => router.push('/customers')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Customers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Transform customer data to match form structure
  const initialFormData: Partial<CustomerCreateFormData> = {
    customer: {
      customer_type: customer.customer_type,
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      business_name: customer.business_name || '',
      tax_id: customer.tax_id || '',
      customer_tier: customer.customer_tier,
      credit_limit: customer.credit_limit,
    },
    // Note: Contact methods, addresses, and contact persons would need to be loaded
    // from separate API endpoints if they exist. For now, we'll use empty arrays
    // as the basic customer update only handles the main customer fields.
    contact_methods: [
      {
        contact_type: 'EMAIL',
        contact_value: '',
        is_primary: true,
        opt_in_marketing: true,
      },
    ],
    addresses: [
      {
        address_type: 'BOTH',
        address_line1: '',
        city: '',
        state: '',
        country: 'India',
        is_default: true,
      },
    ],
    contact_persons: [],
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
            Edit Customer
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Update customer information for {getCustomerDisplayName(customer)}
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
                Error updating customer
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            {customer.customer_type === 'BUSINESS' ? (
              <Building2 className="h-5 w-5 mr-2" />
            ) : (
              <User className="h-5 w-5 mr-2" />
            )}
            Current Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Customer Code:</span>
              <p className="font-medium">{customer.customer_code}</p>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <p className="font-medium">{customer.customer_type}</p>
            </div>
            <div>
              <span className="text-gray-500">Current Tier:</span>
              <p className="font-medium">{customer.customer_tier}</p>
            </div>
            <div>
              <span className="text-gray-500">Credit Limit:</span>
              <p className="font-medium">${customer.credit_limit.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <div className="flex items-center space-x-2">
                {customer.is_active ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className={customer.is_active ? 'text-green-600' : 'text-red-600'}>
                  {customer.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-gray-500">Blacklist Status:</span>
              <p className={`font-medium ${customer.blacklist_status === 'BLACKLISTED' ? 'text-red-600' : 'text-green-600'}`}>
                {customer.blacklist_status === 'CLEAR' ? 'Clear' : 'Blacklisted'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Form */}
      <CustomerForm 
        onSubmit={handleSubmit}
        initialData={initialFormData}
        isLoading={saving}
      />

      {/* Save Status */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-slate-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Saving changes...</span>
        </div>
      )}
    </div>
  );
}

export default function EditCustomerPage() {
  return (
    <ProtectedRoute requiredPermissions={['CUSTOMER_UPDATE']}>
      <EditCustomerContent />
    </ProtectedRoute>
  );
}
