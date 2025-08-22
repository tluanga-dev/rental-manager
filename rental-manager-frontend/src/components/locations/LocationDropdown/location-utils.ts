import type { Location } from '@/types/location';
import type { 
  LocationType, 
  LocationOption, 
  LocationDisplayUtils, 
  LocationSearchConfig 
} from './LocationDropdown.types';
import { 
  LOCATION_TYPE_VISUAL_CONFIG, 
  LOCATION_STATUS_CONFIG, 
  DEFAULT_SEARCH_CONFIG 
} from './LocationDropdown.types';

/**
 * Format location name according to PRD specifications
 * Format: [Type Badge] Location Name - Location Code
 */
export function formatLocationName(location: Location): string {
  const typeConfig = LOCATION_TYPE_VISUAL_CONFIG[location.location_type];
  const badge = `[${typeConfig.badge}]`;
  const code = location.location_code;
  const name = location.location_name;
  
  return `${badge} ${name} - ${code}`;
}

/**
 * Format location subtitle
 * Format: City, State
 */
export function formatLocationSubtitle(location: Location): string {
  const parts: string[] = [];
  
  if (location.city) {
    parts.push(location.city);
  }
  
  if (location.state) {
    parts.push(location.state);
  }
  
  return parts.join(', ') || 'No address information';
}

/**
 * Get location type icon from PRD configuration
 */
export function getLocationIcon(type: LocationType): string {
  return LOCATION_TYPE_VISUAL_CONFIG[type].icon;
}

/**
 * Get location type badge from PRD configuration
 */
export function getLocationBadge(type: LocationType): string {
  return LOCATION_TYPE_VISUAL_CONFIG[type].badge;
}

/**
 * Get location type color from PRD configuration
 */
export function getLocationColor(type: LocationType): string {
  return LOCATION_TYPE_VISUAL_CONFIG[type].color;
}

/**
 * Check if location is active
 */
export function isLocationActive(location: Location): boolean {
  return location.is_active;
}

/**
 * Check if text should be highlighted for search match
 */
export function shouldHighlightMatch(text: string, searchTerm: string): boolean {
  if (!searchTerm) return false;
  return text.toLowerCase().includes(searchTerm.toLowerCase());
}

/**
 * Search locations by multiple fields as per PRD
 */
export function searchLocations(
  locations: Location[], 
  query: string, 
  searchFields: Array<'name' | 'code' | 'city' | 'state'> = DEFAULT_SEARCH_CONFIG.searchFields
): Location[] {
  if (!query.trim()) {
    return locations;
  }
  
  const normalizedQuery = query.toLowerCase().trim();
  
  return locations.filter(location => {
    return searchFields.some(field => {
      let value = '';
      
      switch (field) {
        case 'name':
          value = location.location_name?.toLowerCase() || '';
          break;
        case 'code':
          value = location.location_code?.toLowerCase() || '';
          break;
        case 'city':
          value = location.city?.toLowerCase() || '';
          break;
        case 'state':
          value = location.state?.toLowerCase() || '';
          break;
      }
      
      return value.includes(normalizedQuery);
    });
  });
}

/**
 * Filter locations by type
 */
export function filterLocationsByType(
  locations: Location[], 
  allowedTypes?: LocationType[]
): Location[] {
  if (!allowedTypes || allowedTypes.length === 0) {
    return locations;
  }
  
  return locations.filter(location => 
    allowedTypes.includes(location.location_type)
  );
}

/**
 * Filter locations by active status
 */
export function filterLocationsByStatus(
  locations: Location[], 
  includeInactive: boolean = false
): Location[] {
  if (includeInactive) {
    return locations;
  }
  
  return locations.filter(location => location.is_active);
}

/**
 * Sort locations by relevance (PRD criteria)
 * 1. Active status
 * 2. Type priority (Warehouse > Store > Service Center > Other)
 * 3. Alphabetical by name
 */
