'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Building2, 
  Search, 
  ChevronDown, 
  Check, 
  X, 
  Filter,
  MapPin 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Location, LocationType } from '@/types/location';

interface LocationSelectorProps {
  locations: Location[];
  selectedLocationId?: string;
  selectedLocationIds?: string[];
  onSelect?: (location: Location) => void;
  onSelectMultiple?: (locations: Location[]) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
  error?: string;
  showActiveOnly?: boolean;
  allowedTypes?: LocationType[];
  compact?: boolean;
}

const locationTypeLabels: Record<LocationType, string> = {
  WAREHOUSE: 'Warehouse',
  STORE: 'Store',
  SERVICE_CENTER: 'Service Center',
};

const locationTypeColors: Record<LocationType, string> = {
  WAREHOUSE: 'bg-slate-100 text-slate-800',
  STORE: 'bg-green-100 text-green-800',
  SERVICE_CENTER: 'bg-orange-100 text-orange-800',
};

export function LocationSelector({
  locations,
  selectedLocationId,
  selectedLocationIds = [],
  onSelect,
  onSelectMultiple,
  multiple = false,
  placeholder = 'Select location...',
  disabled = false,
  className,
  label,
  required = false,
  error,
  showActiveOnly = true,
  allowedTypes,
  compact = false,
}: LocationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<LocationType | 'ALL'>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Filter locations based on criteria
  const filteredLocations = useMemo(() => {
    let filtered = locations || [];

    // Filter by active status
    if (showActiveOnly) {
      filtered = filtered.filter(loc => loc.is_active);
    }

    // Filter by allowed types
    if (allowedTypes && allowedTypes.length > 0) {
      filtered = filtered.filter(loc => allowedTypes.includes(loc.location_type));
    }

    // Filter by type filter
    if (filterType !== 'ALL') {
      filtered = filtered.filter(loc => loc.location_type === filterType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(loc => {
        const name = loc.name || loc.location_name || '';
        return name.toLowerCase().includes(query) ||
          (loc.code || '').toLowerCase().includes(query) ||
          (loc.address || '').toLowerCase().includes(query) ||
          (loc.city || '').toLowerCase().includes(query);
      });
    }

    return filtered.sort((a, b) => {
      const nameA = a.name || a.location_name || '';
      const nameB = b.name || b.location_name || '';
      return nameA.localeCompare(nameB);
    });
  }, [locations, showActiveOnly, allowedTypes, filterType, searchQuery]);

  // Get selected location(s)
  const selectedLocation = selectedLocationId 
    ? (locations || []).find(loc => loc.id === selectedLocationId)
    : null;

  const selectedLocations = selectedLocationIds
    .map(id => (locations || []).find(loc => loc.id === id))
    .filter(Boolean) as Location[];

  const handleSelect = (location: Location) => {
    if (multiple) {
      const isSelected = selectedLocationIds.includes(location.id);
      const newSelectedIds = isSelected
        ? selectedLocationIds.filter(id => id !== location.id)
        : [...selectedLocationIds, location.id];
      
      const newSelectedLocations = newSelectedIds
        .map(id => (locations || []).find(loc => loc.id === id))
        .filter(Boolean) as Location[];
      
      onSelectMultiple?.(newSelectedLocations);
    } else {
      onSelect?.(location);
      setOpen(false);
    }
  };

  const handleRemove = (locationId: string) => {
    if (multiple) {
      const newSelectedIds = selectedLocationIds.filter(id => id !== locationId);
      const newSelectedLocations = newSelectedIds
        .map(id => (locations || []).find(loc => loc.id === id))
        .filter(Boolean) as Location[];
      
      onSelectMultiple?.(newSelectedLocations);
    }
  };

  const getLocationTypeBadge = (type: LocationType) => (
    <Badge className={`${locationTypeColors[type]} text-xs`}>
      {locationTypeLabels[type]}
    </Badge>
  );

  const formatLocationDisplay = (location: Location) => {
    const displayName = location.location_name || location.name || '';
    
    if (compact) {
      return displayName;
    }
    
    const address = [location.city, location.state].filter(Boolean).join(', ');
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{displayName}</div>
          <div className="text-sm text-muted-foreground truncate">
            {location.location_code || location.code || ''}
            {address && ` • ${address}`}
          </div>
        </div>
        <div className="ml-2 flex-shrink-0">
          {getLocationTypeBadge(location.location_type)}
        </div>
      </div>
    );
  };

  const renderSelectedValue = () => {
    if (multiple && selectedLocations.length > 0) {
      if (selectedLocations.length === 1) {
        return selectedLocations[0].location_name;
      }
      return `${selectedLocations.length} locations selected`;
    }
    
    if (selectedLocation) {
      return selectedLocation.location_name;
    }
    
    return placeholder;
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between',
              error && 'border-red-500',
              !selectedLocation && !selectedLocations.length && 'text-muted-foreground'
            )}
          >
            <div className="flex items-center truncate">
              <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">{renderSelectedValue()}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Search locations..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="border-0 focus:ring-0"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="ml-2"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {showFilters && (
              <div className="p-3 border-b bg-muted/50">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Filter by type</Label>
                  <Select value={filterType} onValueChange={(value: LocationType | 'ALL') => setFilterType(value)}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      {Object.entries(locationTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <CommandList>
              <CommandEmpty>No locations found.</CommandEmpty>
              <CommandGroup>
                {filteredLocations.map((location) => {
                  const isSelected = multiple 
                    ? selectedLocationIds.includes(location.id)
                    : selectedLocationId === location.id;

                  return (
                    <CommandItem
                      key={location.id}
                      value={`${location.location_name || location.name || ''} ${location.location_code || location.code || ''}`}
                      onSelect={() => handleSelect(location)}
                      className="flex items-center space-x-2 p-2"
                    >
                      {multiple && (
                        <Checkbox
                          checked={isSelected}
                          className="mr-2"
                        />
                      )}
                      <div className="flex-1">
                        {formatLocationDisplay(location)}
                      </div>
                      {!multiple && isSelected && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Multiple selection chips */}
      {multiple && selectedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedLocations.map((location) => (
            <Badge key={location.id} variant="secondary" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {location.location_name || location.name || ''}
              <button
                type="button"
                onClick={() => handleRemove(location.id)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}