import { useQuery } from '@tanstack/react-query';
import { unitOfMeasurementApi } from '@/services/api/unit-of-measurement';
import { unitOfMeasurementKeys } from '@/lib/query-keys';

export interface UseUnitsOfMeasurementOptions {
  search?: string;
  includeInactive?: boolean;
  page?: number;
  page_size?: number;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  is_active?: boolean;
  cacheTime?: number;
  staleTime?: number;
  enabled?: boolean;
}

export function useUnitsOfMeasurement(options: UseUnitsOfMeasurementOptions = {}) {
  const {
    search,
    includeInactive = false,
    page = 1,
    page_size = 100,
    sort_field = 'name',
    sort_direction = 'asc',
    is_active,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 1 * 60 * 1000, // 1 minute
    enabled = true,
  } = options;

  const queryParams = {
    search,
    page,
    page_size,
    sort_field,
    sort_direction,
    is_active: includeInactive ? undefined : (is_active ?? true),
    include_inactive: includeInactive,
  };

  return useQuery({
    queryKey: unitOfMeasurementKeys.list(queryParams),
    queryFn: () => unitOfMeasurementApi.list(queryParams),
    enabled,
    cacheTime,
    staleTime,
  });
}