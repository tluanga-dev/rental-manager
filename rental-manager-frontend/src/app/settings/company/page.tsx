'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Save,
  ArrowLeft,
  Loader2,
  CheckCircle,
} from 'lucide-react';

import { useCompanyInfoStore } from '@/stores/system-store';
import { useAuthStore } from '@/stores/auth-store';
import type { CompanyInfo } from '@/types/system';

const companyInfoSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(255, 'Company name is too long'),
  company_address: z.string().optional(),
  company_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  company_phone: z.string().optional(),
  company_gst_no: z.string().optional(),
  company_registration_number: z.string().optional(),
});

type CompanyInfoForm = z.infer<typeof companyInfoSchema>;

function CompanySettingsContent() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const {
    companyInfo,
    loading,
    error,
    loadCompanyInfo,
    updateCompanyInfo,
    clearError,
  } = useCompanyInfoStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<CompanyInfoForm>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      company_name: '',
      company_address: '',
      company_email: '',
      company_phone: '',
      company_gst_no: '',
      company_registration_number: '',
    },
  });

  const watchedValues = watch();

  useEffect(() => {
    loadCompanyInfo();
  }, [loadCompanyInfo]);

  useEffect(() => {
    if (companyInfo) {
      reset({
        company_name: companyInfo.company_name,
        company_address: companyInfo.company_address || '',
        company_email: companyInfo.company_email || '',
        company_phone: companyInfo.company_phone || '',
        company_gst_no: companyInfo.company_gst_no || '',
        company_registration_number: companyInfo.company_registration_number || '',
      });
    }
  }, [companyInfo, reset]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
      clearError();
    }
  }, [error, toast, clearError]);

  const onSubmit = async (data: CompanyInfoForm) => {
    // Enhanced user validation
    if (!user?.id) {
      console.error('Company update failed: User not authenticated', { user });
      toast({
        title: 'Authentication Error',
        description: 'User not authenticated. Please refresh the page and try again.',
        variant: 'destructive',
      });
      return;
    }

    // Validate user ID format and provide fallback
    let userId: string;
    if (typeof user.id === 'string' && user.id.trim() !== '') {
      userId = user.id;
    } else {
      console.warn('Invalid user ID format, using default:', user.id);
      userId = '00000000-0000-4000-8000-000000000001';
    }

    console.log('🏢 Starting company info update...', {
      userId,
      formData: data,
      isDirty,
    });

    setSaving(true);
    
    try {
      // Log the update attempt
      console.log('📡 Calling updateCompanyInfo API...', {
        data,
        userId,
        timestamp: new Date().toISOString()
      });

      await updateCompanyInfo(data, userId);
      
      console.log('✅ Company info updated successfully');
      toast({
        title: 'Success',
        description: 'Company information updated successfully',
      });
      
    } catch (error: any) {
      console.error('❌ Company update failed:', {
        error: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });

      // Enhanced error message mapping
      let errorMessage = 'Failed to update company information';
      
      if (error?.response?.status === 404) {
        errorMessage = 'Company settings endpoint not found. Please contact support.';
      } else if (error?.response?.status === 401) {
        errorMessage = 'Authentication expired. Please refresh the page and try again.';
      } else if (error?.response?.status === 403) {
        errorMessage = 'You do not have permission to update company settings.';
      } else if (error?.response?.status === 422) {
        errorMessage = 'Invalid data provided. Please check your input and try again.';
      } else if (error?.response?.status >= 500) {
        errorMessage = 'Server error occurred. Please try again later or contact support.';
      } else if (error?.code === 'NETWORK_ERROR' || !error?.response) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error?.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error?.message) {
        errorMessage = `Update failed: ${error.message}`;
      }
      
      toast({
        title: 'Update Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // Log error for debugging
      console.error('Company update error details:', {
        message: errorMessage,
        originalError: error,
        timestamp: new Date().toISOString()
      });
      
    } finally {
      setSaving(false);
      console.log('🏁 Company update process completed');
    }
  };

  const handleReset = () => {
    if (companyInfo) {
      reset({
        company_name: companyInfo.company_name,
        company_address: companyInfo.company_address || '',
        company_email: companyInfo.company_email || '',
        company_phone: companyInfo.company_phone || '',
        company_gst_no: companyInfo.company_gst_no || '',
        company_registration_number: companyInfo.company_registration_number || '',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/settings')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Settings
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Company Information</h1>
            <p className="text-gray-600">
              Manage your company details and contact information
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button variant="outline" onClick={handleReset}>
              Reset Changes
            </Button>
          )}
          <Button type="submit" form="company-form" disabled={saving || !isDirty}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Company Information Form */}
      <form id="company-form" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                {...register('company_name')}
                placeholder="Enter company name"
                className={errors.company_name ? 'border-red-500' : ''}
              />
              {errors.company_name && (
                <p className="text-sm text-red-500">{errors.company_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_address">Address</Label>
              <Textarea
                id="company_address"
                {...register('company_address')}
                placeholder="Enter company address"
                rows={3}
                className={errors.company_address ? 'border-red-500' : ''}
              />
              {errors.company_address && (
                <p className="text-sm text-red-500">{errors.company_address.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_email">Email Address</Label>
              <Input
                id="company_email"
                type="email"
                {...register('company_email')}
                placeholder="Enter company email"
                className={errors.company_email ? 'border-red-500' : ''}
              />
              {errors.company_email && (
                <p className="text-sm text-red-500">{errors.company_email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_phone">Phone Number</Label>
              <Input
                id="company_phone"
                {...register('company_phone')}
                placeholder="Enter company phone"
                className={errors.company_phone ? 'border-red-500' : ''}
              />
              {errors.company_phone && (
                <p className="text-sm text-red-500">{errors.company_phone.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Legal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_gst_no">GST Number</Label>
              <Input
                id="company_gst_no"
                {...register('company_gst_no')}
                placeholder="Enter GST number"
                className={errors.company_gst_no ? 'border-red-500' : ''}
              />
              {errors.company_gst_no && (
                <p className="text-sm text-red-500">{errors.company_gst_no.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_registration_number">Registration Number</Label>
              <Input
                id="company_registration_number"
                {...register('company_registration_number')}
                placeholder="Enter registration number"
                className={errors.company_registration_number ? 'border-red-500' : ''}
              />
              {errors.company_registration_number && (
                <p className="text-sm text-red-500">{errors.company_registration_number.message}</p>
              )}
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <h4 className="font-medium text-slate-900 mb-2">Legal Information Usage</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Used in invoices and receipts</li>
                <li>• Required for tax compliance</li>
                <li>• Displayed in rental agreements</li>
                <li>• Used for regulatory reporting</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-900">
                    {watchedValues.company_name || 'Company Name'}
                  </p>
                  <p className="text-sm text-slate-600">Company Name</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-slate-600 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">
                    {watchedValues.company_address || 'Company Address'}
                  </p>
                  <p className="text-sm text-slate-600">Address</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-900">
                    {watchedValues.company_email || 'company@example.com'}
                  </p>
                  <p className="text-sm text-slate-600">Email</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-900">
                    {watchedValues.company_phone || 'Phone Number'}
                  </p>
                  <p className="text-sm text-slate-600">Phone</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-900">
                    {watchedValues.company_gst_no || 'GST Number'}
                  </p>
                  <p className="text-sm text-slate-600">GST Number</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-900">
                    {watchedValues.company_registration_number || 'Registration Number'}
                  </p>
                  <p className="text-sm text-slate-600">Registration Number</p>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Information Status</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  {watchedValues.company_name && watchedValues.company_address && watchedValues.company_email
                    ? 'Complete - All required information provided'
                    : 'Incomplete - Please fill in all required fields'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </form>
    </div>
  );
}

export default function CompanySettingsPage() {
  return (
    <ProtectedRoute requiredPermissions={['SYSTEM_CONFIG_UPDATE']}>
      <CompanySettingsContent />
    </ProtectedRoute>
  );
}