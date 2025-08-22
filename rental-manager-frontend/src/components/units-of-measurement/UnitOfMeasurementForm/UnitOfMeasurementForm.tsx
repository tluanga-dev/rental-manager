'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { 
  unitOfMeasurementSchema, 
  unitOfMeasurementUpdateSchema,
  type UnitOfMeasurementFormData,
  type UnitOfMeasurementUpdateFormData,
} from '@/lib/validations';
import { UnitOfMeasurement } from '@/types/unit-of-measurement';

interface UnitOfMeasurementFormProps {
  onSubmit: (data: UnitOfMeasurementFormData | UnitOfMeasurementUpdateFormData) => void;
  onCancel?: () => void;
  initialData?: UnitOfMeasurement;
  isLoading?: boolean;
  isEditing?: boolean;
  error?: string;
}

export function UnitOfMeasurementForm({ 
  onSubmit, 
  onCancel, 
  initialData, 
  isLoading, 
  isEditing = false,
  error 
}: UnitOfMeasurementFormProps) {
  const schema = isEditing ? unitOfMeasurementUpdateSchema : unitOfMeasurementSchema;
  
  const form = useForm<UnitOfMeasurementFormData | UnitOfMeasurementUpdateFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || '',
      code: initialData?.code || '',
      description: initialData?.description || '',
      ...(isEditing && { is_active: initialData?.is_active ?? true }),
    },
  });

  const handleSubmit = (data: UnitOfMeasurementFormData | UnitOfMeasurementUpdateFormData) => {
    // Clean up empty optional fields
    const cleanData = {
      ...data,
      abbreviation: data.abbreviation?.trim() || undefined,
      description: data.description?.trim() || undefined,
    };
    
    onSubmit(cleanData);
  };

  const handleCancel = () => {
    form.reset();
    onCancel?.();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {isEditing ? 'Edit Unit of Measurement' : 'Create Unit of Measurement'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Unit Name *</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Enter unit name (e.g., Kilogram, Meter)"
              disabled={isLoading}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Code Field */}
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              {...form.register('code')}
              placeholder="Enter code (e.g., kg, m)"
              disabled={isLoading}
            />
            {form.formState.errors.code && (
              <p className="text-sm text-red-500">
                {form.formState.errors.code.message}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Enter unit description (optional)"
              rows={3}
              disabled={isLoading}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-red-500">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          {/* Active Status - Only show in edit mode */}
          {isEditing && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={form.watch('is_active')}
                  onCheckedChange={(checked) => form.setValue('is_active', checked)}
                  disabled={isLoading}
                />
                <Label htmlFor="is_active">
                  {form.watch('is_active') ? 'Active' : 'Inactive'}
                </Label>
              </div>
              <p className="text-sm text-gray-500">
                Inactive units won&apos;t be available for selection in forms
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading 
                ? 'Saving...' 
                : isEditing 
                  ? 'Update Unit' 
                  : 'Create Unit'
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}