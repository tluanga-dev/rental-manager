import type { Location } from '@/types/location';

// LocationType as defined in PRD
export type LocationType = 'WAREHOUSE' | 'STORE' | 'SERVICE_CENTER' | 'OTHER';

// PRD-compliant LocationDropdown props interface
export interface LocationDropdownProps {
  // Core props
  value?: string; // Selected location ID
  onChange: (location: Location | null) => void;
  
  // Filter options
  allowedTypes?: LocationType[];
  includeInactive?: boolean;
  
  // UI props
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  
  // Search configuration
  searchFields?: ('name' | 'code' | 'city' | 'state')[];
  displayFormat?: 'full' | 'compact';
  
  // Additional props for integration
  className?: string;
  error?: string;
  name?: string;
  id?: string;
}

// Location display configuration as per PRD
export interface LocationDisplayConfig {
  showCode: boolean;
  showType: boolean;
  showAddress: boolean;
  showCity: boolean;
  showState: boolean;
}

// Location type visual specifications from PRD
export const LOCATION_TYPE_VISUAL_CONFIG = {
  WAREHOUSE: {
    badge: 'W',
    color: '#2563eb', // Blue
    icon: '📦',
    label: 'Warehouse'
  },
  STORE: {
    badge: 'S', 
    color: '#16a34a', // Green
    icon: '🏪',
    label: 'Store'
  },
  SERVICE_CENTER: {
    badge: 'SC',
    color: '#ea580c', // Orange
    icon: '🔧',
    label: 'Service Center'
  },
  OTHER: {
    badge: 'O',
    color: '#6b7280', // Gray
    icon: '📍',
    label: 'Other'
  }
} as const;

// Status indicator configuration
export const LOCATION_STATUS_CONFIG = {
  active: {
    display: 'normal',
    color: 'text-gray-900'
  },
  inactive: {
    display: 'strikethrough',
    color: 'text-gray-400',
    badge: {
      text: 'INACTIVE',
      color: '#dc2626' // Red
    }
  }
} as const;

// Search configuration
export interface LocationSearchConfig {
  debounceMs: number;
  maxResults: number;
  highlightMatches: boolean;
  searchFields: Array<'name' | 'code' | 'city' | 'state'>;
}

// Default search configuration from PRD
export const DEFAULT_SEARCH_CONFIG: LocationSearchConfig = {
  debounceMs: 300,
  maxResults: 100,
  highlightMatches: true,
  searchFields: ['name', 'code', 'city']
};

// Performance configuration from PRD
export const PERFORMANCE_CONFIG = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 15 * 60 * 1000, // 15 minutes
  virtualScrollThreshold: 100,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  retry: 3,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000)
};

// Location query parameters for API calls
export interface LocationQueryParams {
  types?: LocationType[];
  include_inactive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// Location option for dropdown display
export interface LocationOption {
  location: Location;
  displayName: string;
  displaySubtitle: string;
  typeConfig: typeof LOCATION_TYPE_VISUAL_CONFIG[LocationType];
  isActive: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  searchMatches: string[];
}

// Location selection event
export interface LocationSelectionEvent {
  location: Location;
  source: 'search' | 'browse' | 'recent';
  searchTerm?: string;
}

// Component state interface
export interface LocationDropdownState {
  isOpen: boolean;
  searchQuery: string;
  selectedLocation: Location | null;
  filteredLocations: Location[];
  highlightedIndex: number;
  isLoading: boolean;
  error: string | null;
  recentLocations: Location[];
}

// Location utils interface
export interface LocationDisplayUtils {
  formatLocationName: (location: Location) => string;
  formatLocationSubtitle: (location: Location) => string;
  getLocationIcon: (type: LocationType) => string;
  getLocationBadge: (type: LocationType) => string;
  getLocationColor: (type: LocationType) => string;
  isLocationActive: (location: Location) => boolean;
  shouldHighlightMatch: (text: string, searchTerm: string) => boolean;
}