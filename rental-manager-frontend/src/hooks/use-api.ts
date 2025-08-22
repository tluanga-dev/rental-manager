import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

// Generic API hooks
export function useApiQuery<T>(
  key: string[],
  url: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const response = await api.get<ApiResponse<T>>(url);
      return response.data.data;
    },
    ...options,
  });
}

export function useApiMutation<T, V = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: any) => void;
    invalidateQueries?: string[][];
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: V) => {
      const response = await api.request<ApiResponse<T>>({
        method,
        url,
        data: method !== 'DELETE' ? data : undefined,
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });
      }
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}

export function usePaginatedQuery<T>(
  key: string[],
  url: string,
  page: number = 1,
  size: number = 10,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: [...key, { page, size }],
    queryFn: async () => {
      const response = await api.get<ApiResponse<PaginatedResponse<T>>>(
        `${url}?page=${page}&size=${size}`
      );
      return response.data.data;
    },
    ...options,
  });
}