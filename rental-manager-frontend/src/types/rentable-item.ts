// Rentable item type definitions for dropdown component

export interface RentableItemLocation {
  location_id: string;
  location_name: string;
  available_quantity: number;
  total_stock: number;
}

export interface RentableItemAvailability {
  total_available: number;
  locations: RentableItemLocation[];
}

export interface RentableItemCategory {
  id: string | null;
  name: string | null;
}

export interface RentableItemBrand {
  id: string | null;
  name: string | null;
}

export interface RentableItemPricing {
  base_price: number | null;
  min_rental_days: number;
  max_rental_days: number | null;
  rental_period: string | null;
}

export interface RentableItemDetails {
  model_number: string | null;
  barcode: string | null;
  weight: number | null;
  dimensions: string | null;
  is_serialized: boolean;
}

export interface RentableItem {
  id: string;
  sku: string;
  item_name: string;
  category: RentableItemCategory | null;
  brand: RentableItemBrand | null;
  rental_pricing: RentableItemPricing;
  availability: RentableItemAvailability;
  item_details: RentableItemDetails;
  
  // Rental blocking fields
  is_rental_blocked?: boolean;
  rental_block_reason?: string;
  rental_blocked_at?: string;
  rental_blocked_by?: string;
}

export interface RentableItemListResponse {
  items: RentableItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface RentableItemSearchParams {
  search?: string;
  location_id?: string;
  category_id?: string;
  skip?: number;
  limit?: number;
}

// Props for the RentableItemDropdown component
export interface RentableItemDropdownProps {
  value?: RentableItem | null;
  onValueChange: (item: RentableItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  locationId?: string;
  categoryId?: string;
  searchPlaceholder?: string;
  showAvailability?: boolean;
  showPricing?: boolean;
  maxItems?: number;
  onError?: (error: string) => void;
}

// Props for the virtual list component
export interface VirtualRentableItemListProps {
  items: RentableItem[];
  selectedItem?: RentableItem | null;
  onItemSelect: (item: RentableItem) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  showAvailability?: boolean;
  showPricing?: boolean;
  className?: string;
  itemHeight?: number;
  maxHeight?: number;
}

// Hook return type
export interface UseRentableItemsResult {
  data: RentableItemListResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}

// Search hook return type
export interface UseRentableItemSearchResult {
  items: RentableItem[];
  isLoading: boolean;
  error: Error | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
}

// API request/response types matching backend
export interface RentableItemApiParams {
  search?: string;
  location_id?: string;
  category_id?: string;
  skip?: number;
  limit?: number;
}

export interface RentableItemApiResponse {
  items: RentableItem[];
  total: number;
  skip: number;
  limit: number;
}

// Error types
export interface RentableItemError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

// Selection state for multi-select scenarios (future use)
export interface RentableItemSelection {
  item: RentableItem;
  quantity: number;
  selectedLocationId?: string;
}

// Filtering options
export interface RentableItemFilters {
  categoryIds?: string[];
  brandIds?: string[];
  locationIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  minAvailableQuantity?: number;
  hasAvailability?: boolean;
}

// Sorting options
export type RentableItemSortField = 
  | 'sku'
  | 'item_name' 
  | 'base_price'
  | 'total_available'
  | 'category_name'
  | 'brand_name';

export interface RentableItemSortOptions {
  field: RentableItemSortField;
  direction: 'asc' | 'desc';
}

// Performance tracking
export interface RentableItemPerformanceMetrics {
  searchStartTime: number;
  searchEndTime: number;
  searchDuration: number;
  totalItems: number;
  itemsPerSecond: number;
}