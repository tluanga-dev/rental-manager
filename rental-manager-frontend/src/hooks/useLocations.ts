/**
 * Custom hook for managing locations
 */

import { useQuery } from '@tanstack/react-query';
import { locationsApi } from '@/services/api/locations';

export const useLocations = () => {
  const {
    data: locations = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['locations'],
    queryFn: locationsApi.getAll,
    staleTime: 1000 * 60 * 5, // Consider data stale after 5 minutes
    cacheTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });

  return {
    locations,
    isLoading,
    error,
    refetch
  };
};

export const useLocation = (id: string) => {
  const {
    data: location,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['location', id],
    queryFn: () => locationsApi.getById(id),
    enabled: !!id,
  });

  return {
    location,
    isLoading,
    error,
    refetch
  };
};