export function sortLocationsByRelevance(locations: Location[]): Location[] {
  const typePriority: Record<LocationType, number> = {
    WAREHOUSE: 4,
    STORE: 3,
    SERVICE_CENTER: 2,
    OTHER: 1
  };
  
  return [...locations].sort((a, b) => {
    // First priority: Active status
    if (a.is_active !== b.is_active) {
      return a.is_active ? -1 : 1;
    }
    
    // Second priority: Type priority
    const typeDiff = typePriority[b.location_type] - typePriority[a.location_type];
    if (typeDiff !== 0) {
      return typeDiff;
    }
    
    // Third priority: Alphabetical by name
    return a.location_name.localeCompare(b.location_name);
  });
}

/**
 * Create location option for dropdown display
 */
export function createLocationOption(
  location: Location,
  selectedLocationId?: string,
  highlightedIndex?: number,
  index?: number,
  searchTerm?: string
): LocationOption {
  const typeConfig = LOCATION_TYPE_VISUAL_CONFIG[location.location_type];
  const isActive = isLocationActive(location);
  const isSelected = selectedLocationId === location.id;
  const isHighlighted = highlightedIndex === index;
  
  // Find search matches for highlighting
  const searchMatches: string[] = [];
  if (searchTerm) {
    const fields = ['location_name', 'location_code', 'city', 'state'] as const;
    fields.forEach(field => {
      const value = location[field];
      if (value && shouldHighlightMatch(value, searchTerm)) {
        searchMatches.push(field);
      }
    });
  }
  
  return {
    location,
    displayName: formatLocationName(location),
    displaySubtitle: formatLocationSubtitle(location),
    typeConfig,
    isActive,
    isSelected,
    isHighlighted,
    searchMatches
  };
}

/**
 * Highlight matching text in search results
 */
export function highlightSearchMatch(text: string, searchTerm: string): string {
  if (!searchTerm || !shouldHighlightMatch(text, searchTerm)) {
    return text;
  }
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Get recent locations from localStorage
 */
export function getRecentLocations(limit: number = 5): string[] {
  try {
    const recent = localStorage.getItem('recentLocations');
    const recentIds = recent ? JSON.parse(recent) : [];
    return Array.isArray(recentIds) ? recentIds.slice(0, limit) : [];
  } catch (error) {
    console.warn('Failed to load recent locations:', error);
    return [];
  }
}

/**
 * Add location to recent list
 */
export function addToRecentLocations(locationId: string, limit: number = 5): void {
  try {
    const recent = getRecentLocations(limit);
    
    // Remove if already exists
    const filtered = recent.filter(id => id !== locationId);
    
    // Add to beginning
    const updated = [locationId, ...filtered].slice(0, limit);
    
    localStorage.setItem('recentLocations', JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save recent location:', error);
  }
}

/**
 * Generate mock locations for development
 */
export function generateMockLocations(count: number = 20): Location[] {
  const types: LocationType[] = ['WAREHOUSE', 'STORE', 'SERVICE_CENTER', 'OTHER'];
  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad'];
  const states = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'West Bengal', 'Telangana', 'Gujarat'];
  
  return Array.from({ length: count }, (_, index) => {
    const type = types[index % types.length];
    const city = cities[index % cities.length];
    const state = states[index % states.length];
    const isInactive = index % 8 === 0; // 12.5% inactive
    
    const typeLabel = LOCATION_TYPE_VISUAL_CONFIG[type].label;
    const name = `${typeLabel} ${index + 1}`;
    const code = `${LOCATION_TYPE_VISUAL_CONFIG[type].badge}${String(index + 1).padStart(3, '0')}`;
    
    return {
      id: `location-${index + 1}`,
      location_code: code,
      location_name: name,
      location_type: type,
      address: `${index + 1} Sample Street`,
      city,
      state,
      country: 'India',
      postal_code: `${400000 + index}`,
      contact_number: `+91-${9000000000 + index}`,
      email: `${code.toLowerCase()}@company.com`,
      manager_user_id: null,
      is_active: !isInactive,
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };
  });
}

/**
 * Location display utilities object
 */
export const locationDisplayUtils: LocationDisplayUtils = {
  formatLocationName,
  formatLocationSubtitle,
  getLocationIcon,
  getLocationBadge,
  getLocationColor,
  isLocationActive,
  shouldHighlightMatch
};