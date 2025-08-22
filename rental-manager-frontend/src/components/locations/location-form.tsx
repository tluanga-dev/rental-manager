'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Building2, Save, X } from 'lucide-react';
import type { Location, LocationType } from '@/types/location';

const locationSchema = z.object({
  location_code: z.string()
    .min(1, 'Location code is required')
    .max(20, 'Location code must be 20 characters or less')
    .regex(/^[A-Z0-9_-]+$/, 'Location code must contain only uppercase letters, numbers, hyphens, and underscores'),
  location_name: z.string()
    .min(1, 'Location name is required')
    .max(100, 'Location name must be 100 characters or less'),
  location_type: z.enum(['WAREHOUSE', 'STORE', 'SERVICE_CENTER'] as const),
  address: z.string()
    .optional()
    .refine(
      (val) => !val || val.length <= 500,
      { message: 'Address must be 500 characters or less' }
    ),
  city: z.string()
    .optional()
    .refine(
      (val) => !val || val.length <= 50,
      { message: 'City must be 50 characters or less' }
    ),
  state: z.string()
    .optional()
    .refine(
      (val) => !val || val.length <= 50,
      { message: 'State must be 50 characters or less' }
    ),
  country: z.string()
    .optional()
    .refine(
      (val) => !val || val.length <= 50,
      { message: 'Country must be 50 characters or less' }
    ),
  postal_code: z.string()
    .optional()
    .refine(
      (val) => !val || val.length <= 20,
      { message: 'Postal code must be 20 characters or less' }
    ),
  contact_number: z.string()
    .optional()
    .refine(
      (val) => !val || val.length <= 20,
      { message: 'Contact phone must be 20 characters or less' }
    )
    .refine(
      (val) => !val || /^\+\d{1,15}$/.test(val),
      { message: 'Contact phone must be in E.164 format (e.g., +1234567890, max 15 digits)' }
    ),
  email: z.string()
    .optional()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: 'Please enter a valid email address' }
    )
    .refine(
      (val) => !val || val.length <= 100,
      { message: 'Email must be 100 characters or less' }
    ),
  contact_person: z.string()
    .optional()
    .refine(
      (val) => !val || val.length <= 255,
      { message: 'Contact person must be 255 characters or less' }
    ),
  
  // Contact Person Fields
  contact_person_name: z.string()
    .optional()
    .refine(
      (val) => !val || val.length <= 255,
      { message: 'Contact person name must be 255 characters or less' }
    ),
  contact_person_title: z.string()
    .optional()
    .refine(
      (val) => !val || val.length <= 100,
      { message: 'Contact person title must be 100 characters or less' }
    ),
  contact_person_phone: z.string()
    .optional()
    .refine(
      (val) => !val || val.length <= 20,
      { message: 'Contact person phone must be 20 characters or less' }
    )
    .refine(
      (val) => !val || /^\+\d{1,15}$/.test(val),
      { message: 'Contact person phone must be in E.164 format (e.g., +1234567890, max 15 digits)' }
    ),
  contact_person_email: z.string()
    .optional()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      { message: 'Please enter a valid contact person email address' }
    )
    .refine(
      (val) => !val || val.length <= 255,
      { message: 'Contact person email must be 255 characters or less' }
    ),
  contact_person_notes: z.string().optional(),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface LocationFormProps {
  location?: Location;
  onSubmit: (data: LocationFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  error?: string | { msg?: string; message?: string; [key: string]: any };
}

const locationTypes: { value: LocationType; label: string; description: string }[] = [
  { value: 'WAREHOUSE', label: 'Warehouse', description: 'Storage and distribution facility' },
  { value: 'STORE', label: 'Store', description: 'Retail location for customer sales' },
  { value: 'SERVICE_CENTER', label: 'Service Center', description: 'Maintenance and repair facility' },
];

export function LocationForm({
  location,
  onSubmit,
  onCancel,
  isSubmitting = false,
  error,
}: LocationFormProps) {
  const isEditing = !!location;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: location ? {
      location_code: location.location_code || location.code || '',
      location_name: location.location_name || location.name || '',
      location_type: location.location_type,
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      country: location.country || '',
      postal_code: location.postal_code || '',
      contact_number: location.contact_number || location.contact_phone || '',
      email: location.email || location.contact_email || '',
      contact_person: location.contact_person || '',
      
      // Contact Person Fields
      contact_person_name: location.contact_person_name || '',
      contact_person_title: location.contact_person_title || '',
      contact_person_phone: location.contact_person_phone || '',
      contact_person_email: location.contact_person_email || '',
      contact_person_notes: location.contact_person_notes || '',
    } : {
      location_code: '',
      location_name: '',
      location_type: 'WAREHOUSE' as LocationType,
      address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      contact_number: '',
      email: '',
      contact_person: '',
      
      // Contact Person Fields
      contact_person_name: '',
      contact_person_title: '',
      contact_person_phone: '',
      contact_person_email: '',
      contact_person_notes: '',
    },
  });

  const selectedLocationType = watch('location_type');

  const handleLocationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-uppercase the location code
    const value = e.target.value.toUpperCase();
    setValue('location_code', value, { shouldValidate: true });
  };

  // Transform form data to ensure empty strings instead of null/undefined values
  const handleFormSubmit = async (data: LocationFormData) => {
    console.log('🔍 Form data before transformation:', JSON.stringify(data, null, 2));
    
    const transformedData = {
      ...data,
      // Ensure all optional fields are empty strings rather than null/undefined
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      country: data.country || '',
      postal_code: data.postal_code || '',
      contact_number: data.contact_number || '',
      email: data.email || '',
      contact_person: data.contact_person || '',
      
      // Contact Person Fields
      contact_person_name: data.contact_person_name || '',
      contact_person_title: data.contact_person_title || '',
      contact_person_phone: data.contact_person_phone || '',
      contact_person_email: data.contact_person_email || '',
      contact_person_notes: data.contact_person_notes || '',
    };
    
    console.log('🔍 Form data after transformation:', JSON.stringify(transformedData, null, 2));
    console.log('🔍 Required fields check:');
    console.log('  - location_code:', transformedData.location_code);
    console.log('  - location_name:', transformedData.location_name);
    console.log('  - location_type:', transformedData.location_type);
    
    await onSubmit(transformedData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {typeof error === 'string' ? error : (
                  error.msg || error.message || 'An error occurred'
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location_code">
                  Location Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="location_code"
                  {...register('location_code')}
                  onChange={handleLocationCodeChange}
                  disabled={isEditing} // Don't allow editing location code
                  placeholder="e.g., WH001, STORE_NYC"
                  className={errors.location_code ? 'border-red-500' : ''}
                />
                {errors.location_code && (
                  <p className="text-sm text-red-500">{errors.location_code.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_name">
                  Location Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="location_name"
                  {...register('location_name')}
                  placeholder="e.g., Main Warehouse, Downtown Store"
                  className={errors.location_name ? 'border-red-500' : ''}
                />
                {errors.location_name && (
                  <p className="text-sm text-red-500">{errors.location_name.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_type">
                Location Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={selectedLocationType}
                onValueChange={(value: LocationType) => setValue('location_type', value)}
              >
                <SelectTrigger className={errors.location_type ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select location type" />
                </SelectTrigger>
                <SelectContent>
                  {locationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.location_type && (
                <p className="text-sm text-red-500">{errors.location_type.message}</p>
              )}
            </div>
          </div>

          {/* Address Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Address Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="address">
                Address
              </Label>
              <Input
                id="address"
                {...register('address')}
                placeholder="Street address"
                className={errors.address ? 'border-red-500' : ''}
              />
              {errors.address && (
                <p className="text-sm text-red-500">{errors.address.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">
                  City
                </Label>
                <Input
                  id="city"
                  {...register('city')}
                  placeholder="City"
                  className={errors.city ? 'border-red-500' : ''}
                />
                {errors.city && (
                  <p className="text-sm text-red-500">{errors.city.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">
                  State/Province
                </Label>
                <Input
                  id="state"
                  {...register('state')}
                  placeholder="State or Province"
                  className={errors.state ? 'border-red-500' : ''}
                />
                {errors.state && (
                  <p className="text-sm text-red-500">{errors.state.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  {...register('postal_code')}
                  placeholder="Postal/ZIP code"
                  className={errors.postal_code ? 'border-red-500' : ''}
                />
                {errors.postal_code && (
                  <p className="text-sm text-red-500">{errors.postal_code.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">
                Country
              </Label>
              <Input
                id="country"
                {...register('country')}
                placeholder="Country"
                className={errors.country ? 'border-red-500' : ''}
              />
              {errors.country && (
                <p className="text-sm text-red-500">{errors.country.message}</p>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input
                  id="contact_number"
                  {...register('contact_number')}
                  placeholder="E.164 format (e.g., +1234567890)"
                  className={errors.contact_number ? 'border-red-500' : ''}
                />
                {errors.contact_number && (
                  <p className="text-sm text-red-500">{errors.contact_number.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="email@example.com"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person (Legacy)</Label>
                <Input
                  id="contact_person"
                  {...register('contact_person')}
                  placeholder="John Doe"
                  className={errors.contact_person ? 'border-red-500' : ''}
                />
                {errors.contact_person && (
                  <p className="text-sm text-red-500">{errors.contact_person.message}</p>
                )}
              </div>

              {/* Contact Person Details Section */}
              <div className="col-span-2">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b border-gray-200 pb-2">
                  Contact Person Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_person_name">Contact Person Name</Label>
                    <Input
                      id="contact_person_name"
                      {...register('contact_person_name')}
                      placeholder="John Doe"
                      className={errors.contact_person_name ? 'border-red-500' : ''}
                    />
                    {errors.contact_person_name && (
                      <p className="text-sm text-red-500">{errors.contact_person_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_person_title">Job Title</Label>
                    <Input
                      id="contact_person_title"
                      {...register('contact_person_title')}
                      placeholder="Store Manager"
                      className={errors.contact_person_title ? 'border-red-500' : ''}
                    />
                    {errors.contact_person_title && (
                      <p className="text-sm text-red-500">{errors.contact_person_title.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_person_phone">Contact Person Phone</Label>
                    <Input
                      id="contact_person_phone"
                      {...register('contact_person_phone')}
                      placeholder="+1234567890"
                      className={errors.contact_person_phone ? 'border-red-500' : ''}
                    />
                    {errors.contact_person_phone && (
                      <p className="text-sm text-red-500">{errors.contact_person_phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact_person_email">Contact Person Email</Label>
                    <Input
                      id="contact_person_email"
                      type="email"
                      {...register('contact_person_email')}
                      placeholder="john.doe@company.com"
                      className={errors.contact_person_email ? 'border-red-500' : ''}
                    />
                    {errors.contact_person_email && (
                      <p className="text-sm text-red-500">{errors.contact_person_email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="contact_person_notes">Contact Person Notes</Label>
                    <textarea
                      id="contact_person_notes"
                      {...register('contact_person_notes')}
                      placeholder="Additional information about the contact person..."
                      className={`min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errors.contact_person_notes ? 'border-red-500' : ''}`}
                      rows={3}
                    />
                    {errors.contact_person_notes && (
                      <p className="text-sm text-red-500">{errors.contact_person_notes.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Location' : 'Create Location'}
            </Button>
          </div>
    </form>
  );
}