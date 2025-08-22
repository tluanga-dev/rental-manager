'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  Camera,
  CalendarIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Upload,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { inventoryUnitsApi } from '@/services/api/inventory';
import type { InventoryUnit, ConditionGrade } from '@/types/inventory';

const inspectionSchema = z.object({
  condition_grade: z.enum(['A', 'B', 'C', 'D']),
  inspection_notes: z.string().min(1, 'Inspection notes are required'),
  damage_assessment: z.object({
    has_damage: z.boolean(),
    damage_type: z.array(z.string()).optional(),
    damage_severity: z.enum(['minor', 'moderate', 'severe']).optional(),
    damage_description: z.string().optional(),
    repair_needed: z.boolean().optional(),
    repair_cost_estimate: z.number().optional(),
  }),
  functionality_checks: z.object({
    powers_on: z.boolean(),
    all_features_working: z.boolean(),
    performance_issues: z.boolean(),
    cosmetic_issues: z.boolean(),
  }),
  photos: z.array(z.string()).optional(),
  next_inspection_date: z.date().optional(),
});

type InspectionFormData = z.infer<typeof inspectionSchema>;

interface InspectionFormProps {
  unit: InventoryUnit;
  onSuccess?: (unit: InventoryUnit) => void;
  onCancel?: () => void;
}

const damageTypes = [
  'Scratch',
  'Dent',
  'Crack',
  'Water Damage',
  'Burn Mark',
  'Missing Parts',
  'Broken Component',
  'Other',
];

const inspectionChecklist = [
  { id: 'powers_on', label: 'Powers on correctly', icon: CheckCircle },
  { id: 'all_features_working', label: 'All features working', icon: CheckCircle },
  { id: 'performance_issues', label: 'Performance issues detected', icon: AlertTriangle },
  { id: 'cosmetic_issues', label: 'Cosmetic issues present', icon: AlertTriangle },
];

