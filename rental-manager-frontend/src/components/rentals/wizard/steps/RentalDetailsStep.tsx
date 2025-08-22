'use client';

import { useState, useEffect } from 'react';
import { Calendar, MapPin, FileText, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PastelCalendar } from '@/components/ui/pastel-calendar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { WizardData } from '../RentalCreationWizard';
import { locationsApi } from '@/services/api/locations';
import { formatLocationName, formatLocationSubtitle, getLocationIcon, getLocationBadge, getLocationColor } from '@/components/locations/LocationDropdown/location-utils';
import type { Location as LocationType } from '@/types/location';

interface RentalDetailsStepProps {
  data: WizardData;
  onUpdate: (data: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function RentalDetailsStep({ data, onUpdate, onNext, onBack }: RentalDetailsStepProps) {
  const [formData, setFormData] = useState({
    transaction_date: data.transaction_date || new Date(),
    location_id: data.location_id || '',
    reference_number: data.reference_number || '',
    notes: data.notes || '',
  });

  const [locations, setLocations] = useState<LocationType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load locations from API
  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔍 Fetching locations...');
      const response = await locationsApi.list({
        active_only: true,
        limit: 100,
      });
      
      // Handle both array and paginated response
      const locationsArray = Array.isArray(response) ? response : response.items;
      console.log('📍 Locations loaded:', locationsArray?.length || 0, locationsArray);
      setLocations(locationsArray as LocationType[]);
    } catch (err) {
      console.error('❌ Error fetching locations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load locations');
    } finally {
      setIsLoading(false);
      console.log('✅ Location fetch completed');
    }
  };

  useEffect(() => {
    onUpdate(formData);
  }, [formData, onUpdate]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.location_id) {
      newErrors.location_id = 'Please select a location';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      onNext();
    }
  };

  const selectedLocation = locations.find(loc => loc.id === formData.location_id);

  return (
    <div className="space-y-6">
      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <span className="font-medium">Error loading locations:</span>
              <span>{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLocations}
              className="mt-2"
              disabled={isLoading}
            >
              {isLoading ? 'Retrying...' : 'Retry'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading locations...</p>
        </div>
      )}

      {/* Transaction Date and Location */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Transaction Date
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal h-9',
                    !formData.transaction_date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.transaction_date ? (
                    format(formData.transaction_date, 'PPP')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <PastelCalendar
                  value={formData.transaction_date}
                  onChange={(date) => handleInputChange('transaction_date', date)}
                />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {/* Temporary fallback to native select for debugging */}
            <div className="space-y-2">
              <select
                value={formData.location_id}
                onChange={(e) => {
                  console.log('🎯 Native select - Location selected:', e.target.value);
                  handleInputChange('location_id', e.target.value);
                }}
                disabled={isLoading || locations.length === 0}
                className={cn(
                  'w-full h-9 px-3 py-2 border border-input bg-background text-sm rounded-md',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  errors.location_id ? 'border-red-500' : ''
                )}
              >
                <option value="">
                  {isLoading 
                    ? "Loading locations..." 
                    : locations.length === 0 
                      ? "No locations available"
                      : "Select location"
                  }
                </option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.location_name} - {location.location_code}
                  </option>
                ))}
              </select>
              
              {/* Original Radix Select - commented out for debugging */}
              {/* 
              <Select
                value={formData.location_id}
                onValueChange={(value) => {
                  console.log('🎯 Location selected:', value);
                  handleInputChange('location_id', value);
                }}
                disabled={isLoading || locations.length === 0}
              >
                <SelectTrigger 
                  className={cn(
                    'h-9', 
                    errors.location_id ? 'border-red-500' : ''
                  )}
                >
                  <SelectValue 
                    placeholder={
                      isLoading 
                        ? "Loading locations..." 
                        : locations.length === 0 
                          ? "No locations available"
                          : "Select location"
                    } 
                  />
                </SelectTrigger>
                <SelectContent>
                  {locations.length === 0 ? (
                    <SelectItem value="no-locations" disabled>
                      No locations available
                    </SelectItem>
                  ) : (
                    locations.map((location) => (
                      <SelectItem 
                        key={location.id} 
                        value={location.id}
                      >
                        {location.location_name} - {location.location_code}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              */}
            </div>
            {errors.location_id && (
              <p className="text-red-500 text-sm mt-1">{errors.location_id}</p>
            )}
            {selectedLocation && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getLocationIcon(selectedLocation.location_type)}</span>
                  <Badge 
                    variant="outline" 
                    className="text-xs" 
                    style={{ 
                      color: getLocationColor(selectedLocation.location_type),
                      borderColor: getLocationColor(selectedLocation.location_type)
                    }}
                  >
                    {getLocationBadge(selectedLocation.location_type)}
                  </Badge>
                  <span className="font-medium text-blue-900">{selectedLocation.location_name}</span>
                  <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                    {selectedLocation.location_code}
                  </span>
                </div>
                <p className="text-sm text-blue-700 mt-1">{formatLocationSubtitle(selectedLocation)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Additional Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Additional Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="reference_number">Reference Number (Optional)</Label>
            <Input
              id="reference_number"
              value={formData.reference_number}
              onChange={(e) => handleInputChange('reference_number', e.target.value)}
              placeholder="Enter reference number"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Enter any additional notes or special requirements"
              className="mt-2 min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onBack}>
          Back to Customer
        </Button>
        <Button
          onClick={handleNext}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Continue to Items
        </Button>
      </div>
    </div>
  );
}
