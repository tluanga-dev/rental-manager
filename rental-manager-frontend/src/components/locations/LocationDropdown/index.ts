// Main component export
export { LocationDropdown } from './LocationDropdown';

// Type exports
export type { 
  LocationDropdownProps, 
  LocationType,
  LocationOption,
  LocationSelectionEvent,
  LocationDisplayConfig,
  LocationSearchConfig 
} from './LocationDropdown.types';

// Utility exports
export { 
  locationDisplayUtils,
  formatLocationName,
  formatLocationSubtitle,
  searchLocations,
  filterLocationsByType,
  filterLocationsByStatus,
  sortLocationsByRelevance,
  createLocationOption,
  generateMockLocations
} from './location-utils';

// Configuration exports
export { 
  LOCATION_TYPE_VISUAL_CONFIG,
  LOCATION_STATUS_CONFIG,
  DEFAULT_SEARCH_CONFIG,
  PERFORMANCE_CONFIG 
} from './LocationDropdown.types';