export function InspectionForm({ unit, onSuccess, onCancel }: InspectionFormProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [inspectionProgress, setInspectionProgress] = useState(0);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
  } = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      condition_grade: unit.condition_grade,
      inspection_notes: '',
      damage_assessment: {
        has_damage: false,
        damage_type: [],
        repair_needed: false,
      },
      functionality_checks: {
        powers_on: true,
        all_features_working: true,
        performance_issues: false,
        cosmetic_issues: false,
      },
      photos: [],
      next_inspection_date: addDays(new Date(), 90), // Default to 90 days from now
    },
  });

  const watchConditionGrade = watch('condition_grade');
  const watchHasDamage = watch('damage_assessment.has_damage');
  const watchDamageType = watch('damage_assessment.damage_type');
  const watchRepairNeeded = watch('damage_assessment.repair_needed');
  const watchNextInspectionDate = watch('next_inspection_date');
  const watchFunctionalityChecks = watch('functionality_checks');

  // Calculate inspection progress
  React.useEffect(() => {
    let progress = 0;
    const steps = 5;
    let completedSteps = 0;

    if (watch('condition_grade')) completedSteps++;
    if (watch('inspection_notes')) completedSteps++;
    if (Object.values(watchFunctionalityChecks).some(v => v !== undefined)) completedSteps++;
    if (watchHasDamage !== undefined) completedSteps++;
    if (uploadedPhotos.length > 0) completedSteps++;

    progress = (completedSteps / steps) * 100;
    setInspectionProgress(progress);
  }, [watch, watchFunctionalityChecks, watchHasDamage, uploadedPhotos]);

  const inspectMutation = useMutation({
    mutationFn: (data: InspectionFormData) => {
      const payload = {
        ...data,
        photos: uploadedPhotos,
        next_inspection_date: data.next_inspection_date?.toISOString(),
      };
      return inventoryUnitsApi.inspect(unit.id, payload);
    },
    onSuccess: (updatedUnit) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      onSuccess?.(updatedUnit);
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to complete inspection');
    },
  });

  const onSubmit = (data: InspectionFormData) => {
    setError(null);
    inspectMutation.mutate(data);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // In a real app, this would upload to a server
    const files = event.target.files;
    if (files) {
      const newPhotos = Array.from(files).map(file => URL.createObjectURL(file));
      setUploadedPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const conditionGradeDescriptions = {
    A: { label: 'Excellent', description: 'Like new, minimal wear', color: 'text-green-600' },
    B: { label: 'Good', description: 'Light wear, fully functional', color: 'text-slate-600' },
    C: { label: 'Fair', description: 'Moderate wear, minor issues', color: 'text-yellow-600' },
    D: { label: 'Poor', description: 'Heavy wear, needs repair', color: 'text-red-600' },
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Inspection Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Inspection Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={inspectionProgress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {inspectionProgress.toFixed(0)}% Complete
          </p>
        </CardContent>
      </Card>

      {/* Unit Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Unit Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Serial Number:</span>{' '}
              {unit.serial_number || 'N/A'}
            </div>
            <div>
              <span className="font-medium">SKU:</span> {unit.sku_id}
            </div>
            <div>
              <span className="font-medium">Location:</span> {unit.location_id}
            </div>
            <div>
              <span className="font-medium">Current Grade:</span>{' '}
              <Badge className={conditionGradeDescriptions[unit.condition_grade].color}>
                Grade {unit.condition_grade}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Condition Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Condition Assessment</CardTitle>
          <CardDescription>
            Evaluate the overall condition of the unit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Condition Grade *</Label>
            <Select
              value={watchConditionGrade}
              onValueChange={(value) => setValue('condition_grade', value as ConditionGrade)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition grade" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(conditionGradeDescriptions).map(([grade, info]) => (
                  <SelectItem key={grade} value={grade}>
                    <div className="flex items-center gap-2">
                      <Badge className={cn('px-2', info.color)}>Grade {grade}</Badge>
                      <span>{info.label} - {info.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.condition_grade && (
              <p className="text-sm text-red-500">{errors.condition_grade.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="inspection_notes">Inspection Notes *</Label>
            <Textarea
              id="inspection_notes"
              placeholder="Describe the condition of the unit, any issues found, etc."
              rows={4}
              {...register('inspection_notes')}
            />
            {errors.inspection_notes && (
              <p className="text-sm text-red-500">{errors.inspection_notes.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Functionality Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Functionality Checks</CardTitle>
          <CardDescription>
            Verify the unit's operational status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {inspectionChecklist.map((check) => {
              const Icon = check.icon;
              const isPositive = check.id === 'powers_on' || check.id === 'all_features_working';
              const value = watchFunctionalityChecks[check.id as keyof typeof watchFunctionalityChecks];
              
              return (
                <div key={check.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={check.id}
                    checked={value}
                    onCheckedChange={(checked) => 
                      setValue(`functionality_checks.${check.id}` as any, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={check.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Icon className={cn(
                      'h-4 w-4',
                      value
                        ? isPositive ? 'text-green-500' : 'text-yellow-500'
                        : 'text-gray-400'
                    )} />
                    {check.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Damage Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Damage Assessment</CardTitle>
          <CardDescription>
            Document any damage or issues found
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="has_damage"
              checked={watchHasDamage}
              onCheckedChange={(checked) => 
                setValue('damage_assessment.has_damage', checked as boolean)
              }
            />
            <Label htmlFor="has_damage" className="cursor-pointer">
              Unit has damage or defects
            </Label>
          </div>

          {watchHasDamage && (
            <>
              <div className="space-y-2">
                <Label>Damage Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {damageTypes.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={type}
                        checked={watchDamageType?.includes(type) || false}
                        onCheckedChange={(checked) => {
                          const current = watchDamageType || [];
                          if (checked) {
                            setValue('damage_assessment.damage_type', [...current, type]);
                          } else {
                            setValue('damage_assessment.damage_type', 
                              current.filter(t => t !== type)
                            );
                          }
                        }}
                      />
                      <Label htmlFor={type} className="cursor-pointer text-sm">
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Damage Severity</Label>
                <Select
                  value={watch('damage_assessment.damage_severity')}
                  onValueChange={(value) => 
                    setValue('damage_assessment.damage_severity', value as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor - Cosmetic only</SelectItem>
                    <SelectItem value="moderate">Moderate - Affects usability</SelectItem>
                    <SelectItem value="severe">Severe - Unit unusable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="damage_description">Damage Description</Label>
                <Textarea
                  id="damage_description"
                  placeholder="Describe the damage in detail..."
                  rows={3}
                  {...register('damage_assessment.damage_description')}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="repair_needed"
                  checked={watchRepairNeeded}
                  onCheckedChange={(checked) => 
                    setValue('damage_assessment.repair_needed', checked as boolean)
                  }
                />
                <Label htmlFor="repair_needed" className="cursor-pointer">
                  Repair needed
                </Label>
              </div>

              {watchRepairNeeded && (
                <div className="space-y-2">
                  <Label htmlFor="repair_cost_estimate">Estimated Repair Cost</Label>
                  <Input
                    id="repair_cost_estimate"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register('damage_assessment.repair_cost_estimate', { 
                      valueAsNumber: true 
                    })}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Photo Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Photo Documentation</CardTitle>
          <CardDescription>
            Upload photos of the unit's current condition
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label
              htmlFor="photo-upload"
              className="cursor-pointer flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              <Camera className="h-4 w-4" />
              <span>Add Photos</span>
            </Label>
            <Input
              id="photo-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <span className="text-sm text-muted-foreground">
              {uploadedPhotos.length} photo{uploadedPhotos.length !== 1 ? 's' : ''} uploaded
            </span>
          </div>

          {uploadedPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {uploadedPhotos.map((photo, index) => (
                <div key={index} className="relative group">
                  <img
                    src={photo}
                    alt={`Inspection photo ${index + 1}`}
                    className="w-full h-24 object-cover rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next Inspection Date */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Schedule Next Inspection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Next Inspection Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !watchNextInspectionDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {watchNextInspectionDate 
                    ? format(watchNextInspectionDate, 'PPP') 
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={watchNextInspectionDate}
                  onSelect={(date) => setValue('next_inspection_date', date || undefined)}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={inspectMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={inspectMutation.isPending}>
          {inspectMutation.isPending ? 'Submitting...' : 'Complete Inspection'}
        </Button>
      </div>
    </form>
  );